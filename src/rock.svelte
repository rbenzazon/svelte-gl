<script type="module">
import { onMount } from "svelte";
import { scene } from "./store/scene.js";
import { create3DObject } from "./store/create-object.js";
import { materials, createMaterialStore } from "./store/materials.js";
import { createLightStore, lights } from "./store/lights.js";
import { renderer } from "./store/renderer.js";
import { camera } from "./store/camera.js";
import { identity, rotate, rotateX, rotateY, rotateZ, scale, translate } from "gl-matrix/esm/mat4.js";
import { createPointLight } from "./lights/point-light.js";
import { skyblue } from "./color/color-keywords.js";
import { createOrbitControls } from "./interactivity/orbit-controls.js";
import { createMeshFromGLTF, isGLTFMeshData, loadGLTFFile, mapScene, traverseScene } from "./loaders/gltf-loader.js";
import Menu from "./Menu.svelte";
import DebugPanel from "./components/DebugPanel/DebugPanel.svelte";
import { createTexture } from "./texture/texture.js";
import { get } from "svelte/store";
import { createSpecular } from "./material/specular/specular.js";
import { createCylinder } from "./geometries/cylinder.js";
import { createPolyhedron } from "./geometries/polyhedron.js";
import { cloneMatrix, createFlatShadedNormals, createZeroMatrix } from "./geometries/common.js";
import { createDebugNormalsProgram } from "./store/debug-program.js";
import { createDebugObject } from "./geometries/debug.js";
import { createPlane } from "./geometries/plane.js";

let canvas;
let light1;
let light2;
let ennemi1;
let cylinder;
let scrollY = 0;
onMount(async () => {
	const rockLeftFile = await loadGLTFFile("models/rock-left.gltf", "models/rock-left.bin");

	const rockLeftData = mapScene(rockLeftFile.scene).find(isGLTFMeshData);
	const rockLeftMesh = createMeshFromGLTF(rockLeftFile, rockLeftData);
	const rockDiffuseMap = await createTexture({
		url: "rock-diffuse.jpg",
		type: "diffuse",
	});
	const rockNormalMap = await createTexture({
		url: "rock-normal.png",
		type: "normal",
	});
	const rockMaterial = createMaterialStore({
		metalness: rockLeftMesh.material.metalness,
		diffuse: [0.67, 0.68, 0.81],
		diffuseMap: rockDiffuseMap,
		normalMap: rockNormalMap,
	});

	const numInstances = 20 * 3;
	/** @type {mat4} */
	const rockLeftOriginalMatrix = identity(createZeroMatrix());
	/*//set translate x to 0
	rockLeftOriginalMatrix[12] = 0;
	//set translate y to 0
	rockLeftOriginalMatrix[13] = 0;
	//set translate z to 0	
	rockLeftOriginalMatrix[14] = 0;*/

	let rockLeftMatrices = new Array(numInstances).fill(0).map((_, index) => {
		/*const count = index - Math.floor(numInstances / 2);*/
		/** @type {mat4} */
		let mat = cloneMatrix(rockLeftOriginalMatrix);

		//transform the model matrix
		translate(mat, mat, [-10, index * 2 - 4, 0]);
		//scale(mat, mat, [1, 1, -1]);
		//rotate(mat, mat, Math.PI/2,[0,1,0]);
		return mat;
	});
	delete rockLeftMesh.matrix;
	const leftRocks = create3DObject({
		...rockLeftMesh,
		material: rockMaterial,
		instances: numInstances,
		matrices: rockLeftMatrices,
	});

	const rockRightFile = await loadGLTFFile("models/rock-right.gltf", "models/rock-right.bin");

	const rockRightData = mapScene(rockRightFile.scene).find(isGLTFMeshData);
	const rockRightMesh = createMeshFromGLTF(rockRightFile, rockRightData);

	/** @type {mat4} */
	const rockRightOriginalMatrix = identity(createZeroMatrix());
	/*rockRightOriginalMatrix[12] = 0;
	//set translate y to 0
	rockRightOriginalMatrix[13] = 0;
	//set translate z to 0	
	rockRightOriginalMatrix[14] = 0;*/
	let rockRightMatrices = new Array(numInstances).fill(0).map((_, index) => {
		/*const count = index - Math.floor(numInstances / 2);*/
		/** @type {mat4} */
		let mat = cloneMatrix(rockRightOriginalMatrix);

		//transform the model matrix
		translate(mat, mat, [10, index * 2 - 4, 0]);
		//scale(mat, mat, [1, 1, -1]);
		//rotate(mat, mat, Math.PI/2,[0,1,0]);
		return mat;
	});

	delete rockRightMesh.matrix;
	const rightRocks = create3DObject({
		...rockRightMesh,
		material: rockMaterial,
		instances: numInstances,
		matrices: rockRightMatrices,
	});

	const ennemi1File = await loadGLTFFile("models/ennemi1.gltf", "models/ennemi1.bin");
	const ennemi1Data = mapScene(ennemi1File.scene).find(isGLTFMeshData);

	const ennemi1Mesh = createMeshFromGLTF(ennemi1File, ennemi1Data);
	const ennemi1DiffuseMap = await createTexture({
		url: "models/ennemi1-diffuse.png",
		type: "diffuse",
	});
	const ennemi1RoughnessMap = await createTexture({
		url: "models/ennemi1-roughness.png",
		type: "roughness",
	});
	const ennemi1Material = createMaterialStore({
		...ennemi1Mesh.material,
		metalness: 0.8090909123420715,
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

	ennemi1 = create3DObject({
		...ennemi1Mesh,
		material: ennemi1Material,
	});

	const backgroundGeometry = createPlane(100, 100, 1, 1);
	const backgroundTexture = await createTexture({
		url: "background.jpg",
		type: "diffuse",
	});
	const backgroundMaterial = createMaterialStore({
		diffuse: [0.67, 0.68, 0.81],
		metalness: 0,
		diffuseMap: backgroundTexture,
	});
	const backgroundMatrix = identity(createZeroMatrix());
	translate(backgroundMatrix, backgroundMatrix, [0, 0, -70]);
	rotateX(backgroundMatrix, backgroundMatrix, Math.PI / 2);
	const backgroundInstances = 5;
	const backgroundMatrices = new Array(backgroundInstances).fill(0).map((_, index) => {
		/** @type {mat4} */
		let mat = cloneMatrix(backgroundMatrix);
		translate(mat, mat, [0, 0, -index * 100]);
		return mat;
	});
	const background = create3DObject({
		...backgroundGeometry,
		material: backgroundMaterial,
		instances: backgroundInstances,
		matrices: backgroundMatrices,
	});

	light1 = createLightStore(
		createPointLight({
			color: [0.996078431372549, 0.9529411764705882, 0.6627450980392157],
			intensity: 7.5,
			position: [0, 9, 3],
			cutoffDistance: 120,
			decayExponent: 0.001,
		}),
	);

	light2 = createLightStore(
		createPointLight({
			position: [-3, -3, 1],
			color: [0.6313725490196078, 0.6235294117647059, 0.996078431372549],
			intensity: 5,
			cutoffDistance: 15,
			decayExponent: 0.25,
		}),
	);

	$renderer = {
		...$renderer,
		canvas,
		backgroundColor: skyblue,
		ambientLightColor: [0xffffff, 0.1],
	};

	$camera = {
		...$camera,
		position: [0, 3, 21],
		target: [0, 3, 0],
		fov: 36,
	};

	/*
	const cylinderGeometry = createCylinder(1, 1, 32, 1);
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
	const cylinderMatrix = identity(createZeroMatrix());
	translate(cylinderMatrix, cylinderMatrix, [0, 1, 0]);

	const debugProgram = createMaterialStore({
		diffuse: [1, 0, 0],
		metalness: 0,
		program: createDebugNormalsProgram(),
	});
	const debugNormalMesh = createDebugObject({
		...ennemi1Mesh,
		material: debugProgram,
	});

	cylinder = create3DObject({
		...cylinderGeometry,
		material: cylinderMaterial,
		matrix: cylinderMatrix,
	});*/

	$materials = [...$materials, rockMaterial, ennemi1Material, backgroundMaterial];

	$scene = [...$scene, leftRocks, rightRocks, ennemi1, background];

	$lights = [...$lights, light1, light2];

	$renderer = {
		...$renderer,
		loop: animate,
		enabled: true,
	};

	createOrbitControls(canvas, camera);
});

function animate() {
	scrollY += 0.01;
	const currentPosition = $camera.position;
	currentPosition[1] += 0.01;
	const currentTarget = $camera.target;
	currentTarget[1] += 0.01;
	$camera = { ...$camera, position: currentPosition, target: currentTarget };
	const currentLight1 = get(light1);
	currentLight1.position[1] += 0.01;
	const currentLight2 = get(light2);
	currentLight2.position[1] += 0.01;

	light1.set({ ...currentLight1 });
	light2.set({ ...currentLight2 });

	/*
	const matrix = get(ennemi1.matrix);
	translate(matrix, matrix, [0, 0.01, 0]);
	ennemi1.matrix.set( matrix);
	*/
	// make the ennemi1 move in circle
	//const ennemiMatrix = get(ennemi1.matrix);

	const angle = performance.now() * 0.001;
	const radius = 4;
	const x = Math.cos(angle) * radius;
	const y = Math.sin(angle) * radius;
	const ennemiMatrix = identity(createZeroMatrix());
	translate(ennemiMatrix, ennemiMatrix, [x, y + scrollY + 4, 0]);
	//rotateX(ennemiMatrix, ennemiMatrix, Math.PI / 2);
	rotateY(ennemiMatrix, ennemiMatrix, performance.now() * 0.003);
	//rotateZ(ennemiMatrix, ennemiMatrix, performance.now() * 0.005);
	ennemi1.matrix.set(ennemiMatrix);
	/*const cylinderMatrix = get(cylinder.matrix);
	rotateX(cylinderMatrix, cylinderMatrix, 0.001);
	cylinder.matrix.set(cylinderMatrix);*/
}
</script>
<canvas bind:this={canvas}></canvas>
<Menu />
<DebugPanel initialCollapsed={true} />