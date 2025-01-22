import { I as templateLiteralRenderer, J as appContext } from './Menu-QHUA3apL.js';

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

export { createTexture as c };
