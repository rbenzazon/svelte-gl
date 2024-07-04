import { create, invert, transpose, identity, lookAt, perspective } from "gl-matrix/esm/mat4.js";
import { get } from "svelte/store";
import { renderState } from "./engine.js";
import defaultVertex from '../shaders/default-vertex.glsl';
import defaultFragment from '../shaders/default-fragment.glsl';
import { objectToDefines, templateLiteralRenderer } from "../shaders/template.js";

const degree = Math.PI / 180;
/**
 * Convert Degree To Radian
 *
 * @param {Number} a Angle in Degrees
 */

function toRadian(a) {
	return a * degree;
}

export function setupNormalMatrix(context) {
	return function createNormalMatrix() {
		context = get(context);
		const gl = context.gl;
		const program = context.program;
		const worldMatrix = context.worldMatrix;
		const normalMatrixLocation = gl.getUniformLocation(program, "normalMatrix");
		context.normalMatrixLocation = normalMatrixLocation;
		let normalMatrix = create();
		invert(normalMatrix, worldMatrix);
		transpose(normalMatrix, normalMatrix);
		gl.uniformMatrix4fv(normalMatrixLocation, false, normalMatrix);
	};
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

export function createShaders(material, attributes, uniforms) {
	return function (context) {
		return function () {
			context = get(context);
			const gl = context.gl;
			const program = context.program;
			const vertexShaderSource = defaultVertex;
			
			const vertexShader = gl.createShader(gl.VERTEX_SHADER);
			gl.shaderSource(vertexShader, vertexShaderSource);
			gl.compileShader(vertexShader);
			const fragmentShaderSource = templateLiteralRenderer({
					defines: objectToDefines({
						NUM_POINT_LIGHTS: context.numPointLights,
					})
				},defaultFragment);
			console.log("fragmentShaderSource", fragmentShaderSource);
			console.log("defaultFragment", defaultFragment);
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

export function setupLights(context, lights) {
	return function () {
		context = get(context);
		const gl = context.gl;
		const program = context.program;
		const pointLigths = lights.filter(l => l.type === "point");



		const pointLightsBlockIndex = gl.getUniformBlockIndex(program, "PointLights");
		// Bind the UBO to the binding point
		const pointLightsBindingPoint = 0; // Choose a binding point for the UBO

		console.log("pointLightsBlockIndex", pointLightsBlockIndex);
		gl.uniformBlockBinding(program, pointLightsBlockIndex, pointLightsBindingPoint);

		const indices = gl.getUniformIndices(program, ["PointLights[0].position", "PointLights[0].color", "PointLights[0].intensity"]);
		console.log("indices", indices);
		const offsets = gl.getActiveUniforms(program, indices, gl.UNIFORM_OFFSET);
		console.log("offsets", offsets);

		// Create UBO for point lights
		const pointLightsUBO = gl.createBuffer();

		gl.bindBuffer(gl.UNIFORM_BUFFER, pointLightsUBO);

		// Calculate the size of the UBO
		const pointLightSize = 12 * Float32Array.BYTES_PER_ELEMENT; // Size of a single point light in bytes
		const numPointLights = pointLigths.length;
		const pointLightsBufferSize = pointLightSize * numPointLights;

		// Allocate memory for the UBO
		//gl.bufferData(gl.UNIFORM_BUFFER, pointLightsBufferSize, gl.DYNAMIC_DRAW);

		
		gl.bindBufferBase(gl.UNIFORM_BUFFER, pointLightsBindingPoint, pointLightsUBO);
		
		// Create a single Float32Array to hold all the point light data

		const pointLightsData = new Float32Array(numPointLights * 8); // Each point light has 12 values (position(3=>4), color(3=>4), intensity(1=>4))

		// Fill the Float32Array with the point light data
		for (let i = 0; i < numPointLights; i++) {
			const light = pointLigths[i];
			const offset = i * 8; // Each point light takes up 8 positions in the array
		
			// Set the position data
			pointLightsData[offset] = light.position[0];
			pointLightsData[offset + 1] = light.position[1];
			pointLightsData[offset + 2] = light.position[2];
			pointLightsData[offset + 4] = light.color[0];
			pointLightsData[offset + 5] = light.color[1];
			pointLightsData[offset + 6] = light.color[2];
			pointLightsData[offset + 7] = light.intensity;
			pointLightsData[offset + 8] = 0;

			//

		}
		console.log("pointLightsData", pointLightsData);
		
		// Set the data in the UBO using bufferData
		gl.bufferData(gl.UNIFORM_BUFFER, pointLightsData, gl.DYNAMIC_DRAW);

		// Bind the UBO to the uniform block in the shader
		
		

/*
		const lightPositionsLocation = gl.getUniformLocation(program, "pointLightPositions[0]");
		const lightPositionsData = pointLigths.reduce((acc, light) => {
			return [...acc, ...light.position];
		}, []);
		gl.uniform3fv(lightPositionsLocation, new Float32Array(lightPositionsData));
		const lightColorsLocation = gl.getUniformLocation(program, "pointLightColors[0]");
		const lightColorsData = pointLigths.reduce((acc, light) => {
			return [...acc, ...light.color];
		}, []);
		gl.uniform3fv(lightColorsLocation, new Float32Array(lightColorsData));
		const lightIntensitiesLocation = gl.getUniformLocation(program, "pointLightIntensities[0]");
		const lightIntensitiesData = pointLigths.reduce((acc, light) => {
			return [...acc, light.intensity];
		}, []);
		gl.uniform1fv(lightIntensitiesLocation, new Float32Array(lightIntensitiesData));*/
	};
}

export function setupWorldMatrix(context, worldMatrix) {
	return function () {
		context = get(context);
		const gl = context.gl;
		const program = context.program;
		if (!worldMatrix) {
			worldMatrix = new Float32Array(16);
			identity(worldMatrix);
		}
		context.worldMatrix = worldMatrix;
		const worldLocation = gl.getUniformLocation(program, "world");
		gl.uniformMatrix4fv(worldLocation, false, worldMatrix);
	};
}

export function updateWorldMatrix(context, worldMatrix) {
	context = get(context);
	const gl = context.gl;
	const program = context.program;
	const worldLocation = gl.getUniformLocation(program, "world");
	gl.uniformMatrix4fv(worldLocation, false, worldMatrix);
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
