<script type="module">
import { onMount } from "svelte";
import { renderer, webglapp, worldMatrix, normalMatrix, lastProgramRendered } from "./store/engine.js";
import { createCube } from "./geometries/cube.js";
import { identity, rotateX, rotateY, rotateZ } from "gl-matrix/esm/mat4.js";
import { createPolyhedron, createSmoothShadedNormals } from "./geometries/polyhedron.js";
import { createPointLight } from "./lights/point-light.js";
import { createAGXToneMapping } from "./tone-mapping/agx.js";
import { createFlatShadedNormals } from "./geometries/common.js";
let canvas;
onMount(() => {
	const data = createPolyhedron(1, 3, createFlatShadedNormals);
	console.log("data", data);
	renderer.setCanvas(canvas);
	renderer.setBackgroundColor([0.0, 0.0, 0.0, 1.0]);
	renderer.setCamera(45, 0.1, 1000, [0, 0, -8], [0, 0, 0], [0, 1, 0]);
	renderer.addMesh({
		attributes: data,
		uniforms: {
			color: [1, 1, 1],
		},
	});
	renderer.addLight(
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
	//setTimeout(animate, 1000);
});
$: if ($webglapp) {
	$webglapp.forEach((instruction) => {
		instruction();
	});
}

$: console.log("lastProgramRendered", $lastProgramRendered);
/* this is necessary to have normalMatrix working cause 
    derived stores without listeners are not reactive */
$normalMatrix;

function animate() {
	const rotation = (performance.now() / 1000 / 6) * Math.PI;
	const tmp = new Float32Array(16);
	identity(tmp);
	rotateY(tmp, tmp, rotation);
	rotateX(tmp, tmp, rotation);
	rotateZ(tmp, tmp, rotation);
	$worldMatrix = tmp;
	requestAnimationFrame(animate);
}
</script>
<canvas bind:this={canvas}></canvas>