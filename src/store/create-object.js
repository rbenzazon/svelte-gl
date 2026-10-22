import { copy, identity, multiply } from "gl-matrix/esm/mat4.js";
import { get, writable } from "svelte/store";
import { createZeroMatrix } from "../geometries/common";
import { appContext } from "./app-context";
import { camera } from "./camera";
import { updateInstanceNormalMatrix, updateInstanceObjectMatrix, updateNormalMatrix, updateObjectMatrix } from "./gl";
import { isSvelteGLInstancedMesh, isSvelteGLSingleMesh } from "./mesh-types";
import { programs } from "./programs";
import { renderer } from "./renderer";

const defaultDeps = {
	get camera() {
		return camera;
	},
	get programs() {
		return programs;
	},
	get renderer() {
		return renderer;
	},
	get ctx() {
		return appContext;
	},
};
import { fromMat4, invert, transpose } from "gl-matrix/esm/mat3.js";

const defaultObjectMatrix = createZeroMatrix();
identity(defaultObjectMatrix);
function findProgram(mesh, deps = defaultDeps) {
	const program = get(deps.programs).find((program) => program.allMeshes !== true && program.meshes.includes(mesh));
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
function applyCommonMatrix(matrix, commonMatrix) {
	let newValue = matrix;
	if (commonMatrix) {
		newValue = multiply(createZeroMatrix(), commonMatrix, matrix);
	}
	return newValue;
}

const createMeshMatrixStore = (mesh, rendererUpdate, initialValue, commonMatrix, deps = defaultDeps) => {
	let value = applyCommonMatrix(initialValue || defaultObjectMatrix, commonMatrix);
	const modelView = new Float32Array(16);
	const normalMatrix = new Float32Array(9);
	let cameraRevision = deps.camera.revision;
	update();

	function update() {
		setModelViewMatrix(modelView, value, deps);
		derivateNormalMatrix(normalMatrix, modelView);
	}

	const store = {
		set: (nextMatrix) => {
			value = applyCommonMatrix(nextMatrix, commonMatrix?.value);
			update();
			const program = findProgram(mesh, deps);
			updateObjectMatrix(program, store, deps.ctx);
			updateNormalMatrix(program, store, deps.ctx);
			rendererUpdate(get(deps.renderer));
		},
		get value() {
			return value;
		},
		get modelView() {
			if (deps.camera.revision !== cameraRevision) {
				update();
				cameraRevision = deps.camera.revision;
			}
			return modelView;
		},
		get normalMatrix() {
			if (deps.camera.revision !== cameraRevision) {
				update();
				cameraRevision = deps.camera.revision;
			}
			return normalMatrix;
		},
	};
	return store;
};

function setModelViewMatrix(mvMatrix, objectMatrix, deps = defaultDeps) {
	multiply(mvMatrix, deps.camera.view, objectMatrix);
}
/**
 * Derives a 3x3 normal matrix from a 4x4 transform matrix
 * Normal matrix is the transpose of the inverse of the upper-left 3x3 submatrix
 * @param {mat3} normalMatrix - 3x3 output transformation matrix (column-major)
 * @param {mat4} modelViewMatrix - 4x4 input transformation matrix to derivate (column-major)
 * @returns {mat3} 3x3 normal matrix (column-major)
 */
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
const createMeshMatricesStore = (
	mesh,
	rendererUpdate,
	objectMatrices,
	instances,
	commonMatrices,
	deps = defaultDeps,
) => {
	let value = Array.isArray(objectMatrices) ? reduceTypedArrays(objectMatrices) : objectMatrices;
	const windows = [];
	const modelView = new Float32Array(16 * instances);
	const modelViewWindows = [];
	const normalMatrices = new Float32Array(9 * instances);
	const normalMatricesWindows = [];

	let cameraRevision = deps.camera.revision;
	let buffer;
	let modelViewBuffer;
	let normalMatrixBuffer;

	for (let i = 0; i < instances; ++i) {
		const byteOffsetToMatrix = i * 16 * 4;
		const numFloatsForView = 16;
		windows.push(new Float32Array(value.buffer, byteOffsetToMatrix, numFloatsForView));
		if (commonMatrices && commonMatrices[i]) {
			//commonMatrices[i].registerMatrix(windows[i]);
			windows[i].set(multiply(createZeroMatrix(), commonMatrices[i].value, windows[i]));
		}
		modelViewWindows.push(new Float32Array(modelView.buffer, byteOffsetToMatrix, numFloatsForView));
		normalMatricesWindows.push(new Float32Array(normalMatrices.buffer, i * 9 * 4, 9));
	}

	function updateInstance(matrix, index) {
		if (commonMatrices && commonMatrices[index]) {
			matrix = multiply(createZeroMatrix(), commonMatrices[index].value, matrix);
		}
		setModelViewMatrix(modelViewWindows[index], matrix, deps);
		derivateNormalMatrix(normalMatricesWindows[index], modelViewWindows[index]);
	}

	updateModelViewMatrix();

	function updateModelViewMatrix() {
		windows.forEach((matrix, i) => {
			updateInstance(matrix, i);
		});
	}

	const store = {
		set: (nextMatrix) => {
			value = nextMatrix;
			// TODO: update UBOS
		},
		get value() {
			return value;
		},
		get windows() {
			return windows;
		},
		set buffer(value) {
			buffer = value;
		},
		get buffer() {
			return buffer;
		},
		updateCommonMatrices() {
			if (commonMatrices) {
				commonMatrices.forEach((commonMatrix, index) => {
					store.setInstance(index, windows[index]);
					//windows[index].set(multiply(createZeroMatrix(), commonMatrix.value, windows[index]));
				});
			}
		},
		setInstance(index, nextMatrix) {
			windows[index].set(nextMatrix);
			updateInstance(windows[index], index);
			const program = findProgram(mesh, deps);
			updateInstanceObjectMatrix(program, mesh, modelViewWindows[index], index, modelViewBuffer, deps.ctx);
			updateInstanceNormalMatrix(program, mesh, normalMatricesWindows[index], index, normalMatrixBuffer, deps.ctx);
			deps.ctx.invalidate?.();
		},
		getInstance(index) {
			return windows[index];
		},
		get modelView() {
			if (deps.camera.revision !== cameraRevision) {
				updateModelViewMatrix();
				cameraRevision = deps.camera.revision;
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
			if (deps.camera.revision !== cameraRevision) {
				updateModelViewMatrix();
				cameraRevision = deps.camera.revision;
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
	for (let i = 0; i < instances; ++i) {
		if (commonMatrices && commonMatrices[i]) {
			commonMatrices[i].registerMatrices(store);
		}
	}
	return store;
};

export function createCommonMatrixStore(rendererUpdate, initialValue) {
	const value = initialValue ?? copy(createZeroMatrix(), defaultObjectMatrix);
	function getTypedArray(value) {
		if (value instanceof Float32Array) {
			return value;
		}
		if (Array.isArray(value)) {
			return new Float32Array(value);
		}
		throw new Error("Invalid value type");
	}
	let modelView = getTypedArray(value);
	const meshMatrices = [];
	function updateMatrices() {
		meshMatrices.forEach((meshMatrix) => {
			if ("setInstance" in meshMatrix) {
				meshMatrix.updateCommonMatrices();
			} else {
			}
		});
	}
	const store = {
		set: (nextMatrix) => {
			modelView = getTypedArray(nextMatrix);
			updateMatrices();
			rendererUpdate(get(renderer));
		},
		get value() {
			return modelView;
		},
		registerMatrices: (matrices) => {
			meshMatrices.push(matrices);
		},
		registerMatrix: (matrix) => {
			meshMatrices.push(matrix);
		},
	};
	return store;
}

/**
 *
 * @param {SvelteGLMeshReadyData} value
 * @param {*} symmetry
 * @param {*} symmetryAxis
 * @returns {SvelteGLMesh}
 */
export function create3DObject(value, symmetry = false, symmetryAxis = [0, 0, 0], deps = defaultDeps) {
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
		new3DObject.matrix = createMeshMatrixStore(
			new3DObject,
			deps.renderer.set,
			new3DObject.matrix,
			new3DObject.commonMatrix,
			deps,
		);
	} else if (isSvelteGLInstancedMesh(new3DObject)) {
		// @ts-ignore
		new3DObject.matrices = createMeshMatricesStore(
			new3DObject,
			deps.renderer.set,
			new3DObject.matrices,
			new3DObject.instances,
			new3DObject.commonMatrices,
			deps,
		);
	}
	return new3DObject;
}
