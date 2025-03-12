import { az as createProgram, aA as resetViewportToCanvas, r as renderer, aa as templateLiteralRenderer, T as compileShaders, Y as linkProgram, Z as validateProgram, $ as useProgram, a0 as selectProgram, R as appContext, L as drawModes, aB as getCameraProjectionView, aC as invert, z as createZeroMatrix, a2 as multiply, K as normalize, J as subtract, V as createVec3, I as cross } from './Menu-l0HugrEy.js';

var skyBoxVertex = "#version 300 es\r\n\r\n#define SHADER_NAME skyboxVertex\r\n\r\nin vec4 position;\r\nout vec4 v_position;\r\nvoid main() {\r\n    v_position = position;\r\n    gl_Position = position;\r\n    gl_Position.z = 1.0;\r\n}";

var skyBoxFragment = "#version 300 es\r\nprecision highp float;\r\n\r\n#define SHADER_NAME skyboxFragment\r\n\r\nuniform samplerCube skybox;\r\nuniform mat4 viewDirectionProjectionInverse;\r\n\r\n${declarations}\r\n  \r\nin vec4 v_position;\r\n  \r\n// we need to declare an output for the fragment shader\r\nout vec4 fragColor;\r\n  \r\nvoid main() {\r\n  vec4 t = viewDirectionProjectionInverse * v_position;\r\n  fragColor = texture(skybox, normalize(t.xyz / t.w));\r\n  ${toneMappings}\r\n}";

/**
 * @callback ConvertHDRToCube
 * @param {Uint16Array} typedArray
 * @param {WebGL2RenderingContext} gl
 * @param {number} width
 * @param {number} height
 * @param {number} cubeSize
 * @returns {WebGLTexture}
 */
/**
 * @callback LoadCubeMap
 * @param {string} url
 * @param {setBuffer} setBuffer
 */

/**
 * @typedef {Object} SvelteGLCubeMapSkyboxProps
 * @property {string} url
 * @property {LoadCubeMap} convertToCube
 */
/**
 * @typedef {Object} SvelteGLHDRSkyboxProps
 * @property {Uint16Array} typedArray
 * @property {ConvertHDRToCube} convertToCube
 * @property {number} width
 * @property {number} height
 * @property {number} cubeSize
 * @property {SvelteGLToneMapping} toneMapping
 */
/**
 * @typedef {SvelteGLCubeMapSkyboxProps | SvelteGLHDRSkyboxProps} SvelteGLSkyboxProps
 */
/**
 * @param {SvelteGLSkyboxProps} props
 * @returns {props is SvelteGLCubeMapSkyboxProps}
 */
function isCubeMapSkyboxProps(props) {
	return "url" in props && typeof props.url === "string";
}
/**
 * @param {SvelteGLSkyboxProps} props
 * @returns {props is SvelteGLHDRSkyboxProps}
 */
function isHDRSkyboxProps(props) {
	return "typedArray" in props && props.typedArray instanceof Uint16Array;
}

/**
 *
 * @param {SvelteGLSkyboxProps} props
 * @returns {Promise<{
 * 	url?: string,
 *	order: number,
 * 	programs:import("./programs").SvelteGLProgram[],
 *  getTexture: () => WebGLTexture,
 * }>}
 */
async function createSkyBox(props) {
	let buffer;
	function setBuffer(value) {
		buffer = value;
	}
	function getBuffer() {
		return buffer;
	}
	let originalDepthFunc;
	function setOriginalDepthFunc(value) {
		originalDepthFunc = value;
	}
	function getOriginalDepthFunc() {
		return originalDepthFunc;
	}

	const skyboxProgram = {
		createProgram,
		setupProgram: [linkProgram, validateProgram],
		setupMaterial: [],
		bindTextures: [bindSkyBoxTexture(getBuffer)],
		setupCamera: setupSkyBoxCamera,
		useProgram,
		selectProgram,
		updateProgram: [setDepthFunc(setOriginalDepthFunc)],
		meshes: [createSkyBoxMesh()],
		postDraw: restoreDepthFunc(getOriginalDepthFunc),
	};
	let returnProps, typedArray, toneMapping;
	if (isCubeMapSkyboxProps(props)) {
		skyboxProgram.setupMaterial = [await props.convertToCube(props.url, setBuffer)];
		skyboxProgram.setupProgram = [createShaders(), ...skyboxProgram.setupProgram];
		returnProps = {
			url: props.url,
		};
	} else if (isHDRSkyboxProps(props)) {
		typedArray = props.typedArray;
		skyboxProgram.createProgram = createSkyBoxProgram(
			setupHDRTexture(typedArray, setBuffer, props.convertToCube, props.width, props.height, props.cubeSize),
		);
		toneMapping = props.toneMapping;
		skyboxProgram.setupProgram = [createShaders(toneMapping), ...skyboxProgram.setupProgram];
		skyboxProgram.setupMaterial = [bindSkyBoxTexture(getBuffer)];
		returnProps = {};
	}

	return {
		...returnProps,
		order: 1,
		programs: [skyboxProgram],
		getTexture: getBuffer,
	};
}

/**
 * this texture setup is placed here so that :
 * -the webgl programs it runs are not interrupting the skybox program
 * -this setup needs to run once at the start, like createProgram is
 * @param {()=>void} setupHDRTexture
 * @returns
 */
function createSkyBoxProgram(setupHDRTexture) {
	return function createSkyBoxProgram(programStore) {
		return function createSkyBoxProgram() {
			if (setupHDRTexture != null) {
				setupHDRTexture();
			}
			createProgram(programStore)();
		};
	};
}

/**
 * @param typedArray:Uint16Array,
 * @param {(value:WebGLTexture)=>void} setBuffer
 * @param {ConvertToCube} convertToCube
 * @param gl:WebGL2RenderingContext,
 * @param width:number,
 * @param height:number,
 * @param cubeSize:number
 * @returns {()=>void}
 */
function setupHDRTexture(typedArray, setBuffer, convertToCube, width, height, cubeSize) {
	return function setupHDRTexture() {
		const { gl } = appContext;
		const cubemapTexture = convertToCube(typedArray, gl, width, height, cubeSize);
		setBuffer(cubemapTexture);
		resetViewportToCanvas();
		renderer.update((renderer) => renderer);
	};
}

/**
 *
 * @param {SvelteGLToneMapping} [toneMapping]
 * @returns {()=>void}
 */
function createShaders(toneMapping) {
	return function createShaders() {
		const { gl, program } = appContext;
		let declarations = "";
		let toneMappings = "";
		if (toneMapping != null) {
			declarations = toneMapping.shader({ declaration: true, exposure: toneMapping.exposure });
			toneMappings = toneMapping.shader({ color: true });
		}
		const fragmentSource = templateLiteralRenderer(skyBoxFragment, {
			declarations: "",
			toneMappings: "",
		})({
			declarations,
			toneMappings,
		});
		compileShaders(gl, program, skyBoxVertex, fragmentSource);
	};
}
/**
 *
 * @returns {SvelteGLMesh}
 */
function createSkyBoxMesh() {
	return /** @type {SvelteGLMesh} */ {
		attributes: {
			positionsSize: 2,
			positions: new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
		},
		drawMode: drawModes[4],
	};
}

function setupSkyBoxCamera(camera) {
	return function setupSkyBoxCamera() {
		const { gl, program, canvas } = appContext;

		const { projection } = getCameraProjectionView(camera, canvas.width, canvas.height);

		const viewCamera = lookAt(camera.position, camera.target, camera.up, createZeroMatrix());
		const viewMatrix = invert(createZeroMatrix(), viewCamera);

		//set translation to 0
		viewMatrix[12] = 0;
		viewMatrix[13] = 0;
		viewMatrix[14] = 0;

		const viewDirectionProjectionMatrix = multiply(createZeroMatrix(), projection, viewMatrix);
		const viewDirectionProjectionInverseMatrix = invert(createZeroMatrix(), viewDirectionProjectionMatrix);
		const viewDirectionProjectionInverseLocation = gl.getUniformLocation(program, "viewDirectionProjectionInverse");
		gl.uniformMatrix4fv(viewDirectionProjectionInverseLocation, false, viewDirectionProjectionInverseMatrix);
	};
}

async function setupSkyBoxTexture(url, setBuffer) {
	const image = new Image();
	await new Promise((resolve, reject) => {
		image.src = url;
		image.onload = function () {
			resolve(image);
		};
		image.onerror = reject;
	});

	return function setupSkyBoxTexture() {
		const { gl } = appContext;
		const texture = gl.createTexture();
		setBuffer(texture);
		gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
		// create a CUBE MAP texture from a single file where the faces arranged in a cross pattern
		const image = new Image();
		image.src = url;
		gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
		sliceImageAndUpload(image, gl);
		gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
		gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
		gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
		renderer.update((renderer) => renderer);
	};
}

function sliceImageAndUpload(image, gl) {
	const canvas = document.createElement("canvas");
	const ctx = canvas.getContext("2d");

	const faceWidth = image.width / 4; // Cross is 4 tiles wide at its widest
	const faceHeight = image.height / 3; // Cross is 3 tiles high

	canvas.width = faceWidth;
	canvas.height = faceHeight;
	// Assuming a layout like:
	//    +Y
	// -X +Z +X -Z
	//    -Y
	const facePositions = [
		[2, 1, gl.TEXTURE_CUBE_MAP_POSITIVE_X],
		[0, 1, gl.TEXTURE_CUBE_MAP_NEGATIVE_X],
		[1, 0, gl.TEXTURE_CUBE_MAP_POSITIVE_Y],
		[1, 2, gl.TEXTURE_CUBE_MAP_NEGATIVE_Y],
		[1, 1, gl.TEXTURE_CUBE_MAP_POSITIVE_Z],
		[3, 1, gl.TEXTURE_CUBE_MAP_NEGATIVE_Z],
	];
	facePositions.forEach(([x, y, target]) => {
		// Clear the canvas and draw the specific region from the source image
		ctx.clearRect(0, 0, faceWidth, faceHeight);
		ctx.drawImage(image, x * faceWidth, y * faceHeight, faceWidth, faceHeight, 0, 0, faceWidth, faceHeight);

		// Upload the face to the appropriate cubemap target
		gl.texImage2D(
			target, // target: which face of the cubemap
			0, // level: mipmap level
			gl.RGBA, // internalFormat: how GPU stores the data
			gl.RGBA, // format: format of the pixel data
			gl.UNSIGNED_BYTE, // type: data type of the pixel data
			canvas, // pixels: source of the pixel data
		);
	});
}

function bindSkyBoxTexture(getBuffer) {
	return function bindSkyBoxTexture() {
		const { gl, program } = appContext;
		const textureLocation = gl.getUniformLocation(program, "skybox");
		gl.uniform1i(textureLocation, 0);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_CUBE_MAP, getBuffer());
	};
}

function setDepthFunc(setOriginalDepthFunc) {
	return function setDepthFunc() {
		const { gl } = appContext;
		setOriginalDepthFunc(gl.getParameter(gl.DEPTH_FUNC));
		gl.depthFunc(gl.LEQUAL);
	};
}

function restoreDepthFunc(getOriginalDepthFunc) {
	return function restoreDepthFunc() {
		const { gl } = appContext;
		gl.depthFunc(getOriginalDepthFunc());
	};
}

/**
 * this lookAt function is copied from webgl-3d-math library
 * it is modified to use gl-matrix functions to avoid redundancy
 * the gl-matrix lookAt is not working as intended here because
 * it create a tilt in the skybox when panning the camera
 *
 * Copyright 2021, GFXFundamentals.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *     * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *     * Neither the name of GFXFundamentals. nor the names of his
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * @param {*} cameraPosition
 * @param {*} target
 * @param {*} up
 * @param {*} dst
 * @returns
 */
function lookAt(cameraPosition, target, up, dst) {
	var zAxis = normalize(createVec3(), subtract(createVec3(), cameraPosition, target));
	var xAxis = normalize(createVec3(), cross(createVec3(), up, zAxis));
	var yAxis = normalize(createVec3(), cross(createVec3(), zAxis, xAxis));
	dst[0] = xAxis[0];
	dst[1] = xAxis[1];
	dst[2] = xAxis[2];
	dst[3] = 0;
	dst[4] = yAxis[0];
	dst[5] = yAxis[1];
	dst[6] = yAxis[2];
	dst[7] = 0;
	dst[8] = zAxis[0];
	dst[9] = zAxis[1];
	dst[10] = zAxis[2];
	dst[11] = 0;
	dst[12] = cameraPosition[0];
	dst[13] = cameraPosition[1];
	dst[14] = cameraPosition[2];
	dst[15] = 1;

	return dst;
}

export { createSkyBox as c, setupSkyBoxTexture as s };
