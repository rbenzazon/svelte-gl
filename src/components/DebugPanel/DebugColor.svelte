<script type="module">
  import { createEventDispatcher } from "svelte";
  import { hexNumToCSSStringColor } from "../../color/color-space";
  import DebugH4 from "./DebugH4.svelte";
  export let label;
  export let color;
  const dispatch = createEventDispatcher();
  function onChange(event) {
    dispatch("change", {
      color: event.target.value,
    });
  }
</script>

<DebugH4>{label}</DebugH4>
<input
  type="color"
  value={hexNumToCSSStringColor(color)}
  on:change={onChange}
/>

<style>
</style>
