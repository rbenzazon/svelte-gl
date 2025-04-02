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
import { decodeJPEGHDRLoader } from "./programs/jpg-hdr/jpeg-hdr-loader.js";
import { hdrToCube, getToneMapping } from "./loaders/hdr-to-cube.js";
import { createEnvironmentMap } from "./texture/environment-map.js";
import { createEnvMapTexture } from "./texture/environment-map-texture.js";
import { createSpecular } from "./material/specular/specular.js";
import { createACESFilmicToneMapping } from "./tone-mapping/aces-filmic-tone-mapping.js";
import { renderState } from "./store/engine";
import { createMeshFromGLTF, isGLTFMeshData, loadGLTFFile, mapScene } from "./loaders/gltf-loader.js";
import { initDracoDecoder } from "./loaders/dracoDecoder.js";

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
		position: [0, 0, 35],
		target: [2, 0, -1],
		fov: 70,
	};
	const jpgHDRImage = await decodeJPEGHDRLoader("skyboxes/qwantani-noon-4k.jpg");

	const hdrToneMapping = getToneMapping(1);
	const skyBox = await createSkyBox({
		texture: jpgHDRImage.texture,
		width: jpgHDRImage.texture.width,
		height: jpgHDRImage.texture.height,
		cubeSize: 2048,
		toneMapping: hdrToneMapping,
		convertToCube: hdrToCube,
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
	const fontFile = await loadGLTFFile("models/xenon-font.gltf", "models/xenon-font.bin", dracoDecoder);
	const letterMap = mapScene(fontFile.scene).reduce((acc, data) => {
		if (isGLTFMeshData(data)) {
			acc[data.name] = data;
		}
		return acc;
	}, {});
	const chromeMaterial = createMaterialStore({
		metalness: 0.95,
		specular: createSpecular({
			roughness: 0.08,
			ior: 1.4,
			intensity: 0.8,
			color: [1, 1, 1],
		}),
		diffuse: [1, 1, 1],
		envMap,
	});
	const textMatrix = identity(createZeroMatrix());
	const textScale = 8;
	scale(textMatrix, textMatrix, [textScale, textScale, textScale]);

	const meshMap = {};

	for (const key in letterMap) {
		const mesh = createMeshFromGLTF(fontFile, letterMap[key]);
		delete mesh.matrix;
		const object = {
			...mesh,
			material: chromeMaterial,
			instances: 0,
			matrices: [],
		};
		meshMap[key] = object;
	}

	const text = "SVELTE GL ROCKS";
	const chars = text.split("");
	const presentLetters = new Set(chars);
	// remove from set space
	presentLetters.delete(" ");

	let displayedMeshes = Array.from(presentLetters).map((letter) => meshMap[letter]);

	let cursorPos = 0;
	const letterSpacing = 0.4;

	translate(textMatrix, textMatrix, [-letterSpacing * (chars.length / 2) + 0.2, 0, 0]);

	for (const char of chars) {
		if (char === " ") {
			cursorPos += letterSpacing;
			continue;
		}
		const mesh = meshMap[char];
		mesh.instances++;
		const matrix = copy(createZeroMatrix(), textMatrix);
		translate(matrix, matrix, [cursorPos, 0, 0]);
		mesh.matrices.push(matrix);
		cursorPos += letterSpacing;
	}
	displayedMeshes = displayedMeshes.map((mesh) => {
		return create3DObject(mesh);
	});

	$materials = [...$materials, chromeMaterial];

	$scene = [...$scene, ...displayedMeshes];

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