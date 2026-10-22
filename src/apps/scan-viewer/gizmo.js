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

// CSS px. The shaft is about 1.5 px wide in the corner: the reach around it makes it a usable target.
const shaftReach = 6;
const labelReach = 9;
// Where the three arrows meet, no shaft is hit; an arrow pointing at the camera stays reachable by its label.
const deadZone = 5;
// Hits closer than this to each other go to the arrow drawn in front.
const tieMargin = 2;

/**
 * @typedef {Object} GizmoScreenPoints viewer CSS px from the top left
 * @property {number[]} origin
 * @property {{ tip: number[], label: number[], facing: number }[]} axes X, Y, Z; facing is the axis component
 * of the unit direction toward the camera (1 when the arrow points at it)
 */

/**
 * The axis under the pointer, from the projected arrows: 0, 1 or 2 for X, Y or Z, or null.
 * @param {GizmoScreenPoints} points
 * @param {number[]} rect [left, top, width, height] of the gizmo, viewer CSS px from the top left
 * @param {number[]} pointer viewer CSS px from the top left
 * @returns {number | null}
 */
export function hitGizmo({ origin, axes }, [left, top, width, height], pointer) {
	const [x, y] = pointer;
	if (x < left - labelReach || x > left + width + labelReach || y < top - labelReach || y > top + height + labelReach) {
		return null;
	}
	const nearOrigin = distance(pointer, origin) < deadZone;
	let hit = null;
	axes.forEach(({ tip, label, facing }, axis) => {
		const toShaft = nearOrigin ? Infinity : segmentDistance(pointer, origin, tip);
		const toLabel = distance(pointer, label);
		if (toShaft > shaftReach && toLabel > labelReach) {
			return;
		}
		const score = Math.min(toShaft, toLabel);
		const better =
			!hit || score < hit.score - tieMargin || (Math.abs(score - hit.score) <= tieMargin && facing > hit.facing);
		if (better) {
			hit = { axis, score, facing };
		}
	});
	return hit?.axis ?? null;
}

function distance([ax, ay], [bx, by]) {
	return Math.hypot(ax - bx, ay - by);
}

function segmentDistance(point, [ax, ay], [bx, by]) {
	const dx = bx - ax;
	const dy = by - ay;
	const lengthSquared = dx * dx + dy * dy;
	const t = lengthSquared ? Math.max(0, Math.min(1, ((point[0] - ax) * dx + (point[1] - ay) * dy) / lengthSquared)) : 0;
	return distance(point, [ax + t * dx, ay + t * dy]);
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
