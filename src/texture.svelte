<script type="module">
import { onMount } from "svelte";
import {
	createLightStore,
	renderer,
	scene,
	renderPasses,
	create3DObject,
	lights,
	createMaterialStore,
	materials,
} from "./store/engine.js";
import { camera } from "./store/camera.js";
import { identity, scale, translate } from "gl-matrix/esm/mat4.js";
import { createPointLight } from "./lights/point-light.js";
import { skyblue } from "./color/color-keywords.js";
import { createCube, sameFaceUVS } from "./geometries/cube.js";
import { createOrbitControls } from "./interactivity/orbit-controls.js";
import Menu from "./Menu.svelte";
import { createTexture } from "./texture/texture.js";
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
		position: [0, 5, -5],
		target: [0, 0.5, 0],
		fov: 75,
	};

	const cubeMesh = createCube();
	cubeMesh.attributes.uvs = new Float32Array(sameFaceUVS);

	const light = createLightStore(
		createPointLight({
			position: [-3, 2.5, 2],
			color: [1, 1, 1],
			intensity: 1,
			cutoffDistance: 8,
			decayExponent: 0.1,
		}),
	);
	const light2 = createLightStore(
		createPointLight({
			position: [3, 3.5, -3],
			color: [1, 1, 1],
			intensity: 10,
			cutoffDistance: 8,
			decayExponent: 0.1,
		}),
	);

	const matrix = identity(createZeroMatrix());
	const diffuseMap = await createTexture({
		url: "granite.jpg",
		type: "diffuse",
	});
	const normalMap = await createTexture({
		url: "granite-normal.jpg",
		type: "normal",
	});
	const material = createMaterialStore({
		diffuse: [1, 1, 1],
		metalness: 0,
		specular: createSpecular({
			roughness: 0.1,
			ior: 1.4,
			intensity: 0.5,
			color: [1, 1, 1],
		}),
		diffuseMap,
		normalMap,
	});

	$materials = [...$materials, material];

	$scene = [
		...$scene,
		create3DObject({
			...cubeMesh,
			matrix,
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
	//animate here
}
</script>
<canvas bind:this={canvas}></canvas>
<Menu />