<script type="module">
  import { createEventDispatcher } from "svelte";
  export let label;
  export let value;
  export let min;
  export let max;
  export let step;
  const dispatch = createEventDispatcher();
  function onChange(event) {
    dispatch("change", {
      number: parseFloat(event.target.value),
    });
  }
</script>

<span>{label}</span>
<input type="number" {min} {max} {step} {value} on:change={onChange} />

<style>
  input[type="number"] {
    flex: 0.3;
    padding: 3px 5px;
    color: var(--panel-light-color);
    background-color: var(--panel-dark-color);

    border: none;
    width: 0;
  }
  span {
    color: var(--panel-light-color);
    padding: 0px 10px;
  }
</style>
