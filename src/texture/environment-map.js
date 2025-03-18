import { createVec3 } from "../geometries/common";
import PMREMVertex from "./pmrem-vertex.glsl";
import SphericalGaussianBlurFragment from "./spherical-gaussian-blur-fragment.glsl";
import EquiRectangularToCubeUV from "./equi-rectangular-to-cube-uv-fragment.glsl";
import { createProgram, compileShaders, linkProgram, validateProgram, useProgram, unbindTexture } from "../store/gl";
import { selectProgram } from "../store/programs-cache";
import { appContext } from "../store/app-context";
import { renderPasses } from "../store/programs";
import { drawModes } from "../store/webgl";
import { templateLiteralRenderer } from "../shaders/template";
import { get } from "svelte/store";

const LOD_MIN = 4;
const EXTRA_LOD_SIGMA = [0.125, 0.215, 0.35, 0.446, 0.526, 0.582];
const MAX_SAMPLES = 20;
// Golden Ratio
const PHI = (1 + Math.sqrt(5)) / 2;
const INV_PHI = 1 / PHI;

/** @type {vec3[]} */
const axisDirections = [
	[-PHI, INV_PHI, 0],
	[PHI, INV_PHI, 0],
	[-INV_PHI, 0, PHI],
	[INV_PHI, 0, PHI],
	[0, PHI, -INV_PHI],
	[0, PHI, INV_PHI],
	[-1, 1, -1],
	[1, 1, -1],
	[-1, 1, 1],
	[1, 1, 1],
];

/**
 * @typedef {Object} EnvMapContext
 * @property {import("src/loaders/rgbe-loader").RGBE} image
 * @property {number} cubeImageSize
 * @property {number} lodMax
 * @property {number} cubeSize
 * @property {number} renderTargetWidth
 * @property {number} renderTargetHeight
 * @property {SvelteGLBaseMeshData[]} lodPlanes
 * @property {number[]} sizeLods
 * @property {number[]} sigmas
 */

/**
 *
 * @param {import("src/loaders/rgbe-loader").RGBE} image
 * @return {import("../store/programs").RenderPass}
 */
export function createEnvironmentMap(image) {
	/** @type {EnvMapContext} */
	let context = {};
	context.image = image;
	context.cubeImageSize = image.width / 4;
	context.lodMax = Math.floor(Math.log2(context.cubeImageSize));
	context.cubeSize = Math.pow(2, context.lodMax);
	context.renderTargetWidth = 3 * Math.max(context.cubeSize, 16 * 7);
	context.renderTargetHeight = 4 * context.cubeSize;
	createLodPlanes(context);
	const shaderDefines = {
		n: MAX_SAMPLES,
		CUBEUV_TEXEL_WIDTH: 1.0 / context.renderTargetWidth,
		CUBEUV_TEXEL_HEIGHT: 1.0 / context.renderTargetHeight,
		CUBEUV_MAX_MIP: `${context.lodMax}.0`,
	};

	let hdrTexture;
	function setHDRTexture(texture) {
		hdrTexture = texture;
	}
	function getHDRTexture() {
		return hdrTexture;
	}

	let pingTexture;
	function setPingTexture(texture) {
		pingTexture = texture;
	}
	function getPingTexture() {
		return pingTexture;
	}
	let pingFBO;
	function setPingFBO(fbo) {
		pingFBO = fbo;
	}
	function getPingFBO() {
		return pingFBO;
	}
	let pongTexture;
	function setPongTexture(texture) {
		pongTexture = texture;
	}
	function getPongTexture() {
		return pongTexture;
	}
	let pongFBO;
	function setPongFBO(fbo) {
		pongFBO = fbo;
	}
	function getPongFBO() {
		return pongFBO;
	}
	const finalFBOTexture =
		(Math.floor(((context.lodPlanes.length - 1) * 2 - 1) / 2) + 1) % 2 === 0 ? getPingTexture : getPongTexture;
	return {
		programs: [
			{
				createProgram: createEquiRectangularToCubeUVProgram(context, image, setHDRTexture),
				setupProgram: [
					createEquiRectangularToCubeUVShaders,
					linkProgram,
					validateProgram,
					createFBO(context, setPingFBO, setPingTexture),
				],
				useProgram,
				selectProgram,
				setupMaterial: [setupEquiRectangularToCubeUVUniforms, bindEnvMapTexture(getHDRTexture)],
				setupCamera: () => () => {},
				setFrameBuffer: setFrameBuffer(getPingFBO, context, getViewportSize, true),
				meshes: [context.lodPlanes[0]],
				/*postDraw: unbindTexture,*/
			},
			...new Array((context.lodPlanes.length - 1) * 2).fill(0).map((_, programIndex) => {
				const STANDARD_DEVIATIONS = 3;
				const lodIndex = Math.floor(programIndex / 2) + 1;

				const pair = programIndex % 2 === 0;
				const direction = pair ? "latitudinal" : "longitudinal";
				const getCurrentFBO = pair ? getPongFBO : getPingFBO;
				const getCurrentTexture = pair ? getPingTexture : getPongTexture;
				const sigma = Math.sqrt(
					context.sigmas[lodIndex] * context.sigmas[lodIndex] - context.sigmas[lodIndex - 1] * context.sigmas[lodIndex - 1],
				);
				const poleAxis = axisDirections[(context.lodPlanes.length - lodIndex - 1) % axisDirections.length];
				const lodIn = pair ? lodIndex - 1 : lodIndex;
				const lodOut = lodIndex;
				const pixels = context.sizeLods[lodIn] - 1;
				const radiansPerPixel = isFinite(sigma) ? Math.PI / (2 * pixels) : (2 * Math.PI) / (2 * MAX_SAMPLES - 1);
				const sigmaPixels = sigma / radiansPerPixel;
				const samples = isFinite(sigma) ? 1 + Math.floor(STANDARD_DEVIATIONS * sigmaPixels) : MAX_SAMPLES;

				const weights = [];

				let sum = 0;
				for (let i = 0; i < MAX_SAMPLES; ++i) {
					const x = i / sigmaPixels;
					const weight = Math.exp((-x * x) / 2);
					weights.push(weight);
					if (i === 0) {
						sum += weight;
					} else if (i < samples) {
						sum += 2 * weight;
					}
				}

				for (let i = 0; i < weights.length; i++) {
					weights[i] = weights[i] / sum;
				}
				const outputSize = context.sizeLods[lodOut];
				const x = 3 * outputSize * (lodOut > context.lodMax - LOD_MIN ? lodOut - context.lodMax + LOD_MIN : 0);
				const y = 4 * (context.cubeSize - outputSize);
				const width = 3 * outputSize;
				const height = 2 * outputSize;

				return {
					createProgram: createBlurProgram(programIndex !== 0),
					setupProgram: [
						...(programIndex === 0
							? [createBlurShader(shaderDefines), linkProgram, validateProgram, createFBO(context, setPongFBO, setPongTexture)]
							: []),
					],
					setupMaterial: [],
					useProgram,
					selectProgram,
					setupCamera: () => () => {},
					setFrameBuffer: setFrameBuffer(getCurrentFBO, context, getBlurViewportSize(x, y, width, height)),
					updateProgram: [
						bindEnvMapTexture(getCurrentTexture),
						setupBlurUniforms(
							samples,
							weights,
							direction === "latitudinal",
							poleAxis,
							radiansPerPixel,
							context.lodMax - lodIn,
						),
					],
					meshes: [/** @type {SvelteGLMesh} */ (context.lodPlanes[lodIndex])],
					...(programIndex === (context.lodPlanes.length - 1) * 2 - 1 ? { postDraw: restoreState } : {}),
				};
			}),
		],
		getTexture: finalFBOTexture,
		order: -1,
		type: "environmentMap",
		width: context.renderTargetWidth,
		height: context.renderTargetHeight,
		lodMax: context.lodMax,
	};
}

function disableDepthTest() {
	const { gl } = appContext;
	gl.disable(gl.DEPTH_TEST);
	gl.depthMask(false);
}

function restoreDepthTest() {
	const { gl } = appContext;
	gl.enable(gl.DEPTH_TEST);
	gl.depthMask(true);
}

function enableScissorTest() {
	const { gl } = appContext;
	gl.enable(gl.SCISSOR_TEST);
}

function restoreScissorTest() {
	const { gl } = appContext;
	gl.disable(gl.SCISSOR_TEST);
}

function restoreFlipY() {
	const { gl } = appContext;
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
}

function restoreState() {
	restoreDepthTest();
	restoreScissorTest();
	restoreFlipY();
	unbindTexture();
	removePassFromStore();
}

function removePassFromStore() {
	renderPasses.set(get(renderPasses).filter((pass) => pass.type !== "environmentMap"));
}

/**
 *
 * @param {number} samples
 * @param {number[]} weights
 * @param {boolean} latitudinal
 * @param {vec3} poleAxis
 * @param {number} dTheta
 * @param {number} mipInt
 *
 * @returns
 */
function setupBlurUniforms(samples, weights, latitudinal, poleAxis, dTheta, mipInt) {
	return function setupBlurUniforms() {
		const { gl, program } = appContext;
		const samplesLocation = gl.getUniformLocation(program, "samples");
		gl.uniform1i(samplesLocation, samples);
		const weightsLocation = gl.getUniformLocation(program, "weights");
		gl.uniform1fv(weightsLocation, weights);
		const latitudinalLocation = gl.getUniformLocation(program, "latitudinal");
		gl.uniform1i(latitudinalLocation, latitudinal ? 1 : 0);
		if (poleAxis) {
			const poleAxisLocation = gl.getUniformLocation(program, "poleAxis");
			gl.uniform3fv(poleAxisLocation, poleAxis);
		}
		const dThetaLocation = gl.getUniformLocation(program, "dTheta");
		gl.uniform1f(dThetaLocation, dTheta);
		const mipIntLocation = gl.getUniformLocation(program, "mipInt");
		gl.uniform1f(mipIntLocation, mipInt);
	};
}

function getViewportSize(context) {
	const size = context.cubeSize;
	return {
		x: 0,
		y: 0,
		width: 3 * size,
		height: 2 * size,
	};
}

function getBlurViewportSize(x, y, width, height) {
	return function getBlurViewportSize() {
		return {
			x,
			y,
			width,
			height,
		};
	};
}

/**
 *
 * @param {Object} context
 * @param {import("src/loaders/rgbe-loader").RGBE} image
 * @param {(value:WebGLTexture)=>void} setHDRTexture
 * @returns {(programStore)=>()=>void}
 */
function createEquiRectangularToCubeUVProgram(context, image, setHDRTexture) {
	return function createEquiRectangularToCubeUVProgram(programStore) {
		return function createEquiRectangularToCubeUVProgram() {
			const { gl } = appContext;
			const ext = gl.getExtension("EXT_color_buffer_float");
			if (!ext) {
				throw new Error("EXT_color_buffer_float extension not supported");
			}
			setupHDRTexture(image, setHDRTexture);
			createProgram(programStore)();
			disableDepthTest();
			enableScissorTest();
		};
	};
}

/**
 *
 * @param {import("src/loaders/rgbe-loader").RGBE} image
 * @param {(value:WebGLTexture)=>void} setHDRTexture
 */
function setupHDRTexture(image, setHDRTexture) {
	const { gl } = appContext;
	//flip y
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
	gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
	//pre multiply alpha false
	gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
	const texture = gl.createTexture();
	setHDRTexture(texture);
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, image.width, image.height, 0, gl.RGBA, gl.HALF_FLOAT, image.data);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	//flip y
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
	gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
	//pre multiply alpha false
	gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
	gl.bindTexture(gl.TEXTURE_2D, null);
}

function createEquiRectangularToCubeUVShaders() {
	const { gl, program } = appContext;
	compileShaders(gl, program, PMREMVertex, EquiRectangularToCubeUV);
}

/**
 * 
 * @param {{
        [x: string]: string | number | boolean;
    }} shaderDefines 
 * @returns 
 */
function createBlurShader(shaderDefines) {
	return function createBlurShader() {
		const { gl, program } = appContext;
		const fragmentShaderSource = templateLiteralRenderer(SphericalGaussianBlurFragment, shaderDefines)(shaderDefines);
		compileShaders(gl, program, PMREMVertex, fragmentShaderSource);
	};
}

/**
 *
 * @param {*} context
 * @param {*} setFBO
 * @param {*} setTexture
 * @returns
 */
function createFBO(context, setFBO, setTexture) {
	return function createFBO() {
		const { gl } = appContext;
		const { renderTargetWidth, renderTargetHeight } = context;
		// The geometry texture will be sampled during the HORIZONTAL pass
		const texture = gl.createTexture();
		setTexture(texture);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA16F, // Internal format for HDR
			renderTargetWidth,
			renderTargetHeight,
			0,
			gl.RGBA,
			gl.HALF_FLOAT,
			null,
		);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

		const fbo = gl.createFramebuffer();
		setFBO(fbo);
		gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

		gl.bindTexture(gl.TEXTURE_2D, null);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	};
}

function setupEquiRectangularToCubeUVUniforms() {
	return function setupEquiRectangularToCubeUVUniforms() {
		const { gl, program } = appContext;
		const location = gl.getUniformLocation(program, "flipEnvMap");
		gl.uniform1f(location, -1);
	};
}

function bindEnvMapTexture(getBuffer) {
	return function bindEnvMapTexture() {
		const { gl, program } = appContext;
		const textureLocation = gl.getUniformLocation(program, "envMap");
		gl.uniform1i(textureLocation, 0);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, getBuffer());
	};
}

function setFrameBuffer(getFBO = null, context, getViewportSize, clear = false) {
	return function setFrameBuffer() {
		const { gl } = appContext;
		const fbo = getFBO ? getFBO() : null;
		const { renderTargetWidth, renderTargetHeight } = context;
		gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
		if (appContext.fbo !== fbo && fbo != null) {
			const { x, y, width, height } = getViewportSize(context);
			gl.viewport(x, y, width, height);
			gl.scissor(x, y, width, height);
			appContext.frameBufferWidth = renderTargetWidth;
			appContext.frameBufferHeight = renderTargetHeight;
			if (clear) {
				gl.clearColor(...[0, 0, 0, 0]);
				gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
			}
		}
		appContext.fbo = fbo;
	};
}

/**
 *
 * @param {boolean} mapCurrent makes the previous program the current one
 * which allows to reuse one program in two consecutive and different draw passes
 * This case is necessary to draw twice with different settings (uniforms)
 * @return {(programStore)=>()=>void}
 */
export function createBlurProgram(mapCurrent = false) {
	return function createBlurProgram(programStore) {
		return function createBlurProgram() {
			const { gl, programMap, vaoMap } = appContext;
			if (!programMap.has(programStore) && !mapCurrent) {
				const program = gl.createProgram();
				programMap.set(programStore, program);
				vaoMap.set(programStore, new Map());
				appContext.program = program;
			} else if (mapCurrent) {
				programMap.set(programStore, appContext.program);
				vaoMap.set(programStore, new Map());
			} else {
				//todo check if necessary, this check is done in engine already, if it exists, createProgram is not called
				appContext.program = appContext.programMap.get(programStore);
			}
		};
	};
}

/**
 *
 * @param {EnvMapContext} context
 */
function createLodPlanes(context) {
	const lodPlanes = [];
	const sizeLods = [];
	const sigmas = [];

	let lod = context.lodMax;
	const totalLods = context.lodMax - LOD_MIN + 1 + EXTRA_LOD_SIGMA.length;

	for (let lodIndex = 0; lodIndex < totalLods; lodIndex++) {
		const sizeLod = Math.pow(2, lod);

		sizeLods.push(sizeLod);
		let sigma = 1.0 / sizeLod;

		if (lodIndex > context.lodMax - LOD_MIN) {
			sigma = EXTRA_LOD_SIGMA[lodIndex - context.lodMax + LOD_MIN - 1];
		} else if (lodIndex === 0) {
			sigma = 0;
		}

		sigmas.push(sigma);

		const texelSize = 1.0 / (sizeLod - 2);
		const min = -texelSize;
		const max = 1 + texelSize;
		const uv1 = [min, min, max, min, max, max, min, min, max, max, min, max];

		const cubeFaces = 6;
		const vertices = 6;
		const positionSize = 3;
		const uvSize = 2;
		const faceIndexSize = 1;

		const position = new Float32Array(positionSize * vertices * cubeFaces);
		const uv = new Float32Array(uvSize * vertices * cubeFaces);
		const faceIndex = new Float32Array(faceIndexSize * vertices * cubeFaces);
		for (let face = 0; face < cubeFaces; face++) {
			const x = ((face % 3) * 2) / 3 - 1;
			const y = face > 2 ? 0 : -1;
			const coordinates = [x, y, 0, x + 2 / 3, y, 0, x + 2 / 3, y + 1, 0, x, y, 0, x + 2 / 3, y + 1, 0, x, y + 1, 0];
			position.set(coordinates, positionSize * vertices * face);
			uv.set(uv1, uvSize * vertices * face);
			const fill = [face, face, face, face, face, face];
			faceIndex.set(fill, faceIndexSize * vertices * face);
		}
		const geometry = {
			attributes: {
				positions: position,
				uvs: uv,
				faceIndex: {
					array: faceIndex,
					itemSize: faceIndexSize,
				},
			},
			drawMode: drawModes[4],
		};
		lodPlanes.push(geometry);

		if (lod > LOD_MIN) {
			lod--;
		}
	}
	context.lodPlanes = lodPlanes;
	context.sizeLods = sizeLods;
	context.sigmas = sigmas;
}
