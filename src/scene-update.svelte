<script type="module">
import { onMount } from "svelte";
import {
	createLightStore,
	renderer,
	scene,
	lights,
	camera,
	renderPasses,
	create3DObject,
	materials,
	createMaterialStore,
} from "./store/engine-refactor.js";
import { identity, scale, translate } from "gl-matrix/esm/mat4.js";
import { createPointLight } from "./lights/point-light.js";
import { skyblue } from "./color/color-keywords.js";
import { createPolyhedron, createSmoothShadedNormals } from "./geometries/polyhedron.js";
import { createCube } from "./geometries/cube.js";
import { createPlane } from "./geometries/plane.js";
import { createOrbitControls } from "./interactivity/orbit-controls.js";
import { createTexture } from "./texture/texture.js";
import { createContactShadowPass } from "./store/contact-shadow.js";

import Menu from "./Menu.svelte";
import { get } from "svelte/store";
import { createSpecular } from "./material/specular/specular.js";
import DebugPanel from "./components/DebugPanel/DebugPanel.svelte";

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
	const groundMatrix = identity(new Float32Array(16));
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
	light.set({
		...get(light),
		position: [Math.sin(performance.now() / 1000) * 3, 1, Math.cos(performance.now() / 1000) * 3],
	});
	//animate hue
	const color1 = Math.sin(performance.now() / 1000) * 0.5 + 0.5;
	const color2 = Math.sin(performance.now() / 1000 + 2) * 0.5 + 0.5;
	const color3 = Math.sin(performance.now() / 1000 + 4) * 0.5 + 0.5;
	light2.set({
		...get(light2),
		color: [color1, color2, color3],
	});
}
let meshCount = 1;
function addMesh() {
	const newMat = identity(new Float32Array(16));
	scale(newMat, newMat, [0.2, 0.2, 0.2]);

	translate(newMat, newMat, [0, 4 * meshCount + 1, 0]);
	const mesh = create3DObject({
		...createCube(1, 1, 1),
		matrix: newMat,
		material: $materials[0],
	});
	$scene = [...$scene, mesh];
	meshCount++;
}
function removeMesh() {
	$scene = $scene.slice(0, -1);
	meshCount--;
}
</script>
<canvas bind:this={canvas}></canvas>
<Menu />
<DebugPanel />
<button on:click={addMesh} class="add">add mesh</button>
<button on:click={removeMesh} class="remove">remove mesh</button>

<style>
	button {
		position: absolute;
		left: 0;
	}
	button.add {
		top: 100px;
	}
	button.remove {
		top: 200px;
	}
</style>