<script type="module">
import { onMount } from "svelte";
import {
	createAmbientLight,
	createBackgroundColor,
	createCamera,
	createLightStore,
	renderer,
	scene,
} from "./store/engine-refactor.js";
import { identity } from "gl-matrix/esm/mat4.js";
import { createPointLight } from "./lights/point-light.js";
import { skyblue } from "./color/color-keywords.js";
import { createPolyhedron, createSmoothShadedNormals } from "./geometries/polyhedron.js";
import { createCube } from "./geometries/cube.js";

let canvas;
onMount(async () => {
	$renderer = {
		...$renderer,
		canvas,
		backgroundColor: createBackgroundColor(skyblue),
		camera: createCamera([0, 5, -5], [0, 0, 0], 75),
		ambientLightColor: createAmbientLight(0xffffff, 0.5),
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

	$scene = [
		...$scene,
		{
			...cubeMesh,
			matrix: identity(new Float32Array(16)),
			material: {
				diffuse: [1, 0.5, 0.5],
			},
		},
		light,
	];

	$renderer = {
		...$renderer,
		loop: animate,
		enabled: true,
	};
});

function animate() {
	console.log("animate");
}
</script>
<canvas bind:this={canvas}></canvas>