<script type="module">
import { onMount } from "svelte";
import { scene } from "./store/scene.js";
import { create3DObject } from "./store/create-object.js";
import { renderPasses } from "./store/programs.js";
import { createSkyBox } from "./store/skybox.js";
import { createMaterialStore, materials } from "./store/materials.js";
import { createLightStore, lights } from "./store/lights.js";
import { renderer } from "./store/renderer.js";
import { camera } from "./store/camera.js";
import { create, identity, scale, translate } from "gl-matrix/esm/mat4.js";
import { createPointLight } from "./lights/point-light.js";
import { skyblue } from "./color/color-keywords.js";
import { createCube } from "./geometries/cube.js";
import { createOrbitControls } from "./interactivity/orbit-controls.js";
import Menu from "./Menu.svelte";
import { createZeroMatrix } from "./geometries/common.js";
import { createDebugObject } from "./geometries/debug.js";
import { createDebugNormalsProgram } from "./store/debug-program.js";
import { loadRGBE } from "./loaders/rgbe-loader.js";
import { hdrToCube, getToneMapping } from "./loaders/hdr-to-cube.js";
import { appContext } from "./store/engine.js";

let canvas;
let rgbeImage;
onMount(async () => {
	//rgbeImage = await loadRGBE("christmas_photo_studio_01_2k.hdr");

	//console.log("rgbeImage", rgbeImage);

	$renderer = {
		...$renderer,
		canvas,
		backgroundColor: skyblue,
		ambientLightColor: [0xffffff, 0.1],
	};

	$camera = {
		...$camera,
		position: [0, 2, -5],
		target: [0, 0, 0],
		fov: 75,
	};
	rgbeImage = await loadRGBE("christmas_photo_studio_01_2k.hdr");

	//const skyBox = await createSkyBox({ url: "skybox-flamingo-tonemapped.png" });
	const hdrToneMapping = getToneMapping(3);
	const skyBox = await createSkyBox({
		typedArray: rgbeImage.data,
		convertToCube: hdrToCube,
		width: rgbeImage.width,
		height: rgbeImage.height,
		cubeSize: 2048,
		toneMapping: hdrToneMapping,
	});
	$renderPasses = [skyBox];

	const cubeMesh = createCube();

	const light = createLightStore(
		createPointLight({
			position: [-2, 2, -2],
			color: [1, 1, 1],
			intensity: 20,
			cutoffDistance: 0,
			decayExponent: 2,
		}),
	);

	const matrix = identity(createZeroMatrix());

	const debugProgram = createMaterialStore({
		diffuse: [1, 0, 0],
		metalness: 0,
		program: createDebugNormalsProgram(),
	});
	const debugNormalMesh = createDebugObject({
		...cubeMesh,
		matrix,
		material: debugProgram,
	});

	const material = createMaterialStore({
		diffuse: [1, 0.5, 0.5],
		metalness: 0,
	});

	$materials = [...$materials, material, debugProgram];

	$scene = [
		...$scene,
		create3DObject({
			...cubeMesh,
			matrix,
			material,
		}),
		create3DObject(debugNormalMesh),
	];
	$lights = [...$lights, light];

	$renderer = {
		...$renderer,
		loop: animate,
		enabled: true,
	};

	createOrbitControls(canvas, camera);
	/*setTimeout(() => {
		console.log("go", rgbeImage);
		const { gl } = appContext;
		const texture = hdrToCube(rgbeImage.data, gl, rgbeImage.width, rgbeImage.height, 1024);
		console.log("texture", texture);
	}, 0);*/
});

function animate() {}
</script>
<canvas bind:this={canvas}></canvas>
<Menu />