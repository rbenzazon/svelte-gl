import { derived, get, writable } from "svelte/store";
import {
	setupNormalMatrix,
	initRenderer,
	setupCamera,
	render,
	setupTransformMatrix,
	setupAttributes,
	setupMeshColor,
	bindVAO,
	enableBlend,
	disableBlend,
	setFaceWinding,
} from "./gl.js";
import { hasSameShallow as arrayHasSameShallow } from "../utils/array.js";
import { determinant } from "gl-matrix/esm/mat4.js";
import { camera } from "./camera.js";
import { renderer } from "./renderer.js";
import { lights } from "./lights.js";
import { materials } from "./materials.js";
import { programs, sortMeshesByZ, isTransparent } from "./programs.js";
import { scene } from "./scene.js";
import { isSvelteGLInstancedMesh, isSvelteGLSingleMesh } from "./mesh-types.js";

function findMesh(matrixStore) {
	const mesh = get(scene).find((node) => {
		return (
			(isSvelteGLSingleMesh(node) && node.matrix === matrixStore) ||
			(isSvelteGLInstancedMesh(node) && node.matrices.includes(matrixStore))
		);
	});
	return mesh;
}

function objectsHaveSameMatrix(a, b) {
	for (let i = 0; i < a.length; i++) {
		if (arrayHasSameShallow(get(a[i].matrix), get(b[i].matrix))) {
			return false;
		}
	}
	return true;
}

export const renderState = writable({
	init: false,
});

/**
 * Clears the cache map of unused programs and VAOs
 * @param {import("./programs.js").SvelteGLProgram[]} next - The next programs
 * @returns {void}
 */
export function clearUnusedCache(next) {
	const { programMap, vaoMap } = appContext;
	programMap.forEach((glProgram, programStore) => {
		if (!next.some((program) => program.material === programStore.material)) {
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

export function selectMesh(programStore, mesh) {
	return function selectMesh() {
		const { vaoMap } = appContext;
		const cachedVAO = vaoMap.get(programStore).get(mesh);
		appContext.vao = cachedVAO;
	};
}

/**
 * @typedef {Object} AppContext
 * @property {Map<import("./programs.js").SvelteGLProgram,WebGLProgram>} programMap
 * @property {Map<import("./programs.js").SvelteGLProgram,Map<SvelteGLMesh,WebGLVertexArrayObject>>} vaoMap
 * @property {WebGL2RenderingContext} gl
 * @property {WebGLProgram} program
 * @property {WebGLVertexArrayObject} vao
 * @property {HTMLCanvasElement} canvas
 * @property {vec4} backgroundColor
 * @property {vec3} ambientLightColor
 * @property {SvelteGLToneMapping[]} toneMappings
 * @property {boolean} existingProgram during a pipeline creation, informs the procedure that the program already exists
 */
/**
 * @type {AppContext}
 */
export let appContext = {
	programMap: new Map(),
	vaoMap: new Map(),
	gl: null,
	program: null,
	vao: null,
	canvas: null,
	backgroundColor: null,
	ambientLightColor: null,
	toneMappings: null,
	existingProgram: false,
};

export function setAppContext(context) {
	appContext = {
		...appContext,
		...context,
	};
}

const emptyRenderPipeline = [];
const revisionMap = new Map();
revisionMap.set(renderer, 0);
revisionMap.set(scene, 0);
revisionMap.set(camera, 0);
revisionMap.set(materials, 0);
revisionMap.set(lights, 0);

function updated() {
	const updateMap = new Set();
	if (revisionMap.get(renderer) !== renderer.revision) {
		updateMap.add(renderer);
	}
	if (revisionMap.get(scene) !== scene.revision) {
		updateMap.add(scene);
	}
	if (revisionMap.get(camera) !== camera.revision) {
		updateMap.add(camera);
	}
	if (revisionMap.get(materials) !== materials.revision) {
		updateMap.add(materials);
	}
	if (revisionMap.get(lights) !== lights.revision) {
		updateMap.add(lights);
	}
	revisionMap.set(renderer, renderer.revision);
	revisionMap.set(scene, scene.revision);
	revisionMap.set(camera, camera.revision);
	revisionMap.set(materials, materials.revision);
	revisionMap.set(lights, lights.revision);
	return updateMap;
}

/**
 * running states
 * 0 : not started
 * 1 : init currently running
 * 2 : init done, waiting for start
 * 3 : loop requested, ready to run									<---|
 * 																		|---- end state occilates between 3 and 4
 * 4 : loop currently running, renderer updates ignored momentarily	<---|
 */
const running = writable(0);

const renderPipeline = derived(
	[renderer, programs, camera, running],
	([$renderer, $programs, $camera, $running]) => {
		// if renderer.enabled is false, the scene is being setup, we should not render
		// if running is 4, we delay the pipeline updates as a way to batch scene updates

		if (!$renderer.enabled || $running === 4 || $running === 1 || $programs.length === 0) {
			return emptyRenderPipeline;
		}
		/**
		 * this map will tell you which stores have been updated since
		 * last updated() call while changes were batched
		 */

		const updateMap = updated();
		/*
		if(updateMap.has(renderer)){
			console.log("update renderer");
		}
		if(updateMap.has(scene)){
			console.log("update scene");
		}
		if(updateMap.has(camera)){
			console.log("update camera");
		}
		if(updateMap.has(materials)){
			console.log("update materials");
		}
		if(updateMap.has(lights)){
			console.log("update lights");
		}
		*/
		//we must filter in the stores first because not all the nodes are stores for now
		//then we filter the lights
		//console.log("updateMap.size",updateMap);
		if (updateMap.size === 0 && $running !== 2 && !$programs.some((p) => "requireTime" in p)) {
			//console.log("no updates updateMap.size is 0,skipping render",$running);

			return emptyRenderPipeline;
		}

		const rendererValues = renderer.processed;
		let rendererContext = {
			canvas: $renderer.canvas,
			backgroundColor: rendererValues.backgroundColor,
			ambientLightColor: rendererValues.ambientLightColor,
			...($renderer.toneMappings.length > 0
				? {
						toneMappings: $renderer.toneMappings,
					}
				: undefined),
		};
		const pipeline = [];

		appContext = {
			...appContext,
			...rendererContext,
		};

		const init = get(renderState).init;
		if (!init) {
			pipeline.push(initRenderer);
		}

		const sortedPrograms = sortMeshesByZ($programs);
		let transparent = false;

		pipeline.push(disableBlend);

		pipeline.push(
			...sortedPrograms.reduce((acc, program) => {
				appContext.existingProgram = false;
				if (isTransparent(program.material) && !transparent) {
					transparent = true;
					acc.push(enableBlend);
				}
				return [
					...acc,
					...(appContext.programMap.has(program)
						? [
								program.selectProgram(program),
								program.useProgram,
								...(program.bindTextures ? [...program.bindTextures] : []),
								...program.updateProgram,
							]
						: [
								program.createProgram(program),
								...program.setupProgram,
								program.useProgram,
								...program.setupMaterial,
								...program.updateProgram,
							]),
					...(program.setupCamera
						? [program.setupCamera($camera)]
						: [...(updateMap.has(camera) || !appContext.existingProgram ? [setupCamera($camera)] : [])]),
					...(program.setFrameBuffer ? [program.setFrameBuffer] : []),
					...program.meshes.reduce(
						(acc, mesh) => [
							...acc,
							...(appContext.vaoMap.has(program) && appContext.vaoMap.get(program).has(mesh)
								? [
										selectMesh(program, mesh),
										//setupMeshColor(program.material),// is it necessary ?multiple meshes only render with same material so same color
										...(isSvelteGLSingleMesh(mesh)
											? [setupTransformMatrix(program, mesh, mesh.matrix), setupNormalMatrix(program, mesh)] //setupTransformMatrix(program, mesh, mesh.matrix), setupNormalMatrix(program, mesh)
											: []),
									]
								: [
										setupAttributes(program, mesh),
										...(program.material ? [setupMeshColor(program.material)] : []),
										setupTransformMatrix(program, mesh, isSvelteGLSingleMesh(mesh) ? mesh.matrix : mesh.matrices, mesh.instances),
										setupNormalMatrix(program, mesh, mesh.instances),
										...(mesh.animations?.map((animation) => animation.setupAnimation) || []),
									]),
							...(mesh.matrix != null
								? [
										...(isSvelteGLInstancedMesh(mesh)
											? [setFaceWinding(determinant(get(mesh.matrices[0])) > 0)]
											: [setFaceWinding(determinant(get(mesh.matrix)) > 0)]),
									]
								: []),
							bindVAO,
							render(mesh, mesh.instances, mesh.drawMode),
						],
						[],
					),
					...(program.postDraw ? [program.postDraw] : []),
				];
			}, []),
		);

		return pipeline;
	},
	emptyRenderPipeline,
);

const renderLoopStore = derived([renderPipeline], ([$renderPipeline]) => {
	if ($renderPipeline.length === 0) {
		return 0;
	}
	if (!get(renderState).init && get(running) === 0) {
		running.set(1);
		$renderPipeline.forEach((f) => {
			//log("f init", f.name);
			f();
		});
		renderState.set({
			init: true,
		});
		running.set(2);
		return 1;
	} else if (get(running) === 2) {
		running.set(3);
		requestAnimationFrame(loop);
		return 2;
	}

	async function loop() {
		//lock pipeline updates to batch changes while loop is running
		running.set(4);
		const rendererValue = get(renderer);
		rendererValue.loop && rendererValue.loop();
		//unlock pipeline updates and trigger next update
		running.set(3);
		//run pipeline updates
		get(renderPipeline).forEach((f) => {
			//log("f loop", f.name);
			f();
		});
		//lock pipeline updates to batch changes that come from other sources than loop
		running.set(4);
		requestAnimationFrame(loop);
	}
});

//this is necessary because the store needs to be subscribed to to be activated
const unsub = renderLoopStore.subscribe((value) => {
	//console.log("render loop store subscribed", value);
});
