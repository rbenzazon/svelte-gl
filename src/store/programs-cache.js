import { get } from "svelte/store";
import { hasSameShallow as arrayHasSameShallow } from "../utils/array.js";
import { appContext } from "./app-context.js";
import { scene } from "./scene.js";

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
export function clearUnusedCache(next, ctx = appContext, sceneStore = scene) {
	const { programMap, vaoMap, gl } = ctx;
	// delete programs that are cached but not in the next programs
	programMap.forEach((glProgram, programStore) => {
		if (!next.some((program) => isSameProgram(program, programStore))) {
			// Delete VAOs for this program
			const vaoMapForProgram = vaoMap.get(programStore);
			if (vaoMapForProgram) {
				for (const vao of vaoMapForProgram.values()) {
					gl.deleteVertexArray(vao);
				}
				vaoMap.delete(programStore);
			}
			const sceneValue = get(sceneStore);
			programStore.meshes.forEach((mesh) => {
				if (!sceneValue.includes(mesh)) {
					const buffers = ctx.bufferMap.get(mesh);
					if (buffers) {
						buffers.forEach((buffer) => {
							gl.deleteBuffer(buffer);
						});
						ctx.bufferMap.delete(mesh);
					}
				}
			});
			gl.deleteProgram(glProgram);
			programMap.delete(programStore);
		}
	});
	// delete meshes that are not in the next programs
	next.forEach((p) => {
		let cachedProgram, cachedGLProgram;
		//const {key:cachedProgram,value:cachedGLProgram}
		const entry = Array.from(programMap).find(([programStore]) => isSameProgram(programStore, p));
		if (entry) {
			const [cachedProgram, cachedGLProgram] = entry;
			p.meshes.forEach((mesh) => {
				const existingVao = findVaoWithMesh(mesh, vaoMap);
				if (existingVao) {
					const existingVAOMap = vaoMap.get(cachedProgram);
					existingVAOMap.delete(mesh);
					p.existingVAO = p.existingVAO || new Map();
					p.existingVAO.set(mesh, existingVao);
				}
			});
			const existingVAOMap = vaoMap.get(cachedProgram);
			existingVAOMap.forEach((vao, mesh) => {
				if (!p.meshes.includes(mesh)) {
					gl.deleteVertexArray(vao);
					existingVAOMap.delete(mesh);
				}
			});
		}
	});
	console.log("cleared cache map", programMap.size, vaoMap.size);
}

function findVaoWithMesh(mesh, vaoMap) {
	for (const [programStore, map] of vaoMap) {
		for (const [mappedMesh, vao] of map) {
			if (mappedMesh === mesh) {
				return vao;
			}
		}
	}
	return null;
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
export function reconciliateCacheMap(p, program, ctx = appContext) {
	const { programMap, vaoMap } = ctx;
	let cachedProgram, cachedGLProgram;
	console.log("reconciliateCacheMap");
	//make for loop instead of forEach
	//programMap.forEach((glProgram, programStore) => {
	for (const [programStore, glProgram] of programMap) {
		if (isSameProgram(programStore, p)) {
			console.log("found existing program");
			cachedProgram = programStore;
			cachedGLProgram = glProgram;
			break;
		}
	}
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

export function selectProgram(programStore, ctx = appContext) {
	ctx.existingProgram = true;
	return function selectProgram(runtimeCtx) {
		const current = runtimeCtx ?? ctx;
		const cachedProgram = current.programMap.get(programStore);
		current.program = cachedProgram;
	};
}
