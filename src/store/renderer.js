import { convertToVector3 } from "../color/color-space";
import { hasSameShallow as arrayHasSameShallow } from "../utils/array";
import { writable, get } from "svelte/store";
/*import { setupAmbientLight } from "./gl";
import { findMaterialProgram } from "./programs-utils";*/
import { appContext, setAppContext } from "./app-context";

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
		backgroundColor: NaN,
		//value
		ambientLightColor: /** @type {vec2} */ ([0xffffff, 0]),
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
	function updateCanvas(canvas) {
		const canvasRect = canvas.getBoundingClientRect();
		const appContextValues = {
			canvas: {
				width: canvasRect.width,
				height: canvasRect.height,
			},
		};
		canvas.width = canvasRect.width;
		canvas.height = canvasRect.height;
		setAppContext({
			...appContext,
			...appContextValues,
		});
	}
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
			if (next.canvas !== cache.canvas) {
				updateCanvas(next.canvas);
			}
			if (cache.loop != null && next.loop !== cache.loop) {
				updateLoop(next.loop);
			}
			if (next.backgroundColor !== cache.backgroundColor) {
				updateBackgroundColor(next.backgroundColor);
			}
			const processedAmbient = processed.get("ambientLightColor");
			if (processedAmbient == null || processed.get("ambientLightColor").length !== 4) {
				updateAmbientLightColor(next.ambientLightColor);
			}
			if (!arrayHasSameShallow(next.ambientLightColor, cache.ambientLightColor)) {
				updateAmbientLightColor(next.ambientLightColor);
				//todo check if we can update the programs from the renderer updating or create an ambient light store
				/*const programs = findMaterialProgram();
				if (programs) {
					programs.forEach((program) => {
						setupAmbientLight(appContext.programMap.get(program), processed.get("ambientLightColor"));
					});
				}*/
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
			return /** @type {SvelteGLProcessedRenderer} */ (
				Object.entries(values)
					.map(([key, value]) => {
						if (processed.has(key)) {
							return [key, processed.get(key)];
						}
						return [key, value];
					})
					.reduce((acc, [key, value]) => {
						acc[key] = value;
						return acc;
					}, {})
			);
		},
		get revision() {
			return get(revisionStore);
		},
	};
}
export const renderer = createRenderer();

//this is necessary because the store needs to be subscribed to to be activated
const unsubPipeline = renderer.subscribe((value) => {
	//console.log("render loop store subscribed", value);
});
