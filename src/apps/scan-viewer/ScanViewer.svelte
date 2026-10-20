<script>
import { onDestroy, onMount, setContext } from "svelte";
import { get } from "svelte/store";
import { createOrbitControls } from "../../interactivity/orbit-controls.js";
import { getToneMapping, hdrToCube } from "../../loaders/hdr-to-cube.js";
import { createEngine } from "../../store/engine.js";
import { createSkyBox } from "../../store/skybox.js";
import { createEnvironmentMap } from "../../texture/environment-map.js";
import { createEnvMapTexture } from "../../texture/environment-map-texture.js";
import { createHeightGrid } from "./height-grid.js";
import { createRigLights, defaultLights } from "./light-rig.js";
import { createPointsProgram } from "./points.js";
import { createSceneUniforms } from "./scene-uniforms.js";
import { createSurface, createSurfaceMaterial } from "./surface.js";

export let background = [1, 1, 1, 1];

// Data X stays world X, data Y goes to world -Z and data Z (height) goes to world Y.
const axisSwap = new Float32Array([1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1]);
const fov = 40;
const skyboxCubeSize = 1024;
const defaultAmbient = 0.6;

let canvas;
let controls;
let layerInputs = [];
// Height grid of each layer id; layers given the same distanceData array share one.
let grids = new Map();
let zScale = 1;
let halfSize = [1, 1];
let homeView = null;
let framed = false;
let lightRig = { lights: defaultLights, attached: "camera" };
let environment = null;
let environmentRequest = 0;
// Env map texture the surface materials are built with, undefined without env lighting.
let envMap;
const engine = createEngine();
const sceneUniforms = createSceneUniforms();
setContext("svelte-gl", engine);

export function setBackground(rgba) {
	engine.renderer.update((renderer) => ({ ...renderer, backgroundColor: rgba }));
}

export function setAmbient(intensity = defaultAmbient, color = [1, 1, 1]) {
	engine.renderer.update((renderer) => ({ ...renderer, ambientLightColor: [color, intensity] }));
}

export function resize() {
	engine.renderer.resize();
}

export function setLayers(inputs) {
	for (const grid of new Set(grids.values())) {
		grid.heights.destroy();
	}
	layerInputs = inputs.filter((input) => input.kind === "surface" || input.kind === "points");
	const byData = new Map();
	grids = new Map(
		layerInputs.map(({ id, data }) => {
			if (!byData.has(data.distanceData)) {
				byData.set(data.distanceData, createHeightGrid(data, sceneUniforms));
			}
			return [id, byData.get(data.distanceData)];
		}),
	);
	const { min, max } = getBounds(layerInputs);
	const center = min.map((value, i) => (value + max[i]) / 2);
	sceneUniforms.setOrigin(center);
	halfSize = [(max[0] - min[0]) / 2 || 1, (max[1] - min[1]) / 2 || 1];
	// Layer changes do not move the camera; only the first data frames it.
	if (!framed) {
		frame(Math.hypot(max[0] - min[0], max[1] - min[1], (max[2] - min[2]) * zScale) / 2 || 1);
		framed = layerInputs.length > 0;
	}
	applyLights();
	buildScene();
}

function buildScene() {
	const materials = [];
	const meshes = [];
	for (const input of layerInputs) {
		const grid = grids.get(input.id);
		if (input.kind === "surface") {
			const surface = createSurface(grid);
			const material = engine.createMaterial({ ...createSurfaceMaterial(input.material), ...(envMap && { envMap }) });
			materials.push(material);
			meshes.push(
				engine.createObject({
					attributes: {},
					vertexCount: surface.vertexCount,
					drawMode: "TRIANGLES",
					matrix: axisSwap,
					material,
					animations: [surface.animation],
				}),
			);
		} else {
			const style = { color: input.color, pointSize: input.pointSize };
			const material = engine.createMaterial({ program: createPointsProgram(grid, style, engine.ctx) });
			materials.push(material);
			meshes.push(
				engine.createObject({
					attributes: {},
					vertexCount: grid.imageW * grid.imageH,
					drawMode: "POINTS",
					matrix: axisSwap,
					material,
				}),
			);
		}
	}
	engine.materials.set(materials);
	engine.scene.set(meshes);
}

export async function setEnvironment(image, { skybox = false, skyboxBlur = 0, envLighting = false } = {}) {
	const request = ++environmentRequest;
	const next = image === environment?.image ? environment : image && (await createEnvironment(image));
	// A newer call won while the skybox was being created.
	if (request !== environmentRequest) {
		return;
	}
	if (next !== environment) {
		destroyEnvironment(environment);
		environment = next;
	}
	environment?.skyBox.setLod(skyboxBlur * Math.log2(skyboxCubeSize));

	// The PMREM pass runs once then removes itself from the passes.
	const pmremPending = envLighting && environment && !environment.pmrem.getTexture();
	const passes = [...(skybox && environment ? [environment.skyBox] : []), ...(pmremPending ? [environment.pmrem] : [])];
	const current = get(engine.renderPasses);
	if (passes.length !== current.length || passes.some((pass, i) => pass !== current[i])) {
		engine.renderPasses.set(passes);
	}

	const nextEnvMap = envLighting ? environment?.envMap : undefined;
	if (nextEnvMap !== envMap) {
		envMap = nextEnvMap;
		buildScene();
	}
	engine.invalidate();
}

async function createEnvironment(image) {
	const { width, height, data } = image;
	const skyBox = await createSkyBox({
		typedArray: data,
		convertToCube: hdrToCube,
		width,
		height,
		cubeSize: skyboxCubeSize,
		toneMapping: getToneMapping(1),
		renderer: engine.renderer,
	});
	const pmrem = createEnvironmentMap(image, width, height, engine.renderPasses);
	const envMapTexture = createEnvMapTexture({
		envMap: pmrem.getTexture,
		width: pmrem.width,
		height: pmrem.height,
		lodMax: pmrem.lodMax,
	});
	return { image, skyBox, pmrem, envMap: envMapTexture };
}

function destroyEnvironment(previous) {
	const { gl } = engine.ctx;
	if (!previous || !gl) {
		return;
	}
	gl.deleteTexture(previous.skyBox.getTexture() ?? null);
	gl.deleteTexture(previous.pmrem.getTexture() ?? null);
}

export function setLights(lights, attached = "camera") {
	lightRig = { lights, attached };
	applyLights();
}

function applyLights() {
	if (!homeView) {
		return;
	}
	const values = createRigLights(lightRig.lights, lightRig.attached, halfSize, homeView);
	const current = get(engine.lights);
	// Programs keep the light stores they were built with, so an update with the same count reuses them.
	if (current.length === values.length) {
		current.forEach((light, i) => light.set(values[i]));
	} else {
		engine.lights.set(values.map((value) => engine.createLight(value)));
	}
}

export function updateLayerData(id, data) {
	grids.get(id)?.heights.update(data);
	engine.invalidate();
}

export function setZScale(scale) {
	zScale = scale;
	sceneUniforms.setZScale(scale);
	engine.invalidate();
}

function getBounds(inputs) {
	const min = [0, 0, 0];
	const max = [0, 0, 0];
	inputs.forEach(({ data }, index) => {
		let zMin = Number.POSITIVE_INFINITY;
		let zMax = Number.NEGATIVE_INFINITY;
		for (const z of data.distanceData) {
			if (z < zMin) zMin = z;
			if (z > zMax) zMax = z;
		}
		const box = [Math.min(data.x0, data.x1), Math.min(data.y0, data.y1), zMin];
		const boxMax = [Math.max(data.x0, data.x1), Math.max(data.y0, data.y1), zMax];
		for (let i = 0; i < 3; i++) {
			min[i] = index === 0 ? box[i] : Math.min(min[i], box[i]);
			max[i] = index === 0 ? boxMax[i] : Math.max(max[i], boxMax[i]);
		}
	});
	return { min, max };
}

function frame(radius) {
	const distance = radius / Math.sin((fov * Math.PI) / 360);
	// Seen from the -Y side of the data, above it and a little to the left.
	const direction = [-0.5, 0.9, 1];
	const length = Math.hypot(...direction);
	engine.camera.set({
		...get(engine.camera),
		position: direction.map((value) => (value / length) * distance),
		target: [0, 0, 0],
		fov,
		near: distance / 100,
		far: distance * 10,
	});
	homeView = engine.camera.view;
}

onMount(() => {
	engine.renderer.update((renderer) => ({
		...renderer,
		canvas,
		backgroundColor: background,
		ambientLightColor: [[1, 1, 1], defaultAmbient],
		enabled: true,
	}));
	// Temporary camera interaction until the turntable controls of step 6.1.
	controls = createOrbitControls(canvas, engine.camera);
});

onDestroy(() => {
	controls?.destroy();
	engine.destroy();
});
</script>

<canvas bind:this={canvas}></canvas>

<style>
	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
</style>
