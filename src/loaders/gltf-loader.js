import { fromRotationTranslationScale, identity } from "gl-matrix/esm/mat4.js";

/**
 * @typedef {Object} GLTFFile
 * @property {Array<GLTFAsset>} asset
 * @property {Number} scene
 * @property {Array<GLTFScene>} scenes
 * @property {Array<GLTFNode>} nodes
 * @property {Array<GLTFMesh>} meshes
 * @property {Array<GLTFAccessor>} accessors
 * @property {Array<GLTFBufferView>} bufferViews
 * @property {Array<GLTFBuffer>} buffers
 * @property {Array<GLTFCamera>} cameras
 * @property {Array<GLTFMaterial>} materials
 */

/**
 * @typedef {Object} GLTFAsset
 * @property {String} version
 * @property {String} generator
 * @property {String} minVersion
 * @property {String} extensions
 * @property {String} extras
 * @property {String} profile
 * @property {String} extensionsUsed
 */

/**
 * @typedef {Object} GLTFScene
 * @property {Array<Number>} nodes
 */

/**
 * @typedef {Object} GLTFMeshNode
 * @property {Number} mesh
 */

/**
 * @typedef {Object} GLTFGroupNode
 * @property {Array<Number>} children
 * @property {mat4} matrix
 */

/**
 * @typedef {GLTFMeshNode|GLTFGroupNode} GLTFNode
 */

/**
 * @typedef {Object} GLTFMesh
 * @property {Array<GLTFPrimitive>} primitives
 * @property {String} name
 */
/**
 * @typedef {Object} GLTFPrimitive
 * @property {GLTFAttribute} attributes
 * @property {Number} indices
 * @property {Number} material
 * @property {Number} mode
 */
/**
 * @typedef {Object} GLTFAttribute
 * @property {Number} POSITION
 * @property {Number} NORMAL
 * @property {Number} TEXCOORD_0
 * @property {Number} TEXCOORD_1
 */
/**
 * @typedef {keyof typeof WEBGL_COMPONENT_TYPES} WEBGLComponentType
 */
/**
 * @typedef {Object} GLTFAccessor
 * @property {Number} bufferView
 * @property {Number} byteOffset
 * @property {WEBGLComponentType} componentType
 * @property {Number} count
 * @property {
 * 		"VEC2"|
 * 		"VEC3"|
 * 		"VEC4"|
 * 		"MAT2"|
 * 		"MAT3"|
 * 		"MAT4"|
 * 		"SCALAR"
 * } type
 * @property {Array<Number>} min
 * @property {Array<Number>} max
 * @property {String} name
 * @property {String} normalized
 */
/**
 * @typedef {Object} GLTFBufferView
 * @property {Number} buffer
 * @property {Number} byteOffset
 * @property {Number} byteLength
 * @property {Number} byteStride
 * @property {String} target
 */
/**
 * @typedef {Object} GLTFBuffer
 * @property {String} uri
 * @property {Number} byteLength
 */
/**
 * @typedef {Object} GLTFCamera
 * @property {String} type
 * @property {Number} aspectRatio
 * @property {Number} yfov
 * @property {Number} znear
 * @property {Number} zfar
 * @property {String} name
 */
/**
 * @typedef {Object} GLTFMaterial
 * @property {GLTFPBRMetallicRoughness} pbrMetallicRoughness
 * @property {String} name
 * @property {GLTFTexture} normalTexture
 * @property {GLTFTexture} baseColorTexture
 * @property {GLTFTexture} metallicRoughnessTexture
 * @property {GLTFTexture} specularGlossinessTexture
 * @property {GLTFTexture} diffuseTexture
 * @property {GLTFTexture} ambientTexture
 */
/**
 * @typedef {Object} GLTFPBRMetallicRoughness
 * @property {vec4} baseColorFactor
 * @property {Number} metallicFactor
 * @property {Number} roughnessFactor
 */
/**
 * @typedef {Object} GLTFTexture
 * @property {Number} index
 * @property {Number} texCoord
 * @property {String} name
 */

const WEBGL_COMPONENT_TYPES = {
	5120: Int8Array,
	5121: Uint8Array,
	5122: Int16Array,
	5123: Uint16Array,
	5125: Uint32Array,
	5126: Float32Array,
};
const WEBGL_TYPE_SIZES = {
	MAT2: 4,
	MAT3: 9,
	MAT4: 16,
	SCALAR: 1,
	VEC2: 2,
	VEC3: 3,
	VEC4: 4,
};
const drawModes = {
	0: "POINTS",
	1: "LINES",
	2: "LINE_LOOP",
	3: "LINE_STRIP",
	4: "TRIANGLES",
	5: "TRIANGLE_STRIP",
	6: "TRIANGLE_FAN",
};

export async function loadGLTFFile(url) {
	try {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Failed to fetch GLB file: ${response.statusText}`);
		}
		/** @type {GLTFFile} **/
		const content = await response.json();
		return await parseGLTF(content, url);
	} catch (error) {
		console.error("Error loading GLTF file:", error);
	}
}
/**
 *
 * @param {GLTFFile} content
 * @param {String} url
 * @returns
 */
async function parseGLTF(content, url) {
	const baseUrl = url.substring(0, url.lastIndexOf("/") + 1);
	const { buffers, bufferViews, accessors, scenes, nodes, meshes, cameras, materials, scene } = content;

	/**
	 * buffers can be either :
	 *  -base64 data uri
	 * 	-a path to a :
	 *  	1/uncompressed binary file
	 * 		2/Draco compressed file
	 * for now Draco is not supported, it requires a huge webassembly module
	 */
	const buffersData = await Promise.all(
		buffers.map(async (buffer) => {
			const { uri } = buffer;
			const response = await fetch(baseUrl + uri);
			if (!response.ok) {
				throw new Error(`Failed to fetch buffer: ${response.statusText}`);
			}
			return await response.arrayBuffer();
		}),
	);

	/**
	 * bufferViews are used to describe a subset of a buffer
	 * they are referenced by accessors
	 */
	const dataViews = await Promise.all(
		bufferViews.map(async (bufferView) => {
			const { buffer, byteOffset, byteLength } = bufferView;
			const bufferData = buffersData[buffer];
			return bufferData.slice(byteOffset, byteOffset + byteLength);
		}),
	);

	/**
	 * Accessors are used to describe how to read data from a bufferView
	 * They are read by using a typed array constructor.
	 * Note that each accessor uses a dataview but not necesarily all of it,
	 * the accessor can use a subset of the dataview
	 */
	const accessorsData = accessors.map((accessor) => {
		const { bufferView, byteOffset } = accessor;

		const dataView = dataViews[bufferView];
		const { type, componentType, count, min, max } = accessor;
		const itemSize = WEBGL_TYPE_SIZES[type];
		return {
			type,
			componentType,
			count,
			min,
			max,
			data: new WEBGL_COMPONENT_TYPES[componentType](dataView, byteOffset, count * itemSize),
		};
	});

	const meshesData = meshes.map((mesh) => parseMesh(mesh));

	let nodesData = nodes.map((node) => {
		if (node.mesh != null) {
			return meshesData[node.mesh];
		} else if (node.camera != null) {
			return parseCamera(node);
		} else if (node.children != null) {
			return node;
		}
	});

	/**
	 * requires 2 passes because groups reference other nodes that are not yet parsed
	 */
	nodesData = nodesData.map((node) => {
		if (node.children != null) {
			return parseGroup(node);
		} else {
			return node;
		}
	});

	// the file can contain multiple scenes but the scene prop indicates the main scene index
	const mainScene = scenes[scene];

	let { nodes: sceneNodes } = mainScene;
	let sceneNodesData = sceneNodes.map((nodeID) => nodesData[nodeID]);

	const lights = {};

	return {
		scene: sceneNodesData,
		materials,
		lights,
		cameras,
	};

	/**
	 *
	 * @param {GLTFMeshNode} nodeData
	 * @returns
	 */
	function parseMesh(meshData) {
		const { primitives } = meshData;
		const primitivesData = primitives.map((primitive) => {
			const { attributes, indices } = primitive;
			const { POSITION, NORMAL, TEXCOORD_0 } = attributes;
			const positionAccessor = accessorsData[POSITION];
			const normalAccessor = accessorsData[NORMAL];
			const uvAccessor = accessorsData[TEXCOORD_0];
			const indexAccessor = accessorsData[indices];
			return {
				position: positionAccessor,
				normal: normalAccessor,
				indices: indexAccessor,
				uv: uvAccessor,
				material: primitive.material,
				drawMode: drawModes[primitive.mode],
			};
		});
		return {
			mesh: primitivesData,
		};
	}

	function parseCamera(nodeData) {
		return {
			camera: cameras[nodeData.camera],
		};
	}

	function parseGroup(nodeData) {
		const { children, matrix } = nodeData;
		return {
			children: children.map((child) => {
				return nodesData[child];
			}),
			matrix,
		};
	}
}

export function createMeshFromGLTF(gltfScene, gltfObject) {
	const transformMatrix = createMatrixFromGLTFTransform(gltfObject);
	const gltfMaterial = gltfScene.materials[gltfObject.mesh[0].material];
	const material = {};
	if (gltfMaterial.pbrMetallicRoughness) {
		const { baseColorFactor, metallicFactor, roughnessFactor } = gltfMaterial.pbrMetallicRoughness;
		material.diffuse = baseColorFactor.slice(0, 3);
	}
	return {
		attributes: {
			positions: gltfObject.mesh[0].position.data,
			normals: gltfObject.mesh[0].normal.data,
			elements: gltfObject.mesh[0].indices.data,
		},
		drawMode: gltfObject.mesh[0].drawMode,
		material,
		transformMatrix,
	};
}

export function getAbsoluteMatrix(file, mesh) {
	const { nodes } = file;
}
/**
 *
 * @param {Object} node
 * @param {Array} parentMatrix
 * @param {Object} target
 */
function recurseNodeMatrices(node, parentMatrix, target) {}

function createMatrixFromGLTFTransform(object) {
	const { translation, rotation, scale } = object;
	const matrix = identity(new Float32Array(16));
	fromRotationTranslationScale(matrix, rotation || [0, 0, 0, 0], translation || [0, 0, 0], scale || [1, 1, 1]);
	return matrix;
}
