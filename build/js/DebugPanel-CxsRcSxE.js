/** @returns {void} */
function noop() {}

/**
 * @template T
 * @template S
 * @param {T} tar
 * @param {S} src
 * @returns {T & S}
 */
function assign(tar, src) {
	// @ts-ignore
	for (const k in src) tar[k] = src[k];
	return /** @type {T & S} */ (tar);
}

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

function create_slot(definition, ctx, $$scope, fn) {
	if (definition) {
		const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
		return definition[0](slot_ctx);
	}
}

function get_slot_context(definition, ctx, $$scope, fn) {
	return definition[1] && fn ? assign($$scope.ctx.slice(), definition[1](fn(ctx))) : $$scope.ctx;
}

function get_slot_changes(definition, $$scope, dirty, fn) {
	if (definition[2] && fn) {
		const lets = definition[2](fn(dirty));
		if ($$scope.dirty === undefined) {
			return lets;
		}
		if (typeof lets === 'object') {
			const merged = [];
			const len = Math.max($$scope.dirty.length, lets.length);
			for (let i = 0; i < len; i += 1) {
				merged[i] = $$scope.dirty[i] | lets[i];
			}
			return merged;
		}
		return $$scope.dirty | lets;
	}
	return $$scope.dirty;
}

/** @returns {void} */
function update_slot_base(
	slot,
	slot_definition,
	ctx,
	$$scope,
	slot_changes,
	get_slot_context_fn
) {
	if (slot_changes) {
		const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
		slot.p(slot_context, slot_changes);
	}
}

/** @returns {any[] | -1} */
function get_all_dirty_from_scope($$scope) {
	if ($$scope.ctx.length > 32) {
		const dirty = [];
		const length = $$scope.ctx.length / 32;
		for (let i = 0; i < length; i++) {
			dirty[i] = -1;
		}
		return dirty;
	}
	return -1;
}

function null_to_empty(value) {
	return value == null ? '' : value;
}

function set_store_value(store, ret, value) {
	store.set(value);
	return ret;
}

/**
 * @param {Node} target
 * @param {Node} node
 * @returns {void}
 */
function append(target, node) {
	target.appendChild(node);
}

/**
 * @param {Node} target
 * @param {string} style_sheet_id
 * @param {string} styles
 * @returns {void}
 */
function append_styles(target, style_sheet_id, styles) {
	const append_styles_to = get_root_for_style(target);
	if (!append_styles_to.getElementById(style_sheet_id)) {
		const style = element('style');
		style.id = style_sheet_id;
		style.textContent = styles;
		append_stylesheet(append_styles_to, style);
	}
}

/**
 * @param {Node} node
 * @returns {ShadowRoot | Document}
 */
function get_root_for_style(node) {
	if (!node) return document;
	const root = node.getRootNode ? node.getRootNode() : node.ownerDocument;
	if (root && /** @type {ShadowRoot} */ (root).host) {
		return /** @type {ShadowRoot} */ (root);
	}
	return node.ownerDocument;
}

/**
 * @param {ShadowRoot | Document} node
 * @param {HTMLStyleElement} style
 * @returns {CSSStyleSheet}
 */
function append_stylesheet(node, style) {
	append(/** @type {Document} */ (node).head || node, style);
	return style.sheet;
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
 * @returns {void} */
function destroy_each(iterations, detaching) {
	for (let i = 0; i < iterations.length; i += 1) {
		if (iterations[i]) iterations[i].d(detaching);
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
 * @param {string} data
 * @returns {Text}
 */
function text(data) {
	return document.createTextNode(data);
}

/**
 * @returns {Text} */
function space() {
	return text(' ');
}

/**
 * @returns {Text} */
function empty() {
	return text('');
}

/**
 * @param {EventTarget} node
 * @param {string} event
 * @param {EventListenerOrEventListenerObject} handler
 * @param {boolean | AddEventListenerOptions | EventListenerOptions} [options]
 * @returns {() => void}
 */
function listen(node, event, handler, options) {
	node.addEventListener(event, handler, options);
	return () => node.removeEventListener(event, handler, options);
}

/**
 * @param {Element} node
 * @param {string} attribute
 * @param {string} [value]
 * @returns {void}
 */
function attr(node, attribute, value) {
	if (value == null) node.removeAttribute(attribute);
	else if (node.getAttribute(attribute) !== value) node.setAttribute(attribute, value);
}

/**
 * @param {Element} element
 * @returns {ChildNode[]}
 */
function children(element) {
	return Array.from(element.childNodes);
}

/**
 * @param {Text} text
 * @param {unknown} data
 * @returns {void}
 */
function set_data(text, data) {
	data = '' + data;
	if (text.data === data) return;
	text.data = /** @type {string} */ (data);
}

/**
 * @returns {void} */
function toggle_class(element, name, toggle) {
	// The `!!` is required because an `undefined` flag means flipping the current state.
	element.classList.toggle(name, !!toggle);
}

/**
 * @template T
 * @param {string} type
 * @param {T} [detail]
 * @param {{ bubbles?: boolean, cancelable?: boolean }} [options]
 * @returns {CustomEvent<T>}
 */
function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
	return new CustomEvent(type, { detail, bubbles, cancelable });
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

/**
 * Creates an event dispatcher that can be used to dispatch [component events](https://svelte.dev/docs#template-syntax-component-directives-on-eventname).
 * Event dispatchers are functions that can take two arguments: `name` and `detail`.
 *
 * Component events created with `createEventDispatcher` create a
 * [CustomEvent](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent).
 * These events do not [bubble](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Building_blocks/Events#Event_bubbling_and_capture).
 * The `detail` argument corresponds to the [CustomEvent.detail](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/detail)
 * property and can contain any type of data.
 *
 * The event dispatcher can be typed to narrow the allowed event names and the type of the `detail` argument:
 * ```ts
 * const dispatch = createEventDispatcher<{
 *  loaded: never; // does not take a detail argument
 *  change: string; // takes a detail argument of type string, which is required
 *  optional: number | null; // takes an optional detail argument of type number
 * }>();
 * ```
 *
 * https://svelte.dev/docs/svelte#createeventdispatcher
 * @template {Record<string, any>} [EventMap=any]
 * @returns {import('./public.js').EventDispatcher<EventMap>}
 */
function createEventDispatcher() {
	const component = get_current_component();
	return (type, detail, { cancelable = false } = {}) => {
		const callbacks = component.$$.callbacks[type];
		if (callbacks) {
			// TODO are there situations where events could be dispatched
			// in a server (non-DOM) environment?
			const event = custom_event(/** @type {string} */ (type), detail, { cancelable });
			callbacks.slice().forEach((fn) => {
				fn.call(component, event);
			});
			return !event.defaultPrevented;
		}
		return true;
	};
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
 * @type {Outro}
 */
let outros;

/**
 * @returns {void} */
function group_outros() {
	outros = {
		r: 0,
		c: [],
		p: outros // parent group
	};
}

/**
 * @returns {void} */
function check_outros() {
	if (!outros.r) {
		run_all(outros.c);
	}
	outros = outros.p;
}

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

/**
 * @param {import('./private.js').Fragment} block
 * @param {0 | 1} local
 * @param {0 | 1} [detach]
 * @param {() => void} [callback]
 * @returns {void}
 */
function transition_out(block, local, detach, callback) {
	if (block && block.o) {
		if (outroing.has(block)) return;
		outroing.add(block);
		outros.c.push(() => {
			outroing.delete(block);
			if (callback) {
				if (detach) block.d(1);
				callback();
			}
		});
		block.o(local);
	} else if (callback) {
		callback();
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

// general each functions:

function ensure_array_like(array_like_or_iterator) {
	return array_like_or_iterator?.length !== undefined
		? array_like_or_iterator
		: Array.from(array_like_or_iterator);
}

/** @returns {void} */
function create_component(block) {
	block && block.c();
}

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

var defaultFragment = "#version 300 es\r\nprecision mediump float;\r\n\r\n${defines}\r\n\r\n#define RECIPROCAL_PI 0.3183098861837907\r\n\r\nuniform vec3 diffuse;\r\nuniform float opacity;\r\nuniform float metalness;\r\nuniform vec3 ambientLightColor;\r\nuniform vec3 cameraPosition;\r\n//uniform mat3 normalMatrix;\r\n\r\nin vec3 vertex;\r\nin vec3 vNormal;\r\nin highp vec2 vUv;\r\nin vec3 vViewPosition;\r\n\r\nout vec4 fragColor;\r\n\r\nstruct ReflectedLight {\r\n\tvec3 directDiffuse;\r\n\tvec3 directSpecular;\r\n\tvec3 indirectDiffuse;\r\n\tvec3 indirectSpecular;\r\n};\r\n\r\nstruct PhysicalMaterial {\r\n\tvec3 diffuseColor;\r\n\tfloat diffuseAlpha;\r\n\tfloat roughness;\r\n\tvec3 specularColor;\r\n\tfloat specularF90;\r\n\tfloat ior;\r\n};\r\n\r\nvec3 BRDF_Lambert(const in vec3 diffuseColor) {\r\n\treturn RECIPROCAL_PI * diffuseColor;\r\n}\r\n\r\n\r\n${declarations}\r\n\r\nvec4 sRGBTransferOETF(in vec4 value) {\r\n\treturn vec4(mix(pow(value.rgb, vec3(0.41666)) * 1.055 - vec3(0.055), value.rgb * 12.92, vec3(lessThanEqual(value.rgb, vec3(0.0031308)))), value.a);\r\n}\r\n\r\nvec4 linearToOutputTexel(vec4 value) {\r\n\treturn (sRGBTransferOETF(value));\r\n}\r\n\r\nvoid main() {\r\n    PhysicalMaterial material;\r\n\tmaterial.diffuseAlpha = 1.0;\r\n\tmaterial.diffuseColor = diffuse.rgb * (1.0 - metalness);\r\n\t${diffuseMapSample}\r\n\t\r\n\r\n\tvec3 normal = normalize( vNormal );\r\n\t${normalMapSample}\r\n\t${roughnessMapSample}\r\n\r\n    ReflectedLight reflectedLight = ReflectedLight(vec3(0.0), vec3(0.0), vec3(0.0), vec3(0.0));\r\n\r\n    reflectedLight.indirectDiffuse += ambientLightColor * BRDF_Lambert(material.diffuseColor);\r\n\r\n    vec3 totalIrradiance = vec3(0.0f);\r\n    ${irradiance}\r\n\tvec3 outgoingLight = reflectedLight.indirectDiffuse + reflectedLight.directDiffuse + reflectedLight.directSpecular;\r\n    fragColor = vec4(outgoingLight, opacity*material.diffuseAlpha);\r\n    //fragColor = vec4(totalIrradiance, 1.0f);\r\n    ${toneMapping}\r\n\tfragColor = linearToOutputTexel(fragColor);\r\n}";

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

function linearArrayToCSSHashColor(array) {
	return array.map((num) => Math.floor(num * 255)).reduce((acc, num) => acc + num.toString(16).padStart(2, "0"), "#");
}
function hexNumToCSSStringColor(hex) {
	return "#" + hex.toString(16).padStart(6, "0");
}
function cssStringColorToHexNum(color) {
	return parseInt(color.slice(1), 16);
}
function cssStringColorToLinearArray(color) {
	return [
		parseInt(color.slice(1, 3), 16) / 255,
		parseInt(color.slice(3, 5), 16) / 255,
		parseInt(color.slice(5, 7), 16) / 255,
	];
}

const colorProps = ["diffuse", "color"];

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
	gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
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
			if (mesh.attributes.elements) {
				gl.drawElementsInstanced(gl[drawMode], attributeLength, gl.UNSIGNED_SHORT, 0, instances);
			} else {
				gl.drawArraysInstanced(gl[drawMode], 0, attributeLength, instances);
			}
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

function createShaders(material, meshes, numPointLights, pointLightShader) {
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
				declarationNormal: false,
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
				declarationNormal: true,
				mapType: material.normalMap.type,
			});
			normalMapSample = material.normalMap.shader({
				normalMapSample: true,
				mapType: material.normalMap.type,
			});
		}
		let roughnessMapDeclaration = "";
		let roughnessMapSample = "";
		if (material.roughnessMap) {
			roughnessMapDeclaration = material.roughnessMap.shader({
				declaration: true,
				declarationNormal: false,
				mapType: material.roughnessMap.type,
			});
			roughnessMapSample = material.roughnessMap.shader({
				roughnessMapSample: true,
				mapType: material.roughnessMap.type,
			});
		}

		const fragmentShaderSource = templateLiteralRenderer(defaultFragment, {
			defines: "",
			declarations: "",
			diffuseMapSample: "",
			normalMapSample: "",
			roughnessMapSample: "",
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
				...(material.roughnessMap ? [roughnessMapDeclaration] : []),
			].join("\n"),
			diffuseMapSample,
			normalMapSample,
			roughnessMapSample,
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
		if (metalness == null) {
			console.log("metalness is null, material won't display correctly");
		}
		const metalnessLocation = gl.getUniformLocation(program, "metalness");
		gl.uniform1f(metalnessLocation, metalness);
		const opacityLocation = gl.getUniformLocation(program, "opacity");
		gl.uniform1f(opacityLocation, opacity ?? 1);
	};
}

function setupAmbientLight(programOverride, ambientLightColorOverride) {
	/** @type {{gl:WebGL2RenderingContext,program: WebGLProgram}} **/
	const { gl, program, ambientLightColor } = appContext;
	const currentProgram = programOverride ?? program;
	const currentAmbientLightColor = ambientLightColorOverride ?? ambientLightColor;
	const ambientLightColorLocation = gl.getUniformLocation(currentProgram, "ambientLightColor");
	gl.uniform3fv(ambientLightColorLocation, new Float32Array(currentAmbientLightColor));
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
	//("setupTransformMatrix", numInstances);

	if (numInstances == null) {
		return function setupTransformMatrix() {
			//("setupTransformMatrix", numInstances);
			/** @type {{gl:WebGL2RenderingContext,program: WebGLProgram}} **/
			const { gl, program } = appContext;
			const worldLocation = gl.getUniformLocation(program, "world");
			if (worldLocation == null) {
				return;
			}
			//todo check why we have that, we shouldn't need this
			if (!transformMatrix) {
				transformMatrix = new Float32Array(16);
				identity(transformMatrix);
			}
			// TODO store this in a map, or not store it at all
			appContext.transformMatrix = transformMatrix;
			gl.uniformMatrix4fv(worldLocation, false, get_store_value(transformMatrix));
		};
	} else {
		return function setupTransformMatrix() {
			//("setupTransformMatrix", transformMatrix);
			if (transformMatrix == null) {
				return;
			}

			const attributeName = "world";
			/** @type {{gl:WebGL2RenderingContext,program: WebGLProgram}} **/
			const { gl, program, vaoMap } = appContext;

			//TODO, clean that it's useless since we overwrite it anyway and storing this way is not good
			let transformMatricesWindows;
			if (appContext.transformMatricesWindows == null) {
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
			const vao = vaoMap.get(programStore).get(mesh);

			gl.bindVertexArray(vao);
			const matrixBuffer = gl.createBuffer();
			//("setupTransformMatrix");

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
function updateTransformMatrix(programStore, worldMatrix) {
	/** @type {{gl:WebGL2RenderingContext,program: WebGLProgram}} **/
	const { gl, programMap } = appContext;
	const program = programMap.get(programStore);
	const worldLocation = gl.getUniformLocation(program, "world");
	gl.useProgram(program);
	gl.uniformMatrix4fv(worldLocation, false, worldMatrix);
}
function updateInstanceTransformMatrix(programStore, mesh, newMatrix, instanceIndex) {
	/** @type {{gl:WebGL2RenderingContext,program: WebGLProgram}} **/
	const { gl, vaoMap, matrixBuffer } = appContext;
	gl.bindVertexArray(vaoMap.get(programStore).get(mesh));
	gl.bindBuffer(gl.ARRAY_BUFFER, matrixBuffer);
	const bytesPerMatrix = 4 * 16;
	gl.bufferSubData(gl.ARRAY_BUFFER, instanceIndex * bytesPerMatrix, newMatrix);
	gl.bindVertexArray(null);

	updateInstanceNormalMatrix(programStore, mesh, derivateNormalMatrix(newMatrix), instanceIndex);
}

function setupNormalMatrix(programStore, mesh, numInstances) {
	if (numInstances == null) {
		return function setupNormalMatrix() {
			/** @type {{gl:WebGL2RenderingContext,program: WebGLProgram}} **/
			const { gl, program } = appContext;
			const normalMatrixLocation = gl.getUniformLocation(program, "normalMatrix");
			if (normalMatrixLocation == null) {
				return;
			}
			gl.uniformMatrix4fv(normalMatrixLocation, false, derivateNormalMatrix(get_store_value(mesh.matrix)));
		};
	} else {
		return function setupNormalMatrix() {
			/** @type {{gl:WebGL2RenderingContext,program: WebGLProgram}} **/
			const { gl, program, vaoMap, transformMatricesWindows } = appContext;
			const normalMatricesLocation = gl.getAttribLocation(program, "normalMatrix");
			if (normalMatricesLocation == null) {
				return;
			}
			const vao = vaoMap.get(programStore).get(mesh);

			gl.bindVertexArray(vao);
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

function updateInstanceNormalMatrix(programStore, mesh, normalMatrix, instanceIndex) {
	const { gl, vaoMap, normalMatrixBuffer } = appContext;
	gl.bindVertexArray(vaoMap.get(programStore).get(mesh));
	gl.bindBuffer(gl.ARRAY_BUFFER, normalMatrixBuffer);
	const bytesPerMatrix = 4 * 16;
	gl.bufferSubData(gl.ARRAY_BUFFER, instanceIndex * bytesPerMatrix, normalMatrix);
	gl.bindVertexArray(null);
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
		writeLightBuffer(lightData, lightValue, 0);
		gl.bindBuffer(gl.UNIFORM_BUFFER, pointLightsUBO);
		gl.bufferSubData(gl.UNIFORM_BUFFER, offset * Float32Array.BYTES_PER_ELEMENT, lightData);
	}
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
				const programs = findMaterialProgram();
				if (programs) {
					programs.forEach((program) => {
						setupAmbientLight(appContext.programMap.get(program), processed.get("ambientLightColor"));
					});
				}
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
		try {
			update((scene) => {
				const next = updater(scene);
				revisionStore.update((revision) => revision + 1);
				return next;
			});
		} catch (e) {
			console.log(e);
		}
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

const defaultWorldMatrix = new Float32Array(16);
identity(defaultWorldMatrix);

function findProgram(mesh) {
	const program = get_store_value(programs).find((program) => program.allMeshes !== true && program.meshes.includes(mesh));
	return program;
}

function findMaterialProgram() {
	const matPrograms = get_store_value(programs).filter((program) => program.meshes?.length !== 0 && program.allMeshes !== true);
	return matPrograms;
}

const createMeshMatrixStore = (mesh, rendererUpdate, initialValue, instanceIndex = NaN) => {
	const { subscribe, set } = writable(initialValue || defaultWorldMatrix);
	const transformMatrix = {
		subscribe,
		set: (nextMatrix) => {
			set(nextMatrix);
			const program = findProgram(mesh);
			if (isNaN(instanceIndex)) {
				updateTransformMatrix(program, nextMatrix);
			} else {
				updateInstanceTransformMatrix(program, mesh, nextMatrix, instanceIndex);
			}
			rendererUpdate(get_store_value(renderer));
		},
	};
	return transformMatrix;
};

/*
const createMeshMatricesStore = (rendererUpdate, initialValue) => {
	const { subscribe, set } = writable(initialValue || defaultWorldMatrix);
	const transformMatrix = {
		subscribe,
		set: (nextMatrix) => {
			set(nextMatrix);
			rendererUpdate(get(renderer));
		},
	};
	return transformMatrix;
};*/
function create3DObject(value) {
	if (value.matrix != null) {
		value.matrix = createMeshMatrixStore(value, renderer.set, value.matrix);
	} else if (value.matrices != null) {
		value.matrices = value.matrices.map((matrix, index) => createMeshMatrixStore(value, renderer.set, matrix, index));
	}
	return value;
}

let meshCache;

const meshes = derived([scene], ([$scene]) => {
	const meshNodes = $scene.filter((node) => node.attributes != null);
	//using throw to cancel update flow when unchanged
	// maybe when matrix change we need to update renderer and not programs, because the programs are the same
	//&& objectsHaveSameMatrix(meshCache, meshNodes)
	if (hasSameShallow(meshCache, meshNodes)) {
		throw new Error("meshes unchanged");
	} else {
		meshCache = meshNodes;
	}
	return meshNodes;
});

function createLightsStore() {
	const { subscribe, set } = writable([]);
	const lights = {
		subscribe,
		set: (next) => {
			set(next);
		},
	};
	return lights;
}
const lights = createLightsStore();

const numLigths = derived([lights], ([$lights]) => {
	return $lights.length;
});

const createLightStore = (initialProps) => {
	const { subscribe, set } = writable(initialProps);
	const light = {
		subscribe,
		set: (props) => {
			set(props);
			updateOneLight(get_store_value(lights), light);
			lights.set(get_store_value(lights));
			renderer.set(get_store_value(renderer));
		},
	};
	return light;
};

const renderPasses = writable([]);

function createMaterialStore(initialProps) {
	const { subscribe, set } = writable(initialProps);
	const material = {
		subscribe,
		set: (props) => {
			set(props);
			materials.set(get_store_value(materials));
			//renderer.set(get(renderer));
		},
	};
	return material;
}
const materials = writable([]);

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
			program.meshes.forEach((mesh, i) => {
				const meshPosition = getTranslation([], mesh.matrix);
				mesh.clipSpacePosition = transformMat4([], meshPosition, projScreen);
			});
			program.meshes = program.meshes.sort((a, b) => {
				return b.clipSpacePosition[2] - a.clipSpacePosition[2];
			});
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

	return sortedPrograms;
}

const programs = derived(
	[meshes, numLigths, materials, renderPasses],
	([$meshes, $numLigths, $materials, $renderPasses]) => {
		let prePasses = $renderPasses
			.filter((pass) => pass.order < 0)
			.reduce((acc, pass) => {
				return acc.concat(...pass.programs);
			}, [])
			.map((program) => ({
				...program,
				updateProgram: [],
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
					material: get_store_value(current),
					meshes: currentNormalMeshes,
				});
			}
			currentSpecialMeshes.forEach((mesh) => {
				const requireTime = mesh.animations?.some((animation) => animation.requireTime);
				acc.push({
					requireTime,
					material: get_store_value(current),
					meshes: [mesh],
				});
			});
			return acc;
		}, []);

		programs = programs.sort(sortTransparency);
		sortMeshesByZ(programs);

		// TODO make two different numligth store, one for each light type, when spotlight is supported
		//const pointLights = $lights.filter((l) => get(l).type === "point");
		const numPointLights = $numLigths;

		let pointLightShader;
		if (numPointLights > 0) {
			pointLightShader = get_store_value(get_store_value(lights)[0]).shader;
		}

		return [
			...prePasses,
			...programs.map((p, index) => {
				const firstCall = index === 0;
				const program = {
					...p,
					useProgram,
					setupMaterial: [setupAmbientLight],
					updateProgram: [],
					bindTextures: [],
					createProgram,
					selectProgram,
				};
				program.setupProgram = [
					createShaders(p.material, p.meshes, numPointLights, pointLightShader),
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
				if (p.material?.roughnessMap) {
					program.setupMaterial.push(p.material.roughnessMap.setupTexture);
					program.bindTextures.push(p.material.roughnessMap.bindTexture);
				}
				if (p.requireTime) {
					program.updateProgram.push(setupTime);
				}
				program.setupMaterial.push(
					...Array.from(
						get_store_value(lights).reduce((acc, light) => {
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
						? [program.selectProgram(program), program.useProgram, ...program.bindTextures, ...program.updateProgram]
						: [
								program.createProgram(program),
								...program.setupProgram,
								program.useProgram,
								...program.setupMaterial,
								...program.updateProgram,
							]),
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
											? [setupTransformMatrix(program, mesh, mesh.matrix), setupNormalMatrix(program, mesh)]
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

/* src\Menu.svelte generated by Svelte v4.2.18 */

function add_css$b(target) {
	append_styles(target, "svelte-7mcxv8", "button.svelte-7mcxv8.svelte-7mcxv8{position:relative;font-family:Arial;font-size:20px;padding:10px}ul.svelte-7mcxv8.svelte-7mcxv8{position:relative;display:none;font-family:Arial;font-size:20px}li.svelte-7mcxv8.svelte-7mcxv8{padding:10px;background-color:white;width:fit-content}li.svelte-7mcxv8 a.svelte-7mcxv8{text-decoration:none;color:black}.menuOpened.svelte-7mcxv8.svelte-7mcxv8{display:block}.current.svelte-7mcxv8.svelte-7mcxv8{color:red}");
}

function get_each_context$4(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[3] = list[i];
	return child_ctx;
}

// (27:8) {:else}
function create_else_block(ctx) {
	let li;
	let a;
	let t_value = /*link*/ ctx[3].name + "";
	let t;

	return {
		c() {
			li = element("li");
			a = element("a");
			t = text(t_value);
			attr(a, "href", /*link*/ ctx[3].href);
			attr(a, "class", "svelte-7mcxv8");
			attr(li, "class", "svelte-7mcxv8");
		},
		m(target, anchor) {
			insert(target, li, anchor);
			append(li, a);
			append(a, t);
		},
		p: noop,
		d(detaching) {
			if (detaching) {
				detach(li);
			}
		}
	};
}

// (25:8) {#if window.location.pathname===link.href.substring(1)}
function create_if_block$1(ctx) {
	let li;

	return {
		c() {
			li = element("li");
			li.textContent = `${/*link*/ ctx[3].name}`;
			attr(li, "class", "current svelte-7mcxv8");
		},
		m(target, anchor) {
			insert(target, li, anchor);
		},
		p: noop,
		d(detaching) {
			if (detaching) {
				detach(li);
			}
		}
	};
}

// (24:4) {#each links as link}
function create_each_block$4(ctx) {
	let if_block_anchor;

	function select_block_type(ctx, dirty) {
		if (window.location.pathname === /*link*/ ctx[3].href.substring(1)) return create_if_block$1;
		return create_else_block;
	}

	let current_block_type = select_block_type(ctx);
	let if_block = current_block_type(ctx);

	return {
		c() {
			if_block.c();
			if_block_anchor = empty();
		},
		m(target, anchor) {
			if_block.m(target, anchor);
			insert(target, if_block_anchor, anchor);
		},
		p(ctx, dirty) {
			if_block.p(ctx, dirty);
		},
		d(detaching) {
			if (detaching) {
				detach(if_block_anchor);
			}

			if_block.d(detaching);
		}
	};
}

function create_fragment$f(ctx) {
	let button;
	let t1;
	let ul;
	let mounted;
	let dispose;
	let each_value = ensure_array_like(/*links*/ ctx[2]);
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$4(get_each_context$4(ctx, each_value, i));
	}

	return {
		c() {
			button = element("button");
			button.textContent = "examples";
			t1 = space();
			ul = element("ul");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			attr(button, "class", "svelte-7mcxv8");
			attr(ul, "class", "svelte-7mcxv8");
			toggle_class(ul, "menuOpened", /*menuOpened*/ ctx[0]);
		},
		m(target, anchor) {
			insert(target, button, anchor);
			insert(target, t1, anchor);
			insert(target, ul, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(ul, null);
				}
			}

			if (!mounted) {
				dispose = listen(button, "click", /*toggleMenu*/ ctx[1]);
				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*links, window*/ 4) {
				each_value = ensure_array_like(/*links*/ ctx[2]);
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context$4(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block$4(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(ul, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value.length;
			}

			if (dirty & /*menuOpened*/ 1) {
				toggle_class(ul, "menuOpened", /*menuOpened*/ ctx[0]);
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) {
				detach(button);
				detach(t1);
				detach(ul);
			}

			destroy_each(each_blocks, detaching);
			mounted = false;
			dispose();
		}
	};
}

function instance$f($$self, $$props, $$invalidate) {
	let menuOpened = false;

	function toggleMenu() {
		console.log("toggleMenu", menuOpened);
		$$invalidate(0, menuOpened = !menuOpened);
	}

	const links = [
		{
			name: "Normal map and specular",
			href: "./golf-ball"
		},
		{ name: "GLTF loader", href: "./" },
		{ name: "Obj loader", href: "./venus" },
		{ name: "Cube", href: "./cube" },
		{ name: "GLTF", href: "./gltf" },
		{
			name: "Contact Shadow",
			href: "./contact-shadow"
		},
		{
			name: "Transparency",
			href: "./transparency"
		},
		{ name: "Instances", href: "./instances" },
		{ name: "Matrix", href: "./matrix" },
		{ name: "Texture", href: "./texture" },
		{ name: "Lights", href: "./lights" },
		{
			name: "Vertex Animation",
			href: "./vertex-anim"
		}
	];

	return [menuOpened, toggleMenu, links];
}

class Menu extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$f, create_fragment$f, safe_not_equal, {}, add_css$b);
	}
}

/* src\components\DebugPanel\DebugBlock.svelte generated by Svelte v4.2.18 */

function add_css$a(target) {
	append_styles(target, "svelte-12snxhu", "div.content.svelte-12snxhu{width:100%;height:100%;display:flex;justify-content:center;align-items:stretch;flex-direction:column;gap:var(--panel-vertical-padding);padding:var(--panel-vertical-padding) var(--panel-horizontal-padding);font-size:0.9rem}div.block.level1.svelte-12snxhu{border-top:2px solid var(--panel-dark-color);padding:var(--panel-vertical-padding) var(--panel-horizontal-padding)}div.block.level2.svelte-12snxhu,div.block.level3.svelte-12snxhu,div.block.level4.svelte-12snxhu{border-top:1px solid var(--panel-dark-color)}");
}

const get_title_slot_changes = dirty => ({});
const get_title_slot_context = ctx => ({});

function create_fragment$e(ctx) {
	let div1;
	let t;
	let div0;
	let div1_class_value;
	let current;
	const title_slot_template = /*#slots*/ ctx[2].title;
	const title_slot = create_slot(title_slot_template, ctx, /*$$scope*/ ctx[1], get_title_slot_context);
	const default_slot_template = /*#slots*/ ctx[2].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], null);

	return {
		c() {
			div1 = element("div");
			if (title_slot) title_slot.c();
			t = space();
			div0 = element("div");
			if (default_slot) default_slot.c();
			attr(div0, "class", "content svelte-12snxhu");
			attr(div1, "class", div1_class_value = "block level" + /*level*/ ctx[0] + " svelte-12snxhu");
		},
		m(target, anchor) {
			insert(target, div1, anchor);

			if (title_slot) {
				title_slot.m(div1, null);
			}

			append(div1, t);
			append(div1, div0);

			if (default_slot) {
				default_slot.m(div0, null);
			}

			current = true;
		},
		p(ctx, [dirty]) {
			if (title_slot) {
				if (title_slot.p && (!current || dirty & /*$$scope*/ 2)) {
					update_slot_base(
						title_slot,
						title_slot_template,
						ctx,
						/*$$scope*/ ctx[1],
						!current
						? get_all_dirty_from_scope(/*$$scope*/ ctx[1])
						: get_slot_changes(title_slot_template, /*$$scope*/ ctx[1], dirty, get_title_slot_changes),
						get_title_slot_context
					);
				}
			}

			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope*/ 2)) {
					update_slot_base(
						default_slot,
						default_slot_template,
						ctx,
						/*$$scope*/ ctx[1],
						!current
						? get_all_dirty_from_scope(/*$$scope*/ ctx[1])
						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[1], dirty, null),
						null
					);
				}
			}

			if (!current || dirty & /*level*/ 1 && div1_class_value !== (div1_class_value = "block level" + /*level*/ ctx[0] + " svelte-12snxhu")) {
				attr(div1, "class", div1_class_value);
			}
		},
		i(local) {
			if (current) return;
			transition_in(title_slot, local);
			transition_in(default_slot, local);
			current = true;
		},
		o(local) {
			transition_out(title_slot, local);
			transition_out(default_slot, local);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(div1);
			}

			if (title_slot) title_slot.d(detaching);
			if (default_slot) default_slot.d(detaching);
		}
	};
}

function instance$e($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	let { level = 1 } = $$props;

	$$self.$$set = $$props => {
		if ('level' in $$props) $$invalidate(0, level = $$props.level);
		if ('$$scope' in $$props) $$invalidate(1, $$scope = $$props.$$scope);
	};

	return [level, $$scope, slots];
}

class DebugBlock extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$e, create_fragment$e, safe_not_equal, { level: 0 }, add_css$a);
	}
}

/* src\components\DebugPanel\DebugH2.svelte generated by Svelte v4.2.18 */

function add_css$9(target) {
	append_styles(target, "svelte-cut9yg", "h2.svelte-cut9yg{text-transform:uppercase;font-weight:bold;font-size:0.9rem;color:var(--panel-light-color);padding:var(--panel-vertical-padding) var(--panel-horizontal-padding)}");
}

function create_fragment$d(ctx) {
	let h2;
	let current;
	const default_slot_template = /*#slots*/ ctx[1].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[0], null);

	return {
		c() {
			h2 = element("h2");
			if (default_slot) default_slot.c();
			attr(h2, "class", "svelte-cut9yg");
		},
		m(target, anchor) {
			insert(target, h2, anchor);

			if (default_slot) {
				default_slot.m(h2, null);
			}

			current = true;
		},
		p(ctx, [dirty]) {
			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope*/ 1)) {
					update_slot_base(
						default_slot,
						default_slot_template,
						ctx,
						/*$$scope*/ ctx[0],
						!current
						? get_all_dirty_from_scope(/*$$scope*/ ctx[0])
						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[0], dirty, null),
						null
					);
				}
			}
		},
		i(local) {
			if (current) return;
			transition_in(default_slot, local);
			current = true;
		},
		o(local) {
			transition_out(default_slot, local);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(h2);
			}

			if (default_slot) default_slot.d(detaching);
		}
	};
}

function instance$d($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;

	$$self.$$set = $$props => {
		if ('$$scope' in $$props) $$invalidate(0, $$scope = $$props.$$scope);
	};

	return [$$scope, slots];
}

class DebugH2 extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$d, create_fragment$d, safe_not_equal, {}, add_css$9);
	}
}

/* src\components\DebugPanel\DebugH3.svelte generated by Svelte v4.2.18 */

function add_css$8(target) {
	append_styles(target, "svelte-3ayulq", "h3.svelte-3ayulq{text-transform:uppercase;font-size:0.8rem;color:var(--panel-medium-color);padding:var(--panel-vertical-padding) var(--panel-horizontal-padding)}h3.svelte-3ayulq:first-child{border-top:none}");
}

function create_fragment$c(ctx) {
	let h3;
	let current;
	const default_slot_template = /*#slots*/ ctx[1].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[0], null);

	return {
		c() {
			h3 = element("h3");
			if (default_slot) default_slot.c();
			attr(h3, "class", "svelte-3ayulq");
		},
		m(target, anchor) {
			insert(target, h3, anchor);

			if (default_slot) {
				default_slot.m(h3, null);
			}

			current = true;
		},
		p(ctx, [dirty]) {
			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope*/ 1)) {
					update_slot_base(
						default_slot,
						default_slot_template,
						ctx,
						/*$$scope*/ ctx[0],
						!current
						? get_all_dirty_from_scope(/*$$scope*/ ctx[0])
						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[0], dirty, null),
						null
					);
				}
			}
		},
		i(local) {
			if (current) return;
			transition_in(default_slot, local);
			current = true;
		},
		o(local) {
			transition_out(default_slot, local);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(h3);
			}

			if (default_slot) default_slot.d(detaching);
		}
	};
}

function instance$c($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;

	$$self.$$set = $$props => {
		if ('$$scope' in $$props) $$invalidate(0, $$scope = $$props.$$scope);
	};

	return [$$scope, slots];
}

class DebugH3 extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$c, create_fragment$c, safe_not_equal, {}, add_css$8);
	}
}

/* src\components\DebugPanel\DebugNumber.svelte generated by Svelte v4.2.18 */

function add_css$7(target) {
	append_styles(target, "svelte-n3cejh", "div.svelte-n3cejh{flex:1;display:flex;justify-content:center;align-items:center;gap:2px;border-radius:0.3125rem;background-color:var(--panel-dark-color);overflow:hidden;padding:var(--panel-horizontal-padding) var(--panel-vertical-padding)}input[type=\"number\"].svelte-n3cejh{flex:1;color:var(--panel-light-color);background-color:var(--panel-dark-color);font-size:0.8rem;border:none;width:0}span.svelte-n3cejh{flex:0.2;text-transform:capitalize;font-size:0.7rem;color:var(--panel-medium-light-color)}");
}

function create_fragment$b(ctx) {
	let div;
	let span;
	let t0;
	let t1;
	let input;
	let mounted;
	let dispose;

	return {
		c() {
			div = element("div");
			span = element("span");
			t0 = text(/*label*/ ctx[0]);
			t1 = space();
			input = element("input");
			attr(span, "class", "svelte-n3cejh");
			attr(input, "type", "number");
			attr(input, "min", /*min*/ ctx[2]);
			attr(input, "max", /*max*/ ctx[3]);
			attr(input, "step", /*step*/ ctx[4]);
			input.value = /*value*/ ctx[1];
			attr(input, "class", "svelte-n3cejh");
			attr(div, "class", "svelte-n3cejh");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, span);
			append(span, t0);
			append(div, t1);
			append(div, input);

			if (!mounted) {
				dispose = listen(input, "change", /*onChange*/ ctx[5]);
				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*label*/ 1) set_data(t0, /*label*/ ctx[0]);

			if (dirty & /*min*/ 4) {
				attr(input, "min", /*min*/ ctx[2]);
			}

			if (dirty & /*max*/ 8) {
				attr(input, "max", /*max*/ ctx[3]);
			}

			if (dirty & /*step*/ 16) {
				attr(input, "step", /*step*/ ctx[4]);
			}

			if (dirty & /*value*/ 2 && input.value !== /*value*/ ctx[1]) {
				input.value = /*value*/ ctx[1];
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) {
				detach(div);
			}

			mounted = false;
			dispose();
		}
	};
}

function instance$b($$self, $$props, $$invalidate) {
	let { label } = $$props;
	let { value } = $$props;
	let { min } = $$props;
	let { max } = $$props;
	let { step } = $$props;
	const dispatch = createEventDispatcher();

	function onChange(event) {
		dispatch("change", { number: parseFloat(event.target.value) });
	}

	$$self.$$set = $$props => {
		if ('label' in $$props) $$invalidate(0, label = $$props.label);
		if ('value' in $$props) $$invalidate(1, value = $$props.value);
		if ('min' in $$props) $$invalidate(2, min = $$props.min);
		if ('max' in $$props) $$invalidate(3, max = $$props.max);
		if ('step' in $$props) $$invalidate(4, step = $$props.step);
	};

	return [label, value, min, max, step, onChange];
}

class DebugNumber extends SvelteComponent {
	constructor(options) {
		super();

		init(
			this,
			options,
			instance$b,
			create_fragment$b,
			safe_not_equal,
			{
				label: 0,
				value: 1,
				min: 2,
				max: 3,
				step: 4
			},
			add_css$7
		);
	}
}

/* src\components\DebugPanel\DebugRow.svelte generated by Svelte v4.2.18 */

function add_css$6(target) {
	append_styles(target, "svelte-1mm3m2h", ".row.svelte-1mm3m2h{width:100%;display:flex;justify-content:center;align-items:center;padding:0px 7px;gap:10px}");
}

function create_fragment$a(ctx) {
	let div;
	let current;
	const default_slot_template = /*#slots*/ ctx[1].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[0], null);

	return {
		c() {
			div = element("div");
			if (default_slot) default_slot.c();
			attr(div, "class", "row svelte-1mm3m2h");
		},
		m(target, anchor) {
			insert(target, div, anchor);

			if (default_slot) {
				default_slot.m(div, null);
			}

			current = true;
		},
		p(ctx, [dirty]) {
			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope*/ 1)) {
					update_slot_base(
						default_slot,
						default_slot_template,
						ctx,
						/*$$scope*/ ctx[0],
						!current
						? get_all_dirty_from_scope(/*$$scope*/ ctx[0])
						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[0], dirty, null),
						null
					);
				}
			}
		},
		i(local) {
			if (current) return;
			transition_in(default_slot, local);
			current = true;
		},
		o(local) {
			transition_out(default_slot, local);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(div);
			}

			if (default_slot) default_slot.d(detaching);
		}
	};
}

function instance$a($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;

	$$self.$$set = $$props => {
		if ('$$scope' in $$props) $$invalidate(0, $$scope = $$props.$$scope);
	};

	return [$$scope, slots];
}

class DebugRow extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$a, create_fragment$a, safe_not_equal, {}, add_css$6);
	}
}

/* src\components\DebugPanel\DebugSliderNumber.svelte generated by Svelte v4.2.18 */

function add_css$5(target) {
	append_styles(target, "svelte-16xg45f", "input[type=\"range\"].svelte-16xg45f:focus{outline:none}input[type=\"range\"].svelte-16xg45f{border-radius:5px;height:5px;outline:none;-webkit-appearance:none;appearance:none;flex:1}input[type=\"range\"].svelte-16xg45f::-webkit-slider-runnable-track{height:var(--input-track-size);background-color:var(--panel-dark-color);border-radius:calc(var(--input-track-size) / 2)}input[type=\"range\"].svelte-16xg45f:focus::-webkit-slider-runnable-track{background-color:var(--panel-dark-color)}input[type=\"range\"].svelte-16xg45f::-moz-range-track{height:var(--input-track-size);background-color:var(--panel-dark-color);border-radius:calc(var(--input-track-size) / 2)}input[type=\"range\"].svelte-16xg45f::-webkit-slider-thumb{border-radius:calc(var(--input-thumb-size) / 2);height:var(--input-thumb-size);width:var(--input-thumb-size);background:var(--panel-light-color);cursor:pointer;-webkit-appearance:none;margin-top:calc((var(--input-track-size) - var(--input-thumb-size)) / 2)}input[type=\"range\"].svelte-16xg45f::-moz-range-thumb{border:none;height:var(--input-thumb-size);width:var(--input-thumb-size);border-radius:calc(var(--input-thumb-size) / 2);background:var(--panel-light-color);cursor:pointer}input[type=\"number\"].svelte-16xg45f{flex:0.3;padding:3px 5px;color:var(--panel-light-color);background-color:var(--panel-dark-color);border:none;border-radius:0.3125rem;width:0}");
}

// (16:0) <DebugRow>
function create_default_slot$6(ctx) {
	let input0;
	let t;
	let input1;
	let mounted;
	let dispose;

	return {
		c() {
			input0 = element("input");
			t = space();
			input1 = element("input");
			attr(input0, "type", "range");
			attr(input0, "min", /*min*/ ctx[1]);
			attr(input0, "max", /*max*/ ctx[2]);
			attr(input0, "step", /*step*/ ctx[3]);
			input0.value = /*value*/ ctx[0];
			attr(input0, "class", "svelte-16xg45f");
			attr(input1, "type", "number");
			attr(input1, "min", /*min*/ ctx[1]);
			attr(input1, "max", /*max*/ ctx[2]);
			attr(input1, "step", /*step*/ ctx[3]);
			input1.value = /*value*/ ctx[0];
			attr(input1, "class", "svelte-16xg45f");
		},
		m(target, anchor) {
			insert(target, input0, anchor);
			insert(target, t, anchor);
			insert(target, input1, anchor);

			if (!mounted) {
				dispose = [
					listen(input0, "change", /*onChange*/ ctx[4]),
					listen(input1, "change", /*onChange*/ ctx[4])
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*min*/ 2) {
				attr(input0, "min", /*min*/ ctx[1]);
			}

			if (dirty & /*max*/ 4) {
				attr(input0, "max", /*max*/ ctx[2]);
			}

			if (dirty & /*step*/ 8) {
				attr(input0, "step", /*step*/ ctx[3]);
			}

			if (dirty & /*value*/ 1) {
				input0.value = /*value*/ ctx[0];
			}

			if (dirty & /*min*/ 2) {
				attr(input1, "min", /*min*/ ctx[1]);
			}

			if (dirty & /*max*/ 4) {
				attr(input1, "max", /*max*/ ctx[2]);
			}

			if (dirty & /*step*/ 8) {
				attr(input1, "step", /*step*/ ctx[3]);
			}

			if (dirty & /*value*/ 1 && input1.value !== /*value*/ ctx[0]) {
				input1.value = /*value*/ ctx[0];
			}
		},
		d(detaching) {
			if (detaching) {
				detach(input0);
				detach(t);
				detach(input1);
			}

			mounted = false;
			run_all(dispose);
		}
	};
}

function create_fragment$9(ctx) {
	let debugrow;
	let current;

	debugrow = new DebugRow({
			props: {
				$$slots: { default: [create_default_slot$6] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(debugrow.$$.fragment);
		},
		m(target, anchor) {
			mount_component(debugrow, target, anchor);
			current = true;
		},
		p(ctx, [dirty]) {
			const debugrow_changes = {};

			if (dirty & /*$$scope, min, max, step, value*/ 79) {
				debugrow_changes.$$scope = { dirty, ctx };
			}

			debugrow.$set(debugrow_changes);
		},
		i(local) {
			if (current) return;
			transition_in(debugrow.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(debugrow.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(debugrow, detaching);
		}
	};
}

function instance$9($$self, $$props, $$invalidate) {
	let { value } = $$props;
	let { min } = $$props;
	let { max } = $$props;
	let { step } = $$props;
	const dispatch = createEventDispatcher();

	function onChange(event) {
		dispatch("change", { number: parseFloat(event.target.value) });
	}

	$$self.$$set = $$props => {
		if ('value' in $$props) $$invalidate(0, value = $$props.value);
		if ('min' in $$props) $$invalidate(1, min = $$props.min);
		if ('max' in $$props) $$invalidate(2, max = $$props.max);
		if ('step' in $$props) $$invalidate(3, step = $$props.step);
	};

	return [value, min, max, step, onChange];
}

class DebugSliderNumber extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$9, create_fragment$9, safe_not_equal, { value: 0, min: 1, max: 2, step: 3 }, add_css$5);
	}
}

/* src\components\DebugPanel\DebugH4.svelte generated by Svelte v4.2.18 */

function add_css$4(target) {
	append_styles(target, "svelte-13qcadj", "h4.svelte-13qcadj{text-transform:uppercase;font-size:0.7rem;color:var(--panel-medium-color);padding:calc(var(--panel-horizontal-padding) / 2) 0px calc(var(--panel-horizontal-padding) / 2) 0px;flex:1}.padding0.svelte-13qcadj{padding-left:0px}.padding1.svelte-13qcadj{padding-left:7px}.padding2.svelte-13qcadj{padding-left:14px}.padding3.svelte-13qcadj{padding-left:21px}");
}

function create_fragment$8(ctx) {
	let h4;
	let h4_class_value;
	let current;
	const default_slot_template = /*#slots*/ ctx[2].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], null);

	return {
		c() {
			h4 = element("h4");
			if (default_slot) default_slot.c();
			attr(h4, "class", h4_class_value = "" + (null_to_empty("padding" + /*padding*/ ctx[0]) + " svelte-13qcadj"));
		},
		m(target, anchor) {
			insert(target, h4, anchor);

			if (default_slot) {
				default_slot.m(h4, null);
			}

			current = true;
		},
		p(ctx, [dirty]) {
			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope*/ 2)) {
					update_slot_base(
						default_slot,
						default_slot_template,
						ctx,
						/*$$scope*/ ctx[1],
						!current
						? get_all_dirty_from_scope(/*$$scope*/ ctx[1])
						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[1], dirty, null),
						null
					);
				}
			}

			if (!current || dirty & /*padding*/ 1 && h4_class_value !== (h4_class_value = "" + (null_to_empty("padding" + /*padding*/ ctx[0]) + " svelte-13qcadj"))) {
				attr(h4, "class", h4_class_value);
			}
		},
		i(local) {
			if (current) return;
			transition_in(default_slot, local);
			current = true;
		},
		o(local) {
			transition_out(default_slot, local);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(h4);
			}

			if (default_slot) default_slot.d(detaching);
		}
	};
}

function instance$8($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	let { padding = 0 } = $$props;

	$$self.$$set = $$props => {
		if ('padding' in $$props) $$invalidate(0, padding = $$props.padding);
		if ('$$scope' in $$props) $$invalidate(1, $$scope = $$props.$$scope);
	};

	return [padding, $$scope, slots];
}

class DebugH4 extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$8, create_fragment$8, safe_not_equal, { padding: 0 }, add_css$4);
	}
}

/* src\components\DebugPanel\DebugCamera.svelte generated by Svelte v4.2.18 */

function create_default_slot_6$3(ctx) {
	let t;

	return {
		c() {
			t = text("Position");
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		d(detaching) {
			if (detaching) {
				detach(t);
			}
		}
	};
}

// (56:2) <DebugRow>
function create_default_slot_5$3(ctx) {
	let debugnumber0;
	let t0;
	let debugnumber1;
	let t1;
	let debugnumber2;
	let current;

	debugnumber0 = new DebugNumber({
			props: {
				label: "x",
				value: /*$camera*/ ctx[0].position[0]
			}
		});

	debugnumber0.$on("change", /*onCameraXPositionChange*/ ctx[1]);

	debugnumber1 = new DebugNumber({
			props: {
				label: "y",
				value: /*$camera*/ ctx[0].position[1]
			}
		});

	debugnumber1.$on("change", /*onCameraYPositionChange*/ ctx[2]);

	debugnumber2 = new DebugNumber({
			props: {
				label: "z",
				value: /*$camera*/ ctx[0].position[2]
			}
		});

	debugnumber2.$on("change", /*onCameraZPositionChange*/ ctx[3]);

	return {
		c() {
			create_component(debugnumber0.$$.fragment);
			t0 = space();
			create_component(debugnumber1.$$.fragment);
			t1 = space();
			create_component(debugnumber2.$$.fragment);
		},
		m(target, anchor) {
			mount_component(debugnumber0, target, anchor);
			insert(target, t0, anchor);
			mount_component(debugnumber1, target, anchor);
			insert(target, t1, anchor);
			mount_component(debugnumber2, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const debugnumber0_changes = {};
			if (dirty & /*$camera*/ 1) debugnumber0_changes.value = /*$camera*/ ctx[0].position[0];
			debugnumber0.$set(debugnumber0_changes);
			const debugnumber1_changes = {};
			if (dirty & /*$camera*/ 1) debugnumber1_changes.value = /*$camera*/ ctx[0].position[1];
			debugnumber1.$set(debugnumber1_changes);
			const debugnumber2_changes = {};
			if (dirty & /*$camera*/ 1) debugnumber2_changes.value = /*$camera*/ ctx[0].position[2];
			debugnumber2.$set(debugnumber2_changes);
		},
		i(local) {
			if (current) return;
			transition_in(debugnumber0.$$.fragment, local);
			transition_in(debugnumber1.$$.fragment, local);
			transition_in(debugnumber2.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(debugnumber0.$$.fragment, local);
			transition_out(debugnumber1.$$.fragment, local);
			transition_out(debugnumber2.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(t0);
				detach(t1);
			}

			destroy_component(debugnumber0, detaching);
			destroy_component(debugnumber1, detaching);
			destroy_component(debugnumber2, detaching);
		}
	};
}

// (73:2) <DebugH4 padding="1">
function create_default_slot_4$3(ctx) {
	let t;

	return {
		c() {
			t = text("Target");
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		d(detaching) {
			if (detaching) {
				detach(t);
			}
		}
	};
}

// (74:2) <DebugRow>
function create_default_slot_3$3(ctx) {
	let debugnumber0;
	let t0;
	let debugnumber1;
	let t1;
	let debugnumber2;
	let current;

	debugnumber0 = new DebugNumber({
			props: {
				label: "x",
				value: /*$camera*/ ctx[0].target[0]
			}
		});

	debugnumber0.$on("change", /*onCameraXTargetChange*/ ctx[4]);

	debugnumber1 = new DebugNumber({
			props: {
				label: "y",
				value: /*$camera*/ ctx[0].target[1]
			}
		});

	debugnumber1.$on("change", /*onCameraYTargetChange*/ ctx[5]);

	debugnumber2 = new DebugNumber({
			props: {
				label: "z",
				value: /*$camera*/ ctx[0].target[2]
			}
		});

	debugnumber2.$on("change", /*onCameraZTargetChange*/ ctx[6]);

	return {
		c() {
			create_component(debugnumber0.$$.fragment);
			t0 = space();
			create_component(debugnumber1.$$.fragment);
			t1 = space();
			create_component(debugnumber2.$$.fragment);
		},
		m(target, anchor) {
			mount_component(debugnumber0, target, anchor);
			insert(target, t0, anchor);
			mount_component(debugnumber1, target, anchor);
			insert(target, t1, anchor);
			mount_component(debugnumber2, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const debugnumber0_changes = {};
			if (dirty & /*$camera*/ 1) debugnumber0_changes.value = /*$camera*/ ctx[0].target[0];
			debugnumber0.$set(debugnumber0_changes);
			const debugnumber1_changes = {};
			if (dirty & /*$camera*/ 1) debugnumber1_changes.value = /*$camera*/ ctx[0].target[1];
			debugnumber1.$set(debugnumber1_changes);
			const debugnumber2_changes = {};
			if (dirty & /*$camera*/ 1) debugnumber2_changes.value = /*$camera*/ ctx[0].target[2];
			debugnumber2.$set(debugnumber2_changes);
		},
		i(local) {
			if (current) return;
			transition_in(debugnumber0.$$.fragment, local);
			transition_in(debugnumber1.$$.fragment, local);
			transition_in(debugnumber2.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(debugnumber0.$$.fragment, local);
			transition_out(debugnumber1.$$.fragment, local);
			transition_out(debugnumber2.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(t0);
				detach(t1);
			}

			destroy_component(debugnumber0, detaching);
			destroy_component(debugnumber1, detaching);
			destroy_component(debugnumber2, detaching);
		}
	};
}

// (91:2) <DebugH4 padding="1">
function create_default_slot_2$4(ctx) {
	let t;

	return {
		c() {
			t = text("FOV");
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		d(detaching) {
			if (detaching) {
				detach(t);
			}
		}
	};
}

// (53:0) <DebugBlock>
function create_default_slot_1$5(ctx) {
	let debugh40;
	let t0;
	let debugrow0;
	let t1;
	let debugh41;
	let t2;
	let debugrow1;
	let t3;
	let debugh42;
	let t4;
	let debugslidernumber;
	let current;

	debugh40 = new DebugH4({
			props: {
				padding: "1",
				$$slots: { default: [create_default_slot_6$3] },
				$$scope: { ctx }
			}
		});

	debugrow0 = new DebugRow({
			props: {
				$$slots: { default: [create_default_slot_5$3] },
				$$scope: { ctx }
			}
		});

	debugh41 = new DebugH4({
			props: {
				padding: "1",
				$$slots: { default: [create_default_slot_4$3] },
				$$scope: { ctx }
			}
		});

	debugrow1 = new DebugRow({
			props: {
				$$slots: { default: [create_default_slot_3$3] },
				$$scope: { ctx }
			}
		});

	debugh42 = new DebugH4({
			props: {
				padding: "1",
				$$slots: { default: [create_default_slot_2$4] },
				$$scope: { ctx }
			}
		});

	debugslidernumber = new DebugSliderNumber({
			props: {
				min: "0",
				max: "180",
				step: "1",
				value: /*$camera*/ ctx[0].fov
			}
		});

	debugslidernumber.$on("change", /*onCameraFOVChange*/ ctx[7]);

	return {
		c() {
			create_component(debugh40.$$.fragment);
			t0 = space();
			create_component(debugrow0.$$.fragment);
			t1 = space();
			create_component(debugh41.$$.fragment);
			t2 = space();
			create_component(debugrow1.$$.fragment);
			t3 = space();
			create_component(debugh42.$$.fragment);
			t4 = space();
			create_component(debugslidernumber.$$.fragment);
		},
		m(target, anchor) {
			mount_component(debugh40, target, anchor);
			insert(target, t0, anchor);
			mount_component(debugrow0, target, anchor);
			insert(target, t1, anchor);
			mount_component(debugh41, target, anchor);
			insert(target, t2, anchor);
			mount_component(debugrow1, target, anchor);
			insert(target, t3, anchor);
			mount_component(debugh42, target, anchor);
			insert(target, t4, anchor);
			mount_component(debugslidernumber, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const debugh40_changes = {};

			if (dirty & /*$$scope*/ 256) {
				debugh40_changes.$$scope = { dirty, ctx };
			}

			debugh40.$set(debugh40_changes);
			const debugrow0_changes = {};

			if (dirty & /*$$scope, $camera*/ 257) {
				debugrow0_changes.$$scope = { dirty, ctx };
			}

			debugrow0.$set(debugrow0_changes);
			const debugh41_changes = {};

			if (dirty & /*$$scope*/ 256) {
				debugh41_changes.$$scope = { dirty, ctx };
			}

			debugh41.$set(debugh41_changes);
			const debugrow1_changes = {};

			if (dirty & /*$$scope, $camera*/ 257) {
				debugrow1_changes.$$scope = { dirty, ctx };
			}

			debugrow1.$set(debugrow1_changes);
			const debugh42_changes = {};

			if (dirty & /*$$scope*/ 256) {
				debugh42_changes.$$scope = { dirty, ctx };
			}

			debugh42.$set(debugh42_changes);
			const debugslidernumber_changes = {};
			if (dirty & /*$camera*/ 1) debugslidernumber_changes.value = /*$camera*/ ctx[0].fov;
			debugslidernumber.$set(debugslidernumber_changes);
		},
		i(local) {
			if (current) return;
			transition_in(debugh40.$$.fragment, local);
			transition_in(debugrow0.$$.fragment, local);
			transition_in(debugh41.$$.fragment, local);
			transition_in(debugrow1.$$.fragment, local);
			transition_in(debugh42.$$.fragment, local);
			transition_in(debugslidernumber.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(debugh40.$$.fragment, local);
			transition_out(debugrow0.$$.fragment, local);
			transition_out(debugh41.$$.fragment, local);
			transition_out(debugrow1.$$.fragment, local);
			transition_out(debugh42.$$.fragment, local);
			transition_out(debugslidernumber.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(t0);
				detach(t1);
				detach(t2);
				detach(t3);
				detach(t4);
			}

			destroy_component(debugh40, detaching);
			destroy_component(debugrow0, detaching);
			destroy_component(debugh41, detaching);
			destroy_component(debugrow1, detaching);
			destroy_component(debugh42, detaching);
			destroy_component(debugslidernumber, detaching);
		}
	};
}

// (54:2) <DebugH2 slot="title">
function create_default_slot$5(ctx) {
	let t;

	return {
		c() {
			t = text("Camera");
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		d(detaching) {
			if (detaching) {
				detach(t);
			}
		}
	};
}

// (54:2) 
function create_title_slot$4(ctx) {
	let debugh2;
	let current;

	debugh2 = new DebugH2({
			props: {
				slot: "title",
				$$slots: { default: [create_default_slot$5] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(debugh2.$$.fragment);
		},
		m(target, anchor) {
			mount_component(debugh2, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const debugh2_changes = {};

			if (dirty & /*$$scope*/ 256) {
				debugh2_changes.$$scope = { dirty, ctx };
			}

			debugh2.$set(debugh2_changes);
		},
		i(local) {
			if (current) return;
			transition_in(debugh2.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(debugh2.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(debugh2, detaching);
		}
	};
}

function create_fragment$7(ctx) {
	let debugblock;
	let current;

	debugblock = new DebugBlock({
			props: {
				$$slots: {
					title: [create_title_slot$4],
					default: [create_default_slot_1$5]
				},
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(debugblock.$$.fragment);
		},
		m(target, anchor) {
			mount_component(debugblock, target, anchor);
			current = true;
		},
		p(ctx, [dirty]) {
			const debugblock_changes = {};

			if (dirty & /*$$scope, $camera*/ 257) {
				debugblock_changes.$$scope = { dirty, ctx };
			}

			debugblock.$set(debugblock_changes);
		},
		i(local) {
			if (current) return;
			transition_in(debugblock.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(debugblock.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(debugblock, detaching);
		}
	};
}

function instance$7($$self, $$props, $$invalidate) {
	let $camera;
	component_subscribe($$self, camera, $$value => $$invalidate(0, $camera = $$value));

	function onCameraXPositionChange(e) {
		set_store_value(
			camera,
			$camera = {
				...$camera,
				position: [e.detail.number, $camera.position[1], $camera.position[2]]
			},
			$camera
		);
	}

	function onCameraYPositionChange(e) {
		set_store_value(
			camera,
			$camera = {
				...$camera,
				position: [$camera.position[0], e.detail.number, $camera.position[2]]
			},
			$camera
		);
	}

	function onCameraZPositionChange(e) {
		set_store_value(
			camera,
			$camera = {
				...$camera,
				position: [$camera.position[0], $camera.position[1], e.detail.number]
			},
			$camera
		);
	}

	function onCameraXTargetChange(e) {
		set_store_value(
			camera,
			$camera = {
				...$camera,
				target: [e.detail.number, $camera.target[1], $camera.target[2]]
			},
			$camera
		);
	}

	function onCameraYTargetChange(e) {
		set_store_value(
			camera,
			$camera = {
				...$camera,
				target: [$camera.target[0], e.detail.number, $camera.target[2]]
			},
			$camera
		);
	}

	function onCameraZTargetChange(e) {
		set_store_value(
			camera,
			$camera = {
				...$camera,
				target: [$camera.target[0], $camera.target[1], e.detail.number]
			},
			$camera
		);
	}

	function onCameraFOVChange(e) {
		set_store_value(camera, $camera = { ...$camera, fov: e.detail.number }, $camera);
	}

	return [
		$camera,
		onCameraXPositionChange,
		onCameraYPositionChange,
		onCameraZPositionChange,
		onCameraXTargetChange,
		onCameraYTargetChange,
		onCameraZTargetChange,
		onCameraFOVChange
	];
}

class DebugCamera extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$7, create_fragment$7, safe_not_equal, {});
	}
}

/* src\components\DebugPanel\DebugColor.svelte generated by Svelte v4.2.18 */

function create_default_slot_1$4(ctx) {
	let t;

	return {
		c() {
			t = text(/*label*/ ctx[0]);
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		p(ctx, dirty) {
			if (dirty & /*label*/ 1) set_data(t, /*label*/ ctx[0]);
		},
		d(detaching) {
			if (detaching) {
				detach(t);
			}
		}
	};
}

// (25:0) <DebugRow>
function create_default_slot$4(ctx) {
	let debugh4;
	let t;
	let input;
	let input_value_value;
	let current;
	let mounted;
	let dispose;

	debugh4 = new DebugH4({
			props: {
				$$slots: { default: [create_default_slot_1$4] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(debugh4.$$.fragment);
			t = space();
			input = element("input");
			attr(input, "type", "color");
			input.value = input_value_value = /*convertColor*/ ctx[2](/*color*/ ctx[1]);
		},
		m(target, anchor) {
			mount_component(debugh4, target, anchor);
			insert(target, t, anchor);
			insert(target, input, anchor);
			current = true;

			if (!mounted) {
				dispose = listen(input, "change", /*onChange*/ ctx[3]);
				mounted = true;
			}
		},
		p(ctx, dirty) {
			const debugh4_changes = {};

			if (dirty & /*$$scope, label*/ 33) {
				debugh4_changes.$$scope = { dirty, ctx };
			}

			debugh4.$set(debugh4_changes);

			if (!current || dirty & /*color*/ 2 && input_value_value !== (input_value_value = /*convertColor*/ ctx[2](/*color*/ ctx[1]))) {
				input.value = input_value_value;
			}
		},
		i(local) {
			if (current) return;
			transition_in(debugh4.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(debugh4.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(t);
				detach(input);
			}

			destroy_component(debugh4, detaching);
			mounted = false;
			dispose();
		}
	};
}

function create_fragment$6(ctx) {
	let debugrow;
	let current;

	debugrow = new DebugRow({
			props: {
				$$slots: { default: [create_default_slot$4] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(debugrow.$$.fragment);
		},
		m(target, anchor) {
			mount_component(debugrow, target, anchor);
			current = true;
		},
		p(ctx, [dirty]) {
			const debugrow_changes = {};

			if (dirty & /*$$scope, color, label*/ 35) {
				debugrow_changes.$$scope = { dirty, ctx };
			}

			debugrow.$set(debugrow_changes);
		},
		i(local) {
			if (current) return;
			transition_in(debugrow.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(debugrow.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(debugrow, detaching);
		}
	};
}

function instance$6($$self, $$props, $$invalidate) {
	let { label } = $$props;
	let { color } = $$props;

	function convertColor(color) {
		if (typeof color === "number") {
			return hexNumToCSSStringColor(color);
		} else if (Array.isArray(color)) {
			return linearArrayToCSSHashColor(color.slice(0, 3));
		}

		return color;
	}

	const dispatch = createEventDispatcher();

	function onChange(event) {
		dispatch("change", { color: event.target.value });
	}

	$$self.$$set = $$props => {
		if ('label' in $$props) $$invalidate(0, label = $$props.label);
		if ('color' in $$props) $$invalidate(1, color = $$props.color);
	};

	return [label, color, convertColor, onChange];
}

class DebugColor extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$6, create_fragment$6, safe_not_equal, { label: 0, color: 1 });
	}
}

/* src\components\DebugPanel\DebugRenderer.svelte generated by Svelte v4.2.18 */

function create_default_slot_2$3(ctx) {
	let t;

	return {
		c() {
			t = text("Ambient Light Intensity");
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		d(detaching) {
			if (detaching) {
				detach(t);
			}
		}
	};
}

// (49:0) <DebugBlock>
function create_default_slot_1$3(ctx) {
	let debugcolor0;
	let t0;
	let debugcolor1;
	let t1;
	let debugh4;
	let t2;
	let debugslidernumber;
	let current;

	debugcolor0 = new DebugColor({
			props: {
				label: "Background Color",
				color: /*$renderer*/ ctx[0].backgroundColor
			}
		});

	debugcolor0.$on("change", /*onBGColorChange*/ ctx[5]);

	debugcolor1 = new DebugColor({
			props: {
				label: "Ambient Light Color",
				color: /*$renderer*/ ctx[0].ambientLightColor[0]
			}
		});

	debugcolor1.$on("change", /*onAColorChange*/ ctx[6]);

	debugh4 = new DebugH4({
			props: {
				padding: "1",
				$$slots: { default: [create_default_slot_2$3] },
				$$scope: { ctx }
			}
		});

	debugslidernumber = new DebugSliderNumber({
			props: {
				min: /*getRangeMin*/ ctx[1]("ambientIntensity"),
				max: /*getRangeMax*/ ctx[2]("ambientIntensity"),
				step: /*getRangeStep*/ ctx[3]("ambientIntensity"),
				value: /*$renderer*/ ctx[0].ambientLightColor[1]
			}
		});

	debugslidernumber.$on("change", /*onAIntensityChange*/ ctx[4]);

	return {
		c() {
			create_component(debugcolor0.$$.fragment);
			t0 = space();
			create_component(debugcolor1.$$.fragment);
			t1 = space();
			create_component(debugh4.$$.fragment);
			t2 = space();
			create_component(debugslidernumber.$$.fragment);
		},
		m(target, anchor) {
			mount_component(debugcolor0, target, anchor);
			insert(target, t0, anchor);
			mount_component(debugcolor1, target, anchor);
			insert(target, t1, anchor);
			mount_component(debugh4, target, anchor);
			insert(target, t2, anchor);
			mount_component(debugslidernumber, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const debugcolor0_changes = {};
			if (dirty & /*$renderer*/ 1) debugcolor0_changes.color = /*$renderer*/ ctx[0].backgroundColor;
			debugcolor0.$set(debugcolor0_changes);
			const debugcolor1_changes = {};
			if (dirty & /*$renderer*/ 1) debugcolor1_changes.color = /*$renderer*/ ctx[0].ambientLightColor[0];
			debugcolor1.$set(debugcolor1_changes);
			const debugh4_changes = {};

			if (dirty & /*$$scope*/ 256) {
				debugh4_changes.$$scope = { dirty, ctx };
			}

			debugh4.$set(debugh4_changes);
			const debugslidernumber_changes = {};
			if (dirty & /*$renderer*/ 1) debugslidernumber_changes.value = /*$renderer*/ ctx[0].ambientLightColor[1];
			debugslidernumber.$set(debugslidernumber_changes);
		},
		i(local) {
			if (current) return;
			transition_in(debugcolor0.$$.fragment, local);
			transition_in(debugcolor1.$$.fragment, local);
			transition_in(debugh4.$$.fragment, local);
			transition_in(debugslidernumber.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(debugcolor0.$$.fragment, local);
			transition_out(debugcolor1.$$.fragment, local);
			transition_out(debugh4.$$.fragment, local);
			transition_out(debugslidernumber.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(t0);
				detach(t1);
				detach(t2);
			}

			destroy_component(debugcolor0, detaching);
			destroy_component(debugcolor1, detaching);
			destroy_component(debugh4, detaching);
			destroy_component(debugslidernumber, detaching);
		}
	};
}

// (50:2) <DebugH2 slot="title">
function create_default_slot$3(ctx) {
	let t;

	return {
		c() {
			t = text("Renderer");
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		d(detaching) {
			if (detaching) {
				detach(t);
			}
		}
	};
}

// (50:2) 
function create_title_slot$3(ctx) {
	let debugh2;
	let current;

	debugh2 = new DebugH2({
			props: {
				slot: "title",
				$$slots: { default: [create_default_slot$3] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(debugh2.$$.fragment);
		},
		m(target, anchor) {
			mount_component(debugh2, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const debugh2_changes = {};

			if (dirty & /*$$scope*/ 256) {
				debugh2_changes.$$scope = { dirty, ctx };
			}

			debugh2.$set(debugh2_changes);
		},
		i(local) {
			if (current) return;
			transition_in(debugh2.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(debugh2.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(debugh2, detaching);
		}
	};
}

function create_fragment$5(ctx) {
	let debugblock;
	let current;

	debugblock = new DebugBlock({
			props: {
				$$slots: {
					title: [create_title_slot$3],
					default: [create_default_slot_1$3]
				},
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(debugblock.$$.fragment);
		},
		m(target, anchor) {
			mount_component(debugblock, target, anchor);
			current = true;
		},
		p(ctx, [dirty]) {
			const debugblock_changes = {};

			if (dirty & /*$$scope, $renderer*/ 257) {
				debugblock_changes.$$scope = { dirty, ctx };
			}

			debugblock.$set(debugblock_changes);
		},
		i(local) {
			if (current) return;
			transition_in(debugblock.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(debugblock.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(debugblock, detaching);
		}
	};
}

function instance$5($$self, $$props, $$invalidate) {
	let $renderer;
	component_subscribe($$self, renderer, $$value => $$invalidate(0, $renderer = $$value));

	const lightPropsRange = {
		intensity: [0, 30],
		ambientIntensity: [0, 1],
		cutoffDistance: [0, 30],
		decayExponent: [0, 5]
	};

	function getRangeMin(key) {
		return lightPropsRange[key][0];
	}

	function getRangeMax(key) {
		return lightPropsRange[key][1];
	}

	function getRangeStep(key) {
		return (lightPropsRange[key][1] - lightPropsRange[key][0]) / 20;
	}

	function onAIntensityChange(e) {
		set_store_value(
			renderer,
			$renderer = {
				...$renderer,
				ambientLightColor: [$renderer.ambientLightColor[0], e.detail.number]
			},
			$renderer
		);
	}

	function onBGColorChange(e) {
		set_store_value(
			renderer,
			$renderer = {
				...$renderer,
				backgroundColor: cssStringColorToHexNum(e.detail.color)
			},
			$renderer
		);
	}

	function onAColorChange(e) {
		set_store_value(
			renderer,
			$renderer = {
				...$renderer,
				ambientLightColor: [cssStringColorToHexNum(e.detail.color), $renderer.ambientLightColor[1]]
			},
			$renderer
		);
	}

	return [
		$renderer,
		getRangeMin,
		getRangeMax,
		getRangeStep,
		onAIntensityChange,
		onBGColorChange,
		onAColorChange
	];
}

class DebugRenderer extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});
	}
}

/* src\components\DebugPanel\DebugLights.svelte generated by Svelte v4.2.18 */

function get_each_context$3(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[19] = list[i];
	child_ctx[21] = i;
	return child_ctx;
}

// (99:6) <DebugH4 padding="1">
function create_default_slot_8$1(ctx) {
	let t;

	return {
		c() {
			t = text("Intensity");
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		d(detaching) {
			if (detaching) {
				detach(t);
			}
		}
	};
}

// (107:6) <DebugH4 padding="1">
function create_default_slot_7$1(ctx) {
	let t;

	return {
		c() {
			t = text("Position");
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		d(detaching) {
			if (detaching) {
				detach(t);
			}
		}
	};
}

// (108:6) <DebugRow>
function create_default_slot_6$2(ctx) {
	let debugnumber0;
	let t0;
	let debugnumber1;
	let t1;
	let debugnumber2;
	let current;

	function change_handler_2(...args) {
		return /*change_handler_2*/ ctx[13](/*light*/ ctx[19], ...args);
	}

	debugnumber0 = new DebugNumber({
			props: {
				label: "x",
				value: get_store_value(/*light*/ ctx[19]).position[0]
			}
		});

	debugnumber0.$on("change", change_handler_2);

	function change_handler_3(...args) {
		return /*change_handler_3*/ ctx[14](/*light*/ ctx[19], ...args);
	}

	debugnumber1 = new DebugNumber({
			props: {
				label: "y",
				value: get_store_value(/*light*/ ctx[19]).position[1]
			}
		});

	debugnumber1.$on("change", change_handler_3);

	function change_handler_4(...args) {
		return /*change_handler_4*/ ctx[15](/*light*/ ctx[19], ...args);
	}

	debugnumber2 = new DebugNumber({
			props: {
				label: "z",
				value: get_store_value(/*light*/ ctx[19]).position[2]
			}
		});

	debugnumber2.$on("change", change_handler_4);

	return {
		c() {
			create_component(debugnumber0.$$.fragment);
			t0 = space();
			create_component(debugnumber1.$$.fragment);
			t1 = space();
			create_component(debugnumber2.$$.fragment);
		},
		m(target, anchor) {
			mount_component(debugnumber0, target, anchor);
			insert(target, t0, anchor);
			mount_component(debugnumber1, target, anchor);
			insert(target, t1, anchor);
			mount_component(debugnumber2, target, anchor);
			current = true;
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;
			const debugnumber0_changes = {};
			if (dirty & /*$lights*/ 1) debugnumber0_changes.value = get_store_value(/*light*/ ctx[19]).position[0];
			debugnumber0.$set(debugnumber0_changes);
			const debugnumber1_changes = {};
			if (dirty & /*$lights*/ 1) debugnumber1_changes.value = get_store_value(/*light*/ ctx[19]).position[1];
			debugnumber1.$set(debugnumber1_changes);
			const debugnumber2_changes = {};
			if (dirty & /*$lights*/ 1) debugnumber2_changes.value = get_store_value(/*light*/ ctx[19]).position[2];
			debugnumber2.$set(debugnumber2_changes);
		},
		i(local) {
			if (current) return;
			transition_in(debugnumber0.$$.fragment, local);
			transition_in(debugnumber1.$$.fragment, local);
			transition_in(debugnumber2.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(debugnumber0.$$.fragment, local);
			transition_out(debugnumber1.$$.fragment, local);
			transition_out(debugnumber2.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(t0);
				detach(t1);
			}

			destroy_component(debugnumber0, detaching);
			destroy_component(debugnumber1, detaching);
			destroy_component(debugnumber2, detaching);
		}
	};
}

// (125:6) <DebugH4 padding="1">
function create_default_slot_5$2(ctx) {
	let t;

	return {
		c() {
			t = text("Cutoff Distance");
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		d(detaching) {
			if (detaching) {
				detach(t);
			}
		}
	};
}

// (133:6) <DebugH4 padding="1">
function create_default_slot_4$2(ctx) {
	let t;

	return {
		c() {
			t = text("Decay Exponent");
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		d(detaching) {
			if (detaching) {
				detach(t);
			}
		}
	};
}

// (92:4) <DebugBlock level={2}>
function create_default_slot_3$2(ctx) {
	let debugcolor;
	let t0;
	let debugh40;
	let t1;
	let debugslidernumber0;
	let t2;
	let debugh41;
	let t3;
	let debugrow;
	let t4;
	let debugh42;
	let t5;
	let debugslidernumber1;
	let t6;
	let debugh43;
	let t7;
	let debugslidernumber2;
	let t8;
	let current;

	function change_handler(...args) {
		return /*change_handler*/ ctx[11](/*light*/ ctx[19], ...args);
	}

	debugcolor = new DebugColor({
			props: {
				label: "Color",
				color: get_store_value(/*light*/ ctx[19]).color
			}
		});

	debugcolor.$on("change", change_handler);

	debugh40 = new DebugH4({
			props: {
				padding: "1",
				$$slots: { default: [create_default_slot_8$1] },
				$$scope: { ctx }
			}
		});

	function change_handler_1(...args) {
		return /*change_handler_1*/ ctx[12](/*light*/ ctx[19], ...args);
	}

	debugslidernumber0 = new DebugSliderNumber({
			props: {
				min: /*getRangeMin*/ ctx[1]("intensity"),
				max: /*getRangeMax*/ ctx[2]("intensity"),
				step: /*getRangeStep*/ ctx[3]("intensity"),
				value: get_store_value(/*light*/ ctx[19]).intensity
			}
		});

	debugslidernumber0.$on("change", change_handler_1);

	debugh41 = new DebugH4({
			props: {
				padding: "1",
				$$slots: { default: [create_default_slot_7$1] },
				$$scope: { ctx }
			}
		});

	debugrow = new DebugRow({
			props: {
				$$slots: { default: [create_default_slot_6$2] },
				$$scope: { ctx }
			}
		});

	debugh42 = new DebugH4({
			props: {
				padding: "1",
				$$slots: { default: [create_default_slot_5$2] },
				$$scope: { ctx }
			}
		});

	function change_handler_5(...args) {
		return /*change_handler_5*/ ctx[16](/*light*/ ctx[19], ...args);
	}

	debugslidernumber1 = new DebugSliderNumber({
			props: {
				min: /*getRangeMin*/ ctx[1]("cutoffDistance"),
				max: /*getRangeMax*/ ctx[2]("cutoffDistance"),
				step: /*getRangeStep*/ ctx[3]("cutoffDistance"),
				value: get_store_value(/*light*/ ctx[19]).cutoffDistance
			}
		});

	debugslidernumber1.$on("change", change_handler_5);

	debugh43 = new DebugH4({
			props: {
				padding: "1",
				$$slots: { default: [create_default_slot_4$2] },
				$$scope: { ctx }
			}
		});

	function change_handler_6(...args) {
		return /*change_handler_6*/ ctx[17](/*light*/ ctx[19], ...args);
	}

	debugslidernumber2 = new DebugSliderNumber({
			props: {
				min: /*getRangeMin*/ ctx[1]("decayExponent"),
				max: /*getRangeMax*/ ctx[2]("decayExponent"),
				step: /*getRangeStep*/ ctx[3]("decayExponent"),
				value: get_store_value(/*light*/ ctx[19]).decayExponent
			}
		});

	debugslidernumber2.$on("change", change_handler_6);

	return {
		c() {
			create_component(debugcolor.$$.fragment);
			t0 = space();
			create_component(debugh40.$$.fragment);
			t1 = space();
			create_component(debugslidernumber0.$$.fragment);
			t2 = space();
			create_component(debugh41.$$.fragment);
			t3 = space();
			create_component(debugrow.$$.fragment);
			t4 = space();
			create_component(debugh42.$$.fragment);
			t5 = space();
			create_component(debugslidernumber1.$$.fragment);
			t6 = space();
			create_component(debugh43.$$.fragment);
			t7 = space();
			create_component(debugslidernumber2.$$.fragment);
			t8 = space();
		},
		m(target, anchor) {
			mount_component(debugcolor, target, anchor);
			insert(target, t0, anchor);
			mount_component(debugh40, target, anchor);
			insert(target, t1, anchor);
			mount_component(debugslidernumber0, target, anchor);
			insert(target, t2, anchor);
			mount_component(debugh41, target, anchor);
			insert(target, t3, anchor);
			mount_component(debugrow, target, anchor);
			insert(target, t4, anchor);
			mount_component(debugh42, target, anchor);
			insert(target, t5, anchor);
			mount_component(debugslidernumber1, target, anchor);
			insert(target, t6, anchor);
			mount_component(debugh43, target, anchor);
			insert(target, t7, anchor);
			mount_component(debugslidernumber2, target, anchor);
			insert(target, t8, anchor);
			current = true;
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;
			const debugcolor_changes = {};
			if (dirty & /*$lights*/ 1) debugcolor_changes.color = get_store_value(/*light*/ ctx[19]).color;
			debugcolor.$set(debugcolor_changes);
			const debugh40_changes = {};

			if (dirty & /*$$scope*/ 4194304) {
				debugh40_changes.$$scope = { dirty, ctx };
			}

			debugh40.$set(debugh40_changes);
			const debugslidernumber0_changes = {};
			if (dirty & /*$lights*/ 1) debugslidernumber0_changes.value = get_store_value(/*light*/ ctx[19]).intensity;
			debugslidernumber0.$set(debugslidernumber0_changes);
			const debugh41_changes = {};

			if (dirty & /*$$scope*/ 4194304) {
				debugh41_changes.$$scope = { dirty, ctx };
			}

			debugh41.$set(debugh41_changes);
			const debugrow_changes = {};

			if (dirty & /*$$scope, $lights*/ 4194305) {
				debugrow_changes.$$scope = { dirty, ctx };
			}

			debugrow.$set(debugrow_changes);
			const debugh42_changes = {};

			if (dirty & /*$$scope*/ 4194304) {
				debugh42_changes.$$scope = { dirty, ctx };
			}

			debugh42.$set(debugh42_changes);
			const debugslidernumber1_changes = {};
			if (dirty & /*$lights*/ 1) debugslidernumber1_changes.value = get_store_value(/*light*/ ctx[19]).cutoffDistance;
			debugslidernumber1.$set(debugslidernumber1_changes);
			const debugh43_changes = {};

			if (dirty & /*$$scope*/ 4194304) {
				debugh43_changes.$$scope = { dirty, ctx };
			}

			debugh43.$set(debugh43_changes);
			const debugslidernumber2_changes = {};
			if (dirty & /*$lights*/ 1) debugslidernumber2_changes.value = get_store_value(/*light*/ ctx[19]).decayExponent;
			debugslidernumber2.$set(debugslidernumber2_changes);
		},
		i(local) {
			if (current) return;
			transition_in(debugcolor.$$.fragment, local);
			transition_in(debugh40.$$.fragment, local);
			transition_in(debugslidernumber0.$$.fragment, local);
			transition_in(debugh41.$$.fragment, local);
			transition_in(debugrow.$$.fragment, local);
			transition_in(debugh42.$$.fragment, local);
			transition_in(debugslidernumber1.$$.fragment, local);
			transition_in(debugh43.$$.fragment, local);
			transition_in(debugslidernumber2.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(debugcolor.$$.fragment, local);
			transition_out(debugh40.$$.fragment, local);
			transition_out(debugslidernumber0.$$.fragment, local);
			transition_out(debugh41.$$.fragment, local);
			transition_out(debugrow.$$.fragment, local);
			transition_out(debugh42.$$.fragment, local);
			transition_out(debugslidernumber1.$$.fragment, local);
			transition_out(debugh43.$$.fragment, local);
			transition_out(debugslidernumber2.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(t0);
				detach(t1);
				detach(t2);
				detach(t3);
				detach(t4);
				detach(t5);
				detach(t6);
				detach(t7);
				detach(t8);
			}

			destroy_component(debugcolor, detaching);
			destroy_component(debugh40, detaching);
			destroy_component(debugslidernumber0, detaching);
			destroy_component(debugh41, detaching);
			destroy_component(debugrow, detaching);
			destroy_component(debugh42, detaching);
			destroy_component(debugslidernumber1, detaching);
			destroy_component(debugh43, detaching);
			destroy_component(debugslidernumber2, detaching);
		}
	};
}

// (93:6) <DebugH3 slot="title">
function create_default_slot_2$2(ctx) {
	let t0;
	let t1;

	return {
		c() {
			t0 = text("Light ");
			t1 = text(/*i*/ ctx[21]);
		},
		m(target, anchor) {
			insert(target, t0, anchor);
			insert(target, t1, anchor);
		},
		p: noop,
		d(detaching) {
			if (detaching) {
				detach(t0);
				detach(t1);
			}
		}
	};
}

// (93:6) 
function create_title_slot_1$2(ctx) {
	let debugh3;
	let current;

	debugh3 = new DebugH3({
			props: {
				slot: "title",
				$$slots: { default: [create_default_slot_2$2] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(debugh3.$$.fragment);
		},
		m(target, anchor) {
			mount_component(debugh3, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const debugh3_changes = {};

			if (dirty & /*$$scope*/ 4194304) {
				debugh3_changes.$$scope = { dirty, ctx };
			}

			debugh3.$set(debugh3_changes);
		},
		i(local) {
			if (current) return;
			transition_in(debugh3.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(debugh3.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(debugh3, detaching);
		}
	};
}

// (91:2) {#each $lights as light, i}
function create_each_block$3(ctx) {
	let debugblock;
	let current;

	debugblock = new DebugBlock({
			props: {
				level: 2,
				$$slots: {
					title: [create_title_slot_1$2],
					default: [create_default_slot_3$2]
				},
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(debugblock.$$.fragment);
		},
		m(target, anchor) {
			mount_component(debugblock, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const debugblock_changes = {};

			if (dirty & /*$$scope, $lights*/ 4194305) {
				debugblock_changes.$$scope = { dirty, ctx };
			}

			debugblock.$set(debugblock_changes);
		},
		i(local) {
			if (current) return;
			transition_in(debugblock.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(debugblock.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(debugblock, detaching);
		}
	};
}

// (89:0) <DebugBlock>
function create_default_slot_1$2(ctx) {
	let each_1_anchor;
	let current;
	let each_value = ensure_array_like(/*$lights*/ ctx[0]);
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$3(get_each_context$3(ctx, each_value, i));
	}

	const out = i => transition_out(each_blocks[i], 1, 1, () => {
		each_blocks[i] = null;
	});

	return {
		c() {
			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			each_1_anchor = empty();
		},
		m(target, anchor) {
			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(target, anchor);
				}
			}

			insert(target, each_1_anchor, anchor);
			current = true;
		},
		p(ctx, dirty) {
			if (dirty & /*getRangeMin, getRangeMax, getRangeStep, $lights, onLightDecayExponentChange, onLightCutoffDistanceChange, onLightZChange, onLightYChange, onLightXChange, onLightIntensityChange, onLightColorChange*/ 2047) {
				each_value = ensure_array_like(/*$lights*/ ctx[0]);
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context$3(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
						transition_in(each_blocks[i], 1);
					} else {
						each_blocks[i] = create_each_block$3(child_ctx);
						each_blocks[i].c();
						transition_in(each_blocks[i], 1);
						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
					}
				}

				group_outros();

				for (i = each_value.length; i < each_blocks.length; i += 1) {
					out(i);
				}

				check_outros();
			}
		},
		i(local) {
			if (current) return;

			for (let i = 0; i < each_value.length; i += 1) {
				transition_in(each_blocks[i]);
			}

			current = true;
		},
		o(local) {
			each_blocks = each_blocks.filter(Boolean);

			for (let i = 0; i < each_blocks.length; i += 1) {
				transition_out(each_blocks[i]);
			}

			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(each_1_anchor);
			}

			destroy_each(each_blocks, detaching);
		}
	};
}

// (90:2) <DebugH2 slot="title">
function create_default_slot$2(ctx) {
	let t;

	return {
		c() {
			t = text("Lights");
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		d(detaching) {
			if (detaching) {
				detach(t);
			}
		}
	};
}

// (90:2) 
function create_title_slot$2(ctx) {
	let debugh2;
	let current;

	debugh2 = new DebugH2({
			props: {
				slot: "title",
				$$slots: { default: [create_default_slot$2] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(debugh2.$$.fragment);
		},
		m(target, anchor) {
			mount_component(debugh2, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const debugh2_changes = {};

			if (dirty & /*$$scope*/ 4194304) {
				debugh2_changes.$$scope = { dirty, ctx };
			}

			debugh2.$set(debugh2_changes);
		},
		i(local) {
			if (current) return;
			transition_in(debugh2.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(debugh2.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(debugh2, detaching);
		}
	};
}

function create_fragment$4(ctx) {
	let debugblock;
	let current;

	debugblock = new DebugBlock({
			props: {
				$$slots: {
					title: [create_title_slot$2],
					default: [create_default_slot_1$2]
				},
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(debugblock.$$.fragment);
		},
		m(target, anchor) {
			mount_component(debugblock, target, anchor);
			current = true;
		},
		p(ctx, [dirty]) {
			const debugblock_changes = {};

			if (dirty & /*$$scope, $lights*/ 4194305) {
				debugblock_changes.$$scope = { dirty, ctx };
			}

			debugblock.$set(debugblock_changes);
		},
		i(local) {
			if (current) return;
			transition_in(debugblock.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(debugblock.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(debugblock, detaching);
		}
	};
}

function instance$4($$self, $$props, $$invalidate) {
	let $lights;
	component_subscribe($$self, lights, $$value => $$invalidate(0, $lights = $$value));

	const lightPropsRange = {
		intensity: [0, 30],
		ambientIntensity: [0, 1],
		cutoffDistance: [0, 30],
		decayExponent: [0, 5]
	};

	function getRangeMin(key) {
		return lightPropsRange[key][0];
	}

	function getRangeMax(key) {
		return lightPropsRange[key][1];
	}

	function getRangeStep(key) {
		return (lightPropsRange[key][1] - lightPropsRange[key][0]) / 20;
	}

	function onLightColorChange(e, light) {
		console.log(cssStringColorToLinearArray(e.detail.color));

		light.set({
			...get_store_value(light),
			color: cssStringColorToLinearArray(e.detail.color)
		});
	}

	function onLightIntensityChange(e, light) {
		light.set({
			...get_store_value(light),
			intensity: e.detail.number
		});
	}

	function onLightXChange(e, light) {
		const lightValue = get_store_value(light);

		light.set({
			...lightValue,
			position: [e.detail.number, lightValue.position[1], lightValue.position[2]]
		});
	}

	function onLightYChange(e, light) {
		const lightValue = get_store_value(light);

		light.set({
			...lightValue,
			position: [lightValue.position[0], e.detail.number, lightValue.position[2]]
		});
	}

	function onLightZChange(e, light) {
		const lightValue = get_store_value(light);

		light.set({
			...lightValue,
			position: [lightValue.position[0], lightValue.position[1], e.detail.number]
		});
	}

	function onLightCutoffDistanceChange(e, light) {
		light.set({
			...get_store_value(light),
			cutoffDistance: e.detail.number
		});
	}

	function onLightDecayExponentChange(e, light) {
		light.set({
			...get_store_value(light),
			decayExponent: e.detail.number
		});
	}

	const change_handler = (light, e) => onLightColorChange(e, light);
	const change_handler_1 = (light, e) => onLightIntensityChange(e, light);
	const change_handler_2 = (light, e) => onLightXChange(e, light);
	const change_handler_3 = (light, e) => onLightYChange(e, light);
	const change_handler_4 = (light, e) => onLightZChange(e, light);
	const change_handler_5 = (light, e) => onLightCutoffDistanceChange(e, light);
	const change_handler_6 = (light, e) => onLightDecayExponentChange(e, light);

	return [
		$lights,
		getRangeMin,
		getRangeMax,
		getRangeStep,
		onLightColorChange,
		onLightIntensityChange,
		onLightXChange,
		onLightYChange,
		onLightZChange,
		onLightCutoffDistanceChange,
		onLightDecayExponentChange,
		change_handler,
		change_handler_1,
		change_handler_2,
		change_handler_3,
		change_handler_4,
		change_handler_5,
		change_handler_6
	];
}

class DebugLights extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});
	}
}

/* src\components\DebugPanel\DebugMaterial.svelte generated by Svelte v4.2.18 */

function add_css$3(target) {
	append_styles(target, "svelte-138lyw9", "a.svelte-138lyw9{color:var(--panel-light-color);padding:0px 7px}");
}

function get_each_context$2(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[6] = list[i][0];
	child_ctx[7] = list[i][1];
	return child_ctx;
}

function get_each_context_1$1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[10] = list[i][0];
	child_ctx[11] = list[i][1];
	return child_ctx;
}

// (49:44) 
function create_if_block_3(ctx) {
	let debugblock;
	let current;

	debugblock = new DebugBlock({
			props: {
				level: 4,
				$$slots: {
					title: [create_title_slot_1$1],
					default: [create_default_slot_5$1]
				},
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(debugblock.$$.fragment);
		},
		m(target, anchor) {
			mount_component(debugblock, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const debugblock_changes = {};

			if (dirty & /*$$scope, material*/ 16385) {
				debugblock_changes.$$scope = { dirty, ctx };
			}

			debugblock.$set(debugblock_changes);
		},
		i(local) {
			if (current) return;
			transition_in(debugblock.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(debugblock.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(debugblock, detaching);
		}
	};
}

// (41:40) 
function create_if_block_2(ctx) {
	let debugh4;
	let t;
	let debugslidernumber;
	let current;

	debugh4 = new DebugH4({
			props: {
				padding: "1",
				$$slots: { default: [create_default_slot_3$1] },
				$$scope: { ctx }
			}
		});

	debugslidernumber = new DebugSliderNumber({
			props: {
				min: /*getRangeMin*/ ctx[2](/*key*/ ctx[6]),
				max: /*getRangeMax*/ ctx[3](/*key*/ ctx[6]),
				step: /*getRangeStep*/ ctx[4](/*key*/ ctx[6]),
				value: /*value*/ ctx[7]
			}
		});

	return {
		c() {
			create_component(debugh4.$$.fragment);
			t = space();
			create_component(debugslidernumber.$$.fragment);
		},
		m(target, anchor) {
			mount_component(debugh4, target, anchor);
			insert(target, t, anchor);
			mount_component(debugslidernumber, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const debugh4_changes = {};

			if (dirty & /*$$scope, material*/ 16385) {
				debugh4_changes.$$scope = { dirty, ctx };
			}

			debugh4.$set(debugh4_changes);
			const debugslidernumber_changes = {};
			if (dirty & /*material*/ 1) debugslidernumber_changes.min = /*getRangeMin*/ ctx[2](/*key*/ ctx[6]);
			if (dirty & /*material*/ 1) debugslidernumber_changes.max = /*getRangeMax*/ ctx[3](/*key*/ ctx[6]);
			if (dirty & /*material*/ 1) debugslidernumber_changes.step = /*getRangeStep*/ ctx[4](/*key*/ ctx[6]);
			if (dirty & /*material*/ 1) debugslidernumber_changes.value = /*value*/ ctx[7];
			debugslidernumber.$set(debugslidernumber_changes);
		},
		i(local) {
			if (current) return;
			transition_in(debugh4.$$.fragment, local);
			transition_in(debugslidernumber.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(debugh4.$$.fragment, local);
			transition_out(debugslidernumber.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(t);
			}

			destroy_component(debugh4, detaching);
			destroy_component(debugslidernumber, detaching);
		}
	};
}

// (39:48) 
function create_if_block_1(ctx) {
	let debugcolor;
	let current;

	debugcolor = new DebugColor({
			props: {
				label: /*key*/ ctx[6],
				color: /*value*/ ctx[7]
			}
		});

	return {
		c() {
			create_component(debugcolor.$$.fragment);
		},
		m(target, anchor) {
			mount_component(debugcolor, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const debugcolor_changes = {};
			if (dirty & /*material*/ 1) debugcolor_changes.label = /*key*/ ctx[6];
			if (dirty & /*material*/ 1) debugcolor_changes.color = /*value*/ ctx[7];
			debugcolor.$set(debugcolor_changes);
		},
		i(local) {
			if (current) return;
			transition_in(debugcolor.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(debugcolor.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(debugcolor, detaching);
		}
	};
}

// (36:4) {#if key.includes("Map")}
function create_if_block(ctx) {
	let debugh4;
	let t0;
	let a;
	let t1_value = getFileName(/*value*/ ctx[7].url) + "";
	let t1;
	let a_href_value;
	let current;

	debugh4 = new DebugH4({
			props: {
				padding: "1",
				$$slots: { default: [create_default_slot_2$1] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(debugh4.$$.fragment);
			t0 = space();
			a = element("a");
			t1 = text(t1_value);
			attr(a, "href", a_href_value = "./" + /*value*/ ctx[7].url);
			attr(a, "class", "svelte-138lyw9");
		},
		m(target, anchor) {
			mount_component(debugh4, target, anchor);
			insert(target, t0, anchor);
			insert(target, a, anchor);
			append(a, t1);
			current = true;
		},
		p(ctx, dirty) {
			const debugh4_changes = {};

			if (dirty & /*$$scope, material*/ 16385) {
				debugh4_changes.$$scope = { dirty, ctx };
			}

			debugh4.$set(debugh4_changes);
			if ((!current || dirty & /*material*/ 1) && t1_value !== (t1_value = getFileName(/*value*/ ctx[7].url) + "")) set_data(t1, t1_value);

			if (!current || dirty & /*material*/ 1 && a_href_value !== (a_href_value = "./" + /*value*/ ctx[7].url)) {
				attr(a, "href", a_href_value);
			}
		},
		i(local) {
			if (current) return;
			transition_in(debugh4.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(debugh4.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(t0);
				detach(a);
			}

			destroy_component(debugh4, detaching);
		}
	};
}

// (61:55) 
function create_if_block_5(ctx) {
	let debugcolor;
	let current;

	debugcolor = new DebugColor({
			props: {
				label: /*k*/ ctx[10],
				color: /*v*/ ctx[11]
			}
		});

	return {
		c() {
			create_component(debugcolor.$$.fragment);
		},
		m(target, anchor) {
			mount_component(debugcolor, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const debugcolor_changes = {};
			if (dirty & /*material*/ 1) debugcolor_changes.label = /*k*/ ctx[10];
			if (dirty & /*material*/ 1) debugcolor_changes.color = /*v*/ ctx[11];
			debugcolor.$set(debugcolor_changes);
		},
		i(local) {
			if (current) return;
			transition_in(debugcolor.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(debugcolor.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(debugcolor, detaching);
		}
	};
}

// (53:10) {#if typeof v === "number"}
function create_if_block_4(ctx) {
	let debugh4;
	let t;
	let debugslidernumber;
	let current;

	debugh4 = new DebugH4({
			props: {
				padding: "1",
				$$slots: { default: [create_default_slot_6$1] },
				$$scope: { ctx }
			}
		});

	debugslidernumber = new DebugSliderNumber({
			props: {
				min: /*getRangeMin*/ ctx[2](/*k*/ ctx[10]),
				max: /*getRangeMax*/ ctx[3](/*k*/ ctx[10]),
				step: /*getRangeStep*/ ctx[4](/*k*/ ctx[10]),
				value: /*v*/ ctx[11]
			}
		});

	return {
		c() {
			create_component(debugh4.$$.fragment);
			t = space();
			create_component(debugslidernumber.$$.fragment);
		},
		m(target, anchor) {
			mount_component(debugh4, target, anchor);
			insert(target, t, anchor);
			mount_component(debugslidernumber, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const debugh4_changes = {};

			if (dirty & /*$$scope, material*/ 16385) {
				debugh4_changes.$$scope = { dirty, ctx };
			}

			debugh4.$set(debugh4_changes);
			const debugslidernumber_changes = {};
			if (dirty & /*material*/ 1) debugslidernumber_changes.min = /*getRangeMin*/ ctx[2](/*k*/ ctx[10]);
			if (dirty & /*material*/ 1) debugslidernumber_changes.max = /*getRangeMax*/ ctx[3](/*k*/ ctx[10]);
			if (dirty & /*material*/ 1) debugslidernumber_changes.step = /*getRangeStep*/ ctx[4](/*k*/ ctx[10]);
			if (dirty & /*material*/ 1) debugslidernumber_changes.value = /*v*/ ctx[11];
			debugslidernumber.$set(debugslidernumber_changes);
		},
		i(local) {
			if (current) return;
			transition_in(debugh4.$$.fragment, local);
			transition_in(debugslidernumber.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(debugh4.$$.fragment, local);
			transition_out(debugslidernumber.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(t);
			}

			destroy_component(debugh4, detaching);
			destroy_component(debugslidernumber, detaching);
		}
	};
}

// (54:12) <DebugH4 padding="1">
function create_default_slot_6$1(ctx) {
	let t_value = /*k*/ ctx[10] + "";
	let t;

	return {
		c() {
			t = text(t_value);
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		p(ctx, dirty) {
			if (dirty & /*material*/ 1 && t_value !== (t_value = /*k*/ ctx[10] + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) {
				detach(t);
			}
		}
	};
}

// (52:8) {#each Object.entries(value).filter((p) => !(typeof p[1] === "function")) as [k, v]}
function create_each_block_1$1(ctx) {
	let show_if;
	let current_block_type_index;
	let if_block;
	let if_block_anchor;
	let current;
	const if_block_creators = [create_if_block_4, create_if_block_5];
	const if_blocks = [];

	function select_block_type_1(ctx, dirty) {
		if (dirty & /*material*/ 1) show_if = null;
		if (typeof /*v*/ ctx[11] === "number") return 0;
		if (show_if == null) show_if = !!(Array.isArray(/*v*/ ctx[11]) && /*v*/ ctx[11].length === 3);
		if (show_if) return 1;
		return -1;
	}

	if (~(current_block_type_index = select_block_type_1(ctx, -1))) {
		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
	}

	return {
		c() {
			if (if_block) if_block.c();
			if_block_anchor = empty();
		},
		m(target, anchor) {
			if (~current_block_type_index) {
				if_blocks[current_block_type_index].m(target, anchor);
			}

			insert(target, if_block_anchor, anchor);
			current = true;
		},
		p(ctx, dirty) {
			let previous_block_index = current_block_type_index;
			current_block_type_index = select_block_type_1(ctx, dirty);

			if (current_block_type_index === previous_block_index) {
				if (~current_block_type_index) {
					if_blocks[current_block_type_index].p(ctx, dirty);
				}
			} else {
				if (if_block) {
					group_outros();

					transition_out(if_blocks[previous_block_index], 1, 1, () => {
						if_blocks[previous_block_index] = null;
					});

					check_outros();
				}

				if (~current_block_type_index) {
					if_block = if_blocks[current_block_type_index];

					if (!if_block) {
						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
						if_block.c();
					} else {
						if_block.p(ctx, dirty);
					}

					transition_in(if_block, 1);
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				} else {
					if_block = null;
				}
			}
		},
		i(local) {
			if (current) return;
			transition_in(if_block);
			current = true;
		},
		o(local) {
			transition_out(if_block);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(if_block_anchor);
			}

			if (~current_block_type_index) {
				if_blocks[current_block_type_index].d(detaching);
			}
		}
	};
}

// (50:6) <DebugBlock level={4}>
function create_default_slot_5$1(ctx) {
	let t;
	let current;
	let each_value_1 = ensure_array_like(Object.entries(/*value*/ ctx[7]).filter(func_1));
	let each_blocks = [];

	for (let i = 0; i < each_value_1.length; i += 1) {
		each_blocks[i] = create_each_block_1$1(get_each_context_1$1(ctx, each_value_1, i));
	}

	const out = i => transition_out(each_blocks[i], 1, 1, () => {
		each_blocks[i] = null;
	});

	return {
		c() {
			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t = space();
		},
		m(target, anchor) {
			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(target, anchor);
				}
			}

			insert(target, t, anchor);
			current = true;
		},
		p(ctx, dirty) {
			if (dirty & /*getRangeMin, Object, material, getRangeMax, getRangeStep, Array*/ 29) {
				each_value_1 = ensure_array_like(Object.entries(/*value*/ ctx[7]).filter(func_1));
				let i;

				for (i = 0; i < each_value_1.length; i += 1) {
					const child_ctx = get_each_context_1$1(ctx, each_value_1, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
						transition_in(each_blocks[i], 1);
					} else {
						each_blocks[i] = create_each_block_1$1(child_ctx);
						each_blocks[i].c();
						transition_in(each_blocks[i], 1);
						each_blocks[i].m(t.parentNode, t);
					}
				}

				group_outros();

				for (i = each_value_1.length; i < each_blocks.length; i += 1) {
					out(i);
				}

				check_outros();
			}
		},
		i(local) {
			if (current) return;

			for (let i = 0; i < each_value_1.length; i += 1) {
				transition_in(each_blocks[i]);
			}

			current = true;
		},
		o(local) {
			each_blocks = each_blocks.filter(Boolean);

			for (let i = 0; i < each_blocks.length; i += 1) {
				transition_out(each_blocks[i]);
			}

			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(t);
			}

			destroy_each(each_blocks, detaching);
		}
	};
}

// (51:8) <DebugH4 slot="title">
function create_default_slot_4$1(ctx) {
	let t_value = /*key*/ ctx[6] + "";
	let t;

	return {
		c() {
			t = text(t_value);
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		p(ctx, dirty) {
			if (dirty & /*material*/ 1 && t_value !== (t_value = /*key*/ ctx[6] + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) {
				detach(t);
			}
		}
	};
}

// (51:8) 
function create_title_slot_1$1(ctx) {
	let debugh4;
	let current;

	debugh4 = new DebugH4({
			props: {
				slot: "title",
				$$slots: { default: [create_default_slot_4$1] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(debugh4.$$.fragment);
		},
		m(target, anchor) {
			mount_component(debugh4, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const debugh4_changes = {};

			if (dirty & /*$$scope, material*/ 16385) {
				debugh4_changes.$$scope = { dirty, ctx };
			}

			debugh4.$set(debugh4_changes);
		},
		i(local) {
			if (current) return;
			transition_in(debugh4.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(debugh4.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(debugh4, detaching);
		}
	};
}

// (42:6) <DebugH4 padding="1">
function create_default_slot_3$1(ctx) {
	let t_value = /*key*/ ctx[6] + "";
	let t;

	return {
		c() {
			t = text(t_value);
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		p(ctx, dirty) {
			if (dirty & /*material*/ 1 && t_value !== (t_value = /*key*/ ctx[6] + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) {
				detach(t);
			}
		}
	};
}

// (37:6) <DebugH4 padding="1">
function create_default_slot_2$1(ctx) {
	let t_value = /*key*/ ctx[6] + "";
	let t;

	return {
		c() {
			t = text(t_value);
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		p(ctx, dirty) {
			if (dirty & /*material*/ 1 && t_value !== (t_value = /*key*/ ctx[6] + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) {
				detach(t);
			}
		}
	};
}

// (35:2) {#each Object.entries(get(material)) as [key, value]}
function create_each_block$2(ctx) {
	let show_if;
	let show_if_1;
	let show_if_2;
	let current_block_type_index;
	let if_block;
	let if_block_anchor;
	let current;

	function func(...args) {
		return /*func*/ ctx[5](/*key*/ ctx[6], ...args);
	}

	const if_block_creators = [create_if_block, create_if_block_1, create_if_block_2, create_if_block_3];
	const if_blocks = [];

	function select_block_type(ctx, dirty) {
		if (dirty & /*material*/ 1) show_if = null;
		if (dirty & /*material*/ 1) show_if_1 = null;
		if (dirty & /*material*/ 1) show_if_2 = null;
		if (show_if == null) show_if = !!/*key*/ ctx[6].includes("Map");
		if (show_if) return 0;
		if (show_if_1 == null) show_if_1 = !!colorProps.some(func);
		if (show_if_1) return 1;
		if (/*key*/ ctx[6] in /*materialPropsRange*/ ctx[1]) return 2;
		if (show_if_2 == null) show_if_2 = !!(Object.keys(/*value*/ ctx[7]).length > 0);
		if (show_if_2) return 3;
		return -1;
	}

	if (~(current_block_type_index = select_block_type(ctx, -1))) {
		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
	}

	return {
		c() {
			if (if_block) if_block.c();
			if_block_anchor = empty();
		},
		m(target, anchor) {
			if (~current_block_type_index) {
				if_blocks[current_block_type_index].m(target, anchor);
			}

			insert(target, if_block_anchor, anchor);
			current = true;
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;
			let previous_block_index = current_block_type_index;
			current_block_type_index = select_block_type(ctx, dirty);

			if (current_block_type_index === previous_block_index) {
				if (~current_block_type_index) {
					if_blocks[current_block_type_index].p(ctx, dirty);
				}
			} else {
				if (if_block) {
					group_outros();

					transition_out(if_blocks[previous_block_index], 1, 1, () => {
						if_blocks[previous_block_index] = null;
					});

					check_outros();
				}

				if (~current_block_type_index) {
					if_block = if_blocks[current_block_type_index];

					if (!if_block) {
						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
						if_block.c();
					} else {
						if_block.p(ctx, dirty);
					}

					transition_in(if_block, 1);
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				} else {
					if_block = null;
				}
			}
		},
		i(local) {
			if (current) return;
			transition_in(if_block);
			current = true;
		},
		o(local) {
			transition_out(if_block);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(if_block_anchor);
			}

			if (~current_block_type_index) {
				if_blocks[current_block_type_index].d(detaching);
			}
		}
	};
}

// (33:0) <DebugBlock level={3}>
function create_default_slot_1$1(ctx) {
	let each_1_anchor;
	let current;
	let each_value = ensure_array_like(Object.entries(get_store_value(/*material*/ ctx[0])));
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
	}

	const out = i => transition_out(each_blocks[i], 1, 1, () => {
		each_blocks[i] = null;
	});

	return {
		c() {
			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			each_1_anchor = empty();
		},
		m(target, anchor) {
			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(target, anchor);
				}
			}

			insert(target, each_1_anchor, anchor);
			current = true;
		},
		p(ctx, dirty) {
			if (dirty & /*Object, material, getFileName, getRangeMin, getRangeMax, getRangeStep, materialPropsRange, Array*/ 31) {
				each_value = ensure_array_like(Object.entries(get_store_value(/*material*/ ctx[0])));
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context$2(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
						transition_in(each_blocks[i], 1);
					} else {
						each_blocks[i] = create_each_block$2(child_ctx);
						each_blocks[i].c();
						transition_in(each_blocks[i], 1);
						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
					}
				}

				group_outros();

				for (i = each_value.length; i < each_blocks.length; i += 1) {
					out(i);
				}

				check_outros();
			}
		},
		i(local) {
			if (current) return;

			for (let i = 0; i < each_value.length; i += 1) {
				transition_in(each_blocks[i]);
			}

			current = true;
		},
		o(local) {
			each_blocks = each_blocks.filter(Boolean);

			for (let i = 0; i < each_blocks.length; i += 1) {
				transition_out(each_blocks[i]);
			}

			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(each_1_anchor);
			}

			destroy_each(each_blocks, detaching);
		}
	};
}

// (34:2) <DebugH4 slot="title">
function create_default_slot$1(ctx) {
	let t;

	return {
		c() {
			t = text("Material");
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		d(detaching) {
			if (detaching) {
				detach(t);
			}
		}
	};
}

// (34:2) 
function create_title_slot$1(ctx) {
	let debugh4;
	let current;

	debugh4 = new DebugH4({
			props: {
				slot: "title",
				$$slots: { default: [create_default_slot$1] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(debugh4.$$.fragment);
		},
		m(target, anchor) {
			mount_component(debugh4, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const debugh4_changes = {};

			if (dirty & /*$$scope*/ 16384) {
				debugh4_changes.$$scope = { dirty, ctx };
			}

			debugh4.$set(debugh4_changes);
		},
		i(local) {
			if (current) return;
			transition_in(debugh4.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(debugh4.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(debugh4, detaching);
		}
	};
}

function create_fragment$3(ctx) {
	let debugblock;
	let current;

	debugblock = new DebugBlock({
			props: {
				level: 3,
				$$slots: {
					title: [create_title_slot$1],
					default: [create_default_slot_1$1]
				},
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(debugblock.$$.fragment);
		},
		m(target, anchor) {
			mount_component(debugblock, target, anchor);
			current = true;
		},
		p(ctx, [dirty]) {
			const debugblock_changes = {};

			if (dirty & /*$$scope, material*/ 16385) {
				debugblock_changes.$$scope = { dirty, ctx };
			}

			debugblock.$set(debugblock_changes);
		},
		i(local) {
			if (current) return;
			transition_in(debugblock.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(debugblock.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(debugblock, detaching);
		}
	};
}

function getFileName(url) {
	return url.split("/").pop();
}

const func_1 = p => !(typeof p[1] === "function");

function instance$3($$self, $$props, $$invalidate) {
	const materialPropsRange = {
		opacity: [0, 1],
		roughness: [0, 1],
		metalness: [0, 1],
		ior: [0, 2],
		intensity: [0, 30]
	};

	function getRangeMin(key) {
		return materialPropsRange[key][0];
	}

	function getRangeMax(key) {
		return materialPropsRange[key][1];
	}

	function getRangeStep(key) {
		return (materialPropsRange[key][1] - materialPropsRange[key][0]) / 20;
	}

	let { material } = $$props;
	const func = (key, c) => c === key;

	$$self.$$set = $$props => {
		if ('material' in $$props) $$invalidate(0, material = $$props.material);
	};

	return [material, materialPropsRange, getRangeMin, getRangeMax, getRangeStep, func];
}

class DebugMaterial extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$3, create_fragment$3, safe_not_equal, { material: 0 }, add_css$3);
	}
}

/* src\components\DebugPanel\DebugMatrix.svelte generated by Svelte v4.2.18 */

function add_css$2(target) {
	append_styles(target, "svelte-1x8nk3h", "div.svelte-1x8nk3h{display:grid;grid-template-columns:repeat(4, 1fr);gap:5px;padding:5px 40px}span.svelte-1x8nk3h{font-size:0.8rem;color:var(--panel-light-color);background:var(--panel-dark-color);padding:var(--panel-horizontal-padding) var(--panel-vertical-padding);border-radius:0.3125rem}");
}

function get_each_context$1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[1] = list[i];
	return child_ctx;
}

// (8:2) {#each matrix as num}
function create_each_block$1(ctx) {
	let span;
	let t_value = /*num*/ ctx[1] + "";
	let t;

	return {
		c() {
			span = element("span");
			t = text(t_value);
			attr(span, "class", "svelte-1x8nk3h");
		},
		m(target, anchor) {
			insert(target, span, anchor);
			append(span, t);
		},
		p(ctx, dirty) {
			if (dirty & /*matrix*/ 1 && t_value !== (t_value = /*num*/ ctx[1] + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) {
				detach(span);
			}
		}
	};
}

function create_fragment$2(ctx) {
	let div;
	let each_value = ensure_array_like(/*matrix*/ ctx[0]);
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
	}

	return {
		c() {
			div = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			attr(div, "class", "svelte-1x8nk3h");
		},
		m(target, anchor) {
			insert(target, div, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(div, null);
				}
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*matrix*/ 1) {
				each_value = ensure_array_like(/*matrix*/ ctx[0]);
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context$1(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block$1(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(div, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value.length;
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) {
				detach(div);
			}

			destroy_each(each_blocks, detaching);
		}
	};
}

function instance$2($$self, $$props, $$invalidate) {
	let { matrix } = $$props;

	$$self.$$set = $$props => {
		if ('matrix' in $$props) $$invalidate(0, matrix = $$props.matrix);
	};

	return [matrix];
}

class DebugMatrix extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$2, create_fragment$2, safe_not_equal, { matrix: 0 }, add_css$2);
	}
}

/* src\components\DebugPanel\DebugMeshes.svelte generated by Svelte v4.2.18 */

function add_css$1(target) {
	append_styles(target, "svelte-1qktr34", "span.svelte-1qktr34{padding:0px 7px}");
}

function get_each_context(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[1] = list[i].attributes;
	child_ctx[2] = list[i].drawMode;
	child_ctx[3] = list[i].matrix;
	child_ctx[4] = list[i].material;
	child_ctx[6] = i;
	return child_ctx;
}

function get_each_context_1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[7] = list[i][0];
	child_ctx[8] = list[i][1];
	return child_ctx;
}

// (20:8) {#each Object.entries(attributes) as [key, value]}
function create_each_block_1(ctx) {
	let span;
	let t0_value = /*key*/ ctx[7] + "";
	let t0;
	let t1;
	let t2_value = /*value*/ ctx[8].length + "";
	let t2;

	return {
		c() {
			span = element("span");
			t0 = text(t0_value);
			t1 = text(": ");
			t2 = text(t2_value);
			attr(span, "class", "svelte-1qktr34");
		},
		m(target, anchor) {
			insert(target, span, anchor);
			append(span, t0);
			append(span, t1);
			append(span, t2);
		},
		p(ctx, dirty) {
			if (dirty & /*$meshes*/ 1 && t0_value !== (t0_value = /*key*/ ctx[7] + "")) set_data(t0, t0_value);
			if (dirty & /*$meshes*/ 1 && t2_value !== (t2_value = /*value*/ ctx[8].length + "")) set_data(t2, t2_value);
		},
		d(detaching) {
			if (detaching) {
				detach(span);
			}
		}
	};
}

// (18:6) <DebugBlock level={3}>
function create_default_slot_9(ctx) {
	let each_1_anchor;
	let each_value_1 = ensure_array_like(Object.entries(/*attributes*/ ctx[1]));
	let each_blocks = [];

	for (let i = 0; i < each_value_1.length; i += 1) {
		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
	}

	return {
		c() {
			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			each_1_anchor = empty();
		},
		m(target, anchor) {
			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(target, anchor);
				}
			}

			insert(target, each_1_anchor, anchor);
		},
		p(ctx, dirty) {
			if (dirty & /*Object, $meshes*/ 1) {
				each_value_1 = ensure_array_like(Object.entries(/*attributes*/ ctx[1]));
				let i;

				for (i = 0; i < each_value_1.length; i += 1) {
					const child_ctx = get_each_context_1(ctx, each_value_1, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block_1(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value_1.length;
			}
		},
		d(detaching) {
			if (detaching) {
				detach(each_1_anchor);
			}

			destroy_each(each_blocks, detaching);
		}
	};
}

// (19:8) <DebugH4 slot="title">
function create_default_slot_8(ctx) {
	let t;

	return {
		c() {
			t = text("Attributes");
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		d(detaching) {
			if (detaching) {
				detach(t);
			}
		}
	};
}

// (19:8) 
function create_title_slot_4(ctx) {
	let debugh4;
	let current;

	debugh4 = new DebugH4({
			props: {
				slot: "title",
				$$slots: { default: [create_default_slot_8] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(debugh4.$$.fragment);
		},
		m(target, anchor) {
			mount_component(debugh4, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const debugh4_changes = {};

			if (dirty & /*$$scope*/ 2048) {
				debugh4_changes.$$scope = { dirty, ctx };
			}

			debugh4.$set(debugh4_changes);
		},
		i(local) {
			if (current) return;
			transition_in(debugh4.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(debugh4.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(debugh4, detaching);
		}
	};
}

// (24:6) <DebugBlock level={3}>
function create_default_slot_7(ctx) {
	let span;
	let t_value = /*drawMode*/ ctx[2] + "";
	let t;

	return {
		c() {
			span = element("span");
			t = text(t_value);
			attr(span, "class", "svelte-1qktr34");
		},
		m(target, anchor) {
			insert(target, span, anchor);
			append(span, t);
		},
		p(ctx, dirty) {
			if (dirty & /*$meshes*/ 1 && t_value !== (t_value = /*drawMode*/ ctx[2] + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) {
				detach(span);
			}
		}
	};
}

// (25:8) <DebugH4 slot="title">
function create_default_slot_6(ctx) {
	let t;

	return {
		c() {
			t = text("Draw Mode");
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		d(detaching) {
			if (detaching) {
				detach(t);
			}
		}
	};
}

// (25:8) 
function create_title_slot_3(ctx) {
	let debugh4;
	let current;

	debugh4 = new DebugH4({
			props: {
				slot: "title",
				$$slots: { default: [create_default_slot_6] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(debugh4.$$.fragment);
		},
		m(target, anchor) {
			mount_component(debugh4, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const debugh4_changes = {};

			if (dirty & /*$$scope*/ 2048) {
				debugh4_changes.$$scope = { dirty, ctx };
			}

			debugh4.$set(debugh4_changes);
		},
		i(local) {
			if (current) return;
			transition_in(debugh4.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(debugh4.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(debugh4, detaching);
		}
	};
}

// (28:6) <DebugBlock level={3}>
function create_default_slot_5(ctx) {
	let debugmatrix;
	let current;

	debugmatrix = new DebugMatrix({
			props: { matrix: get_store_value(/*matrix*/ ctx[3]) }
		});

	return {
		c() {
			create_component(debugmatrix.$$.fragment);
		},
		m(target, anchor) {
			mount_component(debugmatrix, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const debugmatrix_changes = {};
			if (dirty & /*$meshes*/ 1) debugmatrix_changes.matrix = get_store_value(/*matrix*/ ctx[3]);
			debugmatrix.$set(debugmatrix_changes);
		},
		i(local) {
			if (current) return;
			transition_in(debugmatrix.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(debugmatrix.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(debugmatrix, detaching);
		}
	};
}

// (29:8) <DebugH4 slot="title">
function create_default_slot_4(ctx) {
	let t;

	return {
		c() {
			t = text("Matrix");
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		d(detaching) {
			if (detaching) {
				detach(t);
			}
		}
	};
}

// (29:8) 
function create_title_slot_2(ctx) {
	let debugh4;
	let current;

	debugh4 = new DebugH4({
			props: {
				slot: "title",
				$$slots: { default: [create_default_slot_4] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(debugh4.$$.fragment);
		},
		m(target, anchor) {
			mount_component(debugh4, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const debugh4_changes = {};

			if (dirty & /*$$scope*/ 2048) {
				debugh4_changes.$$scope = { dirty, ctx };
			}

			debugh4.$set(debugh4_changes);
		},
		i(local) {
			if (current) return;
			transition_in(debugh4.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(debugh4.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(debugh4, detaching);
		}
	};
}

// (16:4) <DebugBlock level={2}>
function create_default_slot_3(ctx) {
	let debugblock0;
	let t0;
	let debugblock1;
	let t1;
	let debugblock2;
	let t2;
	let debugmaterial;
	let t3;
	let current;

	debugblock0 = new DebugBlock({
			props: {
				level: 3,
				$$slots: {
					title: [create_title_slot_4],
					default: [create_default_slot_9]
				},
				$$scope: { ctx }
			}
		});

	debugblock1 = new DebugBlock({
			props: {
				level: 3,
				$$slots: {
					title: [create_title_slot_3],
					default: [create_default_slot_7]
				},
				$$scope: { ctx }
			}
		});

	debugblock2 = new DebugBlock({
			props: {
				level: 3,
				$$slots: {
					title: [create_title_slot_2],
					default: [create_default_slot_5]
				},
				$$scope: { ctx }
			}
		});

	debugmaterial = new DebugMaterial({ props: { material: /*material*/ ctx[4] } });

	return {
		c() {
			create_component(debugblock0.$$.fragment);
			t0 = space();
			create_component(debugblock1.$$.fragment);
			t1 = space();
			create_component(debugblock2.$$.fragment);
			t2 = space();
			create_component(debugmaterial.$$.fragment);
			t3 = space();
		},
		m(target, anchor) {
			mount_component(debugblock0, target, anchor);
			insert(target, t0, anchor);
			mount_component(debugblock1, target, anchor);
			insert(target, t1, anchor);
			mount_component(debugblock2, target, anchor);
			insert(target, t2, anchor);
			mount_component(debugmaterial, target, anchor);
			insert(target, t3, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const debugblock0_changes = {};

			if (dirty & /*$$scope, $meshes*/ 2049) {
				debugblock0_changes.$$scope = { dirty, ctx };
			}

			debugblock0.$set(debugblock0_changes);
			const debugblock1_changes = {};

			if (dirty & /*$$scope, $meshes*/ 2049) {
				debugblock1_changes.$$scope = { dirty, ctx };
			}

			debugblock1.$set(debugblock1_changes);
			const debugblock2_changes = {};

			if (dirty & /*$$scope, $meshes*/ 2049) {
				debugblock2_changes.$$scope = { dirty, ctx };
			}

			debugblock2.$set(debugblock2_changes);
			const debugmaterial_changes = {};
			if (dirty & /*$meshes*/ 1) debugmaterial_changes.material = /*material*/ ctx[4];
			debugmaterial.$set(debugmaterial_changes);
		},
		i(local) {
			if (current) return;
			transition_in(debugblock0.$$.fragment, local);
			transition_in(debugblock1.$$.fragment, local);
			transition_in(debugblock2.$$.fragment, local);
			transition_in(debugmaterial.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(debugblock0.$$.fragment, local);
			transition_out(debugblock1.$$.fragment, local);
			transition_out(debugblock2.$$.fragment, local);
			transition_out(debugmaterial.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(t0);
				detach(t1);
				detach(t2);
				detach(t3);
			}

			destroy_component(debugblock0, detaching);
			destroy_component(debugblock1, detaching);
			destroy_component(debugblock2, detaching);
			destroy_component(debugmaterial, detaching);
		}
	};
}

// (17:6) <DebugH3 slot="title">
function create_default_slot_2(ctx) {
	let t0;
	let t1;

	return {
		c() {
			t0 = text("Mesh ");
			t1 = text(/*i*/ ctx[6]);
		},
		m(target, anchor) {
			insert(target, t0, anchor);
			insert(target, t1, anchor);
		},
		p: noop,
		d(detaching) {
			if (detaching) {
				detach(t0);
				detach(t1);
			}
		}
	};
}

// (17:6) 
function create_title_slot_1(ctx) {
	let debugh3;
	let current;

	debugh3 = new DebugH3({
			props: {
				slot: "title",
				$$slots: { default: [create_default_slot_2] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(debugh3.$$.fragment);
		},
		m(target, anchor) {
			mount_component(debugh3, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const debugh3_changes = {};

			if (dirty & /*$$scope*/ 2048) {
				debugh3_changes.$$scope = { dirty, ctx };
			}

			debugh3.$set(debugh3_changes);
		},
		i(local) {
			if (current) return;
			transition_in(debugh3.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(debugh3.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(debugh3, detaching);
		}
	};
}

// (15:2) {#each $meshes as { attributes, drawMode, matrix, material }
function create_each_block(ctx) {
	let debugblock;
	let current;

	debugblock = new DebugBlock({
			props: {
				level: 2,
				$$slots: {
					title: [create_title_slot_1],
					default: [create_default_slot_3]
				},
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(debugblock.$$.fragment);
		},
		m(target, anchor) {
			mount_component(debugblock, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const debugblock_changes = {};

			if (dirty & /*$$scope, $meshes*/ 2049) {
				debugblock_changes.$$scope = { dirty, ctx };
			}

			debugblock.$set(debugblock_changes);
		},
		i(local) {
			if (current) return;
			transition_in(debugblock.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(debugblock.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(debugblock, detaching);
		}
	};
}

// (13:0) <DebugBlock>
function create_default_slot_1(ctx) {
	let each_1_anchor;
	let current;
	let each_value = ensure_array_like(/*$meshes*/ ctx[0]);
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
	}

	const out = i => transition_out(each_blocks[i], 1, 1, () => {
		each_blocks[i] = null;
	});

	return {
		c() {
			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			each_1_anchor = empty();
		},
		m(target, anchor) {
			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(target, anchor);
				}
			}

			insert(target, each_1_anchor, anchor);
			current = true;
		},
		p(ctx, dirty) {
			if (dirty & /*$meshes, Object*/ 1) {
				each_value = ensure_array_like(/*$meshes*/ ctx[0]);
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
						transition_in(each_blocks[i], 1);
					} else {
						each_blocks[i] = create_each_block(child_ctx);
						each_blocks[i].c();
						transition_in(each_blocks[i], 1);
						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
					}
				}

				group_outros();

				for (i = each_value.length; i < each_blocks.length; i += 1) {
					out(i);
				}

				check_outros();
			}
		},
		i(local) {
			if (current) return;

			for (let i = 0; i < each_value.length; i += 1) {
				transition_in(each_blocks[i]);
			}

			current = true;
		},
		o(local) {
			each_blocks = each_blocks.filter(Boolean);

			for (let i = 0; i < each_blocks.length; i += 1) {
				transition_out(each_blocks[i]);
			}

			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(each_1_anchor);
			}

			destroy_each(each_blocks, detaching);
		}
	};
}

// (14:2) <DebugH2 slot="title">
function create_default_slot(ctx) {
	let t;

	return {
		c() {
			t = text("Meshes");
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		d(detaching) {
			if (detaching) {
				detach(t);
			}
		}
	};
}

// (14:2) 
function create_title_slot(ctx) {
	let debugh2;
	let current;

	debugh2 = new DebugH2({
			props: {
				slot: "title",
				$$slots: { default: [create_default_slot] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(debugh2.$$.fragment);
		},
		m(target, anchor) {
			mount_component(debugh2, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const debugh2_changes = {};

			if (dirty & /*$$scope*/ 2048) {
				debugh2_changes.$$scope = { dirty, ctx };
			}

			debugh2.$set(debugh2_changes);
		},
		i(local) {
			if (current) return;
			transition_in(debugh2.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(debugh2.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(debugh2, detaching);
		}
	};
}

function create_fragment$1(ctx) {
	let debugblock;
	let current;

	debugblock = new DebugBlock({
			props: {
				$$slots: {
					title: [create_title_slot],
					default: [create_default_slot_1]
				},
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(debugblock.$$.fragment);
		},
		m(target, anchor) {
			mount_component(debugblock, target, anchor);
			current = true;
		},
		p(ctx, [dirty]) {
			const debugblock_changes = {};

			if (dirty & /*$$scope, $meshes*/ 2049) {
				debugblock_changes.$$scope = { dirty, ctx };
			}

			debugblock.$set(debugblock_changes);
		},
		i(local) {
			if (current) return;
			transition_in(debugblock.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(debugblock.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(debugblock, detaching);
		}
	};
}

function instance$1($$self, $$props, $$invalidate) {
	let $meshes;
	component_subscribe($$self, meshes, $$value => $$invalidate(0, $meshes = $$value));
	return [$meshes];
}

class DebugMeshes extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$1, create_fragment$1, safe_not_equal, {}, add_css$1);
	}
}

/* src\components\DebugPanel\DebugPanel.svelte generated by Svelte v4.2.18 */

function add_css(target) {
	append_styles(target, "svelte-5opaaz", ".panel.svelte-5opaaz{font-family:Arial, sans-serif;position:absolute;top:0;right:0;width:350px;height:100%;overflow-y:auto;color:white;background-color:var(--panel-darkest-color);--input-thumb-color:#cfcfcf;--input-track-color:#393939;--input-thumb-size:16px;--input-track-size:8px;--panel-darkest-color:#252525;--panel-dark-color:#393939;--panel-medium-color:#777777;--panel-medium-light-color:#b7b7b7;--panel-light-color:#cfcfcf;--panel-vertical-padding:7px;--panel-horizontal-padding:5px}.panelContent.svelte-5opaaz{display:flex;flex-direction:column;justify-content:center;align-items:left;gap:0px;margin:50px 0px 20px 0px}.collapsed.svelte-5opaaz{display:none !important}.collapseButton.svelte-5opaaz{font-size:1.5rem;font-weight:bold;background:none;border:none;color:inherit;cursor:pointer;position:absolute;top:0;right:0;width:50px;height:50px}.openButton.svelte-5opaaz{background-color:rgba(0, 0, 0, 0.8);color:white;display:flex;justify-content:center;align-items:center;font-family:Arial, sans-serif}");
}

function create_fragment(ctx) {
	let div0;
	let t1;
	let div2;
	let div1;
	let button;
	let t3;
	let debugrenderer;
	let t4;
	let debugcamera;
	let t5;
	let debugmeshes;
	let t6;
	let debuglights;
	let current;
	let mounted;
	let dispose;
	debugrenderer = new DebugRenderer({});
	debugcamera = new DebugCamera({});
	debugmeshes = new DebugMeshes({});
	debuglights = new DebugLights({});

	return {
		c() {
			div0 = element("div");
			div0.textContent = `${"<"}`;
			t1 = space();
			div2 = element("div");
			div1 = element("div");
			button = element("button");
			button.textContent = `${">"}`;
			t3 = space();
			create_component(debugrenderer.$$.fragment);
			t4 = space();
			create_component(debugcamera.$$.fragment);
			t5 = space();
			create_component(debugmeshes.$$.fragment);
			t6 = space();
			create_component(debuglights.$$.fragment);
			attr(div0, "class", "collapseButton openButton svelte-5opaaz");
			toggle_class(div0, "collapsed", !/*collapsed*/ ctx[0]);
			attr(button, "class", "collapseButton svelte-5opaaz");
			attr(div1, "class", "panelContent svelte-5opaaz");
			attr(div2, "class", "panel svelte-5opaaz");
			toggle_class(div2, "collapsed", /*collapsed*/ ctx[0]);
		},
		m(target, anchor) {
			insert(target, div0, anchor);
			insert(target, t1, anchor);
			insert(target, div2, anchor);
			append(div2, div1);
			append(div1, button);
			append(div1, t3);
			mount_component(debugrenderer, div1, null);
			append(div1, t4);
			mount_component(debugcamera, div1, null);
			append(div1, t5);
			mount_component(debugmeshes, div1, null);
			append(div1, t6);
			mount_component(debuglights, div1, null);
			current = true;

			if (!mounted) {
				dispose = [
					listen(div0, "click", /*collapse*/ ctx[1]),
					listen(button, "click", /*collapse*/ ctx[1])
				];

				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (!current || dirty & /*collapsed*/ 1) {
				toggle_class(div0, "collapsed", !/*collapsed*/ ctx[0]);
			}

			if (!current || dirty & /*collapsed*/ 1) {
				toggle_class(div2, "collapsed", /*collapsed*/ ctx[0]);
			}
		},
		i(local) {
			if (current) return;
			transition_in(debugrenderer.$$.fragment, local);
			transition_in(debugcamera.$$.fragment, local);
			transition_in(debugmeshes.$$.fragment, local);
			transition_in(debuglights.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(debugrenderer.$$.fragment, local);
			transition_out(debugcamera.$$.fragment, local);
			transition_out(debugmeshes.$$.fragment, local);
			transition_out(debuglights.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) {
				detach(div0);
				detach(t1);
				detach(div2);
			}

			destroy_component(debugrenderer);
			destroy_component(debugcamera);
			destroy_component(debugmeshes);
			destroy_component(debuglights);
			mounted = false;
			run_all(dispose);
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	function collapse() {
		$$invalidate(0, collapsed = !collapsed);
	}

	let collapsed = false;
	return [collapsed, collapse];
}

class DebugPanel extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, {}, add_css);
	}
}

export { skyblue as A, identity as B, translate as C, DebugPanel as D, createLightStore as E, createPointLight as F, create3DObject as G, createOrbitControls as H, binding_callbacks as I, createMaterialStore as J, createFlatShadedNormals as K, createPlane as L, Menu as M, templateLiteralRenderer as N, appContext as O, get_store_value as P, SvelteComponent as S, normalizeNormals as a, space as b, createVec3 as c, drawModes as d, element as e, create_component as f, insert as g, mount_component as h, init as i, noop as j, transition_out as k, lerp as l, multiplyScalarVec3 as m, normalize as n, detach as o, destroy_component as p, component_subscribe as q, onMount as r, safe_not_equal as s, transition_in as t, renderer as u, lights as v, scene as w, materials as x, camera as y, set_store_value as z };
