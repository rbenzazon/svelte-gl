<script type="module">
import { onMount } from "svelte";
import { createLightStore, renderer, scene, camera, create3DObject } from "./store/engine-refactor.js";
import { identity, rotateY, scale, translate } from "gl-matrix/esm/mat4.js";
import { createPointLight } from "./lights/point-light.js";
import { skyblue } from "./color/color-keywords.js";
import { createPolyhedron, createSmoothShadedNormals } from "./geometries/polyhedron.js";
import { createCube } from "./geometries/cube.js";
import { createPlane } from "./geometries/plane.js";
import { createOrbitControls } from "./interactivity/orbit-controls.js";
import Menu from "./Menu.svelte";
import { createFlatShadedNormals, toRadian } from "./geometries/common.js";
import { get } from "svelte/store";

let canvas;
let cube;
onMount(async () => {
	$renderer = {
		...$renderer,
		canvas,
		backgroundColor: skyblue,
		ambientLightColor: [0xffffff, 0.1],
	};

	$camera = {
		position: [0, 5, -5],
		target: [0, 1, 0],
		fov: 75,
	};

	const cubeMesh = createCube();
	const cubePos = identity(new Float32Array(16));
	translate(cubePos, cubePos, [3, 1.5, 0]);
	const material = {
		diffuse: [1, 0.5, 0.5],
		metalness: 0,
	};

	const light = createLightStore(
		createPointLight({
			position: [-2, 3, -3],
			color: [1, 1, 1],
			intensity: 20,
			cutoffDistance: 0,
			decayExponent: 2,
		}),
	);

	cube = create3DObject({
		...cubeMesh,
		matrix: cubePos,
		material: material,
	});

	$scene = [...$scene, cube, light];

	$renderer = {
		...$renderer,
		loop: animate,
		enabled: true,
	};

	createOrbitControls(canvas, camera);
});

function animate() {
	const rotation = 0.001 * Math.PI;
	const value = get(cube.matrix);
	rotateY(value, value, rotation);
	cube.matrix.set(value);
}
</script>
<canvas bind:this={canvas}></canvas>
<Menu />