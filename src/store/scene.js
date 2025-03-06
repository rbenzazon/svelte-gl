import { writable, get } from "svelte/store";

function createSceneStore() {
	/** @type {SvelteGLSceneStore} */
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
			return get(revisionStore);
		},
	};
}
export const scene = createSceneStore();
