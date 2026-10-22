<script>
import { onDestroy, onMount, setContext } from "svelte";
import { get } from "svelte/store";
import { createOrbitControls } from "../../interactivity/orbit-controls.js";
import { getToneMapping, hdrToCube } from "../../loaders/hdr-to-cube.js";
import { createEngine } from "../../store/engine.js";
import { createSkyBox } from "../../store/skybox.js";
import { createEnvironmentMap } from "../../texture/environment-map.js";
import { createEnvMapTexture } from "../../texture/environment-map-texture.js";
import { scale } from "gl-matrix/esm/mat4.js";
import { convertToVector3 } from "../../color/color-space.js";
import { createSpecular } from "../../material/specular/specular.js";
import { animateCamera } from "./camera-animation.js";
import { createGizmoArrows, hitGizmo } from "./gizmo.js";
import { createHeightGrid } from "./height-grid.js";
import {
	clearLabelMetrics,
	createProjector,
	drawPlacedLabels,
	hideOverlaps,
	layoutLabels,
	prepareLabelCanvas,
} from "./labels.js";
import { createRigLights, defaultLights } from "./light-rig.js";
import { boxEdges, createLinesProgram } from "./lines.js";
import { createPalette } from "./palette.js";
import { createPickRay } from "./pick-ray.js";
import { createPointCloud } from "./point-cloud.js";
import { pickPointTree } from "./point-tree.js";
import { createPointsProgram } from "./points.js";
import { createRulerProgram, layoutRulers } from "./rulers.js";
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
// Height grid or point cloud of each layer id; layers given the same distanceData array share one grid.
let sources = new Map();
// Material and mesh of each layer id.
let built = new Map();
// Union of the layer bounds, in data units.
let sceneBounds = { min: [0, 0, 0], max: [0, 0, 0] };
let showBoundingBox = false;
// Material and mesh of the bounding box outline, created when first shown.
let boundingBox = null;
// Kalea's light theme graph-border-subdued and graph-border.
let borderSubdued = convertToVector3("#b9c1cf");
let border = convertToVector3("#748a99");
let showRulers = true;
// Major steps along an ideal 700 CSS px ruler, as GraphView's graduationDensity.
let rulerDensity = 7;
// Material, mesh and current layout of the x, y and z rulers.
let rulers = null;
let showGizmo = true;
// Camera and the material and mesh of each axis arrow, created when first shown.
let gizmo = null;
// Axis (0, 1, 2) of the arrow under the pointer, and the arrow pressed with its viewer point, or null.
let gizmoHover = null;
let gizmoPress = null;
let axisColors = ["#e5484d", "#46a758", "#3e63dd"];
// Half the data diagonal (heights times zScale), as framed.
let sceneRadius = 1;
let labelCanvas;
let labelStyle = { font: '11px "IBM Plex Sans", sans-serif', color: "#b9c1cf" };
let labelsDirty = true;
// Placement state of each label between frames, for the hysteresis.
const labelMemory = new Map();
let zScale = 1;
let halfSize = [1, 1];
let homeView = null;
let framed = false;
let cancelCameraAnimation = () => {};
let cameraAnimation = true;
let lightRig = { lights: defaultLights, attached: "camera" };
let environment = null;
let environmentRequest = 0;
// Env map texture the surface materials are built with, undefined without env lighting.
let envMap;
// Undefined bounds fall back to the auto range, each on its own.
let colorRange = { min: undefined, max: undefined };
let outOfRange = "clamp";
let autoRange = [0, 1];
const listeners = new Map();
const engine = createEngine();
const sceneUniforms = createSceneUniforms();
const palette = createPalette();
setContext("svelte-gl", engine);
const unsubscribeCamera = engine.camera.subscribe(() => {
	syncGizmoCamera();
	invalidateLabels();
});
loadLabelFont();

function invalidateLabels() {
	labelsDirty = true;
}

// A web font only loads once used: canvas text would keep the fallback font without a redraw after the load.
function loadLabelFont() {
	const loaded = () => {
		clearLabelMetrics();
		invalidateLabels();
	};
	document.fonts?.load(labelStyle.font).then(loaded, loaded);
}

/** Resolved CSS values: { font, color }, for example from getComputedStyle on a styled probe element. */
export function setLabelStyle(style) {
	labelStyle = { ...labelStyle, ...style };
	loadLabelFont();
	invalidateLabels();
}

// Called by the render loop every frame, after the canvas resize and before the WebGL draw of that frame:
// the ruler layout set here is drawn in this same frame.
function renderOverlay() {
	if (!labelsDirty || !labelCanvas) {
		return;
	}
	labelsDirty = false;
	const { context, viewport } = prepareLabelCanvas(labelCanvas, canvas);
	if (layerInputs.length === 0) {
		labelMemory.clear();
		return;
	}
	const origin = sceneUniforms.getOrigin();
	const labelView = {
		projection: engine.camera.projection,
		view: engine.camera.view,
		model: axisSwap,
		origin,
		zScale,
	};
	// Gizmo labels first: they win the overlap hiding.
	const labels = showGizmo ? gizmoLabels(viewport) : [];
	if (showRulers) {
		const layouts = layoutRulers(
			sceneBounds,
			origin,
			cameraDataPosition(),
			createProjector(labelView, viewport),
			rulerDensity,
		);
		getRulers().forEach((ruler, axis) => {
			ruler.layout = layouts[axis];
			ruler.mesh.vertexCount = layouts[axis].vertexCount;
		});
		labels.push(...layouts.flatMap((layout) => layout.labels));
	}
	const placed = layoutLabels(context, labels, labelView, viewport, labelStyle, labelMemory);
	drawPlacedLabels(context, hideOverlaps(placed));
}

// Bottom left corner of the viewer, CSS px from the bottom left: [x, y, width, height].
function gizmoRect() {
	return [12, 12, 80, 80];
}

// Arrows sized to the data, so the gizmo sits where the data does in the home view and gets the same lighting.
function gizmoMatrix() {
	const size = 0.95 * sceneRadius;
	return scale(new Float32Array(16), axisSwap, [size, size, size]);
}

// Looks at the arrows from the main camera direction, at the home view distance (see frame).
function syncGizmoCamera() {
	if (!gizmo) {
		return;
	}
	const { position, target, up } = get(engine.camera);
	const direction = position.map((value, i) => value - target[i]);
	const length = Math.hypot(...direction) || 1;
	const distance = sceneRadius / Math.sin((fov * Math.PI) / 360);
	gizmo.camera.set({
		position: direction.map((value) => (value / length) * distance),
		target: [0, 0, 0],
		up,
		fov,
		near: distance / 100,
		far: distance * 10,
		aspect: 1,
		projection: "perspective",
	});
}

function getGizmo() {
	if (!gizmo) {
		gizmo = { camera: engine.createCamera(), layers: [] };
		syncGizmoCamera();
		const viewport = { camera: gizmo.camera, rect: gizmoRect };
		gizmo.layers = createGizmoArrows().map((arrow, axis) => {
			const material = engine.createMaterial({
				diffuse: convertToVector3(axisColors[axis]),
				metalness: 0,
				specular: createSpecular({ roughness: 0.4 }),
				viewport,
			});
			const mesh = engine.createObject({ ...arrow, matrix: gizmoMatrix(), material }, { camera: gizmo.camera });
			return { material, mesh };
		});
	}
	return gizmo.layers;
}

// Unit direction from the target toward the camera, in data axes (the axis swap undone).
function cameraDataDirection() {
	const { position, target } = get(engine.camera);
	const [x, y, z] = position.map((value, i) => value - target[i]);
	const length = Math.hypot(x, y, z) || 1;
	return [x / length, -z / length, y / length];
}

// The gizmo rect as [left, top, width, height], viewer CSS px from the top left.
function gizmoScreenRect(viewerHeight) {
	const [x, y, width, height] = gizmoRect();
	return [x, viewerHeight - y - height, width, height];
}

// The arrow origin, tips and label points projected with the gizmo camera (see GizmoScreenPoints):
// one source for the labels and the hit test, so they always agree.
function gizmoScreenPoints(viewerHeight) {
	const [left, top, width, height] = gizmoScreenRect(viewerHeight);
	const project = createProjector(
		{ projection: gizmo.camera.projection, view: gizmo.camera.view, model: gizmoMatrix(), origin: [0, 0, 0], zScale: 1 },
		[width, height],
	);
	const at = (axis, length) => {
		const position = [0, 0, 0];
		position[axis] = length;
		const [x, y] = project(position) ?? [width / 2, height / 2];
		return [left + x, top + y];
	};
	const facing = cameraDataDirection();
	return {
		origin: at(0, 0),
		axes: [0, 1, 2].map((axis) => ({ tip: at(axis, 1), label: at(axis, 1.15), facing: facing[axis] })),
	};
}

// The axis arrow under a viewer point (CSS px from the top left), or null.
function gizmoAxisAt(point) {
	if (!showGizmo || !gizmo || layerInputs.length === 0 || !canvas) {
		return null;
	}
	const height = canvas.clientHeight;
	return hitGizmo(gizmoScreenPoints(height), gizmoScreenRect(height), point);
}

// X, Y and Z beyond the arrow tips, in the axis colors; the hovered one on a badge of its color.
function gizmoLabels([, height]) {
	if (!gizmo) {
		return [];
	}
	return gizmoScreenPoints(height).axes.map(({ label }, axis) => {
		const color = cssColor(axisColors[axis]);
		const hovered = axis === gizmoHover;
		return {
			id: `gizmo-${axis}`,
			text: "XYZ"[axis],
			screen: label,
			align: "center",
			baseline: "middle",
			style: { color: hovered ? cssColor(background.slice(0, 3)) : color },
			...(hovered && { badge: color }),
		};
	});
}

function viewerPoint(event) {
	const rect = canvas.getBoundingClientRect();
	return [event.clientX - rect.left, event.clientY - rect.top];
}

function setGizmoHover(axis) {
	if (axis === gizmoHover) {
		return;
	}
	gizmoHover = axis;
	canvas.style.cursor = axis == null ? "" : "pointer";
	invalidateLabels();
}

function onPointerMove(event) {
	setGizmoHover(gizmoAxisAt(viewerPoint(event)));
}

function onPointerDown(event) {
	// The user taking over the camera stops an animated view change.
	cancelCameraAnimation();
	const point = viewerPoint(event);
	const axis = gizmoAxisAt(point);
	gizmoPress = axis == null ? null : { axis, point };
	if (axis != null) {
		// No compatibility mousedown: the orbit controls do not start a drag from the gizmo.
		event.preventDefault();
	}
}

function onPointerUp(event) {
	const press = gizmoPress;
	gizmoPress = null;
	const point = viewerPoint(event);
	const moved = press && Math.hypot(point[0] - press.point[0], point[1] - press.point[1]);
	if (press && moved < 4 && gizmoAxisAt(point) === press.axis) {
		// Its arrow toward the viewer; already seen along it, from the opposite side.
		const sign = cameraDataDirection()[press.axis] > 0.999 ? "-" : "+";
		snapTo(`${sign}${"xyz"[press.axis]}`);
	}
}

function onPointerLeave() {
	gizmoPress = null;
	setGizmoHover(null);
}

// A theme Color ([r, g, b] in 0..1 or a CSS string) as a CSS color.
function cssColor(color) {
	return Array.isArray(color) ? `rgb(${color.map((c) => Math.round(c * 255)).join(",")})` : color;
}

/** Shows the view orientation gizmo in the bottom left corner, default true. */
export function setGizmo(visible) {
	showGizmo = visible;
	setGizmoHover(null);
	invalidateLabels();
	commitScene();
}

/**
 * Screen point (CSS px from the top left of the viewer) to the data under it, or null.
 * For now unorganized point clouds only: the ray against a local mesh of the points around it, interpolated
 * in the triangle under the cursor; the hit nearest to the camera wins across layers.
 */
export function pick(screenX, screenY) {
	const viewport = [canvas?.clientWidth ?? 0, canvas?.clientHeight ?? 0];
	// The gizmo arrows cover the data behind them.
	if (!homeView || viewport[0] === 0 || viewport[1] === 0 || gizmoAxisAt([screenX, screenY]) != null) {
		return null;
	}
	const matrices = { projection: engine.camera.projection, view: engine.camera.view, model: axisSwap };
	const ray = createPickRay(matrices, viewport, [screenX, screenY]);
	const sceneOrigin = sceneUniforms.getOrigin();
	let best = null;
	for (const input of layerInputs) {
		const source = sources.get(input.id);
		if (input.kind !== "points" || !source.cloud) {
			continue;
		}
		// The tree works in the cloud's own coordinates, heights times zScale.
		const offset = source.origin.map((value, i) => (value - sceneOrigin[i]) * (i === 2 ? zScale : 1));
		const cloudRay = { origin: ray.origin.map((value, i) => value - offset[i]), direction: ray.direction, zScale };
		const hit = pickPointTree(source.getTree(), source.xyz, cloudRay);
		if (hit && (!best || hit.t < best.hit.t)) {
			best = { hit, input, source };
		}
	}
	if (!best) {
		return null;
	}
	const { hit, input, source } = best;
	// Real data coordinates interpolated in the triangle around the cursor.
	const world = [0, 1, 2].map(
		(i) => hit.indices.reduce((sum, index, k) => sum + hit.weights[k] * source.xyz[index * 3 + i], 0) + source.origin[i],
	);
	// The corner with the largest weight is the one nearest to the hit.
	const nearest = hit.indices[hit.weights.indexOf(Math.max(...hit.weights))];
	const [x, y] = createProjector({ ...matrices, origin: sceneOrigin, zScale }, viewport)(world) ?? [screenX, screenY];
	return {
		layerId: input.id,
		kind: "points",
		screen: { x, y },
		world: { x: world[0], y: world[1], z: world[2] },
		value: world[2],
		index: nearest,
		sampleValue: source.xyz[nearest * 3 + 2] + source.origin[2],
	};
}

// World is the scene axes swapped (see axisSwap) with z scaled, relative to the scene origin.
function cameraDataPosition() {
	const [x, y, z] = get(engine.camera).position;
	const origin = sceneUniforms.getOrigin();
	return [origin[0] + x, origin[1] - z, origin[2] + y / zScale];
}

// Material and mesh of the x, y and z rulers, created when first shown; the layout is set by renderOverlay.
function getRulers() {
	if (!rulers) {
		rulers = [0, 1, 2].map(() => {
			const ruler = { layout: { vertexCount: 0, labels: [] } };
			const program = createRulerProgram(() => ({ layout: ruler.layout, color: border }), sceneUniforms, engine.ctx);
			ruler.material = engine.createMaterial({ program });
			ruler.mesh = engine.createObject({
				attributes: {},
				vertexCount: 0,
				drawMode: "LINES",
				matrix: axisSwap,
				material: ruler.material,
			});
			return ruler;
		});
	}
	return rulers;
}

/**
 * @param {"auto-range"} event
 * @param {(...args: any[]) => void} callback
 * @returns {() => void} unsubscribe
 */
export function on(event, callback) {
	if (!listeners.has(event)) {
		listeners.set(event, new Set());
	}
	listeners.get(event).add(callback);
	return () => listeners.get(event).delete(callback);
}

function emit(event, ...args) {
	for (const callback of listeners.get(event) ?? []) {
		callback(...args);
	}
}

export function setPalette(colors) {
	palette.set(colors);
	engine.invalidate();
}

export function setColorRange(min, max) {
	colorRange = { min, max };
	engine.invalidate();
}

export function setOutOfRange(mode) {
	outOfRange = mode;
	engine.invalidate();
}

export function getAutoRange() {
	return [...autoRange];
}

function layerColorRange(input) {
	return [input.colorMin ?? colorRange.min ?? autoRange[0], input.colorMax ?? colorRange.max ?? autoRange[1]];
}

// Min and max height over the palette point layers, NaN ignored; 0..1 without any.
function updateAutoRange() {
	let min = Number.POSITIVE_INFINITY;
	let max = Number.NEGATIVE_INFINITY;
	for (const input of layerInputs) {
		if (input.kind === "points" && (input.colorMode ?? "palette") === "palette") {
			const { bounds } = sources.get(input.id);
			min = Math.min(min, bounds.min[2]);
			max = Math.max(max, bounds.max[2]);
		}
	}
	if (min > max) {
		min = 0;
		max = 1;
	}
	if (min !== autoRange[0] || max !== autoRange[1]) {
		autoRange = [min, max];
		emit("auto-range", min, max);
	}
}

export function setBackground(rgba) {
	background = rgba;
	invalidateLabels();
	engine.renderer.update((renderer) => ({ ...renderer, backgroundColor: rgba }));
}

export function setAmbient(intensity = defaultAmbient, color = [1, 1, 1]) {
	engine.renderer.update((renderer) => ({ ...renderer, ambientLightColor: [color, intensity] }));
}

export function resize() {
	engine.renderer.resize();
}

export function setLayers(inputs) {
	for (const source of new Set(sources.values())) {
		source.destroy?.();
	}
	layerInputs = inputs.filter((input) => input.kind === "surface" || input.kind === "points");
	const grids = new Map();
	sources = new Map(
		layerInputs.map(({ id, data }) => {
			if ("xyz" in data) {
				return [id, createPointCloud(data, sceneUniforms)];
			}
			if (!grids.has(data.distanceData)) {
				grids.set(data.distanceData, createHeightGrid(data, sceneUniforms));
			}
			return [id, grids.get(data.distanceData)];
		}),
	);
	updateAutoRange();
	sceneBounds = getBounds();
	invalidateLabels();
	const { min, max } = sceneBounds;
	const center = min.map((value, i) => (value + max[i]) / 2);
	sceneUniforms.setOrigin(center);
	halfSize = [(max[0] - min[0]) / 2 || 1, (max[1] - min[1]) / 2 || 1];
	sceneRadius = Math.hypot(max[0] - min[0], max[1] - min[1], (max[2] - min[2]) * zScale) / 2 || 1;
	// Layer changes do not move the camera; only the first data frames it.
	if (!framed) {
		frame(sceneRadius);
		framed = layerInputs.length > 0;
	}
	if (gizmo) {
		syncGizmoCamera();
		for (const { mesh } of gizmo.layers) {
			mesh.matrix.set(gizmoMatrix());
		}
	}
	applyLights();
	buildScene();
}

function buildScene() {
	built = new Map(layerInputs.map((input) => [input.id, buildLayer(input)]));
	commitScene();
}

function commitScene() {
	const hasData = layerInputs.length > 0;
	const layers = [
		...built.values(),
		...(showBoundingBox && hasData ? [getBoundingBox()] : []),
		...(showRulers && hasData ? getRulers() : []),
		...(showGizmo && hasData ? getGizmo() : []),
	];
	engine.materials.set(layers.map(({ material }) => material));
	engine.scene.set(layers.map(({ mesh }) => mesh));
}

/** visible (default true) and density (default 7) of the rulers, boundingBox outline (default false). */
export function setRulers({ visible, density, boundingBox }) {
	showRulers = visible ?? showRulers;
	rulerDensity = density ?? rulerDensity;
	showBoundingBox = boundingBox ?? showBoundingBox;
	invalidateLabels();
	commitScene();
}

/** Resolved theme colors: border (rulers), borderSubdued (bounding box), axisX, axisY and axisZ (gizmo). */
export function setTheme({ border: borderColor, borderSubdued: borderSubduedColor, axisX, axisY, axisZ }) {
	if (borderColor !== undefined) {
		border = convertToVector3(borderColor);
	}
	if (borderSubduedColor !== undefined) {
		borderSubdued = convertToVector3(borderSubduedColor);
	}
	if (axisX !== undefined || axisY !== undefined || axisZ !== undefined) {
		axisColors = [axisX ?? axisColors[0], axisY ?? axisColors[1], axisZ ?? axisColors[2]];
		// The mesh colors are set when the programs are built: new arrows with the new colors.
		gizmo = null;
		commitScene();
		invalidateLabels();
	}
	engine.invalidate();
}

function getBoundingBox() {
	if (!boundingBox) {
		const program = createLinesProgram(boundingBoxStyle, sceneUniforms, engine.ctx);
		const material = engine.createMaterial({ program });
		const mesh = engine.createObject({
			attributes: { positions: boxEdges },
			drawMode: "LINES",
			matrix: axisSwap,
			material,
		});
		boundingBox = { material, mesh };
	}
	return boundingBox;
}

// The unit box scaled to the current bounds, relative to the scene origin in double precision.
function boundingBoxStyle() {
	const origin = sceneUniforms.getOrigin();
	const { min, max } = sceneBounds;
	return {
		color: borderSubdued,
		offset: min.map((value, i) => value - origin[i]),
		scale: max.map((value, i) => value - min[i]),
	};
}

function buildLayer(input) {
	const source = sources.get(input.id);
	if (input.kind === "surface") {
		const surface = createSurface(source);
		const material = engine.createMaterial({ ...createSurfaceMaterial(input.material), ...(envMap && { envMap }) });
		const mesh = engine.createObject({
			attributes: {},
			vertexCount: surface.vertexCount,
			drawMode: "TRIANGLES",
			matrix: axisSwap,
			material,
			animations: [surface.animation],
		});
		return { material, mesh };
	}
	const style = { colorMode: input.colorMode, color: input.color, pointSize: input.pointSize };
	const coloring = {
		palette,
		getRange: () => layerColorRange(input),
		hideOutOfRange: () => outOfRange === "hide",
	};
	const material = engine.createMaterial({ program: createPointsProgram(source, style, coloring, engine.ctx) });
	const mesh = engine.createObject({
		// A cloud's xyz go to the positions buffer as is; a grid needs no attribute.
		attributes: source.cloud ? { positions: source.xyz } : {},
		vertexCount: source.pointCount,
		drawMode: "POINTS",
		matrix: axisSwap,
		material,
	});
	return { material, mesh };
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
	const source = sources.get(id);
	if (!source) {
		return;
	}
	if (source.cloud) {
		// The engine uploads a mesh's positions once: a new cloud gets a new mesh, of any size.
		sources.set(id, createPointCloud({ xyz: data, origin: source.origin }, sceneUniforms));
		built.set(id, buildLayer(layerInputs.find((input) => input.id === id)));
		commitScene();
	} else {
		source.update(data);
	}
	sceneBounds = getBounds();
	invalidateLabels();
	updateAutoRange();
	engine.invalidate();
}

export function setZScale(scale) {
	zScale = scale;
	sceneUniforms.setZScale(scale);
	invalidateLabels();
	engine.invalidate();
}

// Union of the layer bounds; an axis without any value is 0..0.
function getBounds() {
	const min = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
	const max = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
	for (const { bounds } of sources.values()) {
		for (let i = 0; i < 3; i++) {
			min[i] = Math.min(min[i], bounds.min[i]);
			max[i] = Math.max(max[i], bounds.max[i]);
		}
	}
	for (let i = 0; i < 3; i++) {
		if (min[i] > max[i]) {
			min[i] = 0;
			max[i] = 0;
		}
	}
	return { min, max };
}

// The default view of data of that radius: seen from the -Y side of the data, above it and a little to the left.
function homeCamera(radius) {
	const distance = radius / Math.sin((fov * Math.PI) / 360);
	const direction = [-0.5, 0.9, 1];
	const length = Math.hypot(...direction);
	return {
		position: direction.map((value) => (value / length) * distance),
		target: [0, 0, 0],
		near: distance / 100,
		far: distance * 10,
	};
}

function frame(radius) {
	engine.camera.set({ ...get(engine.camera), ...homeCamera(radius), fov });
	homeView = engine.camera.view;
}

function animateTo(next) {
	cancelCameraAnimation();
	cancelCameraAnimation = animateCamera(engine.camera, next, cameraAnimation ? 300 : 0);
}

/** Animated view changes (snapTo, resetView, gizmo clicks), default true; false makes them instant. */
export function setCameraAnimation(enabled) {
	cameraAnimation = enabled;
}

/** Animates the camera back to the default view, framing the data (about 300 ms). */
export function resetView() {
	animateTo(homeCamera(sceneRadius));
}

// Data direction from the target toward the camera; top and bottom end 0.01 rad off the pole, seen from -Y.
const viewDirections = {
	"+x": [1, 0, 0],
	"-x": [-1, 0, 0],
	"+y": [0, 1, 0],
	"-y": [0, -1, 0],
	"+z": [0, 0, 1],
	"-z": [0, 0, -1],
	side: [1, 0, 0],
	front: [0, -1, 0],
	top: [0, 0, 1],
};

/**
 * Animates the camera to look along a data axis, or along the home direction for "iso" (about 300 ms).
 * The target and the distance are kept: the camera turns around what it looks at.
 */
export function snapTo(view) {
	const { position, target } = get(engine.camera);
	const distance = Math.hypot(...position.map((value, i) => value - target[i]));
	const home = homeCamera(1).position;
	// Data direction to world: the axis swap (x, y, z) -> (x, z, -y).
	const [x, y, z] = viewDirections[view] ?? [home[0], -home[2], home[1]];
	const length = Math.hypot(x, y, z);
	animateTo({ position: [x, z, -y].map((value, i) => target[i] + (value / length) * distance), target });
}

onMount(() => {
	engine.renderer.update((renderer) => ({
		...renderer,
		canvas,
		backgroundColor: background,
		ambientLightColor: [[1, 1, 1], defaultAmbient],
		loop: renderOverlay,
		enabled: true,
	}));
	// Temporary camera interaction until the turntable controls of step 6.1.
	controls = createOrbitControls(canvas, engine.camera);
});

onDestroy(() => {
	cancelCameraAnimation();
	unsubscribeCamera();
	controls?.destroy();
	engine.destroy();
});
</script>

<div class="scan-viewer">
	<canvas
		bind:this={canvas}
		on:pointermove={onPointerMove}
		on:pointerdown={onPointerDown}
		on:pointerup={onPointerUp}
		on:pointerleave={onPointerLeave}
		on:wheel={() => cancelCameraAnimation()}
	></canvas>
	<canvas class="labels" bind:this={labelCanvas}></canvas>
</div>

<style>
	.scan-viewer {
		position: relative;
		width: 100%;
		height: 100%;
	}
	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
	.labels {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
</style>
