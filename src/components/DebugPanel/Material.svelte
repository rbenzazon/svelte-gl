<script>
  import { get } from "svelte/store";
  import {
    colorProps,
    linearArrayToCSSHashColor,
  } from "../../color/color-space";
  import DebugH3 from "./DebugH3.svelte";
  import DebugRow from "./DebugRow.svelte";

  const materialPropsRange = {
    opacity: [0, 1],
    roughness: [0, 1],
    metalness: [0, 1],
    ior: [0, 2],
    intensity: [0, 30],
  };
  function getRangeMin(key) {
    return materialPropsRange[key][0];
  }
  function getRangeMax(key) {
    return materialPropsRange[key][1];
  }
  function getRangeStep(key) {
    return (materialPropsRange[key][1] - materialPropsRange[key][0]) / 20;
  }

  export let material;
</script>

<DebugH3>Material</DebugH3>
{#each Object.entries(get(material)) as [key, value]}
  {#if key.includes("Map")}
    <a href={"./" + value.url}>{key}</a>
  {:else if colorProps.some((c) => c === key)}
    <DebugRow>
      <span class="label">{key}</span>
      <input type="color" value={linearArrayToCSSHashColor(value)} />
    </DebugRow>
  {:else if key in materialPropsRange}
    <h4>{key}</h4>
    <DebugRow>
      <input
        type="range"
        min={getRangeMin(key)}
        max={getRangeMax(key)}
        step={getRangeStep(key)}
        {value}
      />
      <input
        type="number"
        min={getRangeMin(key)}
        max={getRangeMax(key)}
        step={getRangeStep(key)}
        {value}
      />
    </DebugRow>
  {:else if Object.keys(value).length > 0}
    <h4>{key}</h4>
    {#each Object.entries(value).filter((p) => !(typeof p[1] === "function")) as [k, v]}
      {#if typeof v === "number"}
        <h4>{k}</h4>
        <DebugRow>
          <input
            type="range"
            min={getRangeMin(k)}
            max={getRangeMax(k)}
            step={getRangeStep(k)}
            value={v}
          />
          <input
            type="number"
            min={getRangeMin(k)}
            max={getRangeMax(k)}
            step={getRangeStep(k)}
            value={v}
          />
        </DebugRow>
      {:else if Array.isArray(v) && v.length === 3}
        <DebugRow>
          <span class="label">{k}</span>
          <input type="color" value={linearArrayToCSSHashColor(v)} />
        </DebugRow>
      {/if}
    {/each}
  {/if}
{/each}
