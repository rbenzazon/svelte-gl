import { S as SvelteComponent, i as init, s as safe_not_equal, M as Menu, e as element, a as space, c as create_component, b as insert, m as mount_component, n as noop, t as transition_in, d as transition_out, f as detach, g as destroy_component, h as component_subscribe, o as onMount, r as renderer, l as lights, j as scene, k as materials, p as camera, z as set_store_value, A as skyblue, B as createLightStore, C as createPointLight, y as identity, G as createMaterialStore, D as create3DObject, E as createOrbitControls, N as get_store_value, F as binding_callbacks } from './Menu-CrCjuat-.js';
import { c as createPlane } from './plane-DgLcwWr2.js';
import { c as createTexture } from './texture-Co2A1O6O.js';
import { c as createSpecular } from './specular-DEiUjcCC.js';
import { D as DebugPanel } from './DebugPanel-CN1xU2k3.js';

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
