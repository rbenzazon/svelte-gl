<script type="module">
export let padding = 0;
</script>

<h4 class={"padding" + padding}>
  <slot />
</h4>

<style>
  h4 {
    text-transform: uppercase;
    font-size: 0.7rem;
    color: var(--panel-medium-color);
    padding: calc(var(--panel-horizontal-padding) / 2) 0px calc(var(--panel-horizontal-padding) / 2) 0px;
    flex: 1;
  }
  .padding0 {
    padding-left: 0px;
  }
  .padding1 {
    padding-left: 7px;
  }
  .padding2 {
    padding-left: 14px;
  }
  .padding3 {
    padding-left: 21px;
  }
</style>
