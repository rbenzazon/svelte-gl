import { getTranslation, orthoNO, lookAt } from "gl-matrix/mat4";
import depthVertexShader from "../shaders/depth-vertex.glsl";
import depthFragmentShader from "../shaders/depth-fragment.glsl";
import { bindDefaultFramebuffer, linkProgram, useProgram, validateProgram } from "./gl-refactor";
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
import { selectProgram } from "./engine-refactor";
import { appContext } from "./engine-refactor";

export function createContactShadowPass(width, height, depth, groundMatrix, blurSize = 128) {
	const groundTranslation = getTranslation([], groundMatrix);
	const aspect = width / height;
	const textureWidth = 512 * aspect;
	const textureHeight = 512 / aspect;

	const projection = orthoNO(new Float32Array(16), -width / 2, width / 2, -height / 2, height / 2, 0, depth);

	const view = lookAt(
		new Float32Array(16),
		groundTranslation,
		[groundTranslation[0], groundTranslation[1] + 1, groundTranslation[2]],
		[0, 0, -1],
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
		return horizontalBlurTexture;
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
				createProgram: createShadowProgram(textureWidth, textureHeight),
				setupProgram: [
					createShaders,
					linkProgram,
					validateProgram,
					createFBO(textureWidth, textureHeight, setGeometryFBO, setGeometryTexture),
				],
				setupMaterial: [],
				useProgram,
				selectProgram,
				setupCamera: setupShadowCamera(projection, view),
				setFrameBuffer: setFrameBuffer(getGeometryFBO),
				allMeshes: true,
			},
			{
				createProgram: createBlurProgram(),
				setupProgram: [
					createBlurShaders,
					linkProgram,
					validateProgram,
					setupBlurKernel(127),
					createFBO(textureWidth, textureHeight, setHorizontalBlurFBO, setHorizontalBlurTexture),
				],
				setupMaterial: [],
				useProgram,
				selectProgram: selectBlurProgram(BLUR_DIRECTION_HORIZONTAL, getGeometryTexture),
				setupCamera: () => {},
				setFrameBuffer: setFrameBuffer(getHorizontalBlurFBO),
				meshes: [blurMesh],
			},
			{
				createProgram: createBlurProgram(true),
				setupProgram: [createFBO(textureWidth, textureHeight, setVerticalBlurFBO, setVerticalBlurTexture)],
				setupMaterial: [],
				useProgram,
				selectProgram: selectBlurProgram(BLUR_DIRECTION_VERTICAL, getHorizontalBlurTexture),
				setupCamera: () => {},
				setFrameBuffer: setFrameBuffer(getVerticalBlurFBO),
				meshes: [blurMesh],
				postDraw: setFrameBuffer(),
			},
		],
		getTexture: getVerticalBlurTexture,
		order: -1,
	};
}

function setupBlurKernel(size) {
	return function setupBlurKernel() {
		//rollup will remove the "size" argument form getKernel call
		const rollupWorkAround = {
			size,
		};
		const kernel = getKernel(rollupWorkAround.size);
		setKernelUniforms(kernel);
		//workaround to prevent rollup from removing the getKernel argument
		return rollupWorkAround;
	};
}

function selectBlurProgram(blurDirection, getTexture) {
	return function selectBlurProgram(programStore) {
		return function selectBlurProgram() {
			selectProgram(programStore)();
			setDirectionUniform(blurDirection);
		};
	};
}

function setFrameBuffer(getFBO = null) {
	return function setFrameBuffer() {
		const { gl } = appContext;
		const fbo = getFBO ? getFBO() : null;
		gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
	};
}

function setupShadowCamera(projection, view) {
	return function setupShadowCamera() {
		const { gl, program } = appContext;

		const projectionLocation = gl.getUniformLocation(program, "projectionMatrix");
		gl.uniformMatrix4fv(projectionLocation, false, projection);

		const viewLocation = gl.getUniformLocation(program, "modelViewMatrix");
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

function createShadowProgram(textureWidth, textureHeight) {
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

/*function createFBO(setTexture) {
	return function createFBO(width, height) {
		const { gl } = appContext;

		// Create FBO
		let fbo = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

		// Create texture
		const texture = gl.createTexture();
		setTexture(texture);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

		// Attach texture to FBO
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

		// Create renderbuffer
		const renderbuffer = gl.createRenderbuffer();
		gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
		gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);

		// Attach renderbuffer to FBO
		gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderbuffer);

		// Check FBO status
		const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
		if (status !== gl.FRAMEBUFFER_COMPLETE) {
			console.error("Framebuffer is incomplete:", status);
		}

		// Cleanup
		gl.bindTexture(gl.TEXTURE_2D, null);
		gl.bindRenderbuffer(gl.RENDERBUFFER, null);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		return {
			fbo,
			texture,
		};
	};
}*/

function createFBO(width, height, setFBO, setTexture) {
	return function createFBO() {
		const { gl } = appContext;
		// The geometry texture will be sampled during the HORIZONTAL pass
		const texture = gl.createTexture();
		setTexture(texture);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, width, height);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);

		const fbo = gl.createFramebuffer();
		setFBO(fbo);
		gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

		gl.bindTexture(gl.TEXTURE_2D, null);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	};
}

function createHorizontalBlurProgram() {
	return createBlurProgram(BLUR_DIRECTION_HORIZONTAL, 128);
}

function createHorizontalBlurShaders() {}

function createVerticalBlurProgram() {
	return createBlurProgram(BLUR_DIRECTION_VERTICAL, 128);
}
