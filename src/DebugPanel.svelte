<script type="module">
import { get } from "svelte/store";
import { renderer, camera, meshes, lights } from "./store/engine-refactor.js";

function linearArrayToCSSHashColor(array) {
	return array.map((num) => Math.floor(num * 255)).reduce((acc, num) => acc + num.toString(16).padStart(2, "0"), "#");
}
function hexNumToCSSStringColor(hex) {
	return "#" + hex.toString(16).padStart(6, "0");
}
function cssStringColorToHexNum(color) {
	return parseInt(color.slice(1), 16);
}
function cssStringColorToLinearArray(color) {
	return [
		parseInt(color.slice(1, 3), 16) / 255,
		parseInt(color.slice(3, 5), 16) / 255,
		parseInt(color.slice(5, 7), 16) / 255,
	];
}
const colorProps = ["diffuse"];
function collapse() {
	collapsed = !collapsed;
}
let collapsed = false;
function onBGColorChange(e) {
	$renderer = { ...$renderer, backgroundColor: cssStringColorToHexNum(e.currentTarget.value) };
}
function onAColorChange(e) {
	$renderer = {
		...$renderer,
		ambientLightColor: [cssStringColorToHexNum(e.currentTarget.value), $renderer.ambientLightColor[1]],
	};
}
function onAIntensityChange(e) {
	$renderer = { ...$renderer, ambientLightColor: [$renderer.ambientLightColor[0], e.currentTarget.value] };
}
function onCameraXPositionChange(e) {
	$camera = { ...$camera, position: [e.currentTarget.value, $camera.position[1], $camera.position[2]] };
}
function onCameraYPositionChange(e) {
	$camera = { ...$camera, position: [$camera.position[0], e.currentTarget.value, $camera.position[2]] };
}
function onCameraZPositionChange(e) {
	$camera = { ...$camera, position: [$camera.position[0], $camera.position[1], e.currentTarget.value] };
}
function onCameraXTargetChange(e) {
	$camera = { ...$camera, target: [e.currentTarget.value, $camera.target[1], $camera.target[2]] };
}
function onCameraYTargetChange(e) {
	$camera = { ...$camera, target: [$camera.target[0], e.currentTarget.value, $camera.target[2]] };
}
function onCameraZTargetChange(e) {
	$camera = { ...$camera, target: [$camera.target[0], $camera.target[1], e.currentTarget.value] };
}
function onCameraFOVChange(e) {
	$camera = { ...$camera, fov: e.currentTarget.value };
}
function onLightColorChange(e, light) {
	console.log(cssStringColorToLinearArray(e.currentTarget.value));
	light.set({
		...get(light),
		color: cssStringColorToLinearArray(e.currentTarget.value),
	});
}
function onLightIntensityChange(e, light) {
	light.set({
		...get(light),
		intensity: e.currentTarget.value,
	});
}
</script>
<div on:click={collapse} class="openButton" class:collapsed="{!collapsed}">{'<<'}</div>
<div class="panel" class:collapsed>
    <div class="panelContent" >
    <button class="closeButton" on:click={collapse}>{'>>'}</button>
    <p>Renderer</p>
    <div class="renderer">
        <p>Background Color</p>
        <input type="color" value={hexNumToCSSStringColor($renderer.backgroundColor)} on:change={onBGColorChange}/>
        <p>Ambient Light Color</p>
        <input type="color" value={hexNumToCSSStringColor($renderer.ambientLightColor[0])} on:change={onAColorChange}/>
        <p>Ambient Light Intensity</p>
        <div class="row">
            <input type="range" min="0" max="1" step="0.01" value={$renderer.ambientLightColor[1]} on:change={onAIntensityChange}/>
            <input type="number" min="0" max="1" step="0.01" value={$renderer.ambientLightColor[1]} on:change={onAIntensityChange}/>
        </div>
    </div>
    <p>Camera</p>
    <div class="camera">
        <p>Position</p>
        <div class="row">
            <p>x</p><input type="number" value={$camera.position[0]} on:change={onCameraXPositionChange}/>
            <p>y</p><input type="number" value={$camera.position[1]} on:change={onCameraYPositionChange}/>
            <p>z</p><input type="number" value={$camera.position[2]} on:change={onCameraZPositionChange}/>
        </div>
        <p>Target</p>
        <div class="row">
            <p>x</p><input type="number" value={$camera.target[0]} on:change={onCameraXTargetChange}/>
            <p>y</p><input type="number" value={$camera.target[1]} on:change={onCameraYTargetChange}/>
            <p>z</p><input type="number" value={$camera.target[2]} on:change={onCameraZTargetChange}/>
        </div>
        <p>FOV</p>
        <div class="row"><input type="range" min="0" max="180" step="1" value={$camera.fov} on:change={onCameraFOVChange} /><input type="number" value={$camera.fov} on:change={onCameraFOVChange} /></div>
        
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
                    <input type="color" value={linearArrayToCSSHashColor(get(light).color)} on:change={(e)=>onLightColorChange(e,light)} />
                    <p>Intensity</p>
                    <div class="row">
                        <input type="range" min="0" max="10" step="0.1" value={get(light).intensity} on:change={(e)=>onLightIntensityChange(e,light)} />
                        <input type="number" min="0" max="10" step="0.1" value={get(light).intensity} on:change={(e)=>onLightIntensityChange(e,light)} />
                    </div>
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
        font-family: Arial, sans-serif;
        position: absolute;
        top: 0;
        right: 0;
        width: 350px;
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
    .row {
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: left;
        gap: 10px;
    }
    .row input[type="number"] {
        flex: 1 1 auto;
        border: none;
        width: 0;
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