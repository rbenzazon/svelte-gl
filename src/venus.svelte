<script type="module">
import { onMount } from "svelte";
import { createLightStore, renderer, scene, camera, renderPasses, create3DObject } from "./store/engine-refactor.js";
import { create, identity, rotateY, scale, translate } from "gl-matrix/esm/mat4.js";
import { createPointLight } from "./lights/point-light.js";
import { skyblue } from "./color/color-keywords.js";
import { createPlane } from "./geometries/plane.js";
import { createOrbitControls } from "./interactivity/orbit-controls.js";
import { createTexture } from "./texture/texture.js";
import { createContactShadowPass } from "./store/contact-shadow.js";
import { loadOBJFile } from "./loaders/obj-loader.js";
import Menu from "./Menu.svelte";

let canvas;
onMount(async () => {
	const groundMatrix = identity(new Float32Array(16));
	translate(groundMatrix, groundMatrix, [0, -1.5, 0]);

	$renderer = {
		...$renderer,
		canvas,
		backgroundColor: skyblue,
		ambientLightColor: [0xffffff, 0.1],
	};

	const shadowPass = createContactShadowPass(groundMatrix, 1, 10, 10, 1024, 128, 0.5);
	const { getTexture: shadowTexture } = shadowPass;

	$renderPasses = [shadowPass];

	$camera = {
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

	const secondCubePos = identity(new Float32Array(16));
	translate(secondCubePos, secondCubePos, [3, 0, 0]);
	scale(secondCubePos, secondCubePos, [0.1, 0.1, 0.1]);

	const groundMesh = createPlane(10, 10, 1, 1);
	const groundDiffuseMap = await createTexture({
		textureBuffer: shadowTexture,
		type: "diffuse",
	});
	const groundMaterial = {
		diffuse: [1, 1, 1],
		metalness: 0,
		diffuseMap: groundDiffuseMap,
		transparent: true,
	};
	const venus = await loadOBJFile("venus.obj");
	venus.matrix = rotateY(venus.matrix, venus.matrix, Math.PI);
	venus.matrix = scale(venus.matrix, venus.matrix, [0.003, 0.003, 0.003]);
	venus.matrix = translate(venus.matrix, venus.matrix, [0, -450, 0]);
	$scene = [
		...$scene,
		create3DObject({
			...groundMesh,
			matrix: groundMatrix,
			material: groundMaterial,
		}),
		create3DObject(venus),
		light,
		light2,
	];

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