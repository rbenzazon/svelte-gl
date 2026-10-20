<script type="module">
import { onMount } from "svelte";
import Menu from "./Menu.svelte";
import { mountCube } from "./mount-cube.js";

let canvasA;
let canvasB;

onMount(() => {
	mountCube(canvasA, { color: [1, 0.35, 0.3], background: 0x1c2430 });
	mountCube(canvasB, { color: [0.3, 0.55, 1], background: 0x2a2118 });
});
</script>

<div class="views">
	<canvas bind:this={canvasA}></canvas>
	<canvas bind:this={canvasB}></canvas>
</div>
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
</style>
