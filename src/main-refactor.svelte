<script type="module">
import { onMount } from "svelte";
import {
	createAmbientLight,
	createBackgroundColor,
	createLightStore,
	renderer,
	scene,
	camera,
	renderPasses,
} from "./store/engine-refactor.js";
import {
	getRotation,
	getScaling,
	getTranslation,
	identity,
	rotateX,
	rotateY,
	rotateZ,
	scale,
	translate,
} from "gl-matrix/esm/mat4.js";
import { createPointLight } from "./lights/point-light.js";
import { skyblue } from "./color/color-keywords.js";
import { createPolyhedron, createSmoothShadedNormals } from "./geometries/polyhedron.js";
import { createCube } from "./geometries/cube.js";
import { createPlane } from "./geometries/plane.js";
import { createOrbitControls } from "./interactivity/orbit-controls.js";
import { createTexture } from "./texture/texture.js";
import { createContactShadowPass } from "./store/contact-shadow.js";
import { getCameraProjectionView } from "./store/gl-refactor.js";
import {
	createCameraFromGLTF,
	createMeshFromGLTF,
	getAbsoluteNodeMatrix,
	loadGLTFFile,
	traverseScene,
} from "./loaders/gltf-loader.js";
import { transformMat4 } from "gl-matrix/esm/vec3.js";

let canvas;
onMount(async () => {
	const file = await loadGLTFFile("models/v2/md-blend6-mdlvw.gltf", "models/v2/md-blend6-mdlvw.bin");
	let meshObject;
	let cameraGLTF;
	traverseScene(file.scene, (o) => {
		if (o.position != null) {
			meshObject = o;
		} else if (o.camera != null) {
			cameraGLTF = o;
		}
	});
	const cameraAbsoluteMatrix = getAbsoluteNodeMatrix(cameraGLTF);
	const cameraFromFile = createCameraFromGLTF(cameraGLTF);
	transformMat4(cameraFromFile.position, cameraFromFile.position, cameraAbsoluteMatrix);
	const meshAbsoluteMatrix = getAbsoluteNodeMatrix(meshObject);
	console.log("meshAbsoluteMatrix", meshAbsoluteMatrix);
	console.log("meshAbsoluteMatrix scale", getScaling(new Float32Array(3), meshAbsoluteMatrix));
	console.log("meshAbsoluteMatrix translation", getTranslation(new Float32Array(3), meshAbsoluteMatrix));

	rotateZ(meshAbsoluteMatrix, meshAbsoluteMatrix, Math.PI);
	scale(meshAbsoluteMatrix, meshAbsoluteMatrix, [200, 200, 200]);
	translate(meshAbsoluteMatrix, meshAbsoluteMatrix, [0, 0, -500]);
	console.log("meshAbsoluteMatrix", meshAbsoluteMatrix);
	console.log("meshAbsoluteMatrix scale", getScaling(new Float32Array(3), meshAbsoluteMatrix));
	console.log("meshAbsoluteMatrix translation", getTranslation(new Float32Array(3), meshAbsoluteMatrix));
	meshObject.matrix = meshAbsoluteMatrix;
	const loadedMesh = createMeshFromGLTF(file, meshObject);
	loadedMesh.matrix = meshAbsoluteMatrix;
	console.log("loadedMesh", loadedMesh);

	const groundMatrix = identity(new Float32Array(16));
	translate(groundMatrix, groundMatrix, [0, -1.5, 0]);

	$renderer = {
		...$renderer,
		canvas,
		backgroundColor: skyblue,
		ambientLightColor: [0xffffff, 0.5],
	};

	const shadowPass = createContactShadowPass(groundMatrix, 1, 10, 10, 1024, 128, 50);
	const { getTexture: shadowTexture } = shadowPass;

	$renderPasses = [shadowPass];
	console.log(cameraFromFile);

	$camera = {
		position: [0, 5, -5],
		target: [0, 0, 0],
		fov: 75,

		//...cameraFromFile
	};

	const cubeMesh = createCube();
	const sphereMesh = createPolyhedron(1, 5, createSmoothShadedNormals);

	const light = createLightStore(
		createPointLight({
			position: [-2, 3, 0],
			color: [1, 1, 1],
			intensity: 20,
			cutoffDistance: 0,
			decayExponent: 2,
		}),
	);

	const secondCubePos = identity(new Float32Array(16));
	translate(secondCubePos, secondCubePos, [3, 0, 0]);

	const sameMaterial = {
		diffuse: [1, 0.5, 0.5],
		metalness: 0,
	};
	const groundMesh = createPlane(10, 10, 1, 1);
	const groundDiffuseMap = await createTexture({
		textureBuffer: shadowTexture,
		type: "diffuse",
	});
	const diffuseMap = await createTexture({
		url: "transparent-texture.png",
		type: "diffuse",
	});
	const groundMaterial = {
		diffuse: [1, 1, 1],
		metalness: 0,
		//diffuseMap,
		diffuseMap: groundDiffuseMap,
		transparent: true,
	};
	const transparentMaterial = {
		diffuse: [1, 1, 0.5],
		metalness: 0,
		opacity: 0.5,
	};
	$scene = [
		...$scene,
		loadedMesh,
		/*{
			...sphereMesh,
			matrix: identity(new Float32Array(16)),
			material: transparentMaterial,
		},
		{
			...cubeMesh,
			matrix: secondCubePos,
			material: sameMaterial,
		},*/
		{
			...groundMesh,
			matrix: groundMatrix,
			material: groundMaterial,
		},
		light,
	];

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
	const time = performance.now() / 1000;
	const zpos = Math.sin(time) * 2 - 5;
	/*$camera = {
		position: [0, 5, -zpos],
	};*/
	//console.log("animate", $camera.position);
}
</script>
<canvas bind:this={canvas}></canvas>