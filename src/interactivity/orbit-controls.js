export function createOrbitControls(canvas, camera) {
	console.log("Orbit controls");
	canvas.addEventListener("mousedown", onMouseDown);
	let startX;
	let startY;
	let cameraPosition;
	function onMouseDown(event) {
		console.log("Mouse down");
		canvas.addEventListener("mousemove", onMouseMove);
		startX = event.clientX;
		startY = event.clientY;
		cameraPosition = camera.get().position;
		canvas.addEventListener("mouseup", onMouseUp);
	}
	function onMouseMove(event) {
		const x = event.clientX - startX;
		const y = event.clientY - startY;
		console.log("Mouse move", x, y);
		let cameraValue = camera.get();
		console.log("cameraValue", cameraValue);
		const { position, target, fov } = cameraValue;
		position[0] = cameraPosition[0] + x * 0.001;
		position[1] = cameraPosition[1] + y * 0.001;
		camera.set(position, target, fov);
	}
	function onMouseUp(event) {
		console.log("Mouse up");
		canvas.removeEventListener("mousemove", onMouseMove);
		canvas.removeEventListener("mouseup", onMouseUp);
	}
}
