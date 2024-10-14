<script type="module">
import { onMount } from "svelte";
import { renderer, materials } from "./store/engine.js";
import { scale, identity } from "gl-matrix/esm/mat4.js";
import { transformMat4 } from "gl-matrix/esm/vec3.js";
import { createPointLight } from "./lights/point-light.js";
import { createOrbitControls } from "./interactivity/orbit-controls.js";
import { skyblue } from "./color/color-keywords.js";
import { createPolyhedron, createSmoothShadedNormals } from "./geometries/polyhedron.js";
import { createCube } from "./geometries/cube.js";
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
	const file = await loadGLTFFile("models/v2/md-blend6-mdlvw.gltf","models/v2/md-blend6-mdlvw.bin");
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
	scale(meshAbsoluteMatrix, meshAbsoluteMatrix, [3, 3, 3]);
	meshObject.matrix = meshAbsoluteMatrix;
	const loadedMesh = createMeshFromGLTF(file, meshObject);

	renderer.setCanvas(canvas);
	renderer.setBackgroundColor(skyblue);
	renderer.setAmbientLight(0xffffff, 0.5);
	//camera = renderer.setCamera(...Object.values(cameraFromFile));
	camera = renderer.setCamera([0, 5, -5], [0, 0, 0], 75);
	/*
	const diffuseMap = await createTexture({
		url: "checker-map_tho.png",
		//normalScale: [1, 1],
		type: "diffuse",
		coordinateSpace: "circular",
	});
	camera = renderer.setCamera([0, 5, -5], [0, 0, 0], 75);
	const sphereGeometry = createPolyhedron(1, 10, createSmoothShadedNormals);
	sphereGeometry.uvs = generateUVs(sphereGeometry);
	const planeGeometry = createPlane(3, 3, 100, 100);
	const coneGeometry = createCone(3, 3, 50);
	const initialMatrix = identity(new Float32Array(16));
	rotateX(initialMatrix, initialMatrix, -(Math.PI / 2));*/

	
	//const cubeMesh = createPolyhedron(1.5, 7, createSmoothShadedNormals);
	const cubeMesh = createCube();
	
	const cube = renderer.addMesh({
		...cubeMesh,
		matrix: identity(new Float32Array(16)),
		material: {
			diffuse: [1, 0.5, 0.5],
		},
	});
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
	/*renderer.addAnimation(
		mesh1,
		createWobblyAnimation({
			frequency: 0.004,
			amplitude: 5,
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