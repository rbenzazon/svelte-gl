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
			if (contextStore && get(contextStore).program) {
				updateWorldMatrix(contextStore, worldMatrix);
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
		rendered: false,
	});
	return {
		subscribe,
		set,
	};
}
export const renderState = createRenderState();

function createContextStore() {
	const { subscribe, set } = writable({});
	return {
		subscribe,
		set: (context) => {
			set(context);
		},
	};
}

export const contextStore = createContextStore();
// make this store inactive until the conditions are met (single flag?)

export const lastProgramRendered = writable(null);

export const normalMatrix = derived(worldMatrix, ($worldMatrix) => {
	const normalMatrix = create();
	const worldMatrix = $worldMatrix || defaultWorldMatrix;
	invert(normalMatrix, worldMatrix);
	transpose(normalMatrix, normalMatrix);
	const context = get(contextStore);
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
	let context = {
		canvas: $renderer.canvas,
		backgroundColor: $renderer.backgroundColor,
	};

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

	const initInstructions = get(renderState).init ? [] : [initRenderer(context, contextStore)];

	const setupInstructions = get(renderState).init
		? []
		: $programs.reduce((acc, program) => {
				lastProgramRendered.set(program);
				return [
					...acc,
					program.createProgram(contextStore),
					program.createShaders(contextStore),
					program.endProgramSetup(contextStore),
					...(program.mesh.uniforms?.color ? [setupMeshColor(contextStore, program.uniforms)] : []),
					setupCamera(contextStore, $renderer.camera),
					setupWorldMatrix(contextStore, get(worldMatrix)),
					setupNormalMatrix(contextStore),
					setupAttributes(contextStore, program.mesh),
					setupLights(contextStore, $renderer.lights),
				];
			}, []);

	const list = [...initInstructions, ...setupInstructions, render(contextStore)];
	//list.forEach(fn => console.log(fn));
	return list;
});
