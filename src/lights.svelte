<script type="module">
import { onMount } from "svelte";
import { scene } from "./store/scene.js";
import { create3DObject } from "./store/create-object.js";
import { materials, createMaterialStore } from "./store/materials.js";
import { createLightStore, lights } from "./store/lights.js";
import { renderer } from "./store/renderer.js";
import { camera } from "./store/camera.js";
import { identity } from "gl-matrix/esm/mat4.js";
import { createPointLight } from "./lights/point-light.js";
import { skyblue } from "./color/color-keywords.js";
import { createPlane } from "./geometries/plane.js";
import { createOrbitControls } from "./interactivity/orbit-controls.js";
import { createTexture } from "./texture/texture.js";

import Menu from "./Menu.svelte";
import { get } from "svelte/store";
import { createSpecular } from "./material/specular/specular.js";
import DebugPanel from "./components/DebugPanel/DebugPanel.svelte";
import { createZeroMatrix } from "./geometries/common.js";
import { renderState } from "./store/engine";

let canvas;
let light;
let light2;
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

	light = createLightStore(
		createPointLight({
			position: [0, 1, 0],
			color: [1, 1, 1],
			intensity: 2,
			cutoffDistance: 3,
			decayExponent: 0,
		}),
	);
	light2 = createLightStore(
		createPointLight({
			position: [0, 1, 0],
			color: [1, 1, 1],
			intensity: 5,
			cutoffDistance: 10,
			decayExponent: 0,
		}),
	);

	const groundMesh = createPlane(10, 10, 1, 1);
	const groundMatrix = identity(createZeroMatrix());
	const diffuseMap = await createTexture({
		url: "peeling-painted-metal-diffuse.jpg",
		type: "diffuse",
	});
	const normalMap = await createTexture({
		url: "peeling-painted-metal-normal.jpg",
		type: "normal",
	});
	const roughnessMap = await createTexture({
		url: "peeling-painted-metal-roughness.jpg",
		type: "roughness",
	});
	const groundMaterial = createMaterialStore({
		diffuse: [1, 1, 1],
		metalness: 0,
		specular: createSpecular({
			roughness: 0.8,
			ior: 1.4,
			intensity: 0.5,
			color: [1, 1, 1],
		}),
		diffuseMap,
		normalMap,
		roughnessMap,
	});

	$materials = [...$materials, groundMaterial];

	$scene = [
		...$scene,
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
	//console.log('animate before light');
	light.set({
		...get(light),
		position: [Math.sin(performance.now() / 1000) * 3, 1, Math.cos(performance.now() / 1000) * 3],
	});
	//console.log('animate after light');
	//animate hue
	const color1 = Math.sin(performance.now() / 1000) * 0.5 + 0.5;
	const color2 = Math.sin(performance.now() / 1000 + 2) * 0.5 + 0.5;
	const color3 = Math.sin(performance.now() / 1000 + 4) * 0.5 + 0.5;
	//console.log('animate before light2');
	light2.set({
		...get(light2),
		color: [color1, color2, color3],
	});
	//console.log('animate after light2');
}
</script>
<canvas bind:this={canvas}></canvas>
<Menu />
<DebugPanel />