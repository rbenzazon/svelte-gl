<script type="module">
import { onMount } from "svelte";
import { createLightStore, renderer, scene, camera, renderPasses } from "./store/engine-refactor.js";
import { identity, rotateY, rotateZ, scale, translate } from "gl-matrix/esm/mat4.js";
import { createPointLight } from "./lights/point-light.js";
import { skyblue } from "./color/color-keywords.js";
import { createPolyhedron, createSmoothShadedNormals, generateUVs } from "./geometries/polyhedron.js";
import { createOrbitControls } from "./interactivity/orbit-controls.js";
import { createTexture } from "./texture/texture.js";
import { createContactShadowPass } from "./store/contact-shadow.js";
import {
	createCameraFromGLTF,
	createMeshFromGLTF,
	getAbsoluteNodeMatrix,
	loadGLTFFile,
	traverseScene,
} from "./loaders/gltf-loader.js";
import { transformMat4 } from "gl-matrix/esm/vec3.js";
import { createSpecular } from "./material/specular/specular.js";

let canvas;
let light1;
let mesh1;
let once = false;
const numInstances = 20;
const radius = 1;

onMount(async () => {
	const normalMap = await createTexture({
		url: "golfball-normal.jpg",
		normalScale: [1, 1],
		type: "normal",
	});
	$renderer = {
		...$renderer,
		canvas,
		backgroundColor: skyblue,
		ambientLightColor: [0xffffff, 0.1],
	};

	$camera = {
		position: [0, 5, -5],
		target: [0, 0, 0],
		fov: 75,
	};

	const sphereMesh = createPolyhedron(1.5, 7, createSmoothShadedNormals);
	sphereMesh.attributes.uvs = generateUVs(sphereMesh.attributes);

	let identityMatrix = new Array(16).fill(0);
	identity(identityMatrix);
	/*let matrices = new Array(numInstances).fill(0).map((_, index) => {
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
	});*/

	const light = createLightStore(
		createPointLight({
			position: [-2, 3, -3],
			color: [1, 1, 1],
			intensity: 20,
			cutoffDistance: 0,
			decayExponent: 2,
		}),
	);
	const light2 = createLightStore(
		createPointLight({
			position: [2, -1, -1],
			color: [1, 1, 1],
			intensity: 20,
			cutoffDistance: 0,
			decayExponent: 2,
		}),
	);

	$scene = [
		...$scene,
		{
			...sphereMesh,
			matrix: identityMatrix,
			material: {
				diffuse: [1, 0.5, 0.5],
				metalness: 0,
				specular: createSpecular({
					roughness: 0.12,
					ior: 1,
					intensity: 2,
					color: [1, 1, 1],
				}),
				normalMap,
			},
		},
		light,
		light2,
	];

	$renderer = {
		...$renderer,
		loop: animate,
		enabled: true,
	};

	createOrbitControls(canvas, camera);
});

function animate() {
	const time = performance.now() / 1000;
	const zpos = Math.sin(time) * 2 - 5;
	/*$camera = {
		position: [0, 5, -zpos],
	};*/
	//console.log("animate", $camera.position);
}
/*
function animate() {
	const rotation = 0.001 * Math.PI;
	for (let i = 0; i < numInstances; i++) {
		const tmp = get(mesh1.matrices[i]);
		rotateY(tmp, tmp, rotation / 2);
		rotateX(tmp, tmp, rotation);
		rotateZ(tmp, tmp, rotation / 3);
		mesh1.matrices[i].set(tmp);
	}

	const lightX = Math.sin(performance.now() / 2000) * 0.5;
	const lightY = Math.cos(performance.now() / 2000) * 0.5;
	const r = Math.sin(performance.now() / 6000) * 0.5 + 0.5;
	const g = Math.cos(performance.now() / 5000) * 0.5 + 0.5;
	const b = Math.sin(performance.now() / 4000) * 0.5 + 0.5;
	light1.set({
		position: [lightX, lightY, -0.4],
		color: [r, g, b],
	});
}*/
</script>
<canvas bind:this={canvas}></canvas>