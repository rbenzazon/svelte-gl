import { extractMPF } from "./extract-mpf";
import { extractXMP } from "./extract-xmp";
import { getHTMLImageFromBlob } from "./image-from-blob";
import { compileShaders } from "../../store/gl";

const quadPosition = new Float32Array([-1, 1, 0, 1, 1, 0, -1, -1, 0, 1, -1, 0]);
const quadUV = new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]);

export async function decodeJPEGHDRLoader(imageUrl) {
	//create canvas
	const canvas = document.getElementsByTagName("canvas")[0];
	const gl = canvas.getContext("webgl2");
	const imageLoader = await fetch(imageUrl);
	const imageBuffer = await imageLoader.arrayBuffer();
	const metadata = extractXMP(imageBuffer);

	const images = extractMPF(imageBuffer);

	if (images.length !== 2) {
		return null;
	}

	const { texture, width, height } = await renderHDRJPEG(images, gl, metadata);
	return {
		texture,
		width,
		height,
	};
}

async function renderHDRJPEG(images, gl, metadata) {
	const ext = gl.getExtension("EXT_color_buffer_float");
	if (!ext) {
		throw new Error("EXT_color_buffer_float extension not supported");
	}
	const sdr = await getHTMLImageFromBlob(images[0]);
	const gainMap = await getHTMLImageFromBlob(images[1]);
	const { width, height } = sdr;

	const { sdrTexture, gainMapTexture } = createImageTextures(gl, sdr, gainMap);

	const { fbo, texture } = createFBO(gl, width, height);

	const { hdrCapacityMin, hdrCapacityMax } = metadata;

	const maxDisplayBoost = Math.pow(2, metadata.hdrCapacityMax);

	const uniforms = {
		sdr: sdrTexture,
		gainMap: gainMapTexture,
		gamma: metadata.gamma != null ? new Array(3).fill(metadata.gamma) : [1, 1, 1],
		offsetHDR: metadata.offsetHDR != null ? new Array(3).fill(metadata.offsetHDR) : [1, 1, 1],
		offsetSDR: metadata.offsetSDR != null ? new Array(3).fill(metadata.offsetSDR) : [1, 1, 1],
		gainMapMin: metadata.gainMapMin != null ? new Array(3).fill(metadata.gainMapMin) : [0, 0, 0],
		gainMapMax: metadata.gainMapMax != null ? new Array(3).fill(metadata.gainMapMax) : [1, 1, 1],
		weightFactor: (Math.log2(maxDisplayBoost) - hdrCapacityMin) / (hdrCapacityMax - hdrCapacityMin),
	};

	const attributes = {
		position: { data: quadPosition, size: 3 },
		uv: { data: quadUV, size: 2 },
	};
	const program = createProgram(gl, vertexShader, fragmentShader, uniforms, attributes);

	bindFrameBuffer(gl, fbo, texture);
	const previousState = getCurrentGLState(gl);
	const nextState = {
		viewport: [0, 0, width, height],
		depthTest: false,
		depthWrite: false,
		blendEnabled: false,
		clear: true,
	};
	setVieportState(gl, nextState);
	render(gl);
	setVieportState(gl, previousState);
	//gl.useProgram(gl, null);

	return {
		texture,
		width,
		height,
	};
}
/**
 *
 * @param {WebGL2RenderingContext} gl
 * @param {*} sdr
 * @param {*} gainMap
 * @returns
 */
function createImageTextures(gl, sdr, gainMap) {
	const sdrTexture = gl.createTexture();
	//setupTexture
	gl.bindTexture(gl.TEXTURE_2D, sdrTexture);
	//gl.RGBA
	// Enable sRGB conversion
	gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.BROWSER_DEFAULT_WEBGL);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, sdr);
	setTextureParams(gl);
	const gainMapTexture = gl.createTexture();
	//setupTexture
	gl.bindTexture(gl.TEXTURE_2D, gainMapTexture);
	gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, gainMap);
	setTextureParams(gl);
	gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.BROWSER_DEFAULT_WEBGL);
	return { sdrTexture, gainMapTexture };
}

function render(gl) {
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function bindFrameBuffer(gl, fbo, texture) {
	gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
}

/**
 *
 * @param {WebGL2RenderingContext} gl
 * @param {*} state
 */
function setVieportState(gl, state) {
	if (state.blendEnabled) {
		gl.enable(gl.BLEND);
	} else {
		gl.disable(gl.BLEND);
	}
	if (state.depthTest) {
		gl.enable(gl.DEPTH_TEST);
	} else {
		gl.disable(gl.DEPTH_TEST);
	}
	gl.depthMask(state.depthWrite);
	const [x, y, width, height] = state.viewport;
	if (!isNaN(width) && !isNaN(height)) {
		gl.viewport(x, y, width, height);
	}
	if (state.clear) {
		gl.clearColor(0, 0, 0, 1);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	}
}

function getCurrentGLState(gl) {
	const viewport = gl.getParameter(gl.VIEWPORT);
	const depthTest = gl.getParameter(gl.DEPTH_TEST);
	const depthWrite = gl.getParameter(gl.DEPTH_WRITEMASK);
	const blendEnabled = gl.getParameter(gl.BLEND);
	return { viewport, depthTest, depthWrite, blendEnabled };
}

function createProgram(gl, vertexShader, fragmentShader, uniforms, attributes) {
	const program = gl.createProgram();
	compileShaders(gl, program, vertexShader, fragmentShader);
	gl.linkProgram(program);
	gl.useProgram(program);
	setUniforms(gl, program, uniforms);
	setAttributes(gl, program, attributes);
	return program;
}

function setUniforms(gl, program, uniforms) {
	for (const [name, value] of Object.entries(uniforms)) {
		const location = gl.getUniformLocation(program, name);
		if (value instanceof WebGLTexture) {
			const id = name === "sdr" ? 0 : 1;
			gl.activeTexture(gl["TEXTURE" + id]);
			gl.bindTexture(gl.TEXTURE_2D, value);
			gl.uniform1i(location, id);
		} else if (Array.isArray(value)) {
			switch (value.length) {
				case 2:
					gl.uniform2fv(location, value);
					break;
				case 3:
					gl.uniform3fv(location, value);
					break;
				case 4:
					gl.uniform4fv(location, value);
					break;
				default:
			}
		} else {
			gl.uniform1f(location, value);
		}
	}
}

function setAttributes(gl, program, attributes) {
	for (const [name, { data, size }] of Object.entries(attributes)) {
		const location = gl.getAttribLocation(program, name);
		const buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
		gl.enableVertexAttribArray(location);
		gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
	}
}

function setTextureParams(gl) {
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
}

/**
 *
 * @param {WebGL2RenderingContext} gl
 * @param {*} width
 * @param {*} height
 * @returns
 */
function createFBO(gl, width, height) {
	const texture = gl.createTexture();

	gl.bindTexture(gl.TEXTURE_2D, texture);
	setTextureParams(gl);
	gl.texImage2D(
		gl.TEXTURE_2D,
		0,
		gl.RGBA16F, // Internal format for HDR
		width,
		height,
		0,
		gl.RGBA,
		gl.HALF_FLOAT,
		null,
	);

	const fbo = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

	gl.bindTexture(gl.TEXTURE_2D, null);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

	return { fbo, texture };
}

const vertexShader = /* glsl */ `#version 300 es

precision highp float;

in vec3 position;
in vec2 uv;

out vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `#version 300 es

precision highp float;
// min half float value
#define HALF_FLOAT_MIN vec3( -65504, -65504, -65504 )
// max half float value
#define HALF_FLOAT_MAX vec3( 65504, 65504, 65504 )

uniform sampler2D sdr;
uniform sampler2D gainMap;
uniform vec3 gamma;
uniform vec3 offsetHDR;
uniform vec3 offsetSDR;
uniform vec3 gainMapMin;
uniform vec3 gainMapMax;
uniform float weightFactor;

in vec2 vUv;

out vec4 fragColor;

vec4 sRGBToLinear(vec4 srgbColor) {
	vec3 linearRGB = vec3(0.0);
	vec3 sRGB = srgbColor.rgb;
	
	// For each color channel, apply the proper conversion
	for (int i = 0; i < 3; i++) {
	  if (sRGB[i] <= 0.04045) {
		linearRGB[i] = sRGB[i] / 12.92;
	  } else {
		linearRGB[i] = pow((sRGB[i] + 0.055) / 1.055, 2.4);
	  }
	}
	return srgbColor;
	return vec4(linearRGB, srgbColor.a);
}

void main() {
  vec3 rgb = texture( sdr, vUv ).rgb;
  vec3 recovery = texture( gainMap, vUv ).rgb;
  vec3 logRecovery = pow( recovery, gamma );
  vec3 logBoost = gainMapMin * ( 1.0 - logRecovery ) + gainMapMax * logRecovery;
  vec3 hdrColor = (rgb + offsetSDR) * exp2( logBoost * weightFactor ) - offsetHDR;
  vec3 clampedHdrColor = max( HALF_FLOAT_MIN, min( HALF_FLOAT_MAX, hdrColor ));
  fragColor = vec4( clampedHdrColor , 1.0 );
}
`;
