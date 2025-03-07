<script type="module">
import { onMount } from "svelte";
import { scene } from "./store/scene.js";
import { create3DObject } from "./store/create-object.js";
import { createMaterialStore, materials } from "./store/materials.js";
import { createLightStore, lights } from "./store/lights.js";
import { renderer } from "./store/renderer.js";
import { camera } from "./store/camera.js";
import { create, identity, scale, translate } from "gl-matrix/esm/mat4.js";
import { createPointLight } from "./lights/point-light.js";
import { skyblue } from "./color/color-keywords.js";
import { createCube } from "./geometries/cube.js";
import { createOrbitControls } from "./interactivity/orbit-controls.js";
import Menu from "./Menu.svelte";
import { createZeroMatrix } from "./geometries/common.js";
import { createDebugObject } from "./geometries/debug.js";
import { createDebugNormalsProgram } from "./store/debug-program.js";

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

	const matrix = identity(createZeroMatrix());

	const debugProgram = createMaterialStore({
		diffuse: [1, 0, 0],
		metalness: 0,
		program: createDebugNormalsProgram(),
	});
	const debugNormalMesh = createDebugObject({
		...cubeMesh,
		matrix,
		material: debugProgram,
	});

	const material = createMaterialStore({
		diffuse: [1, 0.5, 0.5],
		metalness: 0,
	});

	$materials = [...$materials, material, debugProgram];

	$scene = [
		...$scene,
		create3DObject({
			...cubeMesh,
			matrix,
			material,
		}),
		create3DObject(debugNormalMesh),
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