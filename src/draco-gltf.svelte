<script type="module">
import { onMount } from "svelte";
import { scene } from "./store/scene.js";
import { create3DObject } from "./store/create-object.js";
import { renderPasses } from "./store/programs.js";
import { createSkyBox } from "./store/skybox.js";
import { createMaterialStore, materials } from "./store/materials.js";
import { renderer } from "./store/renderer.js";
import { camera } from "./store/camera.js";
import { copy, create, identity, rotateX, rotateY, scale, translate } from "gl-matrix/esm/mat4.js";
import { skyblue } from "./color/color-keywords.js";
import { createOrbitControls } from "./interactivity/orbit-controls.js";
import Menu from "./Menu.svelte";
import { createZeroMatrix } from "./geometries/common.js";
import { hdrToCube, getToneMapping } from "./loaders/hdr-to-cube.js";
import { createEnvironmentMap } from "./texture/environment-map.js";
import { createEnvMapTexture } from "./texture/environment-map-texture.js";
import { createSpecular } from "./material/specular/specular.js";
import { createACESFilmicToneMapping } from "./tone-mapping/aces-filmic-tone-mapping.js";
import { renderState } from "./store/engine";
import { createMeshFromGLTF, isGLTFMeshData, loadGLTFFile, mapScene } from "./loaders/gltf-loader.js";
import { initDracoDecoder } from "./loaders/dracoDecoder.js";
import { decodeJPEGHDRLoader } from "./programs/jpg-hdr/jpeg-hdr-loader.js";

let canvas;
let orbit;
onMount(async () => {
	$renderer = {
		...$renderer,
		canvas,
		backgroundColor: skyblue,
		ambientLightColor: [0xffffff, 0.1],
		toneMappings: [
			createACESFilmicToneMapping({
				exposure: 1,
			}),
		],
	};

	$camera = {
		...$camera,
		position: [4, 0.8, 2],
		target: [2, 0, -1],
		fov: 75,
	};

	const jpgHDRImage = await decodeJPEGHDRLoader("spruit-sunrise-8k-hdr.jpg");
	const hdrToneMapping = getToneMapping(1);
	const skyBox = await createSkyBox({
		texture: jpgHDRImage.texture,
		width: jpgHDRImage.texture.width,
		height: jpgHDRImage.texture.height,
		convertToCube: hdrToCube,
		cubeSize: 2048,
		toneMapping: hdrToneMapping,
	});

	const environmentMap = createEnvironmentMap(jpgHDRImage.texture, jpgHDRImage.width, jpgHDRImage.height);

	$renderPasses = [skyBox, environmentMap];

	const envMap = createEnvMapTexture({
		envMap: environmentMap.getTexture,
		width: environmentMap.width,
		height: environmentMap.height,
		lodMax: environmentMap.lodMax,
	});

	const dracoDecoder = await initDracoDecoder("draco/");
	const letterAFile = await loadGLTFFile("models/gamefont-a-draco.gltf", "models/gamefont-a-draco.bin", dracoDecoder);
	const letterAData = mapScene(letterAFile.scene).find(isGLTFMeshData);

	const letterAMesh = createMeshFromGLTF(letterAFile, letterAData);
	const letterAMetalMaterial = createMaterialStore({
		metalness: 0.95,
		specular: createSpecular({
			roughness: 0.08,
			ior: 1.4,
			intensity: 0.8,
			color: [1, 1, 1],
		}),
		diffuse: [255 / 255, 215 / 255, 0 / 255],
		envMap,
	});
	const letterAMaterial = createMaterialStore({
		metalness: 0,
		specular: createSpecular({
			roughness: 0.08,
			ior: 1.4,
			intensity: 0.8,
			color: [1, 1, 1],
		}),
		diffuse: [255 / 255, 215 / 255, 0 / 255],
		envMap,
	});

	const letterAMatrix = identity(createZeroMatrix());
	const letterAScale = 8;
	scale(letterAMatrix, letterAMatrix, [letterAScale, letterAScale, letterAScale]);
	rotateY(letterAMatrix, letterAMatrix, Math.PI / 4);
	rotateX(letterAMatrix, letterAMatrix, Math.PI / 2);
	const letterAMetalMatrix = copy(createZeroMatrix(), letterAMatrix);
	translate(letterAMetalMatrix, letterAMetalMatrix, [0.5, 0, 0]);

	$materials = [...$materials, letterAMaterial, letterAMetalMaterial];

	$scene = [
		...$scene,
		create3DObject({
			...letterAMesh,
			matrix: letterAMatrix,
			material: letterAMaterial,
		}),
		create3DObject({
			...letterAMesh,
			matrix: letterAMetalMatrix,
			material: letterAMetalMaterial,
		}),
	];

	$renderer = {
		...$renderer,
		loop: animate,
		enabled: true,
	};

	orbit = createOrbitControls(canvas, camera);
});

function animate() {
	//orbit.delta(0, 0, 0.002);
}
</script>
<canvas bind:this={canvas}></canvas>
<Menu />