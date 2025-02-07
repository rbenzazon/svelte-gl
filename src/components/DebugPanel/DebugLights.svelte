<script type="module">
  import { get } from "svelte/store";
  import { cssStringColorToLinearArray, linearArrayToCSSHashColor } from "../../color/color-space";
  import { lights } from "../../store/engine-refactor";


  import DebugBlock from "./DebugBlock.svelte";
  import DebugColor from "./DebugColor.svelte";
  import DebugH2 from "./DebugH2.svelte";
  import DebugH3 from "./DebugH3.svelte";
  import DebugH4 from "./DebugH4.svelte";
  import DebugNumber from "./DebugNumber.svelte";
  import DebugRow from "./DebugRow.svelte";
  import DebugSliderNumber from "./DebugSliderNumber.svelte";

  const lightPropsRange = {
	intensity: [0, 30],
	ambientIntensity: [0, 1],
	cutoffDistance: [0, 30],
	decayExponent: [0, 5],
};

function getRangeMin(key) {
	return lightPropsRange[key][0];
}
function getRangeMax(key) {
	return lightPropsRange[key][1];
}
function getRangeStep(key) {
	return (lightPropsRange[key][1] - lightPropsRange[key][0]) / 20;
}

  function onLightColorChange(e, light) {
	console.log(cssStringColorToLinearArray(e.detail.color));
	light.set({
		...get(light),
		color: cssStringColorToLinearArray(e.detail.color),
	});
}
function onLightIntensityChange(e, light) {
	light.set({
		...get(light),
		intensity: e.detail.number,
	});
}
function onLightXChange(e, light) {
	const lightValue = get(light);
	light.set({
		...lightValue,
		position: [e.detail.number, lightValue.position[1], lightValue.position[2]],
	});
}
function onLightYChange(e, light) {
	const lightValue = get(light);
	light.set({
		...lightValue,
		position: [lightValue.position[0], e.detail.number, lightValue.position[2]],
	});
}
function onLightZChange(e, light) {
	const lightValue = get(light);
	light.set({
		...lightValue,
		position: [lightValue.position[0], lightValue.position[1], e.detail.number],
	});
}
function onLightCutoffDistanceChange(e, light) {
	light.set({ ...get(light), cutoffDistance: e.detail.number });
}
function onLightDecayExponentChange(e, light) {
	light.set({ ...get(light), decayExponent: e.detail.number });
}

</script>
<DebugH2>Lights</DebugH2>
    <DebugBlock>
      {#each $lights as light, i}
        <DebugBlock>
          <DebugH3>Light {i}</DebugH3>
          <DebugRow>
            <DebugColor
              label="Color"
              color={linearArrayToCSSHashColor(get(light).color)}
              on:change={(e) => onLightColorChange(e, light)}
            />
          </DebugRow>
          
          <DebugH4>Intensity</DebugH4>
            <DebugSliderNumber
              min={getRangeMin("intensity")}
              max={getRangeMax("intensity")}
              step={getRangeStep("intensity")}
              value={get(light).intensity}
              on:change={(e) => onLightIntensityChange(e, light)}
            />
          <DebugH4>Position</DebugH4>
          <DebugRow>
            <DebugNumber
              label="x"
              value={get(light).position[0]}
              on:change={(e) => onLightXChange(e, light)}
            />
            <DebugNumber
              label="y"
              value={get(light).position[1]}
              on:change={(e) => onLightYChange(e, light)}
            />
            <DebugNumber
              label="z"
              value={get(light).position[2]}
              on:change={(e) => onLightZChange(e, light)}
            />
          </DebugRow>
          <DebugH4>Cutoff Distance</DebugH4>
          <DebugSliderNumber
            min={getRangeMin("cutoffDistance")}
            max={getRangeMax("cutoffDistance")}
            step={getRangeStep("cutoffDistance")}
            value={get(light).cutoffDistance}
            on:change={(e) => onLightCutoffDistanceChange(e, light)}
          />
          
          <DebugH4>Decay Exponent</DebugH4>
          <DebugSliderNumber
            min={getRangeMin("decayExponent")}
            max={getRangeMax("decayExponent")}
            step={getRangeStep("decayExponent")}
            value={get(light).decayExponent}
            on:change={(e) => onLightDecayExponentChange(e, light)}
          />
        </DebugBlock>
      {/each}
    </DebugBlock>