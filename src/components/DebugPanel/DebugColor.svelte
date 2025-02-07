<script type="module">
  import { createEventDispatcher } from "svelte";
  import {
    hexNumToCSSStringColor,
    linearArrayToCSSHashColor,
  } from "../../color/color-space";
  import DebugH4 from "./DebugH4.svelte";
  import DebugRow from "./DebugRow.svelte";
  export let label;
  export let color;
  function convertColor(color) {
    if (typeof color === "number") {
      return hexNumToCSSStringColor(color);
    } else if (Array.isArray(color)) {
      return linearArrayToCSSHashColor(color.slice(0, 3));
    }
    return color;
  }

  const dispatch = createEventDispatcher();
  function onChange(event) {
    dispatch("change", {
      color: event.target.value,
    });
  }
</script>

<DebugRow>
  <DebugH4>{label}</DebugH4>
  <input type="color" value={convertColor(color)} on:change={onChange} />
</DebugRow>

<style>
</style>
