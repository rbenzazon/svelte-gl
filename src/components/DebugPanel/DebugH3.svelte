<h3>
  <slot />
</h3>

<style>
  h3 {
    text-transform: uppercase;
    font-size: 0.8rem;
    color: var(--panel-medium-color);
    /*border-top: 1px solid var(--panel-dark-color);*/
    padding: var(--panel-vertical-padding) var(--panel-horizontal-padding);
  }
  h3:first-child {
    border-top: none;
  }
</style>
