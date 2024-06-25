<svelte:options runes />
<script>
import Nested from "./Nested.svelte";
let counter = $state({
	num: 0,
	increment() {
		counter.num += 1;
	},
});
let btn;
</script>

<button bind:this={btn} onclick={counter.increment}>{counter.num}</button>
{counter.title}