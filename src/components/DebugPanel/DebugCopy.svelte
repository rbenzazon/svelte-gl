<script type="module">
import { createEventDispatcher } from "svelte";
const dispatch = createEventDispatcher();
function onCopy() {
	dispatch("click");
}
</script>

<div class="container" on:click={onCopy}>
    <div class="top"></div>
    <div class="bottom"></div>
</div>

<style>
    .container {
        position: relative;
        width: 0.7rem;
        height: 1rem;
    }
    div:not(.container) {
        position: absolute;
        width: 0.5rem;
        height: 0.8rem;
        border-radius: 0.1rem;
    }
    .top {
        left: 0.2rem;
        border-top: 0.1rem solid var(--panel-medium-light-color);
        border-right: 0.1rem solid var(--panel-medium-light-color);
    }
    .bottom {
        top: 0.2rem;
        border: 0.1rem solid var(--panel-medium-light-color);
    }
</style>