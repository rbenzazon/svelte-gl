import { multiply, getTranslation } from "gl-matrix/esm/mat4.js";
import { transformMat4 } from "gl-matrix/esm/vec3.js";
import { writable, get, derived } from "svelte/store";
import { camera } from "./camera";
import { reconciliateCacheMap, clearUnusedCache, selectProgram } from "./engine";
import { isSvelteGLInstancedMesh } from "./mesh-types.js";
import { scene } from "./scene";
import {
	getCameraProjectionView,
	setupAmbientLight,
	createShaders,
	linkProgram,
	validateProgram,
	bindDefaultFramebuffer,
	setupTime,
	useProgram,
	createProgram,
} from "./gl";
import { numLigths, lights } from "./lights";
import { materials } from "./materials";
import { renderer } from "./renderer";

export const renderPasses = writable([]);

export const RENDER_PASS_TYPES = {
	FRAMEBUFFER_TO_TEXTURE: 0,
};
export function isTransparent(material) {
	return material?.opacity < 1 || material?.transparent;
}
function sortTransparency(a, b) {
	return (isTransparent(a.material) ? 1 : -1) - (isTransparent(b.material) ? 1 : -1);
}
/**
 * Sorts meshes by Z depth for transparency rendering
 * @template {SvelteGLProgram[]|SvelteGLProgramProject[]} T
 * @param {T} programs - Array of programs to sort
 * @returns {T} - Sorted array with the same type as input
 */
export function sortMeshesByZ(programs) {
	if (programs.length === 0 || get(renderer).canvas == null) {
		return programs;
	}
	let transparent = false;
	const canvas = get(renderer).canvas;
	const { projection, view } = getCameraProjectionView(get(camera), canvas.width, canvas.height);
	const projScreen = multiply([], projection, view);

	programs.forEach((program) => {
		if (transparent || isTransparent(program.material)) {
			transparent = true;
			program.meshes.forEach((mesh, i) => {
				const meshPosition = getTranslation([], mesh.matrix);
				mesh.clipSpacePosition = transformMat4([], meshPosition, projScreen);
			});
			program.meshes = program.meshes.sort((a, b) => {
				return b.clipSpacePosition[2] - a.clipSpacePosition[2];
			});
		}
	});

	const sortedPrograms = programs.sort((a, b) => {
		if (
			a.material == null ||
			b.material == null ||
			a.meshes[0].clipSpacePosition == null ||
			b.meshes[0].clipSpacePosition == null
		) {
			return 0;
		}
		return b.meshes[0].clipSpacePosition[2] - a.meshes[0].clipSpacePosition[2];
	});
	// @ts-ignore, trust me bro
	return sortedPrograms;
}
/**
 * @typedef {Object} SvelteGLProgramProject
 * @property {SvelteGLMaterial} material
 * @property {SvelteGLMesh[]} meshes
 * @property {boolean} [requireTime]
 */
/**
 * @typedef {Object} SvelteGLProgram
 * @property {Function} createProgram
 * @property {Function[]} setupProgram
 * @property {Function[]} setupMaterial
 * @property {Function} useProgram
 * @property {Function} selectProgram
 * @property {Function} setupCamera
 * @property {Function} setFrameBuffer
 * @property {Function[]} bindTextures
 * @property {SvelteGLMaterial} [material]
 * @property {SvelteGLMesh[]} [meshes]
 * @property {Function[]} [updateProgram]
 * @property {boolean} [allMeshes]
 * @property {Function} [postDraw]
 */
/**
 * @typedef {import("svelte/store").Readable<SvelteGLProgram[]>} SvelteGLProgramStore
 */
/**
 * @type {SvelteGLProgramStore}
 */

export const programs = derived(
	[scene, numLigths, materials, renderPasses],
	([$scene, $numLigths, $materials, $renderPasses]) => {
		let prePasses = $renderPasses
			.filter((pass) => pass.order < 0)
			.reduce((acc, pass) => {
				return acc.concat(...pass.programs);
			}, [])
			.map((program) => ({
				...program,
				updateProgram: [],
				...(program.allMeshes ? { meshes: $scene } : {}),
			}));

		//this sublist mesh items require their own respective program (shader)
		const specialMeshes = new Set(
			$scene.filter((node) => isSvelteGLInstancedMesh(node) || node.animations?.some((a) => a.type === "vertex")),
		);
		/** @type {Array<SvelteGLProgramProject>} */
		const programs = Array.from($materials).reduce((acc, current) => {
			const materialMeshes = $scene.filter((node) => node.material === current);
			/**
			 * @type {{currentNormalMeshes:SvelteGLMesh[],currentSpecialMeshes:SvelteGLMesh[]}}
			 */
			const { currentNormalMeshes, currentSpecialMeshes } = materialMeshes.reduce(
				(acc, node) => {
					if (specialMeshes.has(node)) {
						acc.currentSpecialMeshes.push(node);
					} else {
						acc.currentNormalMeshes.push(node);
					}
					return acc;
				},
				{
					currentNormalMeshes: [],
					currentSpecialMeshes: [],
				},
			);

			if (currentNormalMeshes.length > 0) {
				acc.push({
					material: get(current),
					meshes: currentNormalMeshes,
				});
			}
			currentSpecialMeshes.forEach((mesh) => {
				const requireTime = mesh.animations?.some((animation) => animation.requireTime);
				acc.push({
					requireTime,
					material: get(current),
					meshes: [mesh],
				});
			});
			return acc;
		}, []);

		const sortedPrograms = sortMeshesByZ(programs.sort(sortTransparency));

		// TODO make two different numligth store, one for each light type, when spotlight is supported
		//const pointLights = $lights.filter((l) => get(l).type === "point");
		const numPointLights = $numLigths;

		let pointLightShader;
		if (numPointLights > 0) {
			pointLightShader = get(get(lights)[0]).shader;
		}

		/** @type {SvelteGLProgram[]} */
		const next = [
			...prePasses,
			...sortedPrograms.map((p, index) => {
				const firstCall = index === 0;
				const program = {
					...p,
					useProgram,
					setupProgram: null,
					setFrameBuffer: null,
					setupMaterial: [setupAmbientLight],
					updateProgram: [],
					bindTextures: [],
					createProgram,
					selectProgram,
					setupCamera: undefined,
				};
				reconciliateCacheMap(p, program);

				program.setupProgram = [
					createShaders(p.material, p.meshes, numPointLights, pointLightShader),
					linkProgram,
					validateProgram,
				];
				if (firstCall) {
					program.setFrameBuffer = bindDefaultFramebuffer;
				}
				if (p.material?.specular) {
					program.setupMaterial.push(p.material.specular.setupSpecular);
				}
				if (p.material?.diffuseMap) {
					program.setupMaterial.push(p.material.diffuseMap.setupTexture);
					program.bindTextures.push(p.material.diffuseMap.bindTexture);
				}
				if (p.material?.normalMap) {
					program.setupMaterial.push(p.material.normalMap.setupTexture);
					program.bindTextures.push(p.material.normalMap.bindTexture);
				}
				if (p.material?.roughnessMap) {
					program.setupMaterial.push(p.material.roughnessMap.setupTexture);
					program.bindTextures.push(p.material.roughnessMap.bindTexture);
				}
				if (p.requireTime) {
					program.updateProgram.push(setupTime);
				}
				program.setupMaterial.push(
					...Array.from(
						get(lights).reduce((acc, light) => {
							const lightValue = get(light);
							if (acc.has(lightValue.setupLights)) {
								acc.set(lightValue.setupLights, [...acc.get(lightValue.setupLights), light]);
							} else {
								acc.set(lightValue.setupLights, [light]);
							}
							return acc;
						}, new Map()),
					).map(([setupLights, filteredLights]) => setupLights(filteredLights)),
				);
				return program;
			}),
		];
		clearUnusedCache(next);
		return next;
	},
);
