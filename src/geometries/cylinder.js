import { normalize } from "gl-matrix/esm/vec3.js";
import { getPositionFromPolar } from "./common";
import { drawModes } from "../store/webgl";

export function createCylinder(radius = 1, height = 1, radialSegment = 1, heightSegment = 1) {
	radialSegment = Math.max(radialSegment, 1);
	heightSegment = Math.max(heightSegment, 1);
	const halfHeight = height / 2;
	const angle = (Math.PI * 2) / radialSegment;
	const loopPositions = [];
	const loopNormals = [];
	const loopUVs = [];
	const topNormal = [0, 1, 0];
	const downNormal = [0, -1, 0];
	const positions = [];
	const normals = [];
	const uvs = [];
	const heightIncrement = height / heightSegment;
	const uVRadius = 0.25;
	for (let ir = 0; ir < radialSegment; ir++) {
		const radialAngle = angle * ir;
		const radialNormalAngle = angle * (ir + 0.5);
		const normal = getPositionFromPolar(1, Math.PI / 2, radialAngle);
		const x = Math.cos(radialAngle);
		const z = Math.sin(radialAngle);
		loopPositions.push([x * radius, z * radius]);
		loopNormals.push(normalize(normal, normal));
		loopUVs.push([x * uVRadius, z * uVRadius]);
	}
	//top and bottom caps
	const topUVCenter = [0.25, 0.25];
	const bottomUVCenter = [0.75, 0.25];
	for (let ir = 0; ir < radialSegment; ir++) {
		const nextIndex = (ir + 1) % radialSegment;
		const yTop = halfHeight;
		const yBottom = -halfHeight;

		// Top cap
		positions.push(
			[0, yTop, 0],
			[loopPositions[nextIndex][0], yTop, loopPositions[nextIndex][1]],
			[loopPositions[ir][0], yTop, loopPositions[ir][1]],
		);
		normals.push(topNormal, topNormal, topNormal);
		uvs.push(
			topUVCenter,
			[loopUVs[ir][0] + topUVCenter[0], loopUVs[ir][1] + topUVCenter[1]],
			[loopUVs[nextIndex][0] + topUVCenter[0], loopUVs[nextIndex][1] + topUVCenter[1]],
		);

		// Bottom cap
		positions.push(
			[0, yBottom, 0],
			[loopPositions[ir][0], yBottom, loopPositions[ir][1]],
			[loopPositions[nextIndex][0], yBottom, loopPositions[nextIndex][1]],
		);
		normals.push(downNormal, downNormal, downNormal);
		uvs.push(
			bottomUVCenter,
			[loopUVs[ir][0] + bottomUVCenter[0], loopUVs[ir][1] + bottomUVCenter[1]],
			[loopUVs[nextIndex][0] + bottomUVCenter[0], loopUVs[nextIndex][1] + bottomUVCenter[1]],
		);
	}

	// Side faces
	for (let iy = 0; iy < heightSegment; iy++) {
		const y = halfHeight - iy * heightIncrement;
		const nextY = y - heightIncrement;
		for (let ir = 0; ir < radialSegment; ir++) {
			const nextIndex = (ir + 1) % radialSegment;
			positions.push(
				[loopPositions[ir][0], y, loopPositions[ir][1]],
				[loopPositions[nextIndex][0], y, loopPositions[nextIndex][1]],
				[loopPositions[nextIndex][0], nextY, loopPositions[nextIndex][1]],
				[loopPositions[ir][0], y, loopPositions[ir][1]],
				[loopPositions[nextIndex][0], nextY, loopPositions[nextIndex][1]],
				[loopPositions[ir][0], nextY, loopPositions[ir][1]],
			);
			normals.push(loopNormals[ir], loopNormals[ir], loopNormals[ir], loopNormals[ir], loopNormals[ir], loopNormals[ir]);
			const uvX = 0.5 - ir / radialSegment / 2;
			const uvY = 0.5 + iy / heightSegment / 2;
			const uvXNext = 0.5 - nextIndex / radialSegment / 2;
			const uvYNext = 0.5 + (iy + 1) / heightSegment / 2;
			uvs.push([uvX, uvY], [uvXNext, uvY], [uvXNext, uvYNext], [uvX, uvY], [uvXNext, uvYNext], [uvX, uvYNext]);
		}
	}

	return {
		attributes: {
			positions: new Float32Array(positions.flat()),
			normals: new Float32Array(normals.flat()),
			uvs: new Float32Array(uvs.flat()),
		},
		drawMode: drawModes[4],
	};
}
