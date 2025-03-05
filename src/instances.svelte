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

let canvas;
let cube;
const numInstances = 500;
onMount(async () => {
	$renderer = {
		...$renderer,
		canvas,
		backgroundColor: skyblue,
		ambientLightColor: [0xffffff, 0.1],
	};

	$camera = {
		...$camera,
		position: [0, 5, -5],
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
		const count = index - Math.floor(numInstances / 2);
		let mat = cloneMatrix(identityMatrix);
		// set y so that there are rows of cubes of 12 cubes each
		const y = Math.floor(count / 12) - 6;
		const x = (count % 12) - 6;
		//transform the model matrix
		translate(mat, mat, [x * 2, y * 2, 0]);

		rotateY(mat, mat, toRadian(count * 10));
		scale(mat, mat, [0.5, 0.5, 0.5]);
		return mat;
	});

	const light = createLightStore(
		createPointLight({
			position: [-2, 3, -3],
			color: [1, 1, 1],
			intensity: 20,
			cutoffDistance: 0,
			decayExponent: 2,
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