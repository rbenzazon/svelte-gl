import { createDataTexture } from "../../texture/data-texture.js";

/**
 * Height grid uploaded once to an R32F texture and shared by the surface and points programs of the same data.
 * setup and updateProgram are pipeline steps for any program including scene.glsl and height-grid.glsl.
 * @param {import("./scan-viewer").ScanData} data
 * @param {ReturnType<typeof import("./scene-uniforms.js").createSceneUniforms>} sceneUniforms
 */
export function createHeightGrid({ imageW, imageH, x0, y0, x1, y1, distanceData }, sceneUniforms) {
	const heights = createDataTexture({ data: distanceData, width: imageW, height: imageH, uniform: "heightTexture" });
	const grid = new Float32Array([x0, y0, (x1 - x0) / (imageW - 1), (y1 - y0) / (imageH - 1)]);

	function setup(ctx) {
		const { gl, program } = ctx;
		gl.uniform4fv(gl.getUniformLocation(program, "heightGrid"), grid);
		sceneUniforms.bindBlock(ctx);
	}

	// Real data coordinates, NaN heights ignored.
	function computeBounds(pixels) {
		let zMin = Number.POSITIVE_INFINITY;
		let zMax = Number.NEGATIVE_INFINITY;
		for (const z of pixels) {
			if (z < zMin) zMin = z;
			if (z > zMax) zMax = z;
		}
		return { min: [Math.min(x0, x1), Math.min(y0, y1), zMin], max: [Math.max(x0, x1), Math.max(y0, y1), zMax] };
	}

	const heightGrid = {
		cloud: false,
		imageW,
		imageH,
		pointCount: imageW * imageH,
		bounds: computeBounds(distanceData),
		setup,
		updateProgram: [heights.setupTexture, heights.bindTexture, sceneUniforms.upload],
		/** Re-uploads the heights, same grid size; call engine.invalidate() after it. */
		update(pixels) {
			heightGrid.bounds = computeBounds(pixels);
			heights.update(pixels);
		},
		destroy: heights.destroy,
	};
	return heightGrid;
}
