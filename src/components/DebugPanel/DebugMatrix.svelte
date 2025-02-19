<script type="module">
import DebugBlock from "./DebugBlock.svelte";

export let matrix;
</script>

<div>
  {#each matrix as num}
    <span>{num}</span>
  {/each}
</div>

<style>
  div {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 5px;
    padding: 5px 40px;
  }
  span {
    font-size: 0.8rem;
    color: var(--panel-light-color);
    background: var(--panel-dark-color);
    padding: var(--panel-horizontal-padding) var(--panel-vertical-padding);
    border-radius: 0.3125rem;
    max-width: 3rem;
    overflow:hidden;
    white-space: nowrap;
  }
</style>
