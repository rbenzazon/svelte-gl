import { S as SvelteComponent, i as init, s as safe_not_equal, M as Menu, e as element, a as space, c as create_component, b as insert, m as mount_component, n as noop, t as transition_in, d as transition_out, f as detach, g as destroy_component, h as component_subscribe, o as onMount, r as renderer, l as lights, j as scene, k as materials, p as camera, A as set_store_value, B as skyblue, y as identity, z as createZeroMatrix, x as translate, N as rotateY, w as scale, C as createLightStore, D as createPointLight, E as create3DObject, F as createOrbitControls, G as binding_callbacks, H as createMaterialStore, Q as cloneMatrix, P as get_store_value, O as rotateX, v as rotateZ, a2 as toRadian } from './Menu-Cr0GMpwH.js';
import { c as createCube } from './cube-sETbO7F2.js';
import { D as DebugPanel } from './DebugPanel-Dili1oZt.js';
import './specular-BsLL7hzH.js';

/* src\instances.svelte generated by Svelte v4.2.18 */

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

const numInstances = 512;

function instance($$self, $$props, $$invalidate) {
	let $renderer;
	let $lights;
	let $scene;
	let $materials;
	let $camera;
	component_subscribe($$self, renderer, $$value => $$invalidate(3, $renderer = $$value));
	component_subscribe($$self, lights, $$value => $$invalidate(4, $lights = $$value));
	component_subscribe($$self, scene, $$value => $$invalidate(5, $scene = $$value));
	component_subscribe($$self, materials, $$value => $$invalidate(6, $materials = $$value));
	component_subscribe($$self, camera, $$value => $$invalidate(7, $camera = $$value));
	let canvas;
	let cube;

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
				position: [0, 5, -20],
				target: [0, 1, 0],
				fov: 75
			},
			$camera
		);

		const cubeMesh = createCube();
		const cubePos = identity(createZeroMatrix());
		translate(cubePos, cubePos, [3, 1.5, 0]);
		const material = createMaterialStore({ diffuse: [1, 0.5, 0.5], metalness: 0 });
		set_store_value(materials, $materials = [...$materials, material], $materials);
		const identityMatrix = identity(createZeroMatrix());

		let matrices = new Array(numInstances).fill(0).map((_, index) => {
			let mat = cloneMatrix(identityMatrix);

			// Calculate a single cubic grid
			const gridSize = Math.ceil(Math.cbrt(numInstances));

			// Calculate x, y, z positions within the grid (0-based indices)
			const x = index % gridSize;

			const y = Math.floor(index / gridSize) % gridSize;
			const z = Math.floor(index / (gridSize * gridSize));

			// Center the grid by subtracting half the grid size
			const offsetX = x - (gridSize - 1) / 2;

			const offsetY = y - (gridSize - 1) / 2;
			const offsetZ = z - (gridSize - 1) / 2;

			// Apply transformations
			translate(mat, mat, [offsetX * 2, offsetY * 2, offsetZ * 2]);

			// Add some rotation variation based on index
			rotateY(mat, mat, toRadian(index * 10));

			scale(mat, mat, [0.5, 0.5, 0.5]);
			return mat;
		});

		const light = createLightStore(createPointLight({
			color: [1, 1, 1],
			intensity: 27,
			position: [-2, 12, -12],
			cutoffDistance: 30,
			decayExponent: 1.5
		}));

		cube = create3DObject({
			...cubeMesh,
			instances: numInstances,
			matrices,
			material
		});

		set_store_value(scene, $scene = [...$scene, cube], $scene);
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

	function rotateCube(cube, index) {
		const rotation = 0.001 * Math.PI;
		const tmp = get_store_value(cube.matrices[index]);
		rotateY(tmp, tmp, rotation / 2);
		rotateX(tmp, tmp, rotation);
		rotateZ(tmp, tmp, rotation / 3);
		cube.matrices[index].set(tmp);
	}

	function animate() {
		for (let i = 0; i < numInstances; i++) {
			rotateCube(cube, i);
		}
	}

	function canvas_1_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			canvas = $$value;
			$$invalidate(0, canvas);
		});
	}

	return [canvas, canvas_1_binding];
}

class Instances extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, {});
	}
}

export { Instances as default };
