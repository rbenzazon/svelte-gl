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
 * Multiplies two mat4s
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the first operand
 * @param {ReadonlyMat4} b the second operand
 * @returns {mat4} out
 */

function multiply(out, a, b) {
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
      a33 = a[15]; // Cache only the current line of the second matrix

  var b0 = b[0],
      b1 = b[1],
      b2 = b[2],
      b3 = b[3];
  out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  b0 = b[4];
  b1 = b[5];
  b2 = b[6];
  b3 = b[7];
  out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  b0 = b[8];
  b1 = b[9];
  b2 = b[10];
  b3 = b[11];
  out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  b0 = b[12];
  b1 = b[13];
  b2 = b[14];
  b3 = b[15];
  out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  return out;
}
/**
 * Translate a mat4 by the given vector
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the matrix to translate
 * @param {ReadonlyVec3} v vector to translate by
 * @returns {mat4} out
 */

function translate(out, a, v) {
  var x = v[0],
      y = v[1],
      z = v[2];
  var a00, a01, a02, a03;
  var a10, a11, a12, a13;
  var a20, a21, a22, a23;

  if (a === out) {
    out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
    out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
    out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
    out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
  } else {
    a00 = a[0];
    a01 = a[1];
    a02 = a[2];
    a03 = a[3];
    a10 = a[4];
    a11 = a[5];
    a12 = a[6];
    a13 = a[7];
    a20 = a[8];
    a21 = a[9];
    a22 = a[10];
    a23 = a[11];
    out[0] = a00;
    out[1] = a01;
    out[2] = a02;
    out[3] = a03;
    out[4] = a10;
    out[5] = a11;
    out[6] = a12;
    out[7] = a13;
    out[8] = a20;
    out[9] = a21;
    out[10] = a22;
    out[11] = a23;
    out[12] = a00 * x + a10 * y + a20 * z + a[12];
    out[13] = a01 * x + a11 * y + a21 * z + a[13];
    out[14] = a02 * x + a12 * y + a22 * z + a[14];
    out[15] = a03 * x + a13 * y + a23 * z + a[15];
  }

  return out;
}
/**
 * Returns the translation vector component of a transformation
 *  matrix. If a matrix is built with fromRotationTranslation,
 *  the returned vector will be the same as the translation vector
 *  originally supplied.
 * @param  {vec3} out Vector to receive translation component
 * @param  {ReadonlyMat4} mat Matrix to be decomposed (input)
 * @return {vec3} out
 */

function getTranslation(out, mat) {
  out[0] = mat[12];
  out[1] = mat[13];
  out[2] = mat[14];
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
 * Generates a orthogonal projection matrix with the given bounds.
 * The near/far clip planes correspond to a normalized device coordinate Z range of [-1, 1],
 * which matches WebGL/OpenGL's clip volume.
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {number} left Left bound of the frustum
 * @param {number} right Right bound of the frustum
 * @param {number} bottom Bottom bound of the frustum
 * @param {number} top Top bound of the frustum
 * @param {number} near Near bound of the frustum
 * @param {number} far Far bound of the frustum
 * @returns {mat4} out
 */

function orthoNO(out, left, right, bottom, top, near, far) {
  var lr = 1 / (left - right);
  var bt = 1 / (bottom - top);
  var nf = 1 / (near - far);
  out[0] = -2 * lr;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = -2 * bt;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = 2 * nf;
  out[11] = 0;
  out[12] = (left + right) * lr;
  out[13] = (top + bottom) * bt;
  out[14] = (far + near) * nf;
  out[15] = 1;
  return out;
}
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

var defaultVertex = "#version 300 es\r\nprecision mediump float;\r\n    \r\nin vec3 position;\r\nin vec3 normal;\r\nin vec2 uv;\r\n${instances ?\r\n`\r\nin mat4 world;\r\nin mat4 normalMatrix;\r\n` : `\r\nuniform mat4 world;\r\nuniform mat4 normalMatrix;\r\n`}\r\n\r\n\r\nuniform float time;\r\nuniform mat4 view;\r\nuniform mat4 projection;\r\n\r\n// Pass the color attribute down to the fragment shader\r\nout vec3 vertexColor;\r\nout vec3 vNormal;\r\nout vec3 vertex;\r\nout vec3 vViewPosition;\r\nout highp vec2 vUv;\r\n\r\n${declarations}\r\n\r\nvoid main() {\r\n    vec3 modifiedNormal = normal;\r\n    vec3 animatedPosition = position;\r\n    ${positionModifier}\r\n\r\n    vUv = vec3( uv, 1 ).xy;\r\n    // Pass the color down to the fragment shader\r\n    vertexColor = vec3(1.27,1.27,1.27);\r\n    // Pass the vertex down to the fragment shader\r\n    //vertex = vec3(world * vec4(position, 1.0));\r\n    vertex = vec3(world * vec4(animatedPosition, 1.0));\r\n    // Pass the normal down to the fragment shader\r\n    // todo : use modifiedNormal when effect is done\r\n    vNormal = vec3(normalMatrix * vec4(modifiedNormal , 1.0));\r\n    //vNormal = normal;\r\n    \r\n    // Pass the position down to the fragment shader\r\n    gl_Position = projection * view * world * vec4(animatedPosition, 1.0);\r\n    vViewPosition = -gl_Position.xyz;\r\n}";

var defaultFragment = "#version 300 es\r\nprecision mediump float;\r\n\r\n${defines}\r\n\r\n#define RECIPROCAL_PI 0.3183098861837907\r\n\r\nuniform vec3 diffuse;\r\nuniform float opacity;\r\nuniform float metalness;\r\nuniform vec3 ambientLightColor;\r\nuniform vec3 cameraPosition;\r\n//uniform mat3 normalMatrix;\r\n\r\nin vec3 vertex;\r\nin vec3 vNormal;\r\nin highp vec2 vUv;\r\nin vec3 vViewPosition;\r\n\r\nout vec4 fragColor;\r\n\r\nstruct ReflectedLight {\r\n\tvec3 directDiffuse;\r\n\tvec3 directSpecular;\r\n\tvec3 indirectDiffuse;\r\n\tvec3 indirectSpecular;\r\n};\r\n\r\nstruct PhysicalMaterial {\r\n\tvec3 diffuseColor;\r\n\tfloat diffuseAlpha;\r\n\tfloat roughness;\r\n\tvec3 specularColor;\r\n\tfloat specularF90;\r\n\tfloat ior;\r\n};\r\n\r\nvec3 BRDF_Lambert(const in vec3 diffuseColor) {\r\n\treturn RECIPROCAL_PI * diffuseColor;\r\n}\r\n\r\n\r\n${declarations}\r\n\r\nvec4 sRGBTransferOETF(in vec4 value) {\r\n\treturn vec4(mix(pow(value.rgb, vec3(0.41666)) * 1.055 - vec3(0.055), value.rgb * 12.92, vec3(lessThanEqual(value.rgb, vec3(0.0031308)))), value.a);\r\n}\r\n\r\nvec4 linearToOutputTexel(vec4 value) {\r\n\treturn (sRGBTransferOETF(value));\r\n}\r\n\r\nvoid main() {\r\n    PhysicalMaterial material;\r\n\tmaterial.diffuseAlpha = 1.0;\r\n\tmaterial.diffuseColor = diffuse.rgb * (1.0 - metalness);\r\n\t${diffuseMapSample}\r\n\t\r\n\r\n\tvec3 normal = normalize( vNormal );\r\n\t${normalMapSample}\r\n\r\n    ReflectedLight reflectedLight = ReflectedLight(vec3(0.0), vec3(0.0), vec3(0.0), vec3(0.0));\r\n\r\n    reflectedLight.indirectDiffuse += ambientLightColor * BRDF_Lambert(material.diffuseColor);\r\n\r\n    vec3 totalIrradiance = vec3(0.0f);\r\n    ${irradiance}\r\n\tvec3 outgoingLight = reflectedLight.indirectDiffuse + reflectedLight.directDiffuse + reflectedLight.directSpecular;\r\n    fragColor = vec4(outgoingLight, opacity*material.diffuseAlpha);\r\n    //fragColor = vec4(totalIrradiance, 1.0f);\r\n    ${toneMapping}\r\n\tfragColor = linearToOutputTexel(fragColor);\r\n}";

const templateLiteralRenderer = (template, parameters) => {
	const fn = Function.constructor(
		...Object.entries(parameters).map(([key, defaultValue]) => {
			if (defaultValue === "") {
				defaultValue = '""';
			}
			return `${key}${defaultValue != null ? `=${defaultValue}` : ""}`;
		}),
		`return \`${template}\``,
	);
	return (propsWithValues) =>
		fn(...Object.keys(parameters).map((key) => (propsWithValues[key] != null ? propsWithValues[key] : undefined)));
};

const objectToDefines = (obj) => {
	return [
		"",
		...Object.entries(obj).map(([key, value]) => {
			return `#define ${key} ${value}`;
		}),
	].join("\n");
};

function convertToVector3(color) {
	if (Array.isArray(color)) {
		return [...color];
	}
	if (typeof color === "number") {
		return convertHexToVector3(color);
	}
	if (typeof color === "string" && color.startsWith("#")) {
		return convertHexToVector3(parseInt(color.replace("#", "0x")));
	}
	return color;
}

function convertHexToVector3(hex) {
	return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
}

function SRGBToLinear(c, index) {
	if (index === 3) {
		return c;
	}
	return c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4);
}

// Uniform Buffer Objects, must have unique binding points
const UBO_BINDING_POINT_POINTLIGHT = 0;

const degree = Math.PI / 180;
/**
 * Convert Degree To Radian
 *
 * @param {Number} a Angle in Degrees
 */

function toRadian(a) {
	return a * degree;
}

function initRenderer() {
	const canvasRect = appContext.canvas.getBoundingClientRect();
	appContext.canvas.width = canvasRect.width;
	appContext.canvas.height = canvasRect.height;
	/** @type {WebGL2RenderingContext} */
	const gl = appContext.canvas.getContext("webgl2");
	appContext.gl = gl;

	/*gl.viewportWidth = canvasRect.width;
	gl.viewportHeight = canvasRect.height;*/

	gl.enable(gl.DEPTH_TEST);

	/*
	gl.disable(gl.DEPTH_TEST);
	
	gl.enable(gl.BLEND);
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
*/
	gl.enable(gl.CULL_FACE);
	gl.frontFace(gl.CCW);
	gl.cullFace(gl.BACK);
}

function enableBlend() {
	const { gl } = appContext;
	gl.enable(gl.BLEND);
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
}

function disableBlend() {
	const { gl } = appContext;
	gl.disable(gl.BLEND);
}

function setupTime() {
	const { gl, program } = appContext;
	const timeLocation = gl.getUniformLocation(program, "time");
	gl.uniform1f(timeLocation, performance.now());
}

function render(mesh, instances, drawMode) {
	return function render() {
		/** @type {WebGL2RenderingContext} **/
		const { gl, program } = appContext;

		const positionSize = mesh.attributes.positionsSize ?? 3;

		const attributeLength = mesh.attributes.elements
			? mesh.attributes.elements.length
			: mesh.attributes.positions.length / positionSize;

		if (instances) {
			gl.drawArraysInstanced(gl[drawMode], 0, attributeLength, instances);
		} else {
			if (mesh.attributes.elements) {
				gl.drawElements(gl[drawMode], attributeLength, gl.UNSIGNED_SHORT, 0);
			} else {
				gl.drawArrays(gl[drawMode], 0, attributeLength);
				//add mesh visualization (lines)
				//gl.drawArrays(gl.LINE_STRIP, 0, contextValue.attributeLength);
			}
		}
		// when binding vertex array objects you must unbind it after rendering
		gl.bindVertexArray(null);
	};
}

function bindVAO() {
	const { gl, vao } = appContext;
	gl.bindVertexArray(vao);
}

function createProgram(programStore) {
	return function createProgram() {
		/** @type {{gl:WebGL2RenderingContext}} **/
		const { gl } = appContext;
		const program = gl.createProgram();
		appContext.programMap.set(programStore, program);
		appContext.vaoMap.set(programStore, new Map());
		appContext.program = program;
	};
}

function linkProgram() {
	/** @type {{gl:WebGL2RenderingContext}} **/
	const { gl, program } = appContext;
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		console.error("ERROR linking program!", gl.getProgramInfoLog(program));
	}
}

function validateProgram() {
	/** @type {{gl:WebGL2RenderingContext,program: WebGLProgram}} **/
	const { gl, program } = appContext;
	gl.validateProgram(program);
	if (!gl.getProgramParameter(program, gl.VALIDATE_STATUS)) {
		console.error("ERROR validating program!", gl.getProgramInfoLog(program));
	}
}

function useProgram() {
	/** @type {{gl:WebGL2RenderingContext,program: WebGLProgram}} **/
	const { gl, program } = appContext;
	gl.useProgram(program);
}

function bindDefaultFramebuffer() {
	/** @type {{gl:WebGL2RenderingContext}} **/
	const { gl, backgroundColor } = appContext;
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
	appContext.frameBufferWidth = gl.canvas.width;
	appContext.frameBufferHeight = gl.canvas.height;
	gl.clearColor(...backgroundColor);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}

function createShaders$1(material, meshes, numPointLights, pointLightShader) {
	return function createShaders() {
		/** @type {{gl:WebGL2RenderingContext,program: WebGLProgram}} **/
		const { gl, program } = appContext;

		let vertexDeclarations = "";
		let vertexPositionModifiers = "";

		let vertexAnimationsDeclaration = "";
		let vertexAnimationsModifier = "";
		const [mesh] = meshes;
		const vertexAnimationComponents = mesh.animations?.filter(({ type }) => type === "vertex");
		if (vertexAnimationComponents?.length > 0) {
			vertexAnimationsDeclaration += vertexAnimationComponents.reduce((acc, component) => {
				return acc + component.shader({ declaration: true });
			}, "");
			vertexAnimationsModifier += vertexAnimationComponents.reduce((acc, component) => {
				return acc + component.shader({ position: true });
			}, "");
			vertexDeclarations += vertexAnimationsDeclaration;
			vertexPositionModifiers += vertexAnimationsModifier;
		}
		const vertexShaderSource = templateLiteralRenderer(defaultVertex, {
			instances: false,
			declarations: "",
			positionModifier: "",
		})({
			instances: mesh.instances > 1,
			declarations: vertexDeclarations,
			positionModifier: vertexPositionModifiers,
		});
		//(vertexShaderSource);
		const vertexShader = gl.createShader(gl.VERTEX_SHADER);
		gl.shaderSource(vertexShader, vertexShaderSource);
		gl.compileShader(vertexShader);
		if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
			console.error("ERROR compiling vertex shader!", gl.getShaderInfoLog(vertexShader));
		}
		let specularIrradiance = "";
		let specularDeclaration = "";
		if (material.specular) {
			specularDeclaration = material.specular.shader({ declaration: true });
			specularIrradiance = material.specular.shader({ irradiance: true });
		}
		let diffuseMapDeclaration = "";
		let diffuseMapSample = "";
		if (material.diffuseMap) {
			diffuseMapDeclaration = material.diffuseMap.shader({
				declaration: true,
				mapType: material.diffuseMap.type,
			});
			diffuseMapSample = material.diffuseMap.shader({
				diffuseMapSample: true,
				mapType: material.diffuseMap.type,
				coordinateSpace: material.diffuseMap.coordinateSpace,
			});
		}
		let normalMapDeclaration = "";
		let normalMapSample = "";
		if (material.normalMap) {
			normalMapDeclaration = material.normalMap.shader({
				declaration: true,
				mapType: material.normalMap.type,
			});
			normalMapSample = material.normalMap.shader({
				normalMapSample: true,
				mapType: material.normalMap.type,
			});
		}
		const fragmentShaderSource = templateLiteralRenderer(defaultFragment, {
			defines: "",
			declarations: "",
			diffuseMapSample: "",
			normalMapSample: "",
			irradiance: "",
			toneMapping: "",
			numPointLights: 0,
		})({
			defines: objectToDefines({
				...(numPointLights
					? {
							NUM_POINT_LIGHTS: numPointLights,
						}
					: undefined),
			}),
			declarations: [
				...(numPointLights ? [pointLightShader({ declaration: true, irradiance: false })] : []),
				...(appContext.toneMappings?.length > 0
					? [...appContext.toneMappings.map((tm) => tm.shader({ declaration: true, exposure: tm.exposure }))]
					: []),
				...(material.specular ? [specularDeclaration] : []),
				...(material.diffuseMap ? [diffuseMapDeclaration] : []),
				...(material.normalMap ? [normalMapDeclaration] : []),
			].join("\n"),
			diffuseMapSample,
			normalMapSample,
			irradiance: [
				...(numPointLights ? [pointLightShader({ declaration: false, irradiance: true, specularIrradiance })] : []),
			].join("\n"),
			toneMapping: [
				...(appContext.toneMappings?.length > 0
					? [...appContext.toneMappings.map((tm) => tm.shader({ color: true }))]
					: []),
			].join("\n"),
			//todo, remove this after decoupling the point light shader
			numPointLights,
		});
		const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
		gl.shaderSource(fragmentShader, fragmentShaderSource);
		//(fragmentShaderSource);
		gl.compileShader(fragmentShader);
		if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
			console.error("ERROR compiling fragment shader!", gl.getShaderInfoLog(fragmentShader));
		}
		gl.attachShader(program, vertexShader);
		gl.attachShader(program, fragmentShader);
	};
}

function setupMeshColor({ diffuse, metalness, opacity }) {
	return function setupMeshColor() {
		/** @type {{gl:WebGL2RenderingContext,program: WebGLProgram}} **/
		const { gl, program } = appContext;
		const colorLocation = gl.getUniformLocation(program, "diffuse");
		if (colorLocation == null) {
			return;
		}
		gl.uniform3fv(colorLocation, new Float32Array(diffuse.map(SRGBToLinear)));
		const metalnessLocation = gl.getUniformLocation(program, "metalness");
		gl.uniform1f(metalnessLocation, metalness);
		const opacityLocation = gl.getUniformLocation(program, "opacity");
		gl.uniform1f(opacityLocation, opacity ?? 1);
	};
}

function setupAmbientLight() {
	/** @type {{gl:WebGL2RenderingContext,program: WebGLProgram}} **/
	const { gl, program, ambientLightColor } = appContext;
	const ambientLightColorLocation = gl.getUniformLocation(program, "ambientLightColor");
	gl.uniform3fv(ambientLightColorLocation, new Float32Array(ambientLightColor));
}

function getCameraProjectionView(camera, width, height) {
	return {
		projection: perspective(new Float32Array(16), toRadian(camera.fov), width / height, camera.near, camera.far),
		view: lookAt(new Float32Array(16), camera.position, camera.target, camera.up),
	};
}

function setupCamera(camera) {
	return function createCamera() {
		/** @type {{gl:WebGL2RenderingContext,program: WebGLProgram}} **/
		const { gl, program, canvas } = appContext;
		const { projection, view } = getCameraProjectionView(camera, canvas.width, canvas.height);
		// projection matrix
		const projectionLocation = gl.getUniformLocation(program, "projection");
		gl.uniformMatrix4fv(projectionLocation, false, projection);

		// view matrix
		const viewLocation = gl.getUniformLocation(program, "view");
		gl.uniformMatrix4fv(viewLocation, false, view);

		const cameraPositionLocation = gl.getUniformLocation(program, "cameraPosition");
		gl.uniform3fv(cameraPositionLocation, camera.position);
	};
}

function setupTransformMatrix(programStore, mesh, transformMatrix, numInstances) {
	if (numInstances == null) {
		return function setupTransformMatrix() {
			/** @type {{gl:WebGL2RenderingContext,program: WebGLProgram}} **/
			const { gl, program } = appContext;
			const worldLocation = gl.getUniformLocation(program, "world");
			if (worldLocation == null) {
				return;
			}
			if (!transformMatrix) {
				transformMatrix = new Float32Array(16);
				identity(transformMatrix);
			}
			// TODO store this in a map
			appContext.transformMatrix = transformMatrix;
			gl.uniformMatrix4fv(worldLocation, false, transformMatrix);
		};
	} else {
		return function setupTransformMatrix() {
			if (transformMatrix == null) {
				return;
			}

			const attributeName = "world";
			/** @type {{gl:WebGL2RenderingContext,program: WebGLProgram}} **/
			const { gl, program, vaoMap } = appContext;

			//TODO, clean that it's useless since we overwrite it anyway and storing this way is not good
			let transformMatricesWindows;
			if ((appContext.transformMatricesWindows = null)) {
				transformMatricesWindows = [];
			} else {
				transformMatricesWindows = appContext.transformMatricesWindows;
			}

			const transformMatricesValues = transformMatrix.reduce((acc, m) => [...acc, ...get_store_value(m)], []);
			const transformMatricesData = new Float32Array(transformMatricesValues);

			// create windows for each matrix
			for (let i = 0; i < numInstances; ++i) {
				const byteOffsetToMatrix = i * 16 * 4;
				const numFloatsForView = 16;
				transformMatricesWindows.push(new Float32Array(transformMatricesData.buffer, byteOffsetToMatrix, numFloatsForView));
			}
			/*
			transformMatricesWindows.forEach((mat, index) => {
				const count = index - Math.floor(numInstances / 2);
				identity(mat);
				//transform the model matrix
				translate(mat, mat, [count * 2, 0, 0]);
				rotateY(mat, mat, toRadian(count * 10));
				scale(mat, mat, [0.5, 0.5, 0.5]);
			});
*/
			gl.bindVertexArray(appContext.vao);
			const matrixBuffer = gl.createBuffer();

			setAppContext({
				matrixBuffer,
				transformMatricesWindows,
			});

			const transformMatricesLocation = gl.getAttribLocation(program, attributeName);
			gl.bindBuffer(gl.ARRAY_BUFFER, matrixBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, transformMatricesData.byteLength, gl.DYNAMIC_DRAW);
			// set all 4 attributes for matrix
			const bytesPerMatrix = 4 * 16;
			for (let i = 0; i < 4; ++i) {
				const loc = transformMatricesLocation + i;
				gl.enableVertexAttribArray(loc);
				// note the stride and offset
				const offset = i * 16; // 4 floats per row, 4 bytes per float
				gl.vertexAttribPointer(
					loc, // location
					4, // size (num values to pull from buffer per iteration)
					gl.FLOAT, // type of data in buffer
					false, // normalize
					bytesPerMatrix, // stride, num bytes to advance to get to next set of values
					offset, // offset in buffer
				);
				// this line says this attribute only changes for each 1 instance
				gl.vertexAttribDivisor(loc, 1);
			}
			gl.bufferSubData(gl.ARRAY_BUFFER, 0, transformMatricesData);

			gl.bindVertexArray(null);
		};
	}
}

function setupNormalMatrix(programStore, mesh, numInstances) {
	if (numInstances == null) {
		return function setupNormalMatrix() {
			/** @type {{gl:WebGL2RenderingContext,program: WebGLProgram}} **/
			const { gl, program, transformMatrix } = appContext;
			const normalMatrixLocation = gl.getUniformLocation(program, "normalMatrix");
			if (normalMatrixLocation == null) {
				return;
			}
			gl.uniformMatrix4fv(normalMatrixLocation, false, derivateNormalMatrix(transformMatrix));
		};
	} else {
		return function setupNormalMatrix() {
			/** @type {{gl:WebGL2RenderingContext,program: WebGLProgram}} **/
			const { gl, program, vaoMap, transformMatricesWindows } = appContext;
			const normalMatricesLocation = gl.getAttribLocation(program, "normalMatrix");
			if (normalMatricesLocation == null) {
				return;
			}

			gl.bindVertexArray(appContext.vao);
			const normalMatricesValues = [];

			for (let i = 0; i < numInstances; i++) {
				normalMatricesValues.push(...derivateNormalMatrix(transformMatricesWindows[i]));
			}
			const normalMatrices = new Float32Array(normalMatricesValues);

			const normalMatrixBuffer = gl.createBuffer();
			//TODO store this in a map ?
			appContext.normalMatrixBuffer = normalMatrixBuffer;
			gl.bindBuffer(gl.ARRAY_BUFFER, normalMatrixBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, normalMatrices.byteLength, gl.DYNAMIC_DRAW);

			gl.bufferSubData(gl.ARRAY_BUFFER, 0, normalMatrices);
			// set all 4 attributes for matrix
			const bytesPerMatrix = 4 * 16;
			for (let i = 0; i < 4; ++i) {
				const loc = normalMatricesLocation + i;
				gl.enableVertexAttribArray(loc);
				// note the stride and offset
				const offset = i * 16; // 4 floats per row, 4 bytes per float
				gl.vertexAttribPointer(
					loc, // location
					4, // size (num values to pull from buffer per iteration)
					gl.FLOAT, // type of data in buffer
					false, // normalize
					bytesPerMatrix, // stride, num bytes to advance to get to next set of values
					offset, // offset in buffer
				);
				// this line says this attribute only changes for each 1 instance
				gl.vertexAttribDivisor(loc, 1);
			}
			gl.bindVertexArray(null);
		};
	}
}

function derivateNormalMatrix(transformMatrix) {
	const normalMatrix = create$1();
	invert(normalMatrix, transformMatrix);
	transpose(normalMatrix, normalMatrix);
	return normalMatrix;
}

function getBuffer(variable) {
	let dataSource;
	let interleaved;
	if (variable.data) {
		dataSource = variable.data;
		interleaved = variable.interleaved;
	} else {
		dataSource = variable;
	}
	const data = dataSource.buffer && dataSource.buffer instanceof ArrayBuffer ? dataSource : new Float32Array(dataSource);
	return {
		data,
		interleaved,
		...(interleaved ? { byteStride: variable.byteStride, byteOffset: variable.byteOffset } : {}),
	};
}

function setupAttributes(programStore, mesh) {
	return function setupAttributes() {
		/** @type {{gl:WebGL2RenderingContext,program: WebGLProgram}} **/
		const { gl, program, vaoMap } = appContext;
		const { positions, normals, elements, uvs, positionsSize } = mesh.attributes;
		let vao;
		if (vaoMap.has(programStore) && vaoMap.get(programStore).has(mesh)) {
			vao = vaoMap.get(programStore).get(mesh);
		} else {
			vao = gl.createVertexArray();
			vaoMap.get(programStore).set(mesh, vao);
		}
		appContext.vao = vao;
		gl.bindVertexArray(vao);
		const {
			data: positionsData,
			interleaved: positionsInterleaved,
			byteStride: positionsByteStride,
			byteOffset: positionsByteOffset,
		} = getBuffer(positions);
		//position
		const positionBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, positionsData, gl.STATIC_DRAW);
		const positionLocation = gl.getAttribLocation(program, "position");
		gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer); //todo check if redundant
		const size = positionsSize != null ? positionsSize : 3;
		gl.vertexAttribPointer(positionLocation, size, gl.FLOAT, false, positionsByteStride, positionsByteOffset);
		gl.enableVertexAttribArray(positionLocation);
		//normal
		if (mesh.attributes.normals) {
			const {
				data: normalsData,
				interleaved: normalsInterleaved,
				byteStride: normalsByteStride,
				byteOffset: normalsByteOffset,
			} = getBuffer(normals);
			if (!normalsInterleaved) {
				const normalBuffer = gl.createBuffer();
				gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
				gl.bufferData(gl.ARRAY_BUFFER, normalsData, gl.STATIC_DRAW);
				gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer); //todo check if redundant
			}
			const normalLocation = gl.getAttribLocation(program, "normal");
			if (normalLocation != -1) {
				gl.vertexAttribPointer(normalLocation, 3, gl.FLOAT, false, normalsByteStride, normalsByteOffset);
				gl.enableVertexAttribArray(normalLocation);
			}
		}
		if (mesh.attributes.elements) {
			const elementsData = new Uint16Array(mesh.attributes.elements);
			const elementBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elementBuffer);
			gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, elementsData, gl.STATIC_DRAW);
		}
		if (mesh.attributes.uvs) {
			const uvsData = new Float32Array(mesh.attributes.uvs);
			const uvBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, uvsData, gl.STATIC_DRAW);
			const uvLocation = gl.getAttribLocation(program, "uv");
			if (uvLocation != -1) {
				gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
				gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 0, 0);
				gl.enableVertexAttribArray(uvLocation);
			}
		}

		gl.bindVertexArray(null);
	};
}

function hasSameShallow$1(a, b) {
	if (a == null || b == null || a.size !== b.size) {
		return false;
	}
	for (let item of a) {
		if (!b.has(item)) {
			return false;
		}
	}
	return true;
}

function hasSameShallow(a, b) {
	if (a == null || b == null || a.length !== b.length) {
		return false;
	}
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) {
			return false;
		}
	}
	return true;
}

function isLight(sceneNode) {
	sceneNode = get_store_value(sceneNode);
	return (
		sceneNode.shader instanceof Function &&
		sceneNode.setupLights instanceof Function &&
		sceneNode.updateOneLight instanceof Function
	);
}

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
 * Transforms the vec3 with a mat4.
 * 4th vector component is implicitly '1'
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the vector to transform
 * @param {ReadonlyMat4} m matrix to transform with
 * @returns {vec3} out
 */

function transformMat4(out, a, m) {
  var x = a[0],
      y = a[1],
      z = a[2];
  var w = m[3] * x + m[7] * y + m[11] * z + m[15];
  w = w || 1.0;
  out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
  out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
  out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
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

function createRenderer() {
	const initialValue = {
		//ref
		canvas: null,
		//ref
		loop: null,
		//value
		backgroundColor: 0xffffff,
		//value
		ambientLightColor: [0xffffff, 0],
		//values
		toneMappings: [],
		//value
		enabled: false,
	};
	// the cache is made to compare the previous value with the new one
	let cache = initialValue;
	// some values have a different internal format
	let processed = new Map();
	const store = writable(initialValue);
	const { subscribe, update } = store;

	//private store to keep track of updates
	const revisionStore = writable(0);

	/**
	 * Update functions are called when a different value is set.
	 * processed values are updated here
	 */
	function updateCanvas(canvas) {}
	function updateLoop(loop) {}
	function updateBackgroundColor(color) {
		processed.set("backgroundColor", [...convertToVector3(color), 1]);
	}
	function updateAmbientLightColor([color, intensity]) {
		processed.set(
			"ambientLightColor",
			convertToVector3(color).map((c) => c * intensity),
		);
	}
	function updateToneMappings(toneMappings) {}
	function updateEnabled(enabled) {}

	function customUpdate(updater) {
		update((renderer) => {
			const next = updater(renderer);
			revisionStore.update((revision) => revision + 1);
			if (cache.canvas != null && next.canvas !== cache.canvas) {
				updateCanvas(next.canvas);
			}
			if (cache.loop != null && next.loop !== cache.loop) {
				updateLoop(next.loop);
			}
			if (next.backgroundColor !== cache.backgroundColor) {
				updateBackgroundColor(next.backgroundColor);
			}
			if (!hasSameShallow(next.ambientLightColor, cache.ambientLightColor)) {
				updateAmbientLightColor(next.ambientLightColor);
			}
			if (!hasSameShallow(next.toneMappings, cache.toneMappings)) {
				updateToneMappings(next.toneMappings);
			}
			if (next.enabled !== cache.enabled) {
				updateEnabled(next.enabled);
			}
			cache = next;
			return next;
		});
	}

	//specific on change handling, might be useless
	function customSet(next) {
		customUpdate((renderer) => next);
	}

	return {
		subscribe,
		set: customSet,
		update: customUpdate,
		get processed() {
			const values = get_store_value(store);
			return Object.entries(values)
				.map(([key, value]) => {
					if (processed.has(key)) {
						return [key, processed.get(key)];
					}
					return [key, value];
				})
				.reduce((acc, [key, value]) => {
					acc[key] = value;
					return acc;
				}, {});
		},
		get revision() {
			return get_store_value(revisionStore);
		},
	};
}
/**
 * Camera
 * @typedef {Object} Camera
 * @property {import('gl-matrix').vec3} position - The position of the camera
 * @property {import('gl-matrix').vec3} target - The target of the camera
 * @property {number} fov - The field of view of the camera in degrees
 * @property {number} near - The near clipping plane distance
 * @property {number} far - The far clipping plane distance
 * @property {import('gl-matrix').vec3} up - The up vector of the camera
 * @property {import('gl-matrix').mat4 | null} matrix - The view matrix of the camera
 */

/**
 * Camera store
 * @typedef {import('svelte/store').Writable<Camera>} CameraStore
 * @property {number} revision - The revision of the store
 */

/**
 * @return {CameraStore}
 */
function createCameraStore() {
	const initialCamera = {
		position: [0, 0, -1],
		target: [0, 0, 0],
		fov: 80,
		near: 0.1,
		far: 1000,
		up: [0, 1, 0],
		matrix: null,
	};
	const store = writable(initialCamera);
	const { subscribe, update } = store;
	const revisionStore = writable(0);
	function customUpdate(updater) {
		update((camera) => {
			//this makes update require only the changed props (especially the revision)
			const next = {
				...camera,
				...updater(camera),
			};
			revisionStore.update((revision) => revision + 1);
			return next;
		});
	}
	function customSet(next) {
		customUpdate((camera) => next);
	}
	return {
		subscribe,
		set: customSet,
		update: customUpdate,
		get revision() {
			return get_store_value(revisionStore);
		},
	};
}

const camera = createCameraStore();

const renderer = createRenderer();

function createSceneStore() {
	const store = writable([]);
	const revisionStore = writable(0);
	const { subscribe, update } = store;
	function customUpdate(updater) {
		update((scene) => {
			const next = updater(scene);
			revisionStore.update((revision) => revision + 1);
			return next;
		});
	}
	function customSet(next) {
		customUpdate((scene) => next);
	}
	return {
		subscribe,
		set: customSet,
		update: customUpdate,
		//this way the revision can't be changed from outside
		get revision() {
			return get_store_value(revisionStore);
		},
	};
}
const scene = createSceneStore();

const createLightStore = (initialProps) => {
	const { subscribe, set } = writable(initialProps);
	return {
		subscribe,
		set: (props) => {
			//update buffers here
			set(props);
		},
	};
};

let meshCache;

const meshes = derived([scene], ([$scene]) => {
	const meshNodes = $scene.filter((node) => node.attributes != null);
	//using throw to cancel update flow when unchanged
	if (hasSameShallow(meshCache, meshNodes)) {
		throw new Error("meshes unchanged");
	} else {
		meshCache = meshNodes;
	}
	return meshNodes;
});

let lightCache;

const lights = derived([scene], ([$scene]) => {
	const lightNodes = $scene.filter(isStore).filter(isLight);
	//using throw to cancel update flow when unchanged
	if (hasSameShallow(lightCache, lightNodes)) {
		throw new Error("lights unchanged");
	} else {
		lightCache = lightNodes;
	}
	return lightNodes;
});

const renderPasses = writable([]);

let materialCache;

const materials = derived([meshes], ([$meshes]) => {
	const materials = new Set();
	$meshes.forEach((node) => {
		materials.add(node.material);
	});
	//using throw to cancel update flow when unchanged
	if (hasSameShallow$1(materialCache, materials)) {
		throw new Error("materials unchanged");
	} else {
		materialCache = materials;
	}
	return materials;
});

function isTransparent(material) {
	return material?.opacity < 1 || material?.transparent;
}

function sortTransparency(a, b) {
	return (isTransparent(a.material) ? 1 : -1) - (isTransparent(b.material) ? 1 : -1);
}

function sortMeshesByZ(programs) {
	if (programs.length === 0 || get_store_value(renderer).canvas == null) {
		return;
	}
	let transparent = false;
	const canvas = get_store_value(renderer).canvas;
	const { projection, view } = getCameraProjectionView(get_store_value(camera), canvas.width, canvas.height);
	//const inverseView = invert([], view);
	const projScreen = multiply([], projection, view);

	programs.forEach((program) => {
		if (transparent || isTransparent(program.material)) {
			transparent = true;
			let logText = "";
			program.meshes.forEach((mesh, i) => {
				const meshPosition = getTranslation([], mesh.matrix);
				mesh.clipSpacePosition = transformMat4([], meshPosition, projScreen);
			});
			program.meshes.sort((a, b) => {
				return b.clipSpacePosition[2] - a.clipSpacePosition[2];
			});
			// reporting
			program.meshes.forEach((mesh) => {
				const meshPosition = mesh.clipSpacePosition.map((v) => v.toFixed(5));
				logText += get_store_value(meshes).indexOf(mesh) + " " + meshPosition + " ";
			});
			console.log("clipSpacePosition", logText);
		}
	});

	const sortedPrograms = programs.sort((a, b) => {
		if (
			a.material == null ||
			b.material == null ||
			a.meshes[0].clipSpacePosition == null ||
			b.meshes[0].clipSpacePosition == null
		) {
			return 0;
		}
		return b.meshes[0].clipSpacePosition[2] - a.meshes[0].clipSpacePosition[2];
	});
	// log
	let logText = "";
	sortedPrograms.forEach((program) => {
		if (!program.material || !program.meshes[0].clipSpacePosition) {
			return;
		}
		const meshPosition = program.meshes[0].clipSpacePosition.map((v) => v.toFixed(5));
		logText += get_store_value(meshes).indexOf(program.meshes[0]) + " " + meshPosition + " ";
	});
	console.log("programs", logText);
	return sortedPrograms;
}

const programs = derived(
	[meshes, lights, materials, renderPasses],
	([$meshes, $lights, $materials, $renderPasses]) => {
		let prePasses = $renderPasses
			.filter((pass) => pass.order < 0)
			.reduce((acc, pass) => {
				return acc.concat(...pass.programs);
			}, [])
			.map((program) => ({
				...program,
				...(program.allMeshes ? { meshes: $meshes } : {}),
			}));

		let programs = Array.from($materials);

		//this sublist mesh items require their own respective program (shader)
		const specialMeshes = new Set(
			$meshes.filter((node) => node.instances > 1 || node.animations?.some((a) => a.type === "vertex")),
		);

		programs = programs.reduce((acc, current) => {
			const materialMeshes = $meshes.filter((node) => node.material === current);
			const { currentNormalMeshes, currentSpecialMeshes } = materialMeshes.reduce(
				(acc, node) => {
					if (specialMeshes.has(node)) {
						acc.currentSpecialMeshes.push(node);
					} else {
						acc.currentNormalMeshes.push(node);
					}
					return acc;
				},
				{
					currentNormalMeshes: [],
					currentSpecialMeshes: [],
				},
			);

			if (currentNormalMeshes.length > 0) {
				acc.push({
					material: current,
					meshes: currentNormalMeshes,
				});
			}
			currentSpecialMeshes.forEach((mesh) => {
				const requireTime = mesh.animations?.some((animation) => animation.requireTime);
				acc.push({
					requireTime,
					material: current,
					meshes: [mesh],
				});
			});
			return acc;
		}, []);

		programs = programs.sort(sortTransparency);
		sortMeshesByZ(programs);
		const pointLights = $lights.filter((l) => get_store_value(l).type === "point");
		const numPointLights = pointLights.length;
		let pointLightShader;
		if (numPointLights > 0) {
			pointLightShader = get_store_value(pointLights[0]).shader;
		}

		return [
			...prePasses,
			...programs.map((p, index) => {
				const firstCall = index === 0;
				const program = {
					...p,
					useProgram,
					setupMaterial: [setupAmbientLight],
					bindTextures: [],
					createProgram,
					selectProgram,
				};
				program.setupProgram = [
					createShaders$1(p.material, p.meshes, numPointLights, pointLightShader),
					linkProgram,
					validateProgram,
				];
				if (firstCall) {
					program.setFrameBuffer = bindDefaultFramebuffer;
				}
				if (p.material?.specular) {
					program.setupMaterial.push(p.material.specular.setupSpecular);
				}
				if (p.material?.diffuseMap) {
					program.setupMaterial.push(p.material.diffuseMap.setupTexture);
					program.bindTextures.push(p.material.diffuseMap.bindTexture);
				}
				if (p.material?.normalMap) {
					program.setupMaterial.push(p.material.normalMap.setupTexture);
					program.bindTextures.push(p.material.normalMap.bindTexture);
				}
				if (p.requireTime) {
					program.setupMaterial.push(setupTime);
				}
				program.setupMaterial.push(
					...Array.from(
						$lights.reduce((acc, light) => {
							const lightValue = get_store_value(light);
							if (acc.has(lightValue.setupLights)) {
								acc.set(lightValue.setupLights, [...acc.get(lightValue.setupLights), light]);
							} else {
								acc.set(lightValue.setupLights, [light]);
							}
							return acc;
						}, new Map()),
					).map(([setupLights, filteredLights]) => setupLights(filteredLights)),
				);
				return program;
			}),
		];
	},
);

const renderState = writable({
	init: false,
});

function isStore(obj) {
	return obj != null && obj.subscribe != null;
}

function selectProgram(programStore) {
	return function selectProgram() {
		const { programMap } = appContext;
		const cachedProgram = programMap.get(programStore);
		appContext.program = cachedProgram;
	};
}

function selectMesh(programStore, mesh) {
	return function selectMesh() {
		const { vaoMap } = appContext;
		const cachedVAO = vaoMap.get(programStore).get(mesh);
		appContext.vao = cachedVAO;
	};
}

let appContext = {
	programMap: new Map(),
	vaoMap: new Map(),
};

function setAppContext(context) {
	appContext = {
		...appContext,
		...context,
	};
}

const emptyRenderPipeline = [];
const revisionMap = new Map();
revisionMap.set(renderer, 0);
revisionMap.set(scene, 0);
revisionMap.set(camera, 0);

function updated() {
	const updateMap = new Set();
	if (revisionMap.get(renderer) !== renderer.revision) {
		updateMap.add(renderer);
	}
	if (revisionMap.get(scene) !== scene.revision) {
		updateMap.add(scene);
	}
	if (revisionMap.get(camera) !== camera.revision) {
		updateMap.add(camera);
	}
	revisionMap.set(renderer, renderer.revision);
	revisionMap.set(scene, scene.revision); /**
	 * running states
	 * 0 : not started
	 * 1 : init currently running
	 * 2 : init done, waiting for start
	 * 3 : loop requested, ready to run									<---|
	 * 																		|---- end state occilates between 3 and 4
	 * 4 : loop currently running, renderer updates ignored momentarily	<---|
	 */
	revisionMap.set(camera, camera.revision);
	return updateMap;
}

/**
 * running states
 * 0 : not started
 * 1 : init currently running
 * 2 : init done, waiting for start
 * 3 : loop requested, ready to run									<---|
 * 																		|---- end state occilates between 3 and 4
 * 4 : loop currently running, renderer updates ignored momentarily	<---|
 */
const running = writable(0);

const renderPipeline = derived(
	[renderer, programs, scene, camera, running],
	([$renderer, $programs, $scene, $camera, $running]) => {
		// if renderer.enabled is false, the scene is being setup, we should not render
		// if running is 4, we delay the pipeline updates as a way to batch scene updates
		if (!$renderer.enabled || $running === 4 || $running === 1) {
			//TODO maybe throw here to cancel the update flow
			return emptyRenderPipeline;
		}
		/**
		 * this map will tell you which stores have been updated since
		 * last updated() call while changes were batched
		 */

		const updateMap = updated();
		/*
		if(updateMap.has(renderer)){
			console.log("update renderer");
		}
		if(updateMap.has(scene)){
			console.log("update scene");
		}
		if(updateMap.has(camera)){
			console.log("update camera");
		}
		*/
		//we must filter in the stores first because not all the nodes are stores for now
		//then we filter the lights

		if (updateMap.length === 0) {
			return emptyRenderPipeline;
		}

		const rendererValues = renderer.processed;
		let rendererContext = {
			canvas: $renderer.canvas,
			backgroundColor: rendererValues.backgroundColor,
			ambientLightColor: rendererValues.ambientLightColor,
			...($renderer.toneMappings.length > 0
				? {
						toneMappings: $renderer.toneMappings,
					}
				: undefined),
		};
		const pipeline = [];

		appContext = {
			...appContext,
			...rendererContext,
		};

		const init = get_store_value(renderState).init;
		if (!init) {
			pipeline.push(initRenderer);
		}
		/*!init &&*/
		console.log("programs", $programs);

		const sortedPrograms = sortMeshesByZ($programs);
		let transparent = false;

		pipeline.push(disableBlend);
		pipeline.push(
			...sortedPrograms.reduce((acc, program) => {
				if (isTransparent(program.material) && !transparent) {
					transparent = true;
					acc.push(enableBlend);
				}
				return [
					...acc,
					...(appContext.programMap.has(program)
						? [program.selectProgram(program), program.useProgram, ...program.bindTextures]
						: [program.createProgram(program), ...program.setupProgram, program.useProgram, ...program.setupMaterial]),
					...(program.setupCamera ? [program.setupCamera] : [...(updateMap.has(camera) ? [setupCamera($camera)] : [])]),
					...(program.setFrameBuffer ? [program.setFrameBuffer] : []),
					...program.meshes.reduce(
						(acc, mesh) => [
							...acc,
							...(appContext.vaoMap.has(program) && appContext.vaoMap.get(program).has(mesh)
								? [
										selectMesh(program, mesh),
										//setupMeshColor(program.material),// is it necessary ?multiple meshes only render with same material so same color
										...(mesh.instances == null
											? [setupTransformMatrix(program, mesh, mesh.matrix), setupNormalMatrix()]
											: []),
									]
								: [
										setupAttributes(program, mesh),
										...(program.material ? [setupMeshColor(program.material)] : []),
										setupTransformMatrix(program, mesh, mesh.instances == null ? mesh.matrix : mesh.matrices, mesh.instances),
										setupNormalMatrix(program, mesh, mesh.instances),
										...(mesh.animations?.map((animation) => animation.setupAnimation) || []),
									]),
							bindVAO,
							render(mesh, mesh.instances, mesh.drawMode),
						],
						[],
					),
					...(program.postDraw ? [program.postDraw] : []),
				];
			}, []),
		);
		return pipeline;
	},
	emptyRenderPipeline,
);

const renderLoopStore = derived([renderPipeline], ([$renderPipeline]) => {
	if ($renderPipeline.length === 0) {
		return 0;
	}
	if (!get_store_value(renderState).init && get_store_value(running) === 0) {
		running.set(1);
		$renderPipeline.forEach((f) => {
			//log("f init", f.name);
			f();
		});
		renderState.set({
			init: true,
		});
		running.set(2);
		return 1;
	} else if (get_store_value(running) === 2) {
		running.set(3);
		requestAnimationFrame(loop);
		return 2;
	}

	async function loop() {
		//lock pipeline updates to batch changes while loop is running
		running.set(4);
		get_store_value(renderer).loop && get_store_value(renderer).loop();
		//unlock pipeline updates and trigger next update
		running.set(3);
		//run pipeline updates
		get_store_value(renderPipeline).forEach((f) => {
			//log("f loop", f.name);
			f();
		});
		//lock pipeline updates to batch changes that come from other sources than loop
		running.set(4);
		requestAnimationFrame(loop);
	}
});

//this is necessary because the store needs to be subscribed to to be activated
renderLoopStore.subscribe((value) => {
	//console.log("render loop store subscribed", value);
});

var pointLightShader = "${declaration?\r\n`\r\n\r\nfloat pow4(const in float x) {\r\n    float x2 = x * x;\r\n    return x2 * x2;\r\n}\r\nfloat pow2(const in float x) {\r\n    return x * x;\r\n}\r\n\r\nfloat saturate(const in float a) {\r\n    return clamp(a, 0.0f, 1.0f);\r\n}\r\n\r\nstruct LightParams {\r\n    vec3 irradiance;\r\n    vec3 direction;\r\n    vec3 color;\r\n    float distance;\r\n};\r\n\r\nstruct PointLight {\r\n    vec3 position;\r\n    vec3 color;\r\n    float cutoffDistance;\r\n    float decayExponent;\r\n};\r\n\r\nlayout(std140) uniform PointLights {\r\n    PointLight pointLights[NUM_POINT_LIGHTS];\r\n};\r\n\r\nfloat getDistanceAttenuation(const in float lightDistance, const in float cutoffDistance, const in float decayExponent) {\r\n\t// based upon Frostbite 3 Moving to Physically-based Rendering\r\n\t// page 32, equation 26: E[window1]\r\n\t// https://seblagarde.files.wordpress.com/2015/07/course_notes_moving_frostbite_to_pbr_v32.pdf\r\n    float distanceFalloff = 1.0f / max(pow(lightDistance, decayExponent), 0.01f);\r\n    if(cutoffDistance > 0.0f) {\r\n        distanceFalloff *= pow2(saturate(1.0f - pow4(lightDistance / cutoffDistance)));\r\n    }\r\n    return distanceFalloff;\r\n\r\n}\r\n\r\nLightParams getDirectDiffuse(const in PointLight pointLight,const in vec3 vertexPosition, const in vec3 normal,const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {\r\n    LightParams lightParams = LightParams(vec3(0.0f), vec3(0.0f), vec3(0.0f), 0.0f);\r\n    vec3 lVector = pointLight.position - vertexPosition;\r\n    lightParams.distance = length(lVector);\r\n    lightParams.direction = normalize(lVector);\r\n    float dotNL = saturate(dot(normal, lightParams.direction));\r\n    lightParams.color = pointLight.color;\r\n    lightParams.color *= getDistanceAttenuation(lightParams.distance, pointLight.cutoffDistance, pointLight.decayExponent);\r\n    lightParams.irradiance = dotNL * lightParams.color;\r\n    \r\n    reflectedLight.directDiffuse += lightParams.irradiance * BRDF_Lambert(material.diffuseColor);\r\n    return lightParams;\r\n}\r\n\r\nfloat calculatePointLightBrightness(float lightDistance, float cutoffDistance, float decayExponent) {\r\n    return getDistanceAttenuation(lightDistance, cutoffDistance, decayExponent);\r\n}\r\n` : ''\r\n}\r\n${irradiance?\r\n`\r\n    vec3 irradiance = vec3(0.0f);\r\n    vec3 direction = vec3(0.0f);\r\n    for(int i = 0; i < NUM_POINT_LIGHTS; i++) {\r\n        PointLight pointLight = pointLights[i];\r\n        \r\n\r\n        LightParams lightParams = getDirectDiffuse(pointLight, vertex, normal, material, reflectedLight);\r\n        totalIrradiance += reflectedLight.directDiffuse;\r\n        ${specularIrradiance}\r\n    }\r\n` : ''\r\n}\r\n";

function createVec3() {
	return new Array(3).fill(0);
}

function multiplyScalarVec3(a, scalar) {
	a[0] *= scalar;
	a[1] *= scalar;
	a[2] *= scalar;
	return a;
}

function normalizeNormals(normals) {
	for (let i = 0, il = normals.length; i < il; i += 3) {
		const x = normals[i + 0];
		const y = normals[i + 1];
		const z = normals[i + 2];

		const n = 1.0 / Math.sqrt(x * x + y * y + z * z);

		normals[i + 0] *= n;
		normals[i + 1] *= n;
		normals[i + 2] *= n;
	}
}

const createPointLight = (props) => {
	return {
		type: "point",
		position: [0, 0, 0],
		color: [1, 1, 1],
		intensity: 3,
		cutoffDistance: 5,
		decayExponent: 1,
		...props,
		shader: templateLiteralRenderer(pointLightShader, {
			declaration: false,
			irradiance: false,
			specularIrradiance: "",
		}),
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
/** @typedef {Object} WithGL
 * @property {WebGL2RenderingContext} gl
 */

/**
 *
 * @param {WithGL} param0
 * @param {*} lights
 */
function createPointLightBuffer(pointLigths) {
	const { gl } = appContext;
	// Create a single Float32Array to hold all the point light data
	const numPointLights = pointLigths.length;
	const pointLightsData = new Float32Array(numPointLights * 12); // Each point light has 12 values (position(3=>4), color(3=>4), intensity(1=>4))
	// Fill the Float32Array with the point light data
	for (let lightIndex = 0; lightIndex < numPointLights; lightIndex++) {
		const light = get_store_value(pointLigths[lightIndex]);
		const offset = lightIndex * 12; // Each point light takes up 8 positions in the array
		writeLightBuffer(pointLightsData, light, offset);
	}

	// Create UBO for point lights
	const tmpPointLightsUBO = gl.createBuffer();
	setPointLightsUBO(tmpPointLightsUBO);

	gl.bindBufferBase(gl.UNIFORM_BUFFER, UBO_BINDING_POINT_POINTLIGHT, tmpPointLightsUBO);
	// Set the data in the UBO using bufferData
	gl.bufferData(gl.UNIFORM_BUFFER, pointLightsData, gl.DYNAMIC_DRAW);
}

function writeLightBuffer(buffer, light, offset) {
	light.preMultipliedColor = [...light.color];
	multiplyScalarVec3(light.preMultipliedColor, light.intensity);
	// Set the position data
	buffer[offset] = light.position[0];
	buffer[offset + 1] = light.position[1];
	buffer[offset + 2] = light.position[2];
	buffer[offset + 4] = light.preMultipliedColor[0];
	buffer[offset + 5] = light.preMultipliedColor[1];
	buffer[offset + 6] = light.preMultipliedColor[2];
	buffer[offset + 7] = light.cutoffDistance;
	buffer[offset + 8] = light.decayExponent;
	buffer[offset + 9] = 0;
	buffer[offset + 10] = 0;
	buffer[offset + 11] = 0;
	buffer[offset + 12] = 0;
}

function setupLights(lights) {
	return function setupLights() {
		const { gl, program } = appContext;

		//only create the UBO once per app, not per program, todo move the only once logic to webglapp store
		if (!getPointLightsUBO()) {
			createPointLightBuffer(lights);
		}
		//program specific
		const pointLightsBlockIndex = gl.getUniformBlockIndex(program, "PointLights");
		// Bind the UBO to the binding point
		gl.uniformBlockBinding(program, pointLightsBlockIndex, UBO_BINDING_POINT_POINTLIGHT);
	};
}

function updateOneLight(lights, light) {
	const { gl } = appContext;
	const pointLigths = lights.filter((l) => get_store_value(l).type === "point");
	const lightIndex = pointLigths.findIndex((l) => l === light);
	const pointLightsUBO = getPointLightsUBO();
	if (lightIndex !== -1) {
		const lightData = new Float32Array(12);
		const offset = lightIndex * 12;
		const lightValue = get_store_value(light);
		writeLightBuffer(lightData, lightValue, offset);
		gl.bindBuffer(gl.UNIFORM_BUFFER, pointLightsUBO);
		gl.bufferSubData(gl.UNIFORM_BUFFER, offset * Float32Array.BYTES_PER_ELEMENT, lightData);
	}
}

const skyblue = 0x87ceeb;

const drawModes = {
	0: "POINTS",
	1: "LINES",
	2: "LINE_LOOP",
	3: "LINE_STRIP",
	4: "TRIANGLES",
	5: "TRIANGLE_STRIP",
	6: "TRIANGLE_FAN",
};

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

function createPlane(
	width = 1,
	depth = 1,
	widthSegments = 1,
	depthSegments = 1,
	clockwise = false,
	generateColors = false,
) {
	const positions = [];
	const normals = [];
	const uvs = [];
	const indices = [];
	const halfWidth = width / 2;
	const halfDepth = depth / 2;
	const segmentWidth = width / widthSegments;
	const segmentDepth = depth / depthSegments;
	const gridX = widthSegments + 1;
	const gridZ = depthSegments + 1;
	for (let iz = 0; iz < gridZ; iz++) {
		const z = iz * segmentDepth - halfDepth;
		for (let ix = 0; ix < gridX; ix++) {
			const x = ix * segmentWidth - halfWidth;
			positions.push(x, 0, -z);
			normals.push(0, 1, 0);
			uvs.push(ix / widthSegments, 1 - iz / depthSegments);
		}
	}
	for (let iz = 0; iz < depthSegments; iz++) {
		for (let ix = 0; ix < widthSegments; ix++) {
			const a = ix + gridX * iz;
			const b = ix + gridX * (iz + 1);
			const c = ix + 1 + gridX * (iz + 1);
			const d = ix + 1 + gridX * iz;
			if (clockwise) {
				indices.push(a, b, d);
				indices.push(b, c, d);
			} else {
				indices.push(a, d, b);
				indices.push(b, d, c);
			}
		}
	}
	return {
		attributes: {
			positions: new Float32Array(positions),
			normals: new Float32Array(normals),
			uvs: new Float32Array(uvs),
			elements: new Uint16Array(indices),
			...(generateColors ? { colors: new Float32Array(positions.map((_, i) => (i % 3 === 0 ? 1 : 1))) } : {}),
		},
		drawMode: drawModes[4],
	};
}

function createOrbitControls(canvas, camera) {
	//add support for touch events
	canvas.addEventListener("touchstart", onMouseDown, { passive: false });
	canvas.addEventListener("mousedown", onMouseDown, { passive: false });
	canvas.addEventListener("wheel", onMouseWheel, { passive: false });
	let startX;
	let startY;
	function onMouseDown(event) {
		let moveEventType = "mousemove";
		let upEventType = "mouseup";
		let positionObject = event;
		if (event.type === "touchstart") {
			moveEventType = "touchmove";
			upEventType = "touchend";
			positionObject = event.touches[0];
		}
		canvas.addEventListener(moveEventType, onMouseMove, { passive: false });
		startX = positionObject.clientX;
		startY = positionObject.clientY;
		canvas.addEventListener(upEventType, onMouseUp, { passive: false });
		//prevent default to avoid the canvas to be selected
		event.preventDefault();
		event.stopPropagation();
	}
	function getCoordinates(position, target) {
		const radius = Math.sqrt(
			Math.pow(position[0] - target[0], 2) + Math.pow(position[1] - target[1], 2) + Math.pow(position[2] - target[2], 2),
		);

		const polar = Math.acos(Math.max(-1, Math.min(1, (position[1] - target[1]) / radius)));
		const azimuth = Math.atan2(position[0] - target[0], position[2] - target[2]);
		return {
			radius,
			polar,
			azimuth,
		};
	}
	function onMouseMove(event) {
		let positionObject = event;
		if (event.type === "touchmove") {
			positionObject = event.touches[0];
		}
		const x = positionObject.clientX - startX;
		const y = positionObject.clientY - startY;
		const cameraValue = get_store_value(camera);
		const { position, target, fov } = cameraValue;
		const { radius, polar, azimuth } = getCoordinates(position, target);

		const newPosition = getPositionFromPolar(radius, polar - y / 100, azimuth - x / 100);
		newPosition[0] = newPosition[0] + target[0];
		newPosition[1] = newPosition[1] + target[1];
		newPosition[2] = newPosition[2] + target[2];

		camera.set({
			position: newPosition,
			target,
			fov,
		});
		startX = positionObject.clientX;
		startY = positionObject.clientY;
	}
	function onMouseWheel(event) {
		const cameraValue = get_store_value(camera);
		const { position, target, fov } = cameraValue;
		const { radius, polar, azimuth } = getCoordinates(position, target);
		console.log("radius", radius);

		const newPosition = getPositionFromPolar(radius + event.deltaY * 0.001 * radius, polar, azimuth);
		newPosition[0] = newPosition[0] + target[0];
		newPosition[1] = newPosition[1] + target[1];
		newPosition[2] = newPosition[2] + target[2];

		camera.set({
			position: newPosition,
			target,
			fov,
		});
	}

	function getPositionFromPolar(radius, polar, azimuth) {
		const sinPhiRadius = Math.sin(polar) * radius;
		return [sinPhiRadius * Math.sin(azimuth), Math.cos(polar) * radius, sinPhiRadius * Math.cos(azimuth)];
	}
	function onMouseUp(event) {
		let moveEventType = "mousemove";
		let upEventType = "mouseup";
		if (event.type === "touchend") {
			moveEventType = "touchmove";
			upEventType = "touchend";
		}
		canvas.removeEventListener(moveEventType, onMouseMove, { passive: false });
		canvas.removeEventListener(upEventType, onMouseUp, { passive: false });
	}
}

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

var depthVertexShader = "#version 300 es\r\n\r\nprecision highp float;\r\n\r\nuniform mat4 view;\r\nuniform mat4 projection;\r\nuniform mat4 world;\r\n\r\nin vec3 position;\r\n\r\nout vec2 vHighPrecisionZW;\r\n\r\nvoid main() {\r\n\tgl_Position = projection * view * world * vec4( position, 1.0 );\r\n\tvHighPrecisionZW = gl_Position.zw;\r\n}";

var depthFragmentShader = "#version 300 es\r\n\r\nout highp vec4 fragColor;\r\n\r\nprecision highp float;\r\nprecision highp int;\r\n\r\n//uniform float darkness;\r\nin vec2 vHighPrecisionZW;\r\n\r\nvoid main() {\r\n\tfloat fragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;\r\n\tfragColor = vec4( vec3( 0.0 ), ( 1.0 - fragCoordZ ) * 1.0 );\r\n\t//fragColor = vec4( vec3( fragCoordZ ), 1.0 );\r\n\t//debug fragColor = vec4( vec3(( 1.0  ) ) ,1.0);\r\n}\r\n\t\t\t\t\t";

var vertexShaderSource = "#version 300 es\r\n\r\nin vec4 position;\r\nin vec2 uv;\r\n\r\nout vec2 vTexCoord;\r\n\r\nvoid main()\r\n{\r\n    gl_Position = position;\r\n    vTexCoord = uv;\r\n}";

var fragmentShaderSource = "#version 300 es\r\n\r\nprecision mediump float;\r\n\r\nuniform sampler2D sampler;\r\nuniform vec2 uvStride;\r\nuniform vec2[128] offsetAndScale; // x=offset, y=scale\r\nuniform int kernelWidth;\r\n\r\nin vec2 vTexCoord;\r\n\r\nout vec4 fragColor;\r\n\r\nvoid main()\r\n{\r\n\t//fragColor = vec4(vec3(vTexCoord.y),1.0);\r\n\t//fragColor += vec4(vec3(texture(sampler,vTexCoord).w),1.0);\r\n\tfor (int i = 0; i < kernelWidth; i++) {\r\n\r\n\t\tfragColor += texture(\r\n\t\t\tsampler,\r\n\t\t\tvTexCoord + offsetAndScale[i].x * uvStride\r\n\t\t    //   ^------------------------------------  UV coord for this fragment\r\n\t\t    //              ^-------------------------  Offset to sample (in texel space)\r\n\t\t    //                                  ^-----  Amount to move in UV space per texel (horizontal OR vertical only)\r\n\t\t    //   v------------------------------------  Scale down the sample\r\n\t\t) * offsetAndScale[i].y;\r\n\r\n\t\t//fragColor += vec4(vec3(0.01),1.0);\r\n\t}\r\n\t//float value = offsetAndScale[int(vTexCoord.x)].x;\r\n\t//fragColor = vec4(vec3(offsetAndScale[8].x/12.0),1.0);\r\n\t//fragColor = vec4(offsetAndScale[32].x,offsetAndScale[32].x,offsetAndScale[32].x,1.0);//texture(sampler,vTexCoord);\r\n}";

const BLUR_DIRECTION_HORIZONTAL = 0;
const BLUR_DIRECTION_VERTICAL = 1;

// Generate a gaussian kernel based on a width
const generate1DKernel = (width) => {
	if ((width & 1) !== 1) throw new Error("Only odd guassian kernel sizes are accepted");

	// Small sigma gaussian kernels are a problem. You usually need to add an error correction
	// algorithm. But since our kernels grow in discrete intervals, we can just pre-compute the
	// problematic ones. These values are derived from the Pascal's Triangle algorithm.
	/*const smallKernelLerps = [
        [1.0],
        [0.25, 0.5, 0.25],
        [0.0625, 0.25, 0.375, 0.25, 0.0625],
        [0.03125, 0.109375, 0.21875, 0.28125, 0.21875, 0.109375, 0.03125],
	];
	if (width < 9) return smallKernelLerps[(width - 1) >> 1];*/
	if (width < 9) throw new Error("Blur must be at least 9 pixels wide");

	const kernel = [];
	const sigma = width / 6; // Adjust as required
	const radius = (width - 1) / 2;

	let sum = 0;

	// Populate the array with gaussian kernel values
	for (let i = 0; i < width; i++) {
		const offset = i - radius;

		const coefficient = 1 / (sigma * Math.sqrt(2 * Math.PI));
		const exponent = -(offset * offset) / (2 * (sigma * sigma));
		const value = coefficient * Math.exp(exponent);

		// We'll need this for normalization below
		sum += value;

		kernel.push(value);
	}

	// Normalize the array
	for (let i = 0; i < width; i++) {
		kernel[i] /= sum;
	}

	return kernel;
};

// Convert a 1D gaussian kernel to value pairs, as an array of linearly interpolated
// UV coordinates and scaling factors. Gaussian kernels are always have an odd number of
// weights, so in this implementation, the first weight value is treated as the lone non-pair
// and then all remaining values are treated as pairs.
const convertKernelToOffsetsAndScales = (kernel) => {
	if ((kernel.length & 1) === 0) throw new Error("Only odd kernel sizes can be lerped");

	const radius = Math.ceil(kernel.length / 2);
	const data = [];

	// Prepopulate the array with the first cell as the lone weight value
	let offset = -radius + 1;
	let scale = kernel[0];
	data.push(offset, scale);

	const total = kernel.reduce((c, v) => c + v);

	for (let i = 1; i < kernel.length; i += 2) {
		const a = kernel[i];
		const b = kernel[i + 1];

		offset = -radius + 1 + i + b / (a + b);
		scale = (a + b) / total;
		data.push(offset, scale);
	}

	return data;
};

/**
 *
 * @param {boolean} mapCurrent makes the previous program the current one
 * which allows to reuse one program in two consecutive and different draw passes
 * This case is necessary to draw twice with different settings (unitforms)
 */
function createBlurProgram(mapCurrent = false) {
	return function createBlurProgram(programStore) {
		return function createBlurProgram() {
			const { gl, programMap, vaoMap } = appContext;
			if (!programMap.has(programStore) && !mapCurrent) {
				const program = gl.createProgram();
				programMap.set(programStore, program);
				vaoMap.set(programStore, new Map());
				appContext.program = program;
			} else if (mapCurrent) {
				programMap.set(programStore, appContext.program);
				vaoMap.set(programStore, new Map());
			} else {
				//todo check if necessary, this check is done in engine already, if it exists, createProgram is not called
				appContext.program = appContext.programMap.get(programStore);
			}
		};
	};
}

function createBlurShaders() {
	const { gl, program } = appContext;

	const vertexShader = gl.createShader(gl.VERTEX_SHADER);
	gl.shaderSource(vertexShader, vertexShaderSource);
	gl.compileShader(vertexShader);
	if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
		console.error("ERROR compiling vertex shader!", gl.getShaderInfoLog(vertexShader));
	}
	gl.attachShader(program, vertexShader);

	const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
	gl.shaderSource(fragmentShader, fragmentShaderSource);
	gl.compileShader(fragmentShader);
	if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
		console.error("ERROR compiling fragment shader!", gl.getShaderInfoLog(fragmentShader));
	}
	gl.attachShader(program, fragmentShader);
}

// Create a simple quad mesh for the blur shader
function createBlurMesh() {
	return {
		attributes: {
			positionsSize: 2,
			positions: new Float32Array([
				// Pos (xy)
				-1, 1, -1, -1, 1, 1, 1, -1,
			]),
			uvs: new Float32Array([
				// UV coordinate
				0, 1, 0, 0, 1, 1, 1, 0,
			]),
		},
		drawMode: drawModes[5],
	};
}

// Set the blur stride uniform, which define the direction of the blur
function setDirectionUniform(direction) {
	const { gl, program } = appContext;

	const unidirectionalUVStride =
		direction === BLUR_DIRECTION_HORIZONTAL
			? [1 / appContext.frameBufferWidth, 0]
			: [0, 1 / appContext.frameBufferHeight];
	const uvStrideUniformLocation = gl.getUniformLocation(program, "uvStride");
	gl.uniform2fv(uvStrideUniformLocation, unidirectionalUVStride);
}

// Generate a kernel
function getKernel(size) {
	const kernel1D = generate1DKernel(size);
	const kernel = convertKernelToOffsetsAndScales(kernel1D);
	return kernel;
}

// Set the kernel uniforms
function setKernelUniforms(kernel) {
	const { gl, program } = appContext;

	const offsetScaleLocation = gl.getUniformLocation(program, "offsetAndScale");
	gl.uniform2fv(offsetScaleLocation, kernel);

	const kernelWidthLocation = gl.getUniformLocation(program, "kernelWidth");
	gl.uniform1i(kernelWidthLocation, kernel.length / 2);
}

/**
 * @typedef {ContactShadowPass} ContactShadowPass
 * @property {Array} programs array of programs used in the pass
 * @property {number} order order of the pass in the rendering pipeline
 * @property {function} getTexture function to get the shadow texture
 */

/**
 *
 * @param {number} width width of the plane that will receive the shadow
 * @param {number} height height of the plane that will receive the shadow
 * @param {number} depth how far objects in height are see from the shadow camera
 * @param {mat4} groundMatrix plane ground matrix used as orthographic camera for the shadow rendering
 * @param {number} textureSize size of the texture used to render the shadow
 * @param {number} blurSize size of the blur
 * @returns {ContactShadowPass} object containing the shadow pass
 *
 */
function createContactShadowPass(groundMatrix, depth, width, height, textureSize = 1024, blurSize = 128) {
	const groundTranslation = getTranslation([], groundMatrix);
	const aspect = width / height;
	const textureWidth = textureSize * aspect;
	const textureHeight = textureSize / aspect;
	//log("creating contact shadow pass", width, height, depth, groundMatrix, blurSize);

	const projection = orthoNO(new Float32Array(16), -width / 2, width / 2, -height / 2, height / 2, 0, depth);

	const view = lookAt(
		new Float32Array(16),
		groundTranslation,
		[groundTranslation[0], groundTranslation[1] + 1, groundTranslation[2]],
		[0, 0, -1],
	);

	let horizontalBlurFBO;
	function setHorizontalBlurFBO(fbo) {
		horizontalBlurFBO = fbo;
	}
	function getHorizontalBlurFBO() {
		return horizontalBlurFBO;
	}

	let horizontalBlurTexture;
	function setHorizontalBlurTexture(texture) {
		horizontalBlurTexture = texture;
	}
	function getHorizontalBlurTexture() {
		return horizontalBlurTexture;
	}

	let verticalBlurFBO;
	function setVerticalBlurFBO(fbo) {
		verticalBlurFBO = fbo;
	}
	function getVerticalBlurFBO() {
		return verticalBlurFBO;
	}

	let verticalBlurTexture;
	function setVerticalBlurTexture(texture) {
		verticalBlurTexture = texture;
	}
	function getVerticalBlurTexture() {
		return verticalBlurTexture;
	}

	let geometryFBO;
	function setGeometryFBO(fbo) {
		geometryFBO = fbo;
	}
	function getGeometryFBO() {
		return geometryFBO;
	}

	let geometryTexture;
	function setGeometryTexture(texture) {
		geometryTexture = texture;
	}
	function getGeometryTexture() {
		return geometryTexture;
	}

	const blurMesh = createBlurMesh();

	return {
		programs: [
			{
				createProgram: createShadowProgram(),
				setupProgram: [
					createShaders,
					linkProgram,
					validateProgram,
					createFBO(textureWidth, textureHeight, setGeometryFBO, setGeometryTexture),
				],
				setupMaterial: [],
				useProgram,
				selectProgram,
				bindTextures: [],
				setupCamera: setupShadowCamera(projection, view),
				setFrameBuffer: setFrameBuffer(getGeometryFBO, textureWidth, textureHeight),
				allMeshes: true,
			},
			{
				createProgram: createBlurProgram(),
				setupProgram: [
					createBlurShaders,
					linkProgram,
					validateProgram,
					createFBO(textureWidth, textureHeight, setHorizontalBlurFBO, setHorizontalBlurTexture),
				],
				setupMaterial: [
					setupBlurKernel(blurSize),
					() => setDirectionUniform(BLUR_DIRECTION_HORIZONTAL),
					() => setSourceTexture(getGeometryTexture),
				],
				useProgram,
				selectProgram: selectBlurProgram(BLUR_DIRECTION_HORIZONTAL, getGeometryTexture),
				bindTextures: [],
				setupCamera: () => {},
				setFrameBuffer: setFrameBuffer(getHorizontalBlurFBO, textureWidth, textureHeight),
				meshes: [blurMesh],
				postDraw: unbindTexture,
			},
			{
				createProgram: createBlurProgram(true),
				setupProgram: [createFBO(textureWidth, textureHeight, setVerticalBlurFBO, setVerticalBlurTexture)],
				setupMaterial: [
					() => setDirectionUniform(BLUR_DIRECTION_VERTICAL),
					() => setSourceTexture(getHorizontalBlurTexture),
				],
				useProgram,
				selectProgram: selectBlurProgram(BLUR_DIRECTION_VERTICAL, getHorizontalBlurTexture),
				bindTextures: [],
				setupCamera: () => {},
				setFrameBuffer: setFrameBuffer(getVerticalBlurFBO, textureWidth, textureHeight),
				meshes: [blurMesh],
				postDraw: unbindTexture,
			},
		],
		getTexture: getVerticalBlurTexture,
		order: -1,
	};
}

function setupBlurKernel(size) {
	return function setupBlurKernel() {
		//rollup will remove the "size" argument form getKernel call
		const rollupWorkAround = {
			size,
		};
		const kernel = getKernel(rollupWorkAround.size - 1);
		setKernelUniforms(kernel);
		//workaround to prevent rollup from removing the getKernel argument
		return rollupWorkAround;
	};
}

function unbindTexture() {
	const { gl } = appContext;
	gl.bindTexture(gl.TEXTURE_2D, null);
}

function selectBlurProgram(blurDirection, getTexture) {
	return function selectBlurProgram(programStore) {
		return function selectBlurProgram() {
			selectProgram(programStore)();
			useProgram();
			setSourceTexture(getTexture);
			setDirectionUniform(blurDirection);
		};
	};
}

function setSourceTexture(getTexture) {
	const { gl } = appContext;
	const texture = getTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);
}

function setFrameBuffer(getFBO = null, width, height) {
	return function setFrameBuffer() {
		const { gl } = appContext;
		const fbo = getFBO ? getFBO() : null;
		gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
		if (appContext.fbo !== fbo && fbo != null) {
			//log("framebuffer change clearing from", appContext.fbo, "to", fbo, [0, 0, 0, 1], width, height);
			gl.viewport(0, 0, width, height);
			appContext.frameBufferWidth = width;
			appContext.frameBufferHeight = height;
			gl.clearColor(...[0, 0, 0, 0]);
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		}
		appContext.fbo = fbo;
	};
}

function setupShadowCamera(projection, view) {
	return function setupShadowCamera() {
		const { gl, program } = appContext;

		const projectionLocation = gl.getUniformLocation(program, "projection");

		gl.uniformMatrix4fv(projectionLocation, false, projection);

		const viewLocation = gl.getUniformLocation(program, "view");
		gl.uniformMatrix4fv(viewLocation, false, view);
	};
}

function createShaders() {
	const { gl, program } = appContext;

	const vertexShader = gl.createShader(gl.VERTEX_SHADER);
	gl.shaderSource(vertexShader, depthVertexShader);
	gl.compileShader(vertexShader);
	if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
		console.error(gl.getShaderInfoLog(vertexShader));
	}
	gl.attachShader(program, vertexShader);

	const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
	gl.shaderSource(fragmentShader, depthFragmentShader);
	gl.compileShader(fragmentShader);
	if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
		console.error(gl.getShaderInfoLog(fragmentShader));
	}
	gl.attachShader(program, fragmentShader);
}

function createShadowProgram(textureWidth, textureHeight) {
	return function createShadowProgram(programStore) {
		return function createShadowProgram() {
			const { gl, programMap, vaoMap } = appContext;

			// Create shader program
			const program = gl.createProgram();
			programMap.set(programStore, program);
			vaoMap.set(programStore, new Map());

			appContext.program = program;
		};
	};
}

/*function createFBO(setTexture) {
	return function createFBO(width, height) {
		const { gl } = appContext;

		// Create FBO
		let fbo = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

		// Create texture
		const texture = gl.createTexture();
		setTexture(texture);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

		// Attach texture to FBO
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

		// Create renderbuffer
		const renderbuffer = gl.createRenderbuffer();
		gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
		gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);

		// Attach renderbuffer to FBO
		gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderbuffer);

		// Check FBO status
		const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
		if (status !== gl.FRAMEBUFFER_COMPLETE) {
			console.error("Framebuffer is incomplete:", status);
		}

		// Cleanup
		gl.bindTexture(gl.TEXTURE_2D, null);
		gl.bindRenderbuffer(gl.RENDERBUFFER, null);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		return {
			fbo,
			texture,
		};
	};
}*/

function createFBO(width, height, setFBO, setTexture) {
	return function createFBO() {
		const { gl } = appContext;
		// The geometry texture will be sampled during the HORIZONTAL pass
		const texture = gl.createTexture();
		setTexture(texture);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, width, height);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

		const fbo = gl.createFramebuffer();
		setFBO(fbo);
		gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

		gl.bindTexture(gl.TEXTURE_2D, null);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	};
}

/* src\main-refactor.svelte generated by Svelte v4.2.18 */

function create_fragment(ctx) {
	let canvas_1;

	return {
		c() {
			canvas_1 = element("canvas");
		},
		m(target, anchor) {
			insert(target, canvas_1, anchor);
			/*canvas_1_binding*/ ctx[1](canvas_1);
		},
		p: noop,
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) {
				detach(canvas_1);
			}

			/*canvas_1_binding*/ ctx[1](null);
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
	let $renderPasses;
	component_subscribe($$self, renderer, $$value => $$invalidate(2, $renderer = $$value));
	component_subscribe($$self, scene, $$value => $$invalidate(3, $scene = $$value));
	component_subscribe($$self, camera, $$value => $$invalidate(4, $camera = $$value));
	component_subscribe($$self, renderPasses, $$value => $$invalidate(5, $renderPasses = $$value));
	let canvas;

	onMount(async () => {
		const groundMatrix = identity(new Float32Array(16));
		translate(groundMatrix, groundMatrix, [0, -1.5, 0]);

		set_store_value(
			renderer,
			$renderer = {
				...$renderer,
				canvas,
				backgroundColor: skyblue,
				ambientLightColor: [0xffffff, 0.5]
			},
			$renderer
		);

		const shadowPass = createContactShadowPass(groundMatrix, 1, 10, 10, 1024, 128);
		const { getTexture: shadowTexture } = shadowPass;
		set_store_value(renderPasses, $renderPasses = [shadowPass], $renderPasses);

		set_store_value(
			camera,
			$camera = {
				position: [0, 5, -5],
				target: [0, 0, 0],
				fov: 75
			},
			$camera
		);

		const cubeMesh = createCube();
		const sphereMesh = createPolyhedron(1, 5, createSmoothShadedNormals);

		const light = createLightStore(createPointLight({
			position: [-2, 3, 0],
			color: [1, 1, 1],
			intensity: 20,
			cutoffDistance: 0,
			decayExponent: 2
		}));

		const secondCubePos = identity(new Float32Array(16));
		translate(secondCubePos, secondCubePos, [3, 0, 0]);
		const sameMaterial = { diffuse: [1, 0.5, 0.5], metalness: 0 };
		const groundMesh = createPlane(10, 10, 1, 1);

		const groundDiffuseMap = await createTexture({
			textureBuffer: shadowTexture,
			type: "diffuse"
		});

		await createTexture({
			url: "transparent-texture.png",
			type: "diffuse"
		});

		const groundMaterial = {
			diffuse: [1, 1, 1],
			metalness: 0,
			//diffuseMap,
			diffuseMap: groundDiffuseMap,
			transparent: true
		};

		const transparentMaterial = {
			diffuse: [1, 1, 0.5],
			metalness: 0,
			opacity: 0.5
		};

		set_store_value(
			scene,
			$scene = [
				...$scene,
				{
					...sphereMesh,
					matrix: identity(new Float32Array(16)),
					material: transparentMaterial
				},
				{
					...cubeMesh,
					matrix: secondCubePos,
					material: sameMaterial
				},
				{
					...groundMesh,
					matrix: groundMatrix,
					material: groundMaterial
				},
				light
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
	}); /*setTimeout(() => {
	$camera = {
		position: [0, 5, -4],
	};
}, 1000);*/

	function canvas_1_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			canvas = $$value;
			$$invalidate(0, canvas);
		});
	}

	return [canvas, canvas_1_binding];
}

class Main_refactor extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, {});
	}
}

export { Main_refactor as default };
