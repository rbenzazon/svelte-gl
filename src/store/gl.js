import { invert, multiply } from "gl-matrix/esm/mat4.js";
import { create as createM3, invert as invertM3, transpose as transposeM3, fromMat4 } from "gl-matrix/esm/mat3.js";
import { get } from "svelte/store";
import defaultVertex from "../shaders/default-vertex.glsl";
import defaultFragment from "../shaders/default-fragment.glsl";
import { objectToDefines, templateLiteralRenderer } from "../shaders/template.js";
import { SRGBToLinear } from "../color/color-space.js";
import { appContext, setAppContext } from "./app-context";
import { camera } from "./camera.js";
import { createZeroMatrix } from "../geometries/common";
import { isSvelteGLSingleMesh } from "./mesh-types";

// Uniform Buffer Objects, must have unique binding points
export const UBO_BINDING_POINT_POINTLIGHT = 0;
export const UBO_BINDING_POINT_SPOTLIGHT = 1;

export function initRenderer() {
	/** @type {WebGL2RenderingContext} */
	const gl = appContext.canvas.getContext("webgl2");
	appContext.gl = gl;

	gl.enable(gl.DEPTH_TEST);
	gl.enable(gl.CULL_FACE);
	gl.frontFace(gl.CCW);
	gl.cullFace(gl.BACK);
}

export function setFaceWinding(ccw = true) {
	return function setFaceWinding() {
		const { gl } = appContext;
		gl.frontFace(ccw ? gl.CCW : gl.CW);
	};
}

export function enableBlend() {
	const { gl } = appContext;
	gl.enable(gl.BLEND);
	gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
}

export function disableBlend() {
	const { gl } = appContext;
	gl.disable(gl.BLEND);
}

export function setupTime() {
	const { gl, program } = appContext;
	const timeLocation = gl.getUniformLocation(program, "time");
	gl.uniform1f(timeLocation, performance.now());
}

export function clearFrame() {
	const { gl, backgroundColor } = appContext;

	gl.clearColor(...backgroundColor);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}

export function render(mesh, instances, drawMode) {
	return function render() {
		const { gl } = appContext;

		const positionSize = mesh.attributes.positionsSize ?? 3;

		const attributeLength = mesh.attributes.elements
			? mesh.attributes.elements.length
			: mesh.attributes.positions.length / positionSize;

		if (instances) {
			if (mesh.attributes.elements) {
				gl.drawElementsInstanced(gl[drawMode], attributeLength, gl.UNSIGNED_SHORT, 0, instances);
			} else {
				gl.drawArraysInstanced(gl[drawMode], 0, attributeLength, instances);
			}
		} else {
			if (mesh.attributes.elements) {
				gl.drawElements(gl[drawMode], attributeLength, gl.UNSIGNED_SHORT, 0);
			} else {
				gl.drawArrays(gl[drawMode], 0, attributeLength);
			}
		}
		gl.bindVertexArray(null);
	};
}

export function bindVAO() {
	const { gl, vao } = appContext;
	gl.bindVertexArray(vao);
}

export function createProgram(programStore) {
	return function createProgram() {
		const { gl } = appContext;
		const program = gl.createProgram();
		appContext.programMap.set(programStore, program);
		appContext.vaoMap.set(programStore, new Map());
		appContext.program = program;
	};
}

export function linkProgram() {
	const { gl, program } = appContext;
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		console.error("ERROR linking program!", gl.getProgramInfoLog(program));
	}
}

export function validateProgram() {
	const { gl, program } = appContext;
	gl.validateProgram(program);
	if (!gl.getProgramParameter(program, gl.VALIDATE_STATUS)) {
		console.error("ERROR validating program!", gl.getProgramInfoLog(program));
	}
}

export function useProgram() {
	const { gl, program } = appContext;
	gl.useProgram(program);
}

export function resetViewportToCanvas() {
	const { gl } = appContext;
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
}

export function bindDefaultFramebuffer() {
	const { gl, backgroundColor } = appContext;
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
	appContext.frameBufferWidth = gl.canvas.width;
	appContext.frameBufferHeight = gl.canvas.height;
	gl.clearColor(...backgroundColor);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}

export function createShaders(material, meshes, numPointLights, pointLightShader) {
	return function createShaders() {
		const { gl, program } = appContext;

		let vertexDeclarations = "";
		let vertexPositionModifiers = "";

		let vertexAnimationsDeclaration = "";
		let vertexAnimationsModifier = "";
		const [mesh] = meshes;
		const vertexAnimationComponents = mesh.animations?.filter(({ type }) => type === "vertex");
		if (vertexAnimationComponents?.length > 0) {
			vertexAnimationsDeclaration += vertexAnimationComponents.reduce((acc, component) => {
				return acc + component.shader({ declaration: true });
			}, "");
			vertexAnimationsModifier += vertexAnimationComponents.reduce((acc, component) => {
				return acc + component.shader({ position: true });
			}, "");
			vertexDeclarations += vertexAnimationsDeclaration;
			vertexPositionModifiers += vertexAnimationsModifier;
		}
		const vertexShaderSource = templateLiteralRenderer(defaultVertex, {
			instances: false,
			declarations: "",
			positionModifier: "",
		})({
			instances: mesh.instances >= 1,
			declarations: vertexDeclarations,
			positionModifier: vertexPositionModifiers,
		});
		//console.log("vertexShaderSource", vertexShaderSource);

		let specularDeclaration = "";
		let specularMaterial = "";
		let specularIrradiance = "";
		if (material.specular) {
			specularDeclaration = material.specular.shader({ declaration: true });
			specularMaterial = material.specular.shader({ material: true });
			specularIrradiance = material.specular.shader({ irradiance: true });
		}
		let diffuseMapDeclaration = "";
		let diffuseMapSample = "";
		if (material.diffuseMap) {
			diffuseMapDeclaration = material.diffuseMap.shader({
				declaration: true,
				declarationNormal: false,
				mapType: material.diffuseMap.type,
			});
			diffuseMapSample = material.diffuseMap.shader({
				diffuseMapSample: true,
				mapType: material.diffuseMap.type,
				coordinateSpace: material.diffuseMap.coordinateSpace,
			});
		}
		let normalMapDeclaration = "";
		let normalMapSample = "";
		if (material.normalMap) {
			normalMapDeclaration = material.normalMap.shader({
				declaration: true,
				declarationNormal: true,
				mapType: material.normalMap.type,
			});
			normalMapSample = material.normalMap.shader({
				normalMapSample: true,
				mapType: material.normalMap.type,
			});
		}
		let roughnessMapDeclaration = "";
		let roughnessMapSample = "";
		if (material.roughnessMap) {
			roughnessMapDeclaration = material.roughnessMap.shader({
				declaration: true,
				declarationNormal: false,
				mapType: material.roughnessMap.type,
			});
			roughnessMapSample = material.roughnessMap.shader({
				roughnessMapSample: true,
				mapType: material.roughnessMap.type,
			});
		}
		let envMapDeclaration = "";
		let envMapIrradiance = "";
		if (material.envMap) {
			envMapDeclaration = material.envMap.shader({
				declaration: true,
				...material.envMap.shaderDefines,
			});
			envMapIrradiance = material.envMap.shader({
				irradiance: true,
			});
		}

		const fragmentShaderSource = templateLiteralRenderer(defaultFragment, {
			defines: "",
			declarations: "",
			diffuseMapSample: "",
			normalMapSample: "",
			roughnessMapSample: "",
			material: "",
			irradiance: "",
			toneMapping: "",
			numPointLights: 0,
		})({
			defines: objectToDefines({
				...(numPointLights
					? {
							NUM_POINT_LIGHTS: numPointLights,
						}
					: undefined),
			}),
			declarations: [
				...(numPointLights ? [pointLightShader({ declaration: true, irradiance: false })] : []),
				...(appContext.toneMappings?.length > 0
					? [...appContext.toneMappings.map((tm) => tm.shader({ declaration: true, exposure: tm.exposure }))]
					: []),
				...(material.specular ? [specularDeclaration] : []),
				...(material.diffuseMap ? [diffuseMapDeclaration] : []),
				...(material.normalMap ? [normalMapDeclaration] : []),
				...(material.roughnessMap ? [roughnessMapDeclaration] : []),
				...(material.envMap ? [envMapDeclaration] : []),
			].join("\n"),
			diffuseMapSample,
			normalMapSample,
			roughnessMapSample,
			material: [...(material.specular ? [specularMaterial] : [])].join("\n"),
			irradiance: [
				...(numPointLights ? [pointLightShader({ declaration: false, irradiance: true, specularIrradiance })] : []),
				...(material.envMap ? [envMapIrradiance] : []),
			].join("\n"),
			toneMapping: [
				...(appContext.toneMappings?.length > 0
					? [...appContext.toneMappings.map((tm) => tm.shader({ color: true }))]
					: []),
			].join("\n"),
			//todo, remove this after decoupling the point light shader
			numPointLights,
		});
		//console.log(fragmentShaderSource);

		compileShaders(gl, program, vertexShaderSource, fragmentShaderSource);
	};
}

export function compileShaders(gl, program, vertexShaderSource, fragmentShaderSource) {
	const vertexShader = gl.createShader(gl.VERTEX_SHADER);
	gl.shaderSource(vertexShader, vertexShaderSource);
	gl.compileShader(vertexShader);
	if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
		console.error("ERROR compiling vertex shader!", gl.getShaderInfoLog(vertexShader));
	}
	gl.attachShader(program, vertexShader);
	const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
	gl.shaderSource(fragmentShader, fragmentShaderSource);
	gl.compileShader(fragmentShader);
	if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
		console.error("ERROR compiling fragment shader!", gl.getShaderInfoLog(fragmentShader));
	}
	gl.attachShader(program, fragmentShader);
}

export function createFBO(width, height, setFBO, setTexture) {
	return function createFBO() {
		const { gl } = appContext;
		// The geometry texture will be sampled during the HORIZONTAL pass
		const texture = gl.createTexture();
		setTexture(texture);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, width, height);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

		const fbo = gl.createFramebuffer();
		setFBO(fbo);
		gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

		gl.bindTexture(gl.TEXTURE_2D, null);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	};
}
export function unbindTexture() {
	const { gl } = appContext;
	gl.bindTexture(gl.TEXTURE_2D, null);
}
/**
 *
 * @param {SvelteGLMaterial} param0
 * @returns {()=>void}
 */
export function setupMeshColor({ diffuse, metalness, opacity }) {
	return function setupMeshColor() {
		const { gl, program } = appContext;
		const colorLocation = gl.getUniformLocation(program, "diffuse");
		if (colorLocation == null) {
			return;
		}
		gl.uniform3fv(colorLocation, new Float32Array(diffuse.map(SRGBToLinear)));
		if (metalness == null) {
			console.log("metalness is null, material won't display correctly");
		}
		const metalnessLocation = gl.getUniformLocation(program, "metalness");
		gl.uniform1f(metalnessLocation, metalness);
		const opacityLocation = gl.getUniformLocation(program, "opacity");
		gl.uniform1f(opacityLocation, opacity ?? 1);
	};
}

export function setupAmbientLight(programOverride, ambientLightColorOverride) {
	const { gl, program, ambientLightColor } = appContext;
	const currentProgram = programOverride ?? program;
	const currentAmbientLightColor = ambientLightColorOverride ?? ambientLightColor;
	const ambientLightColorLocation = gl.getUniformLocation(currentProgram, "ambientLightColor");
	gl.uniform3fv(ambientLightColorLocation, new Float32Array(currentAmbientLightColor));
}

function invertViewMatrix(view) {
	return invert(createZeroMatrix(), view);
}

export function setupCamera(camera) {
	return function createCamera() {
		const { gl, program } = appContext;
		const { projection, view } = camera;

		const projectionLocation = gl.getUniformLocation(program, "projectionMatrix");
		gl.uniformMatrix4fv(projectionLocation, false, projection);

		const cameraPositionLocation = gl.getUniformLocation(program, "cameraPosition");
		gl.uniform3fv(cameraPositionLocation, get(camera).position);

		const viewMatrixLocation = gl.getUniformLocation(program, "viewMatrix");
		gl.uniformMatrix4fv(viewMatrixLocation, false, view);

		const viewLocation = gl.getUniformLocation(program, "view");
		if (viewLocation != null) {
			gl.uniformMatrix4fv(viewMatrixLocation, false, view);
		}
	};
}

function setObjectMatrixUniforms(gl, program, objectMatrix) {
	const modelMatrixLocation = gl.getUniformLocation(program, "modelMatrix");
	if (modelMatrixLocation != null) {
		gl.uniformMatrix4fv(modelMatrixLocation, false, objectMatrix.value);
	}
	const modelViewMatrixLocation = gl.getUniformLocation(program, "modelViewMatrix");
	if (modelViewMatrixLocation != null) {
		gl.uniformMatrix4fv(modelViewMatrixLocation, false, objectMatrix.modelView);
	}
}

/**
 * @param {import("./programs").SvelteGLProgram} programStore
 * @param {SvelteGLMesh} mesh
 */
export function setupObjectMatrix(programStore, mesh) {
	if (isSvelteGLSingleMesh(mesh)) {
		return function setupObjectMatrix() {
			const { gl, program } = appContext;
			setObjectMatrixUniforms(gl, program, mesh.matrix);
		};
	} else {
		return function setupObjectMatrix() {
			const { gl, program, vaoMap } = appContext;
			const vao = vaoMap.get(programStore).get(mesh);

			mesh.matrices.modelViewBuffer = createMatInstanceBuffer(
				gl,
				program,
				vao,
				"modelViewMatrix",
				mesh.matrices.modelView,
				4,
				mesh.matrices.modelViewBuffer,
			);

			mesh.matrices.buffer = createMatInstanceBuffer(
				gl,
				program,
				vao,
				"modelMatrix",
				mesh.matrices.value,
				4,
				mesh.matrices.buffer,
			);
		};
	}
}

function createMatInstanceBuffer(gl, program, vao, attributeName, matData, size, buffer = null) {
	gl.bindVertexArray(vao);
	const location = gl.getAttribLocation(program, attributeName);
	let matBuffer;
	if (buffer == null) {
		matBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, matBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, matData.byteLength, gl.DYNAMIC_DRAW);
		const bytesPerMatrix = 4 * size * size;
		for (let i = 0; i < size; ++i) {
			const loc = location + i;
			gl.enableVertexAttribArray(loc);
			const offset = i * size * 4; //
			gl.vertexAttribPointer(loc, size, gl.FLOAT, false, bytesPerMatrix, offset);
			gl.vertexAttribDivisor(loc, 1);
		}
	} else {
		matBuffer = buffer;
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	}
	gl.bufferSubData(gl.ARRAY_BUFFER, 0, matData);

	gl.bindVertexArray(null);
	return matBuffer;
}
export function updateObjectMatrix(programStore, objectMatrix) {
	const { gl, programMap } = appContext;
	const program = programMap.get(programStore);
	gl.useProgram(program);
	setObjectMatrixUniforms(gl, program, objectMatrix);
}
export function updateInstanceObjectMatrix(programStore, mesh, newMatrix, instanceIndex, modelViewBuffer) {
	const { gl, vaoMap } = appContext;
	gl.bindVertexArray(vaoMap.get(programStore).get(mesh));
	gl.bindBuffer(gl.ARRAY_BUFFER, modelViewBuffer);
	const bytesPerMatrix = 4 * 16;
	gl.bufferSubData(gl.ARRAY_BUFFER, instanceIndex * bytesPerMatrix, newMatrix);
	gl.bindVertexArray(null);
}
/**
 * @param {import("./programs").SvelteGLProgram} programStore
 * @param {SvelteGLMesh} mesh
 */
export function setupNormalMatrix(programStore, mesh) {
	if (isSvelteGLSingleMesh(mesh)) {
		return function setupNormalMatrix() {
			/** @type {{gl:WebGL2RenderingContext,program: WebGLProgram}} **/
			const { gl, program } = appContext;
			const normalMatrixLocation = gl.getUniformLocation(program, "normalMatrix");
			if (normalMatrixLocation == null) {
				return;
			}
			gl.uniformMatrix3fv(normalMatrixLocation, false, mesh.matrix.normalMatrix);
		};
	} else {
		return function setupNormalMatrix() {
			const { gl, program, vaoMap } = appContext;
			const normalMatricesLocation = gl.getAttribLocation(program, "normalMatrix");
			if (normalMatricesLocation == null) {
				return;
			}
			const vao = vaoMap.get(programStore).get(mesh);
			mesh.matrices.normalMatrixBuffer = createMatInstanceBuffer(
				gl,
				program,
				vao,
				"normalMatrix",
				mesh.matrices.normalMatrices,
				3,
				mesh.matrices.normalMatrixBuffer,
			);
		};
	}
}
export function updateNormalMatrix(programStore, objectMatrix) {
	const { gl, programMap } = appContext;
	const program = programMap.get(programStore);
	const normalMatrixLocation = gl.getUniformLocation(program, "normalMatrix");
	gl.uniformMatrix3fv(normalMatrixLocation, false, objectMatrix.normalMatrix);
}

export function updateInstanceNormalMatrix(programStore, mesh, normalMatrix, instanceIndex, normalMatrixBuffer) {
	const { gl, vaoMap } = appContext;
	gl.bindVertexArray(vaoMap.get(programStore).get(mesh));
	gl.bindBuffer(gl.ARRAY_BUFFER, normalMatrixBuffer);
	const bytesPerMatrix = 4 * 9;
	gl.bufferSubData(gl.ARRAY_BUFFER, instanceIndex * bytesPerMatrix, normalMatrix);
	gl.bindVertexArray(null);
}

function getBuffer(variable) {
	let dataSource;
	let interleaved;
	if (variable.data) {
		dataSource = variable.data;
		interleaved = variable.interleaved;
	} else {
		dataSource = variable;
	}
	const data = dataSource.buffer && dataSource.buffer instanceof ArrayBuffer ? dataSource : new Float32Array(dataSource);
	return {
		data,
		interleaved,
		...(interleaved
			? { byteStride: variable.byteStride, byteOffset: variable.byteOffset }
			: { byteStride: 0, byteOffset: 0 }),
	};
}

export function setupAttributes(programStore, mesh) {
	return function setupAttributes() {
		const { gl, program, vaoMap } = appContext;
		const { positions, normals, elements, uvs, positionsSize } = mesh.attributes;
		let vao;
		if (vaoMap.has(programStore) && vaoMap.get(programStore).has(mesh)) {
			vao = vaoMap.get(programStore).get(mesh);
		} else {
			vao = gl.createVertexArray();
			vaoMap.get(programStore).set(mesh, vao);
		}
		appContext.vao = vao;
		gl.bindVertexArray(vao);
		const {
			data: positionsData,
			interleaved: positionsInterleaved,
			byteStride: positionsByteStride,
			byteOffset: positionsByteOffset,
		} = getBuffer(positions);
		//position
		const positionBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, positionsData, gl.STATIC_DRAW);
		const positionLocation = gl.getAttribLocation(program, "position");
		gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer); //todo check if redundant
		const size = positionsSize != null ? positionsSize : 3;
		gl.vertexAttribPointer(positionLocation, size, gl.FLOAT, false, positionsByteStride, positionsByteOffset);
		gl.enableVertexAttribArray(positionLocation);
		//normal
		if (mesh.attributes.normals) {
			const {
				data: normalsData,
				interleaved: normalsInterleaved,
				byteStride: normalsByteStride,
				byteOffset: normalsByteOffset,
			} = getBuffer(normals);
			if (!normalsInterleaved) {
				const normalBuffer = gl.createBuffer();
				gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
				gl.bufferData(gl.ARRAY_BUFFER, normalsData, gl.STATIC_DRAW);
				gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer); //todo check if redundant
			}
			const normalLocation = gl.getAttribLocation(program, "normal");
			if (normalLocation != -1) {
				gl.vertexAttribPointer(normalLocation, 3, gl.FLOAT, false, normalsByteStride, normalsByteOffset);
				gl.enableVertexAttribArray(normalLocation);
			}
		}
		if (elements) {
			const elementsData = Array.isArray(elements) ? new Uint16Array(elements) : elements;
			const elementBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elementBuffer);
			gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, elementsData, gl.STATIC_DRAW);
		}
		if (uvs) {
			const uvsData = Array.isArray(uvs) ? new Float32Array(uvs) : uvs;
			const uvBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, uvsData, gl.STATIC_DRAW);
			const uvLocation = gl.getAttribLocation(program, "uv");
			if (uvLocation != -1) {
				gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
				gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 0, 0);
				gl.enableVertexAttribArray(uvLocation);
			}
		}
		// this sets up special custom attributes
		// these are attributes that are not part of the base mesh
		const baseAttributes = ["positions", "normals", "uvs", "elements"];
		Object.entries(mesh.attributes)
			.filter(([key]) => !baseAttributes.includes(key))
			.forEach(([key, value]) => {
				if (typeof value === "object" && "itemSize" in value && "array" in value) {
					const data = Array.isArray(value.array) ? new Float32Array(value.array) : value.array;
					const buffer = gl.createBuffer();
					gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
					gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
					const location = gl.getAttribLocation(program, key);
					if (location != -1) {
						gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
						gl.vertexAttribPointer(location, value.itemSize, gl.FLOAT, false, 0, 0);
						gl.enableVertexAttribArray(location);
					}
				}
			});

		gl.bindVertexArray(null);
	};
}
