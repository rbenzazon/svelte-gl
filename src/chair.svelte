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
import { loadRGBE } from "./loaders/rgbe-loader.js";
import {
	isGLTFMeshData,
	createCameraFromGLTF,
	createMeshFromGLTF,
	getAbsoluteNodeMatrix,
	loadGLTFFile,
	mapScene,
} from "./loaders/gltf-loader.js";
import { initDracoDecoder } from "./loaders/dracoDecoder.js";
import Menu from "./Menu.svelte";
import { get } from "svelte/store";
import { cloneMatrix, createZeroMatrix } from "./geometries/common.js";
import { createSpecular } from "./material/specular/specular.js";
import { renderState } from "./store/engine";

import { decodeJPEGHDRLoader } from "./programs/jpg-hdr/jpeg-hdr-loader.js";

let canvas;
onMount(async () => {
	$renderer = {
		...$renderer,
		canvas,
		backgroundColor: skyblue,
		ambientLightColor: [0xffffff, 0.15],
	};

	const dracoDecoder = await initDracoDecoder("draco/");
	const chairFile = await loadGLTFFile("models/arm-chair.gltf", "models/arm-chair.bin", dracoDecoder);
	const meshesData = mapScene(chairFile.scene).filter(isGLTFMeshData);

	const floorObject = createMeshFromGLTF(chairFile, meshesData[0]);
	const chairObject = createMeshFromGLTF(chairFile, meshesData[1]);

	$camera = {
		...$camera,
		position: [2, 1.5, 2],
		target: [0, 0.5, 0],
		fov: 60,
	};

	const light = createLightStore(
		createPointLight({
			position: [-2, 3, 3],
			color: [1, 1, 1],
			intensity: 20,
			cutoffDistance: 0,
			decayExponent: 2,
		}),
	);
	const light2 = createLightStore(
		createPointLight({
			position: [2, -1, 1],
			color: [1, 1, 1],
			intensity: 20,
			cutoffDistance: 0,
			decayExponent: 2,
		}),
	);
	const light3 = createLightStore(
		createPointLight({
			position: [-1, 3, -4],
			color: [1, 1, 1],
			intensity: 10,
			cutoffDistance: 0,
			decayExponent: 2,
		}),
	);

	const chairDiffuseMap = await createTexture({
		url: "textures/arm-chair-diffuse.jpg",
		type: "diffuse",
	});
	const chairNormalMap = await createTexture({
		url: "textures/arm-chair-normal.jpg",
		type: "normal",
	});

	const chairLightMapImage = await decodeJPEGHDRLoader("textures/arm-chair-lightmap-hdr.jpg");
	const chairLightMap = await createTexture({
		textureBuffer: () => chairLightMapImage.texture,
		width: chairLightMapImage.width,
		height: chairLightMapImage.height,
		lightMapIntensity: 1.8,
		type: "light",
	});
	/*
	const chairLightMapImage = await loadRGBE("textures/arm-chair-lightmap.hdr");
	const chairLightMap = await createTexture({
		image: chairLightMapImage.data,
		width: chairLightMapImage.width,
		height: chairLightMapImage.height,
		lightMapIntensity: 1.8,
		type: "light",
	});
	*/
	/*
	const chairLightMap = await createTexture({
		url: "textures/arm-chair-lightmap.jpg",
		lightMapIntensity: 2.2,
		type: "light",
	});
	*/
	const chairMaterial = createMaterialStore({
		diffuse: [1, 1, 1],
		diffuseMap: chairDiffuseMap,
		normalMap: chairNormalMap,
		lightMap: chairLightMap,
		metalness: 0,
		specular: createSpecular({
			roughness: 0.9,
			ior: 1.5,
			intensity: 1,
			color: [1, 1, 1],
		}),
	});
	const floorLightMapImage = await decodeJPEGHDRLoader("textures/arm-chair-floor-lightmap-hdr.jpg");
	const floorLightMap = await createTexture({
		textureBuffer: () => floorLightMapImage.texture,
		width: floorLightMapImage.width,
		height: floorLightMapImage.height,
		lightMapIntensity: 1.8,
		type: "light",
	});
	/*
	const floorLightMapImage = await loadRGBE("textures/arm-chair-floor-lightmap.hdr");
	const floorLightMap = await createTexture({
		image: floorLightMapImage.data,
		width: floorLightMapImage.width,
		height: floorLightMapImage.height,
		lightMapIntensity: 1.8,
		type: "light",
	});
	*/
	/*
	const floorLightMap = await createTexture({
		url: "textures/arm-chair-floor-lightmap.jpg",
		lightMapIntensity: 2.8,
		type: "light",
	});
	*/
	const floorMaterial = createMaterialStore({
		diffuse: [1, 1, 1],
		metalness: 0,
		lightMap: floorLightMap,
		specular: createSpecular({
			roughness: 0.9,
			ior: 1.5,
			intensity: 1,
			color: [1, 1, 1],
		}),
	});

	$materials = [...$materials, chairMaterial, floorMaterial];
	$scene = [
		...$scene,
		create3DObject({
			...chairObject,
			material: chairMaterial,
		}),
		create3DObject({
			...floorObject,
			material: floorMaterial,
		}),
	];
	$lights = [...$lights /*, light, light2, light3*/];

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