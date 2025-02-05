<script type="module">
  import { get } from "svelte/store";
  import { renderer, camera, meshes, lights } from "./store/engine-refactor.js";

  const materialPropsRange = {
    roughness: [0, 1],
    metalness: [0, 1],
    ior: [0, 2],
    intensity: [0, 30],
    cutoffDistance: [0, 30],
    decayExponent: [0, 5],
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

  /*$: {
    const lightStores = $lights;
    lightStores.forEach((light) => light.subscribe());
}*/

  function linearArrayToCSSHashColor(array) {
    return array
      .map((num) => Math.floor(num * 255))
      .reduce((acc, num) => acc + num.toString(16).padStart(2, "0"), "#");
  }
  function hexNumToCSSStringColor(hex) {
    return "#" + hex.toString(16).padStart(6, "0");
  }
  function cssStringColorToHexNum(color) {
    return parseInt(color.slice(1), 16);
  }
  function cssStringColorToLinearArray(color) {
    return [
      parseInt(color.slice(1, 3), 16) / 255,
      parseInt(color.slice(3, 5), 16) / 255,
      parseInt(color.slice(5, 7), 16) / 255,
    ];
  }
  const colorProps = ["diffuse", "color"];
  function collapse() {
    collapsed = !collapsed;
  }
  let collapsed = false;
  function onBGColorChange(e) {
    $renderer = {
      ...$renderer,
      backgroundColor: cssStringColorToHexNum(e.currentTarget.value),
    };
  }
  function onAColorChange(e) {
    $renderer = {
      ...$renderer,
      ambientLightColor: [
        cssStringColorToHexNum(e.currentTarget.value),
        $renderer.ambientLightColor[1],
      ],
    };
  }
  function onAIntensityChange(e) {
    $renderer = {
      ...$renderer,
      ambientLightColor: [
        $renderer.ambientLightColor[0],
        e.currentTarget.value,
      ],
    };
  }

  function onCameraXPositionChange(e) {
    $camera = {
      ...$camera,
      position: [
        e.currentTarget.value,
        $camera.position[1],
        $camera.position[2],
      ],
    };
  }
  function onCameraYPositionChange(e) {
    $camera = {
      ...$camera,
      position: [
        $camera.position[0],
        e.currentTarget.value,
        $camera.position[2],
      ],
    };
  }
  function onCameraZPositionChange(e) {
    $camera = {
      ...$camera,
      position: [
        $camera.position[0],
        $camera.position[1],
        e.currentTarget.value,
      ],
    };
  }
  function onCameraXTargetChange(e) {
    $camera = {
      ...$camera,
      target: [e.currentTarget.value, $camera.target[1], $camera.target[2]],
    };
  }
  function onCameraYTargetChange(e) {
    $camera = {
      ...$camera,
      target: [$camera.target[0], e.currentTarget.value, $camera.target[2]],
    };
  }
  function onCameraZTargetChange(e) {
    $camera = {
      ...$camera,
      target: [$camera.target[0], $camera.target[1], e.currentTarget.value],
    };
  }
  function onCameraFOVChange(e) {
    $camera = { ...$camera, fov: e.currentTarget.value };
  }
  function onLightColorChange(e, light) {
    console.log(cssStringColorToLinearArray(e.currentTarget.value));
    light.set({
      ...get(light),
      color: cssStringColorToLinearArray(e.currentTarget.value),
    });
  }
  function onLightIntensityChange(e, light) {
    light.set({
      ...get(light),
      intensity: e.currentTarget.value,
    });
  }
  function onLightXChange(e, light) {
    const lightValue = get(light);
    light.set({
      ...lightValue,
      position: [
        e.currentTarget.value,
        lightValue.position[1],
        lightValue.position[2],
      ],
    });
  }
  function onLightYChange(e, light) {
    const lightValue = get(light);
    light.set({
      ...lightValue,
      position: [
        lightValue.position[0],
        e.currentTarget.value,
        lightValue.position[2],
      ],
    });
  }
  function onLightZChange(e, light) {
    const lightValue = get(light);
    light.set({
      ...lightValue,
      position: [
        lightValue.position[0],
        lightValue.position[1],
        e.currentTarget.value,
      ],
    });
  }
  function onLightCutoffDistanceChange(e, light) {
    light.set({ ...get(light), cutoffDistance: e.currentTarget.value });
  }
  function onLightDecayExponentChange(e, light) {
    light.set({ ...get(light), decayExponent: e.currentTarget.value });
  }
</script>

<div
  on:click={collapse}
  class="collapseButton openButton"
  class:collapsed={!collapsed}
>
  {"<"}
</div>
<div class="panel" class:collapsed>
  <div class="panelContent">
    <button class="collapseButton" on:click={collapse}>{">"}</button>
    <h2>Renderer</h2>
    <div class="block">
      <div class="row">
        <h4>Background Color</h4>
        <input
          type="color"
          value={hexNumToCSSStringColor($renderer.backgroundColor)}
          on:change={onBGColorChange}
        />
      </div>
      <div class="row">
        <h4>Ambient Light Color</h4>
        <input
          type="color"
          value={hexNumToCSSStringColor($renderer.ambientLightColor[0])}
          on:change={onAColorChange}
        />
      </div>
      <h4>Ambient Light Intensity</h4>
      <div class="row">
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={$renderer.ambientLightColor[1]}
          on:change={onAIntensityChange}
        />
        <input
          type="number"
          min="0"
          max="1"
          step="0.01"
          value={$renderer.ambientLightColor[1]}
          on:change={onAIntensityChange}
        />
      </div>
    </div>
    <h2>Camera</h2>
    <div class="block">
      <h3>Position</h3>
      <div class="row">
        <span>x</span><input
          type="number"
          value={$camera.position[0]}
          on:change={onCameraXPositionChange}
        />
        <span>y</span><input
          type="number"
          value={$camera.position[1]}
          on:change={onCameraYPositionChange}
        />
        <span>z</span><input
          type="number"
          value={$camera.position[2]}
          on:change={onCameraZPositionChange}
        />
      </div>
      <h3>Target</h3>
      <div class="row">
        <span>x</span><input
          type="number"
          value={$camera.target[0]}
          on:change={onCameraXTargetChange}
        />
        <span>y</span><input
          type="number"
          value={$camera.target[1]}
          on:change={onCameraYTargetChange}
        />
        <span>z</span><input
          type="number"
          value={$camera.target[2]}
          on:change={onCameraZTargetChange}
        />
      </div>
      <h3>FOV</h3>
      <div class="row">
        <input
          type="range"
          min="0"
          max="180"
          step="1"
          value={$camera.fov}
          on:change={onCameraFOVChange}
        /><input
          type="number"
          value={$camera.fov}
          on:change={onCameraFOVChange}
        />
      </div>
    </div>
    <h2>Meshes</h2>
    <div class="block">
      {#each $meshes as { attributes, drawMode, matrix, material }, i}
        <div class="mesh">
          <h3>Mesh {i}</h3>
          <h3>Attributes</h3>
          <div class="attributes">
            {#each Object.entries(attributes) as [key, value]}
              <span>{key}: {value.length}</span>
            {/each}
          </div>
          <h3>Draw Mode</h3>
          <span>{drawMode}</span>
          <h3>Matrix</h3>
          <div class="matrix4x4">
            {#each get(matrix) as num}
              <span>{num}</span>
            {/each}
          </div>
          <h3>Material</h3>
          {#each Object.entries(material) as [key, value]}
            {#if key.includes("Map")}
              <a href={"./" + value.url}>{key}</a>
            {:else if colorProps.some((c) => c === key)}
              <div class="row">
                <span class="label">{key}</span>
                <input type="color" value={linearArrayToCSSHashColor(value)} />
              </div>
            {:else if key in materialPropsRange}
              <h4>{key}</h4>
              <div class="row">
                <input
                  type="range"
                  min={materialPropsRange[key][0]}
                  max={materialPropsRange[key][1]}
                  step={(materialPropsRange[key][1] -
                    materialPropsRange[key][0]) /
                    20}
                  {value}
                />
                <input
                  type="number"
                  min={materialPropsRange[key][0]}
                  max={materialPropsRange[key][1]}
                  step={(materialPropsRange[key][1] -
                    materialPropsRange[key][0]) /
                    20}
                  {value}
                />
              </div>
            {:else if Object.keys(value).length > 0}
              <h4>{key}</h4>
              {#each Object.entries(value).filter((p) => !(typeof p[1] === "function")) as [k, v]}
                {#if typeof v === "number"}
                  <h4>{k}</h4>
                  <div class="row">
                    <input
                      type="range"
                      min={materialPropsRange[k][0]}
                      max={materialPropsRange[k][1]}
                      step={(materialPropsRange[k][1] -
                        materialPropsRange[k][0]) /
                        20}
                      value={v}
                    />
                    <input
                      type="number"
                      min={materialPropsRange[k][0]}
                      max={materialPropsRange[k][1]}
                      step={(materialPropsRange[k][1] -
                        materialPropsRange[k][0]) /
                        20}
                      value={v}
                    />
                  </div>
                {:else if Array.isArray(v) && v.length === 3}
                  <div class="row">
                    <span class="label">{k}</span>
                    <input type="color" value={linearArrayToCSSHashColor(v)} />
                  </div>
                {/if}
              {/each}
            {/if}
          {/each}
        </div>
      {/each}
    </div>
    <h2>Lights</h2>
    <div class="block">
      {#each $lights as light, i}
        <div class="light">
          <h3>Light {i}</h3>
          <div class="row">
            <h4>Color</h4>
            <input
              type="color"
              value={linearArrayToCSSHashColor(get(light).color)}
              on:change={(e) => onLightColorChange(e, light)}
            />
          </div>
          <h4>Intensity</h4>
          <div class="row">
            <input
              type="range"
              min={getRangeMin("intensity")}
              max={getRangeMax("intensity")}
              step={getRangeStep("intensity")}
              value={get(light).intensity}
              on:change={(e) => onLightIntensityChange(e, light)}
            />
            <input
              type="number"
              min={getRangeMin("intensity")}
              max={getRangeMax("intensity")}
              step={getRangeStep("intensity")}
              value={get(light).intensity}
              on:change={(e) => onLightIntensityChange(e, light)}
            />
          </div>
          <h4>Position</h4>
          <div class="row">
            <span>x</span><input
              type="number"
              value={get(light).position[0]}
              on:change={(e) => onLightXChange(e, light)}
            />
            <span>y</span><input
              type="number"
              value={get(light).position[1]}
              on:change={(e) => onLightYChange(e, light)}
            />
            <span>z</span><input
              type="number"
              value={get(light).position[2]}
              on:change={(e) => onLightZChange(e, light)}
            />
          </div>
          <h4>Cutoff Distance</h4>
          <div class="row">
            <input
              type="range"
              min={getRangeMin("cutoffDistance")}
              max={getRangeMax("cutoffDistance")}
              step={getRangeStep("cutoffDistance")}
              value={get(light).cutoffDistance}
              on:change={(e) => onLightCutoffDistanceChange(e, light)}
            />
            <input
              type="number"
              min={getRangeMin("cutoffDistance")}
              max={getRangeMax("cutoffDistance")}
              step={getRangeStep("cutoffDistance")}
              value={get(light).cutoffDistance}
              on:change={(e) => onLightCutoffDistanceChange(e, light)}
            />
          </div>
          <h4>Decay Exponent</h4>
          <div class="row">
            <input
              type="range"
              min={getRangeMin("decayExponent")}
              max={getRangeMax("decayExponent")}
              step={getRangeStep("decayExponent")}
              value={get(light).decayExponent}
              on:change={(e) => onLightDecayExponentChange(e, light)}
            />
            <input
              type="number"
              min={getRangeMin("decayExponent")}
              max={getRangeMax("decayExponent")}
              step={getRangeStep("decayExponent")}
              value={get(light).decayExponent}
              on:change={(e) => onLightDecayExponentChange(e, light)}
            />
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .panel {
    font-family: Arial, sans-serif;
    position: absolute;
    top: 0;
    right: 0;
    width: 350px;
    height: 100%;
    overflow-y: auto;

    color: white;
    background-color: rgba(0, 0, 0, 0.8);
    --input-thumb-color: white;
    --input-track-color: #515151;
    --input-thumb-size: 16px;
    --input-track-size: 8px;
    --panel-dark-color: #515151;
    --panel-medium-color: #bdbdbd;
    --panel-light-color: #efefef;
  }
  .panelContent {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: left;
    gap: 10px;
    margin: 50px 0px 20px 0px;
  }
  .panelContent h2 {
    /*all caps*/
    text-transform: uppercase;
    font-weight: bold;
    font-size: 1em;
    color: var(--panel-light-color);
    /*only top and bottom border*/
    border-top: 1px solid var(--panel-dark-color);
    border-bottom: 1px solid var(--panel-dark-color);
    padding: 4px 7px 2px 7px;
  }
  .panelContent h3 {
    /*all caps*/
    text-transform: uppercase;
    font-size: 0.9em;
    color: var(--panel-light-color);
    border-top: 1px solid var(--panel-dark-color);
    padding: 5px 7px 2px 7px;
    /*
        only top and bottom border
        border-top: 1px solid var(--panel-dark-color);
        padding: 4px 7px 2px 7px;
        */
  }
  .panelContent h4 {
    /* capitalize*/
    text-transform: capitalize;

    font-size: 0.8em;
    color: var(--panel-medium-color);
    padding: 15px 7px 2px 7px;
    /*
        only top and bottom border
        border-top: 1px solid var(--panel-dark-color);
        padding: 4px 7px 2px 7px;
        */
  }
  .panelContent h3:first-child {
    border-top: none;
  }
  .panelContent span {
    color: var(--panel-light-color);
    padding: 0px 10px;
  }
  .collapsed {
    display: none !important;
  }
  .collapseButton {
    font-size: 1.5em;
    font-weight: bold;
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    position: absolute;
    top: 0;
    right: 0;
    width: 50px;
    height: 50px;
  }

  .openButton {
    background-color: rgba(0, 0, 0, 0.8);
    color: white;
    display: flex;
    justify-content: center;
    align-items: center;
    font-family: Arial, sans-serif;
  }
  .row {
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 0px 10px;
    gap: 10px;
  }
  .row > input[type="range"],
  .row h4,
  .row span.label {
    flex: 1;
  }
  input[type="range"]:focus {
    outline: none;
  }
  input[type="range"] {
    border-radius: 5px;
    height: 5px;
    outline: none;
    -webkit-appearance: none;
    appearance: none;
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

  .row input[type="number"] {
    /* make it grow less in flex width */
    flex: 0.3;
    padding: 3px 5px;
    color: var(--panel-light-color);
    background-color: var(--panel-dark-color);

    border: none;
    width: 0;
  }
  .block {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: left;
    flex-direction: column;
    gap: 15px;
    padding: 0px 10px;
    font-size: 0.9em;
  }

  .mesh {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: left;
    flex-direction: column;
    gap: 10px;
  }
  .attributes {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: left;
    flex-direction: column;
    gap: 10px;
    padding: 5px;
  }
  .matrix4x4 {
    /* 4x4 matrix */
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 5px;
    padding: 5px 40px;
  }
  .matrix4x4 > span {
    color: var(--panel-light-color);
    background: var(--panel-dark-color);
  }
  a {
    color: white;
  }
  .lights {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: left;
    flex-direction: column;
    gap: 20px;
    padding: 20px;
  }
  .light {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: left;
    flex-direction: column;
    gap: 10px;
  }
</style>
