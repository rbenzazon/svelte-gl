import { identity } from "gl-matrix/esm/mat4.js";
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
	setupAmbientLight,
	updateTransformMatrix,
	updateInstanceTransformMatrix,
	setupMeshColor,
	updateNormalMatrix,
	updateInstanceNormalMatrix,
	derivateNormalMatrix,
} from "./gl.js";
import { convertToVector4, convertToVector3 } from "../color/color-space.js";

function createRenderer() {
	const { subscribe, set, update } = writable({
		backgroundColor: [2.55, 2.55, 2.55, 1],
		canvas: null,
		camera: null,
		meshes: [],
		lights: [],
		toneMappings: [],
		loop: null,
		enabled: false,
		ambientLightColor: [0, 0, 0],
	});
	return {
		subscribe,
		setCamera: (...rest) => {
			updateCamera(...rest);
			return {
				set: (...rest) => {
					updateCamera(...rest);
					setupCamera(appContext, get(renderer).camera)();
				},
				get: () => get(renderer).camera,
			};
			function updateCamera(position = [0, 0, -1], target = [0, 0, 0], fov = 80, near = 0.1, far = 1000, up = [0, 1, 0]) {
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
				});
			}
		},

		addMesh: (mesh) => {
			const index = get(renderer).meshes.length;

			if (mesh.instances && mesh.instances > 1) {
				var { matrices, unsubs } = new Array(mesh.instances).fill().reduce(
					(acc, curr, instanceIndex) => {
						const { transformMatrix, unsubNormalMatrix } = createMeshMatricesStore(
							update,
							index,
							instanceIndex,
							mesh.matrices[instanceIndex],
						);
						acc.matrices.push(transformMatrix);
						acc.unsubs.push(unsubNormalMatrix);
						return acc;
					},
					{ matrices: [], unsubs: [] },
				);
			} else {
				var { transformMatrix, unsubNormalMatrix } = createMeshMatricesStore(update, index);
			}
			mesh.material = {
				metalness: 0,
				...mesh.material,
			};
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
				material: mesh.material,
			};
		},
		setAmbientLight: (color, intensity) =>{
			update((renderer) => {
				renderer.ambientLightColor = convertToVector3(color).map(c=>c*intensity);
				return renderer
			});
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
				renderer.backgroundColor = convertToVector4(backgroundColor);
				return renderer;
			}),
		start: () =>
			update((renderer) => {
				renderer.enabled = true;
				return renderer;
			}),
		stop: () =>
			update((renderer) => {
				renderer.enabled = false;
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

const createMeshMatricesStore = (parentStoreUpdate, meshIndex, instanceIndex, initialValue) => {
	const { subscribe, set } = writable(initialValue || defaultWorldMatrix);
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
		const normalMatrix = derivateNormalMatrix($transformMatrix);
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

export const programs = derived(renderer, ($renderer) => {
	return $renderer.meshes.map((mesh) => {
		return {
			createProgram,
			mesh,
			attributes: mesh.attributes,
			uniforms: mesh.uniforms,
			createShaders: createShaders(),
			endProgramSetup,
		};
	});
});

export const renderState = writable({
	init: false,
});

export const appContext = writable({});

/*
Single program apps (one mesh/material) will not need to setup the program again
but multi program apps require to setup the program before rendering if the last changes
affect a program that is not the last one rendered. because the last one rendered is still mounted / in memory of the GPU
this store will be used to know if we need to setup the program before rendering again
todo : map existing compiled programs and decouple draw passes from program creation or setup
*/
export const lastProgramRendered = writable(null);

const emptyApp = [];
const webglapp = derived(
	[renderer, programs],
	([$renderer, $programs]) => {
		// if renderer.enabled is false, the scene is being setup, we should not render
		// if running is 4, we let the loop run completly as a way to batch scene updates
		if (!$renderer.enabled || get(running) === 4) {
			//log("webglapp not ready");
			return emptyApp;
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

		appContext.update((appContext) => ({
			...appContext,
			...rendererContext,
		}));

		!get(renderState).init && list.push(initRenderer(rendererContext, appContext));
		!get(renderState).init &&
			list.push(
				...$programs.reduce((acc, program) => {
					console.log("material", program.mesh.material);
					console.log("ambientLightColor", $renderer.ambientLightColor);
					lastProgramRendered.set(program);
					return [
						...acc,
						program.createProgram(appContext),
						program.createShaders(appContext, program.mesh),
						program.endProgramSetup(appContext),
						setupAmbientLight(appContext, $renderer.ambientLightColor),
						...(program.mesh.material ? [setupMeshColor(appContext, program.mesh.material)] : []),
						setupAttributes(appContext, program.mesh),
						setupCamera(appContext, $renderer.camera),
						...(program.mesh?.material?.specular ? [program.mesh.material.specular.setupSpecular(appContext)] : []),
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
	},
	emptyApp,
);

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
const renderLoopStore = derived([webglapp], ([$webglapp]) => {
	if ($webglapp.length === 0) {
		return 0;
	}
	if (!get(renderState).init && get(running) === 0) {
		running.set(1);
		$webglapp.forEach((f) => f());
		running.set(2);
		return 1;
	} else if (get(running) === 2) {
		running.set(3);
		requestAnimationFrame(loop);
		return 2;
	}
	async function loop() {
		// skipping this iteration is previous one not finished
		if (get(running) !== 4) {
			running.set(4);
			get(renderer).loop && get(renderer).loop();
			$webglapp.forEach((f) => f());
			running.set(3);
		}
		requestAnimationFrame(loop);
	}
});

const unsub = renderLoopStore.subscribe((value) => {
	console.log("render loop store subscribed", value);
});
