<script type="module">
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
    color: var(--panel-light-color);
    background: var(--panel-dark-color);
  }
</style>
