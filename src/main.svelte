<script type="module">
import { onMount } from "svelte";
import { get } from "svelte/store";
import { renderer, webglapp, lastProgramRendered } from "./store/engine.js";
//import { createCube } from "./geometries/cube.js";
import { identity, rotateX, rotateY, rotateZ, translate, scale } from "gl-matrix/esm/mat4.js";
import { createPolyhedron /*createSmoothShadedNormals*/ } from "./geometries/polyhedron.js";
import { createPointLight } from "./lights/point-light.js";
import { createAGXToneMapping } from "./tone-mapping/agx.js";
import { createFlatShadedNormals, toRadian } from "./geometries/common.js";
let canvas;
let light1;
let mesh1;
onMount(() => {
	const data = createPolyhedron(1, 7, createFlatShadedNormals);
	renderer.setCanvas(canvas);
	renderer.setBackgroundColor([0, 0, 0, 1.0]);
	renderer.setCamera([0, 0, -3]);
	const numInstances = 3;
	let identityMatrix = new Array(16).fill(0);
	identity(identityMatrix);
	let matrices = new Array(numInstances).fill(0).map((_, index) => {
		const count = index - Math.floor(numInstances / 2);
		console.log("count", count);
		let mat = [...identityMatrix];
		//transform the model matrix
		translate(mat, mat, [count * 2, 0, 0]);
		rotateY(mat, mat, toRadian(count * 10));
		scale(mat, mat, [0.5, 0.5, 0.5]);
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
			intensity: 3,
			cutoffDistance: 5,
			decayExponent: 1,
		}),
	);
	renderer.addLight(
		createPointLight({
			position: [1, -2, 0],
			color: [1, 1, 0],
			intensity: 2,
			cutoffDistance: 5,
			decayExponent: 1,
		}),
	);
	renderer.addToneMapping(
		createAGXToneMapping({
			exposure: 1,
		}),
	);
	animate();
});

//render
$: if ($webglapp) {
	$webglapp.forEach((instruction) => {
		instruction();
	});
}

/* this is necessary to have normalMatrix working cause 
    derived stores without listeners are not reactive */

function animate() {
	const rotation = 0.001 * Math.PI;
	const tmp = get(mesh1.matrices[0]);
	rotateY(tmp, tmp, rotation / 2);
	rotateX(tmp, tmp, rotation);
	rotateZ(tmp, tmp, rotation / 3);
	mesh1.matrices[0].set(tmp);

	const lightX = Math.sin(performance.now() / 1000) * 2;
	const lightY = Math.cos(performance.now() / 1000) * 2;
	const r = Math.sin(performance.now() / 6000) * 0.5 + 0.5;
	const g = Math.cos(performance.now() / 5000) * 0.5 + 0.5;
	const b = Math.sin(performance.now() / 4000) * 0.5 + 0.5;
	light1.set({
		position: [lightX, lightY, -3],
		color: [r, g, b],
	});

	requestAnimationFrame(animate);
}
</script>
<canvas bind:this={canvas}></canvas>