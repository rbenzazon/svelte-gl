import { L as drawModes } from './Menu-Y5DXEdjv.js';

function createPlane(
	width = 1,
	depth = 1,
	widthSegments = 1,
	depthSegments = 1,
	clockwise = false,
	generateColors = false,
) {
	const positions = [];
	const normals = [];
	const uvs = [];
	const indices = [];
	const halfWidth = width / 2;
	const halfDepth = depth / 2;
	const segmentWidth = width / widthSegments;
	const segmentDepth = depth / depthSegments;
	const gridX = widthSegments + 1;
	const gridZ = depthSegments + 1;
	for (let iz = 0; iz < gridZ; iz++) {
		const z = iz * segmentDepth - halfDepth;
		for (let ix = 0; ix < gridX; ix++) {
			const x = ix * segmentWidth - halfWidth;
			positions.push(x, 0, -z);
			normals.push(0, 1, 0);
			uvs.push(ix / widthSegments, 1 - iz / depthSegments);
		}
	}
	for (let iz = 0; iz < depthSegments; iz++) {
		for (let ix = 0; ix < widthSegments; ix++) {
			const a = ix + gridX * iz;
			const b = ix + gridX * (iz + 1);
			const c = ix + 1 + gridX * (iz + 1);
			const d = ix + 1 + gridX * iz;
			if (clockwise) {
				indices.push(a, b, d);
				indices.push(b, c, d);
			} else {
				indices.push(a, d, b);
				indices.push(b, d, c);
			}
		}
	}
	return {
		attributes: {
			positions: new Float32Array(positions),
			normals: new Float32Array(normals),
			uvs: new Float32Array(uvs),
			elements: new Uint16Array(indices),
			...(generateColors ? { colors: new Float32Array(positions.map((_, i) => (i % 3 === 0 ? 1 : 1))) } : {}),
		},
		drawMode: drawModes[4],
	};
}

export { createPlane as c };
