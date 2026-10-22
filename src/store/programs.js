import { derived, get, writable } from "svelte/store";
import { appContext } from "./app-context";
import {
	bindDefaultFramebuffer,
	createProgram,
	createShaders,
	linkProgram,
	restoreViewport,
	setupAmbientLight,
	setupCamera,
	setupTime,
	setViewport,
	useProgram,
	validateProgram,
} from "./gl";
import { lights } from "./lights";
import { materials } from "./materials";
import { isSvelteGLInstancedMesh } from "./mesh-types.js";
import { clearUnusedCache, reconciliateCacheMap, selectProgram } from "./programs-cache";
import { sortMeshesByZ } from "./programs-utils";
import { scene } from "./scene";
function isTransparent(material) {
	return material?.opacity < 1 || material?.transparent;
}
/**
 * @typedef {Object} RenderPass
 * @property {import("src/store/programs").SvelteGLProgram[]} programs array of programs used in the pass
 * @property {() => WebGLTexture} getTexture function to get the shadow texture
 * @property {number} order order of the pass in the rendering pipeline
 * @property {string} [type] type of the pass
 */
/**
 * @type {import("svelte/store").Writable<RenderPass[]>}
 */
export const renderPasses = writable([]);

export const RENDER_PASS_TYPES = {
	FRAMEBUFFER_TO_TEXTURE: 0,
};
function sortTransparency(a, b) {
	return (isTransparent(a.material) ? 1 : -1) - (isTransparent(b.material) ? 1 : -1);
}

function sortOrder(a, b) {
	return a.order - b.order;
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
 * @property {Function} [setupAttributes]
 * @property {Function[]} [bindTextures]
 * @property {Function} [setFrameBuffer]
 * @property {Function} [setupCamera]
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

export function createProgramsStore({ scene, lights, materials, renderPasses, ctx }) {
	const numLigths = derived([lights], ([$lights]) => {
		return $lights.length;
	});
	return derived([scene, numLigths, materials, renderPasses], ([$scene, $numLigths, $materials, $renderPasses]) => {
		const prePasses = $renderPasses
			.filter((pass) => pass.order < 0)
			.reduce(
				(acc, pass) => {
					return acc.concat(...pass.programs);
				},
				/** @type {SvelteGLProgram[]} */ [],
			)
			.map((program) => ({
				...program,
				...(program.updateProgram ? {} : { updateProgram: [] }),
				...(program.allMeshes ? { meshes: $scene } : {}),
			}));

		const concurrentPasses = $renderPasses
			.filter((pass) => pass.order === 0)
			.reduce(
				(acc, pass) => {
					return acc.concat(...pass.programs);
				},
				/** @type {SvelteGLProgram[]} */ [],
			)
			.map((program) => ({
				...program,
				...(program.updateProgram ? {} : { updateProgram: [] }),
				...(program.allMeshes ? { meshes: $scene } : {}),
			}));

		const postPasses = $renderPasses
			.filter((pass) => pass.order > 0)
			.reduce((acc, pass) => {
				return acc.concat(...pass.programs);
			}, [])
			.map((program) => ({
				...program,
				...(program.updateProgram ? {} : { updateProgram: [] }),
				...(program.allMeshes ? { meshes: $scene } : {}),
			}))
			.sort(sortOrder);

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
					...(requireTime && { requireTime }),
					material: get(current),
					meshes: [mesh],
				});
			});
			return acc;
		}, []);

		// Materials drawn in a viewport go last, over the rest: the canvas clear never erases them.
		const sorted = sortMeshesByZ(programs.sort(sortTransparency), ctx.camera);
		const sortedPrograms = [...sorted.filter((p) => !p.material.viewport), ...sorted.filter((p) => p.material.viewport)];

		// TODO make two different numligth store, one for each light type, when spotlight is supported
		//const pointLights = $lights.filter((l) => get(l).type === "point");
		const numPointLights = $numLigths;

		let pointLightShader;
		if (numPointLights > 0) {
			pointLightShader = get(get(lights)[0]).shader;
		}

		// The first program of each viewport clears its depth, the next ones of that viewport keep it.
		const seenViewports = new Set();
		/** @type {SvelteGLProgram[]} */
		const next = [
			...prePasses,
			...concurrentPasses,
			...sortedPrograms.map((p, index) => {
				const firstCall = index === 0;
				if (p.material.program) {
					const program = p.material.program;
					program.meshes = p.meshes;
					// A custom program drawing to the canvas clears it when first, like the default program below.
					if (program.setFrameBuffer == null || program.setFrameBuffer === bindDefaultFramebuffer) {
						program.setFrameBuffer = firstCall && concurrentPasses.length === 0 ? bindDefaultFramebuffer : null;
					}
					reconciliateCacheMap(p, program, ctx);
					return program;
				}
				const program = {
					...p,
					useProgram,
					setupProgram: null,
					setFrameBuffer: null,
					setupMaterial: [],
					// Per draw, so a renderer ambient change reaches cached programs.
					updateProgram: [setupAmbientLight],
					bindTextures: [],
					createProgram,
					selectProgram: (programStore) => selectProgram(programStore, ctx),
					setupCamera: undefined,
				};
				reconciliateCacheMap(p, program, ctx);

				program.setupProgram = [
					createShaders(p.material, p.meshes, numPointLights, pointLightShader),
					linkProgram,
					validateProgram,
				];
				const clears = firstCall && concurrentPasses.length === 0;
				const { viewport } = p.material;
				if (viewport) {
					// Its own camera and rectangle, set back to the full canvas after its meshes.
					const toViewport = setViewport(viewport.rect, !seenViewports.has(viewport));
					seenViewports.add(viewport);
					program.setFrameBuffer = clears
						? (context) => {
								bindDefaultFramebuffer(context);
								toViewport(context);
							}
						: toViewport;
					program.postDraw = restoreViewport;
					program.setupCamera = () => setupCamera(viewport.camera);
				} else if (clears) {
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
				if (p.material?.envMap) {
					program.setupMaterial.push(p.material.envMap.setupTexture);
					program.bindTextures.push(p.material.envMap.bindTexture);
				}
				if (p.material?.lightMap) {
					program.setupMaterial.push(p.material.lightMap.setupTexture);
					program.bindTextures.push(p.material.lightMap.bindTexture);
				}
				if (p.requireTime) {
					program.updateProgram.push(setupTime);
				}
				for (const animation of p.meshes.flatMap((mesh) => mesh.animations ?? [])) {
					program.updateProgram.push(...(animation.updateProgram ?? []));
				}
				program.updateProgram.push(
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
			...postPasses,
		];
		clearUnusedCache(next, ctx, scene);
		return next;
	});
}

export const programs = createProgramsStore({ scene, lights, materials, renderPasses, ctx: appContext });
