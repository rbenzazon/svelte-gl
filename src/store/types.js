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
/*
data: mesh.position.data,
                        interleaved: mesh.position.interleaved,
                        byteOffset: mesh.position.byteOffset,
                        byteStride: mesh.position.byteStride,
*/
/**
 * @typedef {Object} SvelteGLInterleavedAttribute
 * @property {ArrayBuffer} data
 * @property {boolean} interleaved
 * @property {number} byteOffset
 * @property {number} byteStride
 */

/**
 * @typedef {Object} SvelteGLAttributes
 * @property {Float32Array|SvelteGLInterleavedAttribute} positions
 * @property {Float32Array|SvelteGLInterleavedAttribute} normals
 * @property {Float32Array} [uvs]
 * @property {Uint16Array} [elements]
 */
/**
 * @typedef {Object} SvelteGLMaterial
 * @property {vec3} diffuse
 * @property {number} metalness
 * @property {number} [roughness]
 * @property {import("../material/specular/specular").SvelteGLSpecular} [specular]
 * @property {import("src/texture/texture").SvelteGLTexture} [diffuseMap]
 * @property {import("src/texture/texture").SvelteGLTexture} [normalMap]
 * @property {import("src/texture/texture").SvelteGLTexture} [roughnessMap]
 * @property {boolean} [transparent]
 */

/**
 * @typedef {{attributes:{
 *	positions: Float32Array,
 *	normals: Float32Array,
 * 	elements?: Uint16Array,
 * 	uvs?: Float32Array
 * },
 * drawMode:DrawMode}} Geometry
 */

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
 * @typedef {Object} SvelteGLBaseMeshData
 * @property {SvelteGLAttributes} attributes
 * @property {DrawMode} drawMode
 */
/**
 * @typedef {Object} SvelteGLBaseMeshDataMaterial
 * @property {SvelteGLMaterial} material
 */
/**
 * @typedef {Object} SvelteGLBaseMeshDataMaterialStore
 * @property {import("./engine-refactor").MaterialCustomStore} material
 */

/**
 * @typedef {Object} SvelteGLSingleMeshData
 * @property {mat4} matrix
 */
/**
 * @typedef {Object} SvelteGLInstancedMeshData
 * @property {number} instances
 * @property {mat4[]} matrices
 */
/**
 * @typedef {SvelteGLBaseMeshData & SvelteGLBaseMeshDataMaterial & (SvelteGLSingleMeshData | SvelteGLInstancedMeshData)} SvelteGLMeshData
 */
/**
 * @typedef {SvelteGLBaseMeshData & SvelteGLBaseMeshDataMaterialStore & (SvelteGLSingleMeshData | SvelteGLInstancedMeshData)} SvelteGLMeshReadyData
 */

/**
 * scene store
 * @typedef {import("svelte/store").Writable<SvelteGLMesh[]>} SvelteGLSceneStore
 */

