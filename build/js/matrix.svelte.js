import { S as SvelteComponent, i as init, s as safe_not_equal, M as Menu, e as element, a as space, c as create_component, b as insert, m as mount_component, n as noop, t as transition_in, d as transition_out, f as detach, g as destroy_component, h as component_subscribe, o as onMount, r as renderer, l as lights, j as scene, k as materials, p as camera, A as set_store_value, B as skyblue, y as identity, z as createZeroMatrix, x as translate, C as createLightStore, D as createPointLight, E as create3DObject, F as createOrbitControls, w as scale, G as binding_callbacks, H as createMaterialStore } from './Menu-Bxv9xIi-.js';
import { c as createPolyhedron, a as createSmoothShadedNormals } from './polyhedron-BQ4vgmG4.js';
import { c as createPlane } from './plane-CwQ7YvnU.js';

var easing = {};

Object.defineProperty(easing, "__esModule", {
    value: true
});
easing.linear = linear;
easing.easeInSine = easeInSine;
easing.easeOutSine = easeOutSine;
easing.easeInOutSine = easeInOutSine;
easing.easeInQuad = easeInQuad;
easing.easeOutQuad = easeOutQuad;
easing.easeInOutQuad = easeInOutQuad;
easing.easeInCubic = easeInCubic;
var easeOutCubic_1 = easing.easeOutCubic = easeOutCubic;
easing.easeInOutCubic = easeInOutCubic;
easing.easeInQuart = easeInQuart;
easing.easeOutQuart = easeOutQuart;
easing.easeInOutQuart = easeInOutQuart;
easing.easeInQuint = easeInQuint;
easing.easeOutQuint = easeOutQuint;
easing.easeInOutQuint = easeInOutQuint;
easing.easeInExpo = easeInExpo;
easing.easeOutExpo = easeOutExpo;
easing.easeInOutExpo = easeInOutExpo;
easing.easeInCirc = easeInCirc;
easing.easeOutCirc = easeOutCirc;
easing.easeInOutCirc = easeInOutCirc;
easing.easeInBack = easeInBack;
easing.easeOutBack = easeOutBack;
easing.easeInOutBack = easeInOutBack;
easing.easeInElastic = easeInElastic;
easing.easeOutElastic = easeOutElastic;
easing.easeInOutElastic = easeInOutElastic;
easing.easeOutBounce = easeOutBounce;
easing.easeInBounce = easeInBounce;
easing.easeInOutBounce = easeInOutBounce;
// Based on https://gist.github.com/gre/1650294

// No easing, no acceleration
function linear(t) {
    return t;
}

// Slight acceleration from zero to full speed
function easeInSine(t) {
    return -1 * Math.cos(t * (Math.PI / 2)) + 1;
}

// Slight deceleration at the end
function easeOutSine(t) {
    return Math.sin(t * (Math.PI / 2));
}

// Slight acceleration at beginning and slight deceleration at end
function easeInOutSine(t) {
    return -0.5 * (Math.cos(Math.PI * t) - 1);
}

// Accelerating from zero velocity
function easeInQuad(t) {
    return t * t;
}

// Decelerating to zero velocity
function easeOutQuad(t) {
    return t * (2 - t);
}

// Acceleration until halfway, then deceleration
function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// Accelerating from zero velocity
function easeInCubic(t) {
    return t * t * t;
}

// Decelerating to zero velocity
function easeOutCubic(t) {
    var t1 = t - 1;
    return t1 * t1 * t1 + 1;
}

// Acceleration until halfway, then deceleration
function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
}

// Accelerating from zero velocity
function easeInQuart(t) {
    return t * t * t * t;
}

// Decelerating to zero velocity
function easeOutQuart(t) {
    var t1 = t - 1;
    return 1 - t1 * t1 * t1 * t1;
}

// Acceleration until halfway, then deceleration
function easeInOutQuart(t) {
    var t1 = t - 1;
    return t < 0.5 ? 8 * t * t * t * t : 1 - 8 * t1 * t1 * t1 * t1;
}

// Accelerating from zero velocity
function easeInQuint(t) {
    return t * t * t * t * t;
}

// Decelerating to zero velocity
function easeOutQuint(t) {
    var t1 = t - 1;
    return 1 + t1 * t1 * t1 * t1 * t1;
}

// Acceleration until halfway, then deceleration
function easeInOutQuint(t) {
    var t1 = t - 1;
    return t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * t1 * t1 * t1 * t1 * t1;
}

// Accelerate exponentially until finish
function easeInExpo(t) {

    if (t === 0) {
        return 0;
    }

    return Math.pow(2, 10 * (t - 1));
}

// Initial exponential acceleration slowing to stop
function easeOutExpo(t) {

    if (t === 1) {
        return 1;
    }

    return -Math.pow(2, -10 * t) + 1;
}

// Exponential acceleration and deceleration
function easeInOutExpo(t) {

    if (t === 0 || t === 1) {
        return t;
    }

    var scaledTime = t * 2;
    var scaledTime1 = scaledTime - 1;

    if (scaledTime < 1) {
        return 0.5 * Math.pow(2, 10 * scaledTime1);
    }

    return 0.5 * (-Math.pow(2, -10 * scaledTime1) + 2);
}

// Increasing velocity until stop
function easeInCirc(t) {

    var scaledTime = t / 1;
    return -1 * (Math.sqrt(1 - scaledTime * t) - 1);
}

// Start fast, decreasing velocity until stop
function easeOutCirc(t) {

    var t1 = t - 1;
    return Math.sqrt(1 - t1 * t1);
}

// Fast increase in velocity, fast decrease in velocity
function easeInOutCirc(t) {

    var scaledTime = t * 2;
    var scaledTime1 = scaledTime - 2;

    if (scaledTime < 1) {
        return -0.5 * (Math.sqrt(1 - scaledTime * scaledTime) - 1);
    }

    return 0.5 * (Math.sqrt(1 - scaledTime1 * scaledTime1) + 1);
}

// Slow movement backwards then fast snap to finish
function easeInBack(t) {
    var magnitude = arguments.length <= 1 || arguments[1] === undefined ? 1.70158 : arguments[1];


    var scaledTime = t / 1;
    return scaledTime * scaledTime * ((magnitude + 1) * scaledTime - magnitude);
}

// Fast snap to backwards point then slow resolve to finish
function easeOutBack(t) {
    var magnitude = arguments.length <= 1 || arguments[1] === undefined ? 1.70158 : arguments[1];


    var scaledTime = t / 1 - 1;

    return scaledTime * scaledTime * ((magnitude + 1) * scaledTime + magnitude) + 1;
}

// Slow movement backwards, fast snap to past finish, slow resolve to finish
function easeInOutBack(t) {
    var magnitude = arguments.length <= 1 || arguments[1] === undefined ? 1.70158 : arguments[1];


    var scaledTime = t * 2;
    var scaledTime2 = scaledTime - 2;

    var s = magnitude * 1.525;

    if (scaledTime < 1) {

        return 0.5 * scaledTime * scaledTime * ((s + 1) * scaledTime - s);
    }

    return 0.5 * (scaledTime2 * scaledTime2 * ((s + 1) * scaledTime2 + s) + 2);
}
// Bounces slowly then quickly to finish
function easeInElastic(t) {
    var magnitude = arguments.length <= 1 || arguments[1] === undefined ? 0.7 : arguments[1];


    if (t === 0 || t === 1) {
        return t;
    }

    var scaledTime = t / 1;
    var scaledTime1 = scaledTime - 1;

    var p = 1 - magnitude;
    var s = p / (2 * Math.PI) * Math.asin(1);

    return -(Math.pow(2, 10 * scaledTime1) * Math.sin((scaledTime1 - s) * (2 * Math.PI) / p));
}

// Fast acceleration, bounces to zero
function easeOutElastic(t) {
    var magnitude = arguments.length <= 1 || arguments[1] === undefined ? 0.7 : arguments[1];


    var p = 1 - magnitude;
    var scaledTime = t * 2;

    if (t === 0 || t === 1) {
        return t;
    }

    var s = p / (2 * Math.PI) * Math.asin(1);
    return Math.pow(2, -10 * scaledTime) * Math.sin((scaledTime - s) * (2 * Math.PI) / p) + 1;
}

// Slow start and end, two bounces sandwich a fast motion
function easeInOutElastic(t) {
    var magnitude = arguments.length <= 1 || arguments[1] === undefined ? 0.65 : arguments[1];


    var p = 1 - magnitude;

    if (t === 0 || t === 1) {
        return t;
    }

    var scaledTime = t * 2;
    var scaledTime1 = scaledTime - 1;

    var s = p / (2 * Math.PI) * Math.asin(1);

    if (scaledTime < 1) {
        return -0.5 * (Math.pow(2, 10 * scaledTime1) * Math.sin((scaledTime1 - s) * (2 * Math.PI) / p));
    }

    return Math.pow(2, -10 * scaledTime1) * Math.sin((scaledTime1 - s) * (2 * Math.PI) / p) * 0.5 + 1;
}

// Bounce to completion
function easeOutBounce(t) {

    var scaledTime = t / 1;

    if (scaledTime < 1 / 2.75) {

        return 7.5625 * scaledTime * scaledTime;
    } else if (scaledTime < 2 / 2.75) {

        var scaledTime2 = scaledTime - 1.5 / 2.75;
        return 7.5625 * scaledTime2 * scaledTime2 + 0.75;
    } else if (scaledTime < 2.5 / 2.75) {

        var _scaledTime = scaledTime - 2.25 / 2.75;
        return 7.5625 * _scaledTime * _scaledTime + 0.9375;
    } else {

        var _scaledTime2 = scaledTime - 2.625 / 2.75;
        return 7.5625 * _scaledTime2 * _scaledTime2 + 0.984375;
    }
}

// Bounce increasing in velocity until completion
function easeInBounce(t) {
    return 1 - easeOutBounce(1 - t);
}

// Bounce in and bounce out
function easeInOutBounce(t) {

    if (t < 0.5) {

        return easeInBounce(t * 2) * 0.5;
    }

    return easeOutBounce(t * 2 - 1) * 0.5 + 0.5;
}

/* src\matrix.svelte generated by Svelte v4.2.18 */

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
	let sphere;

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
				position: [0, 1, -5],
				target: [0, 1, 0],
				fov: 75
			},
			$camera
		);

		const sphereMesh = createPolyhedron(1, 5, createSmoothShadedNormals);
		const spherePos = identity(createZeroMatrix());
		const material = createMaterialStore({ diffuse: [1, 0.5, 0.5], metalness: 0 });
		const groundMesh = createPlane(10, 10, 1, 1);
		const groundMatrix = identity(createZeroMatrix());
		translate(groundMatrix, groundMatrix, [0, -1, 0]);
		const groundMaterial = createMaterialStore({ diffuse: [1, 1, 1], metalness: 0 });

		const light = createLightStore(createPointLight({
			position: [-2, 3, -3],
			color: [1, 1, 1],
			intensity: 20,
			cutoffDistance: 0,
			decayExponent: 2
		}));

		sphere = create3DObject({
			...sphereMesh,
			matrix: spherePos,
			material
		});

		set_store_value(materials, $materials = [...$materials, material, groundMaterial], $materials);

		set_store_value(
			scene,
			$scene = [
				...$scene,
				sphere,
				create3DObject({
					...groundMesh,
					matrix: groundMatrix,
					material: groundMaterial
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

	function animate() {
		const moveTime = 1;
		const bounceTime = 0.2;
		const elasticDeformation = 0.5;

		// time goes from 0 to (moveTime + bounceTime) in cycle using the modulo operator
		const time = performance.now() / 1000 % (moveTime + bounceTime);

		/*
this equation creates the elastic deformation using time as input
equation description (-> is a range) :
[max] => moveTime->moveTime+bounceTime
[-moveTime] => 0->bounceTime
[-bounceTime/2] => -bounceTime/2->0->0->bounceTime/2
[abs] => bounceTime/2->0->0->bounceTime/2
[* 1/bounceTime] => 1->0->0->1
[1-] => 0->1->1->0
*/
		const sphereScaleNormalized = 1 - Math.abs((Math.max(time, moveTime) - moveTime - bounceTime / 2) * 1 / (bounceTime / 2));

		/*
[*elasticDeformation] => 0->elasticDeformation->elasticDeformation->0
[+1] => 1.3->1->1->1.3
*/
		const sphereScaleXZ = easeOutCubic_1(sphereScaleNormalized) * elasticDeformation + 1;

		const sphereScaleY = 1 - easeOutCubic_1(sphereScaleNormalized) * elasticDeformation;
		const sphereCrushY = easeOutCubic_1(sphereScaleNormalized) * elasticDeformation;

		/*
this equation creates the bounce effect movement using time as input
equation description (-> is a range) :

[min] => 0 -> moveTime
[-moveTime/2] => -moveTime/2 -> moveTime/2
[abs] => moveTime/2 -> 0 -> 0 -> moveTime/2
[* 1/(moveTime/2)] => 1 -> 0 -> 0 -> 1
[* -1] => -1 -> 0 -> 0 -> -1
[+1] => 0 -> 1 -> 1 ->0

*/
		const posYNormalized = Math.abs(Math.min(time, moveTime) - moveTime / 2) * 1 / (moveTime / 2) * -1 + 1;

		const posY = easeOutCubic_1(posYNormalized) * 3;

		/* 
elastic bounce effect factor
[min] => 0 -> moveTime
[/moveTime] => 0 -> 1
[min] => 0 -> 0.5 -> 0.5
[*2] => 0 -> 1 -> 1
[1-] => 1 -> 0 -> 0
*/
		const elasticBounceFactor = 1 - Math.min(0.5, Math.min(time, moveTime) / moveTime) * 2;

		const elasticBounceSinFrequency = 12;
		const elasticBounceAmplitude = 0.5;
		const elasticBounce = Math.sin(time * Math.PI * elasticBounceSinFrequency) * elasticBounceFactor * elasticBounceAmplitude;
		const newMatrix = identity(createZeroMatrix());
		translate(newMatrix, newMatrix, [0, posY - sphereCrushY, 0]);

		scale(newMatrix, newMatrix, [
			sphereScaleXZ - elasticBounce / 2,
			sphereScaleY + elasticBounce,
			sphereScaleXZ - elasticBounce / 2
		]);

		sphere.matrix.set(newMatrix);
	}

	function canvas_1_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			canvas = $$value;
			$$invalidate(0, canvas);
		});
	}

	return [canvas, canvas_1_binding];
}

class Matrix extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, {});
	}
}

export { Matrix as default };
