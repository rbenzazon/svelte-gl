import { derived, get, writable } from "svelte/store";
import {
	setupNormalMatrix,
	initRenderer,
	createProgram,
	linkProgram,
	validateProgram,
	createShaders,
	setupCamera,
	render,
	setupTransformMatrix,
	setupAttributes,
	setupAmbientLight,
	updateTransformMatrix,
	updateInstanceTransformMatrix,
	setupMeshColor,
	updateNormalMatrix,
	updateInstanceNormalMatrix,
	derivateNormalMatrix,
	setupTime,
	useProgram,
	bindVAO,
	clearFrame,
} from "./gl-refactor.js";
import { hasSameShallow } from "../utils/set.js";
import { hasSameShallow as arrayHasSameShallow, optionalPropsDeepEqual } from "../utils/array.js";
import { isLight } from "../lights/lights.js";
import { convertToVector3 } from "../color/color-space.js";

function createRenderer() {
	const initialValue = {
		//ref
		canvas: null,
		//ref
		loop: null,
		//value
		backgroundColor: 0xffffff,
		//value
		ambientLightColor: [0xffffff, 0],
		//values
		toneMappings: [],
		//value
		enabled: false,
	};
	let cache = initialValue;
	let processed = new Map();
	const store = writable(initialValue);
	const { subscribe, update } = store;
	const revisionStore = writable(0);

	/**
	 * Update function can update uniforms and other values directly
	 */
	function updateCanvas(canvas) {}
	function updateLoop(loop) {}
	function updateBackgroundColor(color) {
		processed.set("backgroundColor", [...convertToVector3(color), 1]);
	}
	function updateAmbientLightColor([color, intensity]) {
		processed.set(
			"ambientLightColor",
			convertToVector3(color).map((c) => c * intensity),
		);
	}
	function updateToneMappings(toneMappings) {}
	function updateEnabled(enabled) {}

	function customUpdate(updater) {
		update((renderer) => {
			const next = updater(renderer);
			//getting revision value from cache prevents revision tampering
			revisionStore.update((revision) => revision + 1);
			if (cache.canvas != null && next.canvas !== cache.canvas) {
				updateCanvas(next.canvas);
			}
			if (cache.loop != null && next.loop !== cache.loop) {
				updateLoop(next.loop);
			}
			if (next.backgroundColor !== cache.backgroundColor) {
				updateBackgroundColor(next.backgroundColor);
			}
			if (!arrayHasSameShallow(next.ambientLightColor, cache.ambientLightColor)) {
				updateAmbientLightColor(next.ambientLightColor);
			}
			if (!arrayHasSameShallow(next.toneMappings, cache.toneMappings)) {
				updateToneMappings(next.toneMappings);
			}
			if (next.enabled !== cache.enabled) {
				updateEnabled(next.enabled);
			}
			cache = next;
			return next;
		});
	}

	//specific on change handling, might be useless
	function customSet(next) {
		customUpdate((renderer) => next);
	}

	return {
		subscribe,
		set: customSet,
		update: customUpdate,
		get processed() {
			const values = get(store);
			return Object.entries(values)
				.map(([key, value]) => {
					if (processed.has(key)) {
						return [key, processed.get(key)];
					}
					return [key, value];
				})
				.reduce((acc, [key, value]) => {
					acc[key] = value;
					return acc;
				}, {});
		},
		get revision() {
			return get(revisionStore);
		},
	};
}

function createCameraStore() {
	const initialCamera = {
		position: [0, 0, -1],
		target: [0, 0, 0],
		fov: 80,
		near: 0.1,
		far: 1000,
		up: [0, 1, 0],
		matrix: null,
	};
	const store = writable(initialCamera);
	const { subscribe, update } = store;
	const revisionStore = writable(0);
	function customUpdate(updater) {
		update((camera) => {
			//this makes update require only the changed props (especially the revision)
			const next = {
				...camera,
				...updater(camera),
			};
			revisionStore.update((revision) => revision + 1);
			return next;
		});
	}
	function customSet(next) {
		customUpdate((camera) => next);
	}
	return {
		subscribe,
		set: customSet,
		update: customUpdate,
		get revision() {
			return get(revisionStore);
		},
	};
}

export const camera = createCameraStore();

export function createAmbientLight(color, intensity) {
	return convertToVector3(color).map((c) => c * intensity);
}

export function createBackgroundColor(color) {
	return [...convertToVector3(color), 1];
}
export const renderer = createRenderer();

function createSceneStore() {
	const store = writable([]);
	const revisionStore = writable(0);
	const { subscribe, update } = store;
	function customUpdate(updater) {
		update((scene) => {
			const next = updater(scene);
			revisionStore.update((revision) => revision + 1);
			return next;
		});
	}
	function customSet(next) {
		customUpdate((scene) => next);
	}
	return {
		subscribe,
		set: customSet,
		update: customUpdate,
		//this way the revision can't be changed from outside
		get revision() {
			return get(revisionStore);
		},
	};
}
export const scene = createSceneStore();

export const createLightStore = (initialProps) => {
	const { subscribe, set } = writable(initialProps);
	return {
		subscribe,
		set: (props) => {
			//update buffers here
			set(props);
		},
	};
};

let meshCache;

export const meshes = derived([scene], ([$scene]) => {
	const meshNodes = $scene.filter((node) => node.attributes != null);
	//using throw to cancel update flow when unchanged
	if (arrayHasSameShallow(meshCache, meshNodes)) {
		throw new Error("meshes unchanged");
	} else {
		meshCache = meshNodes;
	}
	return meshNodes;
});

let materialCache;

export const materials = derived([meshes], ([$meshes]) => {
	const materials = new Set();
	$meshes.forEach((node) => {
		materials.add(node.material);
	});
	//using throw to cancel update flow when unchanged
	if (hasSameShallow(materialCache, materials)) {
		throw new Error("materials unchanged");
	} else {
		materialCache = materials;
	}
	return materials;
});

export const programs = derived([meshes, materials], ([$meshes, $materials]) => {
	let programs = Array.from($materials);

	//this sublist mesh items require their own respective program (shader)
	const specialMeshes = new Set(
		$meshes.filter((node) => node.instances > 1 || node.animations?.some((a) => a.type === "vertex")),
	);

	programs = programs.reduce((acc, current) => {
		const materialMeshes = $meshes.filter((node) => node.material === current);
		const { currentNormalMeshes, currentSpecialMeshes } = materialMeshes.reduce(
			(acc, node) => {
				if (specialMeshes.has(node)) {
					acc.currentSpecialMeshes.push(node);
				} else {
					acc.currentNormalMeshes.push(node);
				}
				return acc;
			},
			{
				currentNormalMeshes: [],
				currentSpecialMeshes: [],
			},
		);

		if (currentNormalMeshes.length > 0) {
			acc.push({
				material: current,
				meshes: currentNormalMeshes,
			});
		}
		currentSpecialMeshes.forEach((mesh) => {
			const requireTime = mesh.animations?.some((animation) => animation.requireTime);
			acc.push({
				requireTime,
				material: current,
				meshes: [mesh],
			});
		});
		return acc;
	}, []);

	return programs.map((p) => ({
		...p,
		createProgram,
		createShaders: createShaders(),
		linkProgram,
		validateProgram,
		useProgram,
	}));
});

export const renderState = writable({
	init: false,
});

function isStore(obj) {
	return obj != null && obj.subscribe != null;
}

function selectProgram(appContext, program) {
	return function selectProgram() {
		const { programMap } = get(appContext);
		const cachedProgram = programMap.get(program);
		appContext.update((appContext) => ({
			...appContext,
			program: cachedProgram,
		}));
	};
}

function selectMesh(appContext, mesh) {
	return function selectMesh() {
		const { meshMap } = get(appContext);
		const cachedVAO = meshMap.get(mesh);
		appContext.update((appContext) => ({
			...appContext,
			vao: cachedVAO,
		}));
	};
}

export const appContext = writable({
	programMap: new Map(),
	meshMap: new Map(),
});

const emptyRenderPipeline = [];
const revisionMap = new Map();
revisionMap.set(renderer, 0);
revisionMap.set(scene, 0);
revisionMap.set(camera, 0);

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
	revisionMap.set(renderer, renderer.revision);
	revisionMap.set(scene, scene.revision); /**
	 * running states
	 * 0 : not started
	 * 1 : init currently running
	 * 2 : init done, waiting for start
	 * 3 : loop requested, ready to run									<---|
	 * 																		|---- end state occilates between 3 and 4
	 * 4 : loop currently running, renderer updates ignored momentarily	<---|
	 */
	const running = writable(0);
	revisionMap.set(camera, camera.revision);
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
	[renderer, programs, scene, camera, running],
	([$renderer, $programs, $scene, $camera, $running]) => {
		// if renderer.enabled is false, the scene is being setup, we should not render
		// if running is 4, we delay the pipeline updates as a way to batch scene updates
		if (!$renderer.enabled || $running === 4 || $running === 1) {
			//TODO maybe throw here to cancel the update flow
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
		*/
		//we must filter in the stores first because not all the nodes are stores for now
		//then we filter the lights

		if (updateMap.length === 0) {
			return emptyRenderPipeline;
		}

		const lights = $scene.filter(isStore).filter(isLight);

		const pointLights = lights.filter((l) => get(l).type === "point");
		const numPointLights = pointLights.length;
		let pointLightShader;
		if (numPointLights > 0) {
			pointLightShader = get(pointLights[0]).shader;
		}
		const rendererValues = renderer.processed;
		let rendererContext = {
			canvas: $renderer.canvas,
			backgroundColor: rendererValues.backgroundColor,
			...($renderer.toneMappings.length > 0
				? {
						toneMappings: $renderer.toneMappings,
					}
				: undefined),
			...(numPointLights > 0
				? {
						numPointLights,
						pointLightShader,
					}
				: undefined),
		};
		const pipeline = [];

		appContext.update((appContext) => ({
			...appContext,
			...rendererContext,
		}));

		const init = get(renderState).init;
		if (!init) {
			pipeline.push(initRenderer(appContext));
		}
		/*!init &&*/
		pipeline.push(
			...[clearFrame(appContext)],
			...$programs.reduce((acc, program) => {
				return [
					...acc,
					...(get(appContext).programMap.has(program)
						? [
								selectProgram(appContext, program),
								program.useProgram(appContext),
								...(updateMap.has(camera) ? [setupCamera(appContext, $camera)] : []),
							]
						: [
								program.createProgram(appContext, program),
								program.createShaders(appContext, program.material, program.meshes),
								program.linkProgram(appContext),
								program.validateProgram(appContext),
								program.useProgram(appContext),
								setupCamera(appContext, $camera),
								setupAmbientLight(appContext, rendererValues.ambientLightColor),
								...[
									...lights.reduce((acc, light) => {
										const lightValue = get(light);
										acc.set(lightValue.type, lightValue.setupLights);
										return acc;
									}, new Map()),
								].map(([_, setupLights]) => setupLights(appContext, lights)),
								...(program.material?.specular ? [program.material.specular.setupSpecular(appContext)] : []),
								...(program.material?.diffuseMap ? [program.mesh.material?.diffuseMap.setupTexture(appContext)] : []),
								...(program.material?.normalMap ? [program.material?.normalMap.setupTexture(appContext)] : []),
								...(program.requireTime ? [setupTime(appContext)] : []),
							]),

					...program.meshes.reduce(
						(acc, mesh) => [
							...acc,
							...(get(appContext).meshMap.has(mesh)
								? [
										selectMesh(appContext, mesh),
										//setupMeshColor(appContext, program.material),// is it necessary ?multiple meshes only render with same material so same color
										...(mesh.instances == null
											? [setupTransformMatrix(appContext, mesh.matrix), setupNormalMatrix(appContext)]
											: []),
									]
								: [
										setupAttributes(appContext, mesh),
										setupMeshColor(appContext, program.material),
										setupTransformMatrix(appContext, mesh.instances == null ? mesh.matrix : mesh.matrices, mesh.instances),
										setupNormalMatrix(appContext, mesh.instances),
										...(mesh.animations?.map((animation) => animation.setupAnimation(appContext)) || []),
									]),
							bindVAO(appContext),
							render(appContext, mesh.instances, mesh.drawMode),
						],
						[],
					),
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
		$renderPipeline.forEach((f) => f());
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
		get(renderer).loop && get(renderer).loop();
		//unlock pipeline updates and trigger next update
		running.set(3);
		//run pipeline updates
		get(renderPipeline).forEach((f) => f());
		//lock pipeline updates to batch changes that come from other sources than loop
		running.set(4);
		requestAnimationFrame(loop);
	}
});

//this is necessary because the store needs to be subscribed to to be activated
const unsub = renderLoopStore.subscribe((value) => {
	//console.log("render loop store subscribed", value);
});
