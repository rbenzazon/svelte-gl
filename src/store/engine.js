import { determinant } from "gl-matrix/esm/mat4.js";
import { derived, get, writable } from "svelte/store";
import { appContext, createAppContext } from "./app-context.js";
import { camera, createCameraStore } from "./camera";
import { create3DObject } from "./create-object";
import {
	bindDefaultFramebuffer,
	bindVAO,
	disableBlend,
	enableBlend,
	initRenderer,
	render,
	setFaceWinding,
	setupAttributes,
	setupCamera,
	setupMeshColor,
	setupNormalMatrix,
	setupObjectMatrix,
} from "./gl.js";
import { createLightStore, createLightsStore, lights } from "./lights";
import { createMaterialStore, createMaterials, materials } from "./materials";
import { isSvelteGLInstancedMesh, isSvelteGLSingleMesh } from "./mesh-types.js";
import { createProgramsStore, programs } from "./programs";
import { isTransparent, sortMeshesByZ } from "./programs-utils";
import { createRenderer, renderer } from "./renderer";
import { createSceneStore, scene } from "./scene";

export function selectMesh(programStore, mesh) {
	return function selectMesh(ctx) {
		const { vaoMap } = ctx;
		const cachedVAO = vaoMap.get(programStore).get(mesh);
		ctx.vao = cachedVAO;
	};
}

function attachLoop({ ctx, camera, renderer, scene, lights, materials, programs }) {
	ctx.camera = camera;
	const renderState = writable({
		init: false,
	});

	const emptyRenderPipeline = [];
	const invalidateToken = {};
	// A new program list (render passes, light count...) makes every cached pipeline stale.
	const programsToken = {};
	let lastPrograms = null;
	let invalidateRevision = 0;
	const revisionMap = new Map();
	revisionMap.set(renderer, 0);
	revisionMap.set(scene, 0);
	revisionMap.set(camera, 0);
	revisionMap.set(materials, 0);
	revisionMap.set(lights, 0);
	revisionMap.set(invalidateToken, 0);

	function invalidate() {
		invalidateRevision += 1;
	}
	// Objects request redraws for changes outside the stores, such as instance matrices.
	ctx.invalidate = invalidate;

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
		if (revisionMap.get(invalidateToken) !== invalidateRevision) {
			updateMap.set(invalidateToken, "invalidate");
		}
		revisionMap.set(renderer, renderer.revision);
		revisionMap.set(scene, scene.revision);
		revisionMap.set(camera, camera.revision);
		revisionMap.set(materials, materials.revision);
		revisionMap.set(lights, lights.revision);
		revisionMap.set(invalidateToken, invalidateRevision);
		return updateMap;
	}

	const pipelineCache = new Map();

	function isEligibleForCache(updateMap) {
		if (updateMap.size === 0) {
			return false;
		}
		for (const key of updateMap.keys()) {
			if (key !== camera && key !== lights && key !== invalidateToken) {
				return false;
			}
		}
		return true;
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
	let frame = 0;

	const renderPipeline = derived(
		[renderer, programs, camera, running],
		([$renderer, $programs, $camera, $running]) => {
			// if renderer.enabled is false, the scene is being setup, we should not render
			// if running is 4, we delay the pipeline updates as a way to batch scene updates
			if (!$renderer.enabled || $running === 4 || $running === 1) {
				return emptyRenderPipeline;
			}
			/**
			 * this map will tell you which stores have been updated since
			 * last updated() call while changes were batched
			 */

			const updateMap = updated();
			if ($programs !== lastPrograms) {
				lastPrograms = $programs;
				updateMap.set(programsToken, "programs");
			}
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
			if (updateMap.size === 0 && $running !== 2 && !$programs.some((p) => p.requireTime)) {
				return emptyRenderPipeline;
			}

			const rendererValues = renderer.processed;
			const rendererContext = {
				canvas: $renderer.canvas,
				backgroundColor: rendererValues.backgroundColor,
				ambientLightColor: rendererValues.ambientLightColor,
				// Always assigned, so removing the last tone mapping reaches the shaders built after it.
				toneMappings: $renderer.toneMappings,
			};
			const pipeline = [];

			Object.assign(ctx, rendererContext);

			const eligible = isEligibleForCache(updateMap);
			const cacheSignature = getPipelineSignature(updateMap);
			if (eligible) {
				if (pipelineCache.has(cacheSignature)) {
					return pipelineCache.get(cacheSignature);
				}
			} else {
				pipelineCache.clear();
			}

			const init = get(renderState).init;
			if (!init) {
				pipeline.push(initRenderer);
			}

			const sortedPrograms = sortMeshesByZ($programs, camera);
			let transparent = false;

			pipeline.push(disableBlend);
			if ($programs.length === 0) {
				pipeline.push(bindDefaultFramebuffer);
			}

			let programCreation = false;

			pipeline.push(
				...sortedPrograms.reduce((acc, program) => {
					ctx.existingProgram = false;
					if (isTransparent(program.material) && !transparent) {
						transparent = true;
						acc.push(enableBlend);
					}
					const programIsCached = ctx.programMap.has(program);
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
							: [...(updateMap.has(camera) || !ctx.existingProgram ? [setupCamera(camera)] : [])]),
						...(program.setFrameBuffer ? [program.setFrameBuffer] : []),
						...program.meshes.reduce(
							(acc, mesh) => [
								...acc,
								...(ctx.vaoMap.has(program) && ctx.vaoMap.get(program).has(mesh)
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
				f(ctx);
			});
			renderState.set({
				init: true,
			});
			running.set(2);
			return 1;
		} else if (get(running) === 2) {
			// Batch the changes until the first frame, as between frames: a pipeline built before it would mark
			// the changes as drawn and the first frame would draw nothing. The change that started the loop is
			// redrawn there.
			invalidate();
			running.set(4);
			frame = requestAnimationFrame(loop);
			return 2;
		}

		async function loop() {
			//lock pipeline updates to batch changes while loop is running
			running.set(4);
			const rendererValue = get(renderer);
			// Resize the buffer and the projection, then draw below in this same turn.
			ctx.applyPendingCanvasSize?.();
			// After the resize, so a callback drawing outside WebGL sees this frame's size and projection.
			rendererValue.loop && rendererValue.loop();
			//unlock pipeline updates and trigger next update
			running.set(3);
			//run pipeline updates
			get(renderPipeline).forEach((f) => {
				//log("f loop", f.name);
				f(ctx);
			});
			//lock pipeline updates to batch changes that come from other sources than loop
			running.set(4);
			frame = requestAnimationFrame(loop);
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
	function destroy() {
		cancelAnimationFrame(frame);
		unsub();
		unsubPipeline();
	}
	return { renderState, invalidate, destroy };
}

export const { renderState, invalidate } = attachLoop({
	ctx: appContext,
	camera,
	renderer,
	scene,
	lights,
	materials,
	programs,
});

export function createEngine() {
	const ctx = createAppContext();
	const engineCamera = createCameraStore(ctx);
	const engineRenderer = createRenderer(ctx);
	const engineScene = createSceneStore();
	const engineLights = createLightsStore();
	const engineMaterials = createMaterials();
	const renderPasses = writable([]);
	const enginePrograms = createProgramsStore({
		scene: engineScene,
		lights: engineLights,
		materials: engineMaterials,
		renderPasses,
		ctx,
	});
	const bindings = {
		camera: engineCamera,
		programs: enginePrograms,
		renderer: engineRenderer,
		ctx,
	};
	const loop = attachLoop({
		ctx,
		camera: engineCamera,
		renderer: engineRenderer,
		scene: engineScene,
		lights: engineLights,
		materials: engineMaterials,
		programs: enginePrograms,
	});
	return {
		ctx,
		camera: engineCamera,
		renderer: engineRenderer,
		scene: engineScene,
		lights: engineLights,
		materials: engineMaterials,
		renderPasses,
		programs: enginePrograms,
		renderState: loop.renderState,
		invalidate: loop.invalidate,
		destroy() {
			loop.destroy();
			engineRenderer.destroy();
			// Frees every GPU resource of this context. The canvas cannot get a new WebGL context afterwards.
			ctx.gl?.getExtension("WEBGL_lose_context")?.loseContext();
		},
		createMaterial(props) {
			return createMaterialStore(props, { materials: engineMaterials, scene: engineScene });
		},
		createLight(value) {
			return createLightStore(value, { lights: engineLights, ctx });
		},
		/** A camera for a material viewport; it sets its own `aspect`. */
		createCamera() {
			return createCameraStore(ctx);
		},
		/** `camera`: the camera of the material viewport the object is drawn in, default the engine camera. */
		createObject(data, { camera } = {}) {
			return create3DObject(data, false, [0, 0, 0], camera ? { ...bindings, camera } : bindings);
		},
	};
}
