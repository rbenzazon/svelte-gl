<script type="module">
import { get } from "svelte/store";
import { colorProps, cssStringColorToLinearArray } from "../../color/color-space";
import DebugH3 from "./DebugH3.svelte";
import DebugH4 from "./DebugH4.svelte";
import DebugSliderNumber from "./DebugSliderNumber.svelte";
import DebugColor from "./DebugColor.svelte";
import DebugBlock from "./DebugBlock.svelte";
import { createSpecular } from "../../material/specular/specular";

const materialPropsRange = {
	opacity: [0, 1],
	roughness: [0, 1],
	metalness: [0, 1],
	ior: [0, 2],
	intensity: [0, 30],
};
const specularPropsRange = {
	color: {
		type: "color",
	},
	intensity: {
		type: "number",
		range: [0, 30],
		step: 0.1,
	},
	roughness: {
		type: "number",
		range: [0, 1],
		step: 0.01,
	},
	ior: {
		type: "number",
		range: [0, 2],
		step: 0.01,
	},
};
function onDiffuseColorChange(e, material) {
	material.set({
		...get(material),
		diffuse: cssStringColorToLinearArray(e.detail.color),
	});
}
function onSpecularNumChange(e, material, key) {
	const specular = {
		...get(material).specular.props,
		[key]: e.detail.number,
	};
	console.log("onSpecularNumChange", specular, e.detail.number);
	/*
  {
    ...get(material).specular,
    [key]: e.detail.value,
  },
  */
	material.set({
		...get(material),
		specular: createSpecular(specular),
	});
}
function getRangeMin(key) {
	return materialPropsRange[key][0];
}
function getRangeMax(key) {
	return materialPropsRange[key][1];
}
function getRangeStep(key) {
	return (materialPropsRange[key][1] - materialPropsRange[key][0]) / 20;
}
function getFileName(url) {
	return url.split("/").pop();
}

export let material;
</script>

<DebugBlock level={3}>
  <DebugH4 slot="title">Material</DebugH4>
  {#each Object.entries(get(material)) as [key, value]}
    {#if key.includes("Map")}
      <DebugH4 padding="1">{key}</DebugH4>
      <a href={"./" + value.url}>{getFileName(value.url)}</a>
    {:else if key === "diffuse"}
      <DebugColor label={key} color={value} on:change={(e) => onDiffuseColorChange(e, material)} />
    {:else if key in materialPropsRange}
      <DebugH4 padding="1">{key}</DebugH4>
      <DebugSliderNumber
        min={getRangeMin(key)}
        max={getRangeMax(key)}
        step={getRangeStep(key)}
        {value}
      />
    {:else if key === "specular"}
      <DebugBlock level={4}>
        <DebugH4 slot="title">{key}</DebugH4>
        {#each Object.entries(specularPropsRange) as [specularKey, specularDef]}
          {#if specularDef.type === "number"}
            <DebugH4 padding="1">{specularKey}</DebugH4>
            <DebugSliderNumber
              min={specularDef.range[0]}
              max={specularDef.range[1]}
              step={specularDef.step}
              value={value[specularKey]}
              on:change={(e) => onSpecularNumChange(e, material, specularKey)}
            />
          {:else if specularDef.type === "color"}
            <DebugColor label={specularKey} color={value[specularKey]} />
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
