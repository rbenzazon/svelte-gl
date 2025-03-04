/**
 * matrix store
 * @typedef {import("svelte/store").Writable<mat4>} MatrixStore
 */

/**
 * material store
 * @typedef {import("svelte/store").Writable<SvelteGLMaterial>} MaterialStore
 */

/**
 * @typedef {Object} SvelteGLCamera
 * @property {vec3} position
 * @property {vec3} target
 * @property {vec3} up
 * @property {Number} fov
 * @property {Number} near
 * @property {Number} far
 */

/**
 * Camera store
 * @typedef {import('svelte/store').Writable<SvelteGLCamera>} SvelteGLCameraStore
 */

/**
 * @typedef {"POINTS"| "LINES"| "LINE_LOOP"| "LINE_STRIP"| "TRIANGLES"| "TRIANGLE_STRIP"| "TRIANGLE_FAN"} DrawMode
 */

/**
 * @typedef {Object} SvelteGLAttributes
 * @property {Float32Array} positions
 * @property {Float32Array} normals
 * @property {Float32Array} uvs
 * @property {Uint16Array} [elements]
 */
/**
 * @typedef {Object} SvelteGLMaterial
 * @property {vec3} diffuse
 * @property {number} metalness
 * @property {import("../material/specular/specular").SvelteGLSpecular} [specular]
 * @property {import("src/texture/texture").SvelteGLTexture} [diffuseMap]
 * @property {import("src/texture/texture").SvelteGLTexture} [normalMap]
 * @property {import("src/texture/texture").SvelteGLTexture} [roughnessMap]
 * @property {boolean} [transparent]
 */
//roughness, ior, intensity, color

//import("../shaders/template").TemplateRenderer

/**
 * @typedef {Object} SvelteGLBaseMesh
 * @property {SvelteGLAttributes} attributes
 * @property {DrawMode} drawMode
 * @property {import("./engine-refactor").MaterialCustomStore} material
 */
/**
 * @typedef {Object} SvelteGLSingleMesh
 * @property {MatrixStore} matrix
 */
/**
 * @typedef {Object} SvelteGLInstancedMesh
 * @property {number} instances
 * @property {MatrixStore[]} matrices
 */
/**
 * @typedef {SvelteGLBaseMesh & (SvelteGLSingleMesh | SvelteGLInstancedMesh)} SvelteGLMesh
 */

/**
 * scene store
 * @typedef {import("svelte/store").Writable<SvelteGLMesh[]>} SvelteGLSceneStore
 */

