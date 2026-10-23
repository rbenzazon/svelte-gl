import { convertToVector3 } from "../../color/color-space.js";
import { createSpecular } from "../../material/specular/specular.js";
import { templateLiteralRenderer } from "../../shaders/template.js";
import heightGridShader from "./height-grid.glsl";
import sceneShader from "./scene.glsl";
import surfaceShader from "./surface.glsl";

const renderSurfaceShader = templateLiteralRenderer(surfaceShader, { declaration: false, position: false });

/**
 * Metallic/roughness material props for the default PBR program. Defaults to a neutral light grey, non-metallic;
 * with the palette, the base color tints it and defaults to white. Double-sided, so the surface is also seen from below.
 * @param {import("./scan-viewer").ScanViewerMaterial} [material]
 * @param {SvelteGLDiffuseModifier} [palette] from createSurfacePalette
 */
export function createSurfaceMaterial({ baseColor, metallic = 0, roughness = 0.5 } = {}, palette) {
	return {
		diffuse: convertToVector3(baseColor ?? (palette ? [1, 1, 1] : [1, 0.1, 0.1])),
		...(palette && { diffuseModifier: palette }),
		metalness: metallic,
		specular: createSpecular({ roughness }),
		doubleSided: true,
	};
}

/**
 * Height surface drawn from gl_VertexID with no vertex attributes: two triangles per grid cell.
 * Triangles touching a NaN sample are not drawn.
 * The result is a vertex animation of the default PBR program, like the wobbly animation.
 * @param {ReturnType<typeof import("./height-grid.js").createHeightGrid>} grid
 */
export function createSurface(grid) {
	return {
		vertexCount: (grid.imageW - 1) * (grid.imageH - 1) * 6,
		animation: {
			type: "vertex",
			shader: (props) => (props.declaration ? sceneShader + heightGridShader : "") + renderSurfaceShader(props),
			setupAnimation: grid.setup,
			updateProgram: grid.updateProgram,
		},
	};
}
