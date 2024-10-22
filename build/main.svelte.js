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

function create() {
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

var defaultVertex = "#version 300 es\r\nprecision mediump float;\r\n    \r\nin vec3 position;\r\nin vec3 normal;\r\nin vec2 uv;\r\n${instances ?\r\n`\r\nin mat4 world;\r\nin mat4 normalMatrix;\r\n` : `\r\nuniform mat4 world;\r\nuniform mat4 normalMatrix;\r\n`}\r\n\r\n\r\nuniform float time;\r\nuniform mat4 view;\r\nuniform mat4 projection;\r\n\r\n// Pass the color attribute down to the fragment shader\r\nout vec3 vertexColor;\r\nout vec3 vNormal;\r\nout vec3 vertex;\r\nout vec3 vViewPosition;\r\nout highp vec2 vUv;\r\n\r\n${declarations}\r\n\r\nvoid main() {\r\n    vec3 modifiedNormal = normal;\r\n    vec3 animatedPosition = position;\r\n    ${positionModifier}\r\n\r\n    vUv = vec3( uv, 1 ).xy;\r\n    // Pass the color down to the fragment shader\r\n    vertexColor = vec3(1.27,1.27,1.27);\r\n    // Pass the vertex down to the fragment shader\r\n    //vertex = vec3(world * vec4(position, 1.0));\r\n    vertex = vec3(world * vec4(animatedPosition, 1.0));\r\n    // Pass the normal down to the fragment shader\r\n    // todo : use modifiedNormal when effect is done\r\n    vNormal = vec3(normalMatrix * vec4(modifiedNormal , 1.0));\r\n    //vNormal = normal;\r\n    \r\n    // Pass the position down to the fragment shader\r\n    gl_Position = projection * view * world * vec4(animatedPosition, 1.0);\r\n    vViewPosition = -gl_Position.xyz;\r\n}";

var defaultFragment = "#version 300 es\r\nprecision mediump float;\r\n\r\n${defines}\r\n\r\n#define RECIPROCAL_PI 0.3183098861837907\r\n\r\nuniform vec3 diffuse;\r\nuniform float metalness;\r\nuniform vec3 ambientLightColor;\r\nuniform vec3 cameraPosition;\r\n//uniform mat3 normalMatrix;\r\n\r\nin vec3 vertex;\r\nin vec3 vNormal;\r\nin highp vec2 vUv;\r\nin vec3 vViewPosition;\r\n\r\nout vec4 fragColor;\r\n\r\nstruct ReflectedLight {\r\n\tvec3 directDiffuse;\r\n\tvec3 directSpecular;\r\n\tvec3 indirectDiffuse;\r\n\tvec3 indirectSpecular;\r\n};\r\n\r\nstruct PhysicalMaterial {\r\n\tvec3 diffuseColor;\r\n\tfloat roughness;\r\n\tvec3 specularColor;\r\n\tfloat specularF90;\r\n\tfloat ior;\r\n};\r\n\r\nvec3 BRDF_Lambert(const in vec3 diffuseColor) {\r\n\treturn RECIPROCAL_PI * diffuseColor;\r\n}\r\n\r\n\r\n${declarations}\r\n\r\nvec4 sRGBTransferOETF(in vec4 value) {\r\n\treturn vec4(mix(pow(value.rgb, vec3(0.41666)) * 1.055 - vec3(0.055), value.rgb * 12.92, vec3(lessThanEqual(value.rgb, vec3(0.0031308)))), value.a);\r\n}\r\n\r\nvec4 linearToOutputTexel(vec4 value) {\r\n\treturn (sRGBTransferOETF(value));\r\n}\r\n\r\nvoid main() {\r\n    PhysicalMaterial material;\r\n\tmaterial.diffuseColor = diffuse.rgb * (1.0 - metalness);\r\n\t${diffuseMapSample}\r\n\t\r\n\r\n\tvec3 normal = normalize( vNormal );\r\n\t${normalMapSample}\r\n\r\n    ReflectedLight reflectedLight = ReflectedLight(vec3(0.0), vec3(0.0), vec3(0.0), vec3(0.0));\r\n\r\n    reflectedLight.indirectDiffuse += ambientLightColor * BRDF_Lambert(material.diffuseColor);\r\n\r\n    vec3 totalIrradiance = vec3(0.0f);\r\n    ${irradiance}\r\n\tvec3 outgoingLight = reflectedLight.indirectDiffuse + reflectedLight.directDiffuse + reflectedLight.directSpecular;\r\n    fragColor = vec4(outgoingLight, 1.0f);\r\n    //fragColor = vec4(totalIrradiance, 1.0f);\r\n    ${toneMapping}\r\n\tfragColor = linearToOutputTexel(fragColor);\r\n}";

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

const degree$1 = Math.PI / 180;
/**
 * Convert Degree To Radian
 *
 * @param {Number} a Angle in Degrees
 */

function toRadian$1(a) {
	return a * degree$1;
}

function initRenderer$1(rendererContext, appContext) {
	return function () {
		console.log("initRenderer");

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
		gl.clearColor(...rendererContext.backgroundColor);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_COLOR_BIT);
		gl.enable(gl.DEPTH_TEST);
		gl.enable(gl.CULL_FACE);
		gl.frontFace(gl.CCW);
		gl.cullFace(gl.BACK);
		renderState$1.set({
			init: true,
		});
	};
}

function setupTime$1(context) {
	return function () {
		const contextValue = get_store_value(context);
		const gl = contextValue.gl;
		const program = contextValue.program;
		const timeLocation = gl.getUniformLocation(program, "time");
		gl.uniform1f(timeLocation, performance.now());
	};
}

function render$1(context, instances, drawMode) {
	return function () {
		const contextValue = get_store_value(context);
		/** @type {WebGL2RenderingContext} **/
		const gl = contextValue.gl;
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		contextValue.loop && contextValue.loop();
		// when using vertex array objects, you must bind it before rendering
		gl.bindVertexArray(contextValue.vao);
		console.log("drawMode", drawMode);
		if (instances) {
			gl.drawArraysInstanced(gl[drawMode], 0, contextValue.attributeLength, instances);
		} else {
			if (contextValue.hasElements) {
				gl.drawElements(gl[drawMode], contextValue.attributeLength, gl.UNSIGNED_SHORT, 0);
			} else {
				gl.drawArrays(gl[drawMode], 0, contextValue.attributeLength);
				//add mesh visualization (lines)
				//gl.drawArrays(gl.LINE_STRIP, 0, contextValue.attributeLength);
			}
		}
		// when binding vertex array objects you must unbind it after rendering
		gl.bindVertexArray(null);
	};
}

function createProgram$1(context) {
	return function createProgram() {
		context = get_store_value(context);
		if (context.program != null) {
			return;
		}
		const gl = context.gl;
		const program = gl.createProgram();
		context.program = program;
	};
}

function endProgramSetup(context) {
	return function () {
		context = get_store_value(context);
		/** @type {WebGL2RenderingContext} **/
		const gl = context.gl;
		const program = context.program;
		if (context.program === context.programUsed) {
			return;
		}
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			console.error("ERROR linking program!", gl.getProgramInfoLog(program));
		}
		gl.validateProgram(program);
		if (!gl.getProgramParameter(program, gl.VALIDATE_STATUS)) {
			console.error("ERROR validating program!", gl.getProgramInfoLog(program));
		}
		gl.useProgram(program);
		context.programUsed = program;
	};
}

function createShaders$1() {
	return function (context, mesh) {
		return function () {
			context = get_store_value(context);
			const gl = context.gl;
			const program = context.program;

			let vertexDeclarations = "";
			let vertexPositionModifiers = "";

			let vertexAnimationsDeclaration = "";
			let vertexAnimationsModifier = "";
			const vertexAnimationComponents = mesh.animations?.filter(({ type }) => type === "vertex");
			if (vertexAnimationComponents.length > 0) {
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
			//console.log(vertexShaderSource);
			const vertexShader = gl.createShader(gl.VERTEX_SHADER);
			gl.shaderSource(vertexShader, vertexShaderSource);
			gl.compileShader(vertexShader);
			if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
				console.error("ERROR compiling vertex shader!", gl.getShaderInfoLog(vertexShader));
			}
			let specularIrradiance = "";
			let specularDeclaration = "";
			if (mesh.material?.specular) {
				specularDeclaration = mesh.material.specular.shader({ declaration: true });
				specularIrradiance = mesh.material.specular.shader({ irradiance: true });
			}
			let diffuseMapDeclaration = "";
			let diffuseMapSample = "";
			if (mesh.material?.diffuseMap) {
				diffuseMapDeclaration = mesh.material.diffuseMap.shader({
					declaration: true,
					mapType: mesh.material.diffuseMap.type,
				});
				diffuseMapSample = mesh.material.diffuseMap.shader({
					diffuseMapSample: true,
					mapType: mesh.material.diffuseMap.type,
					coordinateSpace: mesh.material.diffuseMap.coordinateSpace,
				});
			}
			let normalMapDeclaration = "";
			let normalMapSample = "";
			if (mesh.material?.normalMap) {
				normalMapDeclaration = mesh.material.normalMap.shader({
					declaration: true,
					mapType: mesh.material.normalMap.type,
				});
				normalMapSample = mesh.material.normalMap.shader({
					normalMapSample: true,
					mapType: mesh.material.normalMap.type,
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
					...(context.numPointLights
						? {
								NUM_POINT_LIGHTS: context.numPointLights,
							}
						: undefined),
				}),
				declarations: [
					...(context.numPointLights ? [context.pointLightShader({ declaration: true, irradiance: false })] : []),
					...(context.toneMappings?.length > 0
						? [...context.toneMappings.map((tm) => tm.shader({ declaration: true, exposure: tm.exposure }))]
						: []),
					...(mesh.material?.specular ? [specularDeclaration] : []),
					...(mesh.material?.diffuseMap ? [diffuseMapDeclaration] : []),
					...(mesh.material?.normalMap ? [normalMapDeclaration] : []),
				].join("\n"),
				diffuseMapSample,
				normalMapSample,
				irradiance: [
					...(context.numPointLights
						? [context.pointLightShader({ declaration: false, irradiance: true, specularIrradiance })]
						: []),
				].join("\n"),
				toneMapping: [
					...(context.toneMappings?.length > 0 ? [...context.toneMappings.map((tm) => tm.shader({ color: true }))] : []),
				].join("\n"),
				//todo, remove this after decoupling the point light shader
				numPointLights: context.numPointLights,
			});
			const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
			gl.shaderSource(fragmentShader, fragmentShaderSource);
			//console.log(fragmentShaderSource);
			gl.compileShader(fragmentShader);
			if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
				console.error("ERROR compiling fragment shader!", gl.getShaderInfoLog(fragmentShader));
			}
			gl.attachShader(program, vertexShader);
			gl.attachShader(program, fragmentShader);
		};
	};
}

function setupMeshColor$1(context, { diffuse, metalness }) {
	return function () {
		context = get_store_value(context);
		const gl = context.gl;
		const program = context.program;
		const colorLocation = gl.getUniformLocation(program, "diffuse");
		gl.uniform3fv(colorLocation, new Float32Array(diffuse.map(SRGBToLinear)));
		const metalnessLocation = gl.getUniformLocation(program, "metalness");
		gl.uniform1f(metalnessLocation, metalness);
	};
}

function setupAmbientLight$1(context, ambientLightColor) {
	return function () {
		context = get_store_value(context);
		const { gl, program } = context;
		const ambientLightColorLocation = gl.getUniformLocation(program, "ambientLightColor");
		gl.uniform3fv(ambientLightColorLocation, new Float32Array(ambientLightColor));
	};
}

function setupCamera$1(context, camera) {
	return function createCamera() {
		context = get_store_value(context);
		const gl = context.gl;
		const program = context.program;
		// projection matrix
		const projectionLocation = gl.getUniformLocation(program, "projection");

		const fieldOfViewInRadians = toRadian$1(camera.fov);
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

		const cameraPositionLocation = gl.getUniformLocation(program, "cameraPosition");
		gl.uniform3fv(cameraPositionLocation, camera.position);
	};
}

function setupTransformMatrix$1(context, transformMatrix, numInstances) {
	if (numInstances == null) {
		return function createTransformMatrix() {
			context = get_store_value(context);
			const gl = context.gl;
			const program = context.program;
			if (!transformMatrix) {
				transformMatrix = new Float32Array(16);
				identity(transformMatrix);
			}
			context.transformMatrix = transformMatrix;
			const worldLocation = gl.getUniformLocation(program, "world");
			gl.uniformMatrix4fv(worldLocation, false, transformMatrix);
		};
	} else {
		return function createTransformMatrices() {
			const attributeName = "world";
			/** @type {{gl: WebGL2RenderingContext}} **/
			context = get_store_value(context);
			const { gl, program, vao } = context;

			const transformMatricesWindows = (context.transformMatricesWindows = context.transformMatricesWindows || []);

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
			//context.transformMatrix = transformMatricesWindows;
			gl.bindVertexArray(vao);
			const matrixBuffer = gl.createBuffer();
			context.matrixBuffer = matrixBuffer;
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
function updateTransformMatrix(context, worldMatrix) {
	context = get_store_value(context);
	const gl = context.gl;
	const program = context.program;
	const worldLocation = gl.getUniformLocation(program, "world");
	gl.uniformMatrix4fv(worldLocation, false, worldMatrix);
}

function updateInstanceTransformMatrix(context, worldMatrix, instanceIndex) {
	context = get_store_value(context);
	/** @type{{gl:WebGL2RenderingContext}} **/
	const { gl, program, vao, matrixBuffer } = context;
	gl.bindVertexArray(vao);
	gl.bindBuffer(gl.ARRAY_BUFFER, matrixBuffer);
	const bytesPerMatrix = 4 * 16;
	gl.bufferSubData(gl.ARRAY_BUFFER, instanceIndex * bytesPerMatrix, worldMatrix);
	gl.bindVertexArray(null);
}

function setupNormalMatrix$1(context, numInstances) {
	if (numInstances == null) {
		return function createNormalMatrix() {
			/** @type{{gl:WebGL2RenderingContext}} **/
			const { gl, program, transformMatrix } = get_store_value(context);
			const normalMatrixLocation = gl.getUniformLocation(program, "normalMatrix");
			context.normalMatrixLocation = normalMatrixLocation;
			gl.uniformMatrix4fv(normalMatrixLocation, false, derivateNormalMatrix$1(transformMatrix));
		};
	} else {
		return function createNormalMatrices() {
			context = get_store_value(context);
			/** @type{{gl:WebGL2RenderingContext}} **/
			const { gl, program, transformMatrix, vao, transformMatricesWindows } = context;
			gl.bindVertexArray(vao);
			const normalMatricesLocation = gl.getAttribLocation(program, "normalMatrix");
			const normalMatricesValues = [];

			for (let i = 0; i < numInstances; i++) {
				normalMatricesValues.push(...derivateNormalMatrix$1(transformMatricesWindows[i]));
			}
			const normalMatrices = new Float32Array(normalMatricesValues);
			const normalMatrixBuffer = gl.createBuffer();
			context.normalMatrixBuffer = normalMatrixBuffer;
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

function updateNormalMatrix({ gl, program }, normalMatrix) {
	const normalMatrixLocation = gl.getUniformLocation(program, "normalMatrix");
	gl.uniformMatrix4fv(normalMatrixLocation, false, normalMatrix);
}

function updateInstanceNormalMatrix({ gl, program, vao, normalMatrixBuffer }, normalMatrix, instanceIndex) {
	gl.bindVertexArray(vao);
	gl.bindBuffer(gl.ARRAY_BUFFER, normalMatrixBuffer);
	const bytesPerMatrix = 4 * 16;
	gl.bufferSubData(gl.ARRAY_BUFFER, instanceIndex * bytesPerMatrix, normalMatrix);
	gl.bindVertexArray(null);
}

function derivateNormalMatrix$1(transformMatrix) {
	const normalMatrix = create();
	invert(normalMatrix, transformMatrix);
	transpose(normalMatrix, normalMatrix);
	return normalMatrix;
}

function getBuffer$1(variable) {
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

function setupAttributes$1(context, mesh) {
	return function () {
		context = get_store_value(context);
		/** @type {WebGL2RenderingContext} **/
		const gl = context.gl;
		const program = context.program;
		context.attributeLength = mesh.attributes.elements
			? mesh.attributes.elements.length
			: mesh.attributes.positions.length / 3;

		const { positions, normals, elements, uvs } = mesh.attributes;
		const vao = (context.vao = gl.createVertexArray());
		gl.bindVertexArray(vao);
		const {
			data: positionsData,
			interleaved: positionsInterleaved,
			byteStride: positionsByteStride,
			byteOffset: positionsByteOffset,
		} = getBuffer$1(positions);
		//position
		const positionBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, positionsData, gl.STATIC_DRAW);
		const positionLocation = gl.getAttribLocation(program, "position");
		gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer); //todo check if redundant
		gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, positionsByteStride, positionsByteOffset);
		gl.enableVertexAttribArray(positionLocation);
		//normal
		const {
			data: normalsData,
			interleaved: normalsInterleaved,
			byteStride: normalsByteStride,
			byteOffset: normalsByteOffset,
		} = getBuffer$1(normals);
		if (!normalsInterleaved) {
			const normalBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, normalsData, gl.STATIC_DRAW);
			gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer); //todo check if redundant
		}
		const normalLocation = gl.getAttribLocation(program, "normal");
		gl.vertexAttribPointer(normalLocation, 3, gl.FLOAT, false, normalsByteStride, normalsByteOffset);
		gl.enableVertexAttribArray(normalLocation);
		if (mesh.attributes.elements) {
			context.hasElements = true;
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
			gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
			gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 0, 0);
			gl.enableVertexAttribArray(uvLocation);
		}

		gl.bindVertexArray(null);
	};
}

function createRenderer$1() {
	const { subscribe, set, update } = writable({
		backgroundColor: [2.55, 2.55, 2.55, 1],
		canvas: null,
		camera: null,
		meshes: [],
		lights: [],
		toneMappings: [],
		loop: null,
		enabled: false,
		ambientLightColor: [0, 0, 0],
	});
	return {
		subscribe,
		setCamera: (...rest) => {
			updateCamera(...rest);
			return {
				set: (...rest) => {
					updateCamera(...rest);
					setupCamera$1(appContext$1, get_store_value(renderer$1).camera)();
				},
				get: () => {
					return get_store_value(renderer$1).camera;
				},
			};
			function updateCamera(
				position = [0, 0, -1],
				target = [0, 0, 0],
				fov = 80,
				near = 0.1,
				far = 1000,
				up = [0, 1, 0],
				matrix = null,
			) {
				update((renderer) => {
					renderer.camera = {
						fov,
						near,
						far,
						position,
						target,
						up,
						matrix,
					};
					return renderer;
				});
			}
		},

		addMesh: (mesh) => {
			const index = get_store_value(renderer$1).meshes.length;

			if (mesh.instances && mesh.instances > 1) {
				var { matrices, unsubs } = new Array(mesh.instances).fill().reduce(
					(acc, curr, instanceIndex) => {
						const { transformMatrix, unsubNormalMatrix } = createMeshMatricesStore(
							update,
							index,
							instanceIndex,
							mesh.matrices[instanceIndex],
						);
						acc.matrices.push(transformMatrix);
						acc.unsubs.push(unsubNormalMatrix);
						return acc;
					},
					{ matrices: [], unsubs: [] },
				);
			} else {
				var { transformMatrix, unsubNormalMatrix } = createMeshMatricesStore(update, index, null, mesh.transformMatrix);
			}
			mesh.material = {
				metalness: 0,
				...mesh.material,
			};
			const meshWithMatrix = {
				...mesh,
				...(matrices ? { matrices, unsubs } : { transformMatrix }),
				unsub: () => {
					if (matrices) {
						unsubs.forEach((unsub) => unsub());
					} else {
						unsubNormalMatrix();
					}
				},
				animations: [],
			};
			update((renderer) => {
				renderer.meshes = [...renderer.meshes, meshWithMatrix];
				return renderer;
			});
			return meshWithMatrix;
		},
		removeMesh: (mesh) => {
			update((renderer) => {
				renderer.meshes = renderer.meshes.filter((m) => m !== mesh);
				return renderer;
			});
			mesh.unsub();
		},
		setAmbientLight: (color, intensity) => {
			update((renderer) => {
				renderer.ambientLightColor = convertToVector3(color).map((c) => c * intensity);
				return renderer;
			});
		},
		addLight: (light) => {
			const index = get_store_value(renderer$1).lights.length;
			const store = createLightStore$1(update, light, index);
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
				set: store.set,
			};
		},
		addToneMapping: (toneMapping) =>
			update((renderer) => {
				renderer.toneMappings = [...renderer.toneMappings, toneMapping];
				return renderer;
			}),
		addAnimation: (mesh, animation) =>
			update((renderer) => {
				renderer.meshes = renderer.meshes.map((m) => {
					if (m === mesh) {
						m.animations.push(animation);
					}
					return m;
				});
				return renderer;
			}),
		setLoop: (loop) =>
			update((renderer) => {
				renderer.loop = loop;
				return renderer;
			}),
		setCanvas: (canvas) =>
			update((renderer) => {
				renderer.canvas = canvas;
				return renderer;
			}),
		setBackgroundColor: (backgroundColor) => {
			backgroundColor = [...convertToVector3(backgroundColor), 1];
			update((renderer) => {
				renderer.backgroundColor = backgroundColor;
				return renderer;
			});
		},
		start: () =>
			update((renderer) => {
				renderer.enabled = true;
				return renderer;
			}),
		stop: () =>
			update((renderer) => {
				renderer.enabled = false;
				return renderer;
			}),
	};
}

const createLightStore$1 = (parentStoreUpdate, initialProps, lightIndex) => {
	const store = writable(initialProps);
	const { subscribe, set, update } = store;
	const customStore = {
		subscribe,
		set: (props) => {
			update((prev) => {
				if (appContext$1 && get_store_value(appContext$1).program) {
					prev.updateOneLight(appContext$1, get_store_value(renderer$1).lights, customStore);
				}
				return { ...prev, ...props };
			});
			parentStoreUpdate((renderer) => {
				renderer.lights[lightIndex] = customStore;
				return renderer;
			});
		},
	};
	return customStore;
};

const renderer$1 = createRenderer$1();

const defaultWorldMatrix = new Float32Array(16);
identity(defaultWorldMatrix);

const createMeshMatricesStore = (parentStoreUpdate, meshIndex, instanceIndex, initialValue) => {
	const { subscribe, set } = writable(initialValue || defaultWorldMatrix);
	const transformMatrix = {
		subscribe,
		set: (matrix) => {
			set(matrix);
			if (appContext$1 && get_store_value(appContext$1).program) {
				// in case of a single program app, let's update the uniform only and draw the single program
				if (get_store_value(programs$1).length === 1) {
					if (instanceIndex == null) {
						updateTransformMatrix(appContext$1, matrix);
					} else {
						updateInstanceTransformMatrix(appContext$1, matrix, instanceIndex);
					}
					// update the store to trigger the render
					parentStoreUpdate((renderer) => {
						renderer.meshes[meshIndex].transformMatrix = matrix;
						return renderer;
					});
				} // in case of a multi program app, we need to setup and draw the programs
				else {
					renderState$1.set({ init: false });
				}
			}
			return matrix;
		},
	};
	const normalMatrixStore = derived(transformMatrix, ($transformMatrix) => {
		const context = get_store_value(appContext$1);
		if (!context.gl) {
			return;
		}
		const normalMatrix = derivateNormalMatrix$1($transformMatrix);
		if (instanceIndex == null) {
			updateNormalMatrix(context, normalMatrix);
		} else {
			updateInstanceNormalMatrix(context, normalMatrix, instanceIndex);
		}
		return normalMatrix;
	});
	const unsubNormalMatrix = normalMatrixStore.subscribe(() => {});
	return {
		transformMatrix,
		unsubNormalMatrix,
	};
};

const programs$1 = derived(renderer$1, ($renderer) => {
	//create a list of unique materials used in meshes
	const materials = new Set($renderer.meshes.map((mesh) => mesh.material));
	//each program will setup one material and list meshes that use it
	return Array.from(materials).map((material) => {
		const meshes = $renderer.meshes.filter((mesh) => mesh.material === material);
		return {
			createProgram: createProgram$1(material),
			meshes,
			createShaders: createShaders$1(),
			endProgramSetup,
		};
	});

	/*return $renderer.meshes.map((mesh) => {
		return {
			createProgram,
			mesh,
			attributes: mesh.attributes,
			createShaders: createShaders(),
			endProgramSetup,
		};
	});*/
});

const renderState$1 = writable({
	init: false,
});

const appContext$1 = writable({});

/*
Single program apps (one mesh/material) will not need to setup the program again
but multi program apps require to setup the program before rendering if the last changes
affect a program that is not the last one rendered. because the last one rendered is still mounted / in memory of the GPU
this store will be used to know if we need to setup the program before rendering again
todo : map existing compiled programs and decouple draw passes from program creation or setup
*/
const lastProgramRendered = writable(null);

const emptyApp$1 = [];
const webglapp$1 = derived(
	[renderer$1, programs$1],
	([$renderer, $programs]) => {
		// if renderer.enabled is false, the scene is being setup, we should not render
		// if running is 4, we let the loop run completly as a way to batch scene updates
		if (!$renderer.enabled || get_store_value(running$1) === 4) {
			//log("webglapp not ready");
			return emptyApp$1;
		}

		const numPointLights = $renderer.lights.filter((l) => get_store_value(l).type === "point").length;
		const pointLightShader = get_store_value($renderer.lights.find((l) => get_store_value(l).type === "point")).shader;
		const requireTime = $programs.some((program) => program.mesh.animations?.some((animation) => animation.requireTime));

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

		appContext$1.update((appContext) => ({
			...appContext,
			...rendererContext,
		}));

		!get_store_value(renderState$1).init && list.push(initRenderer$1(rendererContext, appContext$1));
		!get_store_value(renderState$1).init &&
			list.push(
				...$programs.reduce((acc, program) => {
					lastProgramRendered.set(program);
					const animationsSetups = program.mesh.animations?.map((animation) => animation.setupAnimation(appContext$1)) || [];
					return [
						...acc,
						program.createProgram(appContext$1),
						program.createShaders(appContext$1, program.mesh),
						program.endProgramSetup(appContext$1),
						setupCamera$1(appContext$1, $renderer.camera),
						setupAmbientLight$1(appContext$1, $renderer.ambientLightColor),
						...(program.mesh.material ? [setupMeshColor$1(appContext$1, program.mesh.material)] : []),
						...(program.mesh.material?.diffuseMap ? [program.mesh.material?.diffuseMap.setupTexture(appContext$1)] : []),
						...(program.mesh.material?.normalMap ? [program.mesh.material?.normalMap.setupTexture(appContext$1)] : []),
						setupAttributes$1(appContext$1, program.mesh),
						...(program.mesh?.material?.specular ? [program.mesh.material.specular.setupSpecular(appContext$1)] : []),
						setupTransformMatrix$1(
							appContext$1,
							program.mesh.instances == null ? get_store_value(program.mesh.transformMatrix) : program.mesh.matrices,
							program.mesh.instances,
						),
						...animationsSetups,
						setupNormalMatrix$1(appContext$1, program.mesh.instances),
						// reduce by type to setup lights once per type
						...[
							...$renderer.lights.reduce((acc, light) => {
								const lightValue = get_store_value(light);
								acc.set(lightValue.type, lightValue.setupLights);
								return acc;
							}, new Map()),
						].map(([_, setupLights]) => setupLights(appContext$1, $renderer.lights)),
						...(requireTime ? [setupTime$1(appContext$1)] : []),
						render$1(appContext$1, $programs[0].mesh.instances, $programs[0].mesh.drawMode),
					];
				}, []),
			);

		return list;
	},
	emptyApp$1,
);

/**
 * running states
 * 0 : not started
 * 1 : init currently running
 * 2 : init done, waiting for start
 * 3 : loop requested, ready to run									<---|
 * 																		|---- end state occilates between 3 and 4
 * 4 : loop currently running, renderer updates ignored momentarily	<---|
 */
const running$1 = writable(0);
const renderLoopStore$1 = derived([webglapp$1], ([$webglapp]) => {
	if ($webglapp.length === 0) {
		return 0;
	}
	if (!get_store_value(renderState$1).init && get_store_value(running$1) === 0) {
		running$1.set(1);
		$webglapp.forEach((f) => f());
		running$1.set(2);
		return 1;
	} else if (get_store_value(running$1) === 2) {
		running$1.set(3);
		requestAnimationFrame(loop);
		return 2;
	}
	async function loop() {
		// skipping this iteration is previous one not finished
		if (get_store_value(running$1) !== 4) {
			running$1.set(4);
			get_store_value(renderer$1).loop && get_store_value(renderer$1).loop();
			$webglapp.forEach((f) => f());
			running$1.set(3);
		}
		requestAnimationFrame(loop);
	}
});

renderLoopStore$1.subscribe((value) => {
	console.log("render loop store subscribed", value);
});

const degree = Math.PI / 180;
/**
 * Convert Degree To Radian
 *
 * @param {Number} a Angle in Degrees
 */

function toRadian(a) {
	return a * degree;
}

function initRenderer(rendererContext, appContext) {
	return function initRenderer() {
		console.log("initRenderer");
		const canvasRect = rendererContext.canvas.getBoundingClientRect();
		rendererContext.canvas.width = canvasRect.width;
		rendererContext.canvas.height = canvasRect.height;
		/** @type {WebGL2RenderingContext} */
		const gl = (rendererContext.gl = rendererContext.canvas.getContext("webgl2"));
		appContext.update((appContext) => ({
			...appContext,
			...rendererContext,
		}));
		gl.viewportWidth = rendererContext.canvas.width;
		gl.viewportHeight = rendererContext.canvas.height;
		gl.clearColor(...rendererContext.backgroundColor);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_COLOR_BIT);
		gl.enable(gl.DEPTH_TEST);
		gl.enable(gl.CULL_FACE);
		gl.frontFace(gl.CCW);
		gl.cullFace(gl.BACK);
		/*renderState.set({
			init: true,
		});*/
		console.log("initRenderer done", get_store_value(renderState$1));
	};
}

function setupTime(context) {
	return function () {
		const contextValue = get_store_value(context);
		const gl = contextValue.gl;
		const program = contextValue.program;
		const timeLocation = gl.getUniformLocation(program, "time");
		gl.uniform1f(timeLocation, performance.now());
	};
}

function render(context, instances, drawMode) {
	return function render() {
		const contextValue = get_store_value(context);
		/** @type {WebGL2RenderingContext} **/
		const gl = contextValue.gl;
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		contextValue.loop && contextValue.loop();
		// when using vertex array objects, you must bind it before rendering
		//gl.bindVertexArray(contextValue.vao);
		console.log("Draw drawMode", drawMode);
		if (instances) {
			gl.drawArraysInstanced(gl[drawMode], 0, contextValue.attributeLength, instances);
		} else {
			if (contextValue.hasElements) {
				gl.drawElements(gl[drawMode], contextValue.attributeLength, gl.UNSIGNED_SHORT, 0);
			} else {
				gl.drawArrays(gl[drawMode], 0, contextValue.attributeLength);
				//add mesh visualization (lines)
				//gl.drawArrays(gl.LINE_STRIP, 0, contextValue.attributeLength);
			}
		}
		// when binding vertex array objects you must unbind it after rendering
		gl.bindVertexArray(null);
	};
}

function bindVAO(context, mesh) {
	return function bindVAO() {
		const contextValue = get_store_value(context);
		const gl = contextValue.gl;
		contextValue.vao;
		gl.bindVertexArray(contextValue.vao);
	};
}

function createProgram(context, programStore) {
	return function createProgram() {
		const contextValue = get_store_value(context);
		/*if (context.program != null) {
			return;
		}*/
		const gl = contextValue.gl;
		const program = gl.createProgram();

		contextValue.programMap.set(programStore, program);
		context.update((context) => {
			console.log("createProgram context update");

			return {
				...contextValue,
				program,
			};
		});
	};
}

function linkProgram(context) {
	return function linkProgram() {
		const contextValue = get_store_value(context);
		/** @type {WebGL2RenderingContext} **/
		const gl = contextValue.gl;
		const program = contextValue.program;
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			console.error("ERROR linking program!", gl.getProgramInfoLog(program));
		}
	};
}

function validateProgram(context) {
	return function validateProgram() {
		const contextValue = get_store_value(context);
		/** @type {WebGL2RenderingContext} **/
		const gl = contextValue.gl;
		const program = contextValue.program;

		gl.validateProgram(program);
		if (!gl.getProgramParameter(program, gl.VALIDATE_STATUS)) {
			console.error("ERROR validating program!", gl.getProgramInfoLog(program));
		}
	};
}

function useProgram(context) {
	return function useProgram() {
		const contextValue = get_store_value(context);
		/** @type {WebGL2RenderingContext} **/
		const gl = contextValue.gl;
		const program = contextValue.program;
		gl.useProgram(program);
	};
}

function createShaders() {
	return function createShaders(context, material, meshes) {
		return function createShaders() {
			const contextValue = get_store_value(context);
			const gl = contextValue.gl;
			const program = contextValue.program;

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
					...(contextValue.numPointLights
						? {
								NUM_POINT_LIGHTS: contextValue.numPointLights,
							}
						: undefined),
				}),
				declarations: [
					...(contextValue.numPointLights ? [contextValue.pointLightShader({ declaration: true, irradiance: false })] : []),
					...(contextValue.toneMappings?.length > 0
						? [...contextValue.toneMappings.map((tm) => tm.shader({ declaration: true, exposure: tm.exposure }))]
						: []),
					...(material.specular ? [specularDeclaration] : []),
					...(material.diffuseMap ? [diffuseMapDeclaration] : []),
					...(material.normalMap ? [normalMapDeclaration] : []),
				].join("\n"),
				diffuseMapSample,
				normalMapSample,
				irradiance: [
					...(contextValue.numPointLights
						? [contextValue.pointLightShader({ declaration: false, irradiance: true, specularIrradiance })]
						: []),
				].join("\n"),
				toneMapping: [
					...(contextValue.toneMappings?.length > 0
						? [...contextValue.toneMappings.map((tm) => tm.shader({ color: true }))]
						: []),
				].join("\n"),
				//todo, remove this after decoupling the point light shader
				numPointLights: contextValue.numPointLights,
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
	};
}

function setupMeshColor(context, { diffuse, metalness }) {
	return function setupMeshColor() {
		const contextValue = get_store_value(context);
		const gl = contextValue.gl;
		const program = contextValue.program;
		const colorLocation = gl.getUniformLocation(program, "diffuse");
		gl.uniform3fv(colorLocation, new Float32Array(diffuse.map(SRGBToLinear)));
		const metalnessLocation = gl.getUniformLocation(program, "metalness");
		gl.uniform1f(metalnessLocation, metalness);
	};
}

function setupAmbientLight(context, ambientLightColor) {
	return function setupAmbientLight() {
		const contextValue = get_store_value(context);
		const { gl, program } = contextValue;
		const ambientLightColorLocation = gl.getUniformLocation(program, "ambientLightColor");
		gl.uniform3fv(ambientLightColorLocation, new Float32Array(ambientLightColor));
	};
}

function setupCamera(context, camera) {
	return function createCamera() {
		const contextValue = get_store_value(context);
		const gl = contextValue.gl;
		const program = contextValue.program;
		// projection matrix
		const projectionLocation = gl.getUniformLocation(program, "projection");

		const fieldOfViewInRadians = toRadian(camera.fov);
		const aspectRatio = contextValue.canvas.width / contextValue.canvas.height;
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

		const cameraPositionLocation = gl.getUniformLocation(program, "cameraPosition");
		gl.uniform3fv(cameraPositionLocation, camera.position);
	};
}

function setupTransformMatrix(context, transformMatrix, numInstances) {
	if (numInstances == null) {
		return function createTransformMatrix() {
			const contextValue = get_store_value(context);
			const gl = contextValue.gl;
			const program = contextValue.program;
			if (!transformMatrix) {
				transformMatrix = new Float32Array(16);
				identity(transformMatrix);
			}
			context.update((context) => ({
				...context,
				transformMatrix,
			}));
			const worldLocation = gl.getUniformLocation(program, "world");
			gl.uniformMatrix4fv(worldLocation, false, transformMatrix);
		};
	} else {
		return function createTransformMatrices() {
			const attributeName = "world";
			/** @type {{gl: WebGL2RenderingContext}} **/
			const contextValue = get_store_value(context);
			const { gl, program, vao } = contextValue;

			//TODO, clean that it's useless since we overwrite it anyway and storing this way is not good
			let transformMatricesWindows;
			if ((contextValue.transformMatricesWindows = null)) {
				transformMatricesWindows = [];
			} else {
				transformMatricesWindows = contextValue.transformMatricesWindows;
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
			//context.transformMatrix = transformMatricesWindows;
			gl.bindVertexArray(vao);
			const matrixBuffer = gl.createBuffer();
			context.update((context) => ({
				...context,
				matrixBuffer,
				transformMatricesWindows,
			}));
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

function setupNormalMatrix(context, numInstances) {
	if (numInstances == null) {
		return function createNormalMatrix() {
			/** @type{{gl:WebGL2RenderingContext}} **/
			const { gl, program, transformMatrix } = get_store_value(context);
			const normalMatrixLocation = gl.getUniformLocation(program, "normalMatrix");
			/*
			//TODO check why we need this
			context.update((context) => ({
				...context,
				normalMatrixLocation,
			}));
			*/
			gl.uniformMatrix4fv(normalMatrixLocation, false, derivateNormalMatrix(transformMatrix));
		};
	} else {
		return function createNormalMatrices() {
			const contextValue = get_store_value(context);
			/** @type{{gl:WebGL2RenderingContext}} **/
			const { gl, program, transformMatrix, vao, transformMatricesWindows } = contextValue;
			gl.bindVertexArray(vao);
			const normalMatricesLocation = gl.getAttribLocation(program, "normalMatrix");
			const normalMatricesValues = [];

			for (let i = 0; i < numInstances; i++) {
				normalMatricesValues.push(...derivateNormalMatrix(transformMatricesWindows[i]));
			}
			const normalMatrices = new Float32Array(normalMatricesValues);
			const normalMatrixBuffer = gl.createBuffer();
			context.update((context) => ({
				...context,
				normalMatrixBuffer,
			}));
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
	const normalMatrix = create();
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

function setupAttributes(context, mesh) {
	return function setupAttributes() {
		const contextValue = get_store_value(context);
		/** @type {WebGL2RenderingContext} **/
		const gl = contextValue.gl;
		const program = contextValue.program;
		const contextChanges = {
			...contextValue,
		};
		contextChanges.attributeLength = mesh.attributes.elements
			? mesh.attributes.elements.length
			: mesh.attributes.positions.length / 3;

		const { positions, normals, elements, uvs } = mesh.attributes;
		let vao;
		if (contextValue.vao) {
			vao = contextValue.vao;
		} else {
			vao = gl.createVertexArray();
			contextChanges.vao = vao;
		}
		contextChanges.meshMap.set(mesh, vao);
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
		gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, positionsByteStride, positionsByteOffset);
		gl.enableVertexAttribArray(positionLocation);
		//normal
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
		gl.vertexAttribPointer(normalLocation, 3, gl.FLOAT, false, normalsByteStride, normalsByteOffset);
		gl.enableVertexAttribArray(normalLocation);
		if (mesh.attributes.elements) {
			contextChanges.hasElements = true;
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
			gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
			gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 0, 0);
			gl.enableVertexAttribArray(uvLocation);
		}

		gl.bindVertexArray(null);
		context.set(contextChanges);
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
	let cache = initialValue;
	let processed = new Map();
	const store = writable(initialValue);
	const { subscribe, update } = store;
	const revisionStore = writable(0);

	/**
	 * Update function can update uniforms and other values directly
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
			//getting revision value from cache prevents revision tampering
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

	function getProcessed() {
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
	}

	//specific on change handling, might be useless
	function customSet(next) {
		customUpdate((renderer) => next);
	}

	return {
		subscribe,
		set: customSet,
		update: customUpdate,
		getProcessed,
		get revision() {
			return get_store_value(revisionStore);
		},
	};
}

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
			//console.log("camera update");
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

const programs = derived([meshes, materials], ([$meshes, $materials]) => {
	let programs = Array.from($materials);

	//this sublist mesh items require their own respective program (shader)
	const specialMeshes = new Set(
		$meshes.filter((node) => node.instances > 1 || node.animations?.some((a) => a.type === "vertex")),
	);

	programs = programs.reduce((acc, current) => {
		const materialMeshes = $meshes.filter((node) => node.material === current);
		const withoutSpecialMeshes = materialMeshes.filter((node, index) => {
			if (!specialMeshes.has(node)) {
				materialMeshes.splice(index, 1);
				return true;
			}
			return false;
		});
		if (withoutSpecialMeshes.length > 0) {
			acc.push({
				material: current,
				meshes: withoutSpecialMeshes,
			});
		}
		const currentSpecialMeshes = materialMeshes.filter((node) => specialMeshes.has(node));
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
	return programs.map((p) => ({
		...p,
		createProgram,
		createShaders: createShaders(),
		linkProgram,
		validateProgram,
		useProgram,
	}));
});

const renderState = writable({
	init: false,
});

function isStore(obj) {
	return obj != null && obj.subscribe != null;
}

function selectProgram(appContext, program) {
	return function selectProgram() {
		const { programMap } = get_store_value(appContext);
		const cachedProgram = programMap.get(program);
		appContext.update((appContext) => ({
			...appContext,
			program: cachedProgram,
		}));
	};
}

function selectMesh(appContext, mesh) {
	return function selectMesh() {
		const { meshMap } = get_store_value(appContext);
		const cachedVAO = meshMap.get(mesh);
		appContext.update((appContext) => ({
			...appContext,
			vao: cachedVAO,
		}));
	};
}

const appContext = writable({
	programMap: new Map(),
	meshMap: new Map(),
});

const emptyApp = [];
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

const webglapp = derived(
	[renderer, programs, scene, camera, running],
	([$renderer, $programs, $scene, $camera, $running]) => {
		// if renderer.enabled is false, the scene is being setup, we should not render
		// if running is 4, we let the loop run completly as a way to batch scene updates
		if (!$renderer.enabled || $running === 4 || $running === 1) {
			console.log("webglapp update cancelled");
			//TODO maybe throw here to cancel the update flow
			return emptyApp;
		}
		console.log("webglapp derived", $running);
		get_store_value(renderer);
		renderer.revision;
		get_store_value(camera);
		camera.revision;
		get_store_value(scene);
		scene.revision;
		// this map will tell you which stores have been updated since last updated() call
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
		const lights = $scene.filter(isStore).filter(isLight);

		const pointLights = lights.filter((l) => get_store_value(l).type === "point");
		const numPointLights = pointLights.length;
		let pointLightShader;
		if (numPointLights > 0) {
			pointLightShader = get_store_value(pointLights[0]).shader;
		}
		//this is moved into program items as p.requireTime prop to handle inside the program loop
		/*const requireTime = $programs.some((p) =>
			p.meshes.some(m => m.animations
				?.some((animation) => animation.requireTime)));*/
		const rendererValues = renderer.getProcessed();
		let rendererContext = {
			canvas: $renderer.canvas,
			backgroundColor: rendererValues.backgroundColor,
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
		const renderPipeline = [];

		appContext.update((appContext) => ({
			...appContext,
			...rendererContext,
		}));

		const init = get_store_value(renderState).init;
		if (!init) {
			renderPipeline.push(initRenderer(rendererContext, appContext));
		}
		/*!init &&*/
		renderPipeline.push(
			...$programs.reduce((acc, program) => {
				//console.log("program", program);
				//console.log("appContext", get(appContext));

				return [
					...acc,
					...(get_store_value(appContext).programMap.has(program)
						? [
								selectProgram(appContext, program),
								program.useProgram(appContext),
								...(updateMap.has(camera) ? [setupCamera(appContext, $camera)] : []),
							]
						: [
								program.createProgram(appContext, program),
								program.createShaders(appContext, program.material, program.meshes),
								program.linkProgram(appContext),
								program.validateProgram(appContext),
								program.useProgram(appContext),
								setupCamera(appContext, $camera),
								setupAmbientLight(appContext, rendererValues.ambientLightColor),
								...[
									...lights.reduce((acc, light) => {
										const lightValue = get_store_value(light);
										acc.set(lightValue.type, lightValue.setupLights);
										return acc;
									}, new Map()),
								].map(([_, setupLights]) => setupLights(appContext, lights)),
								...(program.material?.specular ? [program.material.specular.setupSpecular(appContext)] : []),
								...(program.material?.diffuseMap ? [program.mesh.material?.diffuseMap.setupTexture(appContext)] : []),
								...(program.material?.normalMap ? [program.material?.normalMap.setupTexture(appContext)] : []),
								...(program.requireTime ? [setupTime(appContext)] : []),
							]),

					...program.meshes.reduce(
						(acc, mesh) => [
							...acc,
							...(get_store_value(appContext).meshMap.has(mesh)
								? [
										selectMesh(appContext, mesh),
										//setupMeshColor(appContext, program.material),// is it necessary ?multiple meshes only render with same material so same color
										...(mesh.instances == null
											? [setupTransformMatrix(appContext, get_store_value(mesh.transformMatrix)), setupNormalMatrix(appContext)]
											: []),
									]
								: [
										setupAttributes(appContext, mesh),
										setupMeshColor(appContext, program.material),

										setupTransformMatrix(
											appContext,
											mesh.instances == null ? get_store_value(mesh.transformMatrix) : mesh.matrices,
											mesh.instances,
										),
										setupNormalMatrix(appContext, mesh.instances),
										...(mesh.animations?.map((animation) => animation.setupAnimation(appContext)) || []),
										// reduce by type to setup lights once per type
									]),
							bindVAO(appContext),
							render(appContext, mesh.instances, mesh.drawMode),
						],
						[],
					),
				];
			}, []),
		);
		console.log("renderPipeline", renderPipeline.length, renderPipeline);

		return renderPipeline;
	},
	emptyApp,
);

const renderLoopStore = derived([webglapp], ([$webglapp]) => {
	if ($webglapp.length === 0) {
		//console.log("renderLoopStore update cancelled");
		return 0;
	}
	if (!get_store_value(renderState).init && get_store_value(running) === 0) {
		running.set(1);
		$webglapp.forEach((f) => f());
		renderState.set({
			init: true,
		});
		running.set(2);
		//console.log("renderLoopStore finish init");
		return 1;
	} else if (get_store_value(running) === 2) {
		running.set(3);
		requestAnimationFrame(loop);
		//console.log("renderLoopStore starting loop");
		return 2;
	}
	//console.log("renderLoopStore none", get(running), get(renderState).init);

	async function loop() {
		// skipping this iteration is previous one not finished
		if (get_store_value(running) !== 4) {
			console.log("renderLoopStore loop start", get_store_value(webglapp).length);

			running.set(4);
			get_store_value(renderer).loop && get_store_value(renderer).loop();
			running.set(3);
			get_store_value(webglapp).forEach((f) => f());

			console.log("renderLoopStore loop finish, running 3");
		}
		//console.log("renderLoopStore requestAnimationFrame");
		requestAnimationFrame(loop);
	}
});

renderLoopStore.subscribe((value) => {
	console.log("render loop store subscribed", value);
});

var pointLightShader = "${declaration?\r\n`\r\n\r\nfloat pow4(const in float x) {\r\n    float x2 = x * x;\r\n    return x2 * x2;\r\n}\r\nfloat pow2(const in float x) {\r\n    return x * x;\r\n}\r\n\r\nfloat saturate(const in float a) {\r\n    return clamp(a, 0.0f, 1.0f);\r\n}\r\n\r\nstruct LightParams {\r\n    vec3 irradiance;\r\n    vec3 direction;\r\n    vec3 color;\r\n    float distance;\r\n};\r\n\r\nstruct PointLight {\r\n    vec3 position;\r\n    vec3 color;\r\n    float cutoffDistance;\r\n    float decayExponent;\r\n};\r\n\r\nlayout(std140) uniform PointLights {\r\n    PointLight pointLights[NUM_POINT_LIGHTS];\r\n};\r\n\r\nfloat getDistanceAttenuation(const in float lightDistance, const in float cutoffDistance, const in float decayExponent) {\r\n\t// based upon Frostbite 3 Moving to Physically-based Rendering\r\n\t// page 32, equation 26: E[window1]\r\n\t// https://seblagarde.files.wordpress.com/2015/07/course_notes_moving_frostbite_to_pbr_v32.pdf\r\n    float distanceFalloff = 1.0f / max(pow(lightDistance, decayExponent), 0.01f);\r\n    if(cutoffDistance > 0.0f) {\r\n        distanceFalloff *= pow2(saturate(1.0f - pow4(lightDistance / cutoffDistance)));\r\n    }\r\n    return distanceFalloff;\r\n\r\n}\r\n\r\nLightParams getDirectDiffuse(const in PointLight pointLight,const in vec3 vertexPosition, const in vec3 normal,const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {\r\n    LightParams lightParams = LightParams(vec3(0.0f), vec3(0.0f), vec3(0.0f), 0.0f);\r\n    vec3 lVector = pointLight.position - vertexPosition;\r\n    lightParams.distance = length(lVector);\r\n    lightParams.direction = normalize(lVector);\r\n    float dotNL = saturate(dot(normal, lightParams.direction));\r\n    lightParams.color = pointLight.color;\r\n    lightParams.color *= getDistanceAttenuation(lightParams.distance, pointLight.cutoffDistance, pointLight.decayExponent);\r\n    lightParams.irradiance = dotNL * lightParams.color;\r\n    \r\n    reflectedLight.directDiffuse += lightParams.irradiance * BRDF_Lambert(material.diffuseColor);\r\n    return lightParams;\r\n}\r\n\r\nfloat calculatePointLightBrightness(float lightDistance, float cutoffDistance, float decayExponent) {\r\n    return getDistanceAttenuation(lightDistance, cutoffDistance, decayExponent);\r\n}\r\n` : ''\r\n}\r\n${irradiance?\r\n`\r\n    vec3 irradiance = vec3(0.0f);\r\n    vec3 direction = vec3(0.0f);\r\n    for(int i = 0; i < NUM_POINT_LIGHTS; i++) {\r\n        PointLight pointLight = pointLights[i];\r\n        \r\n\r\n        LightParams lightParams = getDirectDiffuse(pointLight, vertex, normal, material, reflectedLight);\r\n        totalIrradiance += reflectedLight.directDiffuse;\r\n        ${specularIrradiance}\r\n    }\r\n` : ''\r\n}\r\n";

function multiplyScalarVec3(a, scalar) {
	a[0] *= scalar;
	a[1] *= scalar;
	a[2] *= scalar;
	return a;
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
function createPointLightBuffer({ gl }, lights) {
	const pointLigths = lights.filter((l) => get_store_value(l).type === "point");
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

function setupLights(context, lights) {
	return function setupLights() {
		console.log("setupLights");

		context = get_store_value(context);
		const gl = context.gl;
		const program = context.program;

		//only create the UBO once per app, not per program, todo move the only once logic to webglapp store
		if (!getPointLightsUBO()) {
			createPointLightBuffer(context, lights);
		}
		//program specific
		const pointLightsBlockIndex = gl.getUniformBlockIndex(program, "PointLights");
		// Bind the UBO to the binding point
		gl.uniformBlockBinding(program, pointLightsBlockIndex, UBO_BINDING_POINT_POINTLIGHT);
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

function instance($$self, $$props, $$invalidate) {
	let $camera;
	let $renderer;
	let $scene;
	component_subscribe($$self, camera, $$value => $$invalidate(2, $camera = $$value));
	component_subscribe($$self, renderer, $$value => $$invalidate(3, $renderer = $$value));
	component_subscribe($$self, scene, $$value => $$invalidate(4, $scene = $$value));
	let canvas;

	onMount(async () => {
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

		const light = createLightStore(createPointLight({
			position: [-2, 3, 0],
			color: [1, 1, 1],
			intensity: 20,
			cutoffDistance: 0,
			decayExponent: 2
		}));

		set_store_value(
			scene,
			$scene = [
				...$scene,
				{
					...cubeMesh,
					matrix: identity(new Float32Array(16)),
					material: { diffuse: [1, 0.5, 0.5], metalness: 0 }
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

		setTimeout(
			() => {
				set_store_value(camera, $camera = { position: [0, 5, -4] }, $camera);
			},
			1000
		);
	});

	function animate() {
		const time = performance.now() / 1000;
		const zpos = Math.sin(time) * 2;
		set_store_value(camera, $camera = { position: [0, 5, -zpos] }, $camera);
		console.log("animate", $camera.position);
	}

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
