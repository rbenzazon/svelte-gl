<script type="module">
import { onMount } from "svelte";
import { get } from "svelte/store";
import { renderer } from "./store/engine.js";
//import { createCube } from "./geometries/cube.js";
import { identity, rotateX, rotateY, rotateZ, translate, scale } from "gl-matrix/esm/mat4.js";
import { transformMat4 } from "gl-matrix/esm/vec3.js";
import { createPolyhedron, createSmoothShadedNormals, generateUVs } from "./geometries/polyhedron.js";
//import { createPlane } from "./geometries/plane.js";
import { createCone } from "./geometries/cone.js";
import { createPointLight } from "./lights/point-light.js";
import { createAGXToneMapping } from "./tone-mapping/agx.js";
import { createOrbitControls } from "./interactivity/orbit-controls.js";
import { /*createFlatShadedNormals,*/ distributeCirclePoints, toRadian } from "./geometries/common.js";
import { createSpecular } from "./material/specular/specular.js";
import { skyblue } from "./color/color-keywords.js";
import { createTexture } from "./texture/texture.js";
//import {loadGLBFile } from "./loaders/glb-loader.js";
import { createWobblyAnimation } from "./animation/wobbly/wobbly.js";
import { createPulsatingScaleAnimation } from "./animation/pulsating-scale/pulsating-scale.js";
import { createNoiseDistortionAnimation } from "./animation/noise-distortion/noise-distortion.js";
import {
	loadGLTFFile,
	createMeshFromGLTF,
	traverseScene,
	getAbsoluteNodeMatrix,
	createCameraFromGLTF,
} from "./loaders/gltf-loader.js";

let canvas;
let light1;
let mesh1;
let camera;
onMount(async () => {
	const file = await loadGLTFFile("models/v2/md-blend6-mdlvw.gltf");
	let meshObject;
	let camera;
	traverseScene(file.scene, (o) => {
		if (o.position != null) {
			meshObject = o;
		} else if (o.camera != null) {
			camera = o;
		}
	});
	const cameraAbsoluteMatrix = getAbsoluteNodeMatrix(camera);
	const cameraFromFile = createCameraFromGLTF(camera);
	transformMat4(cameraFromFile.position, cameraFromFile.position, cameraAbsoluteMatrix);
	const meshAbsoluteMatrix = getAbsoluteNodeMatrix(meshObject);
	meshObject.matrix = meshAbsoluteMatrix;
	const loadedMesh = createMeshFromGLTF(file, meshObject);
	const diffuseMap = await createTexture({
		url: "checker-map_tho.png",
		/*normalScale: [1, 1],*/
		type: "diffuse",
		coordinateSpace: "circular",
	});
	renderer.setCanvas(canvas);
	renderer.setBackgroundColor(skyblue);
	renderer.setAmbientLight(0xffffff, 0.5);
	/*camera = renderer.setCamera(cameraFromFile.position,
		cameraFromFile.target,
		(cameraFromFile.fov/Math.PI)*180,
		cameraFromFile.near,
		cameraFromFile.far);//[0, 5, -5], [0, 0, 0], 75);*/
	//camera = renderer.setCamera([0, 5, -5], [0, 0, 0], 75, undefined, undefined, undefined, absoluteCamera);
	camera = renderer.setCamera(...Object.values(cameraFromFile));

	const sphereGeometry = createPolyhedron(1, 10, createSmoothShadedNormals);
	sphereGeometry.uvs = generateUVs(sphereGeometry);
	//const planeGeometry = createPlane(3, 3, 100, 100);
	const coneGeometry = createCone(3, 3, 50);
	const initialMatrix = identity(new Float32Array(16));
	rotateX(initialMatrix, initialMatrix, -(Math.PI / 2));
	mesh1 = renderer.addMesh(loadedMesh);
	/*renderer.addAnimation(
		mesh1,
		createPulsatingScaleAnimation({
			minScale: 1,
			maxScale: 1.5,
			frequency: 0.002,
		}),
	);*/

	/*renderer.addAnimation(
		mesh1,
		createNoiseDistortionAnimation({
			frequency: 2,
			speed: 1.5,
			amplitude: 0.5,
		}),
	);*/

	light1 = renderer.addLight(
		createPointLight({
			position: [-2, 3, 0],
			color: [1, 1, 1],
			intensity: 20,
			cutoffDistance: 0,
			decayExponent: 2,
		}),
	);

	/*renderer.addLight(
		createPointLight({
			position: [0, 5, 5],
			color: [1, 1, 1],
			intensity: 4,
			cutoffDistance: 0,
			decayExponent: 2,
		}),
	);*/

	renderer.setLoop(animate);
	renderer.start();
	createOrbitControls(canvas, camera);
});

function animate() {
	/*const rotation = 0.001 * Math.PI;
	for (let i = 0; i < numInstances; i++) {
		const tmp = get(mesh1.matrices[i]);
		rotateY(tmp, tmp, rotation / 2);
		rotateX(tmp, tmp, rotation);
		rotateZ(tmp, tmp, rotation / 3);
		mesh1.matrices[i].set(tmp);
	}*/
	/*
	const lightX = Math.sin(performance.now() / 2000) * 0.5;
	const lightY = Math.cos(performance.now() / 2000) * 0.5;
	const r = Math.sin(performance.now() / 6000) * 0.5 + 0.5;
	const g = Math.cos(performance.now() / 5000) * 0.5 + 0.5;
	const b = Math.sin(performance.now() / 4000) * 0.5 + 0.5;
	light1.set({
		position: [lightX, lightY, -0.4],
		color: [r, g, b],
	});*/
}
</script>
<canvas bind:this={canvas}></canvas>