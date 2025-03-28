<script type="module">
import { onMount } from "svelte";
import { scene } from "./store/scene.js";
import { create3DObject } from "./store/create-object.js";
import { renderPasses } from "./store/programs.js";
import { createSkyBox, setupSkyBoxTexture } from "./store/skybox.js";
import { createMaterialStore, materials } from "./store/materials.js";
import { createLightStore, lights } from "./store/lights.js";
import { renderer } from "./store/renderer.js";
import { camera } from "./store/camera.js";
import { create, identity, scale, translate } from "gl-matrix/esm/mat4.js";
import { createPointLight } from "./lights/point-light.js";
import { skyblue } from "./color/color-keywords.js";
import { createCube } from "./geometries/cube.js";
import { createOrbitControls } from "./interactivity/orbit-controls.js";
import { createPolyhedron, createSmoothShadedNormals } from "./geometries/polyhedron.js";
import Menu from "./Menu.svelte";
import { createZeroMatrix } from "./geometries/common.js";
import { createDebugObject } from "./geometries/debug.js";
import { createDebugNormalsProgram } from "./store/debug-program.js";
import { renderState } from "./store/engine";
import { decodeJPEGHDRLoader } from "./programs/jpg-hdr/jpeg-hdr-loader.js";
import { hdrToCube, getToneMapping } from "./loaders/hdr-to-cube.js";
import { loadRGBE } from "./loaders/rgbe-loader.js";
import { createEnvironmentMap } from "./texture/environment-map.js";
import { createEnvMapTexture } from "./texture/environment-map-texture.js";
import { createSpecular } from "./material/specular/specular.js";

let canvas;
let jpgHDRImage;
onMount(async () => {
	$renderer = {
		...$renderer,
		canvas,
		backgroundColor: skyblue,
		ambientLightColor: [0xffffff, 0.1],
	};

	$camera = {
		...$camera,
		position: [0, 0, 10],
		target: [0, 0, 0],
		fov: 50,
	};

	jpgHDRImage = await decodeJPEGHDRLoader("skyboxes/spruit-sunrise-8k-hdr.jpg");
	//jpgHDRImage = await loadRGBE("spruit-sunrise-1k.hdr");
	const hdrToneMapping = getToneMapping(1);
	const skyBox = await createSkyBox({
		/*typedArray: jpgHDRImage.data,*/
		texture: jpgHDRImage.texture,
		width: jpgHDRImage.texture.width,
		height: jpgHDRImage.texture.height,
		cubeSize: 2048,
		toneMapping: hdrToneMapping,
		convertToCube: hdrToCube,
	});
	/*const hdrToneMapping = getToneMapping(1);*/
	const environmentMap = createEnvironmentMap(jpgHDRImage.texture, jpgHDRImage.width, jpgHDRImage.height);

	$renderPasses = [skyBox, environmentMap];

	const sphereMesh = createPolyhedron(2, 6, createSmoothShadedNormals);

	const light = createLightStore(
		createPointLight({
			position: [-2, 2, -2],
			color: [1, 1, 1],
			intensity: 20,
			cutoffDistance: 0,
			decayExponent: 2,
			/*toneMapping: hdrToneMapping,*/
		}),
	);

	const matrix = identity(createZeroMatrix());

	const envMap = createEnvMapTexture({
		envMap: environmentMap.getTexture,
		width: environmentMap.width,
		height: environmentMap.height,
		lodMax: environmentMap.lodMax,
	});

	const material = createMaterialStore({
		diffuse: [1, 1, 1],
		metalness: 1,
		specular: createSpecular({
			roughness: 0.05,
			ior: 1.5,
			intensity: 1,
			color: [1, 1, 1],
		}),
		envMap,
	});

	$materials = [...$materials, material];

	$scene = [
		...$scene,
		create3DObject({
			...sphereMesh,
			matrix,
			material,
		}),
	];
	//$lights = [...$lights, light];

	$renderer = {
		...$renderer,
		loop: animate,
		enabled: true,
	};

	createOrbitControls(canvas, camera);
});

function animate() {}
</script>
<canvas bind:this={canvas}></canvas>
<Menu />