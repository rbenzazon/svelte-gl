<script type="module">
  import DebugBlock from "./DebugBlock.svelte";
  import DebugH2 from "./DebugH2.svelte";
  import DebugH3 from "./DebugH3.svelte";
  import DebugNumber from "./DebugNumber.svelte";
  import DebugRow from "./DebugRow.svelte";
  import DebugSliderNumber from "./DebugSliderNumber.svelte";

  import { renderer } from "../../store/engine-refactor.js";
  import DebugColor from "./DebugColor.svelte";
  import DebugH4 from "./DebugH4.svelte";
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
      ambientLightColor: [
        cssStringColorToHexNum(e.detail.color),
        $renderer.ambientLightColor[1],
      ],
    };
  }
</script>

<DebugH2>Renderer</DebugH2>
<DebugBlock>
  <DebugRow>
    <DebugColor
      label="Background Color"
      color={$renderer.backgroundColor}
      on:change={onBGColorChange}
    />
  </DebugRow>
  <DebugRow>
    <DebugColor
      label="Ambient Light Color"
      color={$renderer.ambientLightColor[0]}
      on:change={onAColorChange}
    />
  </DebugRow>
  <DebugH4>Ambient Light Intensity</DebugH4>
    <DebugSliderNumber
      min={getRangeMin("ambientIntensity")}
      max={getRangeMax("ambientIntensity")}
      step={getRangeStep("ambientIntensity")}
      value={$renderer.ambientLightColor[1]}
      on:change={onAIntensityChange}
    />
</DebugBlock>
