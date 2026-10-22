import { get } from "svelte/store";

// Same pole limit as the orbit controls: the up vector never lines up with the view direction.
const minPolar = 0.01;

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (from, to, t) => from + (to - from) * t;

// Orbit around the target, world Y up (data Z up through the axis swap): polar angle from +Y, azimuth around Y.
function toOrbit({ position, target }) {
	const offset = position.map((value, i) => value - target[i]);
	const distance = Math.hypot(...offset) || 1;
	return {
		target,
		distance,
		polar: Math.acos(clamp(offset[1] / distance, -1, 1)),
		azimuth: Math.atan2(offset[0], offset[2]),
	};
}

function orbitPosition({ target, distance, polar, azimuth }) {
	const limited = clamp(polar, minPolar, Math.PI - minPolar);
	const radius = Math.sin(limited) * distance;
	return [
		target[0] + radius * Math.sin(azimuth),
		target[1] + Math.cos(limited) * distance,
		target[2] + radius * Math.cos(azimuth),
	];
}

/**
 * Moves the camera to `to`, turning around the target: the azimuth goes the shortest way,
 * distance, target, near and far are interpolated. A duration of 0 jumps to the end.
 * A `to` position on the vertical axis ends 0.01 rad off it, at azimuth 0 (seen from data -Y), as the orbit limit.
 * @param {import("../../store/camera.js").SvelteGLCameraCustomStore} camera
 * @param {{ position: number[], target: number[], near?: number, far?: number }} to
 * @param {number} [duration] ms
 * @returns {() => void} cancels the animation, the camera stays where it is
 */
export function animateCamera(camera, to, duration = 300) {
	const start = get(camera);
	const from = toOrbit(start);
	const end = toOrbit(to);
	const turn = ((((end.azimuth - from.azimuth + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
	const stateAt = (t) => {
		const orbit = {
			target: from.target.map((value, i) => lerp(value, end.target[i], t)),
			distance: lerp(from.distance, end.distance, t),
			polar: lerp(from.polar, end.polar, t),
			azimuth: from.azimuth + turn * t,
		};
		return {
			position: orbitPosition(orbit),
			target: orbit.target,
			...(to.near != null && { near: lerp(start.near, to.near, t) }),
			...(to.far != null && { far: lerp(start.far, to.far, t) }),
		};
	};
	if (duration <= 0) {
		camera.update(() => stateAt(1));
		return () => {};
	}
	let startTime;
	let frame = requestAnimationFrame(function step(now) {
		startTime ??= now;
		const t = Math.min(1, (now - startTime) / duration);
		camera.update(() => stateAt(easeInOutCubic(t)));
		frame = t < 1 ? requestAnimationFrame(step) : 0;
	});
	return () => cancelAnimationFrame(frame);
}
