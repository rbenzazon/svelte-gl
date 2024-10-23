<script type="module">
import { onMount } from "svelte";
import { get } from "svelte/store";
import { createLightStore, renderer, scene, camera } from "./store/engine-refactor.js";
import { identity, translate } from "gl-matrix/esm/mat4.js";
import { createPointLight } from "./lights/point-light.js";
import { skyblue } from "./color/color-keywords.js";
import { createCube } from "./geometries/cube.js";
import { createOrbitControls } from "./interactivity/orbit-controls.js";

let canvas;
onMount(() => {
	$renderer = {
		...$renderer,
		canvas,
		backgroundColor: skyblue,
		ambientLightColor: [0xffffff, 0.5],
	};
	$camera = {
		position: [0, 5, -5],
		target: [0, 0, 0],
		fov: 75,
	};

	const cubeMesh = createCube();

	const light = createLightStore(
		createPointLight({
			position: [-2, 3, 0],
			color: [1, 1, 1],
			intensity: 20,
			cutoffDistance: 0,
			decayExponent: 2,
		}),
	);

	const secondCubePos = identity(new Float32Array(16));
	translate(secondCubePos, secondCubePos, [3, 0, 0]);
	const sameMaterial = {
		diffuse: [1, 0.5, 0.5],
		metalness: 0,
	};
	$scene = [
		...$scene,
		{
			...cubeMesh,
			matrix: secondCubePos,
			material: sameMaterial,
		},
		{
			...cubeMesh,
			matrix: identity(new Float32Array(16)),
			material: sameMaterial,
		},
		light,
	];

	$renderer = {
		...$renderer,
		loop: animate,
		enabled: true,
	};

	createOrbitControls(canvas, camera);
});

function animate() {}
</script>
<canvas bind:this={canvas}></canvas>