<script>
    import { onMount } from 'svelte';
    import {renderer,webglapp } from './store/engine.js'
    import {createCube} from './geometries/cube.js'
  
    let canvas;
    onMount(() => {
        console.log('mounted',canvas);
        renderer.setCanvas(canvas);
        renderer.setBackgroundColor([0.0,0.0,0.0,1.0]);
        renderer.setCamera(45,0.1,1000,[0, 0, -8], [0, 0, 0], [0, 1, 0]);
        renderer.addMesh({
            attributes:createCube(),
        });
        renderer.addLight([0, 7, -3]);
    })
    $:$webglapp && $webglapp.forEach(instruction => {
        console.log("instruction",instruction);
        instruction()
    });
    $:console.log("$webglapp",$webglapp);

</script>
<canvas bind:this={canvas} ></canvas>