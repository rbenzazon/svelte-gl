import { initDracoDecoder } from "../loaders/dracoDecoder.js";
import { isGLTFMeshData, loadGLTFFile, mapScene, createMeshFromGLTF } from "../loaders/gltf-loader.js";
import { copy, translate } from "gl-matrix/esm/mat4.js";
import { createZeroMatrix } from "../geometries/common.js";

export async function create3DFont(modelUrl, modelUrlBin, fontMaterial) {
	const letterSpacing = 0.4;
	const dracoDecoder = await initDracoDecoder("draco/");
	const fontFile = await loadGLTFFile(modelUrl, modelUrlBin, dracoDecoder);
	const letterMap = mapScene(fontFile.scene).reduce((acc, data) => {
		if (isGLTFMeshData(data)) {
			acc[data.name] = data;
		}
		return acc;
	}, {});
	const meshMap = {};

	for (const key in letterMap) {
		const mesh = createMeshFromGLTF(fontFile, letterMap[key]);
		delete mesh.matrix;
		const object = {
			...mesh,
			material: fontMaterial,
			instances: 0,
			matrices: [],
		};
		meshMap[key] = object;
	}
	const displayedMeshes = {};
	return {
		letterSpacing,
		fontFile,
		letterMap,
		meshMap,
		displayedMeshes,
	};
}

export function create3DWord(word, font, baseMatrix) {
	let cursorPos = 0;
	const { letterSpacing, meshMap } = font;
	const chars = word.split("");
	const charSet = new Set(chars);
	// remove space from set
	charSet.delete(" ");
	const charSetMeshes = {};

	for (const char of chars) {
		const mesh = meshMap[char];
		if (!charSetMeshes[char] && mesh) {
			charSetMeshes[char] = mesh;
		}
		if (char === " ") {
			cursorPos += letterSpacing;
			continue;
		}
		mesh.instances++;
		const matrix = copy(createZeroMatrix(), baseMatrix);
		translate(matrix, matrix, [cursorPos, 0, 0]);
		mesh.matrices.push(matrix);
		cursorPos += letterSpacing;
	}

	font.cursorPos = cursorPos;

	return Object.values(charSetMeshes);
}
