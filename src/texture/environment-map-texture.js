import envMapShader from "./environment-map-fragment.glsl";
import { templateLiteralRenderer } from "../shaders/template.js";
import { get } from "svelte/store";
import { appContext } from "../store/app-context";
import { createZeroMatrix } from "../geometries/common";
import { identity } from "gl-matrix/cjs/mat3.js";

const envMapID = 3;

const envMapType = "envMap";

/**
 * @typedef {object} EnvMapTextureProps
 * @property {() => WebGLTexture} envMap
 * @property {number} width
 * @property {number} height
 * @property {number} lodMax
 * @property {number} [envMapIntensity = 1]
 * @property {mat3} [envMapRotation]
 */

/**
 * @typedef {Object} EnvMapTexture
 * @property {typeof envMapType} type
 * @property {number} [envMapIntensity = 1]
 * @property {mat3} [envMapRotation]
 * @property {import("../shaders/template").TemplateRenderer} shader
 * @property {Object<string, number|string>} shaderDefines
 * @property {()=>void} setupTexture
 * @property {()=>void} bindTexture
 * @property {() => WebGLTexture} envMap
 */

/**
 * @param {EnvMapTextureProps} props
 * @returns {EnvMapTexture}
 */
export const createEnvMapTexture = ({
	envMap,
	width,
	height,
	lodMax,
	envMapIntensity = 1,
	envMapRotation = identity([]),
}) => {
	const shaderDefines = {
		CUBEUV_TEXEL_WIDTH: 1.0 / width,
		CUBEUV_TEXEL_HEIGHT: 1.0 / height,
		CUBEUV_MAX_MIP: `${lodMax}.0`,
	};
	let buffer;
	function setBuffer(value) {
		buffer = value;
	}
	function getBuffer() {
		return buffer;
	}
	return {
		type: envMapType,
		...(envMapIntensity && { envMapIntensity }),
		...(envMapRotation && { envMapRotation }),
		shader: templateLiteralRenderer(envMapShader, {
			declaration: false,
			irradiance: false,
			CUBEUV_TEXEL_WIDTH: 0,
			CUBEUV_TEXEL_HEIGHT: 0,
			CUBEUV_MAX_MIP: 0,
		}),
		shaderDefines,
		setupTexture: setupTexture(envMap, setBuffer, envMapIntensity, envMapRotation),
		bindTexture: bindTexture(getBuffer),
		envMap,
	};
};

function bindTexture(getBuffer) {
	return function bindTexture() {
		const { gl, program } = appContext;
		const textureLocation = gl.getUniformLocation(program, envMapType);
		gl.activeTexture(gl["TEXTURE" + envMapID]);
		gl.bindTexture(gl.TEXTURE_2D, getBuffer());
		gl.uniform1i(textureLocation, envMapID);
	};
}

function setupTexture(textureBuffer, setBuffer, envMapIntensity, envMapRotation) {
	return function setupTexture() {
		const { gl, program } = appContext;
		setBuffer(textureBuffer());
		const textureLocation = gl.getUniformLocation(program, envMapType);
		gl.activeTexture(gl["TEXTURE" + envMapID]);
		gl.bindTexture(gl.TEXTURE_2D, textureBuffer());
		gl.uniform1i(textureLocation, envMapID);
		gl.uniform1f(gl.getUniformLocation(program, "envMapIntensity"), envMapIntensity);
		gl.uniformMatrix3fv(gl.getUniformLocation(program, "envMapRotation"), false, envMapRotation);
	};
}
