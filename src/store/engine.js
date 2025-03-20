import { derived, get, writable } from "svelte/store";
import {
	setupNormalMatrix,
	initRenderer,
	setupCamera,
	render,
	setupObjectMatrix,
	setupAttributes,
	setupMeshColor,
	bindVAO,
	enableBlend,
	disableBlend,
	setFaceWinding,
} from "./gl.js";
import { determinant } from "gl-matrix/esm/mat4.js";
import { camera } from "./camera";
import { renderer } from "./renderer";
import { lights } from "./lights";
import { materials } from "./materials";
import { programs } from "./programs";
import { sortMeshesByZ, isTransparent } from "./programs-utils";
import { scene } from "./scene";
import { isSvelteGLInstancedMesh, isSvelteGLSingleMesh } from "./mesh-types.js";
import { appContext, setAppContext } from "./app-context.js";

export const renderState = writable({
	init: false,
});

export function selectMesh(programStore, mesh) {
	return function selectMesh() {
		const { vaoMap } = appContext;
		const cachedVAO = vaoMap.get(programStore).get(mesh);
		appContext.vao = cachedVAO;
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
	const updateMap = new Map();
	if (revisionMap.get(renderer) !== renderer.revision) {
		updateMap.set(renderer, "renderer");
	}
	if (revisionMap.get(scene) !== scene.revision) {
		updateMap.set(scene, "scene");
	}
	if (revisionMap.get(camera) !== camera.revision) {
		updateMap.set(camera, "camera");
	}
	if (revisionMap.get(materials) !== materials.revision) {
		updateMap.set(materials, "materials");
	}
	if (revisionMap.get(lights) !== lights.revision) {
		updateMap.set(lights, "lights");
	}
	revisionMap.set(renderer, renderer.revision);
	revisionMap.set(scene, scene.revision);
	revisionMap.set(camera, camera.revision);
	revisionMap.set(materials, materials.revision);
	revisionMap.set(lights, lights.revision);
	return updateMap;
}

const pipelineCache = new Map();

function isEligibleForCache(updateMap) {
	return (
		(updateMap.size === 1 && (updateMap.has(camera) || updateMap.has(lights))) ||
		(updateMap.size === 2 && updateMap.has(camera) && updateMap.has(lights))
	);
}

function getPipelineSignature(updateMap) {
	return Array.from(updateMap.values()).join("-");
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
console.log("renderPipeline created");
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

		setAppContext(rendererContext);

		const eligible = isEligibleForCache(updateMap);
		const cacheSignature = getPipelineSignature(updateMap);
		if (eligible && pipelineCache.has(cacheSignature)) {
			return pipelineCache.get(cacheSignature);
		}

		const init = get(renderState).init;
		if (!init) {
			pipeline.push(initRenderer);
		}

		const sortedPrograms = sortMeshesByZ($programs);
		let transparent = false;

		pipeline.push(disableBlend);

		let programCreation = false;

		pipeline.push(
			...sortedPrograms.reduce((acc, program) => {
				appContext.existingProgram = false;
				if (isTransparent(program.material) && !transparent) {
					transparent = true;
					acc.push(enableBlend);
				}
				const programIsCached = appContext.programMap.has(program);
				programCreation = programCreation || !programIsCached;
				return [
					...acc,
					...(programIsCached
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
						? [program.setupCamera(camera)]
						: [...(updateMap.has(camera) || !appContext.existingProgram ? [setupCamera(camera)] : [])]),
					...(program.setFrameBuffer ? [program.setFrameBuffer] : []),
					...program.meshes.reduce(
						(acc, mesh) => [
							...acc,
							...(appContext.vaoMap.has(program) && appContext.vaoMap.get(program).has(mesh)
								? [
										selectMesh(program, mesh),
										//setupMeshColor(program.material),// is it necessary ?multiple meshes only render with same material so same color
										...((mesh.matrix != null || mesh.matrices != null) && (isSvelteGLSingleMesh(mesh) || updateMap.has(camera))
											? [setupObjectMatrix(program, mesh), setupNormalMatrix(program, mesh)]
											: []),
									]
								: [
										setupAttributes(program, mesh),
										...(program.material ? [setupMeshColor(program.material)] : []),
										...(mesh.matrix != null || mesh.matrices != null
											? [setupObjectMatrix(program, mesh), setupNormalMatrix(program, mesh)]
											: []),
										...(mesh.animations?.map((animation) => animation.setupAnimation) || []),
									]),
							...(mesh.matrix != null || mesh.matrices != null
								? [
										...(isSvelteGLInstancedMesh(mesh)
											? [setFaceWinding(determinant(mesh.matrices.getInstance(0)) > 0)]
											: [setFaceWinding(determinant(mesh.matrix.value) > 0)]),
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
		if (eligible && !programCreation && !pipelineCache.has(cacheSignature)) {
			pipelineCache.set(cacheSignature, pipeline);
		}

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

//this is necessary because the store needs to be subscribed to to be activated
const unsubPipeline = renderPipeline.subscribe((value) => {
	//console.log("render loop store subscribed", value);
});
