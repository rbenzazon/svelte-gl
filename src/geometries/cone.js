import { normalize, add, lerp } from "gl-matrix/esm/vec3.js";

export function createCone(radius = 1, height = 1, radialSegment = 3, heightSegment = 1) {
	radialSegment = Math.max(radialSegment, 3);
	heightSegment = Math.max(heightSegment, 1);
	const positions = [];
	const normals = [];
	const uvs = [];

	const heightIncrement = height / heightSegment;
	let iy = 1;
	const slope = radius / height;
	const loopPositions = [];
	const apexLoopNormals = [];

	const angle = (Math.PI * 2) / radialSegment;
	for (let ir = 0; ir < radialSegment; ir++) {
		const radialAngle = angle * ir;
		const sinRadial = Math.sin(radialAngle);
		const cosRadial = Math.cos(radialAngle);
		loopPositions.push([Math.cos(radialAngle) * radius, height - heightIncrement * iy, Math.sin(radialAngle) * radius]);
		const normal = [sinRadial, slope, cosRadial];
		apexLoopNormals.push(normalize(normal, normal));
	}

	const downNormal = [0, -1, 0];
	for (let ir = 0; ir < radialSegment; ir++) {
		const nextIndex = ir === radialSegment - 1 ? 0 : ir + 1;
		positions.push([0, height, 0], loopPositions[nextIndex], loopPositions[ir]);
		// 0,0,0 at the apex is a "hack" to have a smooth shading
		normals.push([0, 0, 0], apexLoopNormals[nextIndex], apexLoopNormals[ir]);
		const unsafeNextIndex = ir + 1;
		const uvX = 1 - ir / radialSegment;
		const uvXNext = 1 - unsafeNextIndex / radialSegment;
		uvs.push([0, 0], [uvXNext, (heightIncrement * iy) / height], [uvX, (heightIncrement * iy) / height]);

		positions.push([0, 0, 0], loopPositions[ir], loopPositions[nextIndex]);
		normals.push(downNormal, downNormal, downNormal);
		uvs.push([0, 0], [1 - uvX, 1], [1 - uvXNext, 1]);
	}
	return {
		positions: new Float32Array(positions.flatMap((p) => p)),
		normals: new Float32Array(normals.flatMap((p) => p)),
		uvs: new Float32Array(uvs.flatMap((p) => p)),
	};
}
