import { transformMat4 } from "gl-matrix/esm/vec3.js";
import { convertToVector3 } from "../../color/color-space.js";
import { createPointLight } from "../../lights/point-light.js";

/** Key (front left), fill (front right) and rim (behind), as seen from the home view. */
export const defaultLights = [
	{ position: [-1.5, -2, 2.5], intensity: 2.5 },
	{ position: [2, -1, 1], intensity: 0.8 },
	{ position: [0.5, 2.5, 1.5], intensity: 1.2 },
];

/**
 * Bounding-box-relative lights to engine point lights, at most 4.
 * x and y are in half extents of the data, z (up) in the larger of the two, so flat data still gets lit from above.
 * "camera" lights are placed for the home view, then stay fixed in view space and orbit with the camera.
 * There is no distance falloff, so the intensity does not depend on the data size.
 * @param {import("./scan-viewer").ScanViewerLight[]} lights
 * @param {"camera" | "scene"} attached
 * @param {number[]} halfSize half extents of the data in X and Y
 * @param {mat4} homeView view matrix of the home camera
 */
export function createRigLights(lights, attached, [halfX, halfY], homeView) {
	const halfXY = Math.max(halfX, halfY);
	const viewSpace = attached === "camera";
	return lights.slice(0, 4).map(({ position: [x, y, z], color = [1, 1, 1], intensity = 1 }) => {
		const world = [x * halfX, z * halfXY, -y * halfY];
		return createPointLight({
			position: viewSpace ? transformMat4(world, world, homeView) : world,
			color: convertToVector3(color),
			intensity,
			cutoffDistance: 0,
			decayExponent: 0,
			viewSpace,
		});
	});
}
