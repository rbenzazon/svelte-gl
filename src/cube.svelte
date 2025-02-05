<script type="module">
import { onMount } from "svelte";
import {
	createLightStore,
	renderer,
	scene,
	camera,
	renderPasses,
	create3DObject,
	lights,
} from "./store/engine-refactor.js";
import { identity, scale, translate } from "gl-matrix/esm/mat4.js";
import { createPointLight } from "./lights/point-light.js";
import { skyblue } from "./color/color-keywords.js";
import { createCube } from "./geometries/cube.js";
import { createOrbitControls } from "./interactivity/orbit-controls.js";
import Menu from "./Menu.svelte";

let canvas;
onMount(async () => {
	$renderer = {
		...$renderer,
		canvas,
		backgroundColor: skyblue,
		ambientLightColor: [0xffffff, 0.1],
	};

	$camera = {
		position: [0, 5, -5],
		target: [0, 0.5, 0],
		fov: 75,
	};

	const cubeMesh = createCube();

	const light = createLightStore(
		createPointLight({
			position: [-2, 2, -2],
			color: [1, 1, 1],
			intensity: 20,
			cutoffDistance: 0,
			decayExponent: 2,
		}),
	);

	const matrix = identity(new Float32Array(16));

	const material = {
		diffuse: [1, 0.5, 0.5],
		metalness: 0,
	};

	$scene = [
		...$scene,
		create3DObject({
			...cubeMesh,
			matrix,
			material,
		}),
	];
	$lights = [...$lights, light];

	$renderer = {
		...$renderer,
		loop: animate,
		enabled: true,
	};

	createOrbitControls(canvas, camera);
});

function animate() {
	//animate here
}
</script>
<canvas bind:this={canvas}></canvas>
<Menu />