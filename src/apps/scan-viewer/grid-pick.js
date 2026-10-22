// Barycentric slack, so a ray through an edge or a vertex still hits one of the triangles sharing it.
const edgeSlack = 1e-9;
// Cell corners [column, row] of the two triangles of a cell, the split of surface.glsl.
const cellTriangles = [
	[
		[0, 0],
		[1, 0],
		[0, 1],
	],
	[
		[1, 0],
		[1, 1],
		[0, 1],
	],
];

/**
 * @typedef {Object} PickGrid
 * @property {number} imageW
 * @property {number} imageH
 * @property {number} x0
 * @property {number} y0
 * @property {number} dx data units per column
 * @property {number} dy data units per row
 * @property {Float32Array} pixels row-major heights, NaN for missing samples
 * @property {{ min: number[], max: number[] }} bounds real data coordinates
 */

/**
 * The ray against the surface of a height grid: two triangles per cell, the split of surface.glsl, the
 * triangles touching a NaN sample skipped. The cells are walked front to back along the ray (2D DDA after
 * clipping the ray to the grid box), so the first cell crossed gives the nearest hit.
 * @param {PickGrid} grid
 * @param {{ origin: number[], direction: number[] }} ray scene space: data axes relative to the scene origin, heights times zScale
 * @param {ArrayLike<number>} sceneOrigin
 * @param {number} zScale
 * @returns {{ t: number, samples: number[], weights: number[] } | null} t along the ray as given; samples are
 * the row-major indices of the triangle corners, weights their barycentric weights
 */
export function pickHeightGrid(grid, ray, sceneOrigin, zScale) {
	const { imageW, imageH, x0, y0, dx, dy, pixels, bounds } = grid;
	if (imageW < 2 || imageH < 2) {
		return null;
	}
	// Grid index space (u along the columns, v along the rows, z the scene height): an affine map of the
	// scene, so t is the same in both.
	const origin = [(ray.origin[0] + sceneOrigin[0] - x0) / dx, (ray.origin[1] + sceneOrigin[1] - y0) / dy, ray.origin[2]];
	const direction = [ray.direction[0] / dx, ray.direction[1] / dy, ray.direction[2]];
	const sceneZ = (h) => (h - sceneOrigin[2]) * zScale;
	const zPadding = 1e-6 * Math.max(1, Math.abs(sceneZ(bounds.max[2]) - sceneZ(bounds.min[2])));
	const span = clipRay(
		origin,
		direction,
		[0, 0, Math.min(sceneZ(bounds.min[2]), sceneZ(bounds.max[2])) - zPadding],
		[imageW - 1, imageH - 1, Math.max(sceneZ(bounds.min[2]), sceneZ(bounds.max[2])) + zPadding],
	);
	if (!span) {
		return null;
	}
	const [tNear, tFar] = span;

	const vertex = (column, row) => {
		const sample = row * imageW + column;
		return [column, row, sceneZ(pixels[sample]), sample];
	};
	function hitCell(column, row) {
		let best = null;
		for (const corners of cellTriangles) {
			const [a, b, c] = corners.map(([i, j]) => vertex(column + i, row + j));
			if (Number.isNaN(a[2]) || Number.isNaN(b[2]) || Number.isNaN(c[2])) {
				continue;
			}
			const hit = intersectTriangle(origin, direction, a, b, c);
			if (hit && (!best || hit.t < best.t)) {
				best = { t: hit.t, samples: [a[3], b[3], c[3]], weights: hit.weights };
			}
		}
		return best;
	}

	const lastColumn = imageW - 2;
	const lastRow = imageH - 2;
	const entry = [origin[0] + direction[0] * tNear, origin[1] + direction[1] * tNear];
	let column = Math.min(lastColumn, Math.max(0, Math.floor(entry[0])));
	let row = Math.min(lastRow, Math.max(0, Math.floor(entry[1])));
	const stepColumn = Math.sign(direction[0]);
	const stepRow = Math.sign(direction[1]);
	// t where the ray crosses the next column and row boundaries, and between two of them.
	const boundary = (cell, step, o, d) => (d === 0 ? Number.POSITIVE_INFINITY : (cell + (step > 0 ? 1 : 0) - o) / d);
	let nextColumnT = boundary(column, stepColumn, origin[0], direction[0]);
	let nextRowT = boundary(row, stepRow, origin[1], direction[1]);
	const columnDeltaT = direction[0] === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / direction[0]);
	const rowDeltaT = direction[1] === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / direction[1]);

	for (;;) {
		const hit = hitCell(column, row);
		if (hit) {
			return hit;
		}
		if (nextColumnT < nextRowT) {
			if (nextColumnT > tFar) return null;
			column += stepColumn;
			nextColumnT += columnDeltaT;
		} else {
			if (nextRowT > tFar) return null;
			row += stepRow;
			nextRowT += rowDeltaT;
		}
		if (column < 0 || column > lastColumn || row < 0 || row > lastRow) {
			return null;
		}
	}
}

// Slabs: the t interval of the ray inside the box, t >= 0, or null.
function clipRay(origin, direction, min, max) {
	let near = 0;
	let far = Number.POSITIVE_INFINITY;
	for (let axis = 0; axis < 3; axis++) {
		if (direction[axis] === 0) {
			if (origin[axis] < min[axis] || origin[axis] > max[axis]) {
				return null;
			}
			continue;
		}
		let t0 = (min[axis] - origin[axis]) / direction[axis];
		let t1 = (max[axis] - origin[axis]) / direction[axis];
		if (t0 > t1) {
			[t0, t1] = [t1, t0];
		}
		near = Math.max(near, t0);
		far = Math.min(far, t1);
		if (near > far) {
			return null;
		}
	}
	return [near, far];
}

// Möller–Trumbore, both faces: the surface can be seen from below.
function intersectTriangle(origin, direction, a, b, c) {
	const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
	const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
	const p = cross(direction, e2);
	const determinant = dot(e1, p);
	if (determinant === 0) {
		return null;
	}
	const inverse = 1 / determinant;
	const s = [origin[0] - a[0], origin[1] - a[1], origin[2] - a[2]];
	const w1 = dot(s, p) * inverse;
	if (w1 < -edgeSlack || w1 > 1 + edgeSlack) {
		return null;
	}
	const q = cross(s, e1);
	const w2 = dot(direction, q) * inverse;
	if (w2 < -edgeSlack || w1 + w2 > 1 + edgeSlack) {
		return null;
	}
	const t = dot(e2, q) * inverse;
	return t < 0 ? null : { t, weights: [1 - w1 - w2, w1, w2] };
}

function cross([ax, ay, az], [bx, by, bz]) {
	return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
}

function dot(a, b) {
	return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
