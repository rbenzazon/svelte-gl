export function setAppContext(context) {
	appContext = {
		...appContext,
		...context,
	};
}

/**
 * @typedef {Object} AppContext
 * @property {Map<import("./programs.js").SvelteGLProgram,WebGLProgram>} programMap
 * @property {Map<import("./programs.js").SvelteGLProgram,Map<SvelteGLMesh,WebGLVertexArrayObject>>} vaoMap
 * @property {Map<SvelteGLMesh,WebGLBuffer[]>} bufferMap
 * @property {WebGL2RenderingContext} gl
 * @property {WebGLProgram} program
 * @property {WebGLVertexArrayObject} vao
 * @property {HTMLCanvasElement} canvas
 * @property {vec4} backgroundColor
 * @property {vec3} ambientLightColor
 * @property {SvelteGLToneMapping[]} toneMappings
 * @property {boolean} existingProgram during a pipeline creation, informs the procedure that the program already exists
 */
/**
 * @type {AppContext}
 */
export let appContext = {
	programMap: new Map(),
	vaoMap: new Map(),
	bufferMap: new Map(),
	gl: null,
	program: null,
	vao: null,
	canvas: null,
	backgroundColor: null,
	ambientLightColor: null,
	toneMappings: null,
	existingProgram: false,
};
