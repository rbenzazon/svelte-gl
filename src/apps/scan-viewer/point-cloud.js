/**
 * Unorganized cloud: the interleaved xyz go as is to the mesh positions buffer, plus an origin offset
 * so the float32 coordinates stay small. setup and updateProgram are pipeline steps of the points program.
 * @param {import("./scan-viewer").PointCloudData} data
 * @param {ReturnType<typeof import("./scene-uniforms.js").createSceneUniforms>} sceneUniforms
 */
export function createPointCloud({ xyz, origin = [0, 0, 0] }, sceneUniforms) {
	function setup(ctx) {
		const { gl, program } = ctx;
		// In double precision, so large machine coordinates keep their resolution.
		const sceneOrigin = sceneUniforms.getOrigin();
		gl.uniform3fv(
			gl.getUniformLocation(program, "cloudOffset"),
			origin.map((value, i) => value - sceneOrigin[i]),
		);
		sceneUniforms.bindBlock(ctx);
	}

	// Real data coordinates, NaN points ignored.
	const min = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
	const max = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
	for (let i = 0; i < xyz.length; i += 3) {
		for (let axis = 0; axis < 3; axis++) {
			const value = xyz[i + axis] + origin[axis];
			if (value < min[axis]) min[axis] = value;
			if (value > max[axis]) max[axis] = value;
		}
	}

	return {
		cloud: true,
		xyz,
		origin,
		pointCount: xyz.length / 3,
		bounds: { min, max },
		setup,
		updateProgram: [sceneUniforms.upload],
	};
}
