<script type="module">
import { onMount } from "svelte";
import {
	createLightStore,
	renderer,
	scene,
	camera,
	create3DObject,
	lights,
	createMaterialStore,
	materials,
} from "./store/engine-refactor.js";
import { identity, rotateX, rotateY, rotateZ, scale, translate } from "gl-matrix/esm/mat4.js";
import { createPointLight } from "./lights/point-light.js";
import { skyblue } from "./color/color-keywords.js";
import { createPolyhedron, createSmoothShadedNormals } from "./geometries/polyhedron.js";
import { createCube } from "./geometries/cube.js";
import { createPlane } from "./geometries/plane.js";
import { createOrbitControls } from "./interactivity/orbit-controls.js";
import Menu from "./Menu.svelte";
import { createFlatShadedNormals, toRadian } from "./geometries/common.js";
import { get } from "svelte/store";

let canvas;
let cube;
onMount(async () => {
	$renderer = {
		...$renderer,
		canvas,
		backgroundColor: skyblue,
		ambientLightColor: [0xffffff, 0.1],
	};

	$camera = {
		position: [0, 5, -5],
		target: [0, 1, 0],
		fov: 75,
	};

	const cubeMesh = createCube();
	const cubePos = identity(new Float32Array(16));
	translate(cubePos, cubePos, [3, 1.5, 0]);
	const material = createMaterialStore({
		diffuse: [1, 0.5, 0.5],
		metalness: 0,
	});
	$materials = [...$materials, material];

	const numInstances = 3;
	let identityMatrix = new Array(16).fill(0);
	identity(identityMatrix);

	let matrices = new Array(numInstances).fill(0).map((_, index) => {
		const count = index - Math.floor(numInstances / 2);
		let mat = [...identityMatrix];

		//transform the model matrix
		translate(mat, mat, [count * 2, 0, 0]);

		rotateY(mat, mat, toRadian(count * 10));
		scale(mat, mat, [0.5, 0.5, 0.5]);
		return new Float32Array(mat);
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
	for (let i = 0; i < 3; i++) {
		rotateCube(cube, i);
	}
}
</script>
<canvas bind:this={canvas}></canvas>
<Menu />