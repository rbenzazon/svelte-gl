const HalfFloatType = 1016;
const FloatType = 1015;

export async function loadRGBE(url) {
	const response = await fetch(url);
	const buffer = await response.arrayBuffer();
	return parseRGBE(buffer);
}

/**
 *
 * @param {ArrayBuffer} buffer
 * @returns {{
 * width: number,
 * height: number,
 * data: Float32Array | Uint16Array,
 * header: string,
 * gamma: number,
 * exposure: number,
 * type: number
 * }}
 */
export function parseRGBE(buffer) {
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
			break;
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
			if (false !== consume) buffer.pos += len + i + 1;
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
			2 !== buffer[0] || 2 !== buffer[1] ||
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
