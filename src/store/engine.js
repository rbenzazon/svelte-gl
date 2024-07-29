import { create, invert, transpose, identity, lookAt, perspective } from "gl-matrix/esm/mat4.js";
import { derived, get, writable } from "svelte/store";
import {
	setupNormalMatrix,
	initRenderer,
	createProgram,
	endProgramSetup,
	createShaders,
	setupCamera,
	render,
	setupTransformMatrix,
	setupAttributes,
	updateTransformMatrix,
	setupMeshColor,
	updateNormalMatrix,
	deriveNormalMatrix,
} from "./gl.js";

function createRenderer() {
	const { subscribe, set, update } = writable({
		backgroundColor: [2.55, 2.55, 2.55, 1],
		canvas: null,
		camera: null,
		//worldMatrix: null,
		meshes: [],
		lights: [],
		toneMappings: [],
		loop: null,
	});
	return {
		subscribe,
		setCamera: (position = [0, 0, -1], target = [0, 0, 0], fov = 80, near = 0.1, far = 1000, up = [0, 1, 0]) =>
			update((renderer) => {
				renderer.camera = {
					fov,
					near,
					far,
					position,
					target,
					up,
				};
				return renderer;
			}),
		addMesh: (mesh) => {
			const index = get(renderer).meshes.length;

			if (mesh.instances && mesh.instances > 1) {
				var { matrices, unsubs } = new Array(mesh.instances).fill().reduce(
					(acc, curr, instanceIndex) => {
						const { transformMatrix, unsubNormalMatrix } = createMeshMatricesStore(update, index, instanceIndex);
						acc.matrices.push(transformMatrix);
						acc.unsubs.push(unsubNormalMatrix);
						return acc;
					},
					{ matrices: [], unsubs: [] },
				);
			} else {
				var { transformMatrix, unsubNormalMatrix } = createMeshMatricesStore(update, index);
			}
			const meshWithMatrix = {
				...mesh,
				...(matrices ? { matrices, unsubs } : { transformMatrix }),
			};
			update((renderer) => {
				renderer.meshes = [...renderer.meshes, meshWithMatrix];
				return renderer;
			});
			return {
				remove: matrices
					? () => {
							update((renderer) => {
								renderer.meshes = renderer.meshes.filter((m) => m !== meshWithMatrix);
								return renderer;
							});
							unsubNormalMatrix();
						}
					: () => {
							update((renderer) => {
								renderer.meshes = renderer.meshes.filter((m) => m !== meshWithMatrix);
								return renderer;
							});
							meshWithMatrix.unsubs.forEach((unsub) => unsub());
						},
				...(matrices ? { matrices } : { transformMatrix }),
			};
		},
		addLight: (light) => {
			const index = get(renderer).lights.length;
			const store = createLightStore(update, light, index);
			update((renderer) => {
				renderer.lights = [...renderer.lights, store];
				return renderer;
			});
			return {
				remove: () =>
					update((renderer) => {
						renderer.lights = renderer.lights.filter((l) => l !== light);
						return renderer;
					}),
				set: store.set,
			};
		},
		addToneMapping: (toneMapping) =>
			update((renderer) => {
				renderer.toneMappings = [...renderer.toneMappings, toneMapping];
				return renderer;
			}),
		setLoop: (loop) =>
			update((renderer) => {
				renderer.loop = loop;
				return renderer;
			}),
		setCanvas: (canvas) =>
			update((renderer) => {
				renderer.canvas = canvas;
				return renderer;
			}),
		setBackgroundColor: (backgroundColor) =>
			update((renderer) => {
				renderer.backgroundColor = backgroundColor;
				return renderer;
			}),
	};
}

const createLightStore = (parentStoreUpdate, initialProps, lightIndex) => {
	const store = writable(initialProps);
	const { subscribe, set, update } = store;
	const customStore = {
		subscribe,
		set: (props) => {
			update((prev) => {
				if (appContext && get(appContext).program) {
					prev.updateOneLight(appContext, get(renderer).lights, customStore);
				}
				return { ...prev, ...props };
			});
			parentStoreUpdate((renderer) => {
				renderer.lights[lightIndex] = customStore;
				return renderer;
			});
		},
	};
	return customStore;
};

export const renderer = createRenderer();
const defaultWorldMatrix = new Float32Array(16);
identity(defaultWorldMatrix);

const createMeshMatricesStore = (parentStoreUpdate, meshIndex, instanceIndex) => {
	const { subscribe, set } = writable(defaultWorldMatrix);
	const transformMatrix = {
		subscribe,
		set: (matrix) => {
			set(matrix);
			if (appContext && get(appContext).program) {
				// in case of a single program app, let's update the uniform only and draw the single program
				if (get(programs).length === 1) {
					if (instanceIndex == null) {
						updateTransformMatrix(appContext, matrix);
					} else {
						updateInstanceTransformMatrix(appContext, matrix, instanceIndex);
					}
					// update the store to trigger the render
					parentStoreUpdate((renderer) => {
						renderer.meshes[meshIndex].transformMatrix = matrix;
						return renderer;
					});
				} // in case of a multi program app, we need to setup and draw the programs
				else {
					renderState.set({ init: false });
				}
			}
			return matrix;
		},
	};
	const normalMatrixStore = derived(transformMatrix, ($transformMatrix) => {
		const context = get(appContext);
		if (!context.gl) {
			return;
		}
		const normalMatrix = deriveNormalMatrix($transformMatrix);
		if (instanceIndex == null) {
			updateNormalMatrix(context, normalMatrix);
		} else {
			updateInstanceNormalMatrix(context, normalMatrix, instanceIndex);
		}
		return normalMatrix;
	});
	const unsubNormalMatrix = normalMatrixStore.subscribe(() => {});
	return {
		transformMatrix,
		unsubNormalMatrix,
	};
};
//export const worldMatrix = createMeshMatricesStore();

export const programs = derived(renderer, ($renderer) => {
	return $renderer.meshes.map((mesh) => {
		return {
			createProgram,
			mesh,
			/*material: mesh.material,*/
			attributes: mesh.attributes,
			uniforms: mesh.uniforms,
			createShaders: createShaders(),
			endProgramSetup,
		};
	});
});

function createRenderState() {
	const { subscribe, set } = writable({
		init: false,
	});
	return {
		subscribe,
		set,
	};
}
export const renderState = createRenderState();

function createContextStore() {
	const { subscribe, update } = writable({});
	return {
		subscribe,
		update,
	};
}

export const appContext = createContextStore();
// make this store inactive until the conditions are met (single flag?)

/*
Single program apps (one mesh/material) will not need to setup the program again
but multi program apps require to setup the program before rendering if the last changes
affect a program that is not the last one rendered. because the last one rendered is still mounted / in memory of the GPU
this store will be used to know if we need to setup the program before rendering again
todo : map existing compiled programs and decouple draw passes from program setup
*/
export const lastProgramRendered = writable(null);
export const webglapp = derived([renderer, programs], ([$renderer, $programs]) => {
	// todo find a way to avoid this, like init this store only when renderer is ready
	if (
		!$renderer ||
		!$programs ||
		!$renderer.canvas ||
		$programs.length === 0 ||
		!$renderer.camera ||
		$renderer.lights.length === 0
	) {
		console.log("no renderer or programs or canvas");
		return [];
	}

	const numPointLights = $renderer.lights.filter((l) => get(l).type === "point").length;
	const pointLightShader = get($renderer.lights.find((l) => get(l).type === "point")).shader;

	let rendererContext = {
		canvas: $renderer.canvas,
		backgroundColor: $renderer.backgroundColor,
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
	const list = [];

	!get(renderState).init && list.push(initRenderer(rendererContext, appContext));

	//global setup (UBOs, textures, etc)
	/*!get(renderState).init && 
		list.push(*/

	!get(renderState).init &&
		list.push(
			...$programs.reduce((acc, program) => {
				lastProgramRendered.set(program);
				return [
					...acc,
					program.createProgram(appContext),
					program.createShaders(appContext),
					program.endProgramSetup(appContext),
					...(program.mesh.uniforms?.color ? [setupMeshColor(appContext, program.uniforms)] : []),
					setupAttributes(appContext, program.mesh),
					setupCamera(appContext, $renderer.camera),
					setupTransformMatrix(
						appContext,
						program.mesh.instances == null ? get(program.mesh.transformMatrix) : program.mesh.matrices,
						program.mesh.instances,
					),
					setupNormalMatrix(appContext, program.mesh.instances),
					// reduce by type to setup lights once per type
					...[
						...$renderer.lights.reduce((acc, light) => {
							const lightValue = get(light);
							acc.set(lightValue.type, lightValue.setupLights);
							return acc;
						}, new Map()),
					].map(([_, setupLights]) => setupLights(appContext, $renderer.lights)),
				];
			}, []),
		);

	list.push(render(appContext, $programs[0].mesh.instances));
	return list;
});
