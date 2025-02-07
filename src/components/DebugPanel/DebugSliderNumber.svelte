<script type="module">
  import { createEventDispatcher } from "svelte";
  import DebugRow from "./DebugRow.svelte";
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
<DebugRow>
  <input type="range" {min} {max} {step} {value} on:change={onChange} />
  <input type="number" {min} {max} {step} {value} on:change={onChange} />
</DebugRow>

<style>
  input[type="range"]:focus {
    outline: none;
  }
  input[type="range"] {
    border-radius: 5px;
    height: 5px;
    outline: none;
    -webkit-appearance: none;
    appearance: none;
    flex: 1;
  }
  input[type="range"]::-webkit-slider-runnable-track {
    height: var(--input-track-size);
    background-color: var(--panel-dark-color);
    border-radius: calc(var(--input-track-size) / 2);
  }
  input[type="range"]:focus::-webkit-slider-runnable-track {
    background-color: var(--panel-dark-color);
  }
  input[type="range"]::-moz-range-track {
    height: var(--input-track-size);
    background-color: var(--panel-dark-color);
    border-radius: calc(var(--input-track-size) / 2);
  }
  input[type="range"]::-webkit-slider-thumb {
    border-radius: calc(var(--input-thumb-size) / 2);
    height: var(--input-thumb-size);
    width: var(--input-thumb-size);
    background: var(--input-thumb-color);
    cursor: pointer;
    -webkit-appearance: none;
    margin-top: calc((var(--input-track-size) - var(--input-thumb-size)) / 2);
  }
  input[type="range"]::-moz-range-thumb {
    border: none;
    height: var(--input-thumb-size);
    width: var(--input-thumb-size);
    border-radius: calc(var(--input-thumb-size) / 2);
    background: var(--input-thumb-color);
    cursor: pointer;
  }

  input[type="number"] {
    /* make it grow less in flex width */
    flex: 0.3;
    padding: 3px 5px;
    color: var(--panel-light-color);
    background-color: var(--panel-dark-color);

    border: none;
    width: 0;
  }
</style>
