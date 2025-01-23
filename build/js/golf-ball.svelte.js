import { J as templateLiteralRenderer, K as appContext, S as SvelteComponent, i as init, s as safe_not_equal, M as Menu, e as element, a as space, c as create_component, b as insert, m as mount_component, n as noop, t as transition_in, d as transition_out, f as detach, g as destroy_component, h as component_subscribe, o as onMount, r as renderer, j as scene, k as camera, x as set_store_value, y as skyblue, w as identity, z as createLightStore, A as createPointLight, B as create3DObject, C as createOrbitControls, D as binding_callbacks } from './Menu-UFopFIWZ.js';
import { c as createPolyhedron, g as generateUVs, a as createSmoothShadedNormals } from './polyhedron-Cd9snOK7.js';
import { c as createTexture } from './texture-Coeoth3p.js';

var specularShader = "${declaration?\r\n`\r\n\r\nuniform float roughness;\r\nuniform float ior;\r\nuniform float specularIntensity;\r\nuniform vec3 specularColor;\r\n\r\n\r\n\r\n#define EPSILON 1e-6\r\n\r\nvec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {\r\n\r\n\t// Original approximation by Christophe Schlick '94\r\n\t// float fresnel = pow( 1.0 - dotVH, 5.0 );\r\n\r\n\t// Optimized variant (presented by Epic at SIGGRAPH '13)\r\n\t// https://cdn2.unrealengine.com/Resources/files/2013SiggraphPresentationsNotes-26915738.pdf\r\n\tfloat fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );\r\n\r\n\treturn f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );\r\n\r\n} \r\n\r\n// Moving Frostbite to Physically Based Rendering 3.0 - page 12, listing 2\r\n// https://seblagarde.files.wordpress.com/2015/07/course_notes_moving_frostbite_to_pbr_v32.pdf\r\nfloat V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {\r\n\r\n\tfloat a2 = pow2( alpha );\r\n\r\n\tfloat gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );\r\n\tfloat gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );\r\n\r\n\treturn 0.5 / max( gv + gl, EPSILON );\r\n\r\n}\r\n\r\n// Microfacet Models for Refraction through Rough Surfaces - equation (33)\r\n// http://graphicrants.blogspot.com/2013/08/specular-brdf-reference.html\r\n// alpha is \"roughness squared\" in Disney’s reparameterization\r\nfloat D_GGX( const in float alpha, const in float dotNH ) {\r\n\r\n\tfloat a2 = pow2( alpha );\r\n\r\n\tfloat denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0; // avoid alpha = 0 with dotNH = 1\r\n\r\n\treturn RECIPROCAL_PI * a2 / pow2( denom );\r\n\r\n}\r\n\r\nvec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float specularF90, const in float roughness) {\r\n\r\n\tfloat alpha = pow2( roughness ); // UE4's roughness\r\n\r\n\tvec3 halfDir = normalize( lightDir + viewDir );\r\n\r\n\tfloat dotNL = saturate( dot( normal, lightDir ) );\r\n\tfloat dotNV = saturate( dot( normal, viewDir ) );\r\n\tfloat dotNH = saturate( dot( normal, halfDir ) );\r\n\tfloat dotVH = saturate( dot( viewDir, halfDir ) );\r\n\r\n\tvec3 F = F_Schlick( specularColor, specularF90, dotVH );\r\n\r\n\tfloat V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );\r\n\r\n\tfloat D = D_GGX( alpha, dotNH );\r\n\r\n\treturn F * ( V * D );\r\n\r\n}\r\n` : ''\r\n}\r\n${irradiance?\r\n`\r\n\tmaterial.roughness = clamp(roughness, 0.0525, 1.0);\r\n\tmaterial.ior = ior;\r\n\tmaterial.specularF90 = mix(specularIntensity, 1.0, metalness);\r\n\tmaterial.specularColor = mix(min(pow2((material.ior - 1.0) / (material.ior + 1.0)) * specularColor, vec3(1.0)) * specularIntensity, diffuse.rgb, metalness);\r\n\r\n        vec3 geometryViewDir = normalize( cameraPosition - vertex );\r\n        reflectedLight.directSpecular += lightParams.irradiance * BRDF_GGX( lightParams.direction, geometryViewDir, normal, material.specularColor, material.specularF90, material.roughness);//lightParams.irradiance; //* \r\n        //totalIrradiance = -vec3(geometryViewDir.z,geometryViewDir.z,geometryViewDir.z);//BRDF_GGX( lightParams.direction, geometryViewDir, normalize(vNormal), specularColor, specularF90, roughness);\r\n\t\t//totalIrradiance = lightParams.irradiance;//vec3(-lightParams.direction.z,-lightParams.direction.z,-lightParams.direction.z);\r\n` : ''\r\n}";

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

/* src\golf-ball.svelte generated by Svelte v4.2.18 */

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
	performance.now() / 1000;
} /*$camera = {
	position: [0, 5, -zpos],
};*/ //console.log("animate", $camera.position);

function instance($$self, $$props, $$invalidate) {
	let $renderer;
	let $scene;
	let $camera;
	component_subscribe($$self, renderer, $$value => $$invalidate(2, $renderer = $$value));
	component_subscribe($$self, scene, $$value => $$invalidate(3, $scene = $$value));
	component_subscribe($$self, camera, $$value => $$invalidate(4, $camera = $$value));
	let canvas;

	onMount(async () => {
		const normalMap = await createTexture({
			url: "golfball-normal.jpg",
			normalScale: [1, 1],
			type: "normal"
		});

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
				target: [0, 0, 0],
				fov: 75
			},
			$camera
		);

		const sphereMesh = createPolyhedron(1.5, 7, createSmoothShadedNormals);
		sphereMesh.attributes.uvs = generateUVs(sphereMesh.attributes);
		let identityMatrix = new Array(16).fill(0);
		identity(identityMatrix);

		/*let matrices = new Array(numInstances).fill(0).map((_, index) => {
	const count = index - Math.floor(numInstances / 2);
	let mat = [...identityMatrix];
	//transform the model matrix
	const scaleFactor = 0.1;

	const { x, y } = distributeCirclePoints(radius, index, numInstances);

	translate(mat, mat, [x, y, 0]);
	//translate(mat, mat, [count * -2, 0, 0]);
	//rotateY(mat, mat, toRadian(count * 10));
	scale(mat, mat, [scaleFactor, scaleFactor, scaleFactor]);
	return new Float32Array(mat);
});*/
		const light = createLightStore(createPointLight({
			position: [-2, 3, -3],
			color: [1, 1, 1],
			intensity: 20,
			cutoffDistance: 0,
			decayExponent: 2
		}));

		const light2 = createLightStore(createPointLight({
			position: [2, -1, -1],
			color: [1, 1, 1],
			intensity: 20,
			cutoffDistance: 0,
			decayExponent: 2
		}));

		set_store_value(
			scene,
			$scene = [
				...$scene,
				create3DObject({
					...sphereMesh,
					matrix: identityMatrix,
					material: {
						diffuse: [1, 0.5, 0.5],
						metalness: 0,
						specular: createSpecular({
							roughness: 0.05,
							ior: 1,
							intensity: 2,
							color: [1, 1, 1]
						}),
						normalMap
					}
				}),
				light,
				light2
			],
			$scene
		);

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

class Golf_ball extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, {});
	}
}

export { Golf_ball as default };
