<script type="module">
import { onMount } from "svelte";
import { scene } from "./store/scene.js";
import { create3DObject } from "./store/create-object.js";
import { renderPasses } from "./store/programs.js";
import { createMaterialStore, materials } from "./store/materials.js";
import { createLightStore, lights } from "./store/lights.js";
import { renderer } from "./store/renderer.js";
import { camera } from "./store/camera.js";
import { create, identity, rotateY, scale, translate } from "gl-matrix/esm/mat4.js";
import { createPointLight } from "./lights/point-light.js";
import { skyblue } from "./color/color-keywords.js";
import { createPlane } from "./geometries/plane.js";
import { createOrbitControls } from "./interactivity/orbit-controls.js";
import { createTexture } from "./texture/texture.js";
import { createContactShadowPass } from "./store/contact-shadow.js";
import { loadOBJFile } from "./loaders/obj-loader.js";
import Menu from "./Menu.svelte";
import { get } from "svelte/store";
import { cloneMatrix, createZeroMatrix } from "./geometries/common.js";
import { createSpecular } from "./material/specular/specular.js";

let canvas;
onMount(async () => {
	const groundMatrix = identity(createZeroMatrix());
	translate(groundMatrix, groundMatrix, [0, -1.5, 0]);

	$renderer = {
		...$renderer,
		canvas,
		backgroundColor: skyblue,
		ambientLightColor: [0xffffff, 0.15],
	};

	const shadowPass = createContactShadowPass(groundMatrix, 1, 10, 10, 1024, 128, 0.5);
	const { getTexture: shadowTexture } = shadowPass;

	$renderPasses = [shadowPass];

	$camera = {
		...$camera,
		position: [0, 5, -5],
		target: [0, 2, 0],
		fov: 75,
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
	const light2 = createLightStore(
		createPointLight({
			position: [2, -1, -1],
			color: [1, 1, 1],
			intensity: 20,
			cutoffDistance: 0,
			decayExponent: 2,
		}),
	);
	const light3 = createLightStore(
		createPointLight({
			position: [-1, 3, 4],
			color: [1, 1, 1],
			intensity: 10,
			cutoffDistance: 0,
			decayExponent: 2,
		}),
	);

	const groundMesh = createPlane(10, 10, 1, 1);
	const groundDiffuseMap = await createTexture({
		textureBuffer: shadowTexture,
		type: "diffuse",
	});
	const groundMaterial = createMaterialStore({
		diffuse: [1, 1, 1],
		metalness: 0,
		diffuseMap: groundDiffuseMap,
		transparent: true,
	});

	const venus = await loadOBJFile("venus.obj");
	const venusMatrix = identity(createZeroMatrix());
	rotateY(venusMatrix, venusMatrix, Math.PI);
	scale(venusMatrix, venusMatrix, [0.003, 0.003, 0.003]);
	translate(venusMatrix, venusMatrix, [0, -450, 0]);
	const venusMaterial = createMaterialStore({
		...venus.material,
		specular: createSpecular({
			roughness: 0.45,
			ior: 1.5,
			intensity: 1,
			color: [1, 1, 1],
		}),
	});

	$materials = [...$materials, venusMaterial, groundMaterial];

	$scene = [
		...$scene,
		create3DObject({
			...groundMesh,
			matrix: groundMatrix,
			material: groundMaterial,
		}),
		create3DObject({
			...venus,
			matrix: venusMatrix,
			material: venusMaterial,
		}),
	];
	$lights = [...$lights, light, light2, light3];

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