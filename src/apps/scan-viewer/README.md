# Scan viewer

WebGL2 viewer for height scans and point clouds: lit surfaces (solid or palette colored), points, rulers, a view gizmo and picking. What it does and what is not implemented yet: [spec.md](spec.md).

## What is shipped

- `build/lib/scan-viewer.js`: a single ES module with no dependencies (about 41 KB gzip). No Svelte, GLSL plugin or bundler setting is needed in the app.
- `src/apps/scan-viewer/scan-viewer.d.ts`: the TypeScript types, with the same documentation in short form for editor hints. The [API reference](#api-reference) below is the full description.

The app provides the environment HDR files (as URLs for `loadEnvironment`), the label font (`IBM Plex Sans` by default), the theme colors, and all UI controls, built on the API.

## Installation

### Option A: copy the bundle

Copy `build/lib/scan-viewer.js` and `src/apps/scan-viewer/scan-viewer.d.ts` into the same folder of the app, for example `app/vendor/scan-viewer/`, then import it:

```ts
import { createScanViewer } from "~/vendor/scan-viewer/scan-viewer.js";
```

To update, copy both files again from the wanted svelte-gl commit, and note that commit hash in the app commit message.

### Option B: git dependency

The repository is public, so no SSH key or token is needed, locally or in CI. Pin a commit or a tag:

```sh
pnpm add github:rbenzazon/svelte-gl#<commit-or-tag>
```

```ts
import { createScanViewer } from "svelte-gl/scan-viewer";
```

To update, change the commit or tag in the app `package.json`. Every svelte-gl commit contains its built bundle.

## Vue example

WebGL needs the browser, so the component is client-only (in Nuxt, the `.client.vue` suffix).

```vue
<!-- ScanViewer.client.vue -->
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { createScanViewer, type ScanData, type ScanViewerApi } from "svelte-gl/scan-viewer";

const props = defineProps<{ scan: ScanData }>();
const container = ref<HTMLDivElement>();
// Plain variable, not a ref: Vue must not wrap the viewer in a reactive proxy.
let viewer: ScanViewerApi | undefined;

const layers = (scan: ScanData) => [{ id: "scan", kind: "points" as const, data: scan }];

onMounted(() => {
	viewer = createScanViewer(container.value!, { background: [1, 1, 1, 1] });
	viewer.setLayers(layers(props.scan));
});

// The first data frames the camera; later layers keep the view.
watch(
	() => props.scan,
	(scan) => viewer?.setLayers(layers(scan)),
);

onBeforeUnmount(() => viewer?.destroy());
</script>

<template>
	<!-- The viewer fills its container and follows its size: give it a height. -->
	<div ref="container" class="h-96 w-full" />
	<button @click="viewer?.resetView()">Reset view</button>
</template>
```

- Call `destroy` on unmount: each viewer owns a WebGL context, and browsers keep only about 16 at once.
## API reference

### Module exports

```ts
import { createScanViewer, loadEnvironment, defaultLights } from "svelte-gl/scan-viewer";
```

- `createScanViewer(target: HTMLElement, options?: { background?: RGBA }): ScanViewerApi` creates a viewer filling `target`. `background` defaults to opaque white.
- `loadEnvironment(url: string): Promise<ScanViewerEnvironment>` fetches and decodes a `.hdr` (RGBE) file, for `setEnvironment`.
- `defaultLights: ScanViewerLight[]` is the light rig the viewer starts with, to pass back to `setLights` after a change.

All the types below are exported by `scan-viewer.d.ts`.

### Units and coordinates

- Data coordinates are real units (for example mm), with Z up: X and Y span the scan plane, Z is the height.
- `setZScale` only exaggerates the displayed heights. Rulers, the color range, picking results and the auto range always use the real heights.
- Screen coordinates (`pick`, `ScanViewerHit.screen`) are CSS px from the top left corner of the viewer.

### Colors

The viewer does not parse CSS. Every color goes to WebGL as numbers, so only two forms are accepted:

| Type | Accepted | Used by |
|---|---|---|
| `Color` | `[r, g, b]` with components in 0..1, or a 6-digit hex string `"#rrggbb"` | `setTheme`, `setPalette`, a layer's `color` and `material.baseColor`, a light's `color`, `setAmbient` |
| `RGBA` | `[r, g, b, a]` with components in 0..1 | `setBackground`, `createScanViewer({ background })` |

Anything else is **not** supported, and is not checked when it is set:

- Other strings (`"rgb(116, 138, 153)"`, `"rgba(...)"`, `"oklch(...)"`, `"var(--token)"`, `"red"`) throw. Depending on the setter, the error comes at the call or later inside the render loop, which then stops drawing: the last frame stays on screen and the camera no longer moves.
- Short hex (`"#fff"`), 8-digit hex (`"#rrggbbaa"`) and 0..255 components do not throw, but give wrong colors.

The one exception is `setLabelStyle({ color })`, which takes any CSS color, since the labels are drawn on a 2D canvas.

Theme tokens resolved with `getComputedStyle` come back as `"rgb(...)"` strings (or `"oklch(...)"` for tokens defined that way): convert them before passing them. A 1 × 1 canvas converts any CSS color the browser understands:

```ts
const context = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;

/** Any CSS color, as resolved by getComputedStyle, to the viewer's [r, g, b] in 0..1. */
function toViewerColor(css: string): [number, number, number] {
	context.clearRect(0, 0, 1, 1);
	context.fillStyle = css;
	context.fillRect(0, 0, 1, 1);
	const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
	return [r / 255, g / 255, b / 255];
}

// The same with the alpha, for setBackground.
function toViewerRGBA(css: string): [number, number, number, number] {
	context.clearRect(0, 0, 1, 1);
	context.fillStyle = css;
	context.fillRect(0, 0, 1, 1);
	const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
	return [r / 255, g / 255, b / 255, a / 255];
}

viewer.setTheme({ border: toViewerColor(getComputedStyle(probe).color) });
```

### Data

`ScanData`: a row-major height grid.

| Field | Type | Description |
|---|---|---|
| `imageW`, `imageH` | `number` | Grid size in samples. |
| `x0`, `y0`, `x1`, `y1` | `number` | Physical extent of the first and last samples. |
| `distanceData` | `Float32Array` | `imageW * imageH` heights, row by row. `NaN` marks a missing sample. |

`PointCloudData`: an unorganized cloud.

| Field | Type | Description |
|---|---|---|
| `xyz` | `Float32Array` | Interleaved x, y, z per point. A point with a `NaN` coordinate is skipped. |
| `origin` | `[number, number, number]` | Added to every point, so the float32 coordinates stay small with machine coordinates. Default `[0, 0, 0]`. |

### Layers

`setLayers` takes an array of surface and points layers. Each layer has a unique `id`.

Surface layer (`kind: "surface"`, `data: ScanData`): two triangles per grid cell, lit by the PBR material. Triangles touching a `NaN` sample are not drawn, and the surface is double-sided (seen from below, it is lit from that side).

| Field | Type | Description |
|---|---|---|
| `material` | `ScanViewerMaterial` | `baseColor` (default light grey; white with the palette, where it tints it), `metallic` 0..1 (default 0), `roughness` 0..1 (default 0.5). |
| `colorMode` | `"solid"` \| `"palette"` | `"solid"` (default): the base color. `"palette"`: the height of each pixel through the color range, still lit. |
| `colorMin`, `colorMax` | `number` | Override the viewer color range for this layer. |

Points layer (`kind: "points"`, `data: ScanData | PointCloudData`): one unlit round point per sample, `NaN` skipped. With `ScanData`, one point per grid sample; give a surface layer and a points layer the same `distanceData` array, and the heights are uploaded once.

| Field | Type | Description |
|---|---|---|
| `colorMode` | `"palette"` \| `"solid"` | `"palette"` (default): the height through the color range. `"solid"`: one color. |
| `color` | `Color` | Used by `"solid"`. Default a mid blue. |
| `colorMin`, `colorMax` | `number` | Override the viewer color range for this layer. |
| `pointSize` | `number` | Diameter in CSS px. Default 2. |

### Methods

**Lifecycle**

- `resize()`: re-reads the container size. Not needed in general: the viewer follows its container with a `ResizeObserver`.
- `destroy()`: stops the render loop and frees the WebGL context. The viewer cannot be used afterwards.

**Data**

- `setLayers(layers: ScanViewerLayer[])`: replaces all layers. The first call with data frames the camera on their bounding box; later calls keep the view.
- `updateLayerData(id: string, data: Float32Array)`: new data for one layer without rebuilding the others. For a grid layer, new heights of the same grid size (also shown by the layers sharing its `distanceData`). For a cloud layer, new interleaved xyz with the same origin, any point count.
- `setZScale(scale: number)`: height exaggeration, default 1.

**Color**

- `setPalette(colors: Color[])`: palette stops from the `colorMin` color to the `colorMax` color, interpolated linearly. Default Viridis (dark purple to yellow). A gradient defined from the high value down must be passed reversed.
- `setColorRange(min?: number, max?: number)`: heights mapped to the first and last palette colors, in real units. Each bound left `undefined` uses the auto range. A layer's `colorMin` and `colorMax` take precedence.
- `setOutOfRange(mode: "clamp" | "hide")`: `"clamp"` (default) gives the edge colors outside the range; `"hide"` does not draw palette points and surface parts outside the range (surfaces are cut exactly along the limits).
- `getAutoRange(): [number, number]`: min and max height over the palette layers (points and surfaces), `NaN` ignored; `[0, 1]` without any.
- `on("auto-range", callback: (min: number, max: number) => void): () => void`: called when the auto range changes. Returns the unsubscribe function. `"auto-range"` is the only event for now.

**Lighting and environment**

- `setLights(lights: ScanViewerLight[], attached?: "camera" | "scene")`: up to 4 point lights; an empty array removes them. `"camera"` (default) places the rig for the home view and turns it with the camera; `"scene"` keeps the lights fixed in the scene.
  - `ScanViewerLight`: `position` `[x, y, z]` relative to the data bounding box, x and y in half extents from its center (for example `[1, -1, 2]` is above the +X/−Y corner), z (up) in the larger horizontal half extent. `color` defaults to white, `intensity` to 1. There is no distance falloff.
- `setAmbient(intensity?: number, color?: Color)`: uniform ambient light. Intensity defaults to 0.6 (the initial value), 0 turns it off. Color defaults to white.
- `setToneMapping(mode: "none" | "neutral", exposure?: number)`: `"none"` (default), or Khronos PBR Neutral tone mapping on the lit surfaces, which keeps the base colors and compresses the highlights instead of clipping them. Exposure defaults to 1. Points and lines are unlit and keep their exact colors.
- `setEnvironment(environment: ScanViewerEnvironment | null, options?): Promise<void>`: sets an HDR environment and how it is used; `null` removes it. Calling again with the same image only applies the options. Resolves once applied; a newer call supersedes a pending one. Options:
  - `skybox` (default false): draws the environment as the background instead of the background color;
  - `skyboxBlur` 0 (sharp) to 1 (fully blurred), default 0;
  - `envLighting` (default false): image-based lighting on the surfaces, on top of the point lights, also when the skybox is hidden.

**Scene and theme**

- `setBackground(rgba: RGBA)`: background color as `[r, g, b, a]` in 0..1 (not a CSS string), written to the canvas as is.
- `setRulers(options)`: graduation rulers on the bounding box edges closest to the viewer, switching edges as the camera orbits. Labels show real values and overlapping ones are hidden. Options:
  - `visible` (default true);
  - `density`: major steps along a 700 CSS px ruler, fewer on shorter rulers (default 7);
  - `boundingBox`: thin outline of the combined data box (default false).
- `setTheme(colors)`: resolved theme colors as `Color` values (see [Colors](#colors): not CSS strings), each optional:
  - `border`: rulers, default `#748a99`;
  - `borderSubdued`: bounding box, default `#b9c1cf`;
  - `axisX`, `axisY`, `axisZ`: gizmo arrows and labels, default red, green, blue.
- `setLabelStyle(style: { font?: string, color?: string })`: resolved CSS values of the label text (here any CSS color works, unlike the other color setters), for example read with `getComputedStyle` from a probe element styled with utility classes. `font` is a CSS font shorthand in CSS px. Default `11px "IBM Plex Sans", sans-serif` in `#b9c1cf`. Apply again after a theme change.
- `setGizmo(visible: boolean)`: the view orientation gizmo, shaded X, Y and Z arrows in the bottom left corner turning with the camera. Default true; hidden without data.

**Camera**

- `resetView()`: animates back to the default view framing the data (about 300 ms).
- `snapTo(view: ScanViewerView)`: animates to look along a data axis from its side, keeping the target and the distance. Views: `"+x"`, `"-x"`, `"+y"`, `"-y"`, `"+z"`, `"-z"`, with the aliases `"side"` (`"+x"`), `"front"` (`"-y"`) and `"top"` (`"+z"`), and `"iso"` for the default direction.
- `setControlMode(mode: "orbit" | "pan")`, `getControlMode()`: what a mouse drag does. `"orbit"` (default) turns the camera around its target; `"pan"` moves the target, and the camera with it, in the view plane, so the point under the cursor follows it. Holding Space over the viewer pans in either mode.
- `setCameraAnimation(enabled: boolean)`: animated view changes (`snapTo`, `resetView`, gizmo clicks), default true. `false` makes them instant, for example when `matchMedia("(prefers-reduced-motion: reduce)")` matches.

**Picking**

- `pick(screenX: number, screenY: number): ScanViewerHit | null`: the data under a screen point. Synchronous; the first pick of a cloud builds its picking tree. Returns `null` over a gizmo arrow, and where no data is hit.
  - Height grids (surface layers and organized points): the ray against the two triangles of each grid cell, the same as the drawn surface; `null` over `NaN` cells and past the grid edges.
  - Unorganized clouds: the ray against a local Delaunay mesh of the points within 2.5 point spacings of it (independent of the zoom); `null` past the edge of the cloud and over holes.
  - Both interpolate in the triangle under the cursor. The hit nearest to the camera wins across layers.

`ScanViewerHit`:

| Field | Type | Description |
|---|---|---|
| `layerId` | `string` | The layer hit. |
| `kind` | `"surface"` \| `"points"` | Its kind. |
| `screen` | `{ x, y }` | Where the hit is drawn, CSS px. |
| `world` | `{ x, y, z }` | Data coordinates under the cursor, real units, interpolated. |
| `value` | `number` | The interpolated height. |
| `index` | `number` | The sample nearest to the hit: `row * imageW + column` for a grid, the point index in `xyz` for a cloud. |
| `sampleValue` | `number` | The measured height of that sample. |

### Built-in interaction

- Drag to orbit the camera (or to pan in the `"pan"` control mode), drag while holding Space to pan, mouse wheel to zoom. `resetView` brings a panned target back to the data center; `snapTo` keeps it. The cursor is an open hand when a drag would pan, closed while panning.
- The gizmo arrows highlight on hover; a click turns the view along that axis (its arrow toward the viewer), and a second click on the same arrow shows the opposite side.
- All other controls (home button, view buttons, toggles) belong to the app and call the methods above.

## License

MIT No Attribution (MIT-0), see `LICENSE` at the repository root: use, copy, modify and distribute freely, with no attribution required and no warranty.
