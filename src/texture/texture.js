import textureShader from "./texture.glsl";
import { templateLiteralRenderer } from "../shaders/template.js";
import { get } from "svelte/store";

const types = {
	diffuse: "diffuseMap",
	normal: "normalMap",
};

const id = {
	diffuse: 0,
	normal: 1,
};

/**
 * @typedef TextureProps
 * @property {string} url
 * @property {"diffuse" | "normal"} type
 * @property {number[]} [normalScale=[1, 1]]
 * @property {"square" | "circular"} [coordinateSpace="square"]
 */

/**
 *
 * @param {TextureProps} props
 * @returns
 */
export const createTexture = async (props) => {
	const texture = await loadTexture(props.url);
	return {
		type: types[props.type],
		coordinateSpace: props.coordinateSpace,
		texture,
		shader: templateLiteralRenderer(textureShader, {
			declaration: false,
			diffuseMapSample: false,
			normalMapSample: false,
			mapType: undefined,
			coordinateSpace: undefined,
		}),
		setupTexture: (context) => setupTexture(context, texture, types[props.type], id[props.type], props.normalScale),
	};
};

function loadTexture(url) {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => {
			resolve(image);
		};
		image.onerror = reject;
		image.src = url;
	});
}

function setupTexture(context, texture, type, id, normalScale = [1, 1]) {
	return function () {
		context = get(context);
		/** @type {{gl: WebGL2RenderingContext}} **/
		const { gl, program } = context;
		//uniform sampler2D diffuseMap;

		var textureBuffer = gl.createTexture();
		const textureLocation = gl.getUniformLocation(program, type);
		gl.activeTexture(gl["TEXTURE" + id]);
		gl.bindTexture(gl.TEXTURE_2D, textureBuffer);
		gl.uniform1i(textureLocation, id);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture);

		// gl.NEAREST is also allowed, instead of gl.LINEAR, as neither mipmap.
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
		// Prevents s-coordinate wrapping (repeating).
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		// Prevents t-coordinate wrapping (repeating).
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
		gl.generateMipmap(gl.TEXTURE_2D);
		//gl.getExtension("EXT_texture_filter_anisotropic");
		if (normalScale != null) {
			const normalScaleLocation = gl.getUniformLocation(program, "normalScale");
			gl.uniform2fv(normalScaleLocation, normalScale);
		}
	};
}
