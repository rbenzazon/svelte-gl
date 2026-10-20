<script type="module">
import { identity, translate } from "gl-matrix/esm/mat4.js";
import { onMount } from "svelte";
import Menu from "./Menu.svelte";
import { skyblue } from "./color/color-keywords.js";
import { createZeroMatrix } from "./geometries/common.js";
import { createCube } from "./geometries/cube.js";
import { createOrbitControls } from "./interactivity/orbit-controls.js";
import { createPointLight } from "./lights/point-light.js";
import { camera } from "./store/camera.js";
import { create3DObject } from "./store/create-object.js";
import "./store/engine.js";
import { createLightStore, lights } from "./store/lights.js";
import { createMaterialStore, materials } from "./store/materials.js";
import { renderer } from "./store/renderer.js";
import { scene } from "./store/scene.js";

let canvas;
let projection = "perspective";

function toggleProjection() {
	projection = projection === "perspective" ? "orthographic" : "perspective";
	$camera = { ...$camera, projection };
}

onMount(() => {
	$renderer = {
		...$renderer,
		canvas,
		backgroundColor: skyblue,
		ambientLightColor: [0xffffff, 0.15],
	};
	$camera = {
		...$camera,
		position: [0, 2, -12],
		target: [0, 0, 0],
		fov: 40,
		projection,
	};

	const material = createMaterialStore({
		diffuse: [0.9, 0.45, 0.35],
		metalness: 0,
	});
	const matrices = [];
	for (let y = -1; y <= 1; y++) {
		for (let x = -1; x <= 1; x++) {
			const matrix = identity(createZeroMatrix());
			translate(matrix, matrix, [x * 2.2, y * 2.2, 0]);
			matrices.push(matrix);
		}
	}
	$materials = [...$materials, material];
	$scene = [
		...$scene,
		create3DObject({
			...createCube(),
			instances: matrices.length,
			matrices,
			material,
		}),
	];
	$lights = [
		...$lights,
		createLightStore(
			createPointLight({
				position: [-3, 4, -4],
				color: [1, 1, 1],
				intensity: 30,
			}),
		),
	];
	$renderer = {
		...$renderer,
		loop() {},
		enabled: true,
	};
	createOrbitControls(canvas, camera);
});
</script>

<canvas bind:this={canvas}></canvas>
<button on:click={toggleProjection}>{projection}</button>
<Menu />

<style>
	button {
		position: absolute;
		left: 12px;
		bottom: 12px;
		z-index: 1;
		padding: 6px 10px;
		font-family: sans-serif;
		font-size: 0.85rem;
	}
</style>
