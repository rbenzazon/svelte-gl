import { convertToVector3 } from "../../color/color-space.js";
import { templateLiteralRenderer } from "../../shaders/template.js";
import { compileShaders, createProgram, linkProgram, useProgram, validateProgram } from "../../store/gl.js";
import { selectProgram } from "../../store/programs-cache.js";
import heightGridShader from "./height-grid.glsl";
import pointsFragment from "./points-fragment.glsl";
import pointsVertex from "./points-vertex.glsl";

const vertexSource = templateLiteralRenderer(pointsVertex, { heightGrid: "" })({ heightGrid: heightGridShader });

/**
 * Unlit round points, one per height grid sample, drawn with gl.POINTS from gl_VertexID with no vertex attributes.
 * NaN samples are dropped. Used as a material program: engine.createMaterial({ program }).
 * @param {ReturnType<typeof import("./height-grid.js").createHeightGrid>} grid
 * @param {{ color?: import("./scan-viewer").Color, pointSize?: number }} style
 * @param {import("../../store/app-context").AppContext} ctx engine context, for the program cache
 */
export function createPointsProgram(grid, { color = [0.2, 0.45, 0.9], pointSize = 2 }, ctx) {
	const rgb = new Float32Array(convertToVector3(color));

	function createShaders(context) {
		compileShaders(context.gl, context.program, vertexSource, pointsFragment);
	}

	function setupStyle(context) {
		const { gl, program } = context;
		gl.uniform3fv(gl.getUniformLocation(program, "pointColor"), rgb);
		gl.uniform1f(gl.getUniformLocation(program, "pointSize"), pointSize * devicePixelRatio);
	}

	return {
		createProgram,
		setupProgram: [createShaders, linkProgram, validateProgram],
		setupMaterial: [grid.setupGrid],
		useProgram,
		selectProgram: (programStore) => selectProgram(programStore, ctx),
		updateProgram: [...grid.updateProgram, setupStyle],
	};
}
