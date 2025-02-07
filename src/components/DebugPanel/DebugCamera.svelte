<script type="module">
  import DebugBlock from "./DebugBlock.svelte";
  import DebugH2 from "./DebugH2.svelte";
  import DebugH3 from "./DebugH3.svelte";
  import DebugNumber from "./DebugNumber.svelte";
  import DebugRow from "./DebugRow.svelte";
  import DebugSliderNumber from "./DebugSliderNumber.svelte";

  import { camera } from "../../store/engine-refactor.js";
  import DebugH4 from "./DebugH4.svelte";

  function onCameraXPositionChange(e) {
    $camera = {
      ...$camera,
      position: [e.detail.number, $camera.position[1], $camera.position[2]],
    };
  }
  function onCameraYPositionChange(e) {
    $camera = {
      ...$camera,
      position: [$camera.position[0], e.detail.number, $camera.position[2]],
    };
  }
  function onCameraZPositionChange(e) {
    $camera = {
      ...$camera,
      position: [$camera.position[0], $camera.position[1], e.detail.number],
    };
  }
  function onCameraXTargetChange(e) {
    $camera = {
      ...$camera,
      target: [e.detail.number, $camera.target[1], $camera.target[2]],
    };
  }
  function onCameraYTargetChange(e) {
    $camera = {
      ...$camera,
      target: [$camera.target[0], e.detail.number, $camera.target[2]],
    };
  }
  function onCameraZTargetChange(e) {
    $camera = {
      ...$camera,
      target: [$camera.target[0], $camera.target[1], e.detail.number],
    };
  }
  function onCameraFOVChange(e) {
    $camera = { ...$camera, fov: e.detail.number };
  }
</script>

<DebugH2>Camera</DebugH2>
<DebugBlock>
  <DebugH4 padding="1">Position</DebugH4>
  <DebugRow>
    <DebugNumber
      label="x"
      value={$camera.position[0]}
      on:change={onCameraXPositionChange}
    />
    <DebugNumber
      label="y"
      value={$camera.position[1]}
      on:change={onCameraYPositionChange}
    />
    <DebugNumber
      label="z"
      value={$camera.position[2]}
      on:change={onCameraZPositionChange}
    />
  </DebugRow>
  <DebugH4 padding="1">Target</DebugH4>
  <DebugRow>
    <DebugNumber
      label="x"
      value={$camera.target[0]}
      on:change={onCameraXTargetChange}
    />
    <DebugNumber
      label="y"
      value={$camera.target[1]}
      on:change={onCameraYTargetChange}
    />
    <DebugNumber
      label="z"
      value={$camera.target[2]}
      on:change={onCameraZTargetChange}
    />
  </DebugRow>
  <DebugH4 padding="1">FOV</DebugH4>
  <DebugSliderNumber
    min="0"
    max="180"
    step="1"
    value={$camera.fov}
    on:change={onCameraFOVChange}
  />
</DebugBlock>
