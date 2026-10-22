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
		setPalette: viewer.setPalette,
		setColorRange: viewer.setColorRange,
		setOutOfRange: viewer.setOutOfRange,
		getAutoRange: viewer.getAutoRange,
		on: viewer.on,
		setRulers: viewer.setRulers,
		setTheme: viewer.setTheme,
		setLabelStyle: viewer.setLabelStyle,
		setGizmo: viewer.setGizmo,
		resetView: viewer.resetView,
		snapTo: viewer.snapTo,
		setCameraAnimation: viewer.setCameraAnimation,
		pick: viewer.pick,
		destroy() {
			viewer.$destroy();
		},
	};
}
