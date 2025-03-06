import { identity } from "gl-matrix/esm/mat4.js";
import { createZeroMatrix } from "../geometries/common";
import { get, writable } from "svelte/store";
import { updateTransformMatrix, updateNormalMatrix, updateInstanceTransformMatrix } from "./gl";
import { isSvelteGLSingleMesh, isSvelteGLInstancedMesh } from "./mesh-types";
import { programs } from "./programs";
import { renderer } from "./renderer";

const defaultWorldMatrix = createZeroMatrix();
identity(defaultWorldMatrix);
function findProgram(mesh) {
	const program = get(programs).find((program) => program.allMeshes !== true && program.meshes.includes(mesh));
	return program;
}
const createMeshMatrixStore = (mesh, rendererUpdate, initialValue, instanceIndex = NaN) => {
	const { subscribe, set } = writable(initialValue || defaultWorldMatrix);
	const transformMatrix = {
		subscribe,
		set: (nextMatrix) => {
			set(nextMatrix);
			const program = findProgram(mesh);
			if (isNaN(instanceIndex)) {
				updateTransformMatrix(program, nextMatrix);
				updateNormalMatrix(program, nextMatrix);
			} else {
				updateInstanceTransformMatrix(program, mesh, nextMatrix, instanceIndex);
			}
			rendererUpdate(get(renderer));
		},
	};
	return transformMatrix;
};
/**
 *
 * @param {SvelteGLMeshReadyData} value
 * @param {*} symmetry
 * @param {*} symmetryAxis
 * @returns {SvelteGLMesh}
 */
export function create3DObject(value, symmetry = false, symmetryAxis = [0, 0, 0]) {
	if (symmetry) {
		console.log("symmetry");

		/*const newPositions = [];
		for (let i = 0; i < value.attributes.positions.length / 3; i++) {
			const x = value.attributes.positions[i * 3];
			const y = value.attributes.positions[i * 3 + 1];
			const z = value.attributes.positions[i * 3 + 2];
			const [sx, sy, sz] = symmetryAxis;
			newPositions.push(x + 2 * (sx - x), y + 2 * (sy - y), z + 2 * (sz - z));
		}
		value.attributes.positions = newPositions;*/
		/*const newNormals = [];
		for (let i = 0; i < value.attributes.normals.length / 3; i++) {
			const x = value.attributes.normals[i * 3];
			const y = value.attributes.normals[i * 3 + 1];
			const z = value.attributes.normals[i * 3 + 2];
			//calculate normals in symmetry taking symmetryAxis into account
			const [sx, sy, sz] = symmetryAxis;
			newNormals.push(x * -sx, y * -sy, z * -sz);
		}
		value.attributes.normals = newNormals;*/
	}
	/*
	if (isSvelteGLSingleMesh(new3DObject)) {
	    
		new3DObject.matrix = createMeshMatrixStore(new3DObject, renderer.set, new3DObject.matrix);
	} else if (isSvelteGLInstancedMesh(new3DObject)) {
		new3DObject.matrices = new3DObject.matrices.map((matrix, index) => createMeshMatrixStore(new3DObject, renderer.set, matrix, index));
	}
	*/
	/** @type {SvelteGLMesh} */
	// @ts-ignore
	const new3DObject = {
		...value,
	};
	if (isSvelteGLSingleMesh(new3DObject)) {
		// @ts-ignore
		new3DObject.matrix = createMeshMatrixStore(new3DObject, renderer.set, new3DObject.matrix);
	} else if (isSvelteGLInstancedMesh(new3DObject)) {
		// @ts-ignore
		new3DObject.matrices = new3DObject.matrices.map((matrix, index) =>
			createMeshMatrixStore(new3DObject, renderer.set, matrix, index),
		);
	}
	return new3DObject;
}
