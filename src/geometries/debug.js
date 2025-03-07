//this geometry will take an existing object and normals as lines

import { drawModes } from "../store/webgl";

/**
 *
 * @param {SvelteGLMeshReadyData} object
 * @returns {SvelteGLMeshReadyData}
 */
export function createDebugObject(object) {
	const { normals, positions } = object.attributes;
	console.log("positions", positions);
	const positionsData = typeof positions !== "Float32Array" && "data" in positions ? positions.data : positions;
	const normalsData = typeof normals !== "Float32Array" && "data" in normals ? normals.data : normals;
	//for each vertex, create a line with the normal
	const lines = [];
	const lineLength = 0.2;
	for (let i = 0; i < positionsData.length; i += 3) {
		lines.push(positionsData[i], positionsData[i + 1], positionsData[i + 2]);
		lines.push(
			positionsData[i] + normalsData[i] * lineLength,
			positionsData[i + 1] + normalsData[i + 1] * lineLength,
			positionsData[i + 2] + normalsData[i + 2] * lineLength,
		);
	}
	return {
		attributes: {
			positions: new Float32Array(lines),
		},
		matrix: object.matrix,
		material: object.material,
		drawMode: drawModes[1],
	};
}
