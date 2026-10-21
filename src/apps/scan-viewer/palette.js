import { convertToVector3 } from "../../color/color-space.js";

const paletteUnit = 1;

/** Kalea's default "Viridis", from the colorMin color to the colorMax color. */
const viridis = ["#440154", "#414487", "#2a788e", "#22a884", "#7ad151", "#fde725"];

/**
 * Palette stops in an n x 1 RGBA8 texture with linear filtering, like ScanView: the stops are the exact
 * gradient colors and the shader samples between texel centers through paletteRemap.
 * bindTexture is a pipeline step; it uploads only after set().
 * @param {import("./scan-viewer").Color[]} [stops]
 */
export function createPalette(stops = viridis) {
	let texture = null;
	let data;
	let count = 0;
	let dirty = true;

	function set(colors) {
		count = colors.length;
		data = new Uint8Array(colors.flatMap((color) => [...convertToVector3(color).map((c) => Math.round(c * 255)), 255]));
		dirty = true;
	}
	set(stops);

	function bindTexture(ctx) {
		const { gl, program } = ctx;
		gl.activeTexture(gl.TEXTURE0 + paletteUnit);
		if (!texture) {
			texture = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		}
		gl.bindTexture(gl.TEXTURE_2D, texture);
		if (dirty) {
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, count, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
			dirty = false;
		}
		gl.uniform1i(gl.getUniformLocation(program, "palette"), paletteUnit);
		gl.uniform2f(gl.getUniformLocation(program, "paletteRemap"), (count - 1) / count, 0.5 / count);
	}

	return { set, bindTexture };
}
