import { subtract as subtractVec3, cross as crossVec3, normalize as normalizeVec3 } from "gl-matrix/esm/vec3.js";

export function createVec3() {
	return new Array(3).fill(0);
}

export function multiplyScalarVec3(a, scalar) {
	a[0] *= scalar;
	a[1] *= scalar;
	a[2] *= scalar;
	return a;
}

export function normalizeNormals(normals) {
	for (let i = 0, il = normals.length; i < il; i += 3) {
		const x = normals[i + 0];
		const y = normals[i + 1];
		const z = normals[i + 2];

		const n = 1.0 / Math.sqrt(x * x + y * y + z * z);

		normals[i + 0] *= n;
		normals[i + 1] *= n;
		normals[i + 2] *= n;
	}
}

export function createFlatShadedNormals(positions) {
	const normals = [];
	for (let i = 0; i < positions.length; i += 9) {
		const a = createVec3();
		const b = createVec3();
		const c = createVec3();

		a[0] = positions[i];
		a[1] = positions[i + 1];
		a[2] = positions[i + 2];

		b[0] = positions[i + 3];
		b[1] = positions[i + 4];
		b[2] = positions[i + 5];

		c[0] = positions[i + 6];
		c[1] = positions[i + 7];
		c[2] = positions[i + 8];

		const cb = createVec3();
		subtractVec3(cb, c, b);

		const ab = createVec3();
		subtractVec3(ab, a, b);

		const normal = createVec3();
		crossVec3(normal, cb, ab);
		normalizeVec3(normal, normal);
		// todo, replace with
		normals.push(...normal, ...normal, ...normal);
	}
	return normals;
}

const degree = Math.PI / 180;
/**
 * Convert Degree To Radian
 *
 * @param {Number} a Angle in Degrees
 */

export function toRadian(a) {
	return a * degree;
}

export function showMatrices(matrices, numMatrices) {
	const matricesArray = Array.from(matrices);
	const length = matricesArray.length / numMatrices;
	const res = [];
	for (let i = 0; i < numMatrices; i++) {
		res.push(showMatrix(matricesArray.slice(i * length, (i + 1) * length)));
	}
	return res.join("\n");
}
export function showMatrix(matrix) {
	const matrixArray = Array.from(matrix);
	const matrixString = matrixArray.reduce((acc, val, index) => {
		if (index % 4 === 0) {
			return acc + "\n" + val;
		} else {
			return acc + " " + val;
		}
	}, "");
	return matrixString;
}
