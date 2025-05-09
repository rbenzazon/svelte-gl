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
import { skyblue, white, black } from "./color/color-keywords.js";
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
import { create3DFont, create3DWord } from "./3d-text/3d-text.js";

let canvas;
let orbit;
let commonWordMatrix;

onMount(async () => {
	$renderer = {
		...$renderer,
		canvas,
		backgroundColor: black,
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
	/*const skyBox = await createSkyBox({
		texture: jpgHDRImage.texture,
		width: jpgHDRImage.texture.width,
		height: jpgHDRImage.texture.height,
		cubeSize: 2048,
		toneMapping: hdrToneMapping,
		convertToCube: hdrToCube,
	});*/

	const environmentMap = createEnvironmentMap(jpgHDRImage.texture, jpgHDRImage.width, jpgHDRImage.height);

	$renderPasses = [/*skyBox,*/ environmentMap];

	const envMap = createEnvMapTexture({
		envMap: environmentMap.getTexture,
		width: environmentMap.width,
		height: environmentMap.height,
		lodMax: environmentMap.lodMax,
	});
	const chromeMaterial = createMaterialStore({
		metalness: 0.95,
		specular: createSpecular({
			roughness: 0.02,
			ior: 1.4,
			intensity: 0.8,
			color: [1, 1, 1],
		}),
		diffuse: [1, 1, 1],
		envMap,
	});

	const font = await create3DFont("models/xenon-font.gltf", "models/xenon-font.bin", chromeMaterial);
	const text = "SVELTE GL ROCKS";

	const textMatrix = identity(createZeroMatrix());
	const textScale = 8;
	scale(textMatrix, textMatrix, [textScale, textScale, textScale]);
	translate(textMatrix, textMatrix, [-font.letterSpacing * (text.length / 2) + 0.2, 0, 0]);

	const { charSetMeshes, commonMatrix } = create3DWord(text, font, textMatrix);
	commonWordMatrix = commonMatrix;
	const displayedMeshes = Object.values(charSetMeshes).map((mesh) => {
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
	const { value } = commonWordMatrix;
	console.log("value", value);
	rotateY(value, value, 0.001);
	commonWordMatrix.set(value);
	//orbit.delta(0, 0, 0.002);
}
</script>

<canvas bind:this={canvas}></canvas>
<Menu />
