# Scan viewer

WebGL2 viewer for height scans and point clouds: surfaces, points, rulers, a view gizmo and picking.

## What is shipped

- `build/lib/scan-viewer.js`: a single ES module with no dependencies (about 41 KB gzip). No Svelte, GLSL plugin or bundler setting is needed in the app.
- `src/apps/scan-viewer/scan-viewer.d.ts`: the TypeScript types and the API documentation.

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
<!-- ScanView.client.vue -->
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
- See `scan-viewer.d.ts` for the full API: layers, color range and palette, lights and environment, rulers, gizmo, `snapTo`, `pick`.
