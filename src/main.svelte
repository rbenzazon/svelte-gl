<script type="module">
import { onMount } from "svelte";
import { get } from "svelte/store";
import { renderer } from "./store/engine.js";
//import { createCube } from "./geometries/cube.js";
import { identity, rotateX, rotateY, rotateZ, translate, scale } from "gl-matrix/esm/mat4.js";
import { createPolyhedron, createSmoothShadedNormals } from "./geometries/polyhedron.js";
import { createPointLight } from "./lights/point-light.js";
import { createAGXToneMapping } from "./tone-mapping/agx.js";
import { /*createFlatShadedNormals,*/ toRadian } from "./geometries/common.js";
let canvas;
let light1;
let mesh1;
const numInstances = 20;
const radius = 0.7;
onMount(() => {
	const data = createPolyhedron(1, 7, createSmoothShadedNormals);
	renderer.setCanvas(canvas);
	renderer.setBackgroundColor([0, 0, 0, 1.0]);
	renderer.setCamera([0, 0, -3], [0, 0, 0], 30);

	let identityMatrix = new Array(16).fill(0);
	identity(identityMatrix);
	let matrices = new Array(numInstances).fill(0).map((_, index) => {
		const count = index - Math.floor(numInstances / 2);
		let mat = [...identityMatrix];
		//transform the model matrix
		const scaleFactor = 0.1;

		const centerX = 0;
		const centerY = 0;
		const angleIncrement = (2 * Math.PI) / numInstances;

		translate(mat, mat, [
			centerX + radius * Math.cos(count * angleIncrement),
			centerY + radius * Math.sin(count * angleIncrement),
			0,
		]);
		//translate(mat, mat, [count * -2, 0, 0]);
		rotateY(mat, mat, toRadian(count * 10));
		scale(mat, mat, [scaleFactor, scaleFactor, scaleFactor]);
		return new Float32Array(mat);
	});

	mesh1 = renderer.addMesh({
		attributes: data,
		instances: numInstances,
		matrices,
		uniforms: {
			color: [1, 1, 1],
		},
	});

	light1 = renderer.addLight(
		createPointLight({
			position: [-2, 2, -3],
			color: [1, 1, 1],
			intensity: 0.6,
			cutoffDistance: 3,
			decayExponent: 3,
		}),
	);
	renderer.addLight(
		createPointLight({
			position: [1, 1, -2],
			color: [1, 1, 1],
			intensity: 2,
			cutoffDistance: 4,
			decayExponent: 2,
		}),
	);
	renderer.addLight(
		createPointLight({
			position: [-1, 1, -2],
			color: [1, 1, 1],
			intensity: 2,
			cutoffDistance: 4,
			decayExponent: 2,
		}),
	);

	renderer.addLight(
		createPointLight({
			position: [0, 0, -5],
			color: [1, 1, 1],
			intensity: 3,
			cutoffDistance: 10,
			decayExponent: 2,
		}),
	);
	renderer.addToneMapping(
		createAGXToneMapping({
			exposure: 1,
		}),
	);

	renderer.setLoop(animate);
	renderer.start();
});

function animate() {
	const rotation = 0.001 * Math.PI;
	for (let i = 0; i < numInstances; i++) {
		const tmp = get(mesh1.matrices[i]);
		rotateY(tmp, tmp, rotation / 2);
		rotateX(tmp, tmp, rotation);
		rotateZ(tmp, tmp, rotation / 3);
		mesh1.matrices[i].set(tmp);
	}

	const lightX = Math.sin(performance.now() / 3000) * 1;
	const lightY = Math.cos(performance.now() / 3000) * 1;
	const r = Math.sin(performance.now() / 6000) * 0.5 + 0.5;
	const g = Math.cos(performance.now() / 5000) * 0.5 + 0.5;
	const b = Math.sin(performance.now() / 4000) * 0.5 + 0.5;
	light1.set({
		position: [lightX, lightY, -0.4],
		color: [r, g, b],
	});
}
</script>
<canvas bind:this={canvas}></canvas>