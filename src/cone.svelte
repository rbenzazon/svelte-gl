<script type="module">
import { fromTranslation } from "gl-matrix/esm/mat4.js";
import { onDestroy, onMount } from "svelte";
import { get } from "svelte/store";
import Menu from "./Menu.svelte";
import { createZeroMatrix } from "./geometries/common.js";
import { createCone } from "./geometries/cone.js";
import { createCylinder } from "./geometries/cylinder.js";
import { createDebugObject } from "./geometries/debug.js";
import { createOrbitControls } from "./interactivity/orbit-controls.js";
import { createPointLight } from "./lights/point-light.js";
import { createSpecular } from "./material/specular/specular.js";
import { createDebugNormalsProgram } from "./store/debug-program.js";
import { createEngine } from "./store/engine.js";
import { createTexture } from "./texture/texture.js";

// The cone next to a cylinder of the same size, material and light, with their normals drawn as lines.
// Both use a checker texture, to check their UVs.
let canvas;
let engine;
let controls;
let showNormals = true;
let shapes = [];
let normals = [];

function commit() {
	const layers = [...shapes, ...(showNormals ? normals : [])];
	engine.materials.set([...new Set(layers.map(({ material }) => material))]);
	engine.scene.set(layers.map(({ mesh }) => mesh));
}

function toggleNormals() {
	showNormals = !showNormals;
	commit();
}

onMount(async () => {
	engine = createEngine();
	engine.renderer.set({
		...get(engine.renderer),
		canvas,
		backgroundColor: [0.11, 0.14, 0.19, 1],
		ambientLightColor: [[1, 1, 1], 0.15],
	});
	engine.camera.set({ position: [0, 2.5, 5.5], target: [0, 0.6, 0], fov: 45 });
	engine.lights.set([
		engine.createLight(
			createPointLight({ position: [3, 4, 4], color: [1, 1, 1], intensity: 1.2, cutoffDistance: 0, decayExponent: 0 }),
		),
	]);

	const url = "textures/checker-map_tho.png";
	// The cone samples its texture in circular coordinates (u divided by v), so the checker does not spiral.
	const [coneMap, cylinderMap] = await Promise.all([
		createTexture({ url, type: "diffuse", coordinateSpace: "circular" }),
		createTexture({ url, type: "diffuse" }),
	]);
	const createShapeMaterial = (diffuseMap) =>
		engine.createMaterial({
			diffuse: [1, 1, 1],
			metalness: 0,
			specular: createSpecular({ roughness: 0.4 }),
			diffuseMap,
		});
	const normalsMaterial = engine.createMaterial({
		diffuse: [1, 1, 1],
		metalness: 0,
		program: createDebugNormalsProgram(),
	});

	// The cone stands on y = 0; the cylinder is centered, so it is lifted by half its height.
	const placed = [
		[createCone(1, 1.5, 24), [-1.4, 0, 0], createShapeMaterial(coneMap)],
		[createCylinder(1, 1.5, 24), [1.4, 0.75, 0], createShapeMaterial(cylinderMap)],
	];
	shapes = placed.map(([geometry, offset, material]) => ({
		material,
		mesh: engine.createObject({ ...geometry, matrix: fromTranslation(createZeroMatrix(), offset), material }),
	}));
	normals = shapes.map(({ mesh }) => ({
		material: normalsMaterial,
		mesh: engine.createObject({ ...createDebugObject(mesh), material: normalsMaterial }),
	}));
	commit();

	engine.renderer.set({ ...get(engine.renderer), enabled: true });
	controls = createOrbitControls(canvas, engine.camera);
});

onDestroy(() => {
	controls?.destroy();
	engine?.destroy();
});
</script>

<canvas bind:this={canvas}></canvas>
<button class="toggle" on:click={toggleNormals}>normals: {showNormals ? "on" : "off"}</button>
<Menu />

<style>
	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
	.toggle {
		position: absolute;
		right: 12px;
		bottom: 12px;
		padding: 6px 10px;
		font-size: 0.85rem;
	}
</style>
