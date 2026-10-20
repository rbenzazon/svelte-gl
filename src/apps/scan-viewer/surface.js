import { convertToVector3 } from "../../color/color-space.js";
import { createSpecular } from "../../material/specular/specular.js";
import { templateLiteralRenderer } from "../../shaders/template.js";
import heightGridShader from "./height-grid.glsl";
import surfaceShader from "./surface.glsl";

const renderSurfaceShader = templateLiteralRenderer(surfaceShader, { declaration: false, position: false });

/**
 * Metallic/roughness material props for the default PBR program. Defaults to a neutral light grey, non-metallic.
 * @param {import("./scan-viewer").ScanViewerMaterial} [material]
 */
export function createSurfaceMaterial({ baseColor = [0.8, 0.8, 0.8], metallic = 0, roughness = 0.5 } = {}) {
	return {
		diffuse: convertToVector3(baseColor),
		metalness: metallic,
		specular: createSpecular({ roughness }),
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
			shader: (props) => (props.declaration ? heightGridShader : "") + renderSurfaceShader(props),
			setupAnimation: grid.setupGrid,
			updateProgram: grid.updateProgram,
		},
	};
}
