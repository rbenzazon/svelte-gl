import { templateLiteralRenderer } from "../../shaders/template.js";
import { setupPaletteColoring } from "./palette.js";
import surfacePaletteShader from "./surface-palette.glsl";

const renderShader = templateLiteralRenderer(surfacePaletteShader, { declaration: false, diffuse: false });

/**
 * Diffuse modifier of the default PBR program: each fragment of the surface takes the palette color at its
 * height, with the color range of the points, and keeps the lighting. Needs the surface vertex animation,
 * which writes vScanHeight.
 * @param {import("./palette.js").PaletteColoring} coloring
 * @returns {SvelteGLDiffuseModifier}
 */
export function createSurfacePalette(coloring) {
	return {
		shader: renderShader,
		updateProgram: [(context) => setupPaletteColoring(context, coloring)],
	};
}
