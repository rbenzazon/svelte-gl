<script>
import { onDestroy, onMount, setContext } from "svelte";
import { get } from "svelte/store";
import { createOrbitControls } from "../../interactivity/orbit-controls.js";
import { createEngine } from "../../store/engine.js";
import { createRigLights, defaultLights } from "./light-rig.js";
import { createSceneUniforms } from "./scene-uniforms.js";
import { createSurface, createSurfaceMaterial } from "./surface.js";

export let background = [1, 1, 1, 1];

// Data X stays world X, data Y goes to world -Z and data Z (height) goes to world Y.
const axisSwap = new Float32Array([1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1]);
const fov = 40;

let canvas;
let controls;
let layers = new Map();
let zScale = 1;
let halfSize = [1, 1];
let homeView = null;
let framed = false;
let lightRig = { lights: defaultLights, attached: "camera" };
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
	halfSize = [(max[0] - min[0]) / 2 || 1, (max[1] - min[1]) / 2 || 1];
	// Layer changes do not move the camera; only the first data frames it.
	if (!framed) {
		frame(Math.hypot(max[0] - min[0], max[1] - min[1], (max[2] - min[2]) * zScale) / 2 || 1);
		framed = surfaces.length > 0;
	}

	const materials = [];
	const meshes = [];
	for (const input of surfaces) {
		const surface = layers.get(input.id);
		const material = engine.createMaterial(createSurfaceMaterial(input.material));
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
	applyLights();
	engine.materials.set(materials);
	engine.scene.set(meshes);
}

export function setLights(lights, attached = "camera") {
	lightRig = { lights, attached };
	applyLights();
}

function applyLights() {
	if (!homeView) {
		return;
	}
	const values = createRigLights(lightRig.lights, lightRig.attached, halfSize, homeView);
	const current = get(engine.lights);
	// Programs keep the light stores they were built with, so an update with the same count reuses them.
	if (current.length === values.length) {
		current.forEach((light, i) => light.set(values[i]));
	} else {
		engine.lights.set(values.map((value) => engine.createLight(value)));
	}
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
	homeView = engine.camera.view;
}

onMount(() => {
	engine.renderer.update((renderer) => ({
		...renderer,
		canvas,
		backgroundColor: background,
		ambientLightColor: [0xffffff, 0.6],
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
