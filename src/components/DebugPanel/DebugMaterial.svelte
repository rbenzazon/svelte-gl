<script>
  import { get } from "svelte/store";
  import { colorProps } from "../../color/color-space";
  import DebugH3 from "./DebugH3.svelte";
  import DebugH4 from "./DebugH4.svelte";
  import DebugSliderNumber from "./DebugSliderNumber.svelte";
  import DebugColor from "./DebugColor.svelte";
  import DebugBlock from "./DebugBlock.svelte";

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

<DebugBlock level={3}>
  <DebugH3 slot="title">Material</DebugH3>
  {#each Object.entries(get(material)) as [key, value]}
    {#if key.includes("Map")}
      <a href={"./" + value.url}>{key}</a>
    {:else if colorProps.some((c) => c === key)}
      <DebugColor label={key} color={value} />
    {:else if key in materialPropsRange}
      <DebugH4 padding="1">{key}</DebugH4>
      <DebugSliderNumber
        min={getRangeMin(key)}
        max={getRangeMax(key)}
        step={getRangeStep(key)}
        {value}
      />
    {:else if Object.keys(value).length > 0}
      <DebugBlock level={4}>
        <DebugH4 slot="title">{key}</DebugH4>
        {#each Object.entries(value).filter((p) => !(typeof p[1] === "function")) as [k, v]}
          {#if typeof v === "number"}
            <DebugH4 padding="1">{k}</DebugH4>
            <DebugSliderNumber
              min={getRangeMin(k)}
              max={getRangeMax(k)}
              step={getRangeStep(k)}
              value={v}
            />
          {:else if Array.isArray(v) && v.length === 3}
            <DebugColor label={k} color={v} />
          {/if}
        {/each}
      </DebugBlock>
    {/if}
  {/each}
</DebugBlock>

<style>
  a {
    color: var(--panel-light-color);
    padding: 0px 7px;
    /*text-decoration: none;*/
  }
</style>
