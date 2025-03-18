import { lookAt, perspective } from "gl-matrix/esm/mat4.js";
import { createZeroMatrix } from "../geometries/common";
import { writable, get } from "svelte/store";
import { appContext } from "./app-context";

/**
 * @typedef {Object} SvelteGLCameraCustomStore
 * @property {SvelteGLCameraStore['subscribe']} subscribe
 * @property {SvelteGLCameraStore['set']} set
 * @property {SvelteGLCameraStore['update']} update
 * @property {number} revision
 * @property {mat4} view
 * @property {mat4} projection
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
			updateComputed(next);
			return next;
		});
	}
	function customSet(next) {
		customUpdate((camera) => next);
	}
	let view, projection;
	function updateComputed(next) {
		const { canvas } = appContext;
		view = lookAt(createZeroMatrix(), next.position, next.target, next.up);
		projection = perspective(createZeroMatrix(), toRadian(next.fov), canvas.width / canvas.height, next.near, next.far);
	}
	return {
		subscribe,
		set: customSet,
		update: customUpdate,
		get revision() {
			return get(revisionStore);
		},
		get view() {
			return view;
		},
		get projection() {
			return projection;
		},
	};
}

const degree = Math.PI / 180;
/**
 * Convert Degree To Radian
 *
 * @param {Number} a Angle in Degrees
 */

function toRadian(a) {
	return a * degree;
}

export const camera = createCameraStore();
