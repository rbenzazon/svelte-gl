import textureShader from "./texture.glsl";
import { templateLiteralRenderer } from "../shaders/template.js";
import { get } from "svelte/store";
import { appContext } from "../store/app-context";

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
 * @typedef TexturePropsBase
 * @property {"diffuse" | "normal" | "roughness" } type
 * @property {number[]} [normalScale=[1, 1]]
 * @property {"square" | "circular"} [coordinateSpace="square"]
 */
/**
 * @typedef {Object} SvelteGLImageTextureProps
 * @property {string} url
 */
/**
 * @typedef {Object} SvelteGLBufferTextureProps
 * @property {() => WebGLTexture} textureBuffer
 */
/**
 * @typedef {TexturePropsBase & (SvelteGLImageTextureProps | SvelteGLBufferTextureProps)} TextureProps
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
	let externalBuffer;
	if (props.url) {
		image = await loadTexture(props.url);
	} else if (typeof props.textureBuffer === "function") {
		externalBuffer = props.textureBuffer;
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
		setupTexture: setupTexture(image, types[props.type], id[props.type], props.normalScale, setBuffer, externalBuffer),
		bindTexture: bindTexture(id[props.type], getBuffer, types[props.type]),
		...(props.url ? { url: props.url } : {}),
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

function setupTexture(texture, type, id, normalScale = [1, 1], setBuffer, externalBuffer = null) {
	return function setupTexture() {
		const { gl, program } = appContext;
		let textureBuffer;
		if (externalBuffer !== null) {
			textureBuffer = externalBuffer();
		} else {
			textureBuffer = gl.createTexture();
		}
		setBuffer(textureBuffer);
		const textureLocation = gl.getUniformLocation(program, type);
		gl.activeTexture(gl["TEXTURE" + id]);
		gl.bindTexture(gl.TEXTURE_2D, textureBuffer);
		gl.uniform1i(textureLocation, id);
		if (externalBuffer === null) {
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture);
		}
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.generateMipmap(gl.TEXTURE_2D);
		if (normalScale != null) {
			const normalScaleLocation = gl.getUniformLocation(program, "normalScale");
			gl.uniform2fv(normalScaleLocation, normalScale);
		}
	};
}
