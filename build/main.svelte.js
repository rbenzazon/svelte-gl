/** @returns {void} */
function noop() {}

function run(fn) {
	return fn();
}

function blank_object() {
	return Object.create(null);
}

/**
 * @param {Function[]} fns
 * @returns {void}
 */
function run_all(fns) {
	fns.forEach(run);
}

/**
 * @param {any} thing
 * @returns {thing is Function}
 */
function is_function(thing) {
	return typeof thing === 'function';
}

/** @returns {boolean} */
function safe_not_equal(a, b) {
	return a != a ? b == b : a !== b || (a && typeof a === 'object') || typeof a === 'function';
}

/** @returns {boolean} */
function is_empty(obj) {
	return Object.keys(obj).length === 0;
}

function subscribe(store, ...callbacks) {
	if (store == null) {
		for (const callback of callbacks) {
			callback(undefined);
		}
		return noop;
	}
	const unsub = store.subscribe(...callbacks);
	return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
}

/**
 * Get the current value from a store by subscribing and immediately unsubscribing.
 *
 * https://svelte.dev/docs/svelte-store#get
 * @template T
 * @param {import('../store/public.js').Readable<T>} store
 * @returns {T}
 */
function get_store_value(store) {
	let value;
	subscribe(store, (_) => (value = _))();
	return value;
}

/** @returns {void} */
function component_subscribe(component, store, callback) {
	component.$$.on_destroy.push(subscribe(store, callback));
}

function set_store_value(store, ret, value) {
	store.set(value);
	return ret;
}

/**
 * @param {Node} target
 * @param {Node} node
 * @param {Node} [anchor]
 * @returns {void}
 */
function insert(target, node, anchor) {
	target.insertBefore(node, anchor || null);
}

/**
 * @param {Node} node
 * @returns {void}
 */
function detach(node) {
	if (node.parentNode) {
		node.parentNode.removeChild(node);
	}
}

/**
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} name
 * @returns {HTMLElementTagNameMap[K]}
 */
function element(name) {
	return document.createElement(name);
}

/**
 * @param {Element} element
 * @returns {ChildNode[]}
 */
function children(element) {
	return Array.from(element.childNodes);
}

/**
 * @typedef {Node & {
 * 	claim_order?: number;
 * 	hydrate_init?: true;
 * 	actual_end_child?: NodeEx;
 * 	childNodes: NodeListOf<NodeEx>;
 * }} NodeEx
 */

/** @typedef {ChildNode & NodeEx} ChildNodeEx */

/** @typedef {NodeEx & { claim_order: number }} NodeEx2 */

/**
 * @typedef {ChildNodeEx[] & {
 * 	claim_info?: {
 * 		last_index: number;
 * 		total_claimed: number;
 * 	};
 * }} ChildNodeArray
 */

let current_component;

/** @returns {void} */
function set_current_component(component) {
	current_component = component;
}

function get_current_component() {
	if (!current_component) throw new Error('Function called outside component initialization');
	return current_component;
}

/**
 * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
 * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
 * it can be called from an external module).
 *
 * If a function is returned _synchronously_ from `onMount`, it will be called when the component is unmounted.
 *
 * `onMount` does not run inside a [server-side component](https://svelte.dev/docs#run-time-server-side-component-api).
 *
 * https://svelte.dev/docs/svelte#onmount
 * @template T
 * @param {() => import('./private.js').NotFunction<T> | Promise<import('./private.js').NotFunction<T>> | (() => any)} fn
 * @returns {void}
 */
function onMount(fn) {
	get_current_component().$$.on_mount.push(fn);
}

const dirty_components = [];
const binding_callbacks = [];

let render_callbacks = [];

const flush_callbacks = [];

const resolved_promise = /* @__PURE__ */ Promise.resolve();

let update_scheduled = false;

/** @returns {void} */
function schedule_update() {
	if (!update_scheduled) {
		update_scheduled = true;
		resolved_promise.then(flush);
	}
}

/** @returns {void} */
function add_render_callback(fn) {
	render_callbacks.push(fn);
}

// flush() calls callbacks in this order:
// 1. All beforeUpdate callbacks, in order: parents before children
// 2. All bind:this callbacks, in reverse order: children before parents.
// 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
//    for afterUpdates called during the initial onMount, which are called in
//    reverse order: children before parents.
// Since callbacks might update component values, which could trigger another
// call to flush(), the following steps guard against this:
// 1. During beforeUpdate, any updated components will be added to the
//    dirty_components array and will cause a reentrant call to flush(). Because
//    the flush index is kept outside the function, the reentrant call will pick
//    up where the earlier call left off and go through all dirty components. The
//    current_component value is saved and restored so that the reentrant call will
//    not interfere with the "parent" flush() call.
// 2. bind:this callbacks cannot trigger new flush() calls.
// 3. During afterUpdate, any updated components will NOT have their afterUpdate
//    callback called a second time; the seen_callbacks set, outside the flush()
//    function, guarantees this behavior.
const seen_callbacks = new Set();

let flushidx = 0; // Do *not* move this inside the flush() function

/** @returns {void} */
function flush() {
	// Do not reenter flush while dirty components are updated, as this can
	// result in an infinite loop. Instead, let the inner flush handle it.
	// Reentrancy is ok afterwards for bindings etc.
	if (flushidx !== 0) {
		return;
	}
	const saved_component = current_component;
	do {
		// first, call beforeUpdate functions
		// and update components
		try {
			while (flushidx < dirty_components.length) {
				const component = dirty_components[flushidx];
				flushidx++;
				set_current_component(component);
				update(component.$$);
			}
		} catch (e) {
			// reset dirty state to not end up in a deadlocked state and then rethrow
			dirty_components.length = 0;
			flushidx = 0;
			throw e;
		}
		set_current_component(null);
		dirty_components.length = 0;
		flushidx = 0;
		while (binding_callbacks.length) binding_callbacks.pop()();
		// then, once components are updated, call
		// afterUpdate functions. This may cause
		// subsequent updates...
		for (let i = 0; i < render_callbacks.length; i += 1) {
			const callback = render_callbacks[i];
			if (!seen_callbacks.has(callback)) {
				// ...so guard against infinite loops
				seen_callbacks.add(callback);
				callback();
			}
		}
		render_callbacks.length = 0;
	} while (dirty_components.length);
	while (flush_callbacks.length) {
		flush_callbacks.pop()();
	}
	update_scheduled = false;
	seen_callbacks.clear();
	set_current_component(saved_component);
}

/** @returns {void} */
function update($$) {
	if ($$.fragment !== null) {
		$$.update();
		run_all($$.before_update);
		const dirty = $$.dirty;
		$$.dirty = [-1];
		$$.fragment && $$.fragment.p($$.ctx, dirty);
		$$.after_update.forEach(add_render_callback);
	}
}

/**
 * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
 * @param {Function[]} fns
 * @returns {void}
 */
function flush_render_callbacks(fns) {
	const filtered = [];
	const targets = [];
	render_callbacks.forEach((c) => (fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c)));
	targets.forEach((c) => c());
	render_callbacks = filtered;
}

const outroing = new Set();

/**
 * @param {import('./private.js').Fragment} block
 * @param {0 | 1} [local]
 * @returns {void}
 */
function transition_in(block, local) {
	if (block && block.i) {
		outroing.delete(block);
		block.i(local);
	}
}

/** @typedef {1} INTRO */
/** @typedef {0} OUTRO */
/** @typedef {{ direction: 'in' | 'out' | 'both' }} TransitionOptions */
/** @typedef {(node: Element, params: any, options: TransitionOptions) => import('../transition/public.js').TransitionConfig} TransitionFn */

/**
 * @typedef {Object} Outro
 * @property {number} r
 * @property {Function[]} c
 * @property {Object} p
 */

/**
 * @typedef {Object} PendingProgram
 * @property {number} start
 * @property {INTRO|OUTRO} b
 * @property {Outro} [group]
 */

/**
 * @typedef {Object} Program
 * @property {number} a
 * @property {INTRO|OUTRO} b
 * @property {1|-1} d
 * @property {number} duration
 * @property {number} start
 * @property {number} end
 * @property {Outro} [group]
 */

/** @returns {void} */
function mount_component(component, target, anchor) {
	const { fragment, after_update } = component.$$;
	fragment && fragment.m(target, anchor);
	// onMount happens before the initial afterUpdate
	add_render_callback(() => {
		const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
		// if the component was destroyed immediately
		// it will update the `$$.on_destroy` reference to `null`.
		// the destructured on_destroy may still reference to the old array
		if (component.$$.on_destroy) {
			component.$$.on_destroy.push(...new_on_destroy);
		} else {
			// Edge case - component was destroyed immediately,
			// most likely as a result of a binding initialising
			run_all(new_on_destroy);
		}
		component.$$.on_mount = [];
	});
	after_update.forEach(add_render_callback);
}

/** @returns {void} */
function destroy_component(component, detaching) {
	const $$ = component.$$;
	if ($$.fragment !== null) {
		flush_render_callbacks($$.after_update);
		run_all($$.on_destroy);
		$$.fragment && $$.fragment.d(detaching);
		// TODO null out other refs, including component.$$ (but need to
		// preserve final state?)
		$$.on_destroy = $$.fragment = null;
		$$.ctx = [];
	}
}

/** @returns {void} */
function make_dirty(component, i) {
	if (component.$$.dirty[0] === -1) {
		dirty_components.push(component);
		schedule_update();
		component.$$.dirty.fill(0);
	}
	component.$$.dirty[(i / 31) | 0] |= 1 << i % 31;
}

// TODO: Document the other params
/**
 * @param {SvelteComponent} component
 * @param {import('./public.js').ComponentConstructorOptions} options
 *
 * @param {import('./utils.js')['not_equal']} not_equal Used to compare props and state values.
 * @param {(target: Element | ShadowRoot) => void} [append_styles] Function that appends styles to the DOM when the component is first initialised.
 * This will be the `add_css` function from the compiled component.
 *
 * @returns {void}
 */
function init(
	component,
	options,
	instance,
	create_fragment,
	not_equal,
	props,
	append_styles = null,
	dirty = [-1]
) {
	const parent_component = current_component;
	set_current_component(component);
	/** @type {import('./private.js').T$$} */
	const $$ = (component.$$ = {
		fragment: null,
		ctx: [],
		// state
		props,
		update: noop,
		not_equal,
		bound: blank_object(),
		// lifecycle
		on_mount: [],
		on_destroy: [],
		on_disconnect: [],
		before_update: [],
		after_update: [],
		context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
		// everything else
		callbacks: blank_object(),
		dirty,
		skip_bound: false,
		root: options.target || parent_component.$$.root
	});
	append_styles && append_styles($$.root);
	let ready = false;
	$$.ctx = instance
		? instance(component, options.props || {}, (i, ret, ...rest) => {
				const value = rest.length ? rest[0] : ret;
				if ($$.ctx && not_equal($$.ctx[i], ($$.ctx[i] = value))) {
					if (!$$.skip_bound && $$.bound[i]) $$.bound[i](value);
					if (ready) make_dirty(component, i);
				}
				return ret;
		  })
		: [];
	$$.update();
	ready = true;
	run_all($$.before_update);
	// `false` as a special case of no DOM component
	$$.fragment = create_fragment ? create_fragment($$.ctx) : false;
	if (options.target) {
		if (options.hydrate) {
			// TODO: what is the correct type here?
			// @ts-expect-error
			const nodes = children(options.target);
			$$.fragment && $$.fragment.l(nodes);
			nodes.forEach(detach);
		} else {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			$$.fragment && $$.fragment.c();
		}
		if (options.intro) transition_in(component.$$.fragment);
		mount_component(component, options.target, options.anchor);
		flush();
	}
	set_current_component(parent_component);
}

/**
 * Base class for Svelte components. Used when dev=false.
 *
 * @template {Record<string, any>} [Props=any]
 * @template {Record<string, any>} [Events=any]
 */
class SvelteComponent {
	/**
	 * ### PRIVATE API
	 *
	 * Do not use, may change at any time
	 *
	 * @type {any}
	 */
	$$ = undefined;
	/**
	 * ### PRIVATE API
	 *
	 * Do not use, may change at any time
	 *
	 * @type {any}
	 */
	$$set = undefined;

	/** @returns {void} */
	$destroy() {
		destroy_component(this, 1);
		this.$destroy = noop;
	}

	/**
	 * @template {Extract<keyof Events, string>} K
	 * @param {K} type
	 * @param {((e: Events[K]) => void) | null | undefined} callback
	 * @returns {() => void}
	 */
	$on(type, callback) {
		if (!is_function(callback)) {
			return noop;
		}
		const callbacks = this.$$.callbacks[type] || (this.$$.callbacks[type] = []);
		callbacks.push(callback);
		return () => {
			const index = callbacks.indexOf(callback);
			if (index !== -1) callbacks.splice(index, 1);
		};
	}

	/**
	 * @param {Partial<Props>} props
	 * @returns {void}
	 */
	$set(props) {
		if (this.$$set && !is_empty(props)) {
			this.$$.skip_bound = true;
			this.$$set(props);
			this.$$.skip_bound = false;
		}
	}
}

/**
 * @typedef {Object} CustomElementPropDefinition
 * @property {string} [attribute]
 * @property {boolean} [reflect]
 * @property {'String'|'Boolean'|'Number'|'Array'|'Object'} [type]
 */

// generated during release, do not modify

const PUBLIC_VERSION = '4';

if (typeof window !== 'undefined')
	// @ts-ignore
	(window.__svelte || (window.__svelte = { v: new Set() })).v.add(PUBLIC_VERSION);

/**
 * Common utilities
 * @module glMatrix
 */
// Configuration Constants
var EPSILON = 0.000001;
var ARRAY_TYPE = typeof Float32Array !== 'undefined' ? Float32Array : Array;
if (!Math.hypot) Math.hypot = function () {
  var y = 0,
      i = arguments.length;

  while (i--) {
    y += arguments[i] * arguments[i];
  }

  return Math.sqrt(y);
};

/**
 * 4x4 Matrix<br>Format: column-major, when typed out it looks like row-major<br>The matrices are being post multiplied.
 * @module mat4
 */

/**
 * Creates a new identity mat4
 *
 * @returns {mat4} a new 4x4 matrix
 */

function create$1() {
  var out = new ARRAY_TYPE(16);

  if (ARRAY_TYPE != Float32Array) {
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
  }

  out[0] = 1;
  out[5] = 1;
  out[10] = 1;
  out[15] = 1;
  return out;
}
/**
 * Set a mat4 to the identity matrix
 *
 * @param {mat4} out the receiving matrix
 * @returns {mat4} out
 */

function identity(out) {
  out[0] = 1;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = 1;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = 1;
  out[11] = 0;
  out[12] = 0;
  out[13] = 0;
  out[14] = 0;
  out[15] = 1;
  return out;
}
/**
 * Transpose the values of a mat4
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the source matrix
 * @returns {mat4} out
 */

function transpose(out, a) {
  // If we are transposing ourselves we can skip a few steps but have to cache some values
  if (out === a) {
    var a01 = a[1],
        a02 = a[2],
        a03 = a[3];
    var a12 = a[6],
        a13 = a[7];
    var a23 = a[11];
    out[1] = a[4];
    out[2] = a[8];
    out[3] = a[12];
    out[4] = a01;
    out[6] = a[9];
    out[7] = a[13];
    out[8] = a02;
    out[9] = a12;
    out[11] = a[14];
    out[12] = a03;
    out[13] = a13;
    out[14] = a23;
  } else {
    out[0] = a[0];
    out[1] = a[4];
    out[2] = a[8];
    out[3] = a[12];
    out[4] = a[1];
    out[5] = a[5];
    out[6] = a[9];
    out[7] = a[13];
    out[8] = a[2];
    out[9] = a[6];
    out[10] = a[10];
    out[11] = a[14];
    out[12] = a[3];
    out[13] = a[7];
    out[14] = a[11];
    out[15] = a[15];
  }

  return out;
}
/**
 * Inverts a mat4
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the source matrix
 * @returns {mat4} out
 */

function invert(out, a) {
  var a00 = a[0],
      a01 = a[1],
      a02 = a[2],
      a03 = a[3];
  var a10 = a[4],
      a11 = a[5],
      a12 = a[6],
      a13 = a[7];
  var a20 = a[8],
      a21 = a[9],
      a22 = a[10],
      a23 = a[11];
  var a30 = a[12],
      a31 = a[13],
      a32 = a[14],
      a33 = a[15];
  var b00 = a00 * a11 - a01 * a10;
  var b01 = a00 * a12 - a02 * a10;
  var b02 = a00 * a13 - a03 * a10;
  var b03 = a01 * a12 - a02 * a11;
  var b04 = a01 * a13 - a03 * a11;
  var b05 = a02 * a13 - a03 * a12;
  var b06 = a20 * a31 - a21 * a30;
  var b07 = a20 * a32 - a22 * a30;
  var b08 = a20 * a33 - a23 * a30;
  var b09 = a21 * a32 - a22 * a31;
  var b10 = a21 * a33 - a23 * a31;
  var b11 = a22 * a33 - a23 * a32; // Calculate the determinant

  var det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

  if (!det) {
    return null;
  }

  det = 1.0 / det;
  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
  return out;
}
/**
 * Rotates a matrix by the given angle around the X axis
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */

function rotateX(out, a, rad) {
  var s = Math.sin(rad);
  var c = Math.cos(rad);
  var a10 = a[4];
  var a11 = a[5];
  var a12 = a[6];
  var a13 = a[7];
  var a20 = a[8];
  var a21 = a[9];
  var a22 = a[10];
  var a23 = a[11];

  if (a !== out) {
    // If the source and destination differ, copy the unchanged rows
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
  } // Perform axis-specific matrix multiplication


  out[4] = a10 * c + a20 * s;
  out[5] = a11 * c + a21 * s;
  out[6] = a12 * c + a22 * s;
  out[7] = a13 * c + a23 * s;
  out[8] = a20 * c - a10 * s;
  out[9] = a21 * c - a11 * s;
  out[10] = a22 * c - a12 * s;
  out[11] = a23 * c - a13 * s;
  return out;
}
/**
 * Rotates a matrix by the given angle around the Y axis
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */

function rotateY(out, a, rad) {
  var s = Math.sin(rad);
  var c = Math.cos(rad);
  var a00 = a[0];
  var a01 = a[1];
  var a02 = a[2];
  var a03 = a[3];
  var a20 = a[8];
  var a21 = a[9];
  var a22 = a[10];
  var a23 = a[11];

  if (a !== out) {
    // If the source and destination differ, copy the unchanged rows
    out[4] = a[4];
    out[5] = a[5];
    out[6] = a[6];
    out[7] = a[7];
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
  } // Perform axis-specific matrix multiplication


  out[0] = a00 * c - a20 * s;
  out[1] = a01 * c - a21 * s;
  out[2] = a02 * c - a22 * s;
  out[3] = a03 * c - a23 * s;
  out[8] = a00 * s + a20 * c;
  out[9] = a01 * s + a21 * c;
  out[10] = a02 * s + a22 * c;
  out[11] = a03 * s + a23 * c;
  return out;
}
/**
 * Rotates a matrix by the given angle around the Z axis
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */

function rotateZ(out, a, rad) {
  var s = Math.sin(rad);
  var c = Math.cos(rad);
  var a00 = a[0];
  var a01 = a[1];
  var a02 = a[2];
  var a03 = a[3];
  var a10 = a[4];
  var a11 = a[5];
  var a12 = a[6];
  var a13 = a[7];

  if (a !== out) {
    // If the source and destination differ, copy the unchanged last row
    out[8] = a[8];
    out[9] = a[9];
    out[10] = a[10];
    out[11] = a[11];
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
  } // Perform axis-specific matrix multiplication


  out[0] = a00 * c + a10 * s;
  out[1] = a01 * c + a11 * s;
  out[2] = a02 * c + a12 * s;
  out[3] = a03 * c + a13 * s;
  out[4] = a10 * c - a00 * s;
  out[5] = a11 * c - a01 * s;
  out[6] = a12 * c - a02 * s;
  out[7] = a13 * c - a03 * s;
  return out;
}
/**
 * Generates a perspective projection matrix with the given bounds.
 * The near/far clip planes correspond to a normalized device coordinate Z range of [-1, 1],
 * which matches WebGL/OpenGL's clip volume.
 * Passing null/undefined/no value for far will generate infinite projection matrix.
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {number} fovy Vertical field of view in radians
 * @param {number} aspect Aspect ratio. typically viewport width/height
 * @param {number} near Near bound of the frustum
 * @param {number} far Far bound of the frustum, can be null or Infinity
 * @returns {mat4} out
 */

function perspectiveNO(out, fovy, aspect, near, far) {
  var f = 1.0 / Math.tan(fovy / 2),
      nf;
  out[0] = f / aspect;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = f;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[11] = -1;
  out[12] = 0;
  out[13] = 0;
  out[15] = 0;

  if (far != null && far !== Infinity) {
    nf = 1 / (near - far);
    out[10] = (far + near) * nf;
    out[14] = 2 * far * near * nf;
  } else {
    out[10] = -1;
    out[14] = -2 * near;
  }

  return out;
}
/**
 * Alias for {@link mat4.perspectiveNO}
 * @function
 */

var perspective = perspectiveNO;
/**
 * Generates a look-at matrix with the given eye position, focal point, and up axis.
 * If you want a matrix that actually makes an object look at another object, you should use targetTo instead.
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {ReadonlyVec3} eye Position of the viewer
 * @param {ReadonlyVec3} center Point the viewer is looking at
 * @param {ReadonlyVec3} up vec3 pointing up
 * @returns {mat4} out
 */

function lookAt(out, eye, center, up) {
  var x0, x1, x2, y0, y1, y2, z0, z1, z2, len;
  var eyex = eye[0];
  var eyey = eye[1];
  var eyez = eye[2];
  var upx = up[0];
  var upy = up[1];
  var upz = up[2];
  var centerx = center[0];
  var centery = center[1];
  var centerz = center[2];

  if (Math.abs(eyex - centerx) < EPSILON && Math.abs(eyey - centery) < EPSILON && Math.abs(eyez - centerz) < EPSILON) {
    return identity(out);
  }

  z0 = eyex - centerx;
  z1 = eyey - centery;
  z2 = eyez - centerz;
  len = 1 / Math.hypot(z0, z1, z2);
  z0 *= len;
  z1 *= len;
  z2 *= len;
  x0 = upy * z2 - upz * z1;
  x1 = upz * z0 - upx * z2;
  x2 = upx * z1 - upy * z0;
  len = Math.hypot(x0, x1, x2);

  if (!len) {
    x0 = 0;
    x1 = 0;
    x2 = 0;
  } else {
    len = 1 / len;
    x0 *= len;
    x1 *= len;
    x2 *= len;
  }

  y0 = z1 * x2 - z2 * x1;
  y1 = z2 * x0 - z0 * x2;
  y2 = z0 * x1 - z1 * x0;
  len = Math.hypot(y0, y1, y2);

  if (!len) {
    y0 = 0;
    y1 = 0;
    y2 = 0;
  } else {
    len = 1 / len;
    y0 *= len;
    y1 *= len;
    y2 *= len;
  }

  out[0] = x0;
  out[1] = y0;
  out[2] = z0;
  out[3] = 0;
  out[4] = x1;
  out[5] = y1;
  out[6] = z1;
  out[7] = 0;
  out[8] = x2;
  out[9] = y2;
  out[10] = z2;
  out[11] = 0;
  out[12] = -(x0 * eyex + x1 * eyey + x2 * eyez);
  out[13] = -(y0 * eyex + y1 * eyey + y2 * eyez);
  out[14] = -(z0 * eyex + z1 * eyey + z2 * eyez);
  out[15] = 1;
  return out;
}

const subscriber_queue = [];

/**
 * Creates a `Readable` store that allows reading by subscription.
 *
 * https://svelte.dev/docs/svelte-store#readable
 * @template T
 * @param {T} [value] initial value
 * @param {import('./public.js').StartStopNotifier<T>} [start]
 * @returns {import('./public.js').Readable<T>}
 */
function readable(value, start) {
	return {
		subscribe: writable(value, start).subscribe
	};
}

/**
 * Create a `Writable` store that allows both updating and reading by subscription.
 *
 * https://svelte.dev/docs/svelte-store#writable
 * @template T
 * @param {T} [value] initial value
 * @param {import('./public.js').StartStopNotifier<T>} [start]
 * @returns {import('./public.js').Writable<T>}
 */
function writable(value, start = noop) {
	/** @type {import('./public.js').Unsubscriber} */
	let stop;
	/** @type {Set<import('./private.js').SubscribeInvalidateTuple<T>>} */
	const subscribers = new Set();
	/** @param {T} new_value
	 * @returns {void}
	 */
	function set(new_value) {
		if (safe_not_equal(value, new_value)) {
			value = new_value;
			if (stop) {
				// store is ready
				const run_queue = !subscriber_queue.length;
				for (const subscriber of subscribers) {
					subscriber[1]();
					subscriber_queue.push(subscriber, value);
				}
				if (run_queue) {
					for (let i = 0; i < subscriber_queue.length; i += 2) {
						subscriber_queue[i][0](subscriber_queue[i + 1]);
					}
					subscriber_queue.length = 0;
				}
			}
		}
	}

	/**
	 * @param {import('./public.js').Updater<T>} fn
	 * @returns {void}
	 */
	function update(fn) {
		set(fn(value));
	}

	/**
	 * @param {import('./public.js').Subscriber<T>} run
	 * @param {import('./private.js').Invalidator<T>} [invalidate]
	 * @returns {import('./public.js').Unsubscriber}
	 */
	function subscribe(run, invalidate = noop) {
		/** @type {import('./private.js').SubscribeInvalidateTuple<T>} */
		const subscriber = [run, invalidate];
		subscribers.add(subscriber);
		if (subscribers.size === 1) {
			stop = start(set, update) || noop;
		}
		run(value);
		return () => {
			subscribers.delete(subscriber);
			if (subscribers.size === 0 && stop) {
				stop();
				stop = null;
			}
		};
	}
	return { set, update, subscribe };
}

/**
 * Derived value store by synchronizing one or more readable stores and
 * applying an aggregation function over its input values.
 *
 * https://svelte.dev/docs/svelte-store#derived
 * @template {import('./private.js').Stores} S
 * @template T
 * @overload
 * @param {S} stores - input stores
 * @param {(values: import('./private.js').StoresValues<S>, set: (value: T) => void, update: (fn: import('./public.js').Updater<T>) => void) => import('./public.js').Unsubscriber | void} fn - function callback that aggregates the values
 * @param {T} [initial_value] - initial value
 * @returns {import('./public.js').Readable<T>}
 */

/**
 * Derived value store by synchronizing one or more readable stores and
 * applying an aggregation function over its input values.
 *
 * https://svelte.dev/docs/svelte-store#derived
 * @template {import('./private.js').Stores} S
 * @template T
 * @overload
 * @param {S} stores - input stores
 * @param {(values: import('./private.js').StoresValues<S>) => T} fn - function callback that aggregates the values
 * @param {T} [initial_value] - initial value
 * @returns {import('./public.js').Readable<T>}
 */

/**
 * @template {import('./private.js').Stores} S
 * @template T
 * @param {S} stores
 * @param {Function} fn
 * @param {T} [initial_value]
 * @returns {import('./public.js').Readable<T>}
 */
function derived(stores, fn, initial_value) {
	const single = !Array.isArray(stores);
	/** @type {Array<import('./public.js').Readable<any>>} */
	const stores_array = single ? [stores] : stores;
	if (!stores_array.every(Boolean)) {
		throw new Error('derived() expects stores as input, got a falsy value');
	}
	const auto = fn.length < 2;
	return readable(initial_value, (set, update) => {
		let started = false;
		const values = [];
		let pending = 0;
		let cleanup = noop;
		const sync = () => {
			if (pending) {
				return;
			}
			cleanup();
			const result = fn(single ? values[0] : values, set, update);
			if (auto) {
				set(result);
			} else {
				cleanup = is_function(result) ? result : noop;
			}
		};
		const unsubscribers = stores_array.map((store, i) =>
			subscribe(
				store,
				(value) => {
					values[i] = value;
					pending &= ~(1 << i);
					if (started) {
						sync();
					}
				},
				() => {
					pending |= 1 << i;
				}
			)
		);
		started = true;
		sync();
		return function stop() {
			run_all(unsubscribers);
			cleanup();
			// We need to set this to false because callbacks can still happen despite having unsubscribed:
			// Callbacks might already be placed in the queue which doesn't know it should no longer
			// invoke this derived store.
			started = false;
		};
	});
}

var defaultVertex = "#version 300 es\r\nprecision mediump float;\r\n    \r\nin vec3 position;\r\nin vec3 normal;\r\n\r\nuniform mat4 world;\r\nuniform mat4 view;\r\nuniform mat4 projection;\r\nuniform mat4 normalMatrix;\r\n\r\n// Pass the color attribute down to the fragment shader\r\nout vec3 vertexColor;\r\nout vec3 vNormal;\r\nout vec3 vertex;\r\n\r\nvoid main() {\r\n    \r\n\r\n    // Pass the color down to the fragment shader\r\n    vertexColor = vec3(1.27,1.27,1.27);\r\n    // Pass the vertex down to the fragment shader\r\n    vertex = vec3(world * vec4(position, 1.0));\r\n    // Pass the normal down to the fragment shader\r\n    vNormal = vec3(normalMatrix * vec4(normal, 1.0));\r\n    //vNormal = normal;\r\n    \r\n    // Pass the position down to the fragment shader\r\n    gl_Position = projection * view * world * vec4(position, 1.0);\r\n}";

var defaultFragment = "#version 300 es\r\nprecision mediump float;\r\n\r\n${defines}\r\n\r\n#define RECIPROCAL_PI 0.3183098861837907\r\n\r\nuniform vec3 color;\r\n\r\nin vec3 vertex;\r\nin vec3 vNormal;\r\n\r\nout vec4 fragColor;\r\n\r\n\r\n${declarations}\r\n\r\nvoid main() {\r\n    vec3 totalIrradiance = vec3(0.0f);\r\n    ${irradiance}\r\n\r\n    //debug normals\r\n    //fragColor = vec4(normalize(vNormal) * 0.5 + 0.5, 1.0);\r\n    fragColor = vec4(RECIPROCAL_PI * color * totalIrradiance, 1.0f);\r\n    ${toneMapping}\r\n}";

const templateGenerator = (props, template) => {
	return (propsValues) => Function.constructor(...props, `return \`${template}\``)(...propsValues);
};
const templateLiteralRenderer = (props, template) => {
	return templateGenerator(Object.keys(props), template)(Object.values(props));
};

const objectToDefines = (obj) => {
	return [
		"",
		...Object.entries(obj).map(([key, value]) => {
			return `#define ${key} ${value}`;
		}),
	].join("\n");
};

/**
 * 3 Dimensional Vector
 * @module vec3
 */

/**
 * Creates a new, empty vec3
 *
 * @returns {vec3} a new 3D vector
 */

function create() {
  var out = new ARRAY_TYPE(3);

  if (ARRAY_TYPE != Float32Array) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
  }

  return out;
}
/**
 * Subtracts vector b from vector a
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @returns {vec3} out
 */

function subtract(out, a, b) {
  out[0] = a[0] - b[0];
  out[1] = a[1] - b[1];
  out[2] = a[2] - b[2];
  return out;
}
/**
 * Normalize a vec3
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a vector to normalize
 * @returns {vec3} out
 */

function normalize(out, a) {
  var x = a[0];
  var y = a[1];
  var z = a[2];
  var len = x * x + y * y + z * z;

  if (len > 0) {
    //TODO: evaluate use of glm_invsqrt here?
    len = 1 / Math.sqrt(len);
  }

  out[0] = a[0] * len;
  out[1] = a[1] * len;
  out[2] = a[2] * len;
  return out;
}
/**
 * Computes the cross product of two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @returns {vec3} out
 */

function cross(out, a, b) {
  var ax = a[0],
      ay = a[1],
      az = a[2];
  var bx = b[0],
      by = b[1],
      bz = b[2];
  out[0] = ay * bz - az * by;
  out[1] = az * bx - ax * bz;
  out[2] = ax * by - ay * bx;
  return out;
}
/**
 * Performs a linear interpolation between two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @param {Number} t interpolation amount, in the range [0-1], between the two inputs
 * @returns {vec3} out
 */

function lerp(out, a, b, t) {
  var ax = a[0];
  var ay = a[1];
  var az = a[2];
  out[0] = ax + t * (b[0] - ax);
  out[1] = ay + t * (b[1] - ay);
  out[2] = az + t * (b[2] - az);
  return out;
}
/**
 * Perform some operation over an array of vec3s.
 *
 * @param {Array} a the array of vectors to iterate over
 * @param {Number} stride Number of elements between the start of each vec3. If 0 assumes tightly packed
 * @param {Number} offset Number of elements to skip at the beginning of the array
 * @param {Number} count Number of vec3s to iterate over. If 0 iterates over entire array
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
      stride = 3;
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
      vec[2] = a[i + 2];
      fn(vec, vec, arg);
      a[i] = vec[0];
      a[i + 1] = vec[1];
      a[i + 2] = vec[2];
    }

    return a;
  };
})();

function createVec3() {
	return new Array(3).fill(0);
}

function multiplyScalarVec3(a, scalar) {
	a[0] *= scalar;
	a[1] *= scalar;
	a[2] *= scalar;
	return a;
}

function createFlatShadedNormals(positions) {
	const normals = [];
	for (let i = 0; i < positions.length; i += 9) {
		const a = createVec3();
		const b = createVec3();
		const c = createVec3();

		a[0] = positions[i];
		a[1] = positions[i + 1];
		a[2] = positions[i + 2];

		b[0] = positions[i + 3];
		b[1] = positions[i + 4];
		b[2] = positions[i + 5];

		c[0] = positions[i + 6];
		c[1] = positions[i + 7];
		c[2] = positions[i + 8];

		const cb = createVec3();
		subtract(cb, c, b);

		const ab = createVec3();
		subtract(ab, a, b);

		const normal = createVec3();
		cross(normal, cb, ab);
		normalize(normal, normal);
		// todo, replace with
		normals.push(...normal, ...normal, ...normal);
	}
	return normals;
}

var pointLightShader = "${declaration?\r\n`\r\n\r\nfloat pow4(const in float x) {\r\n    float x2 = x * x;\r\n    return x2 * x2;\r\n}\r\nfloat pow2(const in float x) {\r\n    return x * x;\r\n}\r\n\r\nfloat saturate(const in float a) {\r\n    return clamp(a, 0.0f, 1.0f);\r\n}\r\n\r\nstruct PointLight {\r\n    vec3 position;\r\n    vec3 color;\r\n    float cutoffDistance;\r\n    float decayExponent;\r\n};\r\n\r\nlayout(std140) uniform PointLights {\r\n    PointLight pointLights[NUM_POINT_LIGHTS];\r\n};\r\n\r\nfloat getDistanceAttenuation(const in float lightDistance, const in float cutoffDistance, const in float decayExponent) {\r\n\t// based upon Frostbite 3 Moving to Physically-based Rendering\r\n\t// page 32, equation 26: E[window1]\r\n\t// https://seblagarde.files.wordpress.com/2015/07/course_notes_moving_frostbite_to_pbr_v32.pdf\r\n    float distanceFalloff = 1.0f / max(pow(lightDistance, decayExponent), 0.01f);\r\n    if(cutoffDistance > 0.0f) {\r\n        distanceFalloff *= pow2(saturate(1.0f - pow4(lightDistance / cutoffDistance)));\r\n    }\r\n    return distanceFalloff;\r\n\r\n}\r\n\r\nvec3 calculatePointLightBrightness(vec3 lightPosition, vec3 lightColor, float cutoffDistance, float decayExponent, vec3 vertexPosition, vec3 normal) {\r\n    vec3 offset = lightPosition - vertexPosition;\r\n    float lightDistance = length(offset);\r\n    vec3 direction = normalize(offset);\r\n    vec3 irradiance = saturate(dot(normal, direction)) * lightColor;\r\n    float distanceFalloff = getDistanceAttenuation(lightDistance, cutoffDistance, decayExponent);\r\n    return vec3(irradiance * distanceFalloff);\r\n}\r\n` : ''\r\n}\r\n${irradiance?\r\n`\r\n    for(int i = 0; i < NUM_POINT_LIGHTS; i++) {\r\n        PointLight pointLight = pointLights[i];\r\n        totalIrradiance += calculatePointLightBrightness(pointLight.position, pointLight.color, pointLight.cutoffDistance, pointLight.decayExponent, vertex, vNormal);\r\n    }\r\n` : ''\r\n}\r\n";

const createPointLight = (props) => {
	return {
		type: "point",
		position: [0, 0, 0],
		color: [1, 1, 1],
		intensity: 3,
		cutoffDistance: 5,
		decayExponent: 1,
		...props,
		shader: (segment) => templateLiteralRenderer(segment, pointLightShader),
		setupLights,
		updateOneLight,
	};
};
let pointLightsUBO = null;
const setPointLightsUBO = (newPointLightsUBO) => {
	pointLightsUBO = newPointLightsUBO;
};

const getPointLightsUBO = () => {
	return pointLightsUBO;
};

function setupLights(context, lights) {
	return function () {
		context = get_store_value(context);
		const gl = context.gl;
		const program = context.program;
		const pointLigths = lights.filter((l) => get_store_value(l).type === "point");

		const pointLightsBlockIndex = gl.getUniformBlockIndex(program, "PointLights");
		// Bind the UBO to the binding point
		const pointLightsBindingPoint = 0; // Choose a binding point for the UBO

		gl.uniformBlockBinding(program, pointLightsBlockIndex, pointLightsBindingPoint);

		// Create UBO for point lights
		const tmpPointLightsUBO = gl.createBuffer();
		setPointLightsUBO(tmpPointLightsUBO);

		gl.bindBuffer(gl.UNIFORM_BUFFER, tmpPointLightsUBO);

		const numPointLights = pointLigths.length;

		gl.bindBufferBase(gl.UNIFORM_BUFFER, pointLightsBindingPoint, tmpPointLightsUBO);

		// Create a single Float32Array to hold all the point light data
		const pointLightsData = new Float32Array(numPointLights * 12); // Each point light has 12 values (position(3=>4), color(3=>4), intensity(1=>4))

		// Fill the Float32Array with the point light data
		for (let i = 0; i < numPointLights; i++) {
			const light = get_store_value(pointLigths[i]);
			const offset = i * 12; // Each point light takes up 8 positions in the array
			light.preMultipliedColor = [...light.color];
			multiplyScalarVec3(light.preMultipliedColor, light.intensity);
			// Set the position data
			pointLightsData[offset] = light.position[0];
			pointLightsData[offset + 1] = light.position[1];
			pointLightsData[offset + 2] = light.position[2];
			pointLightsData[offset + 4] = light.preMultipliedColor[0];
			pointLightsData[offset + 5] = light.preMultipliedColor[1];
			pointLightsData[offset + 6] = light.preMultipliedColor[2];
			pointLightsData[offset + 7] = light.cutoffDistance;
			pointLightsData[offset + 8] = light.decayExponent;
			pointLightsData[offset + 9] = 0.25;
			pointLightsData[offset + 10] = 0.5;
			pointLightsData[offset + 11] = 0.75;
			pointLightsData[offset + 12] = 1;
		}

		// Set the data in the UBO using bufferData
		gl.bufferData(gl.UNIFORM_BUFFER, pointLightsData, gl.DYNAMIC_DRAW);
	};
}

function updateOneLight(context, lights, light) {
	context = get_store_value(context);
	const gl = context.gl;
	const pointLigths = lights.filter((l) => get_store_value(l).type === "point");
	const lightIndex = pointLigths.findIndex((l) => l === light);
	const pointLightsUBO = getPointLightsUBO();
	if (lightIndex !== -1) {
		const lightData = new Float32Array(12);
		const offset = lightIndex * 12;
		const lightValue = get_store_value(light);
		lightValue.preMultipliedColor = [...lightValue.color];
		multiplyScalarVec3(lightValue.preMultipliedColor, lightValue.intensity);
		lightData[0] = lightValue.position[0];
		lightData[1] = lightValue.position[1];
		lightData[2] = lightValue.position[2];
		lightData[4] = lightValue.preMultipliedColor[0];
		lightData[5] = lightValue.preMultipliedColor[1];
		lightData[6] = lightValue.preMultipliedColor[2];
		lightData[7] = lightValue.cutoffDistance;
		lightData[8] = lightValue.decayExponent;
		lightData[9] = 0.25;
		lightData[10] = 0.5;
		lightData[11] = 0.75;
		lightData[12] = 1;
		gl.bindBuffer(gl.UNIFORM_BUFFER, pointLightsUBO);
		gl.bufferSubData(gl.UNIFORM_BUFFER, offset * Float32Array.BYTES_PER_ELEMENT, lightData);
	}
}

const degree = Math.PI / 180;
/**
 * Convert Degree To Radian
 *
 * @param {Number} a Angle in Degrees
 */

function toRadian(a) {
	return a * degree;
}

function setupNormalMatrix(context) {
	return function createNormalMatrix() {
		context = get_store_value(context);
		const gl = context.gl;
		const program = context.program;
		const worldMatrix = context.worldMatrix;
		const normalMatrixLocation = gl.getUniformLocation(program, "normalMatrix");
		context.normalMatrixLocation = normalMatrixLocation;
		let normalMatrix = create$1();
		invert(normalMatrix, worldMatrix);
		transpose(normalMatrix, normalMatrix);
		gl.uniformMatrix4fv(normalMatrixLocation, false, normalMatrix);
	};
}

function initRenderer(rendererContext, appContext) {
	return function () {
		const canvasRect = rendererContext.canvas.getBoundingClientRect();
		rendererContext.canvas.width = canvasRect.width;
		rendererContext.canvas.height = canvasRect.height;
		const gl = (rendererContext.gl = rendererContext.canvas.getContext("webgl2"));
		appContext.update((appContext) => ({
			...appContext,
			...rendererContext,
		}));
		gl.viewportWidth = rendererContext.canvas.width;
		gl.viewportHeight = rendererContext.canvas.height;
		gl.clearColor.apply(gl, rendererContext.backgroundColor);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_COLOR_BIT);
		gl.enable(gl.DEPTH_TEST);
		gl.enable(gl.CULL_FACE);
		gl.frontFace(gl.CCW);
		gl.cullFace(gl.BACK);
		renderState.set({
			init: true,
		});
	};
}

function render(context) {
	return function () {
		context = get_store_value(context);
		const gl = context.gl;
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		context.loop && context.loop();
		if (context.hasElements) {
			gl.drawElements(gl.TRIANGLES, context.attributeLength, gl.UNSIGNED_SHORT, 0);
		} else {
			gl.drawArrays(gl.TRIANGLES, 0, context.attributeLength);
		}
	};
}

function createProgram(context) {
	return function createProgram() {
		context = get_store_value(context);
		const gl = context.gl;
		const program = gl.createProgram();
		context.program = program;
	};
}

function endProgramSetup(context) {
	return function () {
		context = get_store_value(context);
		const gl = context.gl;
		const program = context.program;
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			console.error("ERROR linking program!", gl.getProgramInfoLog(program));
		}
		gl.validateProgram(program);
		if (!gl.getProgramParameter(program, gl.VALIDATE_STATUS)) {
			console.error("ERROR validating program!", gl.getProgramInfoLog(program));
		}
		gl.useProgram(program);
	};
}

function createShaders(material, attributes, uniforms) {
	return function (context) {
		return function () {
			context = get_store_value(context);
			const gl = context.gl;
			const program = context.program;
			const vertexShaderSource = defaultVertex;

			const vertexShader = gl.createShader(gl.VERTEX_SHADER);
			gl.shaderSource(vertexShader, vertexShaderSource);
			gl.compileShader(vertexShader);
			const fragmentShaderSource = templateLiteralRenderer(
				{
					defines: objectToDefines({
						...(context.numPointLights
							? {
									NUM_POINT_LIGHTS: context.numPointLights,
								}
							: undefined),
					}),
					declarations: [
						...(context.numPointLights ? [context.pointLightShader({ declaration: true, irradiance: false })] : undefined),
						...(context.toneMappings.length > 0
							? [...context.toneMappings.map((tm) => tm.shader({ declaration: true, exposure: tm.exposure, color: false }))]
							: undefined),
					].join("\n"),
					irradiance: [
						...(context.numPointLights ? [context.pointLightShader({ declaration: false, irradiance: true })] : undefined),
					].join("\n"),
					toneMapping: [
						...(context.toneMappings.length > 0
							? [...context.toneMappings.map((tm) => tm.shader({ declaration: false, exposure: false, color: true }))]
							: undefined),
					].join("\n"),
					//todo, remove this after decoupling the point light shader
					numPointLights: context.numPointLights,
				},
				defaultFragment,
			);
			console.log("fragmentShaderSource", fragmentShaderSource);

			const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
			gl.shaderSource(fragmentShader, fragmentShaderSource);
			gl.compileShader(fragmentShader);
			gl.attachShader(program, vertexShader);
			gl.attachShader(program, fragmentShader);
		};
	};
}

function setupMeshColor(context, { color }) {
	return function () {
		context = get_store_value(context);
		const gl = context.gl;
		const program = context.program;
		const colorLocation = gl.getUniformLocation(program, "color");
		gl.uniform3fv(colorLocation, new Float32Array(color));
	};
}

function setupCamera(context, camera) {
	return function createCamera() {
		context = get_store_value(context);
		const gl = context.gl;
		const program = context.program;

		// projection matrix
		const projectionLocation = gl.getUniformLocation(program, "projection");
		const fieldOfViewInRadians = toRadian(camera.fov);
		const aspectRatio = context.canvas.width / context.canvas.height;
		const nearClippingPlaneDistance = camera.near;
		const farClippingPlaneDistance = camera.far;

		let projection = new Float32Array(16);
		projection = perspective(
			projection,
			fieldOfViewInRadians,
			aspectRatio,
			nearClippingPlaneDistance,
			farClippingPlaneDistance,
		);

		gl.uniformMatrix4fv(projectionLocation, false, projection);

		// view matrix
		const viewLocation = gl.getUniformLocation(program, "view");
		const view = new Float32Array(16);

		lookAt(view, camera.position, camera.target, camera.up);
		gl.uniformMatrix4fv(viewLocation, false, view);
	};
}

function setupWorldMatrix(context, worldMatrix) {
	return function () {
		context = get_store_value(context);
		const gl = context.gl;
		const program = context.program;
		if (!worldMatrix) {
			worldMatrix = new Float32Array(16);
			identity(worldMatrix);
		}
		context.worldMatrix = worldMatrix;
		const worldLocation = gl.getUniformLocation(program, "world");
		gl.uniformMatrix4fv(worldLocation, false, worldMatrix);
	};
}

function updateWorldMatrix(context, worldMatrix) {
	context = get_store_value(context);
	const gl = context.gl;
	const program = context.program;
	const worldLocation = gl.getUniformLocation(program, "world");
	gl.uniformMatrix4fv(worldLocation, false, worldMatrix);
}

function setupAttributes(context, mesh) {
	return function () {
		context = get_store_value(context);
		const gl = context.gl;
		const program = context.program;
		context.attributeLength = mesh.attributes.elements
			? mesh.attributes.elements.length
			: mesh.attributes.positions.length / 3;

		const positionsData = new Float32Array(mesh.attributes.positions);
		//position
		const positionBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, positionsData, gl.STATIC_DRAW);
		const positionLocation = gl.getAttribLocation(program, "position");
		gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer); //todo check if redundant
		gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
		gl.enableVertexAttribArray(positionLocation);
		//normal
		const normalsData = new Float32Array(mesh.attributes.normals);
		const normalBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, normalsData, gl.STATIC_DRAW);
		const normalLocation = gl.getAttribLocation(program, "normal");
		gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer); //todo check if redundant
		gl.vertexAttribPointer(normalLocation, 3, gl.FLOAT, false, 0, 0);
		gl.enableVertexAttribArray(normalLocation);
		if (mesh.attributes.elements) {
			context.hasElements = true;
			const elementsData = new Uint16Array(mesh.attributes.elements);
			const elementBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elementBuffer);
			gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, elementsData, gl.STATIC_DRAW);
		}
	};
}

function createRenderer() {
	const { subscribe, set, update } = writable({
		backgroundColor: [2.55, 2.55, 2.55, 1],
		canvas: null,
		camera: null,
		//worldMatrix: null,
		meshes: [],
		lights: [],
		toneMappings: [],
		loop: null,
	});
	return {
		subscribe,
		setCamera: (position = [0, 0, -1], target = [0, 0, 0], fov = 80, near = 0.1, far = 1000, up = [0, 1, 0]) =>
			update((renderer) => {
				renderer.camera = {
					fov,
					near,
					far,
					position,
					target,
					up,
				};
				return renderer;
			}),
		addMesh: (mesh) =>
			update((renderer) => {
				renderer.meshes = [...renderer.meshes, mesh];
				return renderer;
			}),
		addLight: (light) => {
			const store = createLightStore(light);
			update((renderer) => {
				renderer.lights = [...renderer.lights, store];
				return renderer;
			});
			return {
				remove: () =>
					update((renderer) => {
						renderer.lights = renderer.lights.filter((l) => l !== light);
						return renderer;
					}),
				store,
			};
		},
		addToneMapping: (toneMapping) =>
			update((renderer) => {
				renderer.toneMappings = [...renderer.toneMappings, toneMapping];
				return renderer;
			}),
		setLoop: (loop) =>
			update((renderer) => {
				renderer.loop = loop;
				return renderer;
			}),
		/*setWorldMAtrix: (worldMatrix) => update(renderer => {
            renderer.worldMatrix = worldMatrix;
            return renderer;
        }),*/
		setCanvas: (canvas) =>
			update((renderer) => {
				renderer.canvas = canvas;
				return renderer;
			}),
		setBackgroundColor: (backgroundColor) =>
			update((renderer) => {
				renderer.backgroundColor = backgroundColor;
				return renderer;
			}),
	};
}

const createLightStore = (initialProps) => {
	const store = writable(initialProps);
	const { subscribe, set, update } = store;
	const customStore = {
		subscribe,
		set: (props) => {
			update((prev) => {
				if (appContext && get_store_value(appContext).program) {
					prev.updateOneLight(appContext, get_store_value(renderer).lights, customStore);
				}
				return { ...prev, ...props };
			});
		},
	};
	return customStore;
};

const renderer = createRenderer();
const defaultWorldMatrix = new Float32Array(16);
identity(defaultWorldMatrix);
const createWorldMatrix = () => {
	const { subscribe, set } = writable(defaultWorldMatrix);
	return {
		subscribe,
		set: (worldMatrix) => {
			set(worldMatrix);
			if (appContext && get_store_value(appContext).program) {
				// in case of a single program app, let's update the uniform only and draw the single program
				if (get_store_value(programs).length === 1) {
					updateWorldMatrix(appContext, worldMatrix);
				} // in case of a multi program app, we need to setup and draw the programs
				else {
					renderState.set({ init: false });
				}
			}
			return worldMatrix;
		},
	};
};
const worldMatrix = createWorldMatrix();

const programs = derived(renderer, ($renderer) => {
	return $renderer.meshes.map((mesh) => {
		return {
			createProgram,
			mesh,
			material: mesh.material,
			attributes: mesh.attributes,
			uniforms: mesh.uniforms,
			createShaders: createShaders(mesh.material, mesh.attributes, mesh.uniforms),
			endProgramSetup,
		};
	});
});

function createRenderState() {
	const { subscribe, set } = writable({
		init: false,
	});
	return {
		subscribe,
		set,
	};
}
const renderState = createRenderState();

function createContextStore() {
	const { subscribe, update } = writable({});
	return {
		subscribe,
		update,
	};
}

const appContext = createContextStore();
// make this store inactive until the conditions are met (single flag?)

/*
Single program apps (one mesh/material) will not need to setup the program again
but multi program apps require to setup the program before rendering if the last changes
affect a program that is not the last one rendered. because the last one rendered is still mounted / in memory of the GPU
this store will be used to know if we need to setup the program before rendering again
*/
const lastProgramRendered = writable(null);

const normalMatrix = derived(worldMatrix, ($worldMatrix) => {
	const normalMatrix = create$1();
	const worldMatrix = $worldMatrix || defaultWorldMatrix;
	invert(normalMatrix, worldMatrix);
	transpose(normalMatrix, normalMatrix);
	const context = get_store_value(appContext);
	if (!context.gl) {
		return normalMatrix;
	}
	const gl = context.gl;
	const program = context.program;
	const normalMatrixLocation = gl.getUniformLocation(program, "normalMatrix");
	gl.uniformMatrix4fv(normalMatrixLocation, false, normalMatrix);
	return normalMatrix;
});

const webglapp = derived([renderer, programs, worldMatrix], ([$renderer, $programs, $worldMatrix]) => {
	// todo find a way to avoid this, like init this store only when renderer is ready
	if (
		!$renderer ||
		!$programs ||
		!$renderer.canvas ||
		$programs.length === 0 ||
		!$renderer.camera ||
		$renderer.lights.length === 0
	) {
		console.log("no renderer or programs or canvas");
		return [];
	}
	const numPointLights = $renderer.lights.filter((l) => get_store_value(l).type === "point").length;
	const pointLightShader = get_store_value($renderer.lights.find((l) => get_store_value(l).type === "point")).shader;

	let rendererContext = {
		canvas: $renderer.canvas,
		backgroundColor: $renderer.backgroundColor,
		...($renderer.toneMappings.length > 0
			? {
					toneMappings: $renderer.toneMappings,
				}
			: undefined),
		...(numPointLights > 0
			? {
					numPointLights,
					pointLightShader,
				}
			: undefined),
	};
	const list = [];

	!get_store_value(renderState).init && list.push(initRenderer(rendererContext, appContext));

	!get_store_value(renderState).init &&
		list.push(
			...$programs.reduce((acc, program) => {
				lastProgramRendered.set(program);
				return [
					...acc,
					program.createProgram(appContext),
					program.createShaders(appContext),
					program.endProgramSetup(appContext),
					...(program.mesh.uniforms?.color ? [setupMeshColor(appContext, program.uniforms)] : []),
					setupAttributes(appContext, program.mesh),
					/* these uniforms are probably common to any program */
					setupCamera(appContext, $renderer.camera),
					setupWorldMatrix(appContext, get_store_value(worldMatrix)),
					setupNormalMatrix(appContext),
					// reduce by type
					...[
						...$renderer.lights.reduce((acc, light) => {
							const lightValue = get_store_value(light);
							acc.set(lightValue.type, lightValue.setupLights);
							return acc;
						}, new Map()),
					].map(([_, setupLights]) => setupLights(appContext, $renderer.lights)),
				];
			}, []),
		);

	list.push(render(appContext));
	return list;
});

/**
 * @typedef {{
 *    positions: Float32Array,
 *   normals: Float32Array,
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
		positions,
		normals,
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

var AGXShader = "${declaration?\r\n`\r\n// tone mapping taken from three.js\r\nfloat toneMappingExposure = ${exposure};\r\n\r\n    // Matrices for rec 2020 <> rec 709 color space conversion\r\n    // matrix provided in row-major order so it has been transposed\r\n    // https://www.itu.int/pub/R-REP-BT.2407-2017\r\nconst mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(vec3(1.6605f, -0.1246f, -0.0182f), vec3(-0.5876f, 1.1329f, -0.1006f), vec3(-0.0728f, -0.0083f, 1.1187f));\r\n\r\nconst mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(vec3(0.6274f, 0.0691f, 0.0164f), vec3(0.3293f, 0.9195f, 0.0880f), vec3(0.0433f, 0.0113f, 0.8956f));\r\n\r\n    // https://iolite-engine.com/blog_posts/minimal_agx_implementation\r\n    // Mean error^2: 3.6705141e-06\r\nvec3 agxDefaultContrastApprox(vec3 x) {\r\n\r\n    vec3 x2 = x * x;\r\n    vec3 x4 = x2 * x2;\r\n\r\n    return +15.5f * x4 * x2 - 40.14f * x4 * x + 31.96f * x4 - 6.868f * x2 * x + 0.4298f * x2 + 0.1191f * x - 0.00232f;\r\n\r\n}\r\n\r\nvec3 AgXToneMapping(vec3 color) {\r\n\r\n        // AgX constants\r\n    const mat3 AgXInsetMatrix = mat3(vec3(0.856627153315983f, 0.137318972929847f, 0.11189821299995f), vec3(0.0951212405381588f, 0.761241990602591f, 0.0767994186031903f), vec3(0.0482516061458583f, 0.101439036467562f, 0.811302368396859f));\r\n\r\n        // explicit AgXOutsetMatrix generated from Filaments AgXOutsetMatrixInv\r\n    const mat3 AgXOutsetMatrix = mat3(vec3(1.1271005818144368f, -0.1413297634984383f, -0.14132976349843826f), vec3(-0.11060664309660323f, 1.157823702216272f, -0.11060664309660294f), vec3(-0.016493938717834573f, -0.016493938717834257f, 1.2519364065950405f));\r\n\r\n        // LOG2_MIN      = -10.0\r\n        // LOG2_MAX      =  +6.5\r\n        // MIDDLE_GRAY   =  0.18\r\n    const float AgxMinEv = -12.47393f;  // log2( pow( 2, LOG2_MIN ) * MIDDLE_GRAY )\r\n    const float AgxMaxEv = 4.026069f;    // log2( pow( 2, LOG2_MAX ) * MIDDLE_GRAY )\r\n\r\n    color *= toneMappingExposure;\r\n\r\n    color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;\r\n\r\n    color = AgXInsetMatrix * color;\r\n\r\n        // Log2 encoding\r\n    color = max(color, 1e-10f); // avoid 0 or negative numbers for log2\r\n    color = log2(color);\r\n    color = (color - AgxMinEv) / (AgxMaxEv - AgxMinEv);\r\n\r\n    color = clamp(color, 0.0f, 1.0f);\r\n\r\n        // Apply sigmoid\r\n    color = agxDefaultContrastApprox(color);\r\n\r\n        // Apply AgX look\r\n        // v = agxLook(v, look);\r\n\r\n    color = AgXOutsetMatrix * color;\r\n\r\n        // Linearize\r\n    color = pow(max(vec3(0.0f), color), vec3(2.2f));\r\n\r\n    color = LINEAR_REC2020_TO_LINEAR_SRGB * color;\r\n\r\n        // Gamut mapping. Simple clamp for now.\r\n    color = clamp(color, 0.0f, 1.0f);\r\n\r\n    return color;\r\n\r\n}\r\n` : ''\r\n}\r\n${color?\r\n`\r\n    fragColor = vec4(AgXToneMapping(fragColor.xyz),1.0f);\r\n` : ''\r\n}";

const createAGXToneMapping = (props) => {
	return {
		exposure: `${props.exposure.toLocaleString("en", { minimumFractionDigits: 1 })}f`,
		shader: (segment) => templateLiteralRenderer(segment, AGXShader),
	};
};

/* src\main.svelte generated by Svelte v4.2.18 */

function create_fragment(ctx) {
	let canvas_1;

	return {
		c() {
			canvas_1 = element("canvas");
		},
		m(target, anchor) {
			insert(target, canvas_1, anchor);
			/*canvas_1_binding*/ ctx[2](canvas_1);
		},
		p: noop,
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) {
				detach(canvas_1);
			}

			/*canvas_1_binding*/ ctx[2](null);
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let $worldMatrix;
	let $webglapp;
	component_subscribe($$self, worldMatrix, $$value => $$invalidate(4, $worldMatrix = $$value));
	component_subscribe($$self, normalMatrix, $$value => $$invalidate(5, $$value));
	component_subscribe($$self, webglapp, $$value => $$invalidate(1, $webglapp = $$value));
	let canvas;
	let light1;

	onMount(() => {
		const data = createPolyhedron(1, 7, createFlatShadedNormals);
		renderer.setCanvas(canvas);
		renderer.setBackgroundColor([0, 0, 0, 1.0]);
		renderer.setCamera([0, 0, -3]);

		renderer.addMesh({
			attributes: data,
			uniforms: { color: [1, 1, 1] }
		});

		light1 = renderer.addLight(createPointLight({
			position: [-2, 2, -3],
			color: [1, 1, 1],
			intensity: 3,
			cutoffDistance: 5,
			decayExponent: 1
		}));

		renderer.addLight(createPointLight({
			position: [1, -2, 0],
			color: [1, 1, 0],
			intensity: 2,
			cutoffDistance: 5,
			decayExponent: 1
		}));

		renderer.addToneMapping(createAGXToneMapping({ exposure: 1 }));
		animate();
	});

	function animate() {
		const rotation = performance.now() / 1000 / 6 * Math.PI;
		const tmp = new Float32Array(16);
		identity(tmp);
		rotateY(tmp, tmp, rotation);
		rotateX(tmp, tmp, rotation);
		rotateZ(tmp, tmp, rotation);
		const lightX = Math.sin(performance.now() / 1000) * 2;
		const lightY = Math.cos(performance.now() / 1000) * 2;
		const r = Math.sin(performance.now() / 250) * 0.5 + 0.5;
		const g = Math.cos(performance.now() / 500) * 0.5 + 0.5;
		const b = Math.sin(performance.now() / 1000) * 0.5 + 0.5;

		light1.store.set({
			position: [lightX, lightY, -3],
			color: [r, g, b]
		});

		set_store_value(worldMatrix, $worldMatrix = tmp, $worldMatrix);
		requestAnimationFrame(animate);
	}

	function canvas_1_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			canvas = $$value;
			$$invalidate(0, canvas);
		});
	}

	$$self.$$.update = () => {
		if ($$self.$$.dirty & /*$webglapp*/ 2) {
			if ($webglapp) {
				$webglapp.forEach(instruction => {
					instruction();
				});
			}
		}
	};

	return [canvas, $webglapp, canvas_1_binding];
}

class Main extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, {});
	}
}

export { Main as default };
