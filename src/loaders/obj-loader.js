import { cross, normalize, subtract } from "gl-matrix/esm/vec3.js";
import { drawModes } from "../store/webgl.js";

import { identity } from "gl-matrix/esm/mat4.js";
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
 * @returns
 */
async function parseOBJ(content, url) {
	const rows = content.split("\n");
	const vertex = [];
	const positions = [];
	const normals = [];
	const uvs = [];
	const indices = [];
	const object = {
		attributes: {},
		drawMode: drawModes[4],
		material: {
			diffuse: [1, 1, 1],
			metalness: 0,
		},
		matrix: identity(new Float32Array(16)),
	};
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

	if (positions.length > 0) {
		object.attributes.positions = new Float32Array(positions);
	}
	if (normals.length > 0) {
		object.attributes.normals = new Float32Array(normals);
	}
	if (uvs.length > 0) {
		object.attributes.uvs = new Float32Array(uvs);
	}
	if (indices.length > 0) {
		object.attributes.elements = new Uint16Array(indices);

		console.log("indices used", indices.slice(0, 3));
	}

	return object;
}
