import ScanViewer from "./ScanViewer.svelte";

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
		destroy() {
			viewer.$destroy();
		},
	};
}
