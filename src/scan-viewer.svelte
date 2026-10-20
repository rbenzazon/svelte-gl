<script type="module">
import { onMount } from "svelte";
import Menu from "./Menu.svelte";
import { createScanViewer } from "./apps/scan-viewer/index.js";

const backgrounds = [
	[0.11, 0.14, 0.19, 1],
	[0.93, 0.94, 0.96, 1],
	[0.2, 0.35, 0.3, 1],
];
const rightBackground = [0.16, 0.13, 0.09, 1];

// 20 x 15 mm sine grid with a round NaN hole.
const imageW = 200;
const imageH = 150;
const grid = { imageW, imageH, x0: 0, y0: 0, x1: 20, y1: 15 };
let frequency = 0.5;

function createHeights(freq) {
	const heights = new Float32Array(imageW * imageH);
	for (let row = 0; row < imageH; row++) {
		for (let col = 0; col < imageW; col++) {
			const x = (col / (imageW - 1)) * grid.x1;
			const y = (row / (imageH - 1)) * grid.y1;
			const hole = Math.hypot(x - 14, y - 9) < 2;
			heights[row * imageW + col] = hole ? Number.NaN : Math.sin(x * freq) * Math.cos(y * freq);
		}
	}
	return heights;
}

const layers = [{ id: "sine", kind: "surface", data: { ...grid, distanceData: createHeights(frequency) } }];

let left;
let right;
let viewerLeft;
let viewerRight;
let backgroundIndex = 0;
let remounts = 0;
let zScale = 1;

function nextBackground() {
	backgroundIndex = (backgroundIndex + 1) % backgrounds.length;
	viewerLeft.setBackground(backgrounds[backgroundIndex]);
}

function mountRight() {
	viewerRight = createScanViewer(right, { background: rightBackground });
	viewerRight.setZScale(zScale);
	viewerRight.setLayers(layers);
}

function remountRight() {
	viewerRight.destroy();
	mountRight();
	remounts += 1;
}

function onZScale(event) {
	zScale = Number(event.target.value);
	viewerLeft.setZScale(zScale);
	viewerRight.setZScale(zScale);
}

function newData() {
	frequency += 0.25;
	viewerLeft.updateLayerData("sine", createHeights(frequency));
}

onMount(() => {
	viewerLeft = createScanViewer(left, { background: backgrounds[backgroundIndex] });
	viewerLeft.setLayers(layers);
	mountRight();
	return () => {
		viewerLeft.destroy();
		viewerRight.destroy();
	};
});
</script>

<div class="views">
	<div bind:this={left}></div>
	<div bind:this={right}></div>
</div>
<div class="controls">
	<div class="field">
		<span>zScale {zScale.toFixed(2)}</span>
		<input type="range" min="0" max="4" step="0.05" value={zScale} on:input={onZScale} />
	</div>
	<button on:click={newData}>new data (left)</button>
	<button on:click={nextBackground}>left background</button>
	<button on:click={remountRight}>remount right ({remounts})</button>
</div>
<Menu />

<style>
	.views {
		display: flex;
		width: 100%;
		height: 100%;
	}
	.views div {
		width: 50%;
		height: 100%;
	}
	.controls {
		position: absolute;
		right: 12px;
		bottom: 12px;
		z-index: 1;
		display: flex;
		gap: 8px;
		align-items: flex-end;
		padding: 8px 12px;
		background: white;
		font-family: sans-serif;
		font-size: 0.85rem;
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
		width: 160px;
	}
	button {
		padding: 6px 10px;
		font-size: 0.85rem;
	}
</style>
