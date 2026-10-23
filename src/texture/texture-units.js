/**
 * Every texture unit in use, in one place: a new texture takes its unit here, so two textures sharing one
 * show as two equal values below. Units are independent slots: any index under
 * MAX_COMBINED_TEXTURE_IMAGE_UNITS (at least 32 in WebGL2) works without the lower ones.
 */
export const textureUnits = Object.freeze({
	// Default material texture add-ons (texture.js).
	diffuse: 0,
	normal: 1,
	roughness: 2,
	light: 3,
	// environment-map-texture.js. Same unit as the light map: a material with both breaks (step 14).
	env: 3,
	// Scan viewer: the height grid (height-grid.js) and the palette (palette.js), away from the material units.
	heightGrid: 14,
	palette: 15,
});
