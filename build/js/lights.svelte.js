import { N as templateLiteralRenderer, O as appContext, S as SvelteComponent, i as init, s as safe_not_equal, M as Menu, D as DebugPanel, e as element, b as space, f as create_component, g as insert, h as mount_component, j as noop, t as transition_in, k as transition_out, o as detach, p as destroy_component, q as component_subscribe, r as onMount, u as renderer, v as lights, w as scene, x as materials, y as camera, z as set_store_value, A as skyblue, E as createLightStore, F as createPointLight, B as identity, J as createMaterialStore, G as create3DObject, H as createOrbitControls, P as get_store_value, I as binding_callbacks, L as createPlane } from './DebugPanel-DVaIUwjT.js';

var textureShader = "${declaration?\r\n`\r\nuniform sampler2D ${mapType};\r\n` : ''\r\n}\r\n${declarationNormal?\r\n`\r\nuniform vec2 normalScale;\r\nmat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {\r\n    vec3 q0 = dFdx( eye_pos.xyz );\r\n    vec3 q1 = dFdy( eye_pos.xyz );\r\n    vec2 st0 = dFdx( uv.st );\r\n    vec2 st1 = dFdy( uv.st );\r\n    vec3 N = surf_norm;\r\n    vec3 q1perp = cross( q1, N );\r\n    vec3 q0perp = cross( N, q0 );\r\n    vec3 T = q1perp * st0.x + q0perp * st1.x;\r\n    vec3 B = q1perp * st0.y + q0perp * st1.y;\r\n    float det = max( dot( T, T ), dot( B, B ) );\r\n    float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );\r\n    return mat3( T * scale, B * scale, N );\r\n}\r\n` : ''\r\n}\r\n${diffuseMapSample?\r\n`\r\n    //atan(uv.y, uv.x)\r\n    ${coordinateSpace === 'circular' ?\r\n`   vec2 uv = vec2(vUv.x/vUv.y, vUv.y);\r\n` :\r\n`   vec2 uv = vUv;\r\n`}\r\n    vec4 textureColor = texture( ${mapType}, uv );\r\n    material.diffuseColor *= textureColor.rgb;\r\n    material.diffuseAlpha = textureColor.a;\r\n    \r\n` : ''\r\n}\r\n${normalMapSample?\r\n`\r\n    mat3 tbn =  getTangentFrame( -vViewPosition, vNormal, vUv );\r\n    vec2 rotatedUv = vec2(vUv.x, 1.0-vUv.y);\r\n    normal = texture( ${mapType}, rotatedUv ).xyz * 2.0 - 1.0;\r\n    normal.xy *= normalScale;\r\n    normal = normalize(tbn * normal);\r\n\t//normal = normalize( normalMatrix * normal );\r\n` : ''\r\n}\r\n${roughnessMapSample?\r\n`\r\n    //atan(uv.y, uv.x)\r\n    ${coordinateSpace === 'circular' ?\r\n`   vec2 roughnessUv = vec2(vUv.x/vUv.y, vUv.y);\r\n` :\r\n`   vec2 roughnessUv = vec2(vUv.x, 1.0-vUv.y);\r\n`}\r\n    vec4 texelRoughness = texture( ${mapType}, roughnessUv );\r\n    roughnessFactor = texelRoughness.g;\r\n` : ''\r\n}\r\n";

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
 * @property {string} url
 * @property {"diffuse" | "normal" | "roughness" } type
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

var specularShader = "${declaration?\r\n`\r\n\r\nuniform float roughness;\r\nfloat roughnessFactor;\r\nuniform float ior;\r\nuniform float specularIntensity;\r\nuniform vec3 specularColor;\r\n\r\n\r\n\r\n#define EPSILON 1e-6\r\n\r\nvec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {\r\n\r\n\t// Original approximation by Christophe Schlick '94\r\n\t// float fresnel = pow( 1.0 - dotVH, 5.0 );\r\n\r\n\t// Optimized variant (presented by Epic at SIGGRAPH '13)\r\n\t// https://cdn2.unrealengine.com/Resources/files/2013SiggraphPresentationsNotes-26915738.pdf\r\n\tfloat fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );\r\n\r\n\treturn f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );\r\n\r\n} \r\n\r\n// Moving Frostbite to Physically Based Rendering 3.0 - page 12, listing 2\r\n// https://seblagarde.files.wordpress.com/2015/07/course_notes_moving_frostbite_to_pbr_v32.pdf\r\nfloat V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {\r\n\r\n\tfloat a2 = pow2( alpha );\r\n\r\n\tfloat gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );\r\n\tfloat gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );\r\n\r\n\treturn 0.5 / max( gv + gl, EPSILON );\r\n\r\n}\r\n\r\n// Microfacet Models for Refraction through Rough Surfaces - equation (33)\r\n// http://graphicrants.blogspot.com/2013/08/specular-brdf-reference.html\r\n// alpha is \"roughness squared\" in Disney’s reparameterization\r\nfloat D_GGX( const in float alpha, const in float dotNH ) {\r\n\r\n\tfloat a2 = pow2( alpha );\r\n\r\n\tfloat denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0; // avoid alpha = 0 with dotNH = 1\r\n\r\n\treturn RECIPROCAL_PI * a2 / pow2( denom );\r\n\r\n}\r\n\r\nvec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float specularF90, const in float roughness) {\r\n\r\n\tfloat alpha = pow2( roughness ); // UE4's roughness\r\n\r\n\tvec3 halfDir = normalize( lightDir + viewDir );\r\n\r\n\tfloat dotNL = saturate( dot( normal, lightDir ) );\r\n\tfloat dotNV = saturate( dot( normal, viewDir ) );\r\n\tfloat dotNH = saturate( dot( normal, halfDir ) );\r\n\tfloat dotVH = saturate( dot( viewDir, halfDir ) );\r\n\r\n\tvec3 F = F_Schlick( specularColor, specularF90, dotVH );\r\n\r\n\tfloat V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );\r\n\r\n\tfloat D = D_GGX( alpha, dotNH );\r\n\r\n\treturn F * ( V * D );\r\n\r\n}\r\n` : ''\r\n}\r\n${irradiance?\r\n`\r\n\tmaterial.roughness = clamp(roughness * roughnessFactor, 0.0525, 1.0);\r\n\tmaterial.ior = ior;\r\n\tmaterial.specularF90 = mix(specularIntensity, 1.0, metalness);\r\n\tmaterial.specularColor = mix(min(pow2((material.ior - 1.0) / (material.ior + 1.0)) * specularColor, vec3(1.0)) * specularIntensity, diffuse.rgb, metalness);\r\n\r\n        vec3 geometryViewDir = normalize( cameraPosition - vertex );\r\n        reflectedLight.directSpecular += lightParams.irradiance * BRDF_GGX( lightParams.direction, geometryViewDir, normal, material.specularColor, material.specularF90, material.roughness);//lightParams.irradiance; //* \r\n        //totalIrradiance = -vec3(geometryViewDir.z,geometryViewDir.z,geometryViewDir.z);//BRDF_GGX( lightParams.direction, geometryViewDir, normalize(vNormal), specularColor, specularF90, roughness);\r\n\t\t//totalIrradiance = lightParams.irradiance;//vec3(-lightParams.direction.z,-lightParams.direction.z,-lightParams.direction.z);\r\n` : ''\r\n}";

//{ roughness = 0, ior = 1.5, intensity = 1, color = [1, 1, 1] } =
/**
 * @typedef SpecularProps
 * @property {number} [roughness=0]
 * @property {number} [ior=1.5]
 * @property {number} [intensity=1]
 * @property {number[]} [color=[1, 1, 1]]
 */

/**
 *
 * @param {SpecularProps} props
 * @returns
 */
const createSpecular = (props) => {
	return {
		...props,
		shader: templateLiteralRenderer(specularShader, {
			declaration: false,
			irradiance: false,
		}),
		setupSpecular: setupSpecular(props),
	};
};

function setupSpecular({ roughness, ior, intensity, color }) {
	return function setupSpecular() {
		/** @type {{gl: WebGL2RenderingContext}} **/
		const { gl, program } = appContext;

		const colorLocation = gl.getUniformLocation(program, "specularColor");
		const roughnessLocation = gl.getUniformLocation(program, "roughness");
		const iorLocation = gl.getUniformLocation(program, "ior");
		const specularIntensityLocation = gl.getUniformLocation(program, "specularIntensity");

		gl.uniform3fv(colorLocation, color);
		gl.uniform1f(roughnessLocation, roughness);
		gl.uniform1f(iorLocation, ior);
		gl.uniform1f(specularIntensityLocation, intensity);
	};
}

/* src\lights.svelte generated by Svelte v4.2.18 */

function create_fragment(ctx) {
	let canvas_1;
	let t0;
	let menu;
	let t1;
	let debugpanel;
	let current;
	menu = new Menu({});
	debugpanel = new DebugPanel({});

	return {
		c() {
			canvas_1 = element("canvas");
			t0 = space();
			create_component(menu.$$.fragment);
			t1 = space();
			create_component(debugpanel.$$.fragment);
		},
		m(target, anchor) {
			insert(target, canvas_1, anchor);
			/*canvas_1_binding*/ ctx[1](canvas_1);
			insert(target, t0, anchor);
			mount_component(menu, target, anchor);
			insert(target, t1, anchor);
			mount_component(debugpanel, target, anchor);
			current = true;
		},
		p: noop,
		i(local) {
			if (current) return;
			transition_in(menu.$$.fragment, local);
			transition_in(debugpanel.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(menu.$$.fragment, local);
			transition_out(debugpanel.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(canvas_1);
				detach(t0);
				detach(t1);
			}

			/*canvas_1_binding*/ ctx[1](null);
			destroy_component(menu, detaching);
			destroy_component(debugpanel, detaching);
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let $renderer;
	let $lights;
	let $scene;
	let $materials;
	let $camera;
	component_subscribe($$self, renderer, $$value => $$invalidate(4, $renderer = $$value));
	component_subscribe($$self, lights, $$value => $$invalidate(5, $lights = $$value));
	component_subscribe($$self, scene, $$value => $$invalidate(6, $scene = $$value));
	component_subscribe($$self, materials, $$value => $$invalidate(7, $materials = $$value));
	component_subscribe($$self, camera, $$value => $$invalidate(8, $camera = $$value));
	let canvas;
	let light;
	let light2;

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
				position: [0, 5, -5],
				target: [0, 1, 0],
				fov: 75
			},
			$camera
		);

		light = createLightStore(createPointLight({
			position: [0, 1, 0],
			color: [1, 1, 1],
			intensity: 2,
			cutoffDistance: 3,
			decayExponent: 0
		}));

		light2 = createLightStore(createPointLight({
			position: [0, 1, 0],
			color: [1, 1, 1],
			intensity: 5,
			cutoffDistance: 10,
			decayExponent: 0
		}));

		const groundMesh = createPlane(10, 10, 1, 1);
		const groundMatrix = identity(new Float32Array(16));

		const diffuseMap = await createTexture({
			url: "peeling-painted-metal-diffuse.jpg",
			type: "diffuse"
		});

		const normalMap = await createTexture({
			url: "peeling-painted-metal-normal.jpg",
			type: "normal"
		});

		const roughnessMap = await createTexture({
			url: "peeling-painted-metal-roughness.jpg",
			type: "roughness"
		});

		const groundMaterial = createMaterialStore({
			diffuse: [1, 1, 1],
			metalness: 0,
			specular: createSpecular({
				roughness: 0.8,
				ior: 1.4,
				intensity: 0.5,
				color: [1, 1, 1]
			}),
			diffuseMap,
			normalMap,
			roughnessMap
		});

		set_store_value(materials, $materials = [...$materials, groundMaterial], $materials);

		set_store_value(
			scene,
			$scene = [
				...$scene,
				create3DObject({
					...groundMesh,
					matrix: groundMatrix,
					material: groundMaterial
				})
			],
			$scene
		);

		set_store_value(lights, $lights = [...$lights, light, light2], $lights);

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

	function animate() {
		light.set({
			...get_store_value(light),
			position: [
				Math.sin(performance.now() / 1000) * 3,
				1,
				Math.cos(performance.now() / 1000) * 3
			]
		});

		//animate hue
		const color1 = Math.sin(performance.now() / 1000) * 0.5 + 0.5;

		const color2 = Math.sin(performance.now() / 1000 + 2) * 0.5 + 0.5;
		const color3 = Math.sin(performance.now() / 1000 + 4) * 0.5 + 0.5;

		light2.set({
			...get_store_value(light2),
			color: [color1, color2, color3]
		});
	}

	function canvas_1_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			canvas = $$value;
			$$invalidate(0, canvas);
		});
	}

	return [canvas, canvas_1_binding];
}

class Lights extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, {});
	}
}

export { Lights as default };
