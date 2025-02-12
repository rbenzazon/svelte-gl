<script type="module">
  import DebugCamera from "./DebugCamera.svelte";
  import DebugRenderer from "./DebugRenderer.svelte";
  import DebugLights from "./DebugLights.svelte";
  import DebugMeshes from "./DebugMeshes.svelte";

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
    <DebugMeshes />
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
    background-color: var(--panel-darkest-color);
    --input-thumb-color: white;
    --input-track-color: #515151;
    --input-thumb-size: 16px;
    --input-track-size: 8px;
    --panel-darkest-color: #252525;
    --panel-dark-color: #393939;
    --panel-medium-color: #777777;
    --panel-medium-light-color: #b7b7b7;
    --panel-light-color: #efefef;

    --panel-vertical-padding: 7px;
    --panel-horizontal-padding: 5px;
  }
  .panelContent {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: left;
    gap: 0px;
    margin: 50px 0px 20px 0px;
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
</style>
