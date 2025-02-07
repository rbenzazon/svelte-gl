<h3>
  <slot />
</h3>

<style>
  h3 {
    text-transform: uppercase;
    font-size: 0.9rem;
    color: var(--panel-light-color);
    border-top: 1px solid var(--panel-dark-color);
    padding: 5px 7px 2px 7px;
  }
  h3:first-child {
    border-top: none;
  }
</style>
