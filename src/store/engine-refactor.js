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

	function getProcessed() {
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
	}

	//specific on change handling, might be useless
	function customSet(next) {
		customUpdate((renderer) => next);
	}

	return {
		subscribe,
		set: customSet,
		update: customUpdate,
		getProcessed,
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
			//console.log("camera update");
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
		const withoutSpecialMeshes = materialMeshes.filter((node, index) => {
			if (!specialMeshes.has(node)) {
				materialMeshes.splice(index, 1);
				return true;
			}
			return false;
		});
		if (withoutSpecialMeshes.length > 0) {
			acc.push({
				material: current,
				meshes: withoutSpecialMeshes,
			});
		}
		const currentSpecialMeshes = materialMeshes.filter((node) => specialMeshes.has(node));
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

const emptyApp = [];
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

const webglapp = derived(
	[renderer, programs, scene, camera, running],
	([$renderer, $programs, $scene, $camera, $running]) => {
		// if renderer.enabled is false, the scene is being setup, we should not render
		// if running is 4, we let the loop run completly as a way to batch scene updates
		if (!$renderer.enabled || $running === 4 || $running === 1) {
			console.log("webglapp update cancelled");
			//TODO maybe throw here to cancel the update flow
			return emptyApp;
		}
		console.log("webglapp derived", $running);
		const rendererValue = get(renderer);
		const rendererRevision = renderer.revision;
		const cameraValue = get(camera);
		const cameraRevision = camera.revision;
		const sceneValue = get(scene);
		const sceneRevision = scene.revision;
		// this map will tell you which stores have been updated since last updated() call
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
		const lights = $scene.filter(isStore).filter(isLight);

		const pointLights = lights.filter((l) => get(l).type === "point");
		const numPointLights = pointLights.length;
		let pointLightShader;
		if (numPointLights > 0) {
			pointLightShader = get(pointLights[0]).shader;
		}
		//this is moved into program items as p.requireTime prop to handle inside the program loop
		/*const requireTime = $programs.some((p) =>
			p.meshes.some(m => m.animations
				?.some((animation) => animation.requireTime)));*/
		const rendererValues = renderer.getProcessed();
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
		const renderPipeline = [];

		appContext.update((appContext) => ({
			...appContext,
			...rendererContext,
		}));

		const init = get(renderState).init;
		if (!init) {
			renderPipeline.push(initRenderer(rendererContext, appContext));
		}
		/*!init &&*/
		renderPipeline.push(
			...$programs.reduce((acc, program) => {
				//console.log("program", program);
				//console.log("appContext", get(appContext));

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
											? [setupTransformMatrix(appContext, get(mesh.transformMatrix)), setupNormalMatrix(appContext)]
											: []),
									]
								: [
										setupAttributes(appContext, mesh),
										setupMeshColor(appContext, program.material),

										setupTransformMatrix(
											appContext,
											mesh.instances == null ? get(mesh.transformMatrix) : mesh.matrices,
											mesh.instances,
										),
										setupNormalMatrix(appContext, mesh.instances),
										...(mesh.animations?.map((animation) => animation.setupAnimation(appContext)) || []),
										// reduce by type to setup lights once per type
									]),
							bindVAO(appContext),
							render(appContext, mesh.instances, mesh.drawMode),
						],
						[],
					),
				];
			}, []),
		);
		console.log("renderPipeline", renderPipeline.length, renderPipeline);

		return renderPipeline;
	},
	emptyApp,
);

const renderLoopStore = derived([webglapp], ([$webglapp]) => {
	if ($webglapp.length === 0) {
		//console.log("renderLoopStore update cancelled");
		return 0;
	}
	if (!get(renderState).init && get(running) === 0) {
		running.set(1);
		$webglapp.forEach((f) => f());
		renderState.set({
			init: true,
		});
		running.set(2);
		//console.log("renderLoopStore finish init");
		return 1;
	} else if (get(running) === 2) {
		running.set(3);
		requestAnimationFrame(loop);
		//console.log("renderLoopStore starting loop");
		return 2;
	}
	//console.log("renderLoopStore none", get(running), get(renderState).init);

	async function loop() {
		// skipping this iteration is previous one not finished
		if (get(running) !== 4) {
			console.log("renderLoopStore loop start", get(webglapp).length);

			running.set(4);
			get(renderer).loop && get(renderer).loop();
			running.set(3);
			get(webglapp).forEach((f) => f());

			console.log("renderLoopStore loop finish, running 3");
		}
		//console.log("renderLoopStore requestAnimationFrame");
		requestAnimationFrame(loop);
	}
});

const unsub = renderLoopStore.subscribe((value) => {
	console.log("render loop store subscribed", value);
});
