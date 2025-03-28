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
import { createPolyhedron, createSmoothShadedNormals, generateUVs } from "./geometries/polyhedron.js";
import { createOrbitControls } from "./interactivity/orbit-controls.js";
import { createTexture } from "./texture/texture.js";
import { createSpecular } from "./material/specular/specular.js";
import Menu from "./Menu.svelte";
import { createZeroMatrix } from "./geometries/common.js";
import { renderState } from "./store/engine";

let canvas;

onMount(async () => {
	const normalMap = await createTexture({
		url: "textures/golfball-normal.jpg",
		normalScale: [1, 1],
		type: "normal",
	});
	$renderer = {
		...$renderer,
		canvas,
		backgroundColor: skyblue,
		ambientLightColor: [0xffffff, 0.1],
	};

	$camera = {
		...$camera,
		position: [0, 5, -5],
		target: [0, 0, 0],
		fov: 75,
	};

	const material = createMaterialStore({
		diffuse: [1, 0.5, 0.5],
		metalness: 0,
		specular: createSpecular({
			roughness: 0.05,
			ior: 1,
			intensity: 2,
			color: [1, 1, 1],
		}),
		normalMap,
	});

	$materials = [...$materials, material];

	const sphereMesh = createPolyhedron(1.5, 7, createSmoothShadedNormals);
	sphereMesh.attributes.uvs = generateUVs(sphereMesh.attributes);

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
			position: [2, -1, -1],
			color: [1, 1, 1],
			intensity: 20,
			cutoffDistance: 0,
			decayExponent: 2,
		}),
	);

	$scene = [
		...$scene,
		create3DObject({
			...sphereMesh,
			matrix: identity(createZeroMatrix()),
			material,
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