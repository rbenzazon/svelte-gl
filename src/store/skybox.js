import { appContext, selectProgram } from "./engine";
import skyBoxVertex from "../shaders/skybox-vertex.glsl";
import skyBoxFragment from "../shaders/skybox-fragment.glsl";
import { createProgram, getCameraProjectionView, linkProgram, useProgram, validateProgram } from "./gl";
import { drawModes } from "./webgl";
import { multiply, invert } from "gl-matrix/esm/mat4.js";
import { createVec3, createZeroMatrix } from "../geometries/common";
import { cross, normalize, subtract } from "gl-matrix/esm/vec3.js";
import { renderer } from "./renderer";

export function createSkyBox(props) {
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
		setupProgram: [createShaders, linkProgram, validateProgram],
		setupMaterial: [setupSkyBoxTexture(props.url, setBuffer)],
		bindTextures: [bindSkyBoxTexture(getBuffer)],
		setupCamera: setupSkyBoxCamera,
		useProgram,
		selectProgram,
		updateProgram: [setDepthFunc(setOriginalDepthFunc)],
		meshes: [createSkyBoxMesh()],
		postDraw: restoreDepthFunc(getOriginalDepthFunc),
	};
	return {
		name: "skybox",
		url: props.url,
		order: 1,
		programs: [skyboxProgram],
	};
}

function createShaders() {
	const { gl, program } = appContext;
	const vertexShader = gl.createShader(gl.VERTEX_SHADER);
	gl.shaderSource(vertexShader, skyBoxVertex);
	gl.compileShader(vertexShader);
	if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
		console.error(gl.getShaderInfoLog(vertexShader));
	}
	gl.attachShader(program, vertexShader);

	const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
	gl.shaderSource(fragmentShader, skyBoxFragment);
	gl.compileShader(fragmentShader);
	if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
		console.error(gl.getShaderInfoLog(fragmentShader));
	}
	gl.attachShader(program, fragmentShader);
}

export function createSkyBoxMesh() {
	return {
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

function setupSkyBoxTexture(url, setBuffer) {
	return function setupSkyBoxTexture() {
		const { gl } = appContext;
		const texture = gl.createTexture();
		setBuffer(texture);
		gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
		// create a CUBE MAP texture from a single file where the faces arranged in a cross pattern
		const image = new Image();
		image.src = url;
		image.onload = function () {
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
