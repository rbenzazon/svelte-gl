# Scan viewer: functional specification

What the scan viewer does, as implemented. It is the starting point for anyone (or any agent) picking up the work without the history. Method signatures and defaults are in [README.md](README.md) (API reference).

## Purpose and scope

- A WebGL2 viewer for surface metrology data: height scans (regular grids) and point clouds, shown as lit surfaces and colored points, with measurement aids (rulers, bounding box, orientation gizmo) and picking.
- Framework-agnostic: one ES module with no dependencies, created on any DOM element. The consuming app (for example a Vue or Nuxt app) builds all buttons and panels on the API.
- Built on the svelte-gl engine in this repo. The engine was extended for it (several engines per page, resize, float textures, zero-attribute draws, viewports, material add-ons), and the other examples keep working unchanged.
- Out of scope here: the consuming app's components, and any UI control (the viewer draws no buttons).

## Data and coordinates

- **Height grid** (`ScanData`): a row-major grid of heights over a physical extent. `NaN` marks a missing sample and shows as a hole.
- **Point cloud**: interleaved x, y, z, plus an optional origin so large machine coordinates keep their precision. A point with a `NaN` coordinate is skipped.
- Real units throughout (for example mm). Z is up: X and Y span the scan plane, Z is the height.
- **Height exaggeration** (`zScale`) only changes the display. Rulers, colors, picking results and ranges always use the real heights.
- Screen positions are CSS px from the top left of the viewer.

## Layers

- The scene is a list of layers, each with an id, replaced as a whole (`setLayers`) or updated one at a time (`updateLayerData`: new heights for a grid of the same size, or a new cloud of any size).
- **Surface layer**: a height grid drawn as a continuous lit surface, two triangles per cell, holes where samples are missing. Double-sided: seen from below, it is lit from that side.
- **Points layer**: one round, unlit point per sample, from a height grid (organized points) or a cloud (unorganized). Size in CSS px.
- A surface and a points layer can share the same grid data; the data is then uploaded once.
- Only the first data frames the camera; later layer changes keep the view.

## Color

- **Surfaces**: a PBR material (base color, metallic, roughness), solid by default. In palette mode, each pixel takes the palette color of its height, still lit; the base color then tints the palette.
- **Points**: palette by default (exact palette colors, unlit), or one solid color per layer.
- **Palette**: a list of color stops from the minimum to the maximum of the range, interpolated linearly. Default Viridis.
- **Color range**: in real heights. Each bound comes from the layer override, else the viewer range, else the auto range. The auto range is the min and max height over the palette layers (missing samples ignored), and the viewer emits an event when it changes.
- **Out of range**: clamp to the edge colors (default) or hide. Hidden surfaces are cut exactly along the range limits.

## Lighting and environment

- Up to 4 point lights placed relative to the data bounding box, so a rig works for any data size; no distance falloff. Default rig: a key light front left, as seen from the home view.
- Lights are attached to the camera by default (the data always looks lit from the same side while orbiting) or fixed in the scene.
- Uniform ambient light, adjustable or off.
- Optional HDR environment: as the background (skybox, with an adjustable blur) and/or as image-based lighting on the surfaces, independently.
- Optional tone mapping on the lit surfaces: none (default) or Khronos PBR Neutral, which compresses highlights without shifting the colors. Points and lines are never tone mapped, so palette colors stay exact.
- Background: one solid color, or the skybox.

## Measurement aids

- **Bounding box**: an optional thin outline of the combined data box.
- **Rulers** (default on): graduated rulers on the box edges closest to the viewer, X and Y along the bottom near edges, Z on the side vertical edge. They switch edges as the camera orbits.
  - Major and minor ticks on "nice" steps (1, 2, 5 × 10ⁿ), with a density setting; shorter rulers on screen get fewer steps.
  - Major ticks are labeled in real values, labels point away from the data, and overlapping labels are hidden.
- **Labels**: drawn as text on a 2D layer over the 3D view, always readable and on top. They stay inside the view, moving to the other side of their point near an edge or a corner, without flickering. Font and color come from the app (resolved CSS values), default 11 px IBM Plex Sans.
- **View gizmo** (default on): shaded X, Y and Z arrows in the bottom left corner, turning with the camera and lit like the scene, with X, Y, Z labels in the axis colors. Hidden without data.

## Camera and interaction

- Perspective camera orbiting the data center; drag to orbit, mouse wheel to zoom. These are the engine's basic orbit controls, kept until the dedicated turntable controls are built (see the open items).
- **Home view**: seen from the front (−Y side), above and a little to the left, framing the data. `resetView` returns to it.
- **Views**: `snapTo` looks along an axis from either side (±X, ±Y, ±Z, plus the side, front, top and iso aliases), keeping the target and the distance. The top view shows X to the right and Y up.
- **Gizmo**: hovering an arrow or its label highlights it (a disc of the axis color behind the label, a pointer cursor). A click turns the view to look along that axis, its arrow toward the viewer; a second click shows the opposite side.
- View changes animate in about 300 ms. The app can turn animations off, for example for users who prefer reduced motion; the viewer does not read that preference itself.
- A press or a scroll on the view stops a running animation, so the user can always take over.

## Picking

- `pick(x, y)` returns the data under a screen point, or nothing: the layer, the interpolated data position and height, the nearest measured sample (its index and height), and where the hit is drawn on screen.
- Grids (surfaces and organized points): the hit follows the same triangles as the drawn surface; nothing over holes or past the edges.
- Clouds: the hit is on a local mesh built from the points around the cursor ray, independent of the zoom; nothing over holes or past the edge of the cloud.
- The hit nearest to the camera wins across layers. Nothing is returned over a gizmo arrow.
- Synchronous and fast (tens of µs); the first pick of a cloud builds its search structure.

## Theming and styling

- All colors are given by the app as resolved values, for example read from its theme: rulers, bounding box, gizmo axes, label font and color, background.
- Defaults suit a light theme.

## Integration

- Shipped as one committed ES module (`build/lib/scan-viewer.js`, about 41 KB gzip) plus a hand-written TypeScript declaration file. Apps copy the two files or depend on this public repo at a pinned commit or tag.
- Each viewer owns one WebGL context; apps must destroy it on unmount (browsers keep about 16 contexts).
- The viewer follows its container size; the container needs a height.
- The app provides the HDR files, the label font and every control.
- License MIT-0: free use in proprietary products, no attribution required, no warranty.

## Decisions that differ from the original specification

- **No per-point RGB color**: points are solid or palette colored on the height.
- **Gizmo**: 3D shaded arrows only, no filled or hollow circles; the negative views come from a second click on the same arrow.
- **No home button** in the viewer: home is the `resetView` API, the button belongs to the app.
- **Labels**: a 2D text layer over the view, instead of text rendered in WebGL or HTML elements.
- **Surface palette coloring**: an addition to the spec, so surfaces can show heights like the points.

## Not implemented (open items)

- **Turntable controls**: pan, zoom toward the cursor, distance and angle limits, target clamped to the data, damping and inertia, double-click reset, shift-to-zoom, touch pinch. Touch currently uses the basic orbit controls, and a tap on the gizmo also orbits.
- **Camera API**: `getCamera`, `setCamera`, the `camera` event, camera limits, and switching to the orthographic projection (the engine supports it, the viewer does not expose it).
- **Grid plane** under the data, with fades.
- **Surface wireframe** overlay.
- **Picking extras**: `project` (data to screen), `sampleAt` (data at an x, y position), the throttled `hover` event, and the marker (ring and drop line, `setMarker`).
- **Axis titles** on the rulers, and a number formatter option.
- **Robustness**: WebGL context loss and restore, the "No data" state with a default extent, error events (WebGL2 unavailable, context lost).
- **Several layers together**: per-layer visibility and opacity, solid colors assigned in order from a color list, a combined bounding box of visible layers only.
- **Known limits**: a ruler seen end on (for example X in the ±X views) crowds its labels; samples hidden by "out of range: hide" can still be picked; double-sided transparent surfaces are not sorted; the engine's light map and env map share a texture unit (planned fix).

## Where to look

- [README.md](README.md): installation, Vue example, full API reference.
- `scan-viewer.d.ts`: the public types.
- `src/scan-viewer.svelte`: the example page with a control panel for every feature, the best way to try things.
- `snapshots/`: reference screenshots of every example and a compare script, to check rendering changes.
