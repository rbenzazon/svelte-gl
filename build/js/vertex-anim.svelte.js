import { a8 as templateLiteralRenderer, R as appContext, S as SvelteComponent, i as init, s as safe_not_equal, M as Menu, e as element, a as space, c as create_component, b as insert, m as mount_component, n as noop, t as transition_in, d as transition_out, f as detach, g as destroy_component, h as component_subscribe, o as onMount, r as renderer, l as lights, j as scene, k as materials, p as camera, z as set_store_value, A as skyblue, B as createLightStore, C as createPointLight, y as identity, G as createMaterialStore, D as create3DObject, E as createOrbitControls, F as binding_callbacks } from './Menu-CrCjuat-.js';
import { c as createPlane } from './plane-DgLcwWr2.js';
import { c as createSpecular } from './specular-DEiUjcCC.js';

var noiseShader = "${declaration ? `\r\n\r\nuniform float noiseDistortionFrequency;\r\nuniform float noiseDistortionSpeed;\r\nuniform float noiseDistortionAmplitude;\r\nuniform float noiseDistortionTangentLength;\r\n\r\nvec3 mod289(vec3 x)\r\n{\r\n  return x - floor(x * (1.0 / 289.0)) * 289.0;\r\n}\r\n\r\nvec4 mod289(vec4 x)\r\n{\r\n  return x - floor(x * (1.0 / 289.0)) * 289.0;\r\n}\r\n\r\nvec4 permute(vec4 x)\r\n{\r\n  return mod289(((x*34.0)+10.0)*x);\r\n}\r\n\r\nvec4 taylorInvSqrt(vec4 r)\r\n{\r\n  return 1.79284291400159 - 0.85373472095314 * r;\r\n}\r\n\r\nvec3 fade(vec3 t) {\r\n  return t*t*t*(t*(t*6.0-15.0)+10.0);\r\n}\r\n\r\n// Classic Perlin noise, periodic variant\r\nfloat pnoise(vec3 P, vec3 rep)\r\n{\r\n  vec3 Pi0 = mod(floor(P), rep); // Integer part, modulo period\r\n  vec3 Pi1 = mod(Pi0 + vec3(1.0), rep); // Integer part + 1, mod period\r\n  Pi0 = mod289(Pi0);\r\n  Pi1 = mod289(Pi1);\r\n  vec3 Pf0 = fract(P); // Fractional part for interpolation\r\n  vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0\r\n  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);\r\n  vec4 iy = vec4(Pi0.yy, Pi1.yy);\r\n  vec4 iz0 = Pi0.zzzz;\r\n  vec4 iz1 = Pi1.zzzz;\r\n\r\n  vec4 ixy = permute(permute(ix) + iy);\r\n  vec4 ixy0 = permute(ixy + iz0);\r\n  vec4 ixy1 = permute(ixy + iz1);\r\n\r\n  vec4 gx0 = ixy0 * (1.0 / 7.0);\r\n  vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;\r\n  gx0 = fract(gx0);\r\n  vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);\r\n  vec4 sz0 = step(gz0, vec4(0.0));\r\n  gx0 -= sz0 * (step(0.0, gx0) - 0.5);\r\n  gy0 -= sz0 * (step(0.0, gy0) - 0.5);\r\n\r\n  vec4 gx1 = ixy1 * (1.0 / 7.0);\r\n  vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;\r\n  gx1 = fract(gx1);\r\n  vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);\r\n  vec4 sz1 = step(gz1, vec4(0.0));\r\n  gx1 -= sz1 * (step(0.0, gx1) - 0.5);\r\n  gy1 -= sz1 * (step(0.0, gy1) - 0.5);\r\n\r\n  vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);\r\n  vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);\r\n  vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);\r\n  vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);\r\n  vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);\r\n  vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);\r\n  vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);\r\n  vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);\r\n\r\n  vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));\r\n  g000 *= norm0.x;\r\n  g010 *= norm0.y;\r\n  g100 *= norm0.z;\r\n  g110 *= norm0.w;\r\n  vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));\r\n  g001 *= norm1.x;\r\n  g011 *= norm1.y;\r\n  g101 *= norm1.z;\r\n  g111 *= norm1.w;\r\n\r\n  float n000 = dot(g000, Pf0);\r\n  float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));\r\n  float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));\r\n  float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));\r\n  float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));\r\n  float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));\r\n  float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));\r\n  float n111 = dot(g111, Pf1);\r\n\r\n  vec3 fade_xyz = fade(Pf0);\r\n  vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);\r\n  vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);\r\n  float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x); \r\n  return 2.2 * n_xyz;\r\n}\r\n\r\nvec3 orthogonal(vec3 v) {\r\n    return normalize(abs(v.x) > abs(v.z) ? vec3(-v.y, v.x, 0.0)\r\n    : vec3(0.0, -v.z, v.y));\r\n}\r\n\r\nfloat getDisplacement(vec3 position) {\r\n    float b = -noiseDistortionAmplitude * pnoise( position*noiseDistortionFrequency + vec3( noiseDistortionSpeed * time), vec3( 10.0 ) );\r\n    return  b - noiseDistortionAmplitude;\r\n}\r\n` : ''}\r\n${position ? `\r\n    float displacement = getDisplacement(position);\r\n    animatedPosition = animatedPosition + displacement * normal;\r\n    vec3 tangent1 = orthogonal(normal);\r\n    vec3 tangent2 = normalize(cross(normal, tangent1));\r\n    vec3 nearby1 = position + tangent1 * noiseDistortionTangentLength;\r\n    vec3 nearby2 = position + tangent2 * noiseDistortionTangentLength;\r\n\r\n    float displacementTangent = getDisplacement(nearby1);\r\n    vec3 modifiedPositionTangent = nearby1 + displacementTangent * normal;\r\n    float displacementBitangent = getDisplacement(nearby2);\r\n    vec3 modifiedPositionBitangent = nearby2 + displacementBitangent * normal;\r\n    modifiedNormal = normalize(cross(modifiedPositionTangent - animatedPosition, modifiedPositionBitangent - animatedPosition));\r\n` : ''}";

/**
 * @typedef NoiseProps
 * @property {number} [frequency=1]
 * @property {number} [speed=1]
 * @property {number} [amplitude=1]
 * @property {number} [normalTangentLength=0.01]
 */

/**
 *
 * @param {NoiseProps} props
 * @returns
 */
const createNoiseDistortionAnimation = ({
	frequency = 1,
	speed = 1,
	amplitude = 1,
	normalTangentLength = 0.01,
}) => {
	return {
		frequency,
		speed,
		amplitude,
		normalTangentLength,
		type: "vertex",
		requireTime: true,
		shader: templateLiteralRenderer(noiseShader, {
			declaration: false,
			position: false,
		}),
		setupAnimation: setupNoise({ frequency, speed, amplitude, normalTangentLength }),
	};
};

function setupNoise({ frequency, speed, amplitude, normalTangentLength }) {
	return function () {
		const { gl, program } = appContext;

		const frequencyLocation = gl.getUniformLocation(program, "noiseDistortionFrequency");
		const speedLocation = gl.getUniformLocation(program, "noiseDistortionSpeed");
		const amplitudeLocation = gl.getUniformLocation(program, "noiseDistortionAmplitude");
		const normalTangentLengthLocation = gl.getUniformLocation(program, "noiseDistortionTangentLength");

		gl.uniform1f(frequencyLocation, frequency * 2);
		gl.uniform1f(speedLocation, speed * 0.001);
		gl.uniform1f(amplitudeLocation, amplitude * 0.07);
		gl.uniform1f(normalTangentLengthLocation, normalTangentLength);
	};
}

/* src\vertex-anim.svelte generated by Svelte v4.2.18 */

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
	
} // animate here

function instance($$self, $$props, $$invalidate) {
	let $renderer;
	let $lights;
	let $scene;
	let $materials;
	let $camera;
	component_subscribe($$self, renderer, $$value => $$invalidate(2, $renderer = $$value));
	component_subscribe($$self, lights, $$value => $$invalidate(3, $lights = $$value));
	component_subscribe($$self, scene, $$value => $$invalidate(4, $scene = $$value));
	component_subscribe($$self, materials, $$value => $$invalidate(5, $materials = $$value));
	component_subscribe($$self, camera, $$value => $$invalidate(6, $camera = $$value));
	let canvas;

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
				position: [0, 3, -5],
				target: [0, 0, -1],
				fov: 75
			},
			$camera
		);

		const light = createLightStore(createPointLight({
			position: [0, 1, 0],
			color: [1, 1, 1],
			intensity: 2,
			cutoffDistance: 15,
			decayExponent: 0
		}));

		const groundMesh = createPlane(10, 10, 200, 200);
		const groundMatrix = identity(new Float32Array(16));

		const groundMaterial = createMaterialStore({
			diffuse: [0, 102 / 255, 204 / 255],
			metalness: 0,
			specular: createSpecular({
				roughness: 0.8,
				ior: 1.4,
				intensity: 0.5,
				color: [1, 1, 1]
			})
		});

		set_store_value(materials, $materials = [...$materials, groundMaterial], $materials);

		set_store_value(
			scene,
			$scene = [
				...$scene,
				create3DObject({
					...groundMesh,
					matrix: groundMatrix,
					material: groundMaterial,
					animations: [
						createNoiseDistortionAnimation({
							frequency: 1,
							speed: 1,
							amplitude: 1,
							normalTangentLength: 0.01
						})
					]
				})
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

class Vertex_anim extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, {});
	}
}

export { Vertex_anim as default };
