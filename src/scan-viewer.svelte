<script type="module">
import { onMount } from "svelte";
import Menu from "./Menu.svelte";
import { createScanViewer, defaultLights, loadEnvironment } from "./apps/scan-viewer/index.js";

const backgrounds = [
	[0.11, 0.14, 0.19, 1],
	[0.93, 0.94, 0.96, 1],
	[0.2, 0.35, 0.3, 1],
];

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

// The same heights as an unorganized cloud: grid positions with a little noise, like an inaccurate scanner.
// The xyz are relative to a large machine origin, to exercise the float32 precision path.
const cloudOrigin = [1000, 1000, 0];

function createCloud(heights) {
	const xyz = new Float32Array(heights.length * 3);
	const jitter = 0.3 * (grid.x1 / (imageW - 1));
	for (let row = 0; row < imageH; row++) {
		for (let col = 0; col < imageW; col++) {
			const i = row * imageW + col;
			xyz[i * 3] = (col / (imageW - 1)) * grid.x1 + (Math.random() - 0.5) * jitter;
			xyz[i * 3 + 1] = (row / (imageH - 1)) * grid.y1 + (Math.random() - 0.5) * jitter;
			xyz[i * 3 + 2] = heights[i];
		}
	}
	return xyz;
}

const metal = { baseColor: [0.85, 0.75, 0.55], metallic: 1, roughness: 0.3 };
const displays = ["cloud", "surface", "points", "both"];
const lightModes = ["camera", "scene", "none"];

let container;
let viewer;
let heights = createHeights(frequency);
let cloud = createCloud(heights);
let display = "cloud";
let zScale = 1;
// The palette stays the default one; setPalette(colors) changes it.
let pointsColorMode = "palette";
let fixedRange = false;
let outOfRange = "clamp";
let autoRange = [0, 1];
let metallic = false;
let lightMode = "camera";
let backgroundIndex = 0;
let rulers = true;
let boundingBox = false;
let gizmo = true;
let environment = null;
let skybox = false;
let skyboxBlur = 0;
let envLighting = false;

// "both" passes the same distanceData to the two layers, so the heights are uploaded once.
function layers() {
	const data = { ...grid, distanceData: heights };
	const pointStyle = { colorMode: pointsColorMode, color: "#f59e0b", pointSize: 3 };
	const surface = { id: "sine", kind: "surface", data, material: metallic ? metal : undefined };
	const points = { id: "sine-points", kind: "points", data, ...pointStyle };
	const scan = { id: "sine-cloud", kind: "points", data: { xyz: cloud, origin: cloudOrigin }, ...pointStyle };
	return { surface: [surface], points: [points], both: [surface, points], cloud: [scan] }[display];
}

function setDisplay(value) {
	display = value;
	viewer.setLayers(layers());
}

function newData() {
	frequency += 0.25;
	heights = createHeights(frequency);
	cloud = createCloud(heights);
	viewer.updateLayerData(layers()[0].id, display === "cloud" ? cloud : heights);
}

function onZScale(event) {
	zScale = Number(event.target.value);
	viewer.setZScale(zScale);
}

function setColorMode(value) {
	pointsColorMode = value;
	viewer.setLayers(layers());
}

function setFixedRange(value) {
	fixedRange = value;
	viewer.setColorRange(...(fixedRange ? [-0.5, 0.5] : []));
}

function setOutOfRange(value) {
	outOfRange = value;
	viewer.setOutOfRange(outOfRange);
}

function setMetallic(value) {
	metallic = value;
	viewer.setLayers(layers());
}

function setLightMode(value) {
	lightMode = value;
	if (lightMode === "none") {
		viewer.setLights([]);
		viewer.setAmbient(0);
	} else {
		viewer.setLights(defaultLights, lightMode);
		viewer.setAmbient();
	}
}

function setBackground(index) {
	backgroundIndex = index;
	viewer.setBackground(backgrounds[index]);
}

function toggleRulers() {
	rulers = !rulers;
	viewer.setRulers({ visible: rulers });
}

function toggleBoundingBox() {
	boundingBox = !boundingBox;
	viewer.setRulers({ boundingBox });
}

function toggleGizmo() {
	gizmo = !gizmo;
	viewer.setGizmo(gizmo);
}

function applyEnvironment() {
	viewer.setEnvironment(environment, { skybox, skyboxBlur, envLighting });
}

function toggleSkybox() {
	skybox = !skybox;
	applyEnvironment();
}

function onSkyboxBlur(event) {
	skyboxBlur = Number(event.target.value);
	applyEnvironment();
}

function toggleEnvLighting() {
	envLighting = !envLighting;
	applyEnvironment();
}

// Picking test: one label next to the mouse with the data under it (unorganized clouds only for now).
let pointer = null;
let hover = null;
let hoverFrame = 0;

function onPointerMove(event) {
	const rect = container.getBoundingClientRect();
	pointer = {
		x: event.clientX - rect.left,
		y: event.clientY - rect.top,
		clientX: event.clientX,
		clientY: event.clientY,
	};
	hoverFrame ||= requestAnimationFrame(updateHover);
}

function updateHover() {
	hoverFrame = 0;
	const hit = pointer && viewer.pick(pointer.x, pointer.y);
	hover = hit ? { ...hit, clientX: pointer.clientX, clientY: pointer.clientY } : null;
}

function onPointerLeave() {
	pointer = null;
	hover = null;
}

const rgb = ([r, g, b]) => `rgb(${r * 255}, ${g * 255}, ${b * 255})`;

onMount(() => {
	viewer = createScanViewer(container, { background: backgrounds[backgroundIndex] });
	const offAutoRange = viewer.on("auto-range", (min, max) => {
		autoRange = [min, max];
	});
	viewer.setLayers(layers());
	loadEnvironment("skyboxes/christmas-photo-studio-01-4k.hdr").then((image) => {
		environment = image;
	});
	return () => {
		cancelAnimationFrame(hoverFrame);
		offAutoRange();
		viewer.destroy();
	};
});
</script>

<div class="page">
	<div class="view" bind:this={container} on:pointermove={onPointerMove} on:pointerleave={onPointerLeave}></div>

	<aside class="panel">
		<section>
			<h2>Data</h2>
			<div class="row">
				<span class="label">Display</span>
				<div class="segmented">
					{#each displays as option}
						<button class:active={display === option} on:click={() => setDisplay(option)}>{option}</button>
					{/each}
				</div>
			</div>
			<div class="row">
				<span class="label">Height scale</span>
				<input type="range" min="0" max="4" step="0.05" value={zScale} on:input={onZScale} />
				<span class="value">{zScale.toFixed(2)}</span>
			</div>
			<div class="row">
				<span class="label">Heights</span>
				<button class="action" on:click={newData}>new data</button>
			</div>
		</section>

		<section>
			<h2>Points</h2>
			<div class="row">
				<span class="label">Color</span>
				<div class="segmented">
					{#each ["palette", "solid"] as option}
						<button class:active={pointsColorMode === option} on:click={() => setColorMode(option)}>{option}</button>
					{/each}
				</div>
			</div>
			<div class="row">
				<span class="label">Range</span>
				<div class="segmented">
					<button class:active={!fixedRange} on:click={() => setFixedRange(false)}>auto</button>
					<button class:active={fixedRange} on:click={() => setFixedRange(true)}>-0.5 … 0.5</button>
				</div>
			</div>
			<div class="row">
				<span class="label">Auto range</span>
				<span class="readout">{autoRange[0].toFixed(2)} … {autoRange[1].toFixed(2)}</span>
			</div>
			<div class="row">
				<span class="label">Out of range</span>
				<div class="segmented">
					{#each ["clamp", "hide"] as option}
						<button class:active={outOfRange === option} on:click={() => setOutOfRange(option)}>{option}</button>
					{/each}
				</div>
			</div>
		</section>

		<section>
			<h2>Surface</h2>
			<div class="row">
				<span class="label">Material</span>
				<div class="segmented">
					<button class:active={!metallic} on:click={() => setMetallic(false)}>matte</button>
					<button class:active={metallic} on:click={() => setMetallic(true)}>metal</button>
				</div>
			</div>
			<div class="row">
				<span class="label">Lights</span>
				<div class="segmented">
					{#each lightModes as option}
						<button class:active={lightMode === option} on:click={() => setLightMode(option)}>{option}</button>
					{/each}
				</div>
			</div>
		</section>

		<section>
			<h2>Scene</h2>
			<div class="row">
				<span class="label">Background</span>
				<div class="swatches">
					{#each backgrounds as color, index}
						<button
							class="swatch"
							class:active={backgroundIndex === index}
							style="background: {rgb(color)}"
							aria-label="background {index + 1}"
							on:click={() => setBackground(index)}
						></button>
					{/each}
				</div>
			</div>
			<div class="row">
				<span class="label">Rulers</span>
				<button class="switch" class:on={rulers} role="switch" aria-checked={rulers} on:click={toggleRulers}></button>
			</div>
			<div class="row">
				<span class="label">Bounding box</span>
				<button
					class="switch"
					class:on={boundingBox}
					role="switch"
					aria-checked={boundingBox}
					on:click={toggleBoundingBox}
				></button>
			</div>
			<div class="row">
				<span class="label">Gizmo</span>
				<button class="switch" class:on={gizmo} role="switch" aria-checked={gizmo} on:click={toggleGizmo}></button>
			</div>
		</section>

		<section>
			<h2>Environment{environment ? "" : " (loading…)"}</h2>
			<div class="row">
				<span class="label">Skybox</span>
				<button
					class="switch"
					class:on={skybox}
					role="switch"
					aria-checked={skybox}
					disabled={!environment}
					on:click={toggleSkybox}
				></button>
			</div>
			<div class="row">
				<span class="label">Skybox blur</span>
				<input
					type="range"
					min="0"
					max="1"
					step="0.01"
					value={skyboxBlur}
					disabled={!environment}
					on:input={onSkyboxBlur}
				/>
				<span class="value">{skyboxBlur.toFixed(2)}</span>
			</div>
			<div class="row">
				<span class="label">Env lighting</span>
				<button
					class="switch"
					class:on={envLighting}
					role="switch"
					aria-checked={envLighting}
					disabled={!environment}
					on:click={toggleEnvLighting}
				></button>
			</div>
		</section>
	</aside>
</div>
{#if hover}
	<div class="hover" style="left: {hover.clientX + 12}px; top: {hover.clientY + 12}px">
		x {hover.world.x.toFixed(3)} · y {hover.world.y.toFixed(3)} · z {hover.value.toFixed(3)} · nearest #{hover.index}
		z {hover.sampleValue.toFixed(3)}
	</div>
{/if}
<Menu />

<style>
	.page {
		display: flex;
		width: 100%;
		height: 100%;
	}
	.view {
		flex: 1;
		min-width: 0;
		height: 100%;
	}

	/* Same look as the debug panel. */
	.panel {
		--panel-darkest-color: #252525;
		--panel-dark-color: #393939;
		--panel-medium-color: #777777;
		--panel-medium-light-color: #b7b7b7;
		--panel-light-color: #cfcfcf;
		--input-thumb-size: 16px;
		--input-track-size: 8px;
		width: 340px;
		flex-shrink: 0;
		height: 100%;
		overflow-y: auto;
		padding: 8px 0;
		color: var(--panel-light-color);
		background-color: var(--panel-darkest-color);
		font-family: Arial, sans-serif;
		font-size: 0.85rem;
	}
	section {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 10px 14px 14px;
		border-top: 2px solid var(--panel-dark-color);
	}
	section:first-child {
		border-top: none;
	}
	h2 {
		margin: 0 0 2px;
		text-transform: uppercase;
		font-weight: bold;
		font-size: 0.9rem;
		color: var(--panel-light-color);
	}
	.row {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 26px;
	}
	.label {
		width: 92px;
		flex-shrink: 0;
		color: var(--panel-medium-light-color);
	}
	.value,
	.readout {
		font-variant-numeric: tabular-nums;
		color: var(--panel-light-color);
	}
	.value {
		width: 36px;
		text-align: right;
	}

	button {
		font: inherit;
		color: var(--panel-light-color);
		cursor: pointer;
	}
	button:disabled {
		cursor: default;
		opacity: 0.4;
	}

	.segmented {
		display: flex;
		flex: 1;
		padding: 2px;
		gap: 2px;
		border-radius: 0.3125rem;
		background-color: var(--panel-dark-color);
	}
	.segmented button {
		flex: 1;
		padding: 4px 6px;
		border: none;
		border-radius: 0.25rem;
		background: none;
		white-space: nowrap;
	}
	.segmented button:hover {
		background-color: #444444;
	}
	.segmented button.active {
		color: var(--panel-darkest-color);
		background-color: var(--panel-light-color);
	}

	.action {
		padding: 5px 12px;
		border: none;
		border-radius: 0.3125rem;
		background-color: var(--panel-dark-color);
	}
	.action:hover {
		background-color: #444444;
	}

	.swatches {
		display: flex;
		gap: 8px;
	}
	.swatch {
		width: 24px;
		height: 24px;
		border: 2px solid var(--panel-dark-color);
		border-radius: 50%;
	}
	.swatch.active {
		border-color: var(--panel-light-color);
	}

	.switch {
		position: relative;
		width: 34px;
		height: 18px;
		padding: 0;
		border: none;
		border-radius: 9px;
		background-color: var(--panel-dark-color);
	}
	.switch::after {
		content: "";
		position: absolute;
		top: 3px;
		left: 3px;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background-color: var(--panel-medium-color);
		transition: transform 0.15s;
	}
	.switch.on {
		background-color: var(--panel-medium-light-color);
	}
	.switch.on::after {
		transform: translateX(16px);
		background-color: var(--panel-darkest-color);
	}

	/* Slider look from DebugSliderNumber. */
	input[type="range"] {
		flex: 1;
		min-width: 0;
		height: var(--input-thumb-size);
		margin: 0;
		background: none;
		-webkit-appearance: none;
		appearance: none;
	}
	input[type="range"]:focus {
		outline: none;
	}
	input[type="range"]:disabled {
		opacity: 0.4;
	}
	input[type="range"]::-webkit-slider-runnable-track {
		height: var(--input-track-size);
		background-color: var(--panel-dark-color);
		border-radius: calc(var(--input-track-size) / 2);
	}
	input[type="range"]::-moz-range-track {
		height: var(--input-track-size);
		background-color: var(--panel-dark-color);
		border-radius: calc(var(--input-track-size) / 2);
	}
	input[type="range"]::-webkit-slider-thumb {
		width: var(--input-thumb-size);
		height: var(--input-thumb-size);
		margin-top: calc((var(--input-track-size) - var(--input-thumb-size)) / 2);
		border-radius: 50%;
		background: var(--panel-light-color);
		cursor: pointer;
		-webkit-appearance: none;
	}
	input[type="range"]::-moz-range-thumb {
		width: var(--input-thumb-size);
		height: var(--input-thumb-size);
		border: none;
		border-radius: 50%;
		background: var(--panel-light-color);
		cursor: pointer;
	}

	.hover {
		position: fixed;
		z-index: 2;
		padding: 2px 6px;
		background: white;
		font:
			11px "IBM Plex Sans",
			sans-serif;
		pointer-events: none;
		white-space: nowrap;
	}
</style>
