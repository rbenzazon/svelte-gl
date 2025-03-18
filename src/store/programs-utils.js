import { createVec3, createZeroMatrix } from "../geometries/common";
import { camera } from "./camera";
import { getTranslation, multiply } from "gl-matrix/esm/mat4.js";
import { transformMat4 } from "gl-matrix/esm/vec3.js";
import { get } from "svelte/store";
//import { programs } from "./programs";

export function isTransparent(material) {
	return material?.opacity < 1 || material?.transparent;
}
/*export function findMaterialProgram() {
	const matPrograms = get(programs).filter((program) => program.meshes?.length !== 0 && program.allMeshes !== true);
	return matPrograms;
}*/
/**
 * Sorts meshes by Z depth for transparency rendering
 * @template {import("./programs").SvelteGLProgram[]|import("./programs").SvelteGLProgramProject[]} T
 * @param {T} programs - Array of programs to sort
 * @returns {T} - Sorted array with the same type as input
 */
export function sortMeshesByZ(programs) {
	if (programs.length === 0) {
		/* || get(renderer).canvas == null*/
		return programs;
	}
	let transparent = false;
	const { projection, view } = camera;
	const projScreen = multiply(createZeroMatrix(), projection, view);

	programs.forEach((program) => {
		if (transparent || isTransparent(program.material)) {
			transparent = true;
			program.meshes.forEach((mesh, i) => {
				if (!mesh.matrix) {
					// max number value
					mesh.clipSpacePosition = [0, 0, Number.MAX_VALUE];
				} else {
					const meshPosition = getTranslation(createVec3(), mesh.matrix.value);
					mesh.clipSpacePosition = transformMat4(createVec3(), meshPosition, projScreen);
				}
			});
			program.meshes = program.meshes.sort((a, b) => {
				return b.clipSpacePosition[2] - a.clipSpacePosition[2];
			});
		}
	});

	const sortedPrograms = programs.sort((a, b) => {
		if (
			a.material == null ||
			b.material == null ||
			a.meshes[0].clipSpacePosition == null ||
			b.meshes[0].clipSpacePosition == null
		) {
			return 0;
		}
		return b.meshes[0].clipSpacePosition[2] - a.meshes[0].clipSpacePosition[2];
	});
	// @ts-ignore, trust me bro
	return sortedPrograms;
}
