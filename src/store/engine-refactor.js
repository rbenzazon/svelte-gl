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
	bindDefaultFramebuffer,
	getCameraProjectionView,
	enableBlend,
	disableBlend,
	setFaceWinding,
} from "./gl-refactor.js";
import { hasSameShallow } from "../utils/set.js";
import { hasSameShallow as arrayHasSameShallow, optionalPropsDeepEqual } from "../utils/array.js";
import { isLight } from "../lights/lights.js";
import { convertToVector3 } from "../color/color-space.js";
import { determinant, getTranslation, identity, invert, multiply } from "gl-matrix/esm/mat4.js";
import { transformMat4 } from "gl-matrix/esm/vec3.js";
import { updateOneLight } from "../lights/point-light.js";
import { camera } from "./camera.js";
import { createZeroMatrix } from "../geometries/common.js";

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
	// the cache is made to compare the previous value with the new one
	let cache = initialValue;
	// some values have a different internal format
	let processed = new Map();
	const store = writable(initialValue);
	const { subscribe, update } = store;

	//private store to keep track of updates
	const revisionStore = writable(0);

	/**
	 * Update functions are called when a different value is set.
	 * processed values are updated here
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
				const programs = findMaterialProgram();
				if (programs) {
					programs.forEach((program) => {
						setupAmbientLight(appContext.programMap.get(program), processed.get("ambientLightColor"));
					});
				}
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
export const renderer = createRenderer();

function createSceneStore() {
	/** @type {SvelteGLSceneStore} */
	const store = writable([]);

	const revisionStore = writable(0);
	const { subscribe, update } = store;
	function customUpdate(updater) {
		try {
			update((scene) => {
				const next = updater(scene);
				revisionStore.update((revision) => revision + 1);
				return next;
			});
		} catch (e) {
			console.log(e);
		}
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
const defaultWorldMatrix = createZeroMatrix();
identity(defaultWorldMatrix);

//create typeguard for SvelteGLSingleMesh and SvelteGLInstancedMesh
/**
 * @param {SvelteGLMesh} mesh
 * @returns {mesh is SvelteGLSingleMesh}
 */
function isSvelteGLSingleMesh(mesh) {
	return "matrix" in mesh;
}
/**
 * @param {SvelteGLMesh} mesh
 * @returns {mesh is SvelteGLInstancedMesh}
 */
function isSvelteGLInstancedMesh(mesh) {
	return "matrices" in mesh;
}

function findMesh(matrixStore) {
	const mesh = get(scene).find((node) => {
		return (
			(isSvelteGLSingleMesh(node) && node.matrix === matrixStore) ||
			(isSvelteGLInstancedMesh(node) && node.matrices.includes(matrixStore))
		);
	});
	return mesh;
}

function findProgram(mesh) {
	const program = get(programs).find((program) => program.allMeshes !== true && program.meshes.includes(mesh));
	return program;
}

function findMaterialProgram() {
	const matPrograms = get(programs).filter((program) => program.meshes?.length !== 0 && program.allMeshes !== true);
	return matPrograms;
}

const createMeshMatrixStore = (mesh, rendererUpdate, initialValue, instanceIndex = NaN) => {
	const { subscribe, set } = writable(initialValue || defaultWorldMatrix);
	const transformMatrix = {
		subscribe,
		set: (nextMatrix) => {
			set(nextMatrix);
			const program = findProgram(mesh);
			if (isNaN(instanceIndex)) {
				updateTransformMatrix(program, nextMatrix);
				updateNormalMatrix(program, nextMatrix);
			} else {
				updateInstanceTransformMatrix(program, mesh, nextMatrix, instanceIndex);
			}
			rendererUpdate(get(renderer));
		},
	};
	return transformMatrix;
};

/**
 *
 * @param {*} value
 * @param {*} symmetry
 * @param {*} symmetryAxis
 * @returns {SvelteGLMesh}
 */
export function create3DObject(value, symmetry = false, symmetryAxis = [0, 0, 0]) {
	if (symmetry) {
		console.log("symmetry");

		/*const newPositions = [];
		for (let i = 0; i < value.attributes.positions.length / 3; i++) {
			const x = value.attributes.positions[i * 3];
			const y = value.attributes.positions[i * 3 + 1];
			const z = value.attributes.positions[i * 3 + 2];
			const [sx, sy, sz] = symmetryAxis;
			newPositions.push(x + 2 * (sx - x), y + 2 * (sy - y), z + 2 * (sz - z));
		}
		value.attributes.positions = newPositions;*/
		const newNormals = [];
		for (let i = 0; i < value.attributes.normals.length / 3; i++) {
			const x = value.attributes.normals[i * 3];
			const y = value.attributes.normals[i * 3 + 1];
			const z = value.attributes.normals[i * 3 + 2];
			//calculate normals in symmetry taking symmetryAxis into account
			const [sx, sy, sz] = symmetryAxis;
			newNormals.push(x * -sx, y * -sy, z * -sz);
		}
		value.attributes.normals = newNormals;
	}
	if (value.matrix != null) {
		value.matrix = createMeshMatrixStore(value, renderer.set, value.matrix);
	} else if (value.matrices != null) {
		value.matrices = value.matrices.map((matrix, index) => createMeshMatrixStore(value, renderer.set, matrix, index));
	}
	return value;
}

let meshCache;

function objectsHaveSameMatrix(a, b) {
	for (let i = 0; i < a.length; i++) {
		if (arrayHasSameShallow(get(a[i].matrix), get(b[i].matrix))) {
			return false;
		}
	}
	return true;
}

export const meshes = derived([scene], ([$scene]) => {
	// type bug from svelte, $scene is an array but  the type system thinks wrongly that it's destructured
	const meshNodes = $scene.filter((node) => node.attributes != null);
	//using throw to cancel update flow when unchanged
	// maybe when matrix change we need to update renderer and not programs, because the programs are the same
	// cancellation wrong, doesn't work, interrupts the whole task
	//&& objectsHaveSameMatrix(meshCache, meshNodes)
	if (arrayHasSameShallow(meshCache, meshNodes)) {
		throw new Error("meshes unchanged");
	} else {
		meshCache = meshNodes;
	}
	return meshNodes;
});

function createLightsStore() {
	/** @type {import("svelte/store").Writable<Array<SvelteGLLightCustomStore>>} */
	const { subscribe, set } = writable([]);
	const lights = {
		subscribe,
		set: (next) => {
			set(next);
		},
	};
	return lights;
}
export const lights = createLightsStore();

export const numLigths = derived([lights], ([$lights]) => {
	return $lights.length;
});

//SvelteGLLightStore
/**
 * @typedef {import("svelte/store").Writable<import("../lights/point-light.js").SvelteGLLightValue>} SvelteGLLightStore
 */

/**
 * @typedef {Object} SvelteGLLightCustomStore
 * @property {SvelteGLLightStore['subscribe']} subscribe
 * @property {SvelteGLLightStore['set']} set
 */

/**
 *
 * @param {import("../lights/point-light.js").SvelteGLLightValue} initialProps
 * @returns {SvelteGLLightCustomStore}
 */
export const createLightStore = (initialProps) => {
	/** @type {SvelteGLLightStore} */
	const store = writable(initialProps);
	const { subscribe, set } = store;
	const light = {
		subscribe,
		set: (props) => {
			set(props);
			updateOneLight(get(lights), light);
			lights.set(get(lights));
			renderer.set(get(renderer));
		},
	};
	return light;
};

export const renderPasses = writable([]);

/**
 * @typedef {Object} MaterialCustomStore
 * @property {MaterialStore['subscribe']} subscribe
 * @property {MaterialStore['set']} set
 */
/**
 * @param {SvelteGLMaterial} initialProps
 * @return {MaterialCustomStore}
 */
export function createMaterialStore(initialProps) {
	/** @type {MaterialStore} */
	const store = writable(initialProps);
	const { subscribe, set } = store;
	const material = {
		subscribe,
		set: (props) => {
			set(props);
			materials.set(get(materials));
			//renderer.set(get(renderer));
		},
	};
	return material;
}

function createMaterialsStore() {
	const { subscribe, set } = writable([]);
	const materials = {
		subscribe,
		set: (next) => {
			set(next);
		},
	};
	return materials;
}

/** @type {import("svelte/store").Writable<MaterialCustomStore[]>} */
export const materials = writable([]);

export const RENDER_PASS_TYPES = {
	FRAMEBUFFER_TO_TEXTURE: 0,
};

function isTransparent(material) {
	return material?.opacity < 1 || material?.transparent;
}

function sortTransparency(a, b) {
	return (isTransparent(a.material) ? 1 : -1) - (isTransparent(b.material) ? 1 : -1);
}

function sortMeshesByZ(programs) {
	if (programs.length === 0 || get(renderer).canvas == null) {
		return;
	}
	let transparent = false;
	const canvas = get(renderer).canvas;
	const { projection, view } = getCameraProjectionView(get(camera), canvas.width, canvas.height);
	//const inverseView = invert([], view);
	const projScreen = multiply([], projection, view);

	programs.forEach((program) => {
		if (transparent || isTransparent(program.material)) {
			transparent = true;
			program.meshes.forEach((mesh, i) => {
				const meshPosition = getTranslation([], mesh.matrix);
				mesh.clipSpacePosition = transformMat4([], meshPosition, projScreen);
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

	return sortedPrograms;
}

export const programs = derived(
	[meshes, numLigths, materials, renderPasses],
	([$meshes, $numLigths, $materials, $renderPasses]) => {
		//console.log("###programs derived");

		let prePasses = $renderPasses
			.filter((pass) => pass.order < 0)
			.reduce((acc, pass) => {
				return acc.concat(...pass.programs);
			}, [])
			.map((program) => ({
				...program,
				updateProgram: [],
				...(program.allMeshes ? { meshes: $meshes } : {}),
			}));

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
					material: get(current),
					meshes: currentNormalMeshes,
				});
			}
			currentSpecialMeshes.forEach((mesh) => {
				const requireTime = mesh.animations?.some((animation) => animation.requireTime);
				acc.push({
					requireTime,
					material: get(current),
					meshes: [mesh],
				});
			});
			return acc;
		}, []);

		programs = programs.sort(sortTransparency);
		sortMeshesByZ(programs);

		// TODO make two different numligth store, one for each light type, when spotlight is supported
		//const pointLights = $lights.filter((l) => get(l).type === "point");
		const numPointLights = $numLigths;

		let pointLightShader;
		if (numPointLights > 0) {
			pointLightShader = get(get(lights)[0]).shader;
		}

		const next = [
			...prePasses,
			...programs.map((p, index) => {
				const firstCall = index === 0;
				const program = {
					...p,
					useProgram,
					setupMaterial: [setupAmbientLight],
					updateProgram: [],
					bindTextures: [],
					createProgram,
					selectProgram,
				};
				reconciliateCacheMap(p, program);

				program.setupProgram = [
					createShaders(p.material, p.meshes, numPointLights, pointLightShader),
					linkProgram,
					validateProgram,
				];
				if (firstCall) {
					program.setFrameBuffer = bindDefaultFramebuffer;
				}
				if (p.material?.specular) {
					program.setupMaterial.push(p.material.specular.setupSpecular);
				}
				if (p.material?.diffuseMap) {
					program.setupMaterial.push(p.material.diffuseMap.setupTexture);
					program.bindTextures.push(p.material.diffuseMap.bindTexture);
				}
				if (p.material?.normalMap) {
					program.setupMaterial.push(p.material.normalMap.setupTexture);
					program.bindTextures.push(p.material.normalMap.bindTexture);
				}
				if (p.material?.roughnessMap) {
					program.setupMaterial.push(p.material.roughnessMap.setupTexture);
					program.bindTextures.push(p.material.roughnessMap.bindTexture);
				}
				if (p.requireTime) {
					program.updateProgram.push(setupTime);
				}
				program.setupMaterial.push(
					...Array.from(
						get(lights).reduce((acc, light) => {
							const lightValue = get(light);
							if (acc.has(lightValue.setupLights)) {
								acc.set(lightValue.setupLights, [...acc.get(lightValue.setupLights), light]);
							} else {
								acc.set(lightValue.setupLights, [light]);
							}
							return acc;
						}, new Map()),
					).map(([setupLights, filteredLights]) => setupLights(filteredLights)),
				);
				return program;
			}),
		];
		clearUnusedCache(next);
		return next;
	},
);

export const renderState = writable({
	init: false,
});

/**
 * Clears the cache map of unused programs and VAOs
 * @param {Object[]} next - The next programs
 * @returns {void}
 */
function clearUnusedCache(next) {
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
			const existingVAO = vaoMap.get(cachedProgram);
			existingVAO.forEach((vao, mesh) => {
				if (!p.meshes.includes(mesh)) {
					existingVAO.delete(mesh);
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
 * @param {Object} p - The program object
 * @param {Object} program - The program store
 * @returns {void}
 */

function reconciliateCacheMap(p, program) {
	const { programMap, vaoMap } = appContext;
	let cachedProgram, cachedGLProgram;
	programMap.forEach((glProgram, programStore) => {
		if (programStore.material === p.material) {
			cachedProgram = programStore;
			cachedGLProgram = glProgram;
		}
	});
	if (cachedProgram != null) {
		const existingVAO = vaoMap.get(cachedProgram);
		if (existingVAO != null) {
			vaoMap.delete(cachedProgram);
			vaoMap.set(program, existingVAO);
		}
		programMap.delete(cachedProgram);
		programMap.set(program, cachedGLProgram);
	}
}

function isStore(obj) {
	return obj != null && obj.subscribe != null;
}

export function selectProgram(programStore) {
	return function selectProgram() {
		const { programMap } = appContext;
		const cachedProgram = programMap.get(programStore);
		appContext.program = cachedProgram;
	};
}

function selectMesh(programStore, mesh) {
	return function selectMesh() {
		const { vaoMap } = appContext;
		const cachedVAO = vaoMap.get(programStore).get(mesh);
		appContext.vao = cachedVAO;
	};
}
//WebGL2RenderingContext
/**
 * @typedef {Object} appContext
 * @property {Map<object,WebGLProgram>} programMap
 * @property {Map<object,Map<object,WebGLVertexArrayObject>>} vaoMap
 * @property {WebGL2RenderingContext} gl
 * @property {WebGLProgram} program
 * @property {vec4} backgroundColor
 * @property {WebGLVertexArrayObject} vao
 */
/**
 * @type {appContext}
 */
export let appContext = {
	programMap: new Map(),
	vaoMap: new Map(),
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
		//console.log("render pipeline derived");

		if (!$renderer.enabled || $running === 4 || $running === 1 || $programs.length === 0) {
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
		//console.log("update map", updateMap.has(renderer), updateMap.has(scene), updateMap.has(camera));

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
		/*
		if(updateMap.has(scene)){
			debugger;
		}
			*/
		pipeline.push(
			...sortedPrograms.reduce((acc, program) => {
				let transitionTransparent = false;
				if (isTransparent(program.material) && !transparent) {
					transparent = true;
					acc.push(enableBlend);
				}
				return [
					...acc,
					...(appContext.programMap.has(program)
						? [program.selectProgram(program), program.useProgram, ...program.bindTextures, ...program.updateProgram]
						: [
								program.createProgram(program),
								...program.setupProgram,
								program.useProgram,
								...program.setupMaterial,
								...program.updateProgram,
							]),
					...(program.setupCamera ? [program.setupCamera] : [...(updateMap.has(camera) ? [setupCamera($camera)] : [])]),
					...(program.setFrameBuffer ? [program.setFrameBuffer] : []),
					...program.meshes.reduce(
						(acc, mesh) => [
							...acc,
							...(appContext.vaoMap.has(program) && appContext.vaoMap.get(program).has(mesh)
								? [
										selectMesh(program, mesh),
										//setupMeshColor(program.material),// is it necessary ?multiple meshes only render with same material so same color
										...(mesh.instances == null
											? [] //setupTransformMatrix(program, mesh, mesh.matrix), setupNormalMatrix(program, mesh)
											: []),
									]
								: [
										setupAttributes(program, mesh),
										...(program.material ? [setupMeshColor(program.material)] : []),
										setupTransformMatrix(program, mesh, mesh.instances == null ? mesh.matrix : mesh.matrices, mesh.instances),
										setupNormalMatrix(program, mesh, mesh.instances),
										...(mesh.animations?.map((animation) => animation.setupAnimation) || []),
									]),
							...(mesh.matrix != null
								? [
										...(mesh.instances != null
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
		get(renderer).loop && get(renderer).loop();
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
