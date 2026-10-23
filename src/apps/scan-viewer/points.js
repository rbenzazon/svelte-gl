import { convertToVector3 } from "../../color/color-space.js";
import { templateLiteralRenderer } from "../../shaders/template.js";
import { compileShaders, createProgram, linkProgram, useProgram, validateProgram } from "../../store/gl.js";
import { selectProgram } from "../../store/programs-cache.js";
import heightGridShader from "./height-grid.glsl";
import { setupPaletteColoring } from "./palette.js";
import pointsFragment from "./points-fragment.glsl";
import pointsVertex from "./points-vertex.glsl";
import sceneShader from "./scene.glsl";

const renderVertex = templateLiteralRenderer(pointsVertex, { palette: false, cloud: false, declarations: "" });

/**
 * @typedef {ReturnType<typeof import("./height-grid.js").createHeightGrid> | ReturnType<typeof import("./point-cloud.js").createPointCloud>} PointsSource
 */

/**
 * Unlit round points drawn with gl.POINTS. A height grid gives one point per sample from gl_VertexID with no
 * vertex attributes; a cloud reads the mesh positions. NaN points are dropped.
 * Used as a material program: engine.createMaterial({ program }).
 * @param {PointsSource} source
 * @param {{ colorMode?: "palette" | "solid", color?: import("./scan-viewer").Color, pointSize?: number }} style
 * @param {import("./palette.js").PaletteColoring} coloring
 * @param {import("../../store/app-context").AppContext} ctx engine context, for the program cache
 */
export function createPointsProgram(
	source,
	{ colorMode = "palette", color = [0.2, 0.45, 0.9], pointSize = 2 },
	coloring,
	ctx,
) {
	const usePalette = colorMode === "palette";
	const rgb = new Float32Array(convertToVector3(color));

	function createShaders(context) {
		const vertexSource = renderVertex({
			palette: usePalette,
			cloud: source.cloud,
			declarations: source.cloud ? sceneShader : sceneShader + heightGridShader,
		});
		compileShaders(context.gl, context.program, vertexSource, pointsFragment);
	}

	function setupStyle(context) {
		const { gl, program } = context;
		gl.uniform1f(gl.getUniformLocation(program, "pointSize"), pointSize * devicePixelRatio);
		if (usePalette) {
			setupPaletteColoring(context, coloring);
		} else {
			gl.uniform3fv(gl.getUniformLocation(program, "pointColor"), rgb);
		}
	}

	return {
		createProgram,
		setupProgram: [createShaders, linkProgram, validateProgram],
		setupMaterial: [source.setup],
		useProgram,
		selectProgram: (programStore) => selectProgram(programStore, ctx),
		updateProgram: [...source.updateProgram, setupStyle, enableCoverage],
		postDraw: restoreCoverage,
	};
}

// Smooth point edges through the canvas multisampling, without blending or sorting.
function enableCoverage({ gl }) {
	gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE);
}

// Alpha-to-coverage also writes the edge alpha into the canvas, where the page would show through: back to opaque.
function restoreCoverage({ gl }) {
	gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
	gl.colorMask(false, false, false, true);
	gl.clearColor(0, 0, 0, 1);
	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.colorMask(true, true, true, true);
}
