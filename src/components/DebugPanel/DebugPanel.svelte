<script type="module">
import { get } from "svelte/store";
import { renderer, camera, meshes, lights } from "../../store/engine-refactor.js";
import Material from "./Material.svelte";
import {
	colorProps,
	cssStringColorToHexNum,
	cssStringColorToLinearArray,
	hexNumToCSSStringColor,
	linearArrayToCSSHashColor,
} from "../../color/color-space.js";
import DebugH2 from "./DebugH2.svelte";
import DebugH3 from "./DebugH3.svelte";
import DebugRow from "./DebugRow.svelte";
import DebugColor from "./DebugColor.svelte";
import DebugH4 from "./DebugH4.svelte";
import DebugNumber from "./DebugNumber.svelte";
import DebugBlock from "./DebugBlock.svelte";
import DebugSliderNumber from "./DebugSliderNumber.svelte";
import DebugCamera from "./DebugCamera.svelte";
import DebugRenderer from "./DebugRenderer.svelte";
  import DebugLights from "./DebugLights.svelte";



function collapse() {
	collapsed = !collapsed;
}
let collapsed = false;


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
    <DebugRenderer />
    <DebugCamera />
    <DebugH2>Meshes</DebugH2>
    <DebugBlock>
      {#each $meshes as { attributes, drawMode, matrix, material }, i}
        <div class="mesh">
          <DebugH3>Mesh {i}</DebugH3>
          <DebugH3>Attributes</DebugH3>
          <div class="attributes">
            {#each Object.entries(attributes) as [key, value]}
              <span>{key}: {value.length}</span>
            {/each}
          </div>
          <DebugH3>Draw Mode</DebugH3>
          <span>{drawMode}</span>
          <DebugH3>Matrix</DebugH3>
          <div class="matrix4x4">
            {#each get(matrix) as num}
              <span>{num}</span>
            {/each}
          </div>
          <Material {material} />
        </div>
      {/each}
    </DebugBlock>
    <DebugLights />
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
  .panelContent h4 {
    /* capitalize*/
    text-transform: capitalize;

    font-size: 0.8rem;
    color: var(--panel-medium-color);
    padding: 15px 7px 2px 7px;
    /*
        only top and bottom border
        border-top: 1px solid var(--panel-dark-color);
        padding: 4px 7px 2px 7px;
        */
  }
  .panelContent span {
    color: var(--panel-light-color);
    padding: 0px 10px;
  }
  .collapsed {
    display: none !important;
  }
  .collapseButton {
    font-size: 1.5rem;
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
    font-size: 0.9rem;
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
