import { templateLiteralRenderer } from "../../shaders/template.js";
import { compileShaders, createProgram, linkProgram, useProgram, validateProgram } from "../../store/gl.js";
import { selectProgram } from "../../store/programs-cache.js";
import linesFragment from "./lines-fragment.glsl";
import linesVertex from "./lines-vertex.glsl";
import sceneShader from "./scene.glsl";

const vertexSource = templateLiteralRenderer(linesVertex, { scene: "" })({ scene: sceneShader });

/**
 * Unit cube edges for gl.LINES: 12 edges, 24 vertices in 0..1.
 * Drawn with offset = box min and scale = box size, so the box follows the bounds through uniforms only.
 */
export const boxEdges = new Float32Array(
	[0, 1, 2].flatMap((axis) =>
		[0, 1, 2, 3].flatMap((corner) => {
			const start = [0, 0, 0];
			start[(axis + 1) % 3] = corner & 1;
			start[(axis + 2) % 3] = corner >> 1;
			const end = [...start];
			end[axis] = 1;
			return [...start, ...end];
		}),
	),
);

/**
 * @typedef {Object} LineStyle read at every draw
 * @property {ArrayLike<number>} color rgb 0..1, written as is
 * @property {ArrayLike<number>} offset data units relative to the scene origin
 * @property {ArrayLike<number>} scale
 */

/**
 * Unlit lines (gl.LINES, one device pixel wide) of a positions buffer in data units, z scaled by zScale.
 * Used as a material program: engine.createMaterial({ program }).
 * @param {() => LineStyle} getStyle
 * @param {ReturnType<typeof import("./scene-uniforms.js").createSceneUniforms>} sceneUniforms
 * @param {import("../../store/app-context").AppContext} ctx engine context, for the program cache
 */
export function createLinesProgram(getStyle, sceneUniforms, ctx) {
	function createShaders(context) {
		compileShaders(context.gl, context.program, vertexSource, linesFragment);
	}

	function setupStyle(context) {
		const { gl, program } = context;
		const { color, offset, scale } = getStyle();
		gl.uniform3fv(gl.getUniformLocation(program, "lineColor"), color);
		gl.uniform3fv(gl.getUniformLocation(program, "lineOffset"), offset);
		gl.uniform3fv(gl.getUniformLocation(program, "lineScale"), scale);
	}

	return {
		createProgram,
		setupProgram: [createShaders, linkProgram, validateProgram],
		setupMaterial: [sceneUniforms.bindBlock],
		useProgram,
		selectProgram: (programStore) => selectProgram(programStore, ctx),
		updateProgram: [sceneUniforms.upload, setupStyle],
	};
}
