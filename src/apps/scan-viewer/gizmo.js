import { createCone } from "../../geometries/cone.js";
import { createCylinder } from "../../geometries/cylinder.js";

const segments = 24;
// Arrow of length 1: shaft then cone tip.
const shaftLength = 0.72;

// One arrow along +Y from the origin: a cylinder shaft and a cone tip.
function arrowAlongY() {
	const positions = [];
	const normals = [];
	const append = ({ attributes }, offsetY) => {
		for (let i = 0; i < attributes.positions.length; i += 3) {
			positions.push(attributes.positions[i], attributes.positions[i + 1] + offsetY, attributes.positions[i + 2]);
			normals.push(attributes.normals[i], attributes.normals[i + 1], attributes.normals[i + 2]);
		}
	};
	append(createCylinder(0.04, shaftLength, segments), shaftLength / 2);
	append(createCone(0.1, 1 - shaftLength, segments), shaftLength);
	return { positions, normals };
}

// +Y turned to data X, Y and Z: rotations only, so the triangle winding is kept.
const turns = [([x, y, z]) => [y, -x, z], (point) => point, ([x, y, z]) => [x, -z, y]];

function turned(values, turn) {
	const result = new Float32Array(values.length);
	for (let i = 0; i < values.length; i += 3) {
		result.set(turn([values[i], values[i + 1], values[i + 2]]), i);
	}
	return result;
}

/**
 * Meshes of the three axis arrows, along data X, Y and Z, length 1.
 * @returns {{ attributes: { positions: Float32Array, normals: Float32Array }, drawMode: "TRIANGLES" }[]}
 */
export function createGizmoArrows() {
	const { positions, normals } = arrowAlongY();
	return turns.map((turn) => ({
		attributes: { positions: turned(positions, turn), normals: turned(normals, turn) },
		drawMode: "TRIANGLES",
	}));
}
