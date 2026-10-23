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
	/**
	 * Base color, metallic and roughness. With the palette, baseColor tints the palette colors (default white).
	 * The surface is double-sided: seen from below, it is lit from that side.
	 */
	material?: ScanViewerMaterial;
	/**
	 * "solid" (default): the material base color; "palette": the height of each pixel through the color range,
	 * like the points, still lit. With setOutOfRange("hide"), the surface is cut along the range limits.
	 */
	colorMode?: "palette" | "solid";
	/** Overrides the viewer color range for this layer. */
	colorMin?: number;
	colorMax?: number;
}

/** Unorganized point cloud, in the same units as ScanData. */
export interface PointCloudData {
	/** Interleaved x, y, z, as loaders produce them. A point with a NaN coordinate is skipped. */
	xyz: Float32Array;
	/** Added to every point, so the float32 coordinates stay small (machine coordinates). Default [0, 0, 0]. */
	origin?: [number, number, number];
}

/**
 * Point cloud, one unlit round point per sample, NaN skipped.
 * Organized (ScanData): one point per grid sample; give a surface layer and a points layer the same
 * distanceData array to upload it once. Unorganized (PointCloudData): one point per xyz triplet.
 */
export interface ScanViewerPointsLayer {
	id: string;
	kind: "points";
	data: ScanData | PointCloudData;
	/** "palette" (default): height through the color range; "solid": one color for the layer. */
	colorMode?: "palette" | "solid";
	/** Used by "solid", defaults to a mid blue. */
	color?: Color;
	/** Overrides the viewer color range for this layer. */
	colorMin?: number;
	colorMax?: number;
	/** Diameter in CSS px, default 2. */
	pointSize?: number;
}

export type ScanViewerLayer = ScanViewerSurfaceLayer | ScanViewerPointsLayer;

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

export type ScanViewerView = "top" | "front" | "side" | "iso" | "+x" | "-x" | "+y" | "-y" | "+z" | "-z";

export interface ScanViewerApi {
	/** Also driven internally by a ResizeObserver. */
	resize(): void;
	/** Stops the render loop and frees the WebGL context. The viewer cannot be reused. */
	destroy(): void;
	setBackground(rgba: RGBA): void;
	/** Replaces all layers. The first call with data frames the camera on their bounding box; later calls do not move it. */
	setLayers(layers: ScanViewerLayer[]): void;
	/**
	 * Grid layer: new heights, also shown by the layers sharing its distanceData; the grid size must not change.
	 * Cloud layer: new interleaved xyz with the same origin, any point count.
	 */
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
	 * "none" (default) or "neutral": Khronos PBR Neutral tone mapping on the lit surfaces, which keeps the base
	 * colors and compresses the highlights instead of clipping them. Exposure defaults to 1. Points and lines are
	 * unlit and keep their exact colors.
	 */
	setToneMapping(mode: "none" | "neutral", exposure?: number): void;
	/**
	 * Sets the environment and how it is used; null removes it. Calling again with the same image only
	 * applies the options. Resolves once applied; a newer call supersedes a pending one.
	 */
	setEnvironment(environment: ScanViewerEnvironment | null, options?: ScanViewerEnvironmentOptions): Promise<void>;
	/**
	 * Palette stops from the colorMin color to the colorMax color, interpolated linearly. Default: Kalea's Viridis.
	 * A viridis Gradient's colors go the other way, so pass them reversed like ScanView does.
	 */
	setPalette(colors: Color[]): void;
	/** Heights mapped to the first and last palette colors, in real units (zScale has no effect). An undefined bound uses the auto range. */
	setColorRange(min?: number, max?: number): void;
	/** "clamp" (default): edge colors outside the range; "hide": palette points and surface parts outside the range are not drawn. */
	setOutOfRange(mode: "clamp" | "hide"): void;
	/** Min and max height over the palette layers (points and surfaces), NaN ignored; [0, 1] without any. */
	getAutoRange(): [number, number];
	/** Emitted when the auto range changes. Returns the unsubscribe function. */
	on(event: "auto-range", callback: (min: number, max: number) => void): () => void;
	/**
	 * Graduation rulers on the bounding box edges closest to the viewer, switching edges as the camera orbits.
	 * Labels show real values (zScale has no effect) and overlapping ones are hidden.
	 */
	setRulers(options: ScanViewerRulersOptions): void;
	/** Resolved theme token values. */
	setTheme(colors: ScanViewerThemeColors): void;
	/**
	 * Resolved CSS values of the label text, for example read with getComputedStyle from a probe element
	 * styled with utility classes. Default: 11px "IBM Plex Sans", #b9c1cf. Re-apply after a theme change.
	 */
	setLabelStyle(style: ScanViewerLabelStyle): void;
	/**
	 * Screen point (CSS px from the top left of the viewer) to the data under it, or null.
	 * - Height grids (surface layers and organized points): the ray against the two triangles of each grid cell,
	 *   the same triangles as the drawn surface; null over NaN cells and past the grid edges.
	 * - Unorganized clouds: the ray against a local Delaunay mesh of the points within 2.5 point spacings of it
	 *   (independent of the zoom); null past the edge of the cloud and over holes.
	 * Both interpolate in the triangle under the cursor. The hit nearest to the camera wins across layers.
	 * Synchronous; the first pick of a cloud builds its picking tree.
	 */
	pick(screenX: number, screenY: number): ScanViewerHit | null; // null over a gizmo arrow
	/** View orientation gizmo: shaded X, Y and Z arrows in the bottom left corner, turning with the camera. Default true. */
	setGizmo(visible: boolean): void;
	/** Animates the camera back to the default view framing the data (about 300 ms). */
	resetView(): void;
	/**
	 * Animated view changes (snapTo, resetView, gizmo clicks), default true; false makes them instant,
	 * for example when matchMedia("(prefers-reduced-motion: reduce)") matches.
	 */
	setCameraAnimation(enabled: boolean): void;
	/**
	 * Animates the camera to look along a data axis from its side ("+x" sees the data from +X), or along the
	 * default direction for "iso", keeping the target and the distance. "side" is "+x", "front" "-y", "top" "+z".
	 * Clicking a gizmo arrow does the same, or the opposite side when the view is already along it.
	 */
	snapTo(view: ScanViewerView): void;
}

export interface ScanViewerHit {
	layerId: string;
	kind: "surface" | "points";
	/** Where the hit is drawn, CSS px. */
	screen: { x: number; y: number };
	/** Data coordinates under the cursor, real units (the origin added, zScale has no effect), interpolated. */
	world: { x: number; y: number; z: number };
	/** The interpolated height. */
	value: number;
	/**
	 * Sample nearest to the hit (the triangle corner with the largest weight): the row-major index in
	 * distanceData (row * imageW + column) for a height grid, the point index in xyz for a cloud.
	 */
	index: number;
	/** Measured height of that sample. */
	sampleValue: number;
}

export interface ScanViewerLabelStyle {
	/** CSS font shorthand in CSS px, for example '11px "IBM Plex Sans", sans-serif'. */
	font?: string;
	/** Any CSS color. */
	color?: string;
}

export interface ScanViewerRulersOptions {
	/** Default true. */
	visible?: boolean;
	/** Major steps along a 700 CSS px ruler, fewer on shorter rulers, as GraphView's graduationDensity. Default 7. */
	density?: number;
	/** Thin outline of the combined data box. Default false. */
	boundingBox?: boolean;
}

export interface ScanViewerThemeColors {
	/** graph-border: rulers. Default Kalea's light theme value #748a99. */
	border?: Color;
	/** graph-border-subdued: bounding box. Default Kalea's light theme value #b9c1cf. */
	borderSubdued?: Color;
	/** axis-x, axis-y, axis-z: gizmo arrows and labels. Defaults red, green, blue. */
	axisX?: Color;
	axisY?: Color;
	axisZ?: Color;
}

/** The default rig: key (front left), fill (front right) and rim (behind), as seen from the home view. */
export const defaultLights: ScanViewerLight[];

/** Fetches and decodes a .hdr (RGBE) file. */
export function loadEnvironment(url: string): Promise<ScanViewerEnvironment>;

export function createScanViewer(target: HTMLElement, options?: ScanViewerOptions): ScanViewerApi;
