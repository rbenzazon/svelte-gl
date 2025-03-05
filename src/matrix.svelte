<script type="module">
import { onMount } from "svelte";
import {
	createLightStore,
	renderer,
	scene,
	create3DObject,
	lights,
	createMaterialStore,
	materials,
} from "./store/engine-refactor.js";
import { camera } from "./store/camera.js";
import { identity, scale, translate } from "gl-matrix/esm/mat4.js";
import { createPointLight } from "./lights/point-light.js";
import { skyblue } from "./color/color-keywords.js";
import { createPolyhedron, createSmoothShadedNormals } from "./geometries/polyhedron.js";
import { createPlane } from "./geometries/plane.js";
import { createOrbitControls } from "./interactivity/orbit-controls.js";
import Menu from "./Menu.svelte";
import { easeOutCubic } from "easing-utils";
import { createZeroMatrix } from "./geometries/common.js";

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
		...$camera,
		position: [0, 1, -5],
		target: [0, 1, 0],
		fov: 75,
	};

	const sphereMesh = createPolyhedron(1, 5, createSmoothShadedNormals);
	const spherePos = identity(createZeroMatrix());
	const material = createMaterialStore({
		diffuse: [1, 0.5, 0.5],
		metalness: 0,
	});

	const groundMesh = createPlane(10, 10, 1, 1);
	const groundMatrix = identity(createZeroMatrix());
	translate(groundMatrix, groundMatrix, [0, -1, 0]);
	const groundMaterial = createMaterialStore({
		diffuse: [1, 1, 1],
		metalness: 0,
	});

	const light = createLightStore(
		createPointLight({
			position: [-2, 3, -3],
			color: [1, 1, 1],
			intensity: 20,
			cutoffDistance: 0,
			decayExponent: 2,
		}),
	);

	sphere = create3DObject({
		...sphereMesh,
		matrix: spherePos,
		material: material,
	});

	$materials = [...$materials, material, groundMaterial];

	$scene = [
		...$scene,
		sphere,
		create3DObject({
			...groundMesh,
			matrix: groundMatrix,
			material: groundMaterial,
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
	const moveTime = 1;
	const bounceTime = 0.2;
	const elasticDeformation = 0.5;
	// time goes from 0 to (moveTime + bounceTime) in cycle using the modulo operator
	const time = (performance.now() / 1000) % (moveTime + bounceTime);

	/*
	this equation creates the elastic deformation using time as input
	equation description (-> is a range) :
	[max] => moveTime->moveTime+bounceTime
	[-moveTime] => 0->bounceTime
	[-bounceTime/2] => -bounceTime/2->0->0->bounceTime/2
	[abs] => bounceTime/2->0->0->bounceTime/2
	[* 1/bounceTime] => 1->0->0->1
	[1-] => 0->1->1->0
	*/
	const sphereScaleNormalized =
		1 - Math.abs(((Math.max(time, moveTime) - moveTime - bounceTime / 2) * 1) / (bounceTime / 2));
	/*
	[*elasticDeformation] => 0->elasticDeformation->elasticDeformation->0
	[+1] => 1.3->1->1->1.3
	*/
	const sphereScaleXZ = easeOutCubic(sphereScaleNormalized) * elasticDeformation + 1;

	const sphereScaleY = 1 - easeOutCubic(sphereScaleNormalized) * elasticDeformation;

	const sphereCrushY = easeOutCubic(sphereScaleNormalized) * elasticDeformation;

	/*
	this equation creates the bounce effect movement using time as input
	equation description (-> is a range) :

	[min] => 0 -> moveTime
	[-moveTime/2] => -moveTime/2 -> moveTime/2
	[abs] => moveTime/2 -> 0 -> 0 -> moveTime/2
	[* 1/(moveTime/2)] => 1 -> 0 -> 0 -> 1
	[* -1] => -1 -> 0 -> 0 -> -1
	[+1] => 0 -> 1 -> 1 ->0

	*/
	const posYNormalized = ((Math.abs(Math.min(time, moveTime) - moveTime / 2) * 1) / (moveTime / 2)) * -1 + 1;
	const posY = easeOutCubic(posYNormalized) * 3;

	/* 
	elastic bounce effect factor
	[min] => 0 -> moveTime
	[/moveTime] => 0 -> 1
	[min] => 0 -> 0.5 -> 0.5
	[*2] => 0 -> 1 -> 1
	[1-] => 1 -> 0 -> 0
	*/
	const elasticBounceFactor = 1 - Math.min(0.5, Math.min(time, moveTime) / moveTime) * 2;
	const elasticBounceSinFrequency = 12;
	const elasticBounceAmplitude = 0.5;
	const elasticBounce =
		Math.sin(time * Math.PI * elasticBounceSinFrequency) * elasticBounceFactor * elasticBounceAmplitude;

	const newMatrix = identity(createZeroMatrix());
	translate(newMatrix, newMatrix, [0, posY - sphereCrushY, 0]);
	scale(newMatrix, newMatrix, [
		sphereScaleXZ - elasticBounce / 2,
		sphereScaleY + elasticBounce,
		sphereScaleXZ - elasticBounce / 2,
	]);
	sphere.matrix.set(newMatrix);
}
</script>
<canvas bind:this={canvas}></canvas>
<Menu />