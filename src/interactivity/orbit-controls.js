export function createOrbitControls(canvas, camera) {
	canvas.addEventListener("mousedown", onMouseDown);
	canvas.addEventListener("wheel",onMouseWheel)
	let startX;
	let startY;
	function onMouseDown(event) {
		canvas.addEventListener("mousemove", onMouseMove);
		startX = event.clientX;
		startY = event.clientY;
		canvas.addEventListener("mouseup", onMouseUp);
	}
	function getCoordinates(position, target){
		const radius = Math.sqrt(
			Math.pow(position[0] - target[0], 2) + Math.pow(position[1] - target[1], 2) + Math.pow(position[2] - target[2], 2),
		);

		const polar = Math.acos(Math.max(-1, Math.min(1, (position[1] - target[1]) / radius)));
		const azimuth = Math.atan2(position[0] - target[0], position[2] - target[2]);
		return {
			radius,
			polar,
			azimuth,
		}
	}
	function onMouseMove(event) {
		const x = event.clientX - startX;
		const y = event.clientY - startY;
		const cameraValue = camera.get();
		const { position, target, fov } = cameraValue;
		const {
			radius,
			polar,
			azimuth,
		} = getCoordinates(position, target);
		
		const newPosition = getPositionFromPolar(radius, polar - y / 100, azimuth - x / 100);
		newPosition[0] = newPosition[0] + target[0];
		newPosition[1] = newPosition[1] + target[1];
		newPosition[2] = newPosition[2] + target[2];

		camera.set(newPosition, target, fov);
		startX = event.clientX;
		startY = event.clientY;
	}
	function onMouseWheel(event){
		const cameraValue = camera.get();
		const { position, target, fov } = cameraValue;
		const {
			radius,
			polar,
			azimuth,
		} = getCoordinates(position, target);

		const newPosition = getPositionFromPolar(radius+event.deltaY/300, polar, azimuth);
		newPosition[0] = newPosition[0] + target[0];
		newPosition[1] = newPosition[1] + target[1];
		newPosition[2] = newPosition[2] + target[2];

		camera.set(newPosition, target, fov);
	}

	function getPositionFromPolar(radius, polar, azimuth) {
		const sinPhiRadius = Math.sin(polar) * radius;
		return [sinPhiRadius * Math.sin(azimuth), Math.cos(polar) * radius, sinPhiRadius * Math.cos(azimuth)];
	}
	function onMouseUp(event) {
		canvas.removeEventListener("mousemove", onMouseMove);
		canvas.removeEventListener("mouseup", onMouseUp);
	}
}
