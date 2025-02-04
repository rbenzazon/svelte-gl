<script type="module">
import { get } from "svelte/store";
import { renderer, camera, meshes, lights } from "./store/engine-refactor.js";

function linearArrayToCSSHashColor(array) {
	return array.map((num) => Math.floor(num * 255)).reduce((acc, num) => acc + num.toString(16).padStart(2, "0"), "#");
}
function hexNumToCSSStringColor(hex) {
	return "#" + hex.toString(16).padStart(6, "0");
}
const colorProps = ["diffuse"];
function collapse() {
	collapsed = !collapsed;
}
let collapsed = true;
</script>
<div on:click={collapse} class="openButton" class:collapsed="{!collapsed}">{'<<'}</div>
<div class="panel" class:collapsed>
    <div class="panelContent" >
    <button class="closeButton" on:click={collapse}>{'>>'}</button>
    <p>Renderer</p>
    <div class="renderer">
        <p>Background Color</p>
        <input type="color" value={hexNumToCSSStringColor($renderer.backgroundColor)} />
        <p>Ambient Light Color</p>
        <input type="color" value={hexNumToCSSStringColor($renderer.ambientLightColor[0])} />
        <p>Ambient Light Alpha</p>
        <input type="range" min="0" max="1" step="0.01" value={$renderer.ambientLightColor[1]} />
        <p>Processed</p>
        {#each Object.entries(renderer.processed) as [key, value]}
            <p>{key}: {value}</p>
        {/each}
    </div>
    <p>Camera</p>
    <div class="camera">
        <p>Position</p>
        <p>{$camera.position}</p>
        <p>Target</p>
        <p>{$camera.target}</p>
        <p>FOV</p>
        <input type="range" min="0" max="180" step="1" value={$camera.fov} />
    </div>
    <p>Meshes</p>
    <div class="meshes">
        {#each $meshes as {attributes, drawMode, matrix, material}, i}
            <div class="mesh">
                <p>Mesh {i}</p>
                <p>Attributes</p>
                <div class="attributes">
                    {#each Object.entries(attributes) as [key, value]}
                        <p>{key}: {value.length}</p>
                    {/each}
                </div>
                <p>Draw Mode</p>
                <p>{drawMode}</p>
                <p>Matrix</p>
                {#each matrix as num}
                    <p>{num}</p>
                {/each}
                <p>Material</p>
                
                {#each Object.entries(material) as [key, value]}
                    {#if key.includes("Map")}
                        <a href={'./'+value.url}>{key}</a>
                    {:else if colorProps.some(c=>c===key)}
                        <p>{key}</p>
                        <input type="color" value={linearArrayToCSSHashColor(value)} />
                    {:else}
                        <p>{key}: {value}</p>
                    {/if}
                {/each}
            </div>
        {/each}
    </div>
    <p>Lights</p>
        <div class="lights">
            {#each $lights as light, i}
                <div class="light">
                    <p>Light {i}</p>
                    <p>Color</p>
                    <input type="color" value={linearArrayToCSSHashColor(get(light).color)} />
                    <p>Intensity</p>
                    <input type="range" min="0" max="10" step="0.1" value={get(light).intensity} />
                    <p>Position</p>
                    <p>{get(light).position}</p>
                    <p>Cutoff Distance</p>
                    <input type="range" min="0" max="30" step="0.1" value={get(light).cutoffDistance} />
                    <p>Decay Exponent</p>
                    <input type="range" min="0" max="5" step="0.1" value={get(light).decayExponent} />
                </div>
            {/each}
        </div>
    </div>
</div>
<style>
    .panel {
        position: absolute;
        top: 0;
        right: 0;
        width: 300px;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        color: white;
        overflow-y: auto;
    }
    .panelContent {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: left;
        gap: 20px;
        padding: 20px;
    }
    .collapsed {
        display: none !important;
    }
    .closeButton {
        /*remove button style*/
        background: none;
        border: none;
        color: inherit;
        cursor: pointer;
    }
    .openButton {
        position: absolute;
        top: 0;
        right: 0;
        width: 50px;
        height: 50px;
        background-color: rgba(0, 0, 0, 0.5);
        color: white;
        display: flex;
        justify-content: center;
        align-items: center;
        cursor: pointer;
    }
    .renderer {
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: left;
        flex-direction: column;
        gap: 10px;
        padding: 20px;
    }
    .camera {
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: left;
        flex-direction: column;
        gap: 20px;
        padding: 20px;
    }
    .meshes {
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: left;
        flex-direction: column;
        gap: 20px;
        padding: 20px;
    }
    
    .mesh {
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: left;
        flex-direction: column;
        gap: 10px;
    }
    .attributes {
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: left;
        flex-direction: column;
        gap: 10px;
        padding: 20px;
    }
    a {
        color: white;
    }
    .lights {
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: left;
        flex-direction: column;
        gap: 20px;
        padding: 20px;
    }
    .light {
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: left;
        flex-direction: column;
        gap: 10px;
    }
</style>