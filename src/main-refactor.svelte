<script type="module">
import { onMount } from "svelte";
import {
	createAmbientLight,
	createBackgroundColor,
	createLightStore,
	renderer,
	scene,
	camera,
} from "./store/engine-refactor.js";
import { identity, translate } from "gl-matrix/esm/mat4.js";
import { createPointLight } from "./lights/point-light.js";
import { skyblue } from "./color/color-keywords.js";
import { createPolyhedron, createSmoothShadedNormals } from "./geometries/polyhedron.js";
import { createCube } from "./geometries/cube.js";
import { createOrbitControls } from "./interactivity/orbit-controls.js";

let canvas;
onMount(async () => {
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
			material: {
				diffuse: [1, 1, 0.5],
				metalness: 0,
			},
		},
		light,
	];

	$renderer = {
		...$renderer,
		loop: animate,
		enabled: true,
	};

	createOrbitControls(canvas, camera);

	/*setTimeout(() => {
		$camera = {
			position: [0, 5, -4],
		};
	}, 1000);*/
});

function animate() {
	const time = performance.now() / 1000;
	const zpos = Math.sin(time) * 2 - 5;
	/*$camera = {
		position: [0, 5, -zpos],
	};*/
	//console.log("animate", $camera.position);
}
</script>
<canvas bind:this={canvas}></canvas>