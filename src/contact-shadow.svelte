<script type="module">
import { onMount } from "svelte";
import { scene } from "./store/scene.js";
import { create3DObject } from "./store/create-object.js";
import { renderPasses } from "./store/programs.js";
import { createMaterialStore, materials } from "./store/materials.js";
import { createLightStore, lights } from "./store/lights.js";
import { renderer } from "./store/renderer.js";
import { camera } from "./store/camera.js";
import { identity, rotateZ, scale, translate } from "gl-matrix/esm/mat4.js";
import { createPointLight } from "./lights/point-light.js";
import { skyblue } from "./color/color-keywords.js";
import { createPolyhedron, createSmoothShadedNormals } from "./geometries/polyhedron.js";
import { createCube } from "./geometries/cube.js";
import { createPlane } from "./geometries/plane.js";
import { createOrbitControls } from "./interactivity/orbit-controls.js";
import { createTexture } from "./texture/texture.js";
import { createContactShadowPass } from "./store/contact-shadow.js";
import {
	createCameraFromGLTF,
	createMeshFromGLTF,
	getAbsoluteNodeMatrix,
	isGLTFCameraData,
	isGLTFMeshData,
	loadGLTFFile,
	mapScene,
} from "./loaders/gltf-loader.js";
import { transformMat4 } from "gl-matrix/esm/vec3.js";
import Menu from "./Menu.svelte";
import { createZeroMatrix } from "./geometries/common.js";
import { renderState } from "./store/engine";

let canvas;
onMount(async () => {
	const file = await loadGLTFFile("models/v2/md-blend6-mdlvw.gltf", "models/v2/md-blend6-mdlvw.bin");
	const sceneObjects = mapScene(file.scene);
	const meshObject = sceneObjects.find(isGLTFMeshData);
	const cameraGLTF = sceneObjects.find(isGLTFCameraData);

	const cameraAbsoluteMatrix = getAbsoluteNodeMatrix(cameraGLTF);
	const cameraFromFile = createCameraFromGLTF(cameraGLTF);
	transformMat4(cameraFromFile.position, cameraFromFile.position, cameraAbsoluteMatrix);
	const meshAbsoluteMatrix = getAbsoluteNodeMatrix(meshObject);

	rotateZ(meshAbsoluteMatrix, meshAbsoluteMatrix, Math.PI);
	scale(meshAbsoluteMatrix, meshAbsoluteMatrix, [200, 200, 200]);
	translate(meshAbsoluteMatrix, meshAbsoluteMatrix, [0, 0, -500]);

	meshObject.matrix = meshAbsoluteMatrix;
	const loadedMesh = createMeshFromGLTF(file, meshObject);

	const groundMatrix = identity(createZeroMatrix());
	translate(groundMatrix, groundMatrix, [0, -1.2, 0]);

	$renderer = {
		...$renderer,
		canvas,
		backgroundColor: skyblue,
		ambientLightColor: [0xffffff, 0.1],
	};

	const shadowPass = createContactShadowPass(groundMatrix, 1, 10, 10, 1024, 128, 20);
	const { getTexture: shadowTexture } = shadowPass;

	$renderPasses = [shadowPass];

	$camera = {
		...$camera,
		position: [0, 5, -5],
		target: [0, 1, 0],
		fov: 75,
	};

	const cubeMesh = createCube();
	const sphereMesh = createPolyhedron(1, 5, createSmoothShadedNormals);

	const light = createLightStore(
		createPointLight({
			position: [-2, 3, -3],
			color: [1, 1, 1],
			intensity: 15,
			cutoffDistance: 0,
			decayExponent: 2,
		}),
	);
	const light2 = createLightStore(
		createPointLight({
			position: [2, -1, -1],
			color: [1, 1, 1],
			intensity: 15,
			cutoffDistance: 0,
			decayExponent: 2,
		}),
	);

	const objScale = 0.5;
	const cubePos = identity(createZeroMatrix());
	translate(cubePos, cubePos, [3, 0, 0]);
	scale(cubePos, cubePos, [objScale, objScale, objScale]);

	const spherePos = identity(createZeroMatrix());
	translate(spherePos, spherePos, [-3, 0, 0]);
	scale(spherePos, spherePos, [objScale, objScale, objScale]);

	const sameMaterial = createMaterialStore({
		diffuse: [1, 0.5, 0.5],
		metalness: 0,
	});
	const groundMesh = createPlane(10, 10, 1, 1);
	const groundDiffuseMap = await createTexture({
		textureBuffer: shadowTexture,
		type: "diffuse",
	});
	const groundMaterial = createMaterialStore({
		diffuse: [1, 1, 1],
		metalness: 0,
		diffuseMap: groundDiffuseMap,
	});

	const meshMaterial = createMaterialStore(loadedMesh.material);

	$materials = [...$materials, sameMaterial, meshMaterial, groundMaterial];

	$scene = [
		...$scene,
		create3DObject({
			...loadedMesh,
			matrix: meshAbsoluteMatrix,
			material: meshMaterial,
		}),
		create3DObject({
			...sphereMesh,
			matrix: spherePos,
			material: sameMaterial,
		}),
		create3DObject({
			...cubeMesh,
			matrix: cubePos,
			material: sameMaterial,
		}),
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

	/*setTimeout(() => {
		$camera = {
			position: [0, 5, -4],
		};
	}, 1000);*/
});

function animate() {
	// animate here
}
</script>
<canvas bind:this={canvas}></canvas>
<Menu />