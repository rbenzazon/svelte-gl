import { getTranslation, orthoNO, lookAt } from "gl-matrix/mat4";
import depthVertexShader from "../shaders/depth-vertex.glsl";
import depthFragmentShader from "../shaders/depth-fragment.glsl";
import { bindDefaultFramebuffer, createShaders, linkProgram, useProgram, validateProgram } from "./gl-refactor";
import {
	BLUR_DIRECTION_HORIZONTAL,
	BLUR_DIRECTION_VERTICAL,
	createBlurMesh,
	createBlurProgram,
	createBlurShaders,
} from "./blur";
import { selectProgram } from "./engine-refactor";
export function createContactShadowPass(width, height, depth, groundMatrix) {
	const groundTranslation = getTranslation([], groundMatrix);
	const aspect = width / height;
	const textureWidth = 512 * aspect;
	const textureHeight = 512 / aspect;

	const projection = new Float32Array(16);
	projection = orthoNO([], -width / 2, width / 2, -height / 2, height / 2, 0, depth);

	const view = new Float32Array(16);
	view = lookAt(
		view,
		groundTranslation,
		[groundTranslation[0], groundTranslation[1] + 1, groundTranslation[2]],
		[0, 0, -1],
	);
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
				createShaders,
				linkProgram,
				validateProgram,
				useProgram,
				setupCamera: setupShadowCamera(projection, view),
				allMeshes: true,
			},
			{
				createProgram: createBlurProgram(),
				createShaders: createBlurShaders(),
				linkProgram,
				validateProgram,
				useProgram,
				selectProgram: selectBlurProgram(BLUR_DIRECTION_HORIZONTAL, 128),
				setFrameBuffer,
				meshes: [blurMesh],
			},
			{
				createProgram: createBlurProgram(),
				meshes: [blurMesh],
				postDraw: bindDefaultFramebuffer,
			},
		],
		getTexture,
		order: -1,
	};
}

function selectBlurProgram(blurDirection, blurSize) {
	const originalSelect = selectProgram(context, program);
	return function selectBlurProgram(context, program) {
		originalSelect();
		setBlurUniforms(context, blurDirection, blurSize);
	};
}

function setFrameBuffer(context) {
	const contextValue = get(context);
	const { gl } = contextValue;
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function setupShadowCamera(projection, view) {
	return function setupShadowCamera(context) {
		return function setupShadowCamera() {
			const contextValue = get(context);
			const { gl, program } = contextValue;

			const projectionLocation = gl.getUniformLocation(program, "projection");
			gl.uniformMatrix4fv(projectionLocation, false, projection);

			const viewLocation = gl.getUniformLocation(program, "view");
			gl.uniformMatrix4fv(viewLocation, false, view);
		};
	};
}

function createShaders() {
	return function createShaders(context) {
		const contextValue = get(context);
		const gl = contextValue.gl;
		const program = contextValue.program;

		const vertexShader = createShader(gl.VERTEX_SHADER);
		gl.shaderSource(vertexShader, depthVertexShader);
		gl.compileShader(vertexShader);
		if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
			console.error(gl.getShaderInfoLog(vertexShader));
		}
		gl.attachShader(program, vertexShader);

		const fragmentShader = createShader(gl.FRAGMENT_SHADER);
		gl.shaderSource(fragmentShader, depthFragmentShader);
		gl.compileShader(fragmentShader);
		if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
			console.error(gl.getShaderInfoLog(fragmentShader));
		}
		gl.attachShader(program, fragmentShader);
	};
}

function createShadowProgram(textureWidth, textureHeight) {
	return function createShadowProgram(context, programStore) {
		const contextValue = get(context);
		const { gl } = contextValue;

		// Create shader program
		const program = gl.createProgram();
		contextValue.programMap.set(programStore, program);
		context.update((context) => {
			return {
				...contextValue,
			};
		});
	};
}

function createFBO(context, setTexture) {
	return function createFBO(width, height) {
		const contextValue = get(context);
		const { gl } = contextValue;
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
}

function createHorizontalBlurProgram() {
	return createBlurProgram(BLUR_DIRECTION_HORIZONTAL, 128);
}

function createHorizontalBlurShaders() {}

function createVerticalBlurProgram() {
	return createBlurProgram(BLUR_DIRECTION_VERTICAL, 128);
}
