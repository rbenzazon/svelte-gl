import { create, invert, transpose, identity, lookAt, perspective } from "gl-matrix/esm/mat4.js";
import { get } from "svelte/store";
import { renderState } from "./engine.js";
import defaultVertex from "../shaders/default-vertex.glsl";
import defaultFragment from "../shaders/default-fragment.glsl";
import { objectToDefines, templateLiteralRenderer } from "../shaders/template.js";

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
		gl.clearColor.apply(gl, rendererContext.backgroundColor);
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

export function render(context) {
	return function () {
		context = get(context);
		const gl = context.gl;
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		context.loop && context.loop();
		if (context.hasElements) {
			gl.drawElements(gl.TRIANGLES, context.attributeLength, gl.UNSIGNED_SHORT, 0);
		} else {
			gl.drawArrays(gl.TRIANGLES, 0, context.attributeLength);
		}
	};
}

export function createProgram(context) {
	return function createProgram() {
		context = get(context);
		const gl = context.gl;
		const program = gl.createProgram();
		context.program = program;
	};
}

export function endProgramSetup(context) {
	return function () {
		context = get(context);
		const gl = context.gl;
		const program = context.program;
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			console.error("ERROR linking program!", gl.getProgramInfoLog(program));
		}
		gl.validateProgram(program);
		if (!gl.getProgramParameter(program, gl.VALIDATE_STATUS)) {
			console.error("ERROR validating program!", gl.getProgramInfoLog(program));
		}
		gl.useProgram(program);
	};
}

export function createShaders() {
	return function (context) {
		return function () {
			context = get(context);
			const gl = context.gl;
			const program = context.program;
			const vertexShaderSource = defaultVertex;

			const vertexShader = gl.createShader(gl.VERTEX_SHADER);
			gl.shaderSource(vertexShader, vertexShaderSource);
			gl.compileShader(vertexShader);
			const fragmentShaderSource = templateLiteralRenderer(
				{
					defines: objectToDefines({
						...(context.numPointLights
							? {
									NUM_POINT_LIGHTS: context.numPointLights,
								}
							: undefined),
					}),
					declarations: [
						...(context.numPointLights ? [context.pointLightShader({ declaration: true, irradiance: false })] : undefined),
						...(context.toneMappings.length > 0
							? [...context.toneMappings.map((tm) => tm.shader({ declaration: true, exposure: tm.exposure, color: false }))]
							: undefined),
					].join("\n"),
					irradiance: [
						...(context.numPointLights ? [context.pointLightShader({ declaration: false, irradiance: true })] : undefined),
					].join("\n"),
					toneMapping: [
						...(context.toneMappings.length > 0
							? [...context.toneMappings.map((tm) => tm.shader({ declaration: false, exposure: false, color: true }))]
							: undefined),
					].join("\n"),
					//todo, remove this after decoupling the point light shader
					numPointLights: context.numPointLights,
				},
				defaultFragment,
			);
			//console.log(fragmentShaderSource);

			const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
			gl.shaderSource(fragmentShader, fragmentShaderSource);
			gl.compileShader(fragmentShader);
			gl.attachShader(program, vertexShader);
			gl.attachShader(program, fragmentShader);
		};
	};
}

export function setupMeshColor(context, { color }) {
	return function () {
		context = get(context);
		const gl = context.gl;
		const program = context.program;
		const colorLocation = gl.getUniformLocation(program, "color");
		gl.uniform3fv(colorLocation, new Float32Array(color));
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
	};
}

export function setupTransformMatrix(context, transformMatrix) {
	return function () {
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
}

export function updateTransformMatrix(context, worldMatrix) {
	context = get(context);
	const gl = context.gl;
	const program = context.program;
	const worldLocation = gl.getUniformLocation(program, "world");
	gl.uniformMatrix4fv(worldLocation, false, worldMatrix);
}

export function setupNormalMatrix(context) {
	return function createNormalMatrix() {
		const { gl, program, transformMatrix } = get(context);
		const normalMatrixLocation = gl.getUniformLocation(program, "normalMatrix");
		context.normalMatrixLocation = normalMatrixLocation;
		gl.uniformMatrix4fv(normalMatrixLocation, setupNormalMatrix, deriveNormalMatrix(transformMatrix));
	};
}

export function updateNormalMatrix({ gl, program }, normalMatrix) {
	const normalMatrixLocation = gl.getUniformLocation(program, "normalMatrix");
	gl.uniformMatrix4fv(normalMatrixLocation, false, normalMatrix);
}

export function deriveNormalMatrix(transformMatrix) {
	const normalMatrix = create();
	invert(normalMatrix, transformMatrix);
	transpose(normalMatrix, normalMatrix);
	return normalMatrix;
}

export function setupAttributes(context, mesh) {
	return function () {
		context = get(context);
		const gl = context.gl;
		const program = context.program;
		context.attributeLength = mesh.attributes.elements
			? mesh.attributes.elements.length
			: mesh.attributes.positions.length / 3;

		const positionsData = new Float32Array(mesh.attributes.positions);
		//position
		const positionBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, positionsData, gl.STATIC_DRAW);
		const positionLocation = gl.getAttribLocation(program, "position");
		gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer); //todo check if redundant
		gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
		gl.enableVertexAttribArray(positionLocation);
		//normal
		const normalsData = new Float32Array(mesh.attributes.normals);
		const normalBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, normalsData, gl.STATIC_DRAW);
		const normalLocation = gl.getAttribLocation(program, "normal");
		gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer); //todo check if redundant
		gl.vertexAttribPointer(normalLocation, 3, gl.FLOAT, false, 0, 0);
		gl.enableVertexAttribArray(normalLocation);
		if (mesh.attributes.elements) {
			context.hasElements = true;
			const elementsData = new Uint16Array(mesh.attributes.elements);
			const elementBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elementBuffer);
			gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, elementsData, gl.STATIC_DRAW);
		}
	};
}
