import { create, invert, transpose, identity, lookAt, perspective } from "gl-matrix/esm/mat4.js";
import { get } from "svelte/store";
import { renderState } from "./engine.js";

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

export function initRenderer(context, contextStore) {
	return function () {
		const canvasRect = context.canvas.getBoundingClientRect();
		context.canvas.width = canvasRect.width;
		context.canvas.height = canvasRect.height;
		const gl = (context.gl = context.canvas.getContext("webgl2"));
		contextStore.set(context);
		gl.viewportWidth = context.canvas.width;
		gl.viewportHeight = context.canvas.height;
		gl.clearColor.apply(gl, context.backgroundColor);
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
			const vertexShaderSource = `#version 300 es
precision mediump float;
    
in vec3 position;
in vec3 normal;

uniform mat4 world;
uniform mat4 view;
uniform mat4 projection;
uniform mat4 normalMatrix;

// Pass the color attribute down to the fragment shader
out vec3 vertexColor;
out vec3 vNormal;
out vec3 vertex;

void main() {
    

    // Pass the color down to the fragment shader
    vertexColor = vec3(1.27,1.27,1.27);
    // Pass the vertex down to the fragment shader
    vertex = vec3(world * vec4(position, 1.0));
    // Pass the normal down to the fragment shader
    vNormal = vec3(normalMatrix * vec4(normal, 1.0));
    //vNormal = normal;
    
    // Pass the position down to the fragment shader
    gl_Position = projection * view * world * vec4(position, 1.0);
}`;
			const vertexShader = gl.createShader(gl.VERTEX_SHADER);
			gl.shaderSource(vertexShader, vertexShaderSource);
			gl.compileShader(vertexShader);
			const fragmentShaderSource = `#version 300 es
precision mediump float;

uniform vec3 lightPosition;
uniform vec3 color;

in vec3 vertex;
in vec3 vNormal;    
in vec3 vertexColor;

out vec4 fragColor;

void main() {
    //vec3 offset = lightPosition - vertex;
    vec3 offset = vec3(0.0,7.0,-3.0) - vertex;
    float distance = length(offset);
    vec3 direction = normalize(offset);

    float diffuse = max(dot(direction, vNormal), 0.0);
    float attenuation = 10.0 / (0.1 + 0.1*distance + 0.1*distance*distance);
    float brightness = max(diffuse * attenuation,0.1);
    fragColor = vec4(brightness*color,1.0);
}`;
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
		console.log("color", color, context.program, context.gl);
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
		const lightPositionLocation = gl.getUniformLocation(program, "lightPosition");
		gl.uniform3fv(lightPositionLocation, new Float32Array(lights[0]));
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
