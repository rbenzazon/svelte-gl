<script>
let count = $state(0);
import { counter } from "./store.svelte.js";
let localNum = lastNum;
</script>
{counter.title}
<button onclick={counter.increment}>{counter.num}</button>
