import { writable, get } from "svelte/store";

/**
 * @typedef {Object} SvelteGLCameraCustomStore
 * @property {SvelteGLCameraStore['subscribe']} subscribe
 * @property {SvelteGLCameraStore['set']} set
 * @property {SvelteGLCameraStore['update']} update
 * @property {number} revision
 */
/**
 * @return {SvelteGLCameraCustomStore}
 */
export function createCameraStore() {
	/** @type {SvelteGLCameraStore} */
	const store = writable({
		position: [0, 0, -1],
		target: [0, 0, 0],
		fov: 80,
		near: 0.1,
		far: 1000,
		up: [0, 1, 0],
	});
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
			return get(revisionStore);
		},
	};
}

export const camera = createCameraStore();
