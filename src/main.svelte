<script>
    import { onMount } from 'svelte';
    import {renderer,webglapp,worldMatrix } from './store/engine.js'
    import {createCube} from './geometries/cube.js'
    import { identity, rotateY } from "gl-matrix/esm/mat4.js";
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
        setTimeout(animate,1000);
    })
    $:if($webglapp){
        console.log('webglapp');
        $webglapp.forEach(instruction => {
            console.log('webglapp',instruction);
            instruction()
        });
    }

    function animate() {
        console.log('animate');
        const rotation = performance.now() / 1000 / 6 * Math.PI;
        const tmp =  new Float32Array(16);
        identity(tmp);
        rotateY(tmp,tmp,rotation);
        worldMatrix.set(tmp); 
        requestAnimationFrame(animate);
        //renderer.render();
    }

</script>
<canvas bind:this={canvas} ></canvas>