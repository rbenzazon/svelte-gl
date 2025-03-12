import { aa as templateLiteralRenderer, V as createVec3, ay as create, X as lookAt, T as compileShaders, z as createZeroMatrix, Y as linkProgram, Z as validateProgram, $ as useProgram, a0 as selectProgram, a1 as unbindTexture, az as createProgram, R as appContext, L as drawModes, S as SvelteComponent, i as init, s as safe_not_equal, M as Menu, e as element, a as space, c as create_component, b as insert, m as mount_component, n as noop, t as transition_in, d as transition_out, f as detach, g as destroy_component, h as component_subscribe, o as onMount, r as renderer, l as lights, j as scene, k as materials, q as renderPasses, p as camera, A as set_store_value, B as skyblue, C as createLightStore, D as createPointLight, y as identity, E as create3DObject, F as createOrbitControls, G as binding_callbacks, H as createMaterialStore } from './Menu-l0HugrEy.js';
import { c as createSkyBox } from './skybox-DMzpRMKC.js';
import { c as createCube } from './cube-CWs5judv.js';
import { c as createDebugObject, a as createDebugNormalsProgram } from './debug-program-BMfuwhHg.js';

const HalfFloatType = 1016;
const FloatType = 1015;

/**
 * @typedef {Object} RGBE
 * @property {number} width
 * @property {number} height
 * @property {Uint16Array} data
 * @property {string} header
 * @property {number} gamma
 * @property {number} exposure
 * @property {number} type
 */

async function loadRGBE(url) {
	const response = await fetch(url);
	const buffer = await response.arrayBuffer();
	return parseRGBE(buffer);
}

/**
 *
 * @param {ArrayBuffer} buffer
 * @returns {RGBE}
 */
function parseRGBE(buffer) {
	/* default error routine.  change this to change error handling */
	const type = HalfFloatType;
	const rgbe_read_error = 1;
	const rgbe_write_error = 2;
	const rgbe_format_error = 3;
	const rgbe_memory_error = 4;

	/* offsets to red, green, and blue components in a data (float) pixel */
	//RGBE_DATA_RED = 0,
	//RGBE_DATA_GREEN = 1,
	//RGBE_DATA_BLUE = 2,

	/* number of floats per pixel, use 4 since stored in rgba image format */
	//RGBE_DATA_SIZE = 4,

	/* flags indicating which fields in an rgbe_header_info are valid */
	const RGBE_VALID_PROGRAMTYPE = 1;
	const RGBE_VALID_FORMAT = 2;
	const RGBE_VALID_DIMENSIONS = 4;

	const NEWLINE = "\n";

	const byteArray = new Uint8Array(buffer);
	byteArray.pos = 0;
	const rgbe_header_info = RGBE_ReadHeader(byteArray);

	const w = rgbe_header_info.width,
		h = rgbe_header_info.height,
		image_rgba_data = RGBE_ReadPixels_RLE(byteArray.subarray(byteArray.pos), w, h);

	let data;
	let numElements;

	switch (type) {
		case FloatType:
			numElements = image_rgba_data.length / 4;
			const floatArray = new Float32Array(numElements * 4);

			for (let j = 0; j < numElements; j++) {
				RGBEByteToRGBFloat(image_rgba_data, j * 4, floatArray, j * 4);
			}

			data = floatArray;
			break;

		case HalfFloatType:
			numElements = image_rgba_data.length / 4;
			const halfArray = new Uint16Array(numElements * 4);

			for (let j = 0; j < numElements; j++) {
				RGBEByteToRGBHalf(image_rgba_data, j * 4, halfArray, j * 4);
			}

			data = halfArray;
			break;

		default:
			throw new Error("THREE.RGBELoader: Unsupported type: " + type);
	}

	return {
		width: w,
		height: h,
		data: data,
		header: rgbe_header_info.string,
		gamma: rgbe_header_info.gamma,
		exposure: rgbe_header_info.exposure,
		type: type,
	};

	function rgbe_error(rgbe_error_code, msg) {
		switch (rgbe_error_code) {
			case rgbe_read_error:
				throw new Error("THREE.RGBELoader: Read Error: " + (msg || ""));
			case rgbe_write_error:
				throw new Error("THREE.RGBELoader: Write Error: " + (msg || ""));
			case rgbe_format_error:
				throw new Error("THREE.RGBELoader: Bad File Format: " + (msg || ""));
			default:
			case rgbe_memory_error:
				throw new Error("THREE.RGBELoader: Memory Error: " + (msg || ""));
		}
	}

	function fgets(buffer, lineLimit, consume) {
		const chunkSize = 128;

		lineLimit = !lineLimit ? 1024 : lineLimit;
		let p = buffer.pos,
			i = -1,
			len = 0,
			s = "",
			chunk = String.fromCharCode.apply(null, new Uint16Array(buffer.subarray(p, p + chunkSize)));

		while (0 > (i = chunk.indexOf(NEWLINE)) && len < lineLimit && p < buffer.byteLength) {
			s += chunk;
			len += chunk.length;
			p += chunkSize;
			chunk += String.fromCharCode.apply(null, new Uint16Array(buffer.subarray(p, p + chunkSize)));
		}

		if (-1 < i) {
			/*for (i=l-1; i>=0; i--) {
                byteCode = m.charCodeAt(i);
                if (byteCode > 0x7f && byteCode <= 0x7ff) byteLen++;
                else if (byteCode > 0x7ff && byteCode <= 0xffff) byteLen += 2;
                if (byteCode >= 0xDC00 && byteCode <= 0xDFFF) i--; //trail surrogate
            }*/
			buffer.pos += len + i + 1;
			return s + chunk.slice(0, i);
		}

		return false;
	}

	/* minimal header reading.  modify if you want to parse more information */
	function RGBE_ReadHeader(buffer) {
		// regexes to parse header info fields
		const magic_token_re = /^#\?(\S+)/,
			gamma_re = /^\s*GAMMA\s*=\s*(\d+(\.\d+)?)\s*$/,
			exposure_re = /^\s*EXPOSURE\s*=\s*(\d+(\.\d+)?)\s*$/,
			format_re = /^\s*FORMAT=(\S+)\s*$/,
			dimensions_re = /^\s*\-Y\s+(\d+)\s+\+X\s+(\d+)\s*$/,
			// RGBE format header struct
			header = {
				valid: 0 /* indicate which fields are valid */,

				string: "" /* the actual header string */,

				comments: "" /* comments found in header */,

				programtype: "RGBE" /* listed at beginning of file to identify it after "#?". defaults to "RGBE" */,

				format: "" /* RGBE format, default 32-bit_rle_rgbe */,

				gamma: 1.0 /* image has already been gamma corrected with given gamma. defaults to 1.0 (no correction) */,

				exposure: 1.0 /* a value of 1.0 in an image corresponds to <exposure> watts/steradian/m^2. defaults to 1.0 */,

				width: 0,
				height: 0 /* image dimensions, width/height */,
			};

		let line, match;

		if (buffer.pos >= buffer.byteLength || !(line = fgets(buffer))) {
			rgbe_error(rgbe_read_error, "no header found");
		}

		/* if you want to require the magic token then uncomment the next line */
		if (!(match = line.match(magic_token_re))) {
			rgbe_error(rgbe_format_error, "bad initial token");
		}

		header.valid |= RGBE_VALID_PROGRAMTYPE;
		header.programtype = match[1];
		header.string += line + "\n";

		while (true) {
			line = fgets(buffer);
			if (false === line) break;
			header.string += line + "\n";

			if ("#" === line.charAt(0)) {
				header.comments += line + "\n";
				continue; // comment line
			}

			if ((match = line.match(gamma_re))) {
				header.gamma = parseFloat(match[1]);
			}

			if ((match = line.match(exposure_re))) {
				header.exposure = parseFloat(match[1]);
			}

			if ((match = line.match(format_re))) {
				header.valid |= RGBE_VALID_FORMAT;
				header.format = match[1]; //'32-bit_rle_rgbe';
			}

			if ((match = line.match(dimensions_re))) {
				header.valid |= RGBE_VALID_DIMENSIONS;
				header.height = parseInt(match[1], 10);
				header.width = parseInt(match[2], 10);
			}

			if (header.valid & RGBE_VALID_FORMAT && header.valid & RGBE_VALID_DIMENSIONS) break;
		}

		if (!(header.valid & RGBE_VALID_FORMAT)) {
			rgbe_error(rgbe_format_error, "missing format specifier");
		}

		if (!(header.valid & RGBE_VALID_DIMENSIONS)) {
			rgbe_error(rgbe_format_error, "missing image size specifier");
		}

		return header;
	}

	function RGBE_ReadPixels_RLE(buffer, w, h) {
		const scanline_width = w;

		if (
			// run length encoding is not allowed so read flat
			scanline_width < 8 ||
			scanline_width > 0x7fff ||
			// this file is not run length encoded
			2 !== buffer[0] ||
			2 !== buffer[1] ||
			buffer[2] & 0x80
		) {
			// return the flat buffer
			return new Uint8Array(buffer);
		}

		if (scanline_width !== ((buffer[2] << 8) | buffer[3])) {
			rgbe_error(rgbe_format_error, "wrong scanline width");
		}

		const data_rgba = new Uint8Array(4 * w * h);

		if (!data_rgba.length) {
			rgbe_error(rgbe_memory_error, "unable to allocate buffer space");
		}

		let offset = 0,
			pos = 0;

		const ptr_end = 4 * scanline_width;
		const rgbeStart = new Uint8Array(4);
		const scanline_buffer = new Uint8Array(ptr_end);
		let num_scanlines = h;

		// read in each successive scanline
		while (num_scanlines > 0 && pos < buffer.byteLength) {
			if (pos + 4 > buffer.byteLength) {
				rgbe_error(rgbe_read_error);
			}

			rgbeStart[0] = buffer[pos++];
			rgbeStart[1] = buffer[pos++];
			rgbeStart[2] = buffer[pos++];
			rgbeStart[3] = buffer[pos++];

			if (2 != rgbeStart[0] || 2 != rgbeStart[1] || ((rgbeStart[2] << 8) | rgbeStart[3]) != scanline_width) {
				rgbe_error(rgbe_format_error, "bad rgbe scanline format");
			}

			// read each of the four channels for the scanline into the buffer
			// first red, then green, then blue, then exponent
			let ptr = 0,
				count;

			while (ptr < ptr_end && pos < buffer.byteLength) {
				count = buffer[pos++];
				const isEncodedRun = count > 128;
				if (isEncodedRun) count -= 128;

				if (0 === count || ptr + count > ptr_end) {
					rgbe_error(rgbe_format_error, "bad scanline data");
				}

				if (isEncodedRun) {
					// a (encoded) run of the same value
					const byteValue = buffer[pos++];
					for (let i = 0; i < count; i++) {
						scanline_buffer[ptr++] = byteValue;
					}
					//ptr += count;
				} else {
					// a literal-run
					scanline_buffer.set(buffer.subarray(pos, pos + count), ptr);
					ptr += count;
					pos += count;
				}
			}

			// now convert data from buffer into rgba
			// first red, then green, then blue, then exponent (alpha)
			const l = scanline_width; //scanline_buffer.byteLength;
			for (let i = 0; i < l; i++) {
				let off = 0;
				data_rgba[offset] = scanline_buffer[i + off];
				off += scanline_width; //1;
				data_rgba[offset + 1] = scanline_buffer[i + off];
				off += scanline_width; //1;
				data_rgba[offset + 2] = scanline_buffer[i + off];
				off += scanline_width; //1;
				data_rgba[offset + 3] = scanline_buffer[i + off];
				offset += 4;
			}

			num_scanlines--;
		}

		return data_rgba;
	}

	function RGBEByteToRGBFloat(sourceArray, sourceOffset, destArray, destOffset) {
		const e = sourceArray[sourceOffset + 3];
		const scale = Math.pow(2.0, e - 128.0) / 255.0;

		destArray[destOffset + 0] = sourceArray[sourceOffset + 0] * scale;
		destArray[destOffset + 1] = sourceArray[sourceOffset + 1] * scale;
		destArray[destOffset + 2] = sourceArray[sourceOffset + 2] * scale;
		destArray[destOffset + 3] = 1;
	}

	function RGBEByteToRGBHalf(sourceArray, sourceOffset, destArray, destOffset) {
		const e = sourceArray[sourceOffset + 3];
		const scale = Math.pow(2.0, e - 128.0) / 255.0;

		// clamping to 65504, the maximum representable value in float16
		destArray[destOffset + 0] = toHalfFloat(Math.min(sourceArray[sourceOffset + 0] * scale, 65504));
		destArray[destOffset + 1] = toHalfFloat(Math.min(sourceArray[sourceOffset + 1] * scale, 65504));
		destArray[destOffset + 2] = toHalfFloat(Math.min(sourceArray[sourceOffset + 2] * scale, 65504));
		destArray[destOffset + 3] = toHalfFloat(1);
	}
}

function toHalfFloat(val) {
	if (Math.abs(val) > 65504) console.warn("THREE.DataUtils.toHalfFloat(): Value out of range.");

	val = clamp(val, -65504, 65504);

	_tables.floatView[0] = val;
	const f = _tables.uint32View[0];
	const e = (f >> 23) & 0x1ff;
	return _tables.baseTable[e] + ((f & 0x007fffff) >> _tables.shiftTable[e]);
}

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

const _tables = /*@__PURE__*/ _generateTables();

function _generateTables() {
	// float32 to float16 helpers

	const buffer = new ArrayBuffer(4);
	const floatView = new Float32Array(buffer);
	const uint32View = new Uint32Array(buffer);

	const baseTable = new Uint32Array(512);
	const shiftTable = new Uint32Array(512);

	for (let i = 0; i < 256; ++i) {
		const e = i - 127;

		// very small number (0, -0)

		if (e < -27) {
			baseTable[i] = 0x0000;
			baseTable[i | 0x100] = 0x8000;
			shiftTable[i] = 24;
			shiftTable[i | 0x100] = 24;

			// small number (denorm)
		} else if (e < -14) {
			baseTable[i] = 0x0400 >> (-e - 14);
			baseTable[i | 0x100] = (0x0400 >> (-e - 14)) | 0x8000;
			shiftTable[i] = -e - 1;
			shiftTable[i | 0x100] = -e - 1;

			// normal number
		} else if (e <= 15) {
			baseTable[i] = (e + 15) << 10;
			baseTable[i | 0x100] = ((e + 15) << 10) | 0x8000;
			shiftTable[i] = 13;
			shiftTable[i | 0x100] = 13;

			// large number (Infinity, -Infinity)
		} else if (e < 128) {
			baseTable[i] = 0x7c00;
			baseTable[i | 0x100] = 0xfc00;
			shiftTable[i] = 24;
			shiftTable[i | 0x100] = 24;

			// stay (NaN, Infinity, -Infinity)
		} else {
			baseTable[i] = 0x7c00;
			baseTable[i | 0x100] = 0xfc00;
			shiftTable[i] = 13;
			shiftTable[i | 0x100] = 13;
		}
	}

	// float16 to float32 helpers

	const mantissaTable = new Uint32Array(2048);
	const exponentTable = new Uint32Array(64);
	const offsetTable = new Uint32Array(64);

	for (let i = 1; i < 1024; ++i) {
		let m = i << 13; // zero pad mantissa bits
		let e = 0; // zero exponent

		// normalized
		while ((m & 0x00800000) === 0) {
			m <<= 1;
			e -= 0x00800000; // decrement exponent
		}

		m &= ~0x00800000; // clear leading 1 bit
		e += 0x38800000; // adjust bias

		mantissaTable[i] = m | e;
	}

	for (let i = 1024; i < 2048; ++i) {
		mantissaTable[i] = 0x38000000 + ((i - 1024) << 13);
	}

	for (let i = 1; i < 31; ++i) {
		exponentTable[i] = i << 23;
	}

	exponentTable[31] = 0x47800000;
	exponentTable[32] = 0x80000000;

	for (let i = 33; i < 63; ++i) {
		exponentTable[i] = 0x80000000 + ((i - 32) << 23);
	}

	exponentTable[63] = 0xc7800000;

	for (let i = 1; i < 64; ++i) {
		if (i !== 32) {
			offsetTable[i] = 1024;
		}
	}

	return {
		floatView: floatView,
		uint32View: uint32View,
		baseTable: baseTable,
		shiftTable: shiftTable,
		mantissaTable: mantissaTable,
		exponentTable: exponentTable,
		offsetTable: offsetTable,
	};
}

var AGXShader = "${declaration?\r\n`\r\n// tone mapping taken from three.js\r\nfloat toneMappingExposure = ${exposure};\r\n\r\n    // Matrices for rec 2020 <> rec 709 color space conversion\r\n    // matrix provided in row-major order so it has been transposed\r\n    // https://www.itu.int/pub/R-REP-BT.2407-2017\r\nconst mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(vec3(1.6605f, -0.1246f, -0.0182f), vec3(-0.5876f, 1.1329f, -0.1006f), vec3(-0.0728f, -0.0083f, 1.1187f));\r\n\r\nconst mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(vec3(0.6274f, 0.0691f, 0.0164f), vec3(0.3293f, 0.9195f, 0.0880f), vec3(0.0433f, 0.0113f, 0.8956f));\r\n\r\n    // https://iolite-engine.com/blog_posts/minimal_agx_implementation\r\n    // Mean error^2: 3.6705141e-06\r\nvec3 agxDefaultContrastApprox(vec3 x) {\r\n\r\n    vec3 x2 = x * x;\r\n    vec3 x4 = x2 * x2;\r\n\r\n    return +15.5f * x4 * x2 - 40.14f * x4 * x + 31.96f * x4 - 6.868f * x2 * x + 0.4298f * x2 + 0.1191f * x - 0.00232f;\r\n\r\n}\r\n\r\nvec3 AgXToneMapping(vec3 color) {\r\n\r\n        // AgX constants\r\n    const mat3 AgXInsetMatrix = mat3(vec3(0.856627153315983f, 0.137318972929847f, 0.11189821299995f), vec3(0.0951212405381588f, 0.761241990602591f, 0.0767994186031903f), vec3(0.0482516061458583f, 0.101439036467562f, 0.811302368396859f));\r\n\r\n        // explicit AgXOutsetMatrix generated from Filaments AgXOutsetMatrixInv\r\n    const mat3 AgXOutsetMatrix = mat3(vec3(1.1271005818144368f, -0.1413297634984383f, -0.14132976349843826f), vec3(-0.11060664309660323f, 1.157823702216272f, -0.11060664309660294f), vec3(-0.016493938717834573f, -0.016493938717834257f, 1.2519364065950405f));\r\n\r\n        // LOG2_MIN      = -10.0\r\n        // LOG2_MAX      =  +6.5\r\n        // MIDDLE_GRAY   =  0.18\r\n    const float AgxMinEv = -12.47393f;  // log2( pow( 2, LOG2_MIN ) * MIDDLE_GRAY )\r\n    const float AgxMaxEv = 4.026069f;    // log2( pow( 2, LOG2_MAX ) * MIDDLE_GRAY )\r\n\r\n    color *= toneMappingExposure;\r\n\r\n    color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;\r\n\r\n    color = AgXInsetMatrix * color;\r\n\r\n        // Log2 encoding\r\n    color = max(color, 1e-10f); // avoid 0 or negative numbers for log2\r\n    color = log2(color);\r\n    color = (color - AgxMinEv) / (AgxMaxEv - AgxMinEv);\r\n\r\n    color = clamp(color, 0.0f, 1.0f);\r\n\r\n        // Apply sigmoid\r\n    color = agxDefaultContrastApprox(color);\r\n\r\n        // Apply AgX look\r\n        // v = agxLook(v, look);\r\n\r\n    color = AgXOutsetMatrix * color;\r\n\r\n        // Linearize\r\n    color = pow(max(vec3(0.0f), color), vec3(2.2f));\r\n\r\n    color = LINEAR_REC2020_TO_LINEAR_SRGB * color;\r\n\r\n        // Gamut mapping. Simple clamp for now.\r\n    color = clamp(color, 0.0f, 1.0f);\r\n\r\n    return color;\r\n\r\n}\r\nvec4 sRGBTransferOETF( in vec4 value ) {\r\n    return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );\r\n}\r\n` : ''\r\n}\r\n${color?\r\n`\r\n    fragColor = vec4(AgXToneMapping(fragColor.xyz),1.0f);\r\n    fragColor = sRGBTransferOETF(fragColor);\r\n` : ''\r\n}";

/**
 *
 * @param {{exposure:number}} props
 * @returns {SvelteGLToneMapping}
 */
const createAGXToneMapping = (props) => {
	return {
		exposure: `${props.exposure.toLocaleString("en", { minimumFractionDigits: 1 })}f`,
		shader: templateLiteralRenderer(AGXShader, {
			declaration: false,
			exposure: 1,
			color: false,
		}),
	};
};

/**
 * Converts the HDR image to a cube map texture
 * @param {Uint16Array} halfFloatRGBA16 - Uint16Array containing RGBA16F data
 * @param {WebGL2RenderingContext} gl - WebGL2 rendering context
 * @param {number} width - Width of the equirectangular HDR image
 * @param {number} height - Height of the equirectangular HDR image
 * @param {number} cubeSize - Size of each face of the output cubemap
 * @returns {WebGLTexture} The created cubemap texture
 */
function hdrToCube(halfFloatRGBA16, gl, width, height, cubeSize = 1024) {
	const ext = gl.getExtension("EXT_color_buffer_float");
	if (!ext) {
		throw new Error("EXT_color_buffer_float extension not supported");
	}
	// 2. Create a temporary framebuffer and textures for conversion
	const equirectTexture = createEquirectTexture(gl, halfFloatRGBA16, width, height);
	const cubemapTexture = createCubemapTexture(gl, cubeSize);

	// 3. Set up conversion shader
	const { program, vertexArray } = createEquirectToCubeProgram(gl);

	// 4. Render each face of the cubemap
	const framebuffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

	// Set up common state
	gl.useProgram(program);
	gl.bindVertexArray(vertexArray);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, equirectTexture);
	gl.uniform1i(gl.getUniformLocation(program, "equirectangularMap"), 0);

	// Projection matrix for each face view
	const projectionMatrix = createZeroMatrix();
	// Create a perspective projection with a 90-degree FOV
	const fov = Math.PI / 2; // 90 degrees in radians
	const aspect = 1; // cube faces are square
	const near = 0.1;
	const far = 10.0;
	const f = 1.0 / Math.tan(fov / 2); // cotangent of the FOV

	projectionMatrix[0] = f / aspect;
	projectionMatrix[5] = f;
	projectionMatrix[10] = (far + near) / (near - far);
	projectionMatrix[11] = -1;
	projectionMatrix[14] = (2 * far * near) / (near - far);
	const projectionLocation = gl.getUniformLocation(program, "projection");
	gl.uniformMatrix4fv(projectionLocation, false, projectionMatrix);

	// ... inside your function
	const views = [];
	/**@type {import("gl-matrix").ReadonlyVec3} */
	const eye = createVec3();

	// For each face
	for (let i = 0; i < 6; i++) {
		const viewMatrix = create();
		let lookDir, upDir;

		switch (i) {
			case 0: // POSITIVE_X
				lookDir = [1, 0, 0];
				upDir = [0, -1, 0];
				break;
			case 1: // NEGATIVE_X
				lookDir = [-1, 0, 0];
				upDir = [0, -1, 0];
				break;
			case 2: // POSITIVE_Y
				lookDir = [0, 1, 0];
				upDir = [0, 0, 1];
				break;
			case 3: // NEGATIVE_Y
				lookDir = [0, -1, 0];
				upDir = [0, 0, -1];
				break;
			case 4: // POSITIVE_Z
				lookDir = [0, 0, 1];
				upDir = [0, -1, 0];
				break;
			case 5: // NEGATIVE_Z
				lookDir = [0, 0, -1];
				upDir = [0, -1, 0];
				break;
		}

		const target = [eye[0] + lookDir[0], eye[1] + lookDir[1], eye[2] + lookDir[2]];
		lookAt(viewMatrix, eye, target, upDir);
		views.push(viewMatrix);
	}

	// Render each face
	for (let i = 0; i < 6; i++) {
		// Attach the corresponding cubemap face to the framebuffer
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, cubemapTexture, 0);

		// Check framebuffer status
		const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
		if (status !== gl.FRAMEBUFFER_COMPLETE) {
			console.error("Framebuffer not complete:", status);
			continue;
		}
		// Set the view matrix for this face
		gl.uniformMatrix4fv(gl.getUniformLocation(program, "view"), false, views[i]);

		// Clear and render
		gl.viewport(0, 0, cubeSize, cubeSize);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		// Draw a full-screen quad with two triangles (6 vertices)
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	}

	// Clean up
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.deleteFramebuffer(framebuffer);
	gl.deleteTexture(equirectTexture);

	// Generate mipmaps for the cubemap
	gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubemapTexture);
	gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
	return cubemapTexture;
}
/**
 *
 * @param {number} exposure
 * @returns {SvelteGLToneMapping}
 */
function getToneMapping(exposure) {
	return createAGXToneMapping({ exposure });
}

/**
 * Create a texture for the equirectangular HDR data
 * @param {WebGL2RenderingContext} gl - WebGL2 rendering context
 * @param {Uint16Array} data - RGBA16F data
 * @param {number} width - Width of the texture
 * @param {number} height - Height of the texture
 * @returns {WebGLTexture} The created texture
 */
function createEquirectTexture(gl, data, width, height) {
	const texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);

	// Upload the data
	gl.texImage2D(
		gl.TEXTURE_2D,
		0,
		gl.RGBA16F, // Internal format for HDR
		width,
		height,
		0,
		gl.RGBA,
		gl.HALF_FLOAT,
		data,
	);

	// Set texture parameters
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

	return texture;
}

/**
 * Create an empty cubemap texture
 * @param {WebGL2RenderingContext} gl - WebGL2 rendering context
 * @param {number} size - Size of each face
 * @returns {WebGLTexture} The created cubemap texture
 */
function createCubemapTexture(gl, size) {
	const texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

	// Create empty texture for each face
	for (let i = 0; i < 6; i++) {
		gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, gl.RGBA16F, size, size, 0, gl.RGBA, gl.HALF_FLOAT, null);
	}

	// Set texture parameters
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

	return texture;
}

/**
 * Create the shader program and VAO for equirect to cubemap conversion
 * @param {WebGL2RenderingContext} gl - WebGL2 rendering context
 * @returns {{program:WebGLProgram,vertexArray:WebGLVertexArrayObject}} Object containing the program and VAO
 */
function createEquirectToCubeProgram(gl) {
	// Vertex shader: render a fullscreen quad properly mapped to cube face
	const vertexShaderSource = /*glsl*/ `#version 300 es

    #define SHADER_NAME hdrToCubeVertex

    layout(location = 0) in vec2 position;
    out vec3 localPos;
    uniform mat4 projection;
    uniform mat4 view;

    void main() {
        // Use the quad positions directly for rendering
        gl_Position = vec4(position, 0.0, 1.0);
        
        // Create the ray direction for this fragment
        // Map from [-1,1] to [-1,1] in view space for proper cubemap sampling
        vec4 viewPos = inverse(projection * view) * vec4(position, 1.0, 1.0);
        localPos = viewPos.xyz / viewPos.w;
    }`;

	// Fragment shader with improved spherical mapping
	const fragmentShaderSource = /*glsl*/ `#version 300 es

    #define SHADER_NAME hdrToCubeFragment

    precision highp float;
    in vec3 localPos;
    out vec4 fragColor;
    uniform sampler2D equirectangularMap;

    vec2 SampleSphericalMap(vec3 v) {
        // Convert direction vector to spherical coordinates
        float phi = atan(v.z, v.x);
        float theta = asin(v.y);
        
        // Map from [-π to π] for phi and [-π/2 to π/2] for theta to [0,1] range
        vec2 uv = vec2(
            0.5 + 0.5 * phi / 3.1415926535897932,
            0.5 - theta / 3.1415926535897932
        );
        
        return uv;
    }

    void main() {
        vec3 direction = normalize(localPos);
        vec2 uv = SampleSphericalMap(direction);
        fragColor = texture(equirectangularMap, uv);
    }`;
	
	const program = gl.createProgram();

	compileShaders(gl,program,vertexShaderSource,fragmentShaderSource);

	gl.linkProgram(program);

	// Check for shader compilation and program link errors
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		console.error("Shader program error:", gl.getProgramInfoLog(program));
		throw new Error("Failed to compile shaders");
	}

	// Use a simple full-screen quad
	const vertexArray = gl.createVertexArray();
	gl.bindVertexArray(vertexArray);

	// Define a full-screen quad (two triangles)
	const vertices = new Float32Array([
		-1.0,
		-1.0, // bottom-left
		1.0,
		-1.0, // bottom-right
		-1.0,
		1.0, // top-left
		1.0,
		1.0, // top-right
	]);

	// Create and bind buffers
	const vertexBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

	// Set up vertex attribute
	gl.enableVertexAttribArray(0);
	gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

	return { program, vertexArray };
}

var PMREMVertex = "#version 300 es\r\n\r\nprecision mediump float;\r\nprecision mediump int;\r\n\r\nin vec3 position;\r\nin vec2 uv;\r\nin float faceIndex;\r\n\r\nout vec3 vOutputDirection;\r\n\r\n// RH coordinate system; PMREM face-indexing convention\r\nvec3 getDirection(vec2 uv, float face) {\r\n\r\n    uv = 2.0 * uv - 1.0;\r\n\r\n    vec3 direction = vec3(uv, 1.0);\r\n\r\n    if(face == 0.0) {\r\n\r\n        direction = direction.zyx; // ( 1, v, u ) pos x\r\n\r\n    } else if(face == 1.0) {\r\n\r\n        direction = direction.xzy;\r\n        direction.xz *= -1.0; // ( -u, 1, -v ) pos y\r\n\r\n    } else if(face == 2.0) {\r\n\r\n        direction.x *= -1.0; // ( -u, v, 1 ) pos z\r\n\r\n    } else if(face == 3.0) {\r\n\r\n        direction = direction.zyx;\r\n        direction.xz *= -1.0; // ( -1, v, -u ) neg x\r\n\r\n    } else if(face == 4.0) {\r\n\r\n        direction = direction.xzy;\r\n        direction.xy *= -1.0; // ( -u, -1, v ) neg y\r\n\r\n    } else if(face == 5.0) {\r\n\r\n        direction.z *= -1.0; // ( u, v, -1 ) neg z\r\n\r\n    }\r\n\r\n    return direction;\r\n\r\n}\r\n\r\nvoid main() {\r\n\r\n    vOutputDirection = getDirection(uv, faceIndex);\r\n    gl_Position = vec4(position, 1.0);\r\n\r\n}";

var EquiRectangularToCubeUV = "#version 300 es\r\n\r\nprecision mediump float;\r\nprecision mediump int;\r\n\r\n#define RECIPROCAL_PI 0.3183098861837907\r\n#define RECIPROCAL_PI2 0.15915494309189535\r\n\r\nuniform float flipEnvMap;\r\n\r\nin vec3 vOutputDirection;\r\n\r\nuniform sampler2D skyBox;\r\n\r\nout vec4 fragColor;\r\n\r\nvec2 equirectUv( in vec3 dir ) {\r\n    float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;\r\n    float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;\r\n    return vec2( u, v );\r\n}\r\n\r\nvoid main() {\r\n    vec3 outputDirection = normalize( vOutputDirection );\r\n    vec2 uv = equirectUv( outputDirection );\r\n    fragColor = vec4( texture ( skyBox, uv ).rgb, 1.0 );\r\n}";

const LOD_MIN = 4;
const EXTRA_LOD_SIGMA = [
    0.125,
    0.215,
    0.35,
    0.446,
    0.526,
    0.582
];
/**
 * @typedef {Object} EnvMapPass
 * @property {import("src/store/programs").SvelteGLProgram[]} programs array of programs used in the pass
 * @property {() => WebGLTexture} getTexture function to get the shadow texture
 * @property {number} order order of the pass in the rendering pipeline
 */

/**
 * 
 * @param {import("src/loaders/rgbe-loader").RGBE} image 
 * @return {EnvMapPass} 
 */
function createEnvironmentMap(image) {
    let context = {};

    //context.cubeMapTexture = getCubeMapTexture();
    context.image = image;
    context.cubeImageSize = image.width / 4;//??
    context.lodMax = Math.floor(Math.log2(context.cubeImageSize));
    context.cubeSize = Math.pow(2, context.lodMax);
    context.renderTargetWidth = 3 * Math.max(context.cubeSize, 16 * 7);
    context.renderTargetHeight = 4 * context.cubeSize;
    createLodPlanes(context);

    logLodPlane(context.lodPlanes[0]);

    let hdrTexture;
    function setHDRTexture(texture) {
        hdrTexture = texture;
    }
    function getHDRTexture() {
        return hdrTexture;
    }

    let pingTexture;
    function setPingTexture(texture) {
        pingTexture = texture;
    }
    function getPingTexture() {
        return pingTexture;
    }
    let pingFBO;
    function setPingFBO(fbo) {
        pingFBO = fbo;
    }
    function getPingFBO() {
        return pingFBO;
    }
    
    return {
        programs: [
            {
                createProgram: createEquiRectangularToCubeUVProgram(context, image, setHDRTexture),
                setupProgram: [
                    createEquiRectangularToCubeUVShaders,
                    linkProgram,
                    validateProgram,
                    createFBO(context, setPingFBO, setPingTexture),
                ],
                useProgram,
                selectProgram,
                setupMaterial: [setupEquiRectangularToCubeUVUniforms, bindEnvMapTexture(getHDRTexture)],
                setupCamera: () => () => { },
                setFrameBuffer: setFrameBuffer(getPingFBO, context,getViewportSize),
                meshes: [context.lodPlanes[0]],
                postDraw: unbindTexture,
            }
        ],
        getTexture: getPingTexture,
        order: -1,
    }
}
function getViewportSize(context) {
    const size = context.cubeSize;
    return {
        width: 3 * size,
        height: 2 * size,
    }
}

/**
 * 
 * @param {Object} context 
 * @param {import("src/loaders/rgbe-loader").RGBE} image 
 * @param {(value:WebGLTexture)=>void} setHDRTexture 
 * @returns {(programStore)=>()=>void}
 */
function createEquiRectangularToCubeUVProgram(context, image,setHDRTexture) {
    console.log("createCubeMapToCubeUVProgram", context, image);
    return function createEquiRectangularToCubeUVProgram(programStore) {
        return function createEquiRectangularToCubeUVProgram() {
            setupHDRTexture(image, setHDRTexture);
            createProgram(programStore)();
        }
    }
}

function setupHDRTexture(image, setHDRTexture) {
    const { gl } = appContext;
    const texture = gl.createTexture();
    setHDRTexture(texture);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA16F,
        image.width,
        image.height,
        0,
        gl.RGBA,
        gl.HALF_FLOAT,
        image.data
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
}

function createEquiRectangularToCubeUVShaders() {
    const { gl, program } = appContext;
    compileShaders(gl, program, PMREMVertex, EquiRectangularToCubeUV);
}

function createFBO(context, setFBO, setTexture) {
    return function createFBO() {
        const { gl } = appContext;
        const { renderTargetWidth, renderTargetHeight } = context;
        console.log("createFBO", renderTargetWidth, renderTargetHeight);
        
        // The geometry texture will be sampled during the HORIZONTAL pass
        const texture = gl.createTexture();
        setTexture(texture);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, renderTargetWidth, renderTargetHeight);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        const fbo = gl.createFramebuffer();
        setFBO(fbo);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    };
}

function setupEquiRectangularToCubeUVUniforms() {
    return function setupEquiRectangularToCubeUVUniforms() {
        const { gl, program } = appContext;
        const location = gl.getUniformLocation(program, "flipEnvMap");
        gl.uniform1f(location, -1);
    }
}

function bindEnvMapTexture(getBuffer) {
    return function bindEnvMapTexture() {
        const { gl, program } = appContext;
        const textureLocation = gl.getUniformLocation(program, "skyBox");
        gl.uniform1i(textureLocation, 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, getBuffer());
    };
}


function setFrameBuffer(getFBO = null, context,getViewportSize) {
    return function setFrameBuffer() {
        const { gl } = appContext;
        const fbo = getFBO ? getFBO() : null;
        const { renderTargetWidth, renderTargetHeight } = context;
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        if (appContext.fbo !== fbo && fbo != null) {
            console.log("framebuffer change clearing from", appContext.fbo, "to", fbo, [0, 0, 0, 1], renderTargetWidth, renderTargetHeight);
            const {width, height} = getViewportSize(context);
            gl.viewport(0, 0, width, height);
            appContext.frameBufferWidth = renderTargetWidth;
            appContext.frameBufferHeight = renderTargetHeight;
            gl.clearColor(...[0, 0, 0, 0]);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        }
        appContext.fbo = fbo;
    };
}

function createLodPlanes(context) {
    const lodPlanes = [];
    const sizeLods = [];
    const sigmas = [];

    let lod = context.lodMax;
    console.log("context.lodMax", context.lodMax);
    const totalLods = context.lodMax - LOD_MIN + 1 + EXTRA_LOD_SIGMA.length;

    for (let lodIndex = 0; lodIndex < totalLods; lodIndex++) {
        const sizeLod = Math.pow(2, lod);
        console.log("lod", lod,"sizeLod", sizeLod);
        
        sizeLods.push(sizeLod);
        let sigma = 1.0 / sizeLod;

        if (lodIndex > context.lodMax - LOD_MIN) {

            sigma = EXTRA_LOD_SIGMA[lodIndex - context.lodMax + LOD_MIN - 1];

        } else if (lodIndex === 0) {

            sigma = 0;

        }

        sigmas.push(sigma);

        const texelSize = 1.0 / (sizeLod - 2);
        const min = - texelSize;
        const max = 1 + texelSize;
        const uv1 = [min, min, max, min, max, max, min, min, max, max, min, max];

        const cubeFaces = 6;
        const vertices = 6;
        const positionSize = 3;
        const uvSize = 2;
        const faceIndexSize = 1;

        const position = new Float32Array(positionSize * vertices * cubeFaces);
        const uv = new Float32Array(uvSize * vertices * cubeFaces);
        const faceIndex = new Float32Array(faceIndexSize * vertices * cubeFaces);
        for (let face = 0; face < cubeFaces; face++) {

            const x = (face % 3) * 2 / 3 - 1;
            const y = face > 2 ? 0 : - 1;
            const coordinates = [
                x, y, 0,
                x + 2 / 3, y, 0,
                x + 2 / 3, y + 1, 0,
                x, y, 0,
                x + 2 / 3, y + 1, 0,
                x, y + 1, 0
            ];
            position.set(coordinates, positionSize * vertices * face);
            uv.set(uv1, uvSize * vertices * face);
            const fill = [face, face, face, face, face, face];
            faceIndex.set(fill, faceIndexSize * vertices * face);

        }
        const geometry = {
            attributes: {
                positions: position,
                uvs: uv,
                faceIndex:{
                    array: faceIndex,
                    itemSize: faceIndexSize
                },
            },
            drawMode:drawModes[4],
        };
        lodPlanes.push(geometry);

        if (lod > LOD_MIN) {

            lod--;
            console.log("lod", lod);

        }
    }
    context.lodPlanes = lodPlanes;
    context.sizeLods = sizeLods;
    context.sigmas = sigmas;

}

function logLodPlane(lodPlane){
    const faces = [];
    //one face is composed of 6 vertices, which are composed of 3 positions
    //
    for(let i = 0;i<6;i++){
        //ignore z the triangles are flat
        //positions is a typearray
        //const points = lodPlane.attributes.positions.slice(i*3*6, 3*6);
        const point = lodPlane.attributes.positions;
        const points = [
            [point[i*3], point[i*3+1], point[i*3+2]],
            [point[i*3+3], point[i*3+4], point[i*3+5]],
            [point[i*3+6], point[i*3+7], point[i*3+8]],
            [point[i*3+9], point[i*3+10], point[i*3+11]],
            [point[i*3+12], point[i*3+13], point[i*3+14]],
            [point[i*3+15], point[i*3+16], point[i*3+17]],
        ];
        //take the smallest x
        const x = points.map(p=>p[0]).reduce((a,b)=>Math.min(a,b));
        const y = points.map(p=>p[1]).reduce((a,b)=>Math.min(a,b));
        const width = points.map(p=>p[0]).reduce((a,b)=>Math.max(a,b)) - x;
        const height = points.map(p=>p[1]).reduce((a,b)=>Math.max(a,b)) - y;


        
        
        faces.push({
            x,
            y,
            width,
            height,
        });

    }
    console.log("faces",faces);
}

/* src\skybox.svelte generated by Svelte v4.2.18 */

function create_fragment(ctx) {
	let canvas_1;
	let t;
	let menu;
	let current;
	menu = new Menu({});

	return {
		c() {
			canvas_1 = element("canvas");
			t = space();
			create_component(menu.$$.fragment);
		},
		m(target, anchor) {
			insert(target, canvas_1, anchor);
			/*canvas_1_binding*/ ctx[1](canvas_1);
			insert(target, t, anchor);
			mount_component(menu, target, anchor);
			current = true;
		},
		p: noop,
		i(local) {
			if (current) return;
			transition_in(menu.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(menu.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(canvas_1);
				detach(t);
			}

			/*canvas_1_binding*/ ctx[1](null);
			destroy_component(menu, detaching);
		}
	};
}

function animate() {
	
}

function instance($$self, $$props, $$invalidate) {
	let $renderer;
	let $lights;
	let $scene;
	let $materials;
	let $renderPasses;
	let $camera;
	component_subscribe($$self, renderer, $$value => $$invalidate(3, $renderer = $$value));
	component_subscribe($$self, lights, $$value => $$invalidate(4, $lights = $$value));
	component_subscribe($$self, scene, $$value => $$invalidate(5, $scene = $$value));
	component_subscribe($$self, materials, $$value => $$invalidate(6, $materials = $$value));
	component_subscribe($$self, renderPasses, $$value => $$invalidate(7, $renderPasses = $$value));
	component_subscribe($$self, camera, $$value => $$invalidate(8, $camera = $$value));
	let canvas;
	let rgbeImage;

	onMount(async () => {
		set_store_value(
			renderer,
			$renderer = {
				...$renderer,
				canvas,
				backgroundColor: skyblue,
				ambientLightColor: [0xffffff, 0.1]
			},
			$renderer
		);

		set_store_value(
			camera,
			$camera = {
				...$camera,
				position: [-4.5, 0.8, -2.5],
				target: [0, 0, 0],
				fov: 75
			},
			$camera
		);

		rgbeImage = await loadRGBE("christmas_photo_studio_01_4k.hdr");
		const hdrToneMapping = getToneMapping(1.5);

		const skyBox = await createSkyBox({
			typedArray: rgbeImage.data,
			convertToCube: hdrToCube,
			width: rgbeImage.width,
			height: rgbeImage.height,
			cubeSize: 2048,
			toneMapping: hdrToneMapping
		});

		const environmentMap = createEnvironmentMap(rgbeImage);
		console.log("environmentMap", environmentMap);
		set_store_value(renderPasses, $renderPasses = [skyBox, environmentMap], $renderPasses);
		const cubeMesh = createCube();

		const light = createLightStore(createPointLight({
			position: [-2, 2, 2],
			color: [1, 1, 1],
			intensity: 20,
			cutoffDistance: 0,
			decayExponent: 2
		}));

		const matrix = identity(createZeroMatrix());

		const debugProgram = createMaterialStore({
			diffuse: [1, 0, 0],
			metalness: 0,
			program: createDebugNormalsProgram()
		});

		const debugNormalMesh = createDebugObject({
			...cubeMesh,
			matrix,
			material: debugProgram
		});

		const material = createMaterialStore({ diffuse: [1, 0.5, 0.5], metalness: 0 }); //enviromentMap,
		set_store_value(materials, $materials = [...$materials, material, debugProgram], $materials);

		set_store_value(
			scene,
			$scene = [
				...$scene,
				create3DObject({ ...cubeMesh, matrix, material }),
				create3DObject(debugNormalMesh)
			],
			$scene
		);

		set_store_value(lights, $lights = [...$lights, light], $lights);

		set_store_value(
			renderer,
			$renderer = {
				...$renderer,
				loop: animate,
				enabled: true
			},
			$renderer
		);

		createOrbitControls(canvas, camera);
	});

	function canvas_1_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			canvas = $$value;
			$$invalidate(0, canvas);
		});
	}

	return [canvas, canvas_1_binding];
}

class Skybox extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, {});
	}
}

export { Skybox as default };
