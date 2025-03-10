import { av as createProgram, X as linkProgram, Y as validateProgram, Z as useProgram, _ as selectProgram, L as drawModes, aw as getCameraProjectionView, ax as invert, z as createZeroMatrix, $ as multiply, r as renderer, K as normalize, J as subtract, U as createVec3, I as cross, R as appContext, ay as create, W as lookAt$1, S as SvelteComponent, i as init, s as safe_not_equal, M as Menu, e as element, a as space, c as create_component, b as insert, m as mount_component, n as noop, t as transition_in, d as transition_out, f as detach, g as destroy_component, h as component_subscribe, o as onMount, l as lights, j as scene, k as materials, q as renderPasses, p as camera, A as set_store_value, B as skyblue, C as createLightStore, D as createPointLight, y as identity, E as create3DObject, F as createOrbitControls, G as binding_callbacks, H as createMaterialStore } from './Menu-Cr0GMpwH.js';
import { c as createCube } from './cube-sETbO7F2.js';
import { c as createDebugObject, a as createDebugNormalsProgram } from './debug-program-C85Q3zef.js';

var skyBoxVertex = "#version 300 es\r\nin vec4 position;\r\nout vec4 v_position;\r\nvoid main() {\r\n    v_position = position;\r\n    gl_Position = position;\r\n    gl_Position.z = 1.0;\r\n}";

var skyBoxFragment = "#version 300 es\r\nprecision highp float;\r\n  \r\nuniform samplerCube skybox;\r\nuniform mat4 viewDirectionProjectionInverse;\r\n  \r\nin vec4 v_position;\r\n  \r\n// we need to declare an output for the fragment shader\r\nout vec4 outColor;\r\n  \r\nvoid main() {\r\n  vec4 t = viewDirectionProjectionInverse * v_position;\r\n  outColor = texture(skybox, normalize(t.xyz / t.w));\r\n}";

function createSkyBox(props) {
    let buffer;
	function setBuffer(value) {
		buffer = value;
	}
	function getBuffer() {
		return buffer;
	}
    let originalDepthFunc;
    function setOriginalDepthFunc(value){
        originalDepthFunc = value;
    }
    function getOriginalDepthFunc(){
        return originalDepthFunc;
    }
	const skyboxProgram = {
		createProgram,
		setupProgram: [createShaders, linkProgram, validateProgram],
		setupMaterial: [setupSkyBoxTexture(props.url,setBuffer)],
        bindTextures: [bindSkyBoxTexture(getBuffer)],
        setupCamera: setupSkyBoxCamera,
		useProgram,
		selectProgram,
		updateProgram: [setDepthFunc(setOriginalDepthFunc)],
        meshes:[createSkyBoxMesh()],
        postDraw:restoreDepthFunc(getOriginalDepthFunc),
	};
    return {
        name:"skybox",
        url:props.url,
        order:1,
        programs:[skyboxProgram],
    }
}

function createShaders() {
    const { gl, program } = appContext;
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, skyBoxVertex);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(vertexShader));
    }
    gl.attachShader(program, vertexShader);

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, skyBoxFragment);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(fragmentShader));
    }
    gl.attachShader(program, fragmentShader);
}

function createSkyBoxMesh() {
    return {
        attributes: {
            positionsSize: 2,
            positions: new Float32Array([
                -1, -1,
                 1, -1,
                -1,  1,
                -1,  1,
                 1, -1,
                 1,  1,
              ]),
        },
        drawMode: drawModes[4],
    };
}

function setupSkyBoxCamera(camera) {
    return function setupSkyBoxCamera() {
        const { gl, program, canvas } = appContext;
        
        const { projection } = getCameraProjectionView(camera, canvas.width, canvas.height);
        const viewCamera = lookAt(camera.position, camera.target, camera.up, createZeroMatrix());
        const viewMatrix = invert(createZeroMatrix(),viewCamera);

        //set translation to 0
        viewMatrix[12] = 0;
        viewMatrix[13] = 0;
        viewMatrix[14] = 0;

        const viewDirectionProjectionMatrix = multiply(createZeroMatrix(),projection, viewMatrix);
        const viewDirectionProjectionInverseMatrix = invert(createZeroMatrix(),viewDirectionProjectionMatrix);
        const viewDirectionProjectionInverseLocation = gl.getUniformLocation(program, "viewDirectionProjectionInverse");
        gl.uniformMatrix4fv(viewDirectionProjectionInverseLocation, false,viewDirectionProjectionInverseMatrix);
    };
}
function setupSkyBoxTexture(url, setBuffer){
    return function setupSkyBoxTexture(){
        const { gl } = appContext;
        const texture = gl.createTexture();
        setBuffer(texture);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
        // create a CUBE MAP texture from a single file where the faces arranged in a cross pattern
        const image = new Image();
        image.src = url;
        image.onload = function() {
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
            sliceImageAndUpload(image,gl);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
            gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
            renderer.update((renderer) => renderer);
        };
    };
}

function sliceImageAndUpload(image,gl){
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const faceWidth = image.width / 4;  // Cross is 4 tiles wide at its widest
    const faceHeight = image.height / 3; // Cross is 3 tiles high
    
    canvas.width = faceWidth;
    canvas.height = faceHeight;
    // Assuming a layout like:
    //    +Y
    // -X +Z +X -Z
    //    -Y
    const facePositions = [
        [2, 1, gl.TEXTURE_CUBE_MAP_POSITIVE_X],
        [0, 1, gl.TEXTURE_CUBE_MAP_NEGATIVE_X], 
        [1, 0, gl.TEXTURE_CUBE_MAP_POSITIVE_Y],
        [1, 2, gl.TEXTURE_CUBE_MAP_NEGATIVE_Y],
        [1, 1, gl.TEXTURE_CUBE_MAP_POSITIVE_Z],
        [3, 1, gl.TEXTURE_CUBE_MAP_NEGATIVE_Z]
    ];
    facePositions.forEach(([x, y, target]) => {
        // Clear the canvas and draw the specific region from the source image
        ctx.clearRect(0, 0, faceWidth, faceHeight);
        ctx.drawImage(image, x*faceWidth, y*faceHeight, faceWidth, faceHeight, 0, 0, faceWidth, faceHeight);
        
        // Upload the face to the appropriate cubemap target
        gl.texImage2D(
            target,       // target: which face of the cubemap
            0,            // level: mipmap level
            gl.RGBA,      // internalFormat: how GPU stores the data
            gl.RGBA,      // format: format of the pixel data
            gl.UNSIGNED_BYTE, // type: data type of the pixel data
            canvas        // pixels: source of the pixel data
        );
    });
}

function bindSkyBoxTexture(getBuffer){
    return function bindSkyBoxTexture(){
        const { gl, program } = appContext;
        const textureLocation = gl.getUniformLocation(program, "skybox");
        gl.uniform1i(textureLocation, 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, getBuffer());
    };
}

function setDepthFunc(setOriginalDepthFunc){
    return function setDepthFunc(){
        const { gl } = appContext;
        setOriginalDepthFunc(gl.getParameter(gl.DEPTH_FUNC));
        gl.depthFunc(gl.LEQUAL);
    }
}

function restoreDepthFunc(getOriginalDepthFunc){
    return function restoreDepthFunc(){
        const { gl } = appContext;
        gl.depthFunc(getOriginalDepthFunc());
    }
}

/**
 * this lookAt function is copied from webgl-3d-math library
 * it is modified to use gl-matrix functions to avoid redundancy
 * the gl-matrix lookAt is not working as intended here because
 * it create a tilt in the skybox when panning the camera
 * 
 * Copyright 2021, GFXFundamentals.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *     * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *     * Neither the name of GFXFundamentals. nor the names of his
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 * 
 * @param {*} cameraPosition 
 * @param {*} target 
 * @param {*} up 
 * @param {*} dst 
 * @returns 
 */
function lookAt(cameraPosition, target, up, dst) {
    var zAxis = normalize(createVec3(),subtract(createVec3(),cameraPosition, target));
    var xAxis = normalize(createVec3(),cross(createVec3(),up, zAxis));
    var yAxis = normalize(createVec3(),cross(createVec3(),zAxis, xAxis));
    dst[ 0] = xAxis[0];
    dst[ 1] = xAxis[1];
    dst[ 2] = xAxis[2];
    dst[ 3] = 0;
    dst[ 4] = yAxis[0];
    dst[ 5] = yAxis[1];
    dst[ 6] = yAxis[2];
    dst[ 7] = 0;
    dst[ 8] = zAxis[0];
    dst[ 9] = zAxis[1];
    dst[10] = zAxis[2];
    dst[11] = 0;
    dst[12] = cameraPosition[0];
    dst[13] = cameraPosition[1];
    dst[14] = cameraPosition[2];
    dst[15] = 1;

    return dst;
}

const HalfFloatType = 1016;
const FloatType = 1015;

async function loadRGBE(url){
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
function parseRGBE( buffer ) {
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

    const NEWLINE = '\n';

    const byteArray = new Uint8Array( buffer );
    byteArray.pos = 0;
    const rgbe_header_info = RGBE_ReadHeader( byteArray );

    const w = rgbe_header_info.width,
        h = rgbe_header_info.height,
        image_rgba_data = RGBE_ReadPixels_RLE( byteArray.subarray( byteArray.pos ), w, h );


    let data;
    let numElements;

    switch ( type ) {

        case FloatType:

            numElements = image_rgba_data.length / 4;
            const floatArray = new Float32Array( numElements * 4 );

            for ( let j = 0; j < numElements; j ++ ) {

                RGBEByteToRGBFloat( image_rgba_data, j * 4, floatArray, j * 4 );

            }

            data = floatArray;
            break;

        case HalfFloatType:

            numElements = image_rgba_data.length / 4;
            const halfArray = new Uint16Array( numElements * 4 );

            for ( let j = 0; j < numElements; j ++ ) {

                RGBEByteToRGBHalf( image_rgba_data, j * 4, halfArray, j * 4 );

            }

            data = halfArray;
            break;

        default:

            throw new Error( 'THREE.RGBELoader: Unsupported type: ' + type );

    }

    return {
        width: w, height: h,
        data: data,
        header: rgbe_header_info.string,
        gamma: rgbe_header_info.gamma,
        exposure: rgbe_header_info.exposure,
        type: type
    };

    function rgbe_error( rgbe_error_code, msg ) {

        switch ( rgbe_error_code ) {

            case rgbe_read_error: throw new Error( 'THREE.RGBELoader: Read Error: ' + ( msg || '' ) );
            case rgbe_write_error: throw new Error( 'THREE.RGBELoader: Write Error: ' + ( msg || '' ) );
            case rgbe_format_error: throw new Error( 'THREE.RGBELoader: Bad File Format: ' + ( msg || '' ) );
            default:
            case rgbe_memory_error: throw new Error( 'THREE.RGBELoader: Memory Error: ' + ( msg || '' ) );

        }

    }

    function fgets ( buffer, lineLimit, consume ) {

        const chunkSize = 128;

        lineLimit = ! lineLimit ? 1024 : lineLimit;
        let p = buffer.pos,
            i = - 1, len = 0, s = '',
            chunk = String.fromCharCode.apply( null, new Uint16Array( buffer.subarray( p, p + chunkSize ) ) );

        while ( ( 0 > ( i = chunk.indexOf( NEWLINE ) ) ) && ( len < lineLimit ) && ( p < buffer.byteLength ) ) {

            s += chunk; len += chunk.length;
            p += chunkSize;
            chunk += String.fromCharCode.apply( null, new Uint16Array( buffer.subarray( p, p + chunkSize ) ) );

        }

        if ( - 1 < i ) {

            /*for (i=l-1; i>=0; i--) {
                byteCode = m.charCodeAt(i);
                if (byteCode > 0x7f && byteCode <= 0x7ff) byteLen++;
                else if (byteCode > 0x7ff && byteCode <= 0xffff) byteLen += 2;
                if (byteCode >= 0xDC00 && byteCode <= 0xDFFF) i--; //trail surrogate
            }*/
            buffer.pos += len + i + 1;
            return s + chunk.slice( 0, i );

        }

        return false;

    }

    /* minimal header reading.  modify if you want to parse more information */
    function RGBE_ReadHeader ( buffer ) {


        // regexes to parse header info fields
        const magic_token_re = /^#\?(\S+)/,
            gamma_re = /^\s*GAMMA\s*=\s*(\d+(\.\d+)?)\s*$/,
            exposure_re = /^\s*EXPOSURE\s*=\s*(\d+(\.\d+)?)\s*$/,
            format_re = /^\s*FORMAT=(\S+)\s*$/,
            dimensions_re = /^\s*\-Y\s+(\d+)\s+\+X\s+(\d+)\s*$/,

            // RGBE format header struct
            header = {

                valid: 0, /* indicate which fields are valid */

                string: '', /* the actual header string */

                comments: '', /* comments found in header */

                programtype: 'RGBE', /* listed at beginning of file to identify it after "#?". defaults to "RGBE" */

                format: '', /* RGBE format, default 32-bit_rle_rgbe */

                gamma: 1.0, /* image has already been gamma corrected with given gamma. defaults to 1.0 (no correction) */

                exposure: 1.0, /* a value of 1.0 in an image corresponds to <exposure> watts/steradian/m^2. defaults to 1.0 */

                width: 0, height: 0 /* image dimensions, width/height */

            };

        let line, match;

        if ( buffer.pos >= buffer.byteLength || ! ( line = fgets( buffer ) ) ) {

            rgbe_error( rgbe_read_error, 'no header found' );

        }

        /* if you want to require the magic token then uncomment the next line */
        if ( ! ( match = line.match( magic_token_re ) ) ) {

            rgbe_error( rgbe_format_error, 'bad initial token' );

        }

        header.valid |= RGBE_VALID_PROGRAMTYPE;
        header.programtype = match[ 1 ];
        header.string += line + '\n';

        while ( true ) {

            line = fgets( buffer );
            if ( false === line ) break;
            header.string += line + '\n';

            if ( '#' === line.charAt( 0 ) ) {

                header.comments += line + '\n';
                continue; // comment line

            }

            if ( match = line.match( gamma_re ) ) {

                header.gamma = parseFloat( match[ 1 ] );

            }

            if ( match = line.match( exposure_re ) ) {

                header.exposure = parseFloat( match[ 1 ] );

            }

            if ( match = line.match( format_re ) ) {

                header.valid |= RGBE_VALID_FORMAT;
                header.format = match[ 1 ];//'32-bit_rle_rgbe';

            }

            if ( match = line.match( dimensions_re ) ) {

                header.valid |= RGBE_VALID_DIMENSIONS;
                header.height = parseInt( match[ 1 ], 10 );
                header.width = parseInt( match[ 2 ], 10 );

            }

            if ( ( header.valid & RGBE_VALID_FORMAT ) && ( header.valid & RGBE_VALID_DIMENSIONS ) ) break;

        }

        if ( ! ( header.valid & RGBE_VALID_FORMAT ) ) {

            rgbe_error( rgbe_format_error, 'missing format specifier' );

        }

        if ( ! ( header.valid & RGBE_VALID_DIMENSIONS ) ) {

            rgbe_error( rgbe_format_error, 'missing image size specifier' );

        }

        return header;

    }

    function RGBE_ReadPixels_RLE( buffer, w, h ) {

        const scanline_width = w;

        if (
            // run length encoding is not allowed so read flat
            ( ( scanline_width < 8 ) || ( scanline_width > 0x7fff ) ) ||
            // this file is not run length encoded
            ( ( 2 !== buffer[ 0 ] ) || ( 2 !== buffer[ 1 ] ) || ( buffer[ 2 ] & 0x80 ) )
        ) {

            // return the flat buffer
            return new Uint8Array( buffer );

        }

        if ( scanline_width !== ( ( buffer[ 2 ] << 8 ) | buffer[ 3 ] ) ) {

            rgbe_error( rgbe_format_error, 'wrong scanline width' );

        }

        const data_rgba = new Uint8Array( 4 * w * h );

        if ( ! data_rgba.length ) {

            rgbe_error( rgbe_memory_error, 'unable to allocate buffer space' );

        }

        let offset = 0, pos = 0;

        const ptr_end = 4 * scanline_width;
        const rgbeStart = new Uint8Array( 4 );
        const scanline_buffer = new Uint8Array( ptr_end );
        let num_scanlines = h;

        // read in each successive scanline
        while ( ( num_scanlines > 0 ) && ( pos < buffer.byteLength ) ) {

            if ( pos + 4 > buffer.byteLength ) {

                rgbe_error( rgbe_read_error );

            }

            rgbeStart[ 0 ] = buffer[ pos ++ ];
            rgbeStart[ 1 ] = buffer[ pos ++ ];
            rgbeStart[ 2 ] = buffer[ pos ++ ];
            rgbeStart[ 3 ] = buffer[ pos ++ ];

            if ( ( 2 != rgbeStart[ 0 ] ) || ( 2 != rgbeStart[ 1 ] ) || ( ( ( rgbeStart[ 2 ] << 8 ) | rgbeStart[ 3 ] ) != scanline_width ) ) {

                rgbe_error( rgbe_format_error, 'bad rgbe scanline format' );

            }

            // read each of the four channels for the scanline into the buffer
            // first red, then green, then blue, then exponent
            let ptr = 0, count;

            while ( ( ptr < ptr_end ) && ( pos < buffer.byteLength ) ) {

                count = buffer[ pos ++ ];
                const isEncodedRun = count > 128;
                if ( isEncodedRun ) count -= 128;

                if ( ( 0 === count ) || ( ptr + count > ptr_end ) ) {

                    rgbe_error( rgbe_format_error, 'bad scanline data' );

                }

                if ( isEncodedRun ) {

                    // a (encoded) run of the same value
                    const byteValue = buffer[ pos ++ ];
                    for ( let i = 0; i < count; i ++ ) {

                        scanline_buffer[ ptr ++ ] = byteValue;

                    }
                    //ptr += count;

                } else {

                    // a literal-run
                    scanline_buffer.set( buffer.subarray( pos, pos + count ), ptr );
                    ptr += count; pos += count;

                }

            }


            // now convert data from buffer into rgba
            // first red, then green, then blue, then exponent (alpha)
            const l = scanline_width; //scanline_buffer.byteLength;
            for ( let i = 0; i < l; i ++ ) {

                let off = 0;
                data_rgba[ offset ] = scanline_buffer[ i + off ];
                off += scanline_width; //1;
                data_rgba[ offset + 1 ] = scanline_buffer[ i + off ];
                off += scanline_width; //1;
                data_rgba[ offset + 2 ] = scanline_buffer[ i + off ];
                off += scanline_width; //1;
                data_rgba[ offset + 3 ] = scanline_buffer[ i + off ];
                offset += 4;

            }

            num_scanlines --;

        }

        return data_rgba;

    }
    function RGBEByteToRGBFloat( sourceArray, sourceOffset, destArray, destOffset ) {

        const e = sourceArray[ sourceOffset + 3 ];
        const scale = Math.pow( 2.0, e - 128.0 ) / 255.0;

        destArray[ destOffset + 0 ] = sourceArray[ sourceOffset + 0 ] * scale;
        destArray[ destOffset + 1 ] = sourceArray[ sourceOffset + 1 ] * scale;
        destArray[ destOffset + 2 ] = sourceArray[ sourceOffset + 2 ] * scale;
        destArray[ destOffset + 3 ] = 1;

    }
    function RGBEByteToRGBHalf( sourceArray, sourceOffset, destArray, destOffset ) {

        const e = sourceArray[ sourceOffset + 3 ];
        const scale = Math.pow( 2.0, e - 128.0 ) / 255.0;

        // clamping to 65504, the maximum representable value in float16
        destArray[ destOffset + 0 ] = toHalfFloat( Math.min( sourceArray[ sourceOffset + 0 ] * scale, 65504 ) );
        destArray[ destOffset + 1 ] = toHalfFloat( Math.min( sourceArray[ sourceOffset + 1 ] * scale, 65504 ) );
        destArray[ destOffset + 2 ] = toHalfFloat( Math.min( sourceArray[ sourceOffset + 2 ] * scale, 65504 ) );
        destArray[ destOffset + 3 ] = toHalfFloat( 1 );

    }
    

}

function toHalfFloat( val ) {

	if ( Math.abs( val ) > 65504 ) console.warn( 'THREE.DataUtils.toHalfFloat(): Value out of range.' );

	val = clamp( val, - 65504, 65504 );

	_tables.floatView[ 0 ] = val;
	const f = _tables.uint32View[ 0 ];
	const e = ( f >> 23 ) & 0x1ff;
	return _tables.baseTable[ e ] + ( ( f & 0x007fffff ) >> _tables.shiftTable[ e ] );

}

function clamp( value, min, max ) {

	return Math.max( min, Math.min( max, value ) );

}

const _tables = /*@__PURE__*/ _generateTables();

function _generateTables() {

	// float32 to float16 helpers

	const buffer = new ArrayBuffer( 4 );
	const floatView = new Float32Array( buffer );
	const uint32View = new Uint32Array( buffer );

	const baseTable = new Uint32Array( 512 );
	const shiftTable = new Uint32Array( 512 );

	for ( let i = 0; i < 256; ++ i ) {

		const e = i - 127;

		// very small number (0, -0)

		if ( e < - 27 ) {

			baseTable[ i ] = 0x0000;
			baseTable[ i | 0x100 ] = 0x8000;
			shiftTable[ i ] = 24;
			shiftTable[ i | 0x100 ] = 24;

			// small number (denorm)

		} else if ( e < - 14 ) {

			baseTable[ i ] = 0x0400 >> ( - e - 14 );
			baseTable[ i | 0x100 ] = ( 0x0400 >> ( - e - 14 ) ) | 0x8000;
			shiftTable[ i ] = - e - 1;
			shiftTable[ i | 0x100 ] = - e - 1;

			// normal number

		} else if ( e <= 15 ) {

			baseTable[ i ] = ( e + 15 ) << 10;
			baseTable[ i | 0x100 ] = ( ( e + 15 ) << 10 ) | 0x8000;
			shiftTable[ i ] = 13;
			shiftTable[ i | 0x100 ] = 13;

			// large number (Infinity, -Infinity)

		} else if ( e < 128 ) {

			baseTable[ i ] = 0x7c00;
			baseTable[ i | 0x100 ] = 0xfc00;
			shiftTable[ i ] = 24;
			shiftTable[ i | 0x100 ] = 24;

			// stay (NaN, Infinity, -Infinity)

		} else {

			baseTable[ i ] = 0x7c00;
			baseTable[ i | 0x100 ] = 0xfc00;
			shiftTable[ i ] = 13;
			shiftTable[ i | 0x100 ] = 13;

		}

	}

	// float16 to float32 helpers

	const mantissaTable = new Uint32Array( 2048 );
	const exponentTable = new Uint32Array( 64 );
	const offsetTable = new Uint32Array( 64 );

	for ( let i = 1; i < 1024; ++ i ) {

		let m = i << 13; // zero pad mantissa bits
		let e = 0; // zero exponent

		// normalized
		while ( ( m & 0x00800000 ) === 0 ) {

			m <<= 1;
			e -= 0x00800000; // decrement exponent

		}

		m &= ~ 0x00800000; // clear leading 1 bit
		e += 0x38800000; // adjust bias

		mantissaTable[ i ] = m | e;

	}

	for ( let i = 1024; i < 2048; ++ i ) {

		mantissaTable[ i ] = 0x38000000 + ( ( i - 1024 ) << 13 );

	}

	for ( let i = 1; i < 31; ++ i ) {

		exponentTable[ i ] = i << 23;

	}

	exponentTable[ 31 ] = 0x47800000;
	exponentTable[ 32 ] = 0x80000000;

	for ( let i = 33; i < 63; ++ i ) {

		exponentTable[ i ] = 0x80000000 + ( ( i - 32 ) << 23 );

	}

	exponentTable[ 63 ] = 0xc7800000;

	for ( let i = 1; i < 64; ++ i ) {

		if ( i !== 32 ) {

			offsetTable[ i ] = 1024;

		}

	}

	return {
		floatView: floatView,
		uint32View: uint32View,
		baseTable: baseTable,
		shiftTable: shiftTable,
		mantissaTable: mantissaTable,
		exponentTable: exponentTable,
		offsetTable: offsetTable
	};

}

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
    const ext = gl.getExtension('EXT_color_buffer_float');
    if (!ext) {
        throw new Error('EXT_color_buffer_float extension not supported');
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
    
    gl.uniformMatrix4fv(
        gl.getUniformLocation(program, "projection"),
        false,
        projectionMatrix
    );
    
    // ... inside your function
    const views = [];
    const eye = [0, 0, 0];

    // For each face
    for (let i = 0; i < 6; i++) {
        const viewMatrix = create();
        let lookDir, upDir;
        
        switch(i) {
            case 0: // POSITIVE_X
                lookDir = [1, 0, 0]; upDir = [0, -1, 0]; break;
            case 1: // NEGATIVE_X
                lookDir = [-1, 0, 0]; upDir = [0, -1, 0]; break;
            case 2: // POSITIVE_Y
                lookDir = [0, 1, 0]; upDir = [0, 0, 1]; break;
            case 3: // NEGATIVE_Y
                lookDir = [0, -1, 0]; upDir = [0, 0, -1]; break;
            case 4: // POSITIVE_Z
                lookDir = [0, 0, 1]; upDir = [0, -1, 0]; break;
            case 5: // NEGATIVE_Z
                lookDir = [0, 0, -1]; upDir = [0, -1, 0]; break;
        }
        
        const target = [eye[0] + lookDir[0], eye[1] + lookDir[1], eye[2] + lookDir[2]];
        lookAt$1(viewMatrix, eye, target, upDir);
        views.push(viewMatrix);
    }
    
    // Render each face
    for (let i = 0; i < 6; i++) {
        // Attach the corresponding cubemap face to the framebuffer
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
            cubemapTexture,
            0
        );
        
        // Check framebuffer status
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            console.error("Framebuffer not complete:", status);
            continue;
        }
        
        // Set the view matrix for this face
        gl.uniformMatrix4fv(
            gl.getUniformLocation(program, "view"),
            false,
            views[i]
        );
        
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
        data
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
        gl.texImage2D(
            gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
            0,
            gl.RGBA16F,
            size,
            size,
            0,
            gl.RGBA,
            gl.HALF_FLOAT,
            null
        );
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
 * @returns {Object} Object containing the program and VAO
 */
function createEquirectToCubeProgram(gl) {
    // Vertex shader: render a fullscreen quad properly mapped to cube face
    const vertexShaderSource = /*glsl*/`#version 300 es
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
    const fragmentShaderSource = /*glsl*/`#version 300 es
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
            0.5 + theta / 3.1415926535897932
        );
        
        return uv;
    }

    void main() {
        vec3 direction = normalize(localPos);
        vec2 uv = SampleSphericalMap(direction);
        fragColor = texture(equirectangularMap, uv);
    }`;
    
    // Create and compile shaders
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);
    
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);
    
    // Create and link program
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    // Check for shader compilation and program link errors
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error("Shader program error:", gl.getProgramInfoLog(program));
        console.error("Vertex shader log:", gl.getShaderInfoLog(vertexShader));
        console.error("Fragment shader log:", gl.getShaderInfoLog(fragmentShader));
        throw new Error("Failed to compile shaders");
    }
    
    // Use a simple full-screen quad
    const vertexArray = gl.createVertexArray();
    gl.bindVertexArray(vertexArray);
    
    // Define a full-screen quad (two triangles)
    const vertices = new Float32Array([
        -1.0, -1.0,  // bottom-left
         1.0, -1.0,  // bottom-right
        -1.0,  1.0,  // top-left
         1.0,  1.0   // top-right
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
		rgbeImage = await loadRGBE("christmas_photo_studio_01_2k.hdr");
		console.log("rgbeImage", rgbeImage);

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
				position: [0, 5, -5],
				target: [0, 0, 0],
				fov: 75
			},
			$camera
		);

		const skyBox = createSkyBox({ url: "skybox-flamingo-tonemapped.png" });
		set_store_value(renderPasses, $renderPasses = [skyBox], $renderPasses);
		const cubeMesh = createCube();

		const light = createLightStore(createPointLight({
			position: [-2, 2, -2],
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

		const material = createMaterialStore({ diffuse: [1, 0.5, 0.5], metalness: 0 });
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

		setTimeout(
			() => {
				console.log("go", rgbeImage);
				const { gl } = appContext;
				const texture = hdrToCube(rgbeImage.data, gl, rgbeImage.width, rgbeImage.height, 1024);
				console.log("texture", texture);
			},
			0
		);
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
