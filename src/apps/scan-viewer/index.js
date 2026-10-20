import ScanViewer from "./ScanViewer.svelte";

export { loadRGBE as loadEnvironment } from "../../loaders/rgbe-loader.js";
export { defaultLights } from "./light-rig.js";

/**
 * @param {HTMLElement} target
 * @param {import("./scan-viewer").ScanViewerOptions} [options]
 * @returns {import("./scan-viewer").ScanViewerApi}
 */
export function createScanViewer(target, { background } = {}) {
	const viewer = new ScanViewer({ target, props: { background } });
	return {
		resize: viewer.resize,
		setBackground: viewer.setBackground,
		setLayers: viewer.setLayers,
		updateLayerData: viewer.updateLayerData,
		setZScale: viewer.setZScale,
		setLights: viewer.setLights,
		setAmbient: viewer.setAmbient,
		setEnvironment: viewer.setEnvironment,
		destroy() {
			viewer.$destroy();
		},
	};
}
