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
import { renderState } from "./engine.js";
import defaultVertex from "../shaders/default-vertex.glsl";
import defaultFragment from "../shaders/default-fragment.glsl";
import { objectToDefines, templateLiteralRenderer } from "../shaders/template.js";
import { SRGBToLinear } from "../color/color-space.js";

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

export function initRenderer(rendererContext, appContext) {
	return function () {
		console.log("initRenderer");

		const canvasRect = rendererContext.canvas.getBoundingClientRect();
		rendererContext.canvas.width = canvasRect.width;
		rendererContext.canvas.height = canvasRect.height;
		const gl = (rendererContext.gl = rendererContext.canvas.getContext("webgl2"));
		appContext.update((appContext) => ({
			...appContext,
			...rendererContext,
		}));
		gl.viewportWidth = rendererContext.canvas.width;
		gl.viewportHeight = rendererContext.canvas.height;
		gl.clearColor(...rendererContext.backgroundColor);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_COLOR_BIT);
		gl.enable(gl.DEPTH_TEST);
		gl.enable(gl.CULL_FACE);
		gl.frontFace(gl.CCW);
		gl.cullFace(gl.BACK);
		renderState.set({
			init: true,
		});
	};
}

export function setupTime(context) {
	return function () {
		const contextValue = get(context);
		const gl = contextValue.gl;
		const program = contextValue.program;
		const timeLocation = gl.getUniformLocation(program, "time");
		gl.uniform1f(timeLocation, performance.now());
	};
}

export function render(context, instances, drawMode) {
	return function () {
		const contextValue = get(context);
		/** @type {WebGL2RenderingContext} **/
		const gl = contextValue.gl;
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		contextValue.loop && contextValue.loop();
		// when using vertex array objects, you must bind it before rendering
		gl.bindVertexArray(contextValue.vao);
		console.log("drawMode", drawMode);
		if (instances) {
			gl.drawArraysInstanced(gl[drawMode], 0, contextValue.attributeLength, instances);
		} else {
			if (contextValue.hasElements) {
				gl.drawElements(gl[drawMode], contextValue.attributeLength, gl.UNSIGNED_SHORT, 0);
			} else {
				gl.drawArrays(gl[drawMode], 0, contextValue.attributeLength);
				//add mesh visualization (lines)
				//gl.drawArrays(gl.LINE_STRIP, 0, contextValue.attributeLength);
			}
		}
		// when binding vertex array objects you must unbind it after rendering
		gl.bindVertexArray(null);
	};
}

export function createProgram(context) {
	return function createProgram() {
		context = get(context);
		if (context.program != null) {
			return;
		}
		const gl = context.gl;
		const program = gl.createProgram();
		context.program = program;
	};
}

export function linkProgram(context) {
	return function () {
		context = get(context);
		/** @type {WebGL2RenderingContext} **/
		const gl = context.gl;
		const program = context.program;
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			console.error("ERROR linking program!", gl.getProgramInfoLog(program));
		}
	};
}

export function validateProgram(context) {
	return function () {
		context = get(context);
		/** @type {WebGL2RenderingContext} **/
		const gl = context.gl;
		const program = context.program;

		gl.validateProgram(program);
		if (!gl.getProgramParameter(program, gl.VALIDATE_STATUS)) {
			console.error("ERROR validating program!", gl.getProgramInfoLog(program));
		}
	};
}

export function useProgram(context) {
	return function () {
		context = get(context);
		/** @type {WebGL2RenderingContext} **/
		const gl = context.gl;
		const program = context.program;
		gl.useProgram(program);
	};
}

export function endProgramSetup(context) {
	return function () {
		context = get(context);
		/** @type {WebGL2RenderingContext} **/
		const gl = context.gl;
		const program = context.program;
		if (context.program === context.programUsed) {
			return;
		}
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			console.error("ERROR linking program!", gl.getProgramInfoLog(program));
		}
		gl.validateProgram(program);
		if (!gl.getProgramParameter(program, gl.VALIDATE_STATUS)) {
			console.error("ERROR validating program!", gl.getProgramInfoLog(program));
		}
		gl.useProgram(program);
		context.programUsed = program;
	};
}

export function createShaders() {
	return function (context, mesh) {
		return function () {
			context = get(context);
			const gl = context.gl;
			const program = context.program;

			let vertexDeclarations = "";
			let vertexPositionModifiers = "";

			let vertexAnimationsDeclaration = "";
			let vertexAnimationsModifier = "";
			const vertexAnimationComponents = mesh.animations?.filter(({ type }) => type === "vertex");
			if (vertexAnimationComponents.length > 0) {
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
			//console.log(vertexShaderSource);
			const vertexShader = gl.createShader(gl.VERTEX_SHADER);
			gl.shaderSource(vertexShader, vertexShaderSource);
			gl.compileShader(vertexShader);
			if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
				console.error("ERROR compiling vertex shader!", gl.getShaderInfoLog(vertexShader));
			}
			let specularIrradiance = "";
			let specularDeclaration = "";
			if (mesh.material?.specular) {
				specularDeclaration = mesh.material.specular.shader({ declaration: true });
				specularIrradiance = mesh.material.specular.shader({ irradiance: true });
			}
			let diffuseMapDeclaration = "";
			let diffuseMapSample = "";
			if (mesh.material?.diffuseMap) {
				diffuseMapDeclaration = mesh.material.diffuseMap.shader({
					declaration: true,
					mapType: mesh.material.diffuseMap.type,
				});
				diffuseMapSample = mesh.material.diffuseMap.shader({
					diffuseMapSample: true,
					mapType: mesh.material.diffuseMap.type,
					coordinateSpace: mesh.material.diffuseMap.coordinateSpace,
				});
			}
			let normalMapDeclaration = "";
			let normalMapSample = "";
			if (mesh.material?.normalMap) {
				normalMapDeclaration = mesh.material.normalMap.shader({
					declaration: true,
					mapType: mesh.material.normalMap.type,
				});
				normalMapSample = mesh.material.normalMap.shader({
					normalMapSample: true,
					mapType: mesh.material.normalMap.type,
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
					...(context.numPointLights
						? {
								NUM_POINT_LIGHTS: context.numPointLights,
							}
						: undefined),
				}),
				declarations: [
					...(context.numPointLights ? [context.pointLightShader({ declaration: true, irradiance: false })] : []),
					...(context.toneMappings?.length > 0
						? [...context.toneMappings.map((tm) => tm.shader({ declaration: true, exposure: tm.exposure }))]
						: []),
					...(mesh.material?.specular ? [specularDeclaration] : []),
					...(mesh.material?.diffuseMap ? [diffuseMapDeclaration] : []),
					...(mesh.material?.normalMap ? [normalMapDeclaration] : []),
				].join("\n"),
				diffuseMapSample,
				normalMapSample,
				irradiance: [
					...(context.numPointLights
						? [context.pointLightShader({ declaration: false, irradiance: true, specularIrradiance })]
						: []),
				].join("\n"),
				toneMapping: [
					...(context.toneMappings?.length > 0 ? [...context.toneMappings.map((tm) => tm.shader({ color: true }))] : []),
				].join("\n"),
				//todo, remove this after decoupling the point light shader
				numPointLights: context.numPointLights,
			});
			const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
			gl.shaderSource(fragmentShader, fragmentShaderSource);
			//console.log(fragmentShaderSource);
			gl.compileShader(fragmentShader);
			if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
				console.error("ERROR compiling fragment shader!", gl.getShaderInfoLog(fragmentShader));
			}
			gl.attachShader(program, vertexShader);
			gl.attachShader(program, fragmentShader);
		};
	};
}

export function setupMeshColor(context, { diffuse, metalness }) {
	return function () {
		context = get(context);
		const gl = context.gl;
		const program = context.program;
		const colorLocation = gl.getUniformLocation(program, "diffuse");
		gl.uniform3fv(colorLocation, new Float32Array(diffuse.map(SRGBToLinear)));
		const metalnessLocation = gl.getUniformLocation(program, "metalness");
		gl.uniform1f(metalnessLocation, metalness);
	};
}

export function setupAmbientLight(context, ambientLightColor) {
	return function () {
		context = get(context);
		const { gl, program } = context;
		const ambientLightColorLocation = gl.getUniformLocation(program, "ambientLightColor");
		gl.uniform3fv(ambientLightColorLocation, new Float32Array(ambientLightColor));
	};
}

export function setupCamera(context, camera) {
	return function createCamera() {
		context = get(context);
		const gl = context.gl;
		const program = context.program;
		// projection matrix
		const projectionLocation = gl.getUniformLocation(program, "projection");

		const fieldOfViewInRadians = toRadian(camera.fov);
		const aspectRatio = context.canvas.width / context.canvas.height;
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

export function setupTransformMatrix(context, transformMatrix, numInstances) {
	if (numInstances == null) {
		return function createTransformMatrix() {
			context = get(context);
			const gl = context.gl;
			const program = context.program;
			if (!transformMatrix) {
				transformMatrix = new Float32Array(16);
				identity(transformMatrix);
			}
			context.transformMatrix = transformMatrix;
			const worldLocation = gl.getUniformLocation(program, "world");
			gl.uniformMatrix4fv(worldLocation, false, transformMatrix);
		};
	} else {
		return function createTransformMatrices() {
			const attributeName = "world";
			/** @type {{gl: WebGL2RenderingContext}} **/
			context = get(context);
			const { gl, program, vao } = context;

			const transformMatricesWindows = (context.transformMatricesWindows = context.transformMatricesWindows || []);

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
			//context.transformMatrix = transformMatricesWindows;
			gl.bindVertexArray(vao);
			const matrixBuffer = gl.createBuffer();
			context.matrixBuffer = matrixBuffer;
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
export function updateTransformMatrix(context, worldMatrix) {
	context = get(context);
	const gl = context.gl;
	const program = context.program;
	const worldLocation = gl.getUniformLocation(program, "world");
	gl.uniformMatrix4fv(worldLocation, false, worldMatrix);
}

export function updateInstanceTransformMatrix(context, worldMatrix, instanceIndex) {
	context = get(context);
	/** @type{{gl:WebGL2RenderingContext}} **/
	const { gl, program, vao, matrixBuffer } = context;
	gl.bindVertexArray(vao);
	gl.bindBuffer(gl.ARRAY_BUFFER, matrixBuffer);
	const bytesPerMatrix = 4 * 16;
	gl.bufferSubData(gl.ARRAY_BUFFER, instanceIndex * bytesPerMatrix, worldMatrix);
	gl.bindVertexArray(null);
}

export function setupNormalMatrix(context, numInstances) {
	if (numInstances == null) {
		return function createNormalMatrix() {
			/** @type{{gl:WebGL2RenderingContext}} **/
			const { gl, program, transformMatrix } = get(context);
			const normalMatrixLocation = gl.getUniformLocation(program, "normalMatrix");
			context.normalMatrixLocation = normalMatrixLocation;
			gl.uniformMatrix4fv(normalMatrixLocation, false, derivateNormalMatrix(transformMatrix));
		};
	} else {
		return function createNormalMatrices() {
			context = get(context);
			/** @type{{gl:WebGL2RenderingContext}} **/
			const { gl, program, transformMatrix, vao, transformMatricesWindows } = context;
			gl.bindVertexArray(vao);
			const normalMatricesLocation = gl.getAttribLocation(program, "normalMatrix");
			const normalMatricesValues = [];

			for (let i = 0; i < numInstances; i++) {
				normalMatricesValues.push(...derivateNormalMatrix(transformMatricesWindows[i]));
			}
			const normalMatrices = new Float32Array(normalMatricesValues);
			const normalMatrixBuffer = gl.createBuffer();
			context.normalMatrixBuffer = normalMatrixBuffer;
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

export function updateInstanceNormalMatrix({ gl, program, vao, normalMatrixBuffer }, normalMatrix, instanceIndex) {
	gl.bindVertexArray(vao);
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

export function setupAttributes(context, mesh) {
	return function () {
		context = get(context);
		/** @type {WebGL2RenderingContext} **/
		const gl = context.gl;
		const program = context.program;
		context.attributeLength = mesh.attributes.elements
			? mesh.attributes.elements.length
			: mesh.attributes.positions.length / 3;

		const { positions, normals, elements, uvs } = mesh.attributes;
		const vao = (context.vao = gl.createVertexArray());
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
		if (mesh.attributes.elements) {
			context.hasElements = true;
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
