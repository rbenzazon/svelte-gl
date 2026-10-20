/** Components in 0..1, written to the canvas as is. */
export type RGBA = [number, number, number, number];

/** Same shape as Kalea's ScanData: a row-major height grid over the physical extent x0..x1, y0..y1. */
export interface ScanData {
	imageW: number;
	imageH: number;
	x0: number;
	y0: number;
	x1: number;
	y1: number;
	/** imageW * imageH heights, NaN for missing samples. */
	distanceData: Float32Array;
}

export interface ScanViewerSurfaceLayer {
	id: string;
	kind: "surface";
	data: ScanData;
}

export type ScanViewerLayer = ScanViewerSurfaceLayer;

export interface ScanViewerOptions {
	/** Defaults to opaque white. */
	background?: RGBA;
}

export interface ScanViewerApi {
	/** Also driven internally by a ResizeObserver. */
	resize(): void;
	/** Stops the render loop and frees the WebGL context. The viewer cannot be reused. */
	destroy(): void;
	setBackground(rgba: RGBA): void;
	/** Replaces all layers and frames the camera on their bounding box. */
	setLayers(layers: ScanViewerLayer[]): void;
	/** Re-uploads one layer's heights; the grid size must not change. */
	updateLayerData(id: string, data: Float32Array): void;
	/** Height exaggeration, default 1. */
	setZScale(scale: number): void;
}

export function createScanViewer(target: HTMLElement, options?: ScanViewerOptions): ScanViewerApi;
