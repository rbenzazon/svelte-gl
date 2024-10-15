import { get } from "svelte/store";

export function isLight(sceneNode) {
	sceneNode = get(sceneNode);
	return (
		sceneNode.shader instanceof Function &&
		sceneNode.setupLights instanceof Function &&
		sceneNode.updateOneLight instanceof Function
	);
}
