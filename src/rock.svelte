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
import { identity, rotate, rotateX, rotateY, rotateZ, scale, translate } from "gl-matrix/esm/mat4.js";
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
import { get } from "svelte/store";
import { createSpecular } from "./material/specular/specular.js";
import { createCylinder } from "./geometries/cylinder.js";
import { createPolyhedron } from "./geometries/polyhedron.js";
import { createFlatShadedNormals } from "./geometries/common.js";

let canvas;
let light1;
let light2;
let ennemi1;
let cylinder;
onMount(async () => {
	const file = await loadGLTFFile("models/rock.gltf", "models/rock.bin");
	let meshObject;
	traverseScene(file.scene, (o) => {
		if (o.position != null) {
			meshObject = o;
		}
	});
	const loadedMesh = createMeshFromGLTF(file, meshObject);
	const diffuseMap = await createTexture({
		url: "rock-diffuse.jpg",
		type: "diffuse",
	});
	const normalMap = await createTexture({
		url: "rock-normal.png",
		type: "normal",
	});
	const meshMaterial = createMaterialStore({
		metalness: loadedMesh.material.metalness,
		diffuse: [0.67, 0.68, 0.81],
		diffuseMap,
		normalMap,
	});
	loadedMesh.material = meshMaterial;

	const ennemi1File = await loadGLTFFile("models/ennemi1.gltf", "models/ennemi1.bin");
	let ennemi1MeshObject;
	traverseScene(ennemi1File.scene, (o) => {
		if (o.position != null) {
			ennemi1MeshObject = o;
		}
	});
	const ennemi1Mesh = createMeshFromGLTF(ennemi1File, ennemi1MeshObject);
	const ennemi1DiffuseMap = await createTexture({
		url: "models/ennemi1-diffuse.png",
		type: "diffuse",
	});
	const ennemi1RoughnessMap = await createTexture({
		url: "models/ennemi1-roughness.png",
		type: "roughness",
	});
	console.log("ennemi1Mesh.material", ennemi1Mesh.material);
	const ennemi1Material = createMaterialStore({
		...ennemi1Mesh.material,
		specular: createSpecular({
			roughness: 1,
			ior: 1.4,
			intensity: 0.8,
			color: [1, 1, 1],
		}),
		diffuse: [1, 1, 1],
		diffuseMap: ennemi1DiffuseMap,
		roughnessMap: ennemi1RoughnessMap,
	});
	ennemi1Mesh.material = ennemi1Material;

	$renderer = {
		...$renderer,
		canvas,
		backgroundColor: skyblue,
		ambientLightColor: [0xffffff, 0.1],
	};

	$camera = {
		...$camera,
		position: [0, 3, 10],
		target: [0, 3, 0],
		fov: 75,
	};

	light1 = createLightStore(
		createPointLight({
			color: [0.996078431372549, 0.9529411764705882, 0.6627450980392157],
			intensity: 7.5,
			position: [0, 9, 0],
			cutoffDistance: 27,
			decayExponent: 0.05,
		}),
	);

	light2 = createLightStore(
		createPointLight({
			position: [-3, -3, 1],
			color: [0.6313725490196078, 0.6235294117647059, 0.996078431372549],
			intensity: 0,
			cutoffDistance: 15,
			decayExponent: 0.25,
		}),
	);

	const numInstances = 20;
	const originalMatrix = loadedMesh.matrix;
	let matrices = new Array(numInstances).fill(0).map((_, index) => {
		/*const count = index - Math.floor(numInstances / 2);*/
		let mat = [...originalMatrix];

		//transform the model matrix
		translate(mat, mat, [0, index * 2 - 4, -4.5]);
		//scale(mat, mat, [1, 1, -1]);
		//rotate(mat, mat, Math.PI/2,[0,1,0]);
		return new Float32Array(mat);
	});
	loadedMesh.instances = numInstances;

	delete loadedMesh.matrix;
	loadedMesh.matrices = matrices;
	const leftRocks = create3DObject(loadedMesh, false, [1, 0, 0]);

	/*matrices = new Array(numInstances).fill(0).map((_, index) => {
		let mat = [...originalMatrix];

		//transform the model matrix
		translate(mat, mat, [0, index * 2 - 4, 4.5]);
		scale(mat, mat, [1, 1, -1]);
		//rotate(mat, mat, Math.PI/2,[0,1,0]);
		return new Float32Array(mat);
	});
	const rightRocks = create3DObject({
		...loadedMesh,
		matrices,
	},false);*/

	ennemi1 = create3DObject(
		{
			...ennemi1Mesh,
		},
		false,
	);
	const cylinderGeometry = createCylinder(1, 1, 32, 1);
	console.log("cylinderGeometry", cylinderGeometry);
	const cylinderMaterial = createMaterialStore({
		diffuse: [0.916, 0.916, 0.916],
		metalness: 0.8090909123420715,
		specular: createSpecular({
			roughness: 0.1,
			ior: 1.4,
			intensity: 0.8,
			color: [1, 1, 1],
		}),
	});
	const cylinderMatrix = identity(new Float32Array(16));
	translate(cylinderMatrix, cylinderMatrix, [0, 1, 0]);

	cylinder = create3DObject({
		...cylinderGeometry,
		material: cylinderMaterial,
		matrix: cylinderMatrix,
	});
	$materials = [...$materials, meshMaterial, ennemi1Material, cylinderMaterial];

	$scene = [...$scene, /*leftRocks,rightRocks,*/ ennemi1, cylinder];

	$lights = [...$lights, light1, light2];

	$renderer = {
		...$renderer,
		loop: animate,
		enabled: true,
	};

	createOrbitControls(canvas, camera);
});

function animate() {
	/*
	const currentPosition = $camera.position;
	currentPosition[1] += 0.01;
	const currentTarget = $camera.target;
	currentTarget[1] += 0.01;
	$camera = { ...$camera, position: currentPosition,target: currentTarget };
	const currentLight1 = get(light1);
	currentLight1.position[1] += 0.01;
	const currentLight2 = get(light2);
	currentLight2.position[1] += 0.01;

	light1.set({ ...currentLight1 });
	light2.set({ ...currentLight2 });
	const matrix = get(ennemi1.matrix);
	translate(matrix, matrix, [0, 0.01, 0]);
	ennemi1.matrix.set( matrix);*/
	// make the ennemi1 move in circle
	//const ennemiMatrix = get(ennemi1.matrix);
	/*
	const angle = performance.now() * 0.001;
	const radius = 5;
	const x = Math.cos(angle) * radius;
	const y = Math.sin(angle) * radius;
	const ennemiMatrix = identity(new Float32Array(16));
	translate(ennemiMatrix, ennemiMatrix, [x, y, 0]);
	rotateX(ennemiMatrix, ennemiMatrix, Math.PI / 2);
	rotateZ(ennemiMatrix, ennemiMatrix, performance.now() * 0.005);
	ennemi1.matrix.set(ennemiMatrix);*/
	const cylinderMatrix = get(cylinder.matrix);
	rotateX(cylinderMatrix, cylinderMatrix, 0.001);
	cylinder.matrix.set(cylinderMatrix);
}
</script>
<canvas bind:this={canvas}></canvas>
<Menu />
<DebugPanel />