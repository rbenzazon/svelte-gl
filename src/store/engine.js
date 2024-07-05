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
	setupLights,
	setupWorldMatrix,
	setupAttributes,
	updateWorldMatrix,
	setupMeshColor,
} from "./gl.js";

function createRenderer() {
	const { subscribe, set, update } = writable({
		backgroundColor: [2.55, 2.55, 2.55, 1],
		canvas: null,
		camera: null,
		//worldMatrix: null,
		meshes: [],
		lights: [],
		loop: null,
	});
	return {
		subscribe,
		setCamera: (fov, near, far, position, target, up) =>
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
		addMesh: (mesh) =>
			update((renderer) => {
				renderer.meshes = [...renderer.meshes, mesh];
				return renderer;
			}),
		addLight: (light) =>
			update((renderer) => {
				renderer.lights = [...renderer.lights, light];
				return renderer;
			}),
		setLoop: (loop) =>
			update((renderer) => {
				renderer.loop = loop;
				return renderer;
			}),
		/*setWorldMAtrix: (worldMatrix) => update(renderer => {
            renderer.worldMatrix = worldMatrix;
            return renderer;
        }),*/
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

export const renderer = createRenderer();
const defaultWorldMatrix = new Float32Array(16);
identity(defaultWorldMatrix);
const createWorldMatrix = () => {
	const { subscribe, set } = writable(defaultWorldMatrix);
	return {
		subscribe,
		set: (worldMatrix) => {
			set(worldMatrix);
			if (appContext && get(appContext).program) {
				// in case of a single program app, let's update the uniform only and draw the single program
				if (get(programs).length === 1) {
					updateWorldMatrix(appContext, worldMatrix);
				} // in case of a multi program app, we need to setup and draw the programs
				else {
					renderState.set({ init: false });
				}
			}
			return worldMatrix;
		},
	};
};
export const worldMatrix = createWorldMatrix();

export const programs = derived(renderer, ($renderer) => {
	return $renderer.meshes.map((mesh) => {
		return {
			createProgram,
			mesh,
			material: mesh.material,
			attributes: mesh.attributes,
			uniforms: mesh.uniforms,
			createShaders: createShaders(mesh.material, mesh.attributes, mesh.uniforms),
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
*/
export const lastProgramRendered = writable(null);

export const normalMatrix = derived(worldMatrix, ($worldMatrix) => {
	const normalMatrix = create();
	const worldMatrix = $worldMatrix || defaultWorldMatrix;
	invert(normalMatrix, worldMatrix);
	transpose(normalMatrix, normalMatrix);
	const context = get(appContext);
	if (!context.gl) {
		return normalMatrix;
	}
	const gl = context.gl;
	const program = context.program;
	const normalMatrixLocation = gl.getUniformLocation(program, "normalMatrix");
	gl.uniformMatrix4fv(normalMatrixLocation, false, normalMatrix);
	return normalMatrix;
});

export const webglapp = derived([renderer, programs, worldMatrix], ([$renderer, $programs, $worldMatrix]) => {
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

	let rendererContext = {
		canvas: $renderer.canvas,
		backgroundColor: $renderer.backgroundColor,
		numPointLights: $renderer.lights.filter((l) => l.type === "point").length,
	};
	const list = [];

	!get(renderState).init && list.push(initRenderer(rendererContext, appContext));

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
					/* these uniforms are probably common to any program */
					setupCamera(appContext, $renderer.camera),
					setupWorldMatrix(appContext, get(worldMatrix)),
					setupNormalMatrix(appContext),
					setupLights(appContext, $renderer.lights),
				];
			}, []),
		);

	list.push(render(appContext));
	return list;
});
