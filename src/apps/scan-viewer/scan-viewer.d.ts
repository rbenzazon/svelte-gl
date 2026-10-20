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

/** Components in 0..1, or a "#rrggbb" string. */
export type Color = [number, number, number] | string;

/** Metallic/roughness PBR material of a surface layer. */
export interface ScanViewerMaterial {
	/** Defaults to a neutral light grey. */
	baseColor?: Color;
	/** 0..1, default 0. */
	metallic?: number;
	/** 0..1, default 0.5. */
	roughness?: number;
}

/**
 * Point light placed relative to the data bounding box: x and y in half extents from the center
 * (for example [1, -1, 2] is above the +X/-Y corner), z (up) in the larger horizontal half extent.
 */
export interface ScanViewerLight {
	position: [number, number, number];
	/** Defaults to white. */
	color?: Color;
	/** Defaults to 1. There is no distance falloff. */
	intensity?: number;
}

export interface ScanViewerSurfaceLayer {
	id: string;
	kind: "surface";
	data: ScanData;
	material?: ScanViewerMaterial;
}

export type ScanViewerLayer = ScanViewerSurfaceLayer;

/** Equirectangular HDR image as RGBA half floats, what loadEnvironment returns for a .hdr (RGBE) file. */
export interface ScanViewerEnvironment {
	width: number;
	height: number;
	data: Uint16Array;
}

export interface ScanViewerEnvironmentOptions {
	/** Draw the environment as the background instead of the background color. Default false. */
	skybox?: boolean;
	/** 0 (sharp) .. 1 (fully blurred) skybox. Default 0. */
	skyboxBlur?: number;
	/** Image-based lighting on the surfaces, on top of the point lights, also when the skybox is hidden. Default false. */
	envLighting?: boolean;
}

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
	/** Replaces all layers. The first call with data frames the camera on their bounding box; later calls do not move it. */
	setLayers(layers: ScanViewerLayer[]): void;
	/** Re-uploads one layer's heights; the grid size must not change. */
	updateLayerData(id: string, data: Float32Array): void;
	/** Height exaggeration, default 1. */
	setZScale(scale: number): void;
	/**
	 * Up to 4 point lights, none removes them. The default rig is a key, a fill and a rim light.
	 * "camera" (default): the rig is placed for the home view and orbits with the camera.
	 * "scene": the lights stay fixed in the scene.
	 */
	setLights(lights: ScanViewerLight[], attached?: "camera" | "scene"): void;
	/** Uniform ambient term. Intensity defaults to 0.6 (the initial value), 0 turns it off; color defaults to white. */
	setAmbient(intensity?: number, color?: Color): void;
	/**
	 * Sets the environment and how it is used; null removes it. Calling again with the same image only
	 * applies the options. Resolves once applied; a newer call supersedes a pending one.
	 */
	setEnvironment(environment: ScanViewerEnvironment | null, options?: ScanViewerEnvironmentOptions): Promise<void>;
}

/** The default rig: key (front left), fill (front right) and rim (behind), as seen from the home view. */
export const defaultLights: ScanViewerLight[];

/** Fetches and decodes a .hdr (RGBE) file. */
export function loadEnvironment(url: string): Promise<ScanViewerEnvironment>;

export function createScanViewer(target: HTMLElement, options?: ScanViewerOptions): ScanViewerApi;
