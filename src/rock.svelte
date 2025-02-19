<script type="module">
import { onMount } from "svelte";
import {
	createLightStore,
	renderer,
	scene,
	camera,
	create3DObject,
	lights,
	materials,
	createMaterialStore,
} from "./store/engine-refactor.js";
import { identity, rotate, rotateZ, scale, translate } from "gl-matrix/esm/mat4.js";
import { createPointLight } from "./lights/point-light.js";
import { skyblue } from "./color/color-keywords.js";
import { createOrbitControls } from "./interactivity/orbit-controls.js";
import {
	createCameraFromGLTF,
	createMeshFromGLTF,
	getAbsoluteNodeMatrix,
	loadGLTFFile,
	traverseScene,
} from "./loaders/gltf-loader.js";
import { transformMat4 } from "gl-matrix/esm/vec3.js";
import Menu from "./Menu.svelte";
import DebugPanel from "./components/DebugPanel/DebugPanel.svelte";
import { createTexture } from "./texture/texture.js";

let canvas;
onMount(async () => {
	const file = await loadGLTFFile("models/rock.gltf", "models/rock.bin");
	let meshObject;
	let cameraGLTF;
	traverseScene(file.scene, (o) => {
		if (o.position != null) {
			meshObject = o;
		} else if (o.camera != null) {
			cameraGLTF = o;
		}
	});
	/*const cameraAbsoluteMatrix = getAbsoluteNodeMatrix(cameraGLTF);
	const cameraFromFile = createCameraFromGLTF(cameraGLTF);
	transformMat4(cameraFromFile.position, cameraFromFile.position, cameraAbsoluteMatrix);
	const meshAbsoluteMatrix = getAbsoluteNodeMatrix(meshObject);

	rotateZ(meshAbsoluteMatrix, meshAbsoluteMatrix, Math.PI);
	scale(meshAbsoluteMatrix, meshAbsoluteMatrix, [200, 200, 200]);
	translate(meshAbsoluteMatrix, meshAbsoluteMatrix, [0, 0, -500]);

	meshObject.matrix = identity(new Float32Array(16));*/
	const loadedMesh = createMeshFromGLTF(file, meshObject);
	//loadedMesh.matrix = identity(new Float32Array(16));;

	$renderer = {
		...$renderer,
		canvas,
		backgroundColor: skyblue,
		ambientLightColor: [0xffffff, 0.1],
	};

	$camera = {
		position: [0, 3, 10],
		target: [0, 3, 0],
		fov: 75,
	};

	const light = createLightStore(
		createPointLight({
			position: [-6, 7, 3],
			color: [0.996078431372549, 0.9529411764705882, 0.6627450980392157],
			intensity: 7.5,
			cutoffDistance: 0,
			decayExponent: 1,
		}),
	);

	const light2 = createLightStore(
		createPointLight({
			color: [0.6313725490196078, 0.6235294117647059, 0.996078431372549],
			intensity: 3,
			position: [3, -3, 1],
			cutoffDistance: 7.5,
			decayExponent: 0.25,
		}),
	);
	const diffuseMap = await createTexture({
		url: "rock-diffuse.jpg",
		type: "diffuse",
	});
	const normalMap = await createTexture({
		url: "rock-normal.png",
		type: "normal",
	});
	const meshMaterial = createMaterialStore({
		...loadedMesh.material,
		diffuse: [0.67, 0.68, 0.81],
		diffuseMap,
		normalMap,
	});
	loadedMesh.material = meshMaterial;

	$materials = [...$materials, meshMaterial];

	const numInstances = 8;
	const identityMatrix = new Array(16).fill(0);
	identity(identityMatrix);
	let matrices = new Array(numInstances).fill(0).map((_, index) => {
		/*const count = index - Math.floor(numInstances / 2);*/
		let mat = [...loadedMesh.matrix];

		//transform the model matrix
		translate(mat, mat, [0, index * 2 - 4, 0]);
		scale(mat, mat, [1, 1, -1]);
		//rotate(mat, mat, Math.PI/2,[0,1,0]);
		return new Float32Array(mat);
	});
	loadedMesh.instances = numInstances;
	delete loadedMesh.matrix;
	loadedMesh.matrices = matrices;
	$scene = [...$scene, create3DObject(loadedMesh, false, [1, 0, 0])];

	$lights = [...$lights, light, light2];

	$renderer = {
		...$renderer,
		loop: animate,
		enabled: true,
	};

	createOrbitControls(canvas, camera);
});

function animate() {
	// animate here
}
</script>
<canvas bind:this={canvas}></canvas>
<Menu />
<DebugPanel />