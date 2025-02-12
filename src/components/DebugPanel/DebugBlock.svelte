<script type="module">
  export let level = 1;
</script>

<div class="block level{level}">
  <slot name="title" />
  <div class="content">
    <slot />
  </div>
</div>

<style>
  div.content {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: stretch;
    flex-direction: column;
    gap: var(--panel-vertical-padding);
    padding: var(--panel-vertical-padding) var(--panel-horizontal-padding);
    font-size: 0.9rem;
  }
  div.block.level1 {
    border-top: 2px solid var(--panel-dark-color);
    padding: var(--panel-vertical-padding) var(--panel-horizontal-padding);
  }
  div.block.level2,
  div.block.level3,
  div.block.level4 {
    border-top: 1px solid var(--panel-dark-color);
  }
</style>
