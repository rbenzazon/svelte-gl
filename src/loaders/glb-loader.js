import { parseGLBSync } from "./glb-parser";

// TODO: finish glb loader after gltf loader is done because glb requires a heavy wasm decoder

export async function loadGLBFile(url) {
	try {
		let fileArrayBuffer;
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Failed to fetch GLB file: ${response.statusText}`);
		}
		fileArrayBuffer = await response.arrayBuffer();
		const glb = {};
		parseGLBSync(glb, fileArrayBuffer);
		console.log("GLB file loaded successfully", glb);
	} catch (error) {
		console.error("Error loading GLB file:", error);
	}
}
