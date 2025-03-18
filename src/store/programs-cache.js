import { appContext } from "./app-context.js";
import { hasSameShallow as arrayHasSameShallow } from "../utils/array.js";

function isSameProgram(a, b) {
	return "material" in a
		? a.material === b.material
		: a.createProgram === b.createProgram && arrayHasSameShallow(a.meshes, b.meshes);
}

/**
 * Clears the cache map of unused programs and VAOs
 * @param {import("./programs.js").SvelteGLProgram[]} next - The next programs
 * @returns {void}
 */
export function clearUnusedCache(next) {
	const { programMap, vaoMap } = appContext;
	programMap.forEach((glProgram, programStore) => {
		if (!next.some((program) => isSameProgram(program, programStore))) {
			programMap.delete(programStore);
			vaoMap.delete(programStore);
		}
	});
	next.forEach((p) => {
		let cachedProgram, cachedGLProgram;
		programMap.forEach((glProgram, programStore) => {
			if (programStore.material === p.material) {
				cachedProgram = programStore;
				cachedGLProgram = glProgram;
			}
		});
		if (cachedProgram != null) {
			const existingVAOMap = vaoMap.get(cachedProgram);
			existingVAOMap.forEach((vao, mesh) => {
				if (!p.meshes.includes(mesh)) {
					existingVAOMap.delete(mesh);
				}
			});
		}
	});
}

/**
 * Assigns the new programstore to the corresponding WebGLProgram if the material is the same
 * Then assigns the VAOs to the new programstore too.
 * The previous programstore and vaos are deleted from the cache map
 *
 * @param {import("./programs.js").SvelteGLProgramProject} p - The program object
 * @param {import("./programs.js").SvelteGLProgram} program - The program store
 * @returns {void}
 */
export function reconciliateCacheMap(p, program) {
	const { programMap, vaoMap } = appContext;
	let cachedProgram, cachedGLProgram;
	programMap.forEach((glProgram, programStore) => {
		if (programStore.material === p.material) {
			cachedProgram = programStore;
			cachedGLProgram = glProgram;
		}
	});
	if (cachedProgram != null) {
		const existingVAOMap = vaoMap.get(cachedProgram);
		if (existingVAOMap != null) {
			vaoMap.delete(cachedProgram);
			vaoMap.set(program, existingVAOMap);
		}
		programMap.delete(cachedProgram);
		programMap.set(program, cachedGLProgram);
	}
}

export function selectProgram(programStore) {
	appContext.existingProgram = true;
	return function selectProgram() {
		const { programMap } = appContext;
		const cachedProgram = programMap.get(programStore);
		appContext.program = cachedProgram;
	};
}
