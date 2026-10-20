import { get, writable } from "svelte/store";
import { scene } from "./scene";

/**
 * @typedef {Object} MaterialCustomStore
 * @property {MaterialStore['subscribe']} subscribe
 * @property {MaterialStore['set']} set
 * @property {MaterialStore['update']} update
 */
/**
 * @param {SvelteGLMaterial} initialProps
 * @return {MaterialCustomStore}
 */

export function createMaterialStore(initialProps, bindings) {
	const materialsStore = bindings?.materials ?? materials;
	const sceneStore = bindings?.scene ?? scene;
	/** @type {MaterialStore} */
	const store = writable(initialProps);
	const { subscribe, set, update } = store;
	const material = {
		subscribe,
		set: (props) => {
			set(props);
			materialsStore.set(get(materialsStore));
			sceneStore.set(get(sceneStore));
			// TODO was necessary but now it works without
			//renderer.set(get(renderer));
		},
		update,
	};
	return material;
}
/**
 * @returns {MaterialsCustomStore}
 */
export function createMaterials() {
	/** @type {MaterialsStore} */
	const store = writable([]);
	const { subscribe, set, update } = store;
	const revisionStore = writable(0);
	return {
		subscribe,
		set: (next) => {
			set(next);
			revisionStore.update((revision) => revision + 1);
		},
		update,
		get revision() {
			return get(revisionStore);
		},
	};
}

export const materials = createMaterials();
