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
 * @property {number} [opacity]
 */

/**
 * @typedef {Object} SvelteGLMeshAnimation
 * @property {"vertex"} type
 * @property {boolean} requireTime
 * @property {import("src/shaders/template").TemplateRenderer} shader
 * @property {() => void} setupAnimation
 */

/**
 * @typedef {{
 *  attributes:{
 *	positions: Float32Array,
 *	normals: Float32Array,
 * 	elements?: Uint16Array,
 * 	uvs?: Float32Array
 *  },
 *  drawMode:import("./webgl").DrawMode
 * }} Geometry
 */

/**
 * INITIAL MESH DATA
 */
/**
 * base mesh model before create3DObject
 * @typedef {Object} SvelteGLBaseMeshData
 * @property {SvelteGLAttributes} attributes
 * @property {import("./webgl").DrawMode} drawMode
 * @property {SvelteGLMeshAnimation[]} [animations]
 */
/**
 * material model with static material data (no store)
 * @typedef {Object} SvelteGLBaseMeshDataMaterial
 * @property {SvelteGLMaterial} material
 */
/**
 * matrix model of single mesh (no instances)
 * @typedef {Object} SvelteGLSingleMeshData
 * @property {mat4} matrix
 */
/**
 * matrix model of instanced mesh
 * @typedef {Object} SvelteGLInstancedMeshData
 * @property {number} instances
 * @property {mat4[]} matrices
 */
/**
 * mesh data before create3DObject wit static material data
 * @typedef {SvelteGLBaseMeshData & SvelteGLBaseMeshDataMaterial & (SvelteGLSingleMeshData | SvelteGLInstancedMeshData)} SvelteGLMeshData
 */
/**
 * material model using store to be added into scene
 * @typedef {Object} SvelteGLBaseMeshDataMaterialStore
 * @property {import("./engine-refactor").MaterialCustomStore} material
 */
/**
 * MESH DATA BEFORE create3DObject
 */
/**
 * mesh data ready to be used in create3DObject with material store
 * @typedef {SvelteGLBaseMeshData & SvelteGLBaseMeshDataMaterialStore & (SvelteGLSingleMeshData | SvelteGLInstancedMeshData)} SvelteGLMeshReadyData
 */

/**
 * MESH DATA AFTER create3DObject
 */
/**
 * @typedef {Object} SvelteGLBaseMesh
 * @property {SvelteGLAttributes} attributes
 * @property {import("./webgl").DrawMode} drawMode
 * @property {import("./engine-refactor").MaterialCustomStore} material
 * @property {SvelteGLMeshAnimation[]} [animations]
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

