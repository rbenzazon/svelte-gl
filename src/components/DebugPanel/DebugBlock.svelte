<script type="module">
export let level = 1;
export let initialCollapsed = false;
export let collapsed = initialCollapsed;
function toogleCollapse() {
	collapsed = !collapsed;
}
</script>

<div class="block level{level}">
  <button class="title" on:click={toogleCollapse}>
    <span class="toggle" class:collapsed={collapsed} >></span>
    <slot name="title" />
  </button>
  <div class="content" class:collapsed={collapsed}>
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
  button.title{
    display: flex;
    align-items: center;
    justify-content: flex-start;
    background: none;
    border: none;
  }
  div.block.level1 {
    border-top: 2px solid var(--panel-dark-color);
    padding: var(--panel-vertical-padding) calc(var(--panel-horizontal-padding) * 2);
  }
  div.block.level2,
  div.block.level3,
  div.block.level4 {
    border-top: 1px solid var(--panel-dark-color);
  }
  div.content.collapsed {
    display: none;
  }
  span.toggle {
    transform: rotate(90deg);
    padding: 0.2rem;
    
    color: var(--panel-light-color);
    font-family: monospace;
  }
  div.block.level1 span.toggle {
    font-size: 1.4rem;
    padding-top: 0rem;
  }
  div.block.level2 span.toggle {
    font-size: 1rem;
  }
  div.block.level2 span.toggle {
    font-size: 0.8rem;
  }
  span.toggle.collapsed {
    transform: rotate(0deg);
  }
</style>
