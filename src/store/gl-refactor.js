import {
	create,
	invert,
	transpose,
	identity,
	lookAt,
	perspective,
	getTranslation,
	getRotation,
} from "gl-matrix/esm/mat4.js";
import { get } from "svelte/store";
import defaultVertex from "../shaders/default-vertex.glsl";
import defaultFragment from "../shaders/default-fragment.glsl";
import { objectToDefines, templateLiteralRenderer } from "../shaders/template.js";
import { SRGBToLinear } from "../color/color-space.js";
import { appContext, setAppContext } from "./engine-refactor.js";

// Uniform Buffer Objects, must have unique binding points
export const UBO_BINDING_POINT_POINTLIGHT = 0;
export const UBO_BINDING_POINT_SPOTLIGHT = 1;

const degree = Math.PI / 180;
/**
 * Convert Degree To Radian
 *
 * @param {Number} a Angle in Degrees
 */

function toRadian(a) {
	return a * degree;
}

export function initRenderer() {
	console.log("initRenderer", appContext);
	const canvasRect = appContext.canvas.getBoundingClientRect();
	appContext.canvas.width = canvasRect.width;
	appContext.canvas.height = canvasRect.height;
	/** @type {WebGL2RenderingContext} */
	const gl = appContext.canvas.getContext("webgl2");
	appContext.gl = gl;

	gl.viewportWidth = canvasRect.width;
	gl.viewportHeight = canvasRect.height;
	gl.clearColor(...appContext.backgroundColor);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_COLOR_BIT);
	gl.enable(gl.DEPTH_TEST);
	gl.enable(gl.CULL_FACE);
	gl.frontFace(gl.CCW);
	gl.cullFace(gl.BACK);
}

export function setupTime() {
	const { gl, program } = appContext;
	const timeLocation = gl.getUniformLocation(program, "time");
	gl.uniform1f(timeLocation, performance.now());
}

export function clearFrame() {
	const { gl } = appContext;
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}

export function render(mesh, instances, drawMode) {
	return function render() {
		/** @type {WebGL2RenderingContext} **/
		const { gl } = appContext;

		const attributeLength = mesh.attributes.elements
			? mesh.attributes.elements.length
			: mesh.attributes.positions.length / 3;
		console.log("rendering", mesh);

		if (instances) {
			gl.drawArraysInstanced(gl[drawMode], 0, attributeLength, instances);
		} else {
			if (mesh.attributes.elements) {
				gl.drawElements(gl[drawMode], attributeLength, gl.UNSIGNED_SHORT, 0);
			} else {
				gl.drawArrays(gl[drawMode], 0, attributeLength);
				//add mesh visualization (lines)
				//gl.drawArrays(gl.LINE_STRIP, 0, contextValue.attributeLength);
			}
		}
		// when binding vertex array objects you must unbind it after rendering
		gl.bindVertexArray(null);
	};
}

export function bindVAO(mesh) {
	return function bindVAO() {
		const { gl, vaoMap } = appContext;
		gl.bindVertexArray(vaoMap.get(mesh));
	};
}

export function createProgram(programStore) {
	return function createProgram() {
		/** @type {{gl:WebGL2RenderingContext}} **/
		const { gl } = appContext;
		const program = gl.createProgram();
		appContext.programMap.set(programStore, program);
		appContext.program = program;
	};
}

export function linkProgram() {
	/** @type {{gl:WebGL2RenderingContext}} **/
	const { gl, program } = appContext;
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		console.error("ERROR linking program!", gl.getProgramInfoLog(program));
	}
}

export function validateProgram() {
	/** @type {{gl:WebGL2RenderingContext,program: WebGLProgram}} **/
	const { gl, program } = appContext;
	gl.validateProgram(program);
	if (!gl.getProgramParameter(program, gl.VALIDATE_STATUS)) {
		console.error("ERROR validating program!", gl.getProgramInfoLog(program));
	}
}

export function useProgram() {
	/** @type {{gl:WebGL2RenderingContext,program: WebGLProgram}} **/
	const { gl, program } = appContext;
	gl.useProgram(program);
}

export function bindDefaultFramebuffer() {
	/** @type {{gl:WebGL2RenderingContext}} **/
	const { gl } = appContext;
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}

export function createShaders(material, meshes, numPointLights, pointLightShader) {
	return function createShaders() {
		/** @type {{gl:WebGL2RenderingContext,program: WebGLProgram}} **/
		const { gl, program } = appContext;

		let vertexDeclarations = "";
		let vertexPositionModifiers = "";

		let vertexAnimationsDeclaration = "";
		let vertexAnimationsModifier = "";
		const [mesh] = meshes;
		const vertexAnimationComponents = mesh.animations?.filter(({ type }) => type === "vertex");
		if (vertexAnimationComponents?.length > 0) {
			vertexAnimationsDeclaration += vertexAnimationComponents.reduce((acc, component) => {
				return acc + component.shader({ declaration: true });
			}, "");
			vertexAnimationsModifier += vertexAnimationComponents.reduce((acc, component) => {
				return acc + component.shader({ position: true });
			}, "");
			vertexDeclarations += vertexAnimationsDeclaration;
			vertexPositionModifiers += vertexAnimationsModifier;
		}
		const vertexShaderSource = templateLiteralRenderer(defaultVertex, {
			instances: false,
			declarations: "",
			positionModifier: "",
		})({
			instances: mesh.instances > 1,
			declarations: vertexDeclarations,
			positionModifier: vertexPositionModifiers,
		});
		//(vertexShaderSource);
		const vertexShader = gl.createShader(gl.VERTEX_SHADER);
		gl.shaderSource(vertexShader, vertexShaderSource);
		gl.compileShader(vertexShader);
		if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
			console.error("ERROR compiling vertex shader!", gl.getShaderInfoLog(vertexShader));
		}
		let specularIrradiance = "";
		let specularDeclaration = "";
		if (material.specular) {
			specularDeclaration = material.specular.shader({ declaration: true });
			specularIrradiance = material.specular.shader({ irradiance: true });
		}
		let diffuseMapDeclaration = "";
		let diffuseMapSample = "";
		if (material.diffuseMap) {
			diffuseMapDeclaration = material.diffuseMap.shader({
				declaration: true,
				mapType: material.diffuseMap.type,
			});
			diffuseMapSample = material.diffuseMap.shader({
				diffuseMapSample: true,
				mapType: material.diffuseMap.type,
				coordinateSpace: material.diffuseMap.coordinateSpace,
			});
		}
		let normalMapDeclaration = "";
		let normalMapSample = "";
		if (material.normalMap) {
			normalMapDeclaration = material.normalMap.shader({
				declaration: true,
				mapType: material.normalMap.type,
			});
			normalMapSample = material.normalMap.shader({
				normalMapSample: true,
				mapType: material.normalMap.type,
			});
		}
		const fragmentShaderSource = templateLiteralRenderer(defaultFragment, {
			defines: "",
			declarations: "",
			diffuseMapSample: "",
			normalMapSample: "",
			irradiance: "",
			toneMapping: "",
			numPointLights: 0,
		})({
			defines: objectToDefines({
				...(numPointLights
					? {
							NUM_POINT_LIGHTS: numPointLights,
						}
					: undefined),
			}),
			declarations: [
				...(numPointLights ? [pointLightShader({ declaration: true, irradiance: false })] : []),
				...(appContext.toneMappings?.length > 0
					? [...appContext.toneMappings.map((tm) => tm.shader({ declaration: true, exposure: tm.exposure }))]
					: []),
				...(material.specular ? [specularDeclaration] : []),
				...(material.diffuseMap ? [diffuseMapDeclaration] : []),
				...(material.normalMap ? [normalMapDeclaration] : []),
			].join("\n"),
			diffuseMapSample,
			normalMapSample,
			irradiance: [
				...(numPointLights ? [pointLightShader({ declaration: false, irradiance: true, specularIrradiance })] : []),
			].join("\n"),
			toneMapping: [
				...(appContext.toneMappings?.length > 0
					? [...appContext.toneMappings.map((tm) => tm.shader({ color: true }))]
					: []),
			].join("\n"),
			//todo, remove this after decoupling the point light shader
			numPointLights,
		});
		const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
		gl.shaderSource(fragmentShader, fragmentShaderSource);
		//(fragmentShaderSource);
		gl.compileShader(fragmentShader);
		if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
			console.error("ERROR compiling fragment shader!", gl.getShaderInfoLog(fragmentShader));
		}
		gl.attachShader(program, vertexShader);
		gl.attachShader(program, fragmentShader);
	};
}

export function setupMeshColor({ diffuse, metalness }) {
	return function setupMeshColor() {
		/** @type {{gl:WebGL2RenderingContext,program: WebGLProgram}} **/
		const { gl, program } = appContext;
		const colorLocation = gl.getUniformLocation(program, "diffuse");
		if (colorLocation == null) {
			return;
		}
		gl.uniform3fv(colorLocation, new Float32Array(diffuse.map(SRGBToLinear)));
		const metalnessLocation = gl.getUniformLocation(program, "metalness");
		gl.uniform1f(metalnessLocation, metalness);
	};
}

export function setupAmbientLight() {
	/** @type {{gl:WebGL2RenderingContext,program: WebGLProgram}} **/
	const { gl, program, ambientLightColor } = appContext;
	const ambientLightColorLocation = gl.getUniformLocation(program, "ambientLightColor");
	gl.uniform3fv(ambientLightColorLocation, new Float32Array(ambientLightColor));
}

export function setupCamera(camera) {
	return function createCamera() {
		/** @type {{gl:WebGL2RenderingContext,program: WebGLProgram}} **/
		const { gl, program, canvas } = appContext;
		// projection matrix
		const projectionLocation = gl.getUniformLocation(program, "projection");

		const fieldOfViewInRadians = toRadian(camera.fov);
		const aspectRatio = canvas.width / canvas.height;
		const nearClippingPlaneDistance = camera.near;
		const farClippingPlaneDistance = camera.far;
		let projection = new Float32Array(16);
		projection = perspective(
			projection,
			fieldOfViewInRadians,
			aspectRatio,
			nearClippingPlaneDistance,
			farClippingPlaneDistance,
		);

		gl.uniformMatrix4fv(projectionLocation, false, projection);

		// view matrix
		const viewLocation = gl.getUniformLocation(program, "view");
		const view = new Float32Array(16);
		lookAt(view, camera.position, camera.target, camera.up);
		gl.uniformMatrix4fv(viewLocation, false, view);

		const cameraPositionLocation = gl.getUniformLocation(program, "cameraPosition");
		gl.uniform3fv(cameraPositionLocation, camera.position);
	};
}

function getEuler(out, quat) {
	let x = quat[0],
		y = quat[1],
		z = quat[2],
		w = quat[3],
		x2 = x * x,
		y2 = y * y,
		z2 = z * z,
		w2 = w * w;
	let unit = x2 + y2 + z2 + w2;
	let test = x * w - y * z;
	if (test > 0.499995 * unit) {
		//TODO: Use glmatrix.EPSILON
		// singularity at the north pole
		out[0] = ((Math.PI / 2) * 180) / Math.PI;
		out[1] = (2 * Math.atan2(y, x) * 180) / Math.PI;
		out[2] = (0 * 180) / Math.PI;
	} else if (test < -0.499995 * unit) {
		//TODO: Use glmatrix.EPSILON
		// singularity at the south pole
		out[0] = ((-Math.PI / 2) * 180) / Math.PI;
		out[1] = (2 * Math.atan2(y, x) * 180) / Math.PI;
		out[2] = (0 * 180) / Math.PI;
	} else {
		out[0] = (Math.asin(2 * (x * z - w * y)) * 180) / Math.PI;
		out[1] = (Math.atan2(2 * (x * w + y * z), 1 - 2 * (z2 + w2)) * 180) / Math.PI;
		out[2] = (Math.atan2(2 * (x * y + z * w), 1 - 2 * (y2 + z2)) * 180) / Math.PI;
	}
	return out;
}

export function setupTransformMatrix(mesh, transformMatrix, numInstances) {
	if (numInstances == null) {
		return function setupTransformMatrix() {
			/** @type {{gl:WebGL2RenderingContext,program: WebGLProgram}} **/
			const { gl, program } = appContext;
			const worldLocation = gl.getUniformLocation(program, "world");
			if (worldLocation == null) {
				return;
			}
			if (!transformMatrix) {
				transformMatrix = new Float32Array(16);
				identity(transformMatrix);
			}
			// TODO store this in a map
			appContext.transformMatrix = transformMatrix;
			gl.uniformMatrix4fv(worldLocation, false, transformMatrix);
		};
	} else {
		return function setupTransformMatrix() {
			if (transformMatrix == null) {
				return;
			}

			const attributeName = "world";
			/** @type {{gl:WebGL2RenderingContext,program: WebGLProgram}} **/
			const { gl, program, vaoMap } = appContext;

			//TODO, clean that it's useless since we overwrite it anyway and storing this way is not good
			let transformMatricesWindows;
			if ((appContext.transformMatricesWindows = null)) {
				transformMatricesWindows = [];
			} else {
				transformMatricesWindows = appContext.transformMatricesWindows;
			}

			const transformMatricesValues = transformMatrix.reduce((acc, m) => [...acc, ...get(m)], []);
			const transformMatricesData = new Float32Array(transformMatricesValues);

			// create windows for each matrix
			for (let i = 0; i < numInstances; ++i) {
				const byteOffsetToMatrix = i * 16 * 4;
				const numFloatsForView = 16;
				transformMatricesWindows.push(new Float32Array(transformMatricesData.buffer, byteOffsetToMatrix, numFloatsForView));
			}
			/*
			transformMatricesWindows.forEach((mat, index) => {
				const count = index - Math.floor(numInstances / 2);
				identity(mat);
				//transform the model matrix
				translate(mat, mat, [count * 2, 0, 0]);
				rotateY(mat, mat, toRadian(count * 10));
				scale(mat, mat, [0.5, 0.5, 0.5]);
			});
*/
			gl.bindVertexArray(vaoMap.get(mesh));
			const matrixBuffer = gl.createBuffer();

			setAppContext({
				matrixBuffer,
				transformMatricesWindows,
			});

			const transformMatricesLocation = gl.getAttribLocation(program, attributeName);
			gl.bindBuffer(gl.ARRAY_BUFFER, matrixBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, transformMatricesData.byteLength, gl.DYNAMIC_DRAW);
			// set all 4 attributes for matrix
			const bytesPerMatrix = 4 * 16;
			for (let i = 0; i < 4; ++i) {
				const loc = transformMatricesLocation + i;
				gl.enableVertexAttribArray(loc);
				// note the stride and offset
				const offset = i * 16; // 4 floats per row, 4 bytes per float
				gl.vertexAttribPointer(
					loc, // location
					4, // size (num values to pull from buffer per iteration)
					gl.FLOAT, // type of data in buffer
					false, // normalize
					bytesPerMatrix, // stride, num bytes to advance to get to next set of values
					offset, // offset in buffer
				);
				// this line says this attribute only changes for each 1 instance
				gl.vertexAttribDivisor(loc, 1);
			}
			gl.bufferSubData(gl.ARRAY_BUFFER, 0, transformMatricesData);

			gl.bindVertexArray(null);
		};
	}
}
export function updateTransformMatrix(worldMatrix) {
	/** @type {{gl:WebGL2RenderingContext,program: WebGLProgram}} **/
	const { gl, program } = appContext;
	const worldLocation = gl.getUniformLocation(program, "world");
	gl.uniformMatrix4fv(worldLocation, false, worldMatrix);
}

export function updateInstanceTransformMatrix(mesh, worldMatrix, instanceIndex) {
	/** @type {{gl:WebGL2RenderingContext,program: WebGLProgram}} **/
	const { gl, vaoMap, matrixBuffer } = appContext;
	gl.bindVertexArray(vaoMap.get(mesh));
	gl.bindBuffer(gl.ARRAY_BUFFER, matrixBuffer);
	const bytesPerMatrix = 4 * 16;
	gl.bufferSubData(gl.ARRAY_BUFFER, instanceIndex * bytesPerMatrix, worldMatrix);
	gl.bindVertexArray(null);
}

export function setupNormalMatrix(mesh, numInstances) {
	if (numInstances == null) {
		return function setupNormalMatrix() {
			/** @type {{gl:WebGL2RenderingContext,program: WebGLProgram}} **/
			const { gl, program, transformMatrix } = appContext;
			const normalMatrixLocation = gl.getUniformLocation(program, "normalMatrix");
			if (normalMatrixLocation == null) {
				return;
			}
			gl.uniformMatrix4fv(normalMatrixLocation, false, derivateNormalMatrix(transformMatrix));
		};
	} else {
		return function setupNormalMatrix() {
			/** @type {{gl:WebGL2RenderingContext,program: WebGLProgram}} **/
			const { gl, program, vaoMap, transformMatricesWindows } = appContext;
			const normalMatricesLocation = gl.getAttribLocation(program, "normalMatrix");
			if (normalMatricesLocation == null) {
				return;
			}

			gl.bindVertexArray(vaoMap.get(mesh));
			const normalMatricesValues = [];

			for (let i = 0; i < numInstances; i++) {
				normalMatricesValues.push(...derivateNormalMatrix(transformMatricesWindows[i]));
			}
			const normalMatrices = new Float32Array(normalMatricesValues);

			const normalMatrixBuffer = gl.createBuffer();
			//TODO store this in a map ?
			appContext.normalMatrixBuffer = normalMatrixBuffer;
			gl.bindBuffer(gl.ARRAY_BUFFER, normalMatrixBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, normalMatrices.byteLength, gl.DYNAMIC_DRAW);

			gl.bufferSubData(gl.ARRAY_BUFFER, 0, normalMatrices);
			// set all 4 attributes for matrix
			const bytesPerMatrix = 4 * 16;
			for (let i = 0; i < 4; ++i) {
				const loc = normalMatricesLocation + i;
				gl.enableVertexAttribArray(loc);
				// note the stride and offset
				const offset = i * 16; // 4 floats per row, 4 bytes per float
				gl.vertexAttribPointer(
					loc, // location
					4, // size (num values to pull from buffer per iteration)
					gl.FLOAT, // type of data in buffer
					false, // normalize
					bytesPerMatrix, // stride, num bytes to advance to get to next set of values
					offset, // offset in buffer
				);
				// this line says this attribute only changes for each 1 instance
				gl.vertexAttribDivisor(loc, 1);
			}
			gl.bindVertexArray(null);
		};
	}
}

export function updateNormalMatrix({ gl, program }, normalMatrix) {
	const normalMatrixLocation = gl.getUniformLocation(program, "normalMatrix");
	gl.uniformMatrix4fv(normalMatrixLocation, false, normalMatrix);
}

export function updateInstanceNormalMatrix(
	{ gl, program, vaoMap, normalMatrixBuffer },
	mesh,
	normalMatrix,
	instanceIndex,
) {
	gl.bindVertexArray(vaoMap.get(mesh));
	gl.bindBuffer(gl.ARRAY_BUFFER, normalMatrixBuffer);
	const bytesPerMatrix = 4 * 16;
	gl.bufferSubData(gl.ARRAY_BUFFER, instanceIndex * bytesPerMatrix, normalMatrix);
	gl.bindVertexArray(null);
}

export function derivateNormalMatrix(transformMatrix) {
	const normalMatrix = create();
	invert(normalMatrix, transformMatrix);
	transpose(normalMatrix, normalMatrix);
	return normalMatrix;
}

function getBuffer(variable) {
	let dataSource;
	let interleaved;
	if (variable.data) {
		dataSource = variable.data;
		interleaved = variable.interleaved;
	} else {
		dataSource = variable;
	}
	const data = dataSource.buffer && dataSource.buffer instanceof ArrayBuffer ? dataSource : new Float32Array(dataSource);
	return {
		data,
		interleaved,
		...(interleaved ? { byteStride: variable.byteStride, byteOffset: variable.byteOffset } : {}),
	};
}

export function setupAttributes(mesh) {
	return function setupAttributes() {
		/** @type {{gl:WebGL2RenderingContext,program: WebGLProgram}} **/
		const { gl, program, vaoMap } = appContext;
		const { positions, normals, elements, uvs } = mesh.attributes;
		let vao;
		if (vaoMap.has(mesh)) {
			vao = vaoMap.get(mesh);
		} else {
			vao = gl.createVertexArray();
			vaoMap.set(mesh, vao);
		}
		gl.bindVertexArray(vao);
		const {
			data: positionsData,
			interleaved: positionsInterleaved,
			byteStride: positionsByteStride,
			byteOffset: positionsByteOffset,
		} = getBuffer(positions);
		//position
		const positionBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, positionsData, gl.STATIC_DRAW);
		const positionLocation = gl.getAttribLocation(program, "position");
		gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer); //todo check if redundant
		gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, positionsByteStride, positionsByteOffset);
		gl.enableVertexAttribArray(positionLocation);
		//normal
		if (mesh.attributes.normals) {
			const {
				data: normalsData,
				interleaved: normalsInterleaved,
				byteStride: normalsByteStride,
				byteOffset: normalsByteOffset,
			} = getBuffer(normals);
			if (!normalsInterleaved) {
				const normalBuffer = gl.createBuffer();
				gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
				gl.bufferData(gl.ARRAY_BUFFER, normalsData, gl.STATIC_DRAW);
				gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer); //todo check if redundant
			}
			const normalLocation = gl.getAttribLocation(program, "normal");
			gl.vertexAttribPointer(normalLocation, 3, gl.FLOAT, false, normalsByteStride, normalsByteOffset);
			gl.enableVertexAttribArray(normalLocation);
		}
		if (mesh.attributes.elements) {
			const elementsData = new Uint16Array(mesh.attributes.elements);
			const elementBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elementBuffer);
			gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, elementsData, gl.STATIC_DRAW);
		}
		if (mesh.attributes.uvs) {
			const uvsData = new Float32Array(mesh.attributes.uvs);
			const uvBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, uvsData, gl.STATIC_DRAW);
			const uvLocation = gl.getAttribLocation(program, "uv");
			gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
			gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 0, 0);
			gl.enableVertexAttribArray(uvLocation);
		}

		gl.bindVertexArray(null);
	};
}
