<script type="module">
import { onMount } from "svelte";
import { renderer } from "./store/engine.js";
//import { createCube } from "./geometries/cube.js";
import { identity, rotateX, rotateY, rotateZ, translate, scale } from "gl-matrix/esm/mat4.js";
import { createPolyhedron, createSmoothShadedNormals, generateUVs } from "./geometries/polyhedron.js";
import { createPointLight } from "./lights/point-light.js";
import { createAGXToneMapping } from "./tone-mapping/agx.js";
import { createOrbitControls } from "./interactivity/orbit-controls.js";
import { /*createFlatShadedNormals,*/ distributeCirclePoints, toRadian } from "./geometries/common.js";
import { createSpecular } from "./material/specular/specular.js";
import { skyblue } from "./color/color-keywords.js";
import { createTexture } from "./texture/texture.js";

let canvas;
let light1;
let mesh1;
let camera;
let once = false;
const numInstances = 20;
const radius = 1;

onMount(async () => {
	const diffuseMap = await createTexture({
		url: "golfball-normal.jpg",
		type: "diffuse",
	});
	renderer.setCanvas(canvas);

	renderer.setBackgroundColor(skyblue);
	renderer.setAmbientLight(0xffffff, 0.5);
	camera = renderer.setCamera([0, 0, -2], [0, 0, 0], 70);

	const sphereGeometry = createPolyhedron(1.5, 7, createSmoothShadedNormals);
	sphereGeometry.uvs = generateUVs(sphereGeometry);

	let identityMatrix = new Array(16).fill(0);
	identity(identityMatrix);
	let matrices = new Array(numInstances).fill(0).map((_, index) => {
		const count = index - Math.floor(numInstances / 2);
		let mat = [...identityMatrix];
		//transform the model matrix
		const scaleFactor = 0.1;

		const { x, y } = distributeCirclePoints(radius, index, numInstances);

		translate(mat, mat, [x, y, 0]);
		//translate(mat, mat, [count * -2, 0, 0]);
		//rotateY(mat, mat, toRadian(count * 10));
		scale(mat, mat, [scaleFactor, scaleFactor, scaleFactor]);
		return new Float32Array(mat);
	});

	mesh1 = renderer.addMesh({
		attributes: sphereGeometry,
		instances: numInstances,
		matrices,
		material: {
			diffuse: [1, 0.5, 0.5],
			specular: createSpecular({
				roughness: 0.3,
				ior: 1.5,
				intensity: 1,
				color: [1, 1, 1],
			}),
			diffuseMap,
		},
	});

	light1 = renderer.addLight(
		createPointLight({
			position: [-2, 2, -4],
			color: [1, 1, 1],
			intensity: 0.6,
			cutoffDistance: 3,
			decayExponent: 1,
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
	createOrbitControls(canvas, camera);
});

function animate() {
	/*const rotation = 0.001 * Math.PI;
	for (let i = 0; i < numInstances; i++) {
		const tmp = get(mesh1.matrices[i]);
		rotateY(tmp, tmp, rotation / 2);
		rotateX(tmp, tmp, rotation);
		rotateZ(tmp, tmp, rotation / 3);
		mesh1.matrices[i].set(tmp);
	}*/

	const lightX = Math.sin(performance.now() / 2000) * 0.5;
	const lightY = Math.cos(performance.now() / 2000) * 0.5;
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