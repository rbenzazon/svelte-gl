import { convertToVector3 } from "../color/color-space";
import { hasSameShallow as arrayHasSameShallow } from "../utils/array";
import { writable, get } from "svelte/store";
import { setupAmbientLight } from "./gl";
import { programs } from "./programs";
import { appContext } from "./engine";

export function findMaterialProgram() {
	const matPrograms = get(programs).filter((program) => program.meshes?.length !== 0 && program.allMeshes !== true);
	return matPrograms;
}

/**
 *
 * @returns {SvelteGLRendererCustomStore}
 */
function createRenderer() {
	const initialValue = {
		//ref
		canvas: null,
		//ref
		loop: null,
		//value
		backgroundColor: 0xffffff,
		//value
		ambientLightColor: /** @type {vec2} */([0xffffff, 0]),
		//values
		toneMappings: [],
		//value
		enabled: false,
	};
	// the cache is made to compare the previous value with the new one
	let cache = initialValue;
	// some values have a different internal format
	let processed = new Map();
	/** @type {SvelteGLRendererStore} */
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
			if (!arrayHasSameShallow(next.ambientLightColor, cache.ambientLightColor)) {
				updateAmbientLightColor(next.ambientLightColor);
				const programs = findMaterialProgram();
				if (programs) {
					programs.forEach((program) => {
						setupAmbientLight(appContext.programMap.get(program), processed.get("ambientLightColor"));
					});
				}
			}
			if (!arrayHasSameShallow(next.toneMappings, cache.toneMappings)) {
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
		/**
		 * @returns {SvelteGLProcessedRenderer}
		 */
		get processed() {
			const values = get(store);
			return /** @type {SvelteGLProcessedRenderer} */ (Object.entries(values)
				.map(([key, value]) => {
					if (processed.has(key)) {
						return [key, processed.get(key)];
					}
					return [key, value];
				})
				.reduce((acc, [key, value]) => {
					acc[key] = value;
					return acc;
				}, {}));
		},
		get revision() {
			return get(revisionStore);
		},
	};
}
export const renderer = createRenderer();
