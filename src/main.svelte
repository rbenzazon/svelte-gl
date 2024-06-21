<script>
    import { onMount } from 'svelte';
    import {renderer,webglapp,worldMatrix,normalMatrix } from './store/engine.js'
    import {createCube} from './geometries/cube.js'
    import { identity, rotateX, rotateY, rotateZ } from "gl-matrix/esm/mat4.js";
    let canvas;
    onMount(() => {
        renderer.setCanvas(canvas);
        renderer.setBackgroundColor([0.0,0.0,0.0,1.0]);
        renderer.setCamera(45,0.1,1000,[0, 0, -8], [0, 0, 0], [0, 1, 0]);
        renderer.addMesh({
            attributes:createCube(),
        });
        renderer.addLight([0, 7, -3]);
        setTimeout(animate,1000);
    })
    $:if($webglapp){
        $webglapp.forEach(instruction => {
            instruction()
        });
    }
    /* this is necessary to have normalMatrix working cause 
    derived stores without listeners are not reactive */
    $normalMatrix;

    function animate() {
        const rotation = performance.now() / 1000 / 6 * Math.PI;
        const tmp =  new Float32Array(16);
        identity(tmp);
        rotateY(tmp,tmp,rotation);
        rotateX(tmp,tmp,rotation);
        rotateZ(tmp,tmp,rotation);
        $worldMatrix = tmp; 
        requestAnimationFrame(animate);
    }

</script>
<canvas bind:this={canvas} ></canvas>