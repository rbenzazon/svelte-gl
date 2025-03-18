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
import { createPolyhedron, createSmoothShadedNormals } from "./geometries/polyhedron.js";
import { createOrbitControls } from "./interactivity/orbit-controls.js";
import Menu from "./Menu.svelte";
import { createZeroMatrix } from "./geometries/common.js";
import { createDebugObject } from "./geometries/debug.js";
import { createDebugNormalsProgram } from "./store/debug-program.js";
import { loadRGBE } from "./loaders/rgbe-loader.js";
import { hdrToCube, getToneMapping } from "./loaders/hdr-to-cube.js";
import { createEnvironmentMap } from "./texture/environment-map.js";
import { createEnvMapTexture } from "./texture/environment-map-texture.js";
import { createTexture } from "./texture/texture.js";
import { createPlane } from "./geometries/plane.js";
import { createSpecular } from "./material/specular/specular.js";
import { createACESFilmicToneMapping } from "./tone-mapping/aces-filmic-tone-mapping.js";
import { renderState } from "./store/engine";

let canvas;
let rgbeImage;
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
		position: [-4.5, 0.8, -2.5],
		target: [0, 0, 0],
		fov: 75,
	};
	rgbeImage = await loadRGBE("christmas_photo_studio_01_4k.hdr");
	const hdrToneMapping = getToneMapping(1);
	const skyBox = await createSkyBox({
		typedArray: rgbeImage.data,
		convertToCube: hdrToCube,
		width: rgbeImage.width,
		height: rgbeImage.height,
		cubeSize: 2048,
		toneMapping: hdrToneMapping,
	});

	const environmentMap = createEnvironmentMap(rgbeImage);
	console.log("environmentMap", environmentMap);

	$renderPasses = [skyBox, environmentMap];

	const sphereMesh = createPolyhedron(2, 3, createSmoothShadedNormals);

	const matrix = identity(createZeroMatrix());

	const debugProgram = createMaterialStore({
		diffuse: [1, 0, 0],
		metalness: 0,
		program: createDebugNormalsProgram(),
	});
	const debugNormalMesh = createDebugObject({
		...sphereMesh,
		matrix,
		material: debugProgram,
	});

	const light = createLightStore(
		createPointLight({
			position: [-2, 2, 2],
			color: [1, 1, 1],
			intensity: 5,
			cutoffDistance: 0,
			decayExponent: 2,
		}),
	);

	const envMap = createEnvMapTexture({
		envMap: environmentMap.getTexture,
		width: environmentMap.width,
		height: environmentMap.height,
		lodMax: environmentMap.lodMax,
	});
	console.log("envMap", envMap);

	const material = createMaterialStore({
		diffuse: [1, 1, 1],
		metalness: 0,
		specular: createSpecular({
			roughness: 0.05,
			ior: 1.5,
			intensity: 1,
			color: [1, 1, 1],
		}),
		/*envMap,*/
	});

	$materials = [...$materials, material /*,debugProgram*/];

	$scene = [
		...$scene,
		create3DObject({
			...sphereMesh,
			matrix,
			material,
		}),
		/*create3DObject(debugNormalMesh),*/
	];
	$lights = [...$lights, light];

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