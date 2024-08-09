<script type="module">
import { onMount } from "svelte";
import { get } from "svelte/store";
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
//import {loadGLBFile } from "./loaders/glb-loader.js";
//import {loadGLTFFile } from "./loaders/gltf-loader.js";

let canvas;
let light1;
let mesh1;
let camera;
onMount(async () => {
	//loadGLBFile("md-blend6-mdlvw.glb");

	const normalMap = await createTexture({
		url: "golfball-normal.jpg",
		normalScale: [1, 1],
		type: "normal",
	});
	renderer.setCanvas(canvas);
	renderer.setBackgroundColor(skyblue);
	renderer.setAmbientLight(0xffffff, 0.3);
	camera = renderer.setCamera([0, 0, -5], [0, 0, 0], 75);

	const sphereGeometry = createPolyhedron(1, 7, createSmoothShadedNormals);
	sphereGeometry.uvs = generateUVs(sphereGeometry);

	mesh1 = renderer.addMesh({
		attributes: sphereGeometry,
		material: {
			diffuse: [1, 0, 0],
			specular: createSpecular({
				roughness: 0.2,
				ior: 1.5,
				intensity: 1,
				color: [1, 1, 1],
			}),
			normalMap,
			normalMapScale: [1, 1],
		},
	});

	light1 = renderer.addLight(
		createPointLight({
			position: [0, 1, -3],
			color: [1, 1, 1],
			intensity: 5,
			cutoffDistance: 0,
			decayExponent: 2,
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
	/*
	const lightX = Math.sin(performance.now() / 2000) * 0.5;
	const lightY = Math.cos(performance.now() / 2000) * 0.5;
	const r = Math.sin(performance.now() / 6000) * 0.5 + 0.5;
	const g = Math.cos(performance.now() / 5000) * 0.5 + 0.5;
	const b = Math.sin(performance.now() / 4000) * 0.5 + 0.5;
	light1.set({
		position: [lightX, lightY, -0.4],
		color: [r, g, b],
	});*/
}
</script>
<canvas bind:this={canvas}></canvas>