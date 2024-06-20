<script>
    import {counter,title} from './store.js'

</script>
{$title}
<button on:click={counter.increment}>{$counter}</button>
