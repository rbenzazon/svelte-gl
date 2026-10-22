import { create, invert, multiply } from "gl-matrix/esm/mat4.js";
import { transformMat4 } from "gl-matrix/esm/vec4.js";

/**
 * Ray from the camera through a screen point, in scene space (relative to the scene origin, heights times zScale).
 * Perspective camera: the ray starts at the eye.
 * @param {{ projection: ArrayLike<number>, view: ArrayLike<number>, model: ArrayLike<number> }} matrices
 * @param {[number, number]} viewport CSS px
 * @param {[number, number]} screen CSS px from the top left corner
 * @returns {{ origin: number[], direction: number[] }}
 */
export function createPickRay({ projection, view, model }, [width, height], [x, y]) {
	const modelView = multiply(create(), view, model);
	const inverseModelView = invert(create(), modelView);
	const inverseAll = invert(create(), multiply(create(), projection, modelView));
	const eye = transformMat4([0, 0, 0, 0], [0, 0, 0, 1], inverseModelView);
	const through = transformMat4([0, 0, 0, 0], [(x / width) * 2 - 1, 1 - (y / height) * 2, 1, 1], inverseAll);
	const direction = [0, 1, 2].map((i) => through[i] / through[3] - eye[i]);
	const length = Math.hypot(...direction) || 1;
	return { origin: [eye[0], eye[1], eye[2]], direction: direction.map((value) => value / length) };
}
