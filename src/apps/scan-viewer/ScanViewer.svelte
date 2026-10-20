<script>
import { onDestroy, onMount, setContext } from "svelte";
import { get } from "svelte/store";
import { createOrbitControls } from "../../interactivity/orbit-controls.js";
import { createPointLight } from "../../lights/point-light.js";
import { createEngine } from "../../store/engine.js";
import { createSceneUniforms } from "./scene-uniforms.js";
import { createSurface } from "./surface.js";

export let background = [1, 1, 1, 1];

// Data X stays world X, data Y goes to world -Z and data Z (height) goes to world Y.
const axisSwap = new Float32Array([1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1]);
const fov = 40;

let canvas;
let controls;
let layers = new Map();
let zScale = 1;
const engine = createEngine();
const sceneUniforms = createSceneUniforms();
setContext("svelte-gl", engine);

export function setBackground(rgba) {
	engine.renderer.update((renderer) => ({ ...renderer, backgroundColor: rgba }));
}

export function resize() {
	engine.renderer.resize();
}

export function setLayers(inputs) {
	for (const layer of layers.values()) {
		layer.heights.destroy();
	}
	const surfaces = inputs.filter((input) => input.kind === "surface");
	layers = new Map(surfaces.map((input) => [input.id, createSurface(input.data, sceneUniforms)]));
	const { min, max } = getBounds(surfaces);
	const center = min.map((value, i) => (value + max[i]) / 2);
	sceneUniforms.setOrigin(center);
	const radius = Math.hypot(max[0] - min[0], max[1] - min[1], (max[2] - min[2]) * zScale) / 2 || 1;
	frame(radius);

	const materials = [];
	const meshes = [];
	for (const surface of layers.values()) {
		const material = engine.createMaterial({ diffuse: [0.8, 0.8, 0.8], metalness: 0 });
		materials.push(material);
		meshes.push(
			engine.createObject({
				attributes: {},
				vertexCount: surface.vertexCount,
				drawMode: "TRIANGLES",
				matrix: axisSwap,
				material,
				animations: [surface.animation],
			}),
		);
	}
	// Single key light until the light rig of step 4.2.
	engine.lights.set([
		engine.createLight(
			createPointLight({
				position: [-radius, 2 * radius, radius],
				color: [1, 1, 1],
				intensity: 3,
				cutoffDistance: 0,
				decayExponent: 0,
			}),
		),
	]);
	engine.materials.set(materials);
	engine.scene.set(meshes);
}

export function updateLayerData(id, data) {
	layers.get(id)?.heights.update(data);
	engine.invalidate();
}

export function setZScale(scale) {
	zScale = scale;
	sceneUniforms.setZScale(scale);
	engine.invalidate();
}

function getBounds(surfaces) {
	const min = [0, 0, 0];
	const max = [0, 0, 0];
	surfaces.forEach(({ data }, index) => {
		let zMin = Number.POSITIVE_INFINITY;
		let zMax = Number.NEGATIVE_INFINITY;
		for (const z of data.distanceData) {
			if (z < zMin) zMin = z;
			if (z > zMax) zMax = z;
		}
		const box = [Math.min(data.x0, data.x1), Math.min(data.y0, data.y1), zMin];
		const boxMax = [Math.max(data.x0, data.x1), Math.max(data.y0, data.y1), zMax];
		for (let i = 0; i < 3; i++) {
			min[i] = index === 0 ? box[i] : Math.min(min[i], box[i]);
			max[i] = index === 0 ? boxMax[i] : Math.max(max[i], boxMax[i]);
		}
	});
	return { min, max };
}

function frame(radius) {
	const distance = radius / Math.sin((fov * Math.PI) / 360);
	// Seen from the -Y side of the data, above it and a little to the left.
	const direction = [-0.5, 0.9, 1];
	const length = Math.hypot(...direction);
	engine.camera.set({
		...get(engine.camera),
		position: direction.map((value) => (value / length) * distance),
		target: [0, 0, 0],
		fov,
		near: distance / 100,
		far: distance * 10,
	});
}

onMount(() => {
	engine.renderer.update((renderer) => ({
		...renderer,
		canvas,
		backgroundColor: background,
		ambientLightColor: [0xffffff, 1],
		enabled: true,
	}));
	// Temporary camera interaction until the turntable controls of step 6.1.
	controls = createOrbitControls(canvas, engine.camera);
});

onDestroy(() => {
	controls?.destroy();
	engine.destroy();
});
</script>

<canvas bind:this={canvas}></canvas>

<style>
	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
</style>
