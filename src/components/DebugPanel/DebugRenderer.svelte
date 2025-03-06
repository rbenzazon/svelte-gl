<script type="module">
import DebugBlock from "./DebugBlock.svelte";
import DebugH2 from "./DebugH2.svelte";
import DebugSliderNumber from "./DebugSliderNumber.svelte";
import { renderer } from "../../store/renderer";
import DebugColor from "./DebugColor.svelte";
import DebugH4 from "./DebugH4.svelte";
import { cssStringColorToHexNum } from "../../color/color-space";

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
function onAIntensityChange(e) {
	$renderer = {
		...$renderer,
		ambientLightColor: [$renderer.ambientLightColor[0], e.detail.number],
	};
}
function onBGColorChange(e) {
	$renderer = {
		...$renderer,
		backgroundColor: cssStringColorToHexNum(e.detail.color),
	};
}
function onAColorChange(e) {
	$renderer = {
		...$renderer,
		ambientLightColor: [cssStringColorToHexNum(e.detail.color), $renderer.ambientLightColor[1]],
	};
}
</script>

<DebugBlock>
  <DebugH2 slot="title">Renderer</DebugH2>
  <DebugColor
    label="Background Color"
    color={$renderer.backgroundColor}
    on:change={onBGColorChange}
  />
  <DebugColor
    label="Ambient Light Color"
    color={$renderer.ambientLightColor[0]}
    on:change={onAColorChange}
  />
  <DebugH4 padding="1">Ambient Light Intensity</DebugH4>
  <DebugSliderNumber
    min={getRangeMin("ambientIntensity")}
    max={getRangeMax("ambientIntensity")}
    step={getRangeStep("ambientIntensity")}
    value={$renderer.ambientLightColor[1]}
    on:change={onAIntensityChange}
  />
</DebugBlock>
