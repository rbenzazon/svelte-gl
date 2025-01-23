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
import { easeOutCubic } from "easing-utils";

let canvas;
let sphere;
onMount(async () => {
	$renderer = {
		...$renderer,
		canvas,
		backgroundColor: skyblue,
		ambientLightColor: [0xffffff, 0.1],
	};

	$camera = {
		position: [0, 1, -5],
		target: [0, 1, 0],
		fov: 75,
	};

	const sphereMesh = createPolyhedron(1, 5, createSmoothShadedNormals);
	const spherePos = identity(new Float32Array(16));
	//translate(cubePos, cubePos, [3, 1.5, 0]);
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

	(sphere = create3DObject({
		...sphereMesh,
		matrix: spherePos,
		material: material,
	})),
		($scene = [...$scene, sphere, light]);

	$renderer = {
		...$renderer,
		loop: animate,
		enabled: true,
	};

	createOrbitControls(canvas, camera);
});

function animate() {
	const time = (performance.now() / 1000) % 1.5;
	//console.log("time",time);
	const sphereScaleY = Math.abs((Math.max(time, 1) - 1.25) * 3) + 0.25;
	const sphereScaleXZ = -Math.abs((Math.max(time, 1) - 1.25) * 3) + 1.85;
	//console.log("sphereScaleY",sphereScaleY);

	const posYNormalized = Math.abs(Math.min(time, 1) - 0.5) * -2 + 1;
	const posY = easeOutCubic(posYNormalized) * 3;
	console.log("posYNormalized", posYNormalized);
	const rotation = 0.001 * Math.PI;
	//const value = get(sphere.matrix);
	const value = identity(new Float32Array(16));
	translate(value, value, [0, posY, 0]);
	scale(value, value, [sphereScaleXZ, sphereScaleY, sphereScaleXZ]);
	//rotateY(value, value, rotation);
	sphere.matrix.set(value);
}
</script>
<canvas bind:this={canvas}></canvas>
<Menu />