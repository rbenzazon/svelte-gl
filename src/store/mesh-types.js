/**
 * @param {SvelteGLMesh | SvelteGLMeshData | SvelteGLMeshReadyData} mesh
 * @returns {mesh is SvelteGLSingleMesh}
 */
export function isSvelteGLSingleMesh(mesh) {
	return "matrix" in mesh;
}
/**
 * @param {SvelteGLMesh | SvelteGLMeshData | SvelteGLMeshReadyData} mesh
 * @returns {mesh is SvelteGLInstancedMesh}
 */
export function isSvelteGLInstancedMesh(mesh) {
	return "matrices" in mesh;
}
