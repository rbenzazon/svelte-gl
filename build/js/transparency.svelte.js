import { d as drawModes, c as createVec3, l as lerp, n as normalize, m as multiplyScalarVec3, a as normalizeNormals, S as SvelteComponent, i as init, s as safe_not_equal, M as Menu, D as DebugPanel, e as element, b as space, f as create_component, g as insert, h as mount_component, j as noop, t as transition_in, k as transition_out, o as detach, p as destroy_component, q as component_subscribe, r as onMount, u as renderer, v as lights, w as scene, x as materials, y as camera, z as set_store_value, A as skyblue, B as identity, C as translate, E as createLightStore, F as createPointLight, G as create3DObject, H as createOrbitControls, I as binding_callbacks, J as createMaterialStore, K as createFlatShadedNormals, L as createPlane } from './DebugPanel-DZ27oKsn.js';

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

function createCube() {
	return {
		attributes: {
			positions: [
				//top
				-1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0,
				//left
				-1.0, 1.0, 1.0, -1.0, -1.0, 1.0, -1.0, -1.0, -1.0, -1.0, 1.0, -1.0,
				//right
				1.0, 1.0, 1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0,
				//front
				1.0, 1.0, 1.0, 1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0,
				//back
				1.0, 1.0, -1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, -1.0,
				//bottom
				-1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0,
			],
			normals: [
				//top
				0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0,
				//left
				-1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0,
				//right
				1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0,
				//front
				0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0,
				//back
				0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0,
				//bottom
				0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0,
			],
			elements: [
				//top
				0, 1, 2, 0, 2, 3,
				//left
				5, 4, 6, 6, 4, 7,
				// right
				8, 9, 10, 8, 10, 11,
				//front
				13, 12, 14, 15, 14, 12,
				//back
				16, 17, 18, 16, 18, 19,
				//bottom
				21, 20, 22, 22, 20, 23,
			],
		},
		drawMode: drawModes[4],
	};
}

/* src\transparency.svelte generated by Svelte v4.2.18 */

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
				position: [0, 5, -5],
				target: [0, 1, 0],
				fov: 75
			},
			$camera
		);

		const cubeMesh = createCube();
		const cubePos = identity(new Float32Array(16));
		translate(cubePos, cubePos, [3, 1.5, 0]);
		const material = createMaterialStore({ diffuse: [1, 0.5, 0.5], metalness: 0 });
		const sphereMesh = createPolyhedron(1, 5, createSmoothShadedNormals);
		const spherePos = identity(new Float32Array(16));
		translate(spherePos, spherePos, [-3, 1.5, 0]);

		const transparentMaterial = createMaterialStore({
			diffuse: [1, 1, 0.5],
			metalness: 0,
			opacity: 0.5
		});

		const polyhedronMesh = createPolyhedron(1, 2, createFlatShadedNormals);
		const polyhedronPos = identity(new Float32Array(16));
		translate(polyhedronPos, polyhedronPos, [0, 1.5, 0]);
		const groundMesh = createPlane(10, 10, 1, 1);
		const groundMatrix = identity(new Float32Array(16));
		translate(groundMatrix, groundMatrix, [0, 0, 0]);
		const groundMaterial = createMaterialStore({ diffuse: [1, 1, 1], metalness: 0 });
		set_store_value(materials, $materials = [...$materials, material, transparentMaterial, groundMaterial], $materials);

		const light = createLightStore(createPointLight({
			position: [-2, 3, -3],
			color: [1, 1, 1],
			intensity: 20,
			cutoffDistance: 0,
			decayExponent: 2
		}));

		const light2 = createLightStore(createPointLight({
			position: [2, 0, -4],
			color: [1, 1, 1],
			intensity: 5,
			cutoffDistance: 0,
			decayExponent: 2
		}));

		set_store_value(
			scene,
			$scene = [
				...$scene,
				create3DObject({
					...sphereMesh,
					matrix: spherePos,
					material: transparentMaterial
				}),
				create3DObject({
					...polyhedronMesh,
					matrix: polyhedronPos,
					material: transparentMaterial
				}),
				create3DObject({ ...cubeMesh, matrix: cubePos, material }),
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

	function canvas_1_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			canvas = $$value;
			$$invalidate(0, canvas);
		});
	}

	return [canvas, canvas_1_binding];
}

class Transparency extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, {});
	}
}

export { Transparency as default };
