<script type="module">
import { onMount, tick } from "svelte";
import Menu from "./Menu.svelte";
import { mountCube } from "./mount-cube.js";

let canvasA;
let canvasB;
let destroyA;
let destroyB;
let remounts = 0;

function mountB() {
	destroyB = mountCube(canvasB, { color: [0.3, 0.55, 1], background: 0x2a2118 });
}

async function remountB() {
	destroyB();
	// A destroyed engine leaves its canvas with a lost context, so the key block renders a new one.
	remounts += 1;
	await tick();
	mountB();
}

onMount(() => {
	destroyA = mountCube(canvasA, { color: [1, 0.35, 0.3], background: 0x1c2430 });
	mountB();
	return () => {
		destroyA();
		destroyB();
	};
});
</script>

<div class="views">
	<canvas bind:this={canvasA}></canvas>
	{#key remounts}
		<canvas bind:this={canvasB}></canvas>
	{/key}
</div>
<button on:click={remountB}>destroy and recreate right ({remounts})</button>
<Menu />

<style>
	.views {
		display: flex;
		width: 100%;
		height: 100%;
	}
	canvas {
		position: relative;
		width: 50%;
		height: 100%;
		display: block;
	}
	button {
		position: absolute;
		right: 12px;
		bottom: 12px;
		z-index: 1;
		padding: 6px 10px;
		font-family: sans-serif;
		font-size: 0.85rem;
	}
</style>
