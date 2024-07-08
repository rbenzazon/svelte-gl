import pointLightShader from "../shaders/point-light.glsl";
import { templateLiteralRenderer } from "../shaders/template.js";
import { get } from "svelte/store";
import { multiplyScalarVec3 } from "../geometries/common.js";

export const createPointLight = (props) => {
	return {
		type: "point",
		position: [0, 0, 0],
		color: [1, 1, 1],
		intensity: 3,
		cutoffDistance: 5,
		decayExponent: 1,
		...props,
		shader: (segment) => templateLiteralRenderer(segment, pointLightShader),
		setupLights,
		updateOneLight,
	};
};
let pointLightsUBO = null;
export const setPointLightsUBO = (newPointLightsUBO) => {
	pointLightsUBO = newPointLightsUBO;
};

export const getPointLightsUBO = () => {
	return pointLightsUBO;
};

export function setupLights(context, lights) {
	return function () {
		context = get(context);
		const gl = context.gl;
		const program = context.program;
		const pointLigths = lights.filter((l) => get(l).type === "point");

		const pointLightsBlockIndex = gl.getUniformBlockIndex(program, "PointLights");
		// Bind the UBO to the binding point
		const pointLightsBindingPoint = 0; // Choose a binding point for the UBO

		gl.uniformBlockBinding(program, pointLightsBlockIndex, pointLightsBindingPoint);

		// Create UBO for point lights
		const tmpPointLightsUBO = gl.createBuffer();
		setPointLightsUBO(tmpPointLightsUBO);

		gl.bindBuffer(gl.UNIFORM_BUFFER, tmpPointLightsUBO);

		const numPointLights = pointLigths.length;

		gl.bindBufferBase(gl.UNIFORM_BUFFER, pointLightsBindingPoint, tmpPointLightsUBO);

		// Create a single Float32Array to hold all the point light data
		const pointLightsData = new Float32Array(numPointLights * 12); // Each point light has 12 values (position(3=>4), color(3=>4), intensity(1=>4))

		// Fill the Float32Array with the point light data
		for (let i = 0; i < numPointLights; i++) {
			const light = get(pointLigths[i]);
			const offset = i * 12; // Each point light takes up 8 positions in the array
			light.preMultipliedColor = [...light.color];
			multiplyScalarVec3(light.preMultipliedColor, light.intensity);
			// Set the position data
			pointLightsData[offset] = light.position[0];
			pointLightsData[offset + 1] = light.position[1];
			pointLightsData[offset + 2] = light.position[2];
			pointLightsData[offset + 4] = light.preMultipliedColor[0];
			pointLightsData[offset + 5] = light.preMultipliedColor[1];
			pointLightsData[offset + 6] = light.preMultipliedColor[2];
			pointLightsData[offset + 7] = light.cutoffDistance;
			pointLightsData[offset + 8] = light.decayExponent;
			pointLightsData[offset + 9] = 0.25;
			pointLightsData[offset + 10] = 0.5;
			pointLightsData[offset + 11] = 0.75;
			pointLightsData[offset + 12] = 1;
		}

		// Set the data in the UBO using bufferData
		gl.bufferData(gl.UNIFORM_BUFFER, pointLightsData, gl.DYNAMIC_DRAW);
	};
}

export function updateOneLight(context, lights, light) {
	context = get(context);
	const gl = context.gl;
	const pointLigths = lights.filter((l) => get(l).type === "point");
	const lightIndex = pointLigths.findIndex((l) => l === light);
	const pointLightsUBO = getPointLightsUBO();
	if (lightIndex !== -1) {
		const lightData = new Float32Array(12);
		const offset = lightIndex * 12;
		const lightValue = get(light);
		lightValue.preMultipliedColor = [...lightValue.color];
		multiplyScalarVec3(lightValue.preMultipliedColor, lightValue.intensity);
		lightData[0] = lightValue.position[0];
		lightData[1] = lightValue.position[1];
		lightData[2] = lightValue.position[2];
		lightData[4] = lightValue.preMultipliedColor[0];
		lightData[5] = lightValue.preMultipliedColor[1];
		lightData[6] = lightValue.preMultipliedColor[2];
		lightData[7] = lightValue.cutoffDistance;
		lightData[8] = lightValue.decayExponent;
		lightData[9] = 0.25;
		lightData[10] = 0.5;
		lightData[11] = 0.75;
		lightData[12] = 1;
		gl.bindBuffer(gl.UNIFORM_BUFFER, pointLightsUBO);
		gl.bufferSubData(gl.UNIFORM_BUFFER, offset * Float32Array.BYTES_PER_ELEMENT, lightData);
	}
}
