import { cross, normalize, subtract } from "gl-matrix/esm/vec3.js";
import { drawModes } from "../store/webgl.js";

import { identity } from "gl-matrix/esm/mat4.js";
import { createZeroMatrix } from "../geometries/common.js";
export async function loadOBJFile(url) {
	try {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Failed to fetch OBJ file: ${response.statusText}`);
		}
		const content = await response.text();
		return await parseOBJ(content, url);
	} catch (error) {
		console.error("Error loading OBJ file:", error);
	}
}

/**
 *
 * @param {string} content
 * @param {string} url
 * @returns {Promise<SvelteGLMeshData>}
 */
async function parseOBJ(content, url) {
	const rows = content.split("\n");
	const vertex = [];
	const positions = [];
	const normals = [];
	const uvs = [];
	const indices = [];

	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		if (row.startsWith("v ")) {
			const [, x, y, z] = row.split(" ");
			vertex.push(parseFloat(x), parseFloat(y), parseFloat(z));
		}
		if (row.startsWith("vn ")) {
			const [, x, y, z] = row.split(" ");
			normals.push(parseFloat(x), parseFloat(y), parseFloat(z));
		}
		if (row.startsWith("vt ")) {
			const [, x, y] = row.split(" ");
			uvs.push(parseFloat(x), parseFloat(y));
		}
		if (row.startsWith("f ")) {
			const [, a, b, c] = row.split(" ");

			//indices.push(parseInt(a)-1, parseInt(b)-1, parseInt(c)-1);
			const aAddress = (parseInt(a) - 1) * 3;
			const bAddress = (parseInt(b) - 1) * 3;
			const cAddress = (parseInt(c) - 1) * 3;

			const v1 = [vertex[aAddress], vertex[aAddress + 1], vertex[aAddress + 2]];
			const v2 = [vertex[bAddress], vertex[bAddress + 1], vertex[bAddress + 2]];
			const v3 = [vertex[cAddress], vertex[cAddress + 1], vertex[cAddress + 2]];

			positions.push(...v1);
			positions.push(...v2);
			positions.push(...v3);

			//add normal
			const normal = cross([], subtract([], v3, v2), subtract([], v1, v2));
			normalize(normal, normal);
			normals.push(...normal, ...normal, ...normal);
		}
	}

	return {
		attributes: {
			positions: new Float32Array(positions),
			normals: new Float32Array(normals),
			...(uvs.length > 0 && { uvs: new Float32Array(uvs) }),
			...(indices.length > 0 && { elements: new Uint16Array(indices) }),
		},
		drawMode: drawModes[4],
		material: {
			diffuse: [1, 1, 1],
			metalness: 0,
		},
		matrix: identity(createZeroMatrix()),
	};
}
