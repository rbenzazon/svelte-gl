import { getTranslation, orthoNO, lookAt } from "gl-matrix/mat4";
import depthVertexShader from "../shaders/depth-vertex.glsl";
import depthFragmentShader from "../shaders/depth-fragment.glsl";
import { getCameraProjectionView, linkProgram, useProgram, validateProgram } from "./gl";
import {
	BLUR_DIRECTION_HORIZONTAL,
	BLUR_DIRECTION_VERTICAL,
	createBlurMesh,
	createBlurProgram,
	createBlurShaders,
	getKernel,
	setDirectionUniform,
	setKernelUniforms,
} from "./blur";
import { selectProgram } from "./engine";
import { appContext } from "./engine";
import { createZeroMatrix } from "../geometries/common";
/**
 * @typedef {Object} ContactShadowPass
 * @property {import("./engine").SvelteGLProgram[]} programs array of programs used in the pass
 * @property {() => WebGLTexture} getTexture function to get the shadow texture
 * @property {number} order order of the pass in the rendering pipeline
 */

/**
 *
 * @param {mat4} groundMatrix plane ground matrix used as orthographic camera for the shadow rendering
 * @param {number} depth how far objects in height are see from the shadow camera
 * @param {number} width width of the plane that will receive the shadow
 * @param {number} height height of the plane that will receive the shadow
 * @param {number} textureSize size of the texture used to render the shadow
 * @param {number} blurSize size of the blur
 * @param {number} darkness darkness of the shadow
 * @returns {ContactShadowPass} object containing the shadow pass
 *
 */
export function createContactShadowPass(
	groundMatrix,
	depth,
	width,
	height,
	textureSize = 1024,
	blurSize = 128,
	darkness = 1,
) {
	const groundTranslation = getTranslation([], groundMatrix);
	const aspect = width / height;
	const textureWidth = textureSize * aspect;
	const textureHeight = textureSize / aspect;
	//log("creating contact shadow pass", width, height, depth, groundMatrix, blurSize);

	const projection = orthoNO(createZeroMatrix(), -width / 2, width / 2, -height / 2, height / 2, 0, depth);

	const view = lookAt(
		createZeroMatrix(),
		groundTranslation,
		[groundTranslation[0], groundTranslation[1] + 1, groundTranslation[2]],
		[0, 0, 1],
	);

	const offsetsAndScales = new Float32Array(256); // Supports gaussian blurs up to 255x255
	let kernelWidth;

	let shadowFBO;

	let horizontalBlurFBO;
	function setHorizontalBlurFBO(fbo) {
		horizontalBlurFBO = fbo;
	}
	function getHorizontalBlurFBO() {
		return horizontalBlurFBO;
	}

	let horizontalBlurTexture;
	function setHorizontalBlurTexture(texture) {
		horizontalBlurTexture = texture;
	}
	function getHorizontalBlurTexture() {
		return horizontalBlurTexture;
	}

	let verticalBlurFBO;
	function setVerticalBlurFBO(fbo) {
		verticalBlurFBO = fbo;
	}
	function getVerticalBlurFBO() {
		return verticalBlurFBO;
	}

	let verticalBlurTexture;
	function setVerticalBlurTexture(texture) {
		verticalBlurTexture = texture;
	}
	function getVerticalBlurTexture() {
		return verticalBlurTexture;
	}

	let geometryFBO;
	function setGeometryFBO(fbo) {
		geometryFBO = fbo;
	}
	function getGeometryFBO() {
		return geometryFBO;
	}

	let geometryTexture;
	function setGeometryTexture(texture) {
		geometryTexture = texture;
	}
	function getGeometryTexture() {
		return geometryTexture;
	}

	let shadowTexture;

	function setTexture(texture) {
		shadowTexture = texture;
	}
	function getTexture() {
		return shadowTexture;
	}

	const blurMesh = createBlurMesh();

	return {
		programs: [
			{
				createProgram: createShadowProgram(),
				setupProgram: [
					createShaders,
					linkProgram,
					validateProgram,
					createFBO(textureWidth, textureHeight, setGeometryFBO, setGeometryTexture),
				],
				setupMaterial: [setupDarknessUniform(darkness)],
				useProgram,
				selectProgram,
				setupCamera: setupShadowCamera(projection, view),
				setFrameBuffer: setFrameBuffer(getGeometryFBO, textureWidth, textureHeight),
				allMeshes: true,
			},
			{
				createProgram: createBlurProgram(),
				setupProgram: [
					createBlurShaders,
					linkProgram,
					validateProgram,
					createFBO(textureWidth, textureHeight, setHorizontalBlurFBO, setHorizontalBlurTexture),
				],
				setupMaterial: [
					setupBlurKernel(blurSize),
					() => setDirectionUniform(BLUR_DIRECTION_HORIZONTAL),
					() => setSourceTexture(getGeometryTexture),
				],
				useProgram,
				selectProgram: selectBlurProgram(BLUR_DIRECTION_HORIZONTAL, getGeometryTexture),
				setupCamera: () => {},
				setFrameBuffer: setFrameBuffer(getHorizontalBlurFBO, textureWidth, textureHeight),
				meshes: [blurMesh],
				postDraw: unbindTexture,
			},
			{
				createProgram: createBlurProgram(true),
				setupProgram: [createFBO(textureWidth, textureHeight, setVerticalBlurFBO, setVerticalBlurTexture)],
				setupMaterial: [
					() => setDirectionUniform(BLUR_DIRECTION_VERTICAL),
					() => setSourceTexture(getHorizontalBlurTexture),
				],
				useProgram,
				selectProgram: selectBlurProgram(BLUR_DIRECTION_VERTICAL, getHorizontalBlurTexture),
				setupCamera: () => {},
				setFrameBuffer: setFrameBuffer(getVerticalBlurFBO, textureWidth, textureHeight),
				meshes: [blurMesh],
				postDraw: unbindTexture,
			},
		],
		getTexture: getVerticalBlurTexture,
		order: -1,
	};
}

function setupDarknessUniform(darkness) {
	return function setupDarknessUniform() {
		const { gl, program } = appContext;
		const darknessLocation = gl.getUniformLocation(program, "darkness");
		gl.uniform1f(darknessLocation, darkness);
	};
}

function setupBlurKernel(size) {
	return function setupBlurKernel() {
		//rollup will remove the "size" argument form getKernel call
		const rollupWorkAround = {
			size,
		};
		const kernel = getKernel(rollupWorkAround.size - 1);
		setKernelUniforms(kernel);
		//workaround to prevent rollup from removing the getKernel argument
		return rollupWorkAround;
	};
}

function unbindTexture() {
	const { gl } = appContext;
	gl.bindTexture(gl.TEXTURE_2D, null);
}

function selectBlurProgram(blurDirection, getTexture) {
	return function selectBlurProgram(programStore) {
		return function selectBlurProgram() {
			selectProgram(programStore)();
			useProgram();
			setSourceTexture(getTexture);
			setDirectionUniform(blurDirection);
		};
	};
}

function setSourceTexture(getTexture) {
	const { gl } = appContext;
	const texture = getTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);
}

function setFrameBuffer(getFBO = null, width, height) {
	return function setFrameBuffer() {
		const { gl } = appContext;
		const fbo = getFBO ? getFBO() : null;
		gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
		if (appContext.fbo !== fbo && fbo != null) {
			//log("framebuffer change clearing from", appContext.fbo, "to", fbo, [0, 0, 0, 1], width, height);
			gl.viewport(0, 0, width, height);
			appContext.frameBufferWidth = width;
			appContext.frameBufferHeight = height;
			gl.clearColor(...[0, 0, 0, 0]);
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		}
		appContext.fbo = fbo;
	};
}

function setupShadowCamera(projection, view) {
	return function setupShadowCamera() {
		const { gl, program } = appContext;

		const projectionLocation = gl.getUniformLocation(program, "projection");

		gl.uniformMatrix4fv(projectionLocation, false, projection);

		const viewLocation = gl.getUniformLocation(program, "view");
		gl.uniformMatrix4fv(viewLocation, false, view);
	};
}

function createShaders() {
	const { gl, program } = appContext;

	const vertexShader = gl.createShader(gl.VERTEX_SHADER);
	gl.shaderSource(vertexShader, depthVertexShader);
	gl.compileShader(vertexShader);
	if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
		console.error(gl.getShaderInfoLog(vertexShader));
	}
	gl.attachShader(program, vertexShader);

	const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
	gl.shaderSource(fragmentShader, depthFragmentShader);
	gl.compileShader(fragmentShader);
	if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
		console.error(gl.getShaderInfoLog(fragmentShader));
	}
	gl.attachShader(program, fragmentShader);
}

function createShadowProgram() {
	return function createShadowProgram(programStore) {
		return function createShadowProgram() {
			const { gl, programMap, vaoMap } = appContext;

			// Create shader program
			const program = gl.createProgram();
			programMap.set(programStore, program);
			vaoMap.set(programStore, new Map());

			appContext.program = program;
		};
	};
}

function createFBO(width, height, setFBO, setTexture) {
	return function createFBO() {
		const { gl } = appContext;
		// The geometry texture will be sampled during the HORIZONTAL pass
		const texture = gl.createTexture();
		setTexture(texture);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, width, height);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

		const fbo = gl.createFramebuffer();
		setFBO(fbo);
		gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

		gl.bindTexture(gl.TEXTURE_2D, null);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	};
}
