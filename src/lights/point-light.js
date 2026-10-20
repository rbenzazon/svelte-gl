import { transformMat4 } from "gl-matrix/esm/vec3.js";
import { get } from "svelte/store";
import { createVec3, multiplyScalarVec3 } from "../geometries/common.js";
import { templateLiteralRenderer } from "../shaders/template.js";
import { appContext } from "../store/app-context";
import { camera } from "../store/camera";
import { UBO_BINDING_POINT_POINTLIGHT } from "../store/gl.js";
import pointLightShader from "./point-light.glsl";

/**
 * @typedef {"point" | "spot"} SvelteGLLightType
 */

/**
 * @typedef {Object} SvelteGLLightProps
 * @property {vec3} [position]
 * @property {vec3} [color]
 * @property {number} [intensity]
 * @property {number} [cutoffDistance]
 * @property {number} [decayExponent]
 * @property {SvelteGLLightType} [type]
 * @property {boolean} [viewSpace] position is given in view space, so the light moves with the camera
 */

/**
 * @typedef {Object} SvelteGLLightObject
 * @property {import("../shaders/template.js").TemplateRenderer} shader
 * @property {()=>void} setupLights
 * @property {UpdateOneLight} updateOneLight
 */
/**
 * @typedef {SvelteGLLightProps & SvelteGLLightObject} SvelteGLLightValue
 */
/**
 *
 * @param {SvelteGLLightProps} props
 * @returns {SvelteGLLightValue}
 */
export const createPointLight = (props) => {
	return {
		type: "point",
		position: [0, 0, 0],
		color: [1, 1, 1],
		intensity: 3,
		cutoffDistance: 5,
		decayExponent: 1,
		...props,
		shader: templateLiteralRenderer(pointLightShader, {
			declaration: false,
			irradiance: false,
			specularIrradiance: "",
		}),
		setupLights,
		updateOneLight,
	};
};
export const setPointLightsUBO = (newPointLightsUBO) => {
	appContext.pointLightsUBO = newPointLightsUBO;
};

export const getPointLightsUBO = () => {
	return appContext.pointLightsUBO;
};
/** @typedef {Object} WithGL
 * @property {WebGL2RenderingContext} gl
 */

/**
 *
 * @param {WithGL} param0
 * @param {*} lights
 */
export function createPointLightBuffer(ctx, pointLigths) {
	const { gl } = ctx;
	// Create a single Float32Array to hold all the point light data
	const numPointLights = pointLigths.length;
	const pointLightsData = new Float32Array(numPointLights * 12); // Each point light has 12 values (position(3=>4), color(3=>4), intensity(1=>4))
	// Fill the Float32Array with the point light data
	for (let lightIndex = 0; lightIndex < numPointLights; lightIndex++) {
		const light = get(pointLigths[lightIndex]);
		const offset = lightIndex * 12; // Each point light takes up 8 positions in the array
		writeLightBuffer(pointLightsData, light, offset, ctx.camera ?? camera);
	}
	let pointLightsUBO = ctx.pointLightsUBO;
	if (pointLightsUBO) {
		gl.bindBuffer(gl.UNIFORM_BUFFER, pointLightsUBO);
	} else {
		// Create UBO for point lights
		pointLightsUBO = gl.createBuffer();
		gl.bindBufferBase(gl.UNIFORM_BUFFER, UBO_BINDING_POINT_POINTLIGHT, pointLightsUBO);
		ctx.pointLightsUBO = pointLightsUBO;
	}

	// Set the data in the UBO using bufferData
	gl.bufferData(gl.UNIFORM_BUFFER, pointLightsData, gl.DYNAMIC_DRAW);
}

function writeLightBuffer(buffer, light, offset, cameraStore) {
	light.preMultipliedColor = [...light.color];

	const lightPosition = light.viewSpace ? light.position : transformMat4(createVec3(), light.position, cameraStore.view);
	multiplyScalarVec3(light.preMultipliedColor, light.intensity);
	// Set the position data
	buffer[offset] = lightPosition[0];
	buffer[offset + 1] = lightPosition[1];
	buffer[offset + 2] = lightPosition[2];
	buffer[offset + 4] = light.preMultipliedColor[0];
	buffer[offset + 5] = light.preMultipliedColor[1];
	buffer[offset + 6] = light.preMultipliedColor[2];
	buffer[offset + 7] = light.cutoffDistance;
	buffer[offset + 8] = light.decayExponent;
	buffer[offset + 9] = 0;
	buffer[offset + 10] = 0;
	buffer[offset + 11] = 0;
	buffer[offset + 12] = 0;
}

export function setupLights(lights) {
	return function setupLights(ctx) {
		const { gl, program } = ctx;
		//only create the UBO once per app, not per program, todo move the only once logic to webglapp store
		if (!ctx.pointLightsUBO) {
			//program specific
			const pointLightsBlockIndex = gl.getUniformBlockIndex(program, "PointLights");
			// Bind the UBO to the binding point
			gl.uniformBlockBinding(program, pointLightsBlockIndex, UBO_BINDING_POINT_POINTLIGHT);
		}
		createPointLightBuffer(ctx, lights);
	};
}
/**
 * @callback UpdateOneLight
 * @param {SvelteGLLightCustomStore[]} lights
 * @param {SvelteGLLightCustomStore} light
 * @returns {void}
 */
/** @type {UpdateOneLight} */
export function updateOneLight(lights, light, ctx = appContext) {
	const { gl } = ctx;
	const pointLigths = lights.filter((l) => get(l).type === "point");
	const lightIndex = pointLigths.findIndex((l) => l === light);
	const pointLightsUBO = ctx.pointLightsUBO;
	if (lightIndex !== -1 && pointLightsUBO) {
		const lightData = new Float32Array(12);
		const offset = lightIndex * 12;
		const lightValue = get(light);
		writeLightBuffer(lightData, lightValue, 0, ctx.camera ?? camera);
		gl.bindBuffer(gl.UNIFORM_BUFFER, pointLightsUBO);
		gl.bufferSubData(gl.UNIFORM_BUFFER, offset * Float32Array.BYTES_PER_ELEMENT, lightData);
	}
}
