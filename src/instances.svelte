<script type="module">
import { onMount } from "svelte";
import {
	createLightStore,
	renderer,
	scene,
	create3DObject,
	lights,
	createMaterialStore,
	materials,
} from "./store/engine-refactor.js";
import { camera } from "./store/camera.js";
import { identity, rotateX, rotateY, rotateZ, scale, translate } from "gl-matrix/esm/mat4.js";
import { createPointLight } from "./lights/point-light.js";
import { skyblue } from "./color/color-keywords.js";
import { createCube } from "./geometries/cube.js";
import { createOrbitControls } from "./interactivity/orbit-controls.js";
import Menu from "./Menu.svelte";
import { cloneMatrix, createZeroMatrix, toRadian } from "./geometries/common.js";
import { get } from "svelte/store";
  import DebugPanel from "./components/DebugPanel/DebugPanel.svelte";

let canvas;
let cube;
const numInstances = 512;
onMount(async () => {
	$renderer = {
		...$renderer,
		canvas,
		backgroundColor: skyblue,
		ambientLightColor: [0xffffff, 0.1],
	};

	$camera = {
		...$camera,
		position: [0, 5, -20],
		target: [0, 1, 0],
		fov: 75,
	};

	const cubeMesh = createCube();
	const cubePos = identity(createZeroMatrix());
	translate(cubePos, cubePos, [3, 1.5, 0]);
	const material = createMaterialStore({
		diffuse: [1, 0.5, 0.5],
		metalness: 0,
	});
	$materials = [...$materials, material];

	const identityMatrix = identity(createZeroMatrix());

	let matrices = new Array(numInstances).fill(0).map((_, index) => {
		let mat = cloneMatrix(identityMatrix);
		
		// Calculate a single cubic grid
		const gridSize = Math.ceil(Math.cbrt(numInstances));
		
		// Calculate x, y, z positions within the grid (0-based indices)
		const x = index % gridSize;
		const y = Math.floor(index / gridSize) % gridSize;
		const z = Math.floor(index / (gridSize * gridSize));
		
		// Center the grid by subtracting half the grid size
		const offsetX = x - (gridSize - 1) / 2;
		const offsetY = y - (gridSize - 1) / 2;
		const offsetZ = z - (gridSize - 1) / 2;
		
		// Apply transformations
		translate(mat, mat, [offsetX * 2, offsetY * 2, offsetZ * 2]);
		
		// Add some rotation variation based on index
		rotateY(mat, mat, toRadian(index * 10));
		scale(mat, mat, [0.5, 0.5, 0.5]);
		
		return mat;
	});

	const light = createLightStore(
		createPointLight({
			"color": [
			  1,
			  1,
			  1
			],
			"intensity": 27,
			"position": [
			  -2,
			  12,
			  -12
			],
			"cutoffDistance": 30,
			"decayExponent": 1.5
		  }),
	);

	cube = create3DObject({
		...cubeMesh,
		instances: numInstances,
		matrices: matrices,
		material: material,
	});

	$scene = [...$scene, cube];

	$lights = [...$lights, light];

	$renderer = {
		...$renderer,
		loop: animate,
		enabled: true,
	};

	createOrbitControls(canvas, camera);
});
function rotateCube(cube, index) {
	const rotation = 0.001 * Math.PI;
	const tmp = get(cube.matrices[index]);
	rotateY(tmp, tmp, rotation / 2);
	rotateX(tmp, tmp, rotation);
	rotateZ(tmp, tmp, rotation / 3);
	cube.matrices[index].set(tmp);
}
function animate() {
	for (let i = 0; i < numInstances; i++) {
		rotateCube(cube, i);
	}
}
</script>
<canvas bind:this={canvas}></canvas>
<Menu />
<DebugPanel />