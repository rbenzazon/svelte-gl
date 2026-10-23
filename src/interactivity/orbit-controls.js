import { get } from "svelte/store";

/**
 * Drag to orbit around the camera target or to pan it, wheel to zoom.
 * The drag mode is "orbit" (default) or "pan" (setMode); holding Space over the canvas pans in either mode.
 * @param {HTMLCanvasElement} canvas
 * @param {import("../store/camera.js").SvelteGLCameraCustomStore} camera
 * @param {{ speed?: number, mode?: "orbit" | "pan", onModeChange?: (mode: "orbit" | "pan", spaceHeld: boolean) => void }} [options]
 * speed multiplies the orbit rotation per dragged pixel, default 1. onModeChange gets the effective drag mode
 * ("pan" while Space is held) each time it or the Space hold changes.
 */
export function createOrbitControls(canvas, camera, { speed = 1, mode = "orbit", onModeChange } = {}) {
	//add support for touch events
	canvas.addEventListener("touchstart", onMouseDown, { passive: false });
	canvas.addEventListener("mousedown", onMouseDown, { passive: false });
	canvas.addEventListener("wheel", onMouseWheel, { passive: false });
	canvas.addEventListener("mouseenter", onEnter);
	canvas.addEventListener("mouseleave", onLeave);
	window.addEventListener("keydown", onKeyDown);
	window.addEventListener("keyup", onKeyUp);
	window.addEventListener("blur", onBlur);
	let startX;
	let startY;
	let hovered = false;
	let dragging = false;
	let spaceDown = false;
	// Whether the canvas cursor is ours, so it is only cleared when this set it.
	let cursorSet = false;

	// The hand while a drag pans (pan mode or Space held), closed while panning.
	function getCursor() {
		return mode === "pan" || spaceDown ? (dragging ? "grabbing" : "grab") : "";
	}
	let reported = `${mode} false`;
	function updateCursor() {
		const effective = mode === "pan" || spaceDown ? "pan" : "orbit";
		const held = spaceDown && mode !== "pan";
		if (`${effective} ${held}` !== reported) {
			reported = `${effective} ${held}`;
			onModeChange?.(effective, held);
		}
		const cursor = getCursor();
		if (cursor) {
			canvas.style.cursor = cursor;
			cursorSet = true;
		} else if (cursorSet) {
			canvas.style.cursor = "";
			cursorSet = false;
		}
	}

	function onEnter() {
		hovered = true;
	}
	function onLeave() {
		hovered = false;
	}
	function isEditable(element) {
		return (
			element instanceof HTMLElement && (element.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName))
		);
	}
	function onKeyDown(event) {
		if (event.code !== "Space" || isEditable(event.target) || (!hovered && !dragging)) {
			return;
		}
		// Over the canvas, Space is the pan modifier, not a page scroll.
		event.preventDefault();
		spaceDown = true;
		updateCursor();
	}
	function onKeyUp(event) {
		if (event.code === "Space") {
			spaceDown = false;
			updateCursor();
		}
	}
	function onBlur() {
		spaceDown = false;
		updateCursor();
	}
	function onMouseDown(event) {
		let moveEventType = "mousemove";
		let upEventType = "mouseup";
		let positionObject = event;
		if (event.type === "touchstart") {
			moveEventType = "touchmove";
			upEventType = "touchend";
			positionObject = event.touches[0];
		}
		canvas.addEventListener(moveEventType, onMouseMove, { passive: false });
		dragging = true;
		updateCursor();
		startX = positionObject.clientX;
		startY = positionObject.clientY;
		canvas.addEventListener(upEventType, onMouseUp, { passive: false });
		// A release outside the canvas is never received, so leaving it ends the drag.
		if (moveEventType === "mousemove") {
			canvas.addEventListener("mouseleave", onMouseUp);
		}
		//prevent default to avoid the canvas to be selected
		event.preventDefault();
		event.stopPropagation();
	}
	function getCoordinates(position, target) {
		const radius = Math.sqrt(
			Math.pow(position[0] - target[0], 2) + Math.pow(position[1] - target[1], 2) + Math.pow(position[2] - target[2], 2),
		);

		const polar = Math.acos(Math.max(-1, Math.min(1, (position[1] - target[1]) / radius)));
		const azimuth = Math.atan2(position[0] - target[0], position[2] - target[2]);
		return {
			radius,
			polar,
			azimuth,
		};
	}
	function onMouseMove(event) {
		let positionObject = event;
		if (event.type === "touchmove") {
			positionObject = event.touches[0];
		}
		const x = positionObject.clientX - startX;
		const y = positionObject.clientY - startY;
		startX = positionObject.clientX;
		startY = positionObject.clientY;
		if (mode === "pan" || spaceDown) {
			pan(x, y);
			return;
		}
		const cameraValue = get(camera);
		const { position, target, fov } = cameraValue;
		const { radius, polar, azimuth } = getCoordinates(position, target);
		const fovRatio = Math.pow(fov / 80, 1.5);
		const movementFactor = 250 / fovRatio / speed;

		// Constrain polar angle to avoid the singularity at the poles
		// Keep at least 0.1 radians (about 5.7 degrees) away from poles
		const newPolar = Math.max(0.01, Math.min(Math.PI - 0.01, polar - y / movementFactor));

		const newPosition = getPositionFromPolar(radius, newPolar, azimuth - x / movementFactor);
		newPosition[0] = newPosition[0] + target[0];
		newPosition[1] = newPosition[1] + target[1];
		newPosition[2] = newPosition[2] + target[2];

		camera.set({
			position: newPosition,
			target,
			fov,
		});
	}
	// Moves the target, and the camera with it, in the view plane: at the target depth, the point under the
	// cursor follows it (also with the orthographic camera, whose height is the same 2 * distance * tan(fov / 2)).
	function pan(x, y) {
		const { position, target, fov, up = [0, 1, 0] } = get(camera);
		const forward = normalize(target.map((value, i) => value - position[i]));
		const right = normalize(cross(forward, up));
		const screenUp = cross(right, forward);
		const distance = Math.hypot(...target.map((value, i) => value - position[i]));
		const worldPerPixel = (2 * distance * Math.tan((fov * Math.PI) / 360)) / (canvas.clientHeight || 1);
		const offset = right.map((value, i) => (-x * value + y * screenUp[i]) * worldPerPixel);
		camera.set({
			position: position.map((value, i) => value + offset[i]),
			target: target.map((value, i) => value + offset[i]),
			fov,
		});
	}
	function cross([ax, ay, az], [bx, by, bz]) {
		return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
	}
	function normalize(vector) {
		const length = Math.hypot(...vector) || 1;
		return vector.map((value) => value / length);
	}
	function onMouseWheel(event) {
		const cameraValue = get(camera);
		const { position, target, fov } = cameraValue;
		const { radius, polar, azimuth } = getCoordinates(position, target);

		const newPosition = getPositionFromPolar(radius + event.deltaY * 0.001 * radius, polar, azimuth);
		newPosition[0] = newPosition[0] + target[0];
		newPosition[1] = newPosition[1] + target[1];
		newPosition[2] = newPosition[2] + target[2];

		camera.set({
			position: newPosition,
			target,
			fov,
		});
	}

	function getPositionFromPolar(radius, polar, azimuth) {
		const sinPhiRadius = Math.sin(polar) * radius;
		return [sinPhiRadius * Math.sin(azimuth), Math.cos(polar) * radius, sinPhiRadius * Math.cos(azimuth)];
	}
	function onMouseUp(event) {
		let moveEventType = "mousemove";
		let upEventType = "mouseup";
		if (event.type === "touchend") {
			moveEventType = "touchmove";
			upEventType = "touchend";
		}
		canvas.removeEventListener(moveEventType, onMouseMove, { passive: false });
		canvas.removeEventListener(upEventType, onMouseUp, { passive: false });
		canvas.removeEventListener("mouseleave", onMouseUp);
		dragging = false;
		updateCursor();
	}
	updateCursor();
	return {
		/** "orbit" or "pan": what a drag does. Holding Space pans in either mode. */
		getMode() {
			return mode;
		},
		setMode(next) {
			mode = next;
			updateCursor();
		},
		/** The cursor the controls show now ("grab", "grabbing" or ""), for code that changes the cursor too. */
		getCursor,
		delta(radiusDelta, polarDelta, azimuthDelta) {
			const cameraValue = get(camera);
			const { position, target, fov } = cameraValue;
			const { radius, polar, azimuth } = getCoordinates(position, target);
			const newPosition = getPositionFromPolar(radius + radiusDelta, polar + polarDelta, azimuth + azimuthDelta);
			newPosition[0] = newPosition[0] + target[0];
			newPosition[1] = newPosition[1] + target[1];
			newPosition[2] = newPosition[2] + target[2];
			camera.set({
				position: newPosition,
				target,
				fov,
			});
		},
		destroy() {
			canvas.removeEventListener("touchstart", onMouseDown);
			canvas.removeEventListener("mousedown", onMouseDown);
			canvas.removeEventListener("wheel", onMouseWheel);
			canvas.removeEventListener("mouseenter", onEnter);
			canvas.removeEventListener("mouseleave", onLeave);
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("keyup", onKeyUp);
			window.removeEventListener("blur", onBlur);
		},
	};
}
