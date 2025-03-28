import { get } from "svelte/store";

export function createOrbitControls(canvas, camera) {
	//add support for touch events
	canvas.addEventListener("touchstart", onMouseDown, { passive: false });
	canvas.addEventListener("mousedown", onMouseDown, { passive: false });
	canvas.addEventListener("wheel", onMouseWheel, { passive: false });
	let startX;
	let startY;
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
		startX = positionObject.clientX;
		startY = positionObject.clientY;
		canvas.addEventListener(upEventType, onMouseUp, { passive: false });
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
		const cameraValue = get(camera);
		const { position, target, fov } = cameraValue;
		const { radius, polar, azimuth } = getCoordinates(position, target);
		const fovRatio = Math.pow(fov / 80, 1.5);
		const movementFactor = 250 / fovRatio;

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
		startX = positionObject.clientX;
		startY = positionObject.clientY;
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
	}
	return {
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
		},
	};
}
