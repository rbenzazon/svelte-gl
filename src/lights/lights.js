export function isLight(sceneNode) {
    return sceneNode.shader instanceof Function && sceneNode.setupLights instanceof Function && sceneNode.updateOneLight instanceof Function;
}