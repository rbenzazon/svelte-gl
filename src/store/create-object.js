import { identity, multiply } from "gl-matrix/esm/mat4.js";
import { createZeroMatrix } from "../geometries/common";
import { get, writable } from "svelte/store";
import { updateObjectMatrix, updateNormalMatrix, updateInstanceObjectMatrix, updateInstanceNormalMatrix } from "./gl";
import { isSvelteGLSingleMesh, isSvelteGLInstancedMesh } from "./mesh-types";
import { programs } from "./programs";
import { renderer } from "./renderer";
import { camera } from "./camera";
import { fromMat4, invert, transpose } from "gl-matrix/esm/mat3.js";

const defaultObjectMatrix = createZeroMatrix();
identity(defaultObjectMatrix);
function findProgram(mesh) {
	const program = get(programs).find((program) => program.allMeshes !== true && program.meshes.includes(mesh));
	return program;
}
/*
const createMeshMatrixStore = (mesh, rendererUpdate, initialValue, instanceIndex = NaN) => {
	const { subscribe, set } = writable(initialValue || defaultObjectMatrix);
	const objectMatrix = {
		subscribe,
		set: (nextMatrix) => {
			set(nextMatrix);
			const program = findProgram(mesh);
			if (isNaN(instanceIndex)) {
				updateObjectMatrix(program, nextMatrix);
				updateNormalMatrix(program, nextMatrix);
			} else {
				updateInstanceObjectMatrix(program, mesh, nextMatrix, instanceIndex);
			}
			rendererUpdate(get(renderer));
		},
	};
	return objectMatrix;
};
*/
const createMeshMatrixStore = (mesh, rendererUpdate, initialValue) => {
	let value = initialValue || defaultObjectMatrix;
	let modelView = new Float32Array(16);
	let normalMatrix = new Float32Array(9);
	let cameraRevision = camera.revision;
	update();

	function update() {
		setModelViewMatrix(modelView, value);
		derivateNormalMatrix(normalMatrix, modelView);
	}

	const store = {
		set: (nextMatrix) => {
			value = nextMatrix;
			update();
			const program = findProgram(mesh);
			updateObjectMatrix(program, store);
			updateNormalMatrix(program, store);
			rendererUpdate(get(renderer));
		},
		get value() {
			return value;
		},
		get modelView() {
			if (camera.revision !== cameraRevision) {
				update();
				cameraRevision = camera.revision;
			}
			return modelView;
		},
		get normalMatrix() {
			if (camera.revision !== cameraRevision) {
				update();
				cameraRevision = camera.revision;
			}
			return normalMatrix;
		},
	};
	return store;
};

function setModelViewMatrix(mvMatrix, objectMatrix) {
	multiply(mvMatrix, camera.view, objectMatrix);
}

function derivateNormalMatrix(normalMatrix, modelViewMatrix) {
	fromMat4(normalMatrix, modelViewMatrix);
	normalMatrix = invert(normalMatrix, normalMatrix);
	normalMatrix = transpose(normalMatrix, normalMatrix);
	return normalMatrix;
}

function reduceTypedArrays(typedArrays) {
	const length = typedArrays.reduce((acc, arr) => acc + arr.length, 0);
	const flat = new Float32Array(length);
	let offset = 0;
	typedArrays.forEach((arr) => {
		flat.set(arr, offset);
		offset += arr.length;
	});
	return flat;
}

// find if UBO and renderer updates should be sent from here directly
const createMeshMatricesStore = (mesh, rendererUpdate, objectMatrices, instances) => {
	let value = Array.isArray(objectMatrices) ? reduceTypedArrays(objectMatrices) : objectMatrices;
	const windows = [];
	const modelView = new Float32Array(16 * instances);
	const modelViewWindows = [];
	const normalMatrices = new Float32Array(9 * instances);
	const normalMatricesWindows = [];

	let cameraRevision = camera.revision;
	let modelViewBuffer;
	let normalMatrixBuffer;

	for (let i = 0; i < instances; ++i) {
		const byteOffsetToMatrix = i * 16 * 4;
		const numFloatsForView = 16;
		windows.push(new Float32Array(value.buffer, byteOffsetToMatrix, numFloatsForView));
		modelViewWindows.push(new Float32Array(modelView.buffer, byteOffsetToMatrix, numFloatsForView));
		normalMatricesWindows.push(new Float32Array(normalMatrices.buffer, i * 9 * 4, 9));
	}

	function updateInstance(matrix, instance) {
		setModelViewMatrix(modelViewWindows[instance], matrix);
		derivateNormalMatrix(normalMatricesWindows[instance], modelViewWindows[instance]);
	}

	function updateModelViewMatrix() {
		windows.forEach((matrix, i) => {
			updateInstance(matrix, i);
			/*setModelViewMatrix(modelViewWindows[i], matrix);
			derivateNormalMatrix(normalMatricesWindows[i], modelViewWindows[i]);*/
		});
	}

	return {
		set: (nextMatrix) => {
			value = nextMatrix;
			/*const program = findProgram(mesh);
			updateObjectMatrix(program, nextMatrix);
			updateNormalMatrix(program, nextMatrix);
			rendererUpdate(get(renderer));*/
		},
		get value() {
			return value;
		},
		get windows() {
			return windows;
		},
		setInstance(index, nextMatrix) {
			windows[index].set(nextMatrix);
			updateInstance(windows[index], index);
			const program = findProgram(mesh);

			updateInstanceObjectMatrix(program, mesh, modelViewWindows[index], index, modelViewBuffer);
			updateInstanceNormalMatrix(program, mesh, normalMatricesWindows[index], index, normalMatrixBuffer);

			//rendererUpdate(get(renderer));
		},
		getInstance(index) {
			return windows[index];
		},
		get modelView() {
			if (camera.revision !== cameraRevision) {
				updateModelViewMatrix();
				cameraRevision = camera.revision;
			}
			return modelView;
		},
		getModelViewInstance(index) {
			return modelViewWindows[index];
		},
		get modelViewWindows() {
			return modelViewWindows;
		},
		set modelViewBuffer(value) {
			modelViewBuffer = value;
		},
		get modelViewBuffer() {
			return modelViewBuffer;
		},
		get normalMatrices() {
			if (camera.revision !== cameraRevision) {
				updateModelViewMatrix();
				cameraRevision = camera.revision;
			}
			return normalMatrices;
		},
		set normalMatrixBuffer(value) {
			normalMatrixBuffer = value;
		},
		get normalMatrixBuffer() {
			return normalMatrixBuffer;
		},
	};
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
		new3DObject.matrices = createMeshMatricesStore(
			new3DObject,
			renderer.set,
			new3DObject.matrices,
			new3DObject.instances,
		);
	}
	return new3DObject;
}
