import { fromRotationTranslationScale, identity } from "gl-matrix/esm/mat4.js";

const WEBGL_COMPONENT_TYPES = {
	5120: Int8Array,
	5121: Uint8Array,
	5122: Int16Array,
	5123: Uint16Array,
	5125: Uint32Array,
	5126: Float32Array,
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
	console.log(content);

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
			const { buffer } = bufferView;
			const bufferData = buffersData[buffer];
			const { byteOffset, byteLength } = bufferView;
			return bufferData.slice(byteOffset, byteOffset + byteLength);
		}),
	);

	const accessorsData = accessors.map((accessor) => {
		const { bufferView } = accessor;
		const dataView = dataViews[bufferView];
		const { type, componentType, count, min, max } = accessor;
		return {
			type,
			componentType,
			count,
			min,
			max,
			data: new WEBGL_COMPONENT_TYPES[componentType](dataView),
		};
	});

	const scenesData = scenes.map((scene) => {
		const { nodes: nodesID } = scene;
		const nodesData = nodesID.map((nodeID) => {
			const nodeData = nodes[nodeID];
			if (nodeData.mesh != null) {
				const { mesh } = nodeData;
				const meshData = meshes[mesh];
				const { primitives } = meshData;
				const primitivesData = primitives.map((primitive) => {
					const { attributes } = primitive;
					const { POSITION, NORMAL, TEXCOORD_0 } = attributes;
					const positionAccessor = accessorsData[POSITION];
					const normalAccessor = accessorsData[NORMAL];
					const uvAccessor = accessorsData[TEXCOORD_0];
					return {
						position: positionAccessor,
						normal: normalAccessor,
						uv: uvAccessor,
						material: primitive.material,
					};
				});
				return {
					...nodeData,
					mesh: primitivesData,
				};
			} else if (nodeData.camera != null) {
				const { camera } = nodeData;
				const cameraData = cameras[camera];
				return {
					...nodeData,
					camera: cameraData,
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
		},
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
