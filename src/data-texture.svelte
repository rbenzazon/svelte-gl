<script type="module">
import { identity } from "gl-matrix/esm/mat4.js";
import { onMount } from "svelte";
import Menu from "./Menu.svelte";
import { skyblue } from "./color/color-keywords.js";
import { createZeroMatrix } from "./geometries/common.js";
import { createPlane } from "./geometries/plane.js";
import { createOrbitControls } from "./interactivity/orbit-controls.js";
import { camera } from "./store/camera.js";
import { create3DObject } from "./store/create-object.js";
import { invalidate } from "./store/engine.js";
import { createMaterialStore, materials } from "./store/materials.js";
import { renderer } from "./store/renderer.js";
import { scene } from "./store/scene.js";
import { createDataDisplaceProgram } from "./texture/data-displace.js";
import { createDataTexture } from "./texture/data-texture.js";

const size = 32;
const pixels = new Float32Array(size * size);
let canvas;
let amplitude = 1;
let frequency = 2;

function fill(freq) {
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const u = x / (size - 1);
			const v = y / (size - 1);
			pixels[y * size + x] = Math.sin(u * freq * Math.PI) * Math.sin(v * freq * Math.PI);
		}
	}
}

fill(frequency);
const dataTexture = createDataTexture({ data: pixels, width: size, height: size });
const program = createDataDisplaceProgram(dataTexture);

function onAmplitude(event) {
	amplitude = Number(event.target.value);
	program.setAmplitude(amplitude);
	invalidate();
}

function onNewData() {
	frequency += 1;
	fill(frequency);
	dataTexture.update(pixels);
	invalidate();
}

onMount(() => {
	$renderer = {
		...$renderer,
		canvas,
		backgroundColor: skyblue,
		ambientLightColor: [0xffffff, 0.2],
	};
	$camera = {
		...$camera,
		position: [0, 4, -6],
		target: [0, 0, 0],
		fov: 50,
	};
	const material = createMaterialStore({ program });
	const matrix = identity(createZeroMatrix());
	$materials = [...$materials, material];
	$scene = [
		...$scene,
		create3DObject({
			...createPlane(4, 4, size - 1, size - 1),
			matrix,
			material,
		}),
	];
	$renderer = {
		...$renderer,
		loop() {},
		enabled: true,
	};
	createOrbitControls(canvas, camera);
});
</script>

<canvas bind:this={canvas}></canvas>
<div class="controls">
	<div class="field">
		<span>amplitude {amplitude.toFixed(2)}</span>
		<input type="range" min="0" max="2" step="0.01" value={amplitude} on:input={onAmplitude} />
	</div>
	<button on:click={onNewData}>new data</button>
</div>
<Menu />

<style>
	.controls {
		position: absolute;
		left: 12px;
		bottom: 12px;
		z-index: 1;
		display: flex;
		gap: 12px;
		align-items: flex-end;
		padding: 8px 12px;
		background: white;
		font-family: sans-serif;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.field span {
		font-variant-numeric: tabular-nums;
	}
	input[type="range"] {
		width: 180px;
	}
</style>
