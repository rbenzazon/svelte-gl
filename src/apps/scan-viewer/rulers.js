import { templateLiteralRenderer } from "../../shaders/template.js";
import { compileShaders, createProgram, linkProgram, useProgram, validateProgram } from "../../store/gl.js";
import { selectProgram } from "../../store/programs-cache.js";
import linesFragment from "./lines-fragment.glsl";
import rulerVertex from "./ruler-vertex.glsl";
import sceneShader from "./scene.glsl";

const vertexSource = templateLiteralRenderer(rulerVertex, { scene: "" })({ scene: sceneShader });

// Ruler length in CSS px at which `density` major steps are used, as GraphView's IDEAL_SIZE.
const idealSize = 700;
// Major tick length, as a fraction of the larger horizontal extent.
const tickLength = 0.03;
const maxTicks = 1000;

/**
 * @typedef {Object} RulerLayout uniforms and labels of one ruler, all positions relative to the scene origin, z unscaled
 * @property {number} vertexCount 0 hides the ruler
 * @property {number[]} from
 * @property {number[]} to
 * @property {number[]} start
 * @property {number[]} step
 * @property {number[]} tick
 * @property {number} firstIndex
 * @property {number} majorEvery
 * @property {import("./labels.js").Label[]} labels
 */

const hidden = { vertexCount: 0, labels: [] };

/**
 * Major and minor steps from the same nice-number rule as GraphView (1, 2, 5 times a power of ten),
 * with fewer steps when the ruler is short on screen.
 */
export function niceSteps(span, axisPx, density) {
	const effectiveDensity = Math.max(2, density * (axisPx / idealSize));
	const rawStep = span / effectiveDensity;
	if (!(rawStep > 0)) {
		return null;
	}
	const magnitude = 10 ** Math.floor(Math.log10(rawStep));
	const normalized = rawStep / magnitude;
	const nice = normalized < 1.5 ? 1 : normalized < 3.5 ? 2 : normalized < 7.5 ? 5 : 10;
	const major = nice * magnitude;
	return { major, minor: major / (nice === 2 ? 4 : 5) };
}

/** Decimals from the step, as GraphView. */
export function formatTick(value, step) {
	const decimals = Math.max(0, -Math.floor(Math.log10(step)));
	return (Math.abs(value) < step * 1e-6 ? 0 : value).toFixed(decimals);
}

/**
 * The three rulers, on the bounding box edges closest to the viewer ("cube axes"), so they never cross the data.
 * X and Y lie on the bottom edges of the near sides; Z on the vertical edge at the side of the box that is
 * outermost on screen. Ticks point out of the box; major ticks get a label pointing away from the box center.
 * @param {{ min: number[], max: number[] }} bounds data units
 * @param {ArrayLike<number>} origin scene origin, double precision
 * @param {ArrayLike<number>} camera camera position in data units
 * @param {(position: ArrayLike<number>) => [number, number] | null} project data units to CSS px
 * @param {number} density
 * @returns {RulerLayout[]} x, y, z
 */
export function layoutRulers({ min, max }, origin, camera, project, density) {
	const center = min.map((value, i) => (value + max[i]) / 2);
	const near = [0, 1].map((i) => (camera[i] < center[i] ? min[i] : max[i]));
	const far = [0, 1].map((i) => (near[i] === min[i] ? max[i] : min[i]));
	const length = tickLength * Math.max(max[0] - min[0], max[1] - min[1]);
	const outward = (i, side) => (side === min[i] ? -length : length);

	const x = layoutRuler(0, [0, near[1], min[2]], [0, outward(1, near[1]), 0]);
	const y = layoutRuler(1, [near[0], 0, min[2]], [outward(0, near[0]), 0, 0]);

	// Of the two vertical edges at the sides (the near corner is in front of the data, the far one behind it),
	// the one farther from the box center on screen.
	const sides = [
		[near[0], far[1]],
		[far[0], near[1]],
	];
	const centerPx = project(center);
	const spread = (corner) => {
		const px = project([corner[0], corner[1], min[2]]);
		return px && centerPx ? Math.abs(px[0] - centerPx[0]) : 0;
	};
	const [cornerX, cornerY] = spread(sides[0]) >= spread(sides[1]) ? sides[0] : sides[1];
	const diagonal = Math.SQRT1_2;
	const z = layoutRuler(2, [cornerX, cornerY, 0], [outward(0, cornerX) * diagonal, outward(1, cornerY) * diagonal, 0]);
	return [x, y, z];

	// The ruler runs along `axis` through `edge` (its own component ignored), ticks along `tick`.
	function layoutRuler(axis, edge, tick) {
		const span = max[axis] - min[axis];
		if (!(span > 0)) {
			return hidden;
		}
		const at = (value) => edge.map((component, i) => (i === axis ? value : component));
		const fromPx = project(at(min[axis]));
		const toPx = project(at(max[axis]));
		const axisPx = fromPx && toPx ? Math.hypot(toPx[0] - fromPx[0], toPx[1] - fromPx[1]) : idealSize;
		const steps = niceSteps(span, axisPx, density);
		if (!steps) {
			return hidden;
		}
		const { major, minor } = steps;
		const firstIndex = Math.ceil(min[axis] / minor - 1e-9);
		const count = Math.min(maxTicks, Math.floor(max[axis] / minor + 1e-9) - firstIndex + 1);
		const majorEvery = Math.round(major / minor);
		const relative = (position) => position.map((value, i) => value - origin[i]);
		const direction = [0, 0, 0];
		direction[axis] = minor;

		const labels = [];
		for (let i = 0; i < count; i++) {
			const index = firstIndex + i;
			if (index % majorEvery !== 0) {
				continue;
			}
			const value = index * minor;
			const end = at(value).map((component, j) => component + tick[j]);
			labels.push({
				id: `ruler-${axis}-${index / majorEvery}`,
				text: formatTick(value, major),
				position: end,
				align: "auto",
				baseline: "auto",
				outwardFrom: center,
				distance: 4,
			});
		}
		return {
			vertexCount: count > 0 ? 2 + count * 2 : 0,
			from: relative(at(min[axis])),
			to: relative(at(max[axis])),
			start: relative(at(firstIndex * minor)),
			step: direction,
			tick,
			firstIndex: ((firstIndex % majorEvery) + majorEvery) % majorEvery,
			majorEvery,
			labels,
		};
	}
}

/**
 * One ruler drawn with gl.LINES from gl_VertexID, no vertex attribute: the axis line then the ticks.
 * The layout and the color are read at every draw, so a new layout only needs the mesh vertexCount.
 * @param {() => { layout: RulerLayout, color: ArrayLike<number> }} getRuler
 * @param {ReturnType<typeof import("./scene-uniforms.js").createSceneUniforms>} sceneUniforms
 * @param {import("../../store/app-context").AppContext} ctx engine context, for the program cache
 */
export function createRulerProgram(getRuler, sceneUniforms, ctx) {
	function createShaders(context) {
		compileShaders(context.gl, context.program, vertexSource, linesFragment);
	}

	function setupRuler(context) {
		const { gl, program } = context;
		const { layout, color } = getRuler();
		if (layout.vertexCount === 0) {
			return;
		}
		const location = (name) => gl.getUniformLocation(program, name);
		gl.uniform3fv(location("lineColor"), color);
		gl.uniform3fv(location("rulerFrom"), layout.from);
		gl.uniform3fv(location("rulerTo"), layout.to);
		gl.uniform3fv(location("rulerStart"), layout.start);
		gl.uniform3fv(location("rulerStep"), layout.step);
		gl.uniform3fv(location("rulerTick"), layout.tick);
		gl.uniform1i(location("rulerFirstIndex"), layout.firstIndex);
		gl.uniform1i(location("rulerMajorEvery"), layout.majorEvery);
	}

	return {
		createProgram,
		setupProgram: [createShaders, linkProgram, validateProgram],
		setupMaterial: [sceneUniforms.bindBlock],
		useProgram,
		selectProgram: (programStore) => selectProgram(programStore, ctx),
		updateProgram: [sceneUniforms.upload, setupRuler],
	};
}
