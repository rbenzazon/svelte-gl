import { L as drawModes, y as identity, z as createZeroMatrix, $ as multiply, a0 as fromRotationTranslationScale } from './Menu-DpZKAeDf.js';
import { c as createSpecular } from './specular-BKewLJsb.js';

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
 * @typedef {Object} GLTFCameraNode
 * @property {Number} camera
 */

/**
 * @typedef {Object} GLTFGroupNode
 * @property {Array<Number>} children
 * @property {mat4} matrix
 */

/**
 * @typedef {Object} GLTFBaseNode
 * @property {string} name
 * @property {vec3} translation
 * @property {vec4} rotation
 * @property {vec3} scale
 */

/**
 * @typedef {GLTFBaseNode & (GLTFMeshNode|GLTFGroupNode|GLTFCameraNode)} GLTFNode
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
 * @property {String} name
 * @property {GLTFCameraPerspective} perspective
 */

/**
 * @typedef {Object} GLTFCameraPerspective
 * @property {Number} aspectRatio
 * @property {Number} yfov
 * @property {Number} znear
 * @property {Number} zfar
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
/**
 * @typedef {Object} GLTFSimpleUint16AccessorData
 * @property {Uint16Array} data
 */
/**
 * @typedef {Object} GLTFSimpleFloat32AccessorData
 * @property {Float32Array} data
 */
/**
 * @typedef {Object} GLTFSimpleBaseAccessorData
 * @property {String} type
 * @property {WEBGLComponentType} componentType
 * @property {Number} count
 * @property {Array<Number>} min
 * @property {Array<Number>} max
 */
/**
 * @typedef {Object} GLTFInterLeavedAccessorData
 * @property {Boolean} interleaved
 * @property {Number} byteOffset
 * @property {Number} byteStride
 */
/**
 * @typedef {GLTFSimpleBaseAccessorData | (GLTFSimpleBaseAccessorData & GLTFInterLeavedAccessorData)} GLTFAccessorData
 */
/**
 * @typedef {GLTFAccessorData & GLTFSimpleUint16AccessorData} GLTFUint16AccessorData
 */
/**
 * @typedef {GLTFAccessorData & GLTFSimpleFloat32AccessorData} GLTFFloat32AccessorData
 */
/**
 * @typedef {Object} GLTFFileBaseNodeData
 * @property {mat4} matrix
 */
/**
 * @typedef {Object} GLTFParsedMesh
 * @property {GLTFFloat32AccessorData} position
 * @property {GLTFFloat32AccessorData} normal
 * @property {GLTFUint16AccessorData} indices
 * @property {GLTFFloat32AccessorData} uv
 * @property {Number} material
 * @property {import("../store/webgl.js").DrawMode} drawMode
 */

/**
 * @typedef {GLTFFileBaseNodeData & GLTFParsedMesh} GLTFFileMeshNodeData
 */
/**
 * @typedef {GLTFFileBaseNodeData & GLTFCamera} GLTFFileCameraNodeData
 */

/**
 * @typedef {Object} GLTFFileGroupNodeDataProp
 * @property {Array<GLTFFileNodeData>} children
 */
/**
 * @typedef {GLTFFileBaseNodeData & GLTFFileGroupNodeDataProp} GLTFFileGroupNodeData
 */
/**
 * @typedef {GLTFFileMeshNodeData | GLTFFileCameraNodeData | GLTFFileGroupNodeData} GLTFFileNodeData
 */
/**
 * @typedef {Object} GLTFLoadedFile
 * @property {Array<GLTFFileNodeData>} scene
 * @property {Array<GLTFMaterial>} materials
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

async function loadGLTFFile(url, binUrlPreload = undefined) {
	try {
		let binPreloadMap = new Map();
		if (binUrlPreload) {
			binPreloadMap.set(binUrlPreload, loadBinary(binUrlPreload));
		}

		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Failed to fetch GLB file: ${response.statusText}`);
		}
		/** @type {GLTFFile} **/
		const content = await response.json();
		return await parseGLTF(content, url, binPreloadMap);
	} catch (error) {
		console.error("Error loading GLTF file:", error);
	}
}

async function loadBinary(url) {
	let bin;
	if (url) {
		bin = await fetch(url);
		if (!bin.ok) {
			throw new Error(`Failed to fetch GLTF Binary file: ${bin.statusText}`);
		}
		return await bin.arrayBuffer();
	}
}
/**
 *
 * @param {GLTFFile} content
 * @param {String} url
 * @returns {Promise<GLTFLoadedFile>}
 */
async function parseGLTF(content, url, binPreloadMap) {
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
			const filePath = baseUrl + uri;
			if (binPreloadMap.has(filePath)) {
				return binPreloadMap.get(filePath);
			}
			return loadBinary(filePath);
		}),
	);

	/**
	 * bufferViews are used to describe a subset of a buffer
	 * they are referenced by accessors
	 */
	const dataViews = await Promise.all(
		bufferViews.map(async (bufferView) => {
			const { buffer, byteOffset, byteLength, byteStride } = bufferView;
			const bufferData = buffersData[buffer];
			return {
				dataView: bufferData.slice(byteOffset, byteOffset + byteLength),
				byteStride,
			};
		}),
	);

	/**
	 * Buffer cache is used to store buffers that are interleaved
	 */
	const bufferCache = {};
	function getBufferCache(dataView, offset) {
		return bufferCache[dataView] && bufferCache[dataView][offset];
	}
	function setBufferCache(buffer, dataView, offset) {
		bufferCache[dataView] = bufferCache[dataView] || {};
		bufferCache[dataView][offset] = buffer;
	}
	function hasBufferCache(dataView, offset) {
		return bufferCache[dataView] && bufferCache[dataView][offset] != null;
	}

	/**
	 * Accessors are used to describe how to read data from a bufferView
	 * They are read by using a typed array constructor.
	 * Note that each accessor uses a dataview but not necesarily all of it,
	 * the accessor can use a subset of the dataview
	 */

	const accessorsData = accessors.map((accessor) => {
		const { bufferView, byteOffset } = accessor;

		const { dataView, byteStride } = dataViews[bufferView];
		const { type, componentType, count, min, max } = accessor;

		const itemSize = WEBGL_TYPE_SIZES[type];
		const TypedArray = WEBGL_COMPONENT_TYPES[componentType];
		const elementBytes = TypedArray.BYTES_PER_ELEMENT;
		const itemBytes = elementBytes * itemSize;
		let offset;
		let length;
		let interleaved = false;
		if (byteStride != null && byteStride !== itemBytes) {
			const ibSlice = Math.floor(byteOffset / byteStride);
			offset = ibSlice * byteStride;
			length = (count * byteStride) / elementBytes;
			interleaved = true;
		} else {
			offset = byteOffset;
			length = count * itemSize;
		}

		let data;
		if (interleaved && hasBufferCache(dataView, offset)) {
			data = getBufferCache(dataView, offset);
		} else {
			data = new TypedArray(dataView, offset, length);
			if (interleaved) {
				setBufferCache(data, dataView, offset);
			}
		}

		return {
			type,
			componentType,
			count,
			min,
			max,
			data,
			interleaved,
			...(interleaved ? { byteOffset, byteStride } : {}),
		};
	});

	const meshesData = meshes.map((mesh) => parseMesh(mesh));
	/**
	 * Type guard for GLTFMeshNode
	 * @param {GLTFNode} node - The node to check
	 * @returns {node is GLTFBaseNode & GLTFMeshNode}
	 */
	function isMeshNode(node) {
		return "mesh" in node;
	}

	/**
	 * Type guard for GLTFCameraNode
	 * @param {GLTFNode} node - The node to check
	 * @returns {node is GLTFBaseNode & GLTFCameraNode}
	 */
	function isCameraNode(node) {
		return "camera" in node;
	}

	/**
	 * Type guard for GLTFGroupNode
	 * @param {GLTFNode} node - The node to check
	 * @returns {node is GLTFBaseNode & GLTFGroupNode}
	 */
	function isGroupNode(node) {
		return "children" in node;
	}
	const partialNodesData = nodes.map((node) => {
		if (isMeshNode(node)) {
			return {
				...meshesData[node.mesh],
				matrix: createMatrixFromGLTFTransform(node),
			};
		} else if (isCameraNode(node)) {
			return parseCameraNode(node);
		} else if (isGroupNode(node)) {
			return node;
		}
	});

	/**
	 * requires 2 passes because groups reference other nodes that are not yet parsed
	 */

	/**
	 * @type {Array<GLTFFileNodeData>}
	 */
	const nodesData = partialNodesData.map((node) => {
		if (node.children != null) {
			return parseGroupNode(node);
		} else {
			return node;
		}
	});

	// the file can contain multiple scenes but the scene prop indicates the main scene index
	const mainScene = scenes[scene];

	let { nodes: sceneNodes } = mainScene;
	let sceneNodesData = sceneNodes.map((nodeID) => nodesData[nodeID]);

	sceneNodesData.forEach((node) => {
		recurseNodes(node);
	});

	return {
		scene: sceneNodesData,
		materials,
	};

	/**
	 * @param {GLTFMesh} meshData
	 * @returns {GLTFParsedMesh}
	 */
	function parseMesh(meshData) {
		const { primitives } = meshData;
		const primitive = primitives[0];
		const { attributes, indices } = primitives[0];
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
	}

	/**
	 *
	 * @param {GLTFBaseNode & GLTFCameraNode} nodeData
	 * @returns {GLTFFileCameraNodeData}
	 */
	function parseCameraNode(nodeData) {
		let matrix;
		if (nodeData.scale != null || nodeData.translation != null || nodeData.rotation != null) {
			matrix = createMatrixFromGLTFTransform(nodeData);
		} else {
			matrix = identity(createZeroMatrix());
		}
		return {
			...nodeData,
			matrix,
			...cameras[nodeData.camera],
		};
	}

	function recurseNodes(nodeData, parent = null) {
		const { children } = nodeData;
		if (parent != null) nodeData.parent = parent;
		if (children != null) {
			return children.map((child) => {
				recurseNodes(child, nodeData);
			});
		}
	}

	function parseGroupNode(nodeData) {
		const { children, matrix, scale, translation, rotation } = nodeData;
		let nodeMatrix;

		if (matrix == null && (scale != null || translation != null || rotation != null)) {
			nodeMatrix = createMatrixFromGLTFTransform(nodeData);
		} else if (matrix != null) {
			nodeMatrix = matrix;
		} else {
			nodeMatrix = identity(createZeroMatrix());
		}
		return {
			children: children.map((child) => {
				if (partialNodesData[child].children != null) {
					return parseGroupNode(partialNodesData[child]);
				} else {
					return partialNodesData[child];
				}
			}),
			matrix: nodeMatrix,
		};
	}
}

/**
 * Type guard for GLTFMeshNode
 * @param {GLTFAccessorData} accessor - The node to check
 * @returns {accessor is GLTFSimpleBaseAccessorData & GLTFInterLeavedAccessorData}
 */
function isInterleavedAccessorData(accessor) {
	return "interleaved" in accessor;
}
/**
 * Type guard for GLTFMeshNode
 * @param {Array | Float32Array<ArrayBuffer> | Uint16Array<ArrayBuffer>} list - The node to check
 * @returns {list is vec3}
 */
function isVec3(list) {
	return list.length === 3;
}
/**
 *
 * @param {GLTFLoadedFile} gltfFile
 * @param {GLTFFileMeshNodeData} gltfMeshObject
 * @returns {SvelteGLMeshData}
 */
function createMeshFromGLTF(gltfFile, gltfMeshObject) {
	const mesh = gltfMeshObject;
	const gltfMaterial = gltfFile.materials[mesh.material];
	/** @type {SvelteGLMaterial} */
	const material = {
		diffuse: [1, 1, 1],
		metalness: 0,
	};
	if (gltfMaterial.pbrMetallicRoughness) {
		const { baseColorFactor, metallicFactor, roughnessFactor } = gltfMaterial.pbrMetallicRoughness;
		const diffuse = baseColorFactor?.slice(0, 3) ?? [1, 1, 1];
		if (isVec3(diffuse)) {
			material.diffuse = diffuse;
		}
		if (roughnessFactor != null) {
			material.specular = createSpecular({
				roughness: roughnessFactor,
			});
		}
		material.metalness = metallicFactor;
	}
	return {
		attributes: {
			positions: isInterleavedAccessorData(mesh.position)
				? {
						data: mesh.position.data,
						interleaved: mesh.position.interleaved,
						byteOffset: mesh.position.byteOffset,
						byteStride: mesh.position.byteStride,
					}
				: mesh.position.data,
			normals: isInterleavedAccessorData(mesh.normal)
				? {
						data: mesh.normal.data,
						interleaved: mesh.normal.interleaved,
						byteOffset: mesh.normal.byteOffset,
						byteStride: mesh.normal.byteStride,
					}
				: mesh.normal.data,
			elements: mesh.indices.data,
			...(mesh.uv?.data ? { uvs: mesh.uv.data } : {}),
		},
		drawMode: mesh.drawMode ?? "TRIANGLES",
		material,
		matrix: mesh.matrix,
	};
}
/**
 * @typedef {GLTFCamera & GLTFBaseNode & GLTFCameraNode} GLTFCameraData
 */
/**
 *
 * @param {GLTFFileCameraNodeData} gltfObject
 * @returns {SvelteGLCamera}
 */
function createCameraFromGLTF(gltfObject) {
	const { perspective, translation /*, rotation*/ } = gltfObject;
	return {
		position: translation,
		target: [0, 0, 0],
		fov: (perspective.yfov / Math.PI) * 180,
		near: perspective.znear,
		far: perspective.zfar,
		up: [0, 1, 0], // Assuming the up vector is always [0, 1, 0]
	};
}

/**
 *
 * @param {Object} node
 * @param {Array} parentMatrix
 * @param {Object} target
 * @returns {mat4}
 */
function getAbsoluteNodeMatrix(node) {
	const matrices = [];
	let currentNode = node;

	while (currentNode.parent != null) {
		matrices.unshift(currentNode.matrix);
		currentNode = currentNode.parent;
	}
	return matrices.reduce((acc, matrix) => multiply(acc, acc, matrix), identity(createZeroMatrix()));
}

function createMatrixFromGLTFTransform(object) {
	const { translation, rotation, scale } = object;
	const matrix = identity(createZeroMatrix());
	fromRotationTranslationScale(matrix, rotation || [0, 0, 0, 0], translation || [0, 0, 0], scale || [1, 1, 1]);
	return matrix;
}

function traverseScene(scene, callback) {
	scene.forEach((node) => {
		callback(node);
		if (node.children != null) {
			traverseScene(node.children, callback);
		}
	});
}
/**
 * returns a flat array of all nodes in the scene
 * @param {GLTFFileNodeData[]} scene
 * @param {GLTFFileNodeData[]} map
 * @returns {GLTFFileNodeData[]}
 */
function mapScene(scene, map = []) {
	scene.forEach((node) => {
		map.push(node);
		if (node.children != null) {
			mapScene(node.children, map);
		}
	});
	return map;
}
/**
 * @param {GLTFFileNodeData} node
 * @returns {node is GLTFFileMeshNodeData}
 */
function isGLTFMeshData(node) {
	return "position" in node;
}
/**
 * @param {GLTFFileNodeData} node
 * @returns {node is GLTFFileCameraNodeData}
 */
function isGLTFCameraData(node) {
	return "perspective" in node;
}

export { isGLTFCameraData as a, createMeshFromGLTF as b, createCameraFromGLTF as c, getAbsoluteNodeMatrix as g, isGLTFMeshData as i, loadGLTFFile as l, mapScene as m, traverseScene as t };
