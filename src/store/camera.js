import { lookAt, orthoNO, perspective } from "gl-matrix/esm/mat4.js";
import { get, writable } from "svelte/store";
import { createZeroMatrix } from "../geometries/common";
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
export function createCameraStore(ctx) {
	/** @type {SvelteGLCameraStore} */
	const store = writable({
		position: [0, 0, -1],
		target: [0, 0, 0],
		fov: 80,
		near: 0.1,
		far: 1000,
		up: [0, 1, 0],
		projection: "perspective",
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
		const { canvas } = ctx;
		const aspect = canvas.width / canvas.height;
		view = lookAt(createZeroMatrix(), next.position, next.target, next.up);
		if (next.projection === "orthographic") {
			const height = 2 * distance(next.position, next.target) * Math.tan(toRadian(next.fov) / 2);
			const width = height * aspect;
			projection = orthoNO(createZeroMatrix(), -width / 2, width / 2, -height / 2, height / 2, next.near, next.far);
		} else {
			projection = perspective(createZeroMatrix(), toRadian(next.fov), aspect, next.near, next.far);
		}
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

function distance(position, target) {
	const x = position[0] - target[0];
	const y = position[1] - target[1];
	const z = position[2] - target[2];
	return Math.hypot(x, y, z);
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

export const camera = createCameraStore(appContext);
