<script type="module">
  import { get } from "svelte/store";
  import { meshes } from "../../store/engine-refactor";
  import DebugBlock from "./DebugBlock.svelte";

  import DebugH2 from "./DebugH2.svelte";
  import DebugH3 from "./DebugH3.svelte";
  import DebugMaterial from "./DebugMaterial.svelte";
  import DebugMatrix from "./DebugMatrix.svelte";
</script>

<DebugH2>Meshes</DebugH2>
<DebugBlock>
  {#each $meshes as { attributes, drawMode, matrix, material }, i}
    <DebugBlock>
      <DebugH3>Mesh {i}</DebugH3>
      <DebugH3>Attributes</DebugH3>
      <DebugBlock>
        {#each Object.entries(attributes) as [key, value]}
          <span>{key}: {value.length}</span>
        {/each}
      </DebugBlock>
      <DebugH3>Draw Mode</DebugH3>
      <span>{drawMode}</span>
      <DebugH3>Matrix</DebugH3>
      <DebugMatrix matrix={get(matrix)} />
      <DebugMaterial {material} />
    </DebugBlock>
  {/each}
</DebugBlock>
