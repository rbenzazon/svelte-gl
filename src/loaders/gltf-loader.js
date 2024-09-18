import { fromRotationTranslationScale, identity } from "gl-matrix/esm/mat4.js";

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
		const content = await response.json();
		return await parseGLTF(content, url);
	} catch (error) {
		console.error("Error loading GLTF file:", error);
	}
}

async function parseGLTF(content, url) {
	const baseUrl = url.substring(0, url.lastIndexOf("/") + 1);
	const { buffers, bufferViews, accessors, scenes, nodes, meshes, cameras, materials } = content;

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

	const dataViews = await Promise.all(
		bufferViews.map(async (bufferView) => {
			const { buffer, byteOffset, byteLength } = bufferView;
			const bufferData = buffersData[buffer];
			return bufferData.slice(byteOffset, byteOffset + byteLength);
		}),
	);

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

	function parseChildren(nodeData) {
		const { mesh } = nodeData;
		const meshData = meshes[mesh];
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
			...nodeData,
			mesh: primitivesData,
		};
	}

	const scenesData = scenes.map((scene) => {
		const { nodes: nodesID } = scene;
		const nodesData = nodesID.map((nodeID) => {
			const nodeData = nodes[nodeID];
			if (nodeData.mesh != null) {
				return parseChildren(nodeData);
			} else if (nodeData.camera != null) {
				const { camera } = nodeData;
				const cameraData = cameras[camera];
				return {
					...nodeData,
					camera: cameraData,
				};
			} else if (nodeData.children != null) {
				const { children, matrix } = nodeData;
				return {
					...nodeData,
					getChildren: () => parseChildren(nodes[children]),
					matrix,
				};
			}
		});
		return {
			nodes: nodesData,
		};
	});
	return {
		materials,
		scenes: scenesData,
	};
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

function createMatrixFromGLTFTransform(object) {
	const { translation, rotation, scale } = object;
	const matrix = identity(new Float32Array(16));
	fromRotationTranslationScale(matrix, rotation || [0, 0, 0, 0], translation || [0, 0, 0], scale || [1, 1, 1]);
	return matrix;
}
