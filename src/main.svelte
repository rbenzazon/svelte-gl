<script type="module">
import { onMount } from "svelte";
import { renderer, webglapp, lastProgramRendered } from "./store/engine.js";
//import { createCube } from "./geometries/cube.js";
import { identity, rotateX, rotateY, rotateZ } from "gl-matrix/esm/mat4.js";
import { createPolyhedron /*createSmoothShadedNormals*/ } from "./geometries/polyhedron.js";
import { createPointLight } from "./lights/point-light.js";
import { createAGXToneMapping } from "./tone-mapping/agx.js";
import { createFlatShadedNormals } from "./geometries/common.js";
let canvas;
let light1;
let mesh1;
onMount(() => {
	const data = createPolyhedron(1, 7, createFlatShadedNormals);
	renderer.setCanvas(canvas);
	renderer.setBackgroundColor([0, 0, 0, 1.0]);
	renderer.setCamera([0, 0, -3]);
	mesh1 = renderer.addMesh({
		attributes: data,
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
$: if ($webglapp) {
	$webglapp.forEach((instruction) => {
		instruction();
	});
}

//$: console.log("lastProgramRendered", $lastProgramRendered);
/* this is necessary to have normalMatrix working cause 
    derived stores without listeners are not reactive */

function animate() {
	const rotation = (performance.now() / 1000 / 6) * Math.PI;
	const tmp = new Float32Array(16);
	identity(tmp);
	rotateY(tmp, tmp, rotation);
	rotateX(tmp, tmp, rotation);
	rotateZ(tmp, tmp, rotation);
	mesh1.transformMatrix.set(tmp);
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