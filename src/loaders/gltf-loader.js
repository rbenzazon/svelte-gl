import { fromRotationTranslationScale, getScaling, identity, multiply } from "gl-matrix/esm/mat4.js";
import { transformQuat, add, scale, distance } from "gl-matrix/esm/vec3.js";

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

/*
fov,
near,
far,
position,
target,
up,
*/

/**
 * @typedef {Object} SvelteGLCamera
 * @property {Number} fov
 * @property {Number} near
 * @property {Number} far
 * @property {vec3} position
 * @property {vec3} target
 * @property {vec3} up
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
			const { buffer, byteOffset, byteLength, byteStride } = bufferView;
			const bufferData = buffersData[buffer];
			return {
				dataView: bufferData.slice(byteOffset, byteOffset + byteLength),
				byteStride,
			};
		}),
	);

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

	let nodesData = nodes.map((node) => {
		if (node.mesh != null) {
			return {
				...meshesData[node.mesh],
				matrix: createMatrixFromGLTFTransform(node),
			};
		} else if (node.camera != null) {
			return parseCameraNode(node);
		} else if (node.children != null) {
			return node;
		}
	});

	/**
	 * requires 2 passes because groups reference other nodes that are not yet parsed
	 */
	nodesData = nodesData.map((node) => {
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
		return primitivesData[0];
	}

	function parseCameraNode(nodeData) {
		if (
			nodeData.matrix == null &&
			(nodeData.scale != null || nodeData.translation != null || nodeData.rotation != null)
		) {
			nodeData.matrix = createMatrixFromGLTFTransform(nodeData);
		} else if (nodeData.matrix == null) {
			nodeData.matrix = identity(new Float32Array(16));
		}
		return {
			...nodeData,
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
			nodeMatrix = identity(new Float32Array(16));
		}
		return {
			children: children.map((child) => {
				if (nodesData[child].children != null) {
					return parseGroupNode(nodesData[child]);
				} else {
					return nodesData[child];
				}
			}),
			matrix: nodeMatrix,
		};
	}
}

export function createMeshFromGLTF(gltfScene, gltfObject) {
	//const transformMatrix = createMatrixFromGLTFTransform(gltfObject);
	const mesh = gltfObject;
	const gltfMaterial = gltfScene.materials[mesh.material];
	const material = {};
	if (gltfMaterial.pbrMetallicRoughness) {
		const { baseColorFactor, metallicFactor, roughnessFactor } = gltfMaterial.pbrMetallicRoughness;
		material.diffuse = baseColorFactor.slice(0, 3);
	}
	return {
		attributes: {
			positions: mesh.position.interleaved
				? {
						data: mesh.position.data,
						interleaved: mesh.position.interleaved,
						byteOffset: mesh.position.byteOffset,
						byteStride: mesh.position.byteStride,
					}
				: mesh.position.data,
			normals: mesh.normal.interleaved
				? {
						data: mesh.normal.data,
						interleaved: mesh.normal.interleaved,
						byteOffset: mesh.normal.byteOffset,
						byteStride: mesh.normal.byteStride,
					}
				: mesh.normal.data,
			elements: mesh.indices.data,
		},
		drawMode: mesh.drawMode,
		material,
		transformMatrix: mesh.matrix,
	};
}
/**
 *
 * @param {GLTFCamera & GLTFBaseNode & GLTFCameraNode} gltfObject
 * @returns {SvelteGLCamera}
 */
/*
Example of a camera object in a gltf file
{
	camera: 0,
	name: "Camera",
	perspective:{
		"znear": 0.10000000149011612,
		"zfar": 1000,
		"yfov": 0.39959652046304894,
		"aspectRatio": 1.7777777777777777
	},
	type: "perspective",
	rotation: [0, 0, 0, 1],
	translation: [0, 0, 0],
}
*/
/*
Example of a camera object in svelte-gl
{
	fov: 0.39959652046304894,
	near: 0.10000000149011612,
	far: 1000,
	position: [0, 0, 0],
	target: [0, 0, 0],
	up: [0, 1, 0],
}
*/

export function createCameraFromGLTF(gltfObject) {
	const { perspective, translation /*, rotation*/ } = gltfObject;
	/*const matrix = createMatrixFromGLTFTransform(gltfObject);
	const dist = distance([0, 0, 0], translation);*/
	/*
	const target = [0, 0, -1];
	transformQuat(target, target, rotation);
	scale(target, target, dist);
	add(target, target, translation);
	*/
	/*
	position = [0, 0, -1],
	target = [0, 0, 0],
	fov = 80,
	near = 0.1,
	far = 1000,
	up = [0, 1, 0],
	matrix = null,
	*/
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
 */
export function getAbsoluteNodeMatrix(node) {
	const matrices = [];
	let currentNode = node;

	while (currentNode.parent != null) {
		matrices.unshift(currentNode.matrix);
		currentNode = currentNode.parent;
	}
	return matrices.reduce((acc, matrix) => multiply(acc, acc, matrix), identity(new Float32Array(16)));
}

function createMatrixFromGLTFTransform(object) {
	const { translation, rotation, scale } = object;
	const matrix = identity(new Float32Array(16));
	fromRotationTranslationScale(matrix, rotation || [0, 0, 0, 0], translation || [0, 0, 0], scale || [1, 1, 1]);
	return matrix;
}

export function traverseScene(scene, callback) {
	scene.forEach((node) => {
		callback(node);
		if (node.children != null) {
			traverseScene(node.children, callback);
		}
	});
}
