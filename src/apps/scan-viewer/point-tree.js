/**
 * Balanced 2D tree over the scan plane of an unorganized cloud, for picking.
 * Nodes split only in x or y (the longer side of their cell) at the median point, so the tree is complete
 * and implicit: node i has children 2i + 1 and 2i + 2, and the nodes of a level split `indices` evenly.
 * Each node keeps the height range of its points, so rays above or below the data skip it.
 * Coordinates are the cloud's own (xyz as given, origin not added); NaN points are left out.
 *
 * @typedef {Object} PointTree
 * @property {Uint32Array} indices point indices, reordered so each node covers a contiguous range
 * @property {Uint8Array} axes split axis of each internal node, 0 = x, 1 = y
 * @property {Float32Array} splits split value of each internal node
 * @property {Float32Array} heights min and max height of each node, interleaved
 * @property {number[]} min bounds of the points
 * @property {number[]} max
 * @property {number} spacing average distance between neighbor points in the scan plane
 */

const leafSize = 32;
// Picking, in point spacings: points within this distance of the ray make the local meshes.
const neighborhood = 2.5;
// A mesh triangle with a longer edge (scan plane) spans a hole or a concave border: no surface there.
const maxEdge = 3;
// Points per local mesh along the ray; consecutive meshes overlap by half.
const maxMeshPoints = 64;

/**
 * @param {Float32Array} xyz interleaved
 * @returns {PointTree}
 */
export function buildPointTree(xyz) {
	const all = xyz.length / 3;
	const valid = new Uint32Array(all);
	let count = 0;
	const min = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
	const max = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
	for (let i = 0; i < all; i++) {
		const point = [xyz[i * 3], xyz[i * 3 + 1], xyz[i * 3 + 2]];
		if (point.some(Number.isNaN)) {
			continue;
		}
		valid[count++] = i;
		for (let axis = 0; axis < 3; axis++) {
			min[axis] = Math.min(min[axis], point[axis]);
			max[axis] = Math.max(max[axis], point[axis]);
		}
	}
	const indices = valid.slice(0, count);
	const levels = count > leafSize ? Math.ceil(Math.log2(count / leafSize)) : 0;
	const internal = 2 ** levels - 1;
	const nodes = 2 ** (levels + 1) - 1;
	const axes = new Uint8Array(internal);
	const splits = new Float32Array(internal);
	const heights = new Float32Array(nodes * 2);

	// Top down: split each cell across its longer side, at the median.
	const cells = [[min[0], min[1], max[0], max[1]]];
	for (let node = 0; node < internal; node++) {
		const [x0, y0, x1, y1] = cells[node];
		const axis = x1 - x0 >= y1 - y0 ? 0 : 1;
		const [lo, hi] = nodeRange(node, count);
		const mid = nodeRange(node * 2 + 1, count)[1];
		select(indices, xyz, axis, lo, hi - 1, mid);
		const split = mid < hi ? xyz[indices[mid] * 3 + axis] : axis === 0 ? x1 : y1;
		axes[node] = axis;
		splits[node] = split;
		cells[node * 2 + 1] = axis === 0 ? [x0, y0, split, y1] : [x0, y0, x1, split];
		cells[node * 2 + 2] = axis === 0 ? [split, y0, x1, y1] : [x0, split, x1, y1];
	}

	// Bottom up: height range of the leaves from their points, then of each parent from its children.
	for (let node = internal; node < nodes; node++) {
		const [lo, hi] = nodeRange(node, count);
		let zMin = Number.POSITIVE_INFINITY;
		let zMax = Number.NEGATIVE_INFINITY;
		for (let i = lo; i < hi; i++) {
			const z = xyz[indices[i] * 3 + 2];
			zMin = Math.min(zMin, z);
			zMax = Math.max(zMax, z);
		}
		heights[node * 2] = zMin;
		heights[node * 2 + 1] = zMax;
	}
	for (let node = internal - 1; node >= 0; node--) {
		const left = node * 2 + 1;
		heights[node * 2] = Math.min(heights[left * 2], heights[left * 2 + 2]);
		heights[node * 2 + 1] = Math.max(heights[left * 2 + 1], heights[left * 2 + 3]);
	}

	// Scan data covers its bounds about evenly; a cloud in a line falls back to its length.
	const width = max[0] - min[0];
	const depth = max[1] - min[1];
	const spacing = count > 1 ? Math.sqrt((width * depth) / count) || Math.max(width, depth) / count || 1 : 1;
	return { indices, axes, splits, heights, min, max, spacing };
}

/**
 * @typedef {Object} PickRay in the displayed space of the cloud: cloud coordinates with heights times zScale
 * @property {number[]} origin
 * @property {number[]} direction unit length
 * @property {number} zScale
 */

/**
 * @typedef {Object} PointHit
 * @property {number} t distance along the ray
 * @property {number[]} indices the 3 points of the mesh triangle under the cursor
 * @property {number[]} weights barycentric weights of the hit in that triangle, over the scan plane
 */

/**
 * The surface under the cursor, from local meshes of the cloud: the points within a few point spacings of the
 * ray, taken front to back along it in overlapping windows, are triangulated over the scan plane (Delaunay); the
 * hit is the nearest crossing of the ray with the triangles of the first window it crosses. So a ray passing just
 * above a ridge in front still meets the surface behind it. The search is in data units, independent of the zoom.
 * Null past the edge of the cloud (the ray crosses no triangle). Triangles with an edge longer than `maxEdge`
 * spacings span a hole or a concave border and are skipped, so a ray through a hole can meet the surface behind.
 * @param {PointTree} tree
 * @param {Float32Array} xyz
 * @param {PickRay} ray
 * @returns {PointHit | null}
 */
export function pickPointTree(tree, xyz, ray) {
	if (tree.indices.length < 3) {
		return null;
	}
	const near = nearRay(tree, xyz, ray, neighborhood * tree.spacing).sort((a, b) => a.t - b.t);
	const longest = maxEdge * tree.spacing;
	for (let start = 0; start + 3 <= near.length; start += maxMeshPoints / 2) {
		const hit = meshHit(xyz, ray, near.slice(start, start + maxMeshPoints), longest);
		if (hit || start + maxMeshPoints >= near.length) {
			return hit;
		}
	}
	return null;
}

// Nearest crossing of the ray with the Delaunay mesh of these points, skipping triangles over gaps.
function meshHit(xyz, ray, points, longest) {
	// Without duplicate positions, and relative to the first point for precision.
	const seen = new Set();
	const meshIndices = [];
	for (const { index } of points) {
		const key = `${xyz[index * 3]},${xyz[index * 3 + 1]}`;
		if (!seen.has(key)) {
			seen.add(key);
			meshIndices.push(index);
		}
	}
	if (meshIndices.length < 3) {
		return null;
	}
	const base = [xyz[meshIndices[0] * 3], xyz[meshIndices[0] * 3 + 1]];
	const meshPoints = meshIndices.map((index) => [xyz[index * 3] - base[0], xyz[index * 3 + 1] - base[1]]);
	let best = null;
	for (const corners of triangulate(meshPoints)) {
		const spansGap = [0, 1, 2].some((k) => {
			const [ax, ay] = meshPoints[corners[k]];
			const [bx, by] = meshPoints[corners[(k + 1) % 3]];
			return Math.hypot(bx - ax, by - ay) > longest;
		});
		if (spansGap) {
			continue;
		}
		const hit = crossTriangle(
			xyz,
			ray,
			corners.map((corner) => meshIndices[corner]),
		);
		if (hit && (!best || hit.t < best.t)) {
			best = hit;
		}
	}
	return best;
}

/**
 * Delaunay triangulation (Bowyer-Watson) of a few 2D points: each point removes the triangles whose
 * circumcircle contains it and fills the cavity with triangles to it.
 * @param {number[][]} points
 * @returns {number[][]} triangles as point indices
 */
function triangulate(points) {
	const n = points.length;
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	for (const [x, y] of points) {
		minX = Math.min(minX, x);
		minY = Math.min(minY, y);
		maxX = Math.max(maxX, x);
		maxY = Math.max(maxY, y);
	}
	const span = Math.max(maxX - minX, maxY - minY) || 1;
	const cx = (minX + maxX) / 2;
	const cy = (minY + maxY) / 2;
	// A triangle far larger than the points, removed at the end.
	const vertices = [...points, [cx - 20 * span, cy - span], [cx, cy + 20 * span], [cx + 20 * span, cy - span]];
	let triangles = [circumcircle(vertices, n, n + 1, n + 2)];
	for (let i = 0; i < n; i++) {
		const [px, py] = vertices[i];
		const edges = [];
		triangles = triangles.filter((triangle) => {
			if ((px - triangle.x) ** 2 + (py - triangle.y) ** 2 < triangle.r2) {
				edges.push([triangle.a, triangle.b], [triangle.b, triangle.c], [triangle.c, triangle.a]);
				return false;
			}
			return true;
		});
		// The cavity outline: edges of a single removed triangle.
		for (let e = 0; e < edges.length; e++) {
			const [a, b] = edges[e];
			const shared = edges.some(([c, d], f) => f !== e && ((c === a && d === b) || (c === b && d === a)));
			if (!shared) {
				triangles.push(circumcircle(vertices, a, b, i));
			}
		}
	}
	return triangles.filter(({ a, b, c }) => a < n && b < n && c < n).map(({ a, b, c }) => [a, b, c]);
}

function circumcircle(vertices, a, b, c) {
	const [ax, ay] = vertices[a];
	const [bx, by] = vertices[b];
	const [cx, cy] = vertices[c];
	const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
	if (Math.abs(d) < 1e-18) {
		// Points in a line: a circle containing everything, so the next point replaces this triangle.
		return { a, b, c, x: 0, y: 0, r2: Number.POSITIVE_INFINITY };
	}
	const a2 = ax * ax + ay * ay;
	const b2 = bx * bx + by * by;
	const c2 = cx * cx + cy * cy;
	const x = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d;
	const y = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;
	return { a, b, c, x, y, r2: (ax - x) ** 2 + (ay - y) ** 2 };
}

/**
 * Ray against the triangle of 3 points (displayed space): where the ray crosses its plane, if that falls inside
 * it over the scan plane.
 * @returns {PointHit | null}
 */
function crossTriangle(xyz, { origin, direction, zScale }, indices) {
	const [a, b, c] = indices.map((index) => [xyz[index * 3], xyz[index * 3 + 1], xyz[index * 3 + 2] * zScale]);
	const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
	const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
	const normal = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
	const area = ab[0] * ac[1] - ab[1] * ac[0];
	const facing = normal[0] * direction[0] + normal[1] * direction[1] + normal[2] * direction[2];
	// Points in a line over the scan plane, or a ray running along the triangle plane.
	if (Math.abs(area) < 1e-12 || Math.abs(facing) < 1e-12 * Math.hypot(...normal)) {
		return null;
	}
	const t = (normal[0] * (a[0] - origin[0]) + normal[1] * (a[1] - origin[1]) + normal[2] * (a[2] - origin[2])) / facing;
	if (t <= 0) {
		return null;
	}
	const px = origin[0] + direction[0] * t - a[0];
	const py = origin[1] + direction[1] * t - a[1];
	const wb = (px * ac[1] - py * ac[0]) / area;
	const wc = (ab[0] * py - ab[1] * px) / area;
	const weights = [1 - wb - wc, wb, wc];
	return weights.every((weight) => weight >= -1e-9) ? { t, indices, weights } : null;
}

/**
 * The points within `radius` (data units, displayed space) of the ray, with their distance `t` along it.
 * Nodes the ray passes above or below (by more than the radius) are skipped.
 */
function nearRay(tree, xyz, ray, radius) {
	const { origin, direction, zScale } = ray;
	const internal = tree.axes.length;
	const candidates = [];

	const [t0, t1] = clipToBounds(tree, ray, radius);
	if (t0 <= t1) {
		visit(0, t0, t1);
	}
	return candidates;

	function visit(node, from, end) {
		if (from > end) {
			return;
		}
		// Ray height over the interval against the node heights, widened by the radius.
		const zFrom = origin[2] + direction[2] * from;
		const zTo = origin[2] + direction[2] * end;
		if (
			Math.max(zFrom, zTo) < tree.heights[node * 2] * zScale - radius ||
			Math.min(zFrom, zTo) > tree.heights[node * 2 + 1] * zScale + radius
		) {
			return;
		}
		if (node >= internal) {
			testLeaf(node);
			return;
		}
		const axis = tree.axes[node];
		const split = tree.splits[node];
		const o = origin[axis];
		const d = direction[axis];
		const left = node * 2 + 1;
		const right = left + 1;
		const nearIsLeft = o + d * from < split || (o + d * from === split && d < 0);
		const [near, far] = nearIsLeft ? [left, right] : [right, left];
		// Parallel to the split line: the far side only when the ray runs within the radius of it.
		if (Math.abs(d) < 1e-12) {
			visit(near, from, end);
			if (Math.abs(o - split) <= radius) {
				visit(far, from, end);
			}
			return;
		}
		// Signed distance of the ray into the far side: f(t) = a + b t. The near side is visited while
		// f(t) <= radius, the far side while f(t) >= -radius.
		const side = nearIsLeft ? 1 : -1;
		const a = (o - split) * side;
		const b = d * side;
		if (b > 0) {
			visit(near, from, Math.min(end, (radius - a) / b));
			visit(far, Math.max(from, (-radius - a) / b), end);
		} else {
			visit(near, from, end);
			visit(far, from, Math.min(end, (-radius - a) / b));
		}
	}

	function testLeaf(node) {
		const [lo, hi] = nodeRange(node, tree.indices.length);
		for (let i = lo; i < hi; i++) {
			const index = tree.indices[i];
			const vx = xyz[index * 3] - origin[0];
			const vy = xyz[index * 3 + 1] - origin[1];
			const vz = xyz[index * 3 + 2] * zScale - origin[2];
			const t = vx * direction[0] + vy * direction[1] + vz * direction[2];
			if (t <= 0) {
				continue;
			}
			const distance = Math.sqrt(Math.max(0, vx * vx + vy * vy + vz * vz - t * t));
			if (distance <= radius) {
				candidates.push({ index, t });
			}
		}
	}
}

// Ray interval inside the cloud bounds widened by the margin.
function clipToBounds(tree, { origin, direction, zScale }, margin) {
	const lo = [tree.min[0], tree.min[1], tree.min[2] * zScale];
	const hi = [tree.max[0], tree.max[1], tree.max[2] * zScale];
	let t0 = 0;
	let t1 = Number.POSITIVE_INFINITY;
	for (let axis = 0; axis < 3; axis++) {
		const a = lo[axis] - margin;
		const b = hi[axis] + margin;
		if (Math.abs(direction[axis]) < 1e-12) {
			if (origin[axis] < a || origin[axis] > b) {
				return [1, 0];
			}
			continue;
		}
		const ta = (a - origin[axis]) / direction[axis];
		const tb = (b - origin[axis]) / direction[axis];
		t0 = Math.max(t0, Math.min(ta, tb));
		t1 = Math.min(t1, Math.max(ta, tb));
	}
	return [t0, t1];
}

// Positions [start, end) of `indices` covered by a node.
function nodeRange(node, count) {
	const level = Math.floor(Math.log2(node + 1));
	const slices = 2 ** level;
	const j = node - (slices - 1);
	return [Math.floor((j * count) / slices), Math.floor(((j + 1) * count) / slices)];
}

// Hoare quickselect: puts the point of rank k (by coordinate `axis`) at position k, smaller ones before it.
function select(indices, xyz, axis, left, right, k) {
	let lo = left;
	let hi = right;
	while (hi > lo) {
		const pivot = xyz[indices[(lo + hi) >> 1] * 3 + axis];
		let i = lo;
		let j = hi;
		while (i <= j) {
			while (xyz[indices[i] * 3 + axis] < pivot) i++;
			while (xyz[indices[j] * 3 + axis] > pivot) j--;
			if (i <= j) {
				const swap = indices[i];
				indices[i] = indices[j];
				indices[j] = swap;
				i++;
				j--;
			}
		}
		if (k <= j) {
			hi = j;
		} else if (k >= i) {
			lo = i;
		} else {
			return;
		}
	}
}
