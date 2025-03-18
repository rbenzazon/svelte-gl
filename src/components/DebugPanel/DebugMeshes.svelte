<script type="module">
import { get } from "svelte/store";
import { scene } from "../../store/scene";
import DebugBlock from "./DebugBlock.svelte";

import DebugH2 from "./DebugH2.svelte";
import DebugH3 from "./DebugH3.svelte";
import DebugMaterial from "./DebugMaterial.svelte";
import DebugMatrix from "./DebugMatrix.svelte";
import DebugH4 from "./DebugH4.svelte";
</script>

<DebugBlock>
  <DebugH2 slot="title">Meshes</DebugH2>
  {#each $scene as { attributes, drawMode, matrix,matrices, material,instances }, i}
    <DebugBlock level={2}>
      <DebugH3 slot="title">Mesh {i}</DebugH3>
      <DebugBlock level={3} initialCollapsed={true}>
        <DebugH4 slot="title">Attributes</DebugH4>
        {#each Object.entries(attributes) as [key, value]}
          <span>{key}: {value.length}</span>
        {/each}
      </DebugBlock>
      <DebugBlock level={3}>
        <DebugH4 slot="title">Draw Mode</DebugH4>
        <span>{drawMode}</span>
      </DebugBlock>
      {#if instances}
      <DebugBlock level={3}>
        <DebugH4 slot="title">Instances</DebugH4>
        <span>{instances}</span>
      </DebugBlock>
      {/if}
      {#if matrix}
      <DebugBlock level={3}>
        <DebugH4 slot="title">Matrix</DebugH4>
        <DebugMatrix matrix={matrix.value} />
      </DebugBlock>
      {:else if matrices}
      <DebugBlock level={3} initialCollapsed={true}>
        <DebugH4 slot="title">Matrices</DebugH4>
        {#each matrices.windows as matrix}
          <DebugMatrix matrix={matrix} />
        {/each}
      </DebugBlock>
      {/if}
      <DebugMaterial {material} />
    </DebugBlock>
  {/each}
</DebugBlock>

<style>
  span {
    padding: 0px 7px;
  }
</style>
