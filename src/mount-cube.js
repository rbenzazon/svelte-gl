import { identity } from "gl-matrix/esm/mat4.js";
import { get } from "svelte/store";
import { createZeroMatrix } from "./geometries/common.js";
import { createCube } from "./geometries/cube.js";
import { createOrbitControls } from "./interactivity/orbit-controls.js";
import { createPointLight } from "./lights/point-light.js";
import { createEngine } from "./store/engine.js";

/**
 * The page owns the canvas. This only receives the element and builds an engine for it.
 * @param {HTMLCanvasElement} canvas
 * @param {{ color: number[], background: number }} options
 */
export function mountCube(canvas, { color, background }) {
	const engine = createEngine();
	engine.renderer.set({
		...get(engine.renderer),
		canvas,
		backgroundColor: background,
		ambientLightColor: [0xffffff, 0.1],
	});
	engine.camera.set({
		position: [0, 4, -6],
		target: [0, 0, 0],
		fov: 60,
	});
	const material = engine.createMaterial({
		diffuse: color,
		metalness: 0,
	});
	const matrix = identity(createZeroMatrix());
	engine.materials.set([material]);
	engine.scene.set([
		engine.createObject({
			...createCube(),
			instances: 1,
			matrices: [matrix],
			material,
		}),
	]);
	engine.lights.set([
		engine.createLight(
			createPointLight({
				position: [-2, 3, -2],
				color: [1, 1, 1],
				intensity: 20,
				cutoffDistance: 0,
				decayExponent: 2,
			}),
		),
	]);
	engine.renderer.set({
		...get(engine.renderer),
		loop() {},
		enabled: true,
	});
	createOrbitControls(canvas, engine.camera);
	return engine;
}
