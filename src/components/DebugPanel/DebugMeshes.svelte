<script type="module">
  import { get } from "svelte/store";
  import { meshes } from "../../store/engine-refactor";
  import DebugBlock from "./DebugBlock.svelte";

  import DebugH2 from "./DebugH2.svelte";
  import DebugH3 from "./DebugH3.svelte";
  import DebugMaterial from "./DebugMaterial.svelte";
  import DebugMatrix from "./DebugMatrix.svelte";
</script>

<DebugBlock>
  <DebugH2 slot="title">Meshes</DebugH2>
  {#each $meshes as { attributes, drawMode, matrix, material }, i}
    <DebugBlock level={2}>
      <DebugH3 slot="title">Mesh {i}</DebugH3>
      <DebugBlock level={3}>
        <DebugH3 slot="title">Attributes</DebugH3>
        {#each Object.entries(attributes) as [key, value]}
          <span>{key}: {value.length}</span>
        {/each}
      </DebugBlock>
      <DebugBlock level={3}>
        <DebugH3 slot="title">Draw Mode</DebugH3>
        <span>{drawMode}</span>
      </DebugBlock>
      <DebugBlock level={3}>
        <DebugH3 slot="title">Matrix</DebugH3>
        <DebugMatrix matrix={get(matrix)} />
      </DebugBlock>
      <DebugMaterial {material} />
    </DebugBlock>
  {/each}
</DebugBlock>

<style>
  span {
    padding: 0px 7px;
  }
</style>
