import { T as ARRAY_TYPE, D as drawModes, U as createVec3, V as lerp, G as normalize, W as multiplyScalarVec3, X as normalizeNormals, R as templateLiteralRenderer, I as appContext } from './Menu-CYbrznUt.js';

/**
 * 2 Dimensional Vector
 * @module vec2
 */

/**
 * Creates a new, empty vec2
 *
 * @returns {vec2} a new 2D vector
 */

function create() {
  var out = new ARRAY_TYPE(2);

  if (ARRAY_TYPE != Float32Array) {
    out[0] = 0;
    out[1] = 0;
  }

  return out;
}
/**
 * Adds two vec2's
 *
 * @param {vec2} out the receiving vector
 * @param {ReadonlyVec2} a the first operand
 * @param {ReadonlyVec2} b the second operand
 * @returns {vec2} out
 */

function add(out, a, b) {
  out[0] = a[0] + b[0];
  out[1] = a[1] + b[1];
  return out;
}
/**
 * Divides two vec2's
 *
 * @param {vec2} out the receiving vector
 * @param {ReadonlyVec2} a the first operand
 * @param {ReadonlyVec2} b the second operand
 * @returns {vec2} out
 */

function divide(out, a, b) {
  out[0] = a[0] / b[0];
  out[1] = a[1] / b[1];
  return out;
}
/**
 * Perform some operation over an array of vec2s.
 *
 * @param {Array} a the array of vectors to iterate over
 * @param {Number} stride Number of elements between the start of each vec2. If 0 assumes tightly packed
 * @param {Number} offset Number of elements to skip at the beginning of the array
 * @param {Number} count Number of vec2s to iterate over. If 0 iterates over entire array
 * @param {Function} fn Function to call for each vector in the array
 * @param {Object} [arg] additional argument to pass to fn
 * @returns {Array} a
 * @function
 */

(function () {
  var vec = create();
  return function (a, stride, offset, count, fn, arg) {
    var i, l;

    if (!stride) {
      stride = 2;
    }

    if (!offset) {
      offset = 0;
    }

    if (count) {
      l = Math.min(count * stride + offset, a.length);
    } else {
      l = a.length;
    }

    for (i = offset; i < l; i += stride) {
      vec[0] = a[i];
      vec[1] = a[i + 1];
      fn(vec, vec, arg);
      a[i] = vec[0];
      a[i + 1] = vec[1];
    }

    return a;
  };
})();

/**
 * @typedef {{
 *	positions: Float32Array,
 *	normals: Float32Array,
 * }} Geometry
 */
/*elements: Uint16Array*/
/**
 *
 * @param {*} radius
 * @param {*} subdivisions
 * @returns {Geometry}
 */
const createPolyhedron = (radius, detail, normalCreator) => {
	const positions = [];
	subdivide(detail);
	applyRadius(radius);

	let normals = normalCreator(positions);

	return {
		attributes: {
			positions,
			normals,
		},
		drawMode: drawModes[4],
	};

	function subdivide(detail) {
		const a = createVec3();
		const b = createVec3();
		const c = createVec3();

		// iterate over all faces and apply a subdivision with the given detail value

		for (let i = 0; i < initialIndices.length; i += 3) {
			// get the vertices of the face

			getVertexByIndex(initialIndices[i + 0], a);
			getVertexByIndex(initialIndices[i + 1], b);
			getVertexByIndex(initialIndices[i + 2], c);

			// perform subdivision

			subdivideFace(a, b, c, detail);
		}
	}

	function getVertexByIndex(index, vertex) {
		const stride = index * 3;

		vertex[0] = initialVertices[stride + 0];
		vertex[1] = initialVertices[stride + 1];
		vertex[2] = initialVertices[stride + 2];
	}

	function subdivideFace(a, b, c, detail) {
		const cols = detail + 1;

		// we use this multidimensional array as a data structure for creating the subdivision

		const v = [];

		// construct all of the vertices for this subdivision
		for (let i = 0; i <= cols; i++) {
			v[i] = [];
			let aj = createVec3();
			lerp(aj, [...a], c, i / cols);
			let bj = createVec3();
			lerp(bj, [...b], c, i / cols);
			const rows = cols - i;

			for (let j = 0; j <= rows; j++) {
				if (j === 0 && i === cols) {
					v[i][j] = aj;
				} else {
					let tmp = createVec3();
					lerp(tmp, [...aj], bj, j / rows);
					v[i][j] = tmp;
				}
			}
		}

		// construct all of the faces

		for (let i = 0; i < cols; i++) {
			for (let j = 0; j < 2 * (cols - i) - 1; j++) {
				const k = Math.floor(j / 2);

				if (j % 2 === 0) {
					pushVertex(v[i][k + 1]);
					pushVertex(v[i + 1][k]);
					pushVertex(v[i][k]);
				} else {
					pushVertex(v[i][k + 1]);
					pushVertex(v[i + 1][k + 1]);
					pushVertex(v[i + 1][k]);
				}
			}
		}
	}

	function pushVertex(vertex) {
		positions.push(...vertex);
	}

	function applyRadius(radius) {
		const vertex = createVec3();

		// iterate over the entire buffer and apply the radius to each vertex

		for (let i = 0; i < positions.length; i += 3) {
			vertex[0] = positions[i + 0];
			vertex[1] = positions[i + 1];
			vertex[2] = positions[i + 2];

			normalize(vertex, vertex);
			multiplyScalarVec3(vertex, radius);

			positions[i + 0] = vertex[0];
			positions[i + 1] = vertex[1];
			positions[i + 2] = vertex[2];
		}
	}
};

function createSmoothShadedNormals(positions) {
	const normals = positions.slice();
	normalizeNormals(normals);
	return normals;
}

function generateUVs({ positions }) {
	const uvBuffer = [];

	for (let i = 0; i < positions.length; i += 3) {
		const vertex = [positions[i + 0], positions[i + 1], positions[i + 2]];
		const u = azimuth(vertex) / 2 / Math.PI + 0.5;
		const v = inclination(vertex) / Math.PI + 0.5;
		uvBuffer.push(u, 1 - v);
	}

	correctUVs(uvBuffer, positions);

	correctSeam(uvBuffer);

	return uvBuffer;
}

function correctUVs(uvBuffer, positions) {
	for (let i = 0, j = 0; i < positions.length; i += 9, j += 6) {
		const a = [positions[i + 0], positions[i + 1], positions[i + 2]];
		const b = [positions[i + 3], positions[i + 4], positions[i + 5]];
		const c = [positions[i + 6], positions[i + 7], positions[i + 8]];

		const uvA = [uvBuffer[j + 0], uvBuffer[j + 1]];
		const uvB = [uvBuffer[j + 2], uvBuffer[j + 3]];
		const uvC = [uvBuffer[j + 4], uvBuffer[j + 5]];

		const centroid = [...a];
		add(centroid, centroid, b);
		add(centroid, centroid, c);
		divide(centroid, centroid, 3);

		const azi = azimuth(centroid);

		correctUV(uvBuffer, uvA, j + 0, a, azi);
		correctUV(uvBuffer, uvB, j + 2, b, azi);
		correctUV(uvBuffer, uvC, j + 4, c, azi);
	}
}

function correctUV(uvBuffer, uv, stride, vector, azimuth) {
	if (azimuth < 0 && uv.x === 1) {
		uvBuffer[stride] = uv.x - 1;
	}

	if (vector[0] === 0 && vector[2] === 0) {
		uvBuffer[stride] = azimuth / 2 / Math.PI + 0.5;
	}
}

// Angle around the Y axis, counter-clockwise when looking from above.

function azimuth(vector) {
	return Math.atan2(vector[2], -vector[0]);
}

// Angle above the XZ plane.

function inclination(vector) {
	return Math.atan2(-vector[1], Math.sqrt(vector[0] * vector[0] + vector[2] * vector[2]));
}

function correctSeam(uvBuffer) {
	// handle case when face straddles the seam, see #3269

	for (let i = 0; i < uvBuffer.length; i += 6) {
		// uv data of a single face

		const x0 = uvBuffer[i + 0];
		const x1 = uvBuffer[i + 2];
		const x2 = uvBuffer[i + 4];

		const max = Math.max(x0, x1, x2);
		const min = Math.min(x0, x1, x2);

		// 0.9 is somewhat arbitrary

		if (max > 0.9 && min < 0.1) {
			if (x0 < 0.2) uvBuffer[i + 0] += 1;
			if (x1 < 0.2) uvBuffer[i + 2] += 1;
			if (x2 < 0.2) uvBuffer[i + 4] += 1;
		}
	}
}

const t = (1 + Math.sqrt(5)) / 2;
const r = 1 / t;

const initialVertices = [
	// (±1, ±1, ±1)
	-1,
	-1,
	-1,
	-1,
	-1,
	1,
	-1,
	1,
	-1,
	-1,
	1,
	1,
	1,
	-1,
	-1,
	1,
	-1,
	1,
	1,
	1,
	-1,
	1,
	1,
	1,

	// (0, ±1/φ, ±φ)
	0,
	-r,
	-t,
	0,
	-r,
	t,
	0,
	r,
	-t,
	0,
	r,
	t,

	// (±1/φ, ±φ, 0)
	-r,
	-t,
	0,
	-r,
	t,
	0,
	r,
	-t,
	0,
	r,
	t,
	0,

	// (±φ, 0, ±1/φ)
	-t,
	0,
	-r,
	t,
	0,
	-r,
	-t,
	0,
	r,
	t,
	0,
	r,
];

const initialIndices = [
	3, 11, 7, 3, 7, 15, 3, 15, 13, 7, 19, 17, 7, 17, 6, 7, 6, 15, 17, 4, 8, 17, 8, 10, 17, 10, 6, 8, 0, 16, 8, 16, 2, 8, 2,
	10, 0, 12, 1, 0, 1, 18, 0, 18, 16, 6, 10, 2, 6, 2, 13, 6, 13, 15, 2, 16, 18, 2, 18, 3, 2, 3, 13, 18, 1, 9, 18, 9, 11,
	18, 11, 3, 4, 14, 12, 4, 12, 0, 4, 0, 8, 11, 9, 5, 11, 5, 19, 11, 19, 7, 19, 5, 14, 19, 14, 4, 19, 4, 17, 1, 12, 14, 1,
	14, 5, 1, 5, 9,
];

var textureShader = "${declaration?\r\n`\r\nuniform sampler2D ${mapType};\r\nuniform vec2 normalScale;\r\n\r\n\r\nmat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {\r\n    vec3 q0 = dFdx( eye_pos.xyz );\r\n    vec3 q1 = dFdy( eye_pos.xyz );\r\n    vec2 st0 = dFdx( uv.st );\r\n    vec2 st1 = dFdy( uv.st );\r\n    vec3 N = surf_norm;\r\n    vec3 q1perp = cross( q1, N );\r\n    vec3 q0perp = cross( N, q0 );\r\n    vec3 T = q1perp * st0.x + q0perp * st1.x;\r\n    vec3 B = q1perp * st0.y + q0perp * st1.y;\r\n    float det = max( dot( T, T ), dot( B, B ) );\r\n    float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );\r\n    return mat3( T * scale, B * scale, N );\r\n}\r\n` : ''\r\n}\r\n${diffuseMapSample?\r\n`\r\n    //atan(uv.y, uv.x)\r\n    ${coordinateSpace === 'circular' ?\r\n`   vec2 uv = vec2(vUv.x/vUv.y, vUv.y);\r\n` :\r\n`   vec2 uv = vUv;\r\n`}\r\n    vec4 textureColor = texture( ${mapType}, uv );\r\n    material.diffuseColor *= textureColor.rgb;\r\n    material.diffuseAlpha = textureColor.a;\r\n    \r\n` : ''\r\n}\r\n${normalMapSample?\r\n`\r\n    mat3 tbn =  getTangentFrame( -vViewPosition, vNormal, vUv );\r\n    normal = texture( normalMap, vUv ).xyz * 2.0 - 1.0;\r\n    normal.xy *= normalScale;\r\n    normal = normalize(tbn * normal);\r\n\t//normal = normalize( normalMatrix * normal );\r\n` : ''\r\n}\r\n";

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
const createTexture = async (props) => {
	let image;
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

	let output = {
		type: types[props.type],
		coordinateSpace: props.coordinateSpace,
		shader: templateLiteralRenderer(textureShader, {
			declaration: false,
			diffuseMapSample: false,
			normalMapSample: false,
			mapType: undefined,
			coordinateSpace: undefined,
		}),
		setupTexture: setupTexture(image, types[props.type], id[props.type], props.normalScale, setBuffer),
		bindTexture: bindTexture(id[props.type], getBuffer, types[props.type]),
	};
	if (typeof image === "function") {
		output = {
			...output,
			get textureBuffer() {
				return image();
			},
		};
	} else {
		output = {
			...output,
			texture: image,
		};
	}
	return output;
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

function bindTexture(id, getBuffer, type) {
	return function bindTexture() {
		/** @type {{gl: WebGL2RenderingContext}} **/
		const { gl, program } = appContext;
		const textureLocation = gl.getUniformLocation(program, type);
		gl.activeTexture(gl["TEXTURE" + id]);
		gl.bindTexture(gl.TEXTURE_2D, getBuffer());
		gl.uniform1i(textureLocation, id);
	};
}

function setupTexture(texture, type, id, normalScale = [1, 1], setBuffer) {
	return function setupTexture() {
		/** @type {{gl: WebGL2RenderingContext}} **/
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
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
		gl.generateMipmap(gl.TEXTURE_2D);
		//gl.getExtension("EXT_texture_filter_anisotropic");
		if (normalScale != null) {
			const normalScaleLocation = gl.getUniformLocation(program, "normalScale");
			gl.uniform2fv(normalScaleLocation, normalScale);
		}
	};
}

export { createTexture as a, createSmoothShadedNormals as b, createPolyhedron as c, generateUVs as g };
