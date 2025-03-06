import { updateOneLight } from "../lights/point-light";
import { writable, get, derived } from "svelte/store";

/**
 *
 * @param {import("../lights/point-light.js").SvelteGLLightValue} initialProps
 * @returns {SvelteGLLightCustomStore}
 */

export const createLightStore = (initialProps) => {
	/** @type {SvelteGLLightStore} */
	const store = writable(initialProps);
	const { subscribe, set } = store;
	const light = {
		subscribe,
		set: (props) => {
			set(props);
			updateOneLight(get(lights), light);
			lights.set(get(lights));
			//renderer.set(get(renderer));
		},
	};
	return light;
};
/**
 * @returns {SvelteGLLightsCustomStore}
 */
function createLightsStore() {
	/** @type {import("svelte/store").Writable<Array<SvelteGLLightCustomStore>>} */
	const store = writable([]);
	const { subscribe, set } = store;
	const revisionStore = writable(0);
	return {
		subscribe,
		set: (next) => {
			set(next);
			revisionStore.update((revision) => revision + 1);
		},
		get revision() {
			return get(revisionStore);
		},
	};
}
export const lights = createLightsStore();

export const numLigths = derived([lights], ([$lights]) => {
	return $lights.length;
});
