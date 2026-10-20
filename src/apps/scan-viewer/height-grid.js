import { createDataTexture } from "../../texture/data-texture.js";

/**
 * Height grid uploaded once to an R32F texture and shared by the surface and points programs of the same data.
 * setupGrid and updateProgram are pipeline steps for any program including height-grid.glsl.
 * @param {import("./scan-viewer").ScanData} data
 * @param {ReturnType<typeof import("./scene-uniforms.js").createSceneUniforms>} sceneUniforms
 */
export function createHeightGrid({ imageW, imageH, x0, y0, x1, y1, distanceData }, sceneUniforms) {
	const heights = createDataTexture({ data: distanceData, width: imageW, height: imageH, uniform: "heightTexture" });
	const grid = new Float32Array([x0, y0, (x1 - x0) / (imageW - 1), (y1 - y0) / (imageH - 1)]);

	function setupGrid(ctx) {
		const { gl, program } = ctx;
		gl.uniform4fv(gl.getUniformLocation(program, "heightGrid"), grid);
		sceneUniforms.bindBlock(ctx);
	}

	return {
		imageW,
		imageH,
		heights,
		setupGrid,
		updateProgram: [heights.setupTexture, heights.bindTexture, sceneUniforms.upload],
	};
}
