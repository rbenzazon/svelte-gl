import { derived, get, writable } from "svelte/store";
import { updateOneLight } from "../lights/point-light";
import { appContext } from "./app-context";

/**
 *
 * @param {import("../lights/point-light.js").SvelteGLLightValue} initialProps
 * @returns {SvelteGLLightCustomStore}
 */

export const createLightStore = (initialProps, bindings) => {
	const lightsStore = bindings?.lights ?? lights;
	const ctx = bindings?.ctx ?? appContext;
	/** @type {SvelteGLLightStore} */
	const store = writable(initialProps);
	const { subscribe, set } = store;
	const light = {
		subscribe,
		set: (props) => {
			set(props);
			updateOneLight(get(lightsStore), light, ctx);
			lightsStore.set(get(lightsStore));
			//renderer.set(get(renderer));
		},
	};
	return light;
};
/**
 * @returns {SvelteGLLightsCustomStore}
 */
export function createLightsStore() {
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
