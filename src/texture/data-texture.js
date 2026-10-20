const formats = {
	R32F: { internal: "R32F", format: "RED", components: 1 },
	RGBA32F: { internal: "RGBA32F", format: "RGBA", components: 4 },
};

/**
 * Float data texture. setupTexture and bindTexture are pipeline steps; setupTexture only runs once.
 * update() re-uploads pixels and does not redraw; call engine.invalidate() after it.
 * @param {{ data: Float32Array, width: number, height: number, format?: "R32F" | "RGBA32F", uniform?: string }} props
 */
export function createDataTexture({ data, width, height, format = "R32F", uniform = "dataTexture" }) {
	const spec = formats[format];
	let gl = null;
	let texture = null;

	function setupTexture(ctx) {
		if (texture) {
			return;
		}
		gl = ctx.gl;
		gl.getExtension("EXT_color_buffer_float");
		texture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texStorage2D(gl.TEXTURE_2D, 1, gl[spec.internal], width, height);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		upload(data);
		gl.bindTexture(gl.TEXTURE_2D, null);
	}

	function upload(pixels) {
		gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl[spec.format], gl.FLOAT, pixels);
	}

	function bindTexture(ctx) {
		const { gl: context, program } = ctx;
		const location = context.getUniformLocation(program, uniform);
		context.activeTexture(context.TEXTURE0);
		context.bindTexture(context.TEXTURE_2D, texture);
		if (location) {
			context.uniform1i(location, 0);
		}
	}

	function update(pixels) {
		data = pixels;
		if (!texture) {
			return;
		}
		gl.bindTexture(gl.TEXTURE_2D, texture);
		upload(pixels);
		gl.bindTexture(gl.TEXTURE_2D, null);
	}

	function destroy() {
		gl?.deleteTexture(texture);
		texture = null;
	}

	return { setupTexture, bindTexture, update, destroy };
}
