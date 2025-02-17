<script type="module">
import { createEventDispatcher } from "svelte";
export let label;
export let value;
export let min;
export let max;
export let step;
const dispatch = createEventDispatcher();
function onChange(event) {
	dispatch("change", {
		number: parseFloat(event.target.value),
	});
}
</script>

<div>
  <span>{label}</span>
  <input type="number" {min} {max} {step} {value} on:change={onChange} />
</div>

<style>
  div {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 2px;
    border-radius: 0.3125rem;
    background-color: var(--panel-dark-color);
    overflow: hidden;
    padding: var(--panel-horizontal-padding) var(--panel-vertical-padding);
  }
  input[type="number"] {
    flex: 1;

    color: var(--panel-light-color);
    background-color: var(--panel-dark-color);
    font-size: 0.8rem;
    border: none;
    width: 0;
  }
  span {
    flex: 0.2;
    text-transform: capitalize;
    font-size: 0.7rem;
    color: var(--panel-medium-light-color);
  }
</style>
