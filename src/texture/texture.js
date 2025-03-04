import textureShader from "./texture.glsl";
import { templateLiteralRenderer } from "../shaders/template.js";
import { get } from "svelte/store";
import { appContext } from "../store/engine-refactor.js";

const types = {
	diffuse: "diffuseMap",
	normal: "normalMap",
	roughness: "roughnessMap",
};

const id = {
	diffuse: 0,
	normal: 1,
	roughness: 2,
};

/**
 * @typedef TextureProps
 * @property {"diffuse" | "normal" | "roughness" } type
 * @property {number[]} [normalScale=[1, 1]]
 * @property {"square" | "circular"} [coordinateSpace="square"]
 * @property {() => WebGLTexture} [textureBuffer]
 * @property {string} url
 */

/**
 * Get the values from the types object
 * @typedef {typeof types[keyof typeof types]} TextureType
 */

/**
 * @typedef {Object} SvelteGLTexture
 * @property {TextureType} type
 * @property {string} [url]
 * @property {number[]} [normalScale=[1, 1]]
 * @property {"square" | "circular"} [coordinateSpace="square"]
 * @property {import("../shaders/template").TemplateRenderer} shader
 * @property {()=>void} setupTexture
 * @property {()=>void} bindTexture
 * @property {() => WebGLTexture} [textureBuffer]
 * @property {HTMLImageElement} [texture]
 */

/**
 *
 * @param {TextureProps} props
 * @returns {Promise<SvelteGLTexture>}
 */
export const createTexture = async (props) => {
	let image;
	let texBuffer;
	if (props.url) {
		image = await loadTexture(props.url);
	} else if (typeof props.textureBuffer === "function") {
		image = props.textureBuffer;
	}

	let buffer;
	function setBuffer(value) {
		buffer = value;
	}
	function getBuffer() {
		return buffer;
	}

	return {
		type: types[props.type],
		coordinateSpace: props.coordinateSpace,
		shader: templateLiteralRenderer(textureShader, {
			declaration: false,
			declarationNormal: false,
			diffuseMapSample: false,
			normalMapSample: false,
			roughnessMapSample: false,
			mapType: undefined,
			coordinateSpace: undefined,
		}),
		setupTexture: setupTexture(image, types[props.type], id[props.type], props.normalScale, setBuffer),
		bindTexture: bindTexture(id[props.type], getBuffer, types[props.type]),
		...(props.url ? { url: props.url } : {}),
		...(typeof image === "function"
			? {
					get textureBuffer() {
						return image();
					},
				}
			: { texture: image }),
	};
};

/**
 * load a texture from a url
 * @param {string} url
 * @returns Promise<HTMLImageElement>
 */
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

function bindTexture(id, getBuffer, type) {
	return function bindTexture() {
		const { gl, program } = appContext;
		const textureLocation = gl.getUniformLocation(program, type);
		gl.activeTexture(gl["TEXTURE" + id]);
		gl.bindTexture(gl.TEXTURE_2D, getBuffer());
		gl.uniform1i(textureLocation, id);
	};
}

function setupTexture(texture, type, id, normalScale = [1, 1], setBuffer) {
	return function setupTexture() {
		const { gl, program } = appContext;
		//uniform sampler2D diffuseMap;
		let textureBuffer;
		if (typeof texture === "function") {
			textureBuffer = texture();
		} else {
			textureBuffer = gl.createTexture();
		}
		setBuffer(textureBuffer);
		const textureLocation = gl.getUniformLocation(program, type);
		gl.activeTexture(gl["TEXTURE" + id]);
		gl.bindTexture(gl.TEXTURE_2D, textureBuffer);
		gl.uniform1i(textureLocation, id);
		if (typeof texture !== "function") {
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture);
		}

		// gl.NEAREST is also allowed, instead of gl.LINEAR, as neither mipmap.
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
		// Prevents s-coordinate wrapping (repeating).
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		// Prevents t-coordinate wrapping (repeating).
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		if (type === "diffuseMap") {
			//gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
		}
		gl.generateMipmap(gl.TEXTURE_2D);
		//gl.getExtension("EXT_texture_filter_anisotropic");
		if (normalScale != null) {
			const normalScaleLocation = gl.getUniformLocation(program, "normalScale");
			gl.uniform2fv(normalScaleLocation, normalScale);
		}
	};
}
