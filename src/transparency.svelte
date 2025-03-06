<script type="module">
import { onMount } from "svelte";
import {
	createLightStore,
	renderer,
	scene,
	create3DObject,
	lights,
	materials,
	createMaterialStore,
} from "./store/engine.js";
import { camera } from "./store/camera.js";
import { identity, translate } from "gl-matrix/esm/mat4.js";
import { createPointLight } from "./lights/point-light.js";
import { skyblue } from "./color/color-keywords.js";
import { createPolyhedron, createSmoothShadedNormals } from "./geometries/polyhedron.js";
import { createCube } from "./geometries/cube.js";
import { createPlane } from "./geometries/plane.js";
import { createOrbitControls } from "./interactivity/orbit-controls.js";
import Menu from "./Menu.svelte";
import { createFlatShadedNormals, createZeroMatrix } from "./geometries/common.js";
import DebugPanel from "./components/DebugPanel/DebugPanel.svelte";

let canvas;
onMount(async () => {
	$renderer = {
		...$renderer,
		canvas,
		backgroundColor: skyblue,
		ambientLightColor: [0xffffff, 0.1],
	};

	$camera = {
		...$camera,
		position: [0, 5, -5],
		target: [0, 1, 0],
		fov: 75,
	};

	const cubeMesh = createCube();
	const cubePos = identity(createZeroMatrix());
	translate(cubePos, cubePos, [3, 1.5, 0]);
	const material = createMaterialStore({
		diffuse: [1, 0.5, 0.5],
		metalness: 0,
	});

	const sphereMesh = createPolyhedron(1, 5, createSmoothShadedNormals);
	const spherePos = identity(createZeroMatrix());
	translate(spherePos, spherePos, [-3, 1.5, 0]);
	const transparentMaterial = createMaterialStore({
		diffuse: [1, 1, 0.5],
		metalness: 0,
		opacity: 0.5,
	});

	const polyhedronMesh = createPolyhedron(1, 2, createFlatShadedNormals);
	const polyhedronPos = identity(createZeroMatrix());
	translate(polyhedronPos, polyhedronPos, [0, 1.5, 0]);

	const groundMesh = createPlane(10, 10, 1, 1);
	const groundMatrix = identity(createZeroMatrix());
	translate(groundMatrix, groundMatrix, [0, 0, 0]);
	const groundMaterial = createMaterialStore({
		diffuse: [1, 1, 1],
		metalness: 0,
	});

	$materials = [...$materials, material, transparentMaterial, groundMaterial];

	const light = createLightStore(
		createPointLight({
			position: [-2, 3, -3],
			color: [1, 1, 1],
			intensity: 20,
			cutoffDistance: 0,
			decayExponent: 2,
		}),
	);
	const light2 = createLightStore(
		createPointLight({
			position: [2, 0, -4],
			color: [1, 1, 1],
			intensity: 5,
			cutoffDistance: 0,
			decayExponent: 2,
		}),
	);

	$scene = [
		...$scene,
		create3DObject({
			...sphereMesh,
			matrix: spherePos,
			material: transparentMaterial,
		}),
		create3DObject({
			...polyhedronMesh,
			matrix: polyhedronPos,
			material: transparentMaterial,
		}),
		create3DObject({
			...cubeMesh,
			matrix: cubePos,
			material: material,
		}),
		create3DObject({
			...groundMesh,
			matrix: groundMatrix,
			material: groundMaterial,
		}),
	];

	$lights = [...$lights, light, light2];

	$renderer = {
		...$renderer,
		loop: animate,
		enabled: true,
	};

	createOrbitControls(canvas, camera);
});

function animate() {
	// animate here
}
</script>
<canvas bind:this={canvas}></canvas>
<Menu />
<DebugPanel />