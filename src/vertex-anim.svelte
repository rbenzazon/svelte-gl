<script type="module">
import { onMount } from "svelte";
import { scene } from "./store/scene.js";
import { create3DObject } from "./store/create-object.js";
import { createMaterialStore, materials } from "./store/materials.js";
import { createLightStore, lights } from "./store/lights.js";
import { renderer } from "./store/renderer.js";
import { camera } from "./store/camera.js";
import { identity, scale, translate } from "gl-matrix/esm/mat4.js";
import { createPointLight } from "./lights/point-light.js";
import { skyblue } from "./color/color-keywords.js";
import { createPlane } from "./geometries/plane.js";
import { createOrbitControls } from "./interactivity/orbit-controls.js";
import { createNoiseDistortionAnimation } from "./animation/noise-distortion/noise-distortion.js";
import Menu from "./Menu.svelte";
import { createSpecular } from "./material/specular/specular.js";
import { createZeroMatrix } from "./geometries/common.js";

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
		position: [0, 3, -5],
		target: [0, 0, -1],
		fov: 75,
	};

	const light = createLightStore(
		createPointLight({
			position: [0, 1, 0],
			color: [1, 1, 1],
			intensity: 2,
			cutoffDistance: 15,
			decayExponent: 0,
		}),
	);

	const groundMesh = createPlane(10, 10, 200, 200);
	const groundMatrix = identity(createZeroMatrix());

	const groundMaterial = createMaterialStore({
		diffuse: [0, 102 / 255, 204 / 255],
		metalness: 0,
		specular: createSpecular({
			roughness: 0.8,
			ior: 1.4,
			intensity: 0.5,
			color: [1, 1, 1],
		}),
	});

	$materials = [...$materials, groundMaterial];

	$scene = [
		...$scene,
		create3DObject({
			...groundMesh,
			matrix: groundMatrix,
			material: groundMaterial,
			animations: [
				createNoiseDistortionAnimation({
					frequency: 1,
					speed: 1,
					amplitude: 1,
					normalTangentLength: 0.01,
				}),
			],
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
	// animate here
}
</script>
<canvas bind:this={canvas}></canvas>
<Menu />