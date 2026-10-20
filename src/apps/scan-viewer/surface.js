import { templateLiteralRenderer } from "../../shaders/template.js";
import { createDataTexture } from "../../texture/data-texture.js";
import surfaceShader from "./surface.glsl";

/**
 * Height surface drawn from gl_VertexID with no vertex attributes: two triangles per grid cell.
 * The heights live in an R32F texture; triangles touching a NaN sample are not drawn.
 * The result is a vertex animation of the default PBR program, like the wobbly animation.
 * @param {import("./scan-viewer").ScanData} data
 * @param {ReturnType<typeof import("./scene-uniforms.js").createSceneUniforms>} sceneUniforms
 */
export function createSurface({ imageW, imageH, x0, y0, x1, y1, distanceData }, sceneUniforms) {
	const heights = createDataTexture({ data: distanceData, width: imageW, height: imageH, uniform: "surfaceHeights" });
	const grid = new Float32Array([x0, y0, (x1 - x0) / (imageW - 1), (y1 - y0) / (imageH - 1)]);

	function setupSurface(ctx) {
		const { gl, program } = ctx;
		gl.uniform4fv(gl.getUniformLocation(program, "surfaceGrid"), grid);
		sceneUniforms.bindBlock(ctx);
	}

	return {
		heights,
		vertexCount: (imageW - 1) * (imageH - 1) * 6,
		animation: {
			type: "vertex",
			shader: templateLiteralRenderer(surfaceShader, { declaration: false, position: false }),
			setupAnimation: setupSurface,
			updateProgram: [heights.setupTexture, heights.bindTexture, sceneUniforms.upload],
		},
	};
}
