import { A as drawModes, F as appContext, G as getTranslation, H as orthoNO, I as lookAt, J as linkProgram, K as validateProgram, L as useProgram, M as selectProgram, l as identity, N as multiply, O as fromRotationTranslationScale } from './texture-C302gKqD.js';

function createCube() {
	return {
		attributes: {
			positions: [
				//top
				-1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0,
				//left
				-1.0, 1.0, 1.0, -1.0, -1.0, 1.0, -1.0, -1.0, -1.0, -1.0, 1.0, -1.0,
				//right
				1.0, 1.0, 1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0,
				//front
				1.0, 1.0, 1.0, 1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0,
				//back
				1.0, 1.0, -1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, -1.0,
				//bottom
				-1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0,
			],
			normals: [
				//top
				0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0,
				//left
				-1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0,
				//right
				1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0,
				//front
				0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0,
				//back
				0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0,
				//bottom
				0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0,
			],
			elements: [
				//top
				0, 1, 2, 0, 2, 3,
				//left
				5, 4, 6, 6, 4, 7,
				// right
				8, 9, 10, 8, 10, 11,
				//front
				13, 12, 14, 15, 14, 12,
				//back
				16, 17, 18, 16, 18, 19,
				//bottom
				21, 20, 22, 22, 20, 23,
			],
		},
		drawMode: drawModes[4],
	};
}

function createPlane(
	width = 1,
	depth = 1,
	widthSegments = 1,
	depthSegments = 1,
	clockwise = false,
	generateColors = false,
) {
	const positions = [];
	const normals = [];
	const uvs = [];
	const indices = [];
	const halfWidth = width / 2;
	const halfDepth = depth / 2;
	const segmentWidth = width / widthSegments;
	const segmentDepth = depth / depthSegments;
	const gridX = widthSegments + 1;
	const gridZ = depthSegments + 1;
	for (let iz = 0; iz < gridZ; iz++) {
		const z = iz * segmentDepth - halfDepth;
		for (let ix = 0; ix < gridX; ix++) {
			const x = ix * segmentWidth - halfWidth;
			positions.push(x, 0, -z);
			normals.push(0, 1, 0);
			uvs.push(ix / widthSegments, 1 - iz / depthSegments);
		}
	}
	for (let iz = 0; iz < depthSegments; iz++) {
		for (let ix = 0; ix < widthSegments; ix++) {
			const a = ix + gridX * iz;
			const b = ix + gridX * (iz + 1);
			const c = ix + 1 + gridX * (iz + 1);
			const d = ix + 1 + gridX * iz;
			if (clockwise) {
				indices.push(a, b, d);
				indices.push(b, c, d);
			} else {
				indices.push(a, d, b);
				indices.push(b, d, c);
			}
		}
	}
	return {
		attributes: {
			positions: new Float32Array(positions),
			normals: new Float32Array(normals),
			uvs: new Float32Array(uvs),
			elements: new Uint16Array(indices),
			...(generateColors ? { colors: new Float32Array(positions.map((_, i) => (i % 3 === 0 ? 1 : 1))) } : {}),
		},
		drawMode: drawModes[4],
	};
}

var depthVertexShader = "#version 300 es\r\n\r\nprecision highp float;\r\n\r\nuniform mat4 view;\r\nuniform mat4 projection;\r\nuniform mat4 world;\r\n\r\nin vec3 position;\r\n\r\nout vec2 vHighPrecisionZW;\r\n\r\nvoid main() {\r\n\tgl_Position = projection * view * world * vec4( position, 1.0 );\r\n\tvHighPrecisionZW = gl_Position.zw;\r\n}";

var depthFragmentShader = "#version 300 es\r\n\r\nout highp vec4 fragColor;\r\n\r\nprecision highp float;\r\nprecision highp int;\r\n\r\nuniform float darkness;\r\nin vec2 vHighPrecisionZW;\r\n\r\nvoid main() {\r\n\tfloat fragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;\r\n\tfragColor = vec4( vec3( 0.0 ), ( 1.0 - fragCoordZ ) * darkness );\r\n\t//fragColor = vec4( vec3( fragCoordZ ), 1.0 );\r\n\t//debug fragColor = vec4( vec3(( 1.0  ) ) ,1.0);\r\n}\r\n\t\t\t\t\t";

var vertexShaderSource = "#version 300 es\r\n\r\nin vec4 position;\r\nin vec2 uv;\r\n\r\nout vec2 vTexCoord;\r\n\r\nvoid main()\r\n{\r\n    gl_Position = position;\r\n    vTexCoord = uv;\r\n}";

var fragmentShaderSource = "#version 300 es\r\n\r\nprecision mediump float;\r\n\r\nuniform sampler2D sampler;\r\nuniform vec2 uvStride;\r\nuniform vec2[128] offsetAndScale; // x=offset, y=scale\r\nuniform int kernelWidth;\r\n\r\nin vec2 vTexCoord;\r\n\r\nout vec4 fragColor;\r\n\r\nvoid main()\r\n{\r\n\t//fragColor = vec4(vec3(vTexCoord.y),1.0);\r\n\t//fragColor += vec4(vec3(texture(sampler,vTexCoord).w),1.0);\r\n\tfor (int i = 0; i < kernelWidth; i++) {\r\n\r\n\t\tfragColor += texture(\r\n\t\t\tsampler,\r\n\t\t\tvTexCoord + offsetAndScale[i].x * uvStride\r\n\t\t    //   ^------------------------------------  UV coord for this fragment\r\n\t\t    //              ^-------------------------  Offset to sample (in texel space)\r\n\t\t    //                                  ^-----  Amount to move in UV space per texel (horizontal OR vertical only)\r\n\t\t    //   v------------------------------------  Scale down the sample\r\n\t\t) * offsetAndScale[i].y;\r\n\r\n\t\t//fragColor += vec4(vec3(0.01),1.0);\r\n\t}\r\n\t//float value = offsetAndScale[int(vTexCoord.x)].x;\r\n\t//fragColor = vec4(vec3(offsetAndScale[8].x/12.0),1.0);\r\n\t//fragColor = vec4(offsetAndScale[32].x,offsetAndScale[32].x,offsetAndScale[32].x,1.0);//texture(sampler,vTexCoord);\r\n}";

const BLUR_DIRECTION_HORIZONTAL = 0;
const BLUR_DIRECTION_VERTICAL = 1;

// Generate a gaussian kernel based on a width
const generate1DKernel = (width) => {
	if ((width & 1) !== 1) throw new Error("Only odd guassian kernel sizes are accepted");

	// Small sigma gaussian kernels are a problem. You usually need to add an error correction
	// algorithm. But since our kernels grow in discrete intervals, we can just pre-compute the
	// problematic ones. These values are derived from the Pascal's Triangle algorithm.
	/*const smallKernelLerps = [
        [1.0],
        [0.25, 0.5, 0.25],
        [0.0625, 0.25, 0.375, 0.25, 0.0625],
        [0.03125, 0.109375, 0.21875, 0.28125, 0.21875, 0.109375, 0.03125],
	];
	if (width < 9) return smallKernelLerps[(width - 1) >> 1];*/
	if (width < 9) throw new Error("Blur must be at least 9 pixels wide");

	const kernel = [];
	const sigma = width / 6; // Adjust as required
	const radius = (width - 1) / 2;

	let sum = 0;

	// Populate the array with gaussian kernel values
	for (let i = 0; i < width; i++) {
		const offset = i - radius;

		const coefficient = 1 / (sigma * Math.sqrt(2 * Math.PI));
		const exponent = -(offset * offset) / (2 * (sigma * sigma));
		const value = coefficient * Math.exp(exponent);

		// We'll need this for normalization below
		sum += value;

		kernel.push(value);
	}

	// Normalize the array
	for (let i = 0; i < width; i++) {
		kernel[i] /= sum;
	}

	return kernel;
};

// Convert a 1D gaussian kernel to value pairs, as an array of linearly interpolated
// UV coordinates and scaling factors. Gaussian kernels are always have an odd number of
// weights, so in this implementation, the first weight value is treated as the lone non-pair
// and then all remaining values are treated as pairs.
const convertKernelToOffsetsAndScales = (kernel) => {
	if ((kernel.length & 1) === 0) throw new Error("Only odd kernel sizes can be lerped");

	const radius = Math.ceil(kernel.length / 2);
	const data = [];

	// Prepopulate the array with the first cell as the lone weight value
	let offset = -radius + 1;
	let scale = kernel[0];
	data.push(offset, scale);

	const total = kernel.reduce((c, v) => c + v);

	for (let i = 1; i < kernel.length; i += 2) {
		const a = kernel[i];
		const b = kernel[i + 1];

		offset = -radius + 1 + i + b / (a + b);
		scale = (a + b) / total;
		data.push(offset, scale);
	}

	return data;
};

/**
 *
 * @param {boolean} mapCurrent makes the previous program the current one
 * which allows to reuse one program in two consecutive and different draw passes
 * This case is necessary to draw twice with different settings (unitforms)
 */
function createBlurProgram(mapCurrent = false) {
	return function createBlurProgram(programStore) {
		return function createBlurProgram() {
			const { gl, programMap, vaoMap } = appContext;
			if (!programMap.has(programStore) && !mapCurrent) {
				const program = gl.createProgram();
				programMap.set(programStore, program);
				vaoMap.set(programStore, new Map());
				appContext.program = program;
			} else if (mapCurrent) {
				programMap.set(programStore, appContext.program);
				vaoMap.set(programStore, new Map());
			} else {
				//todo check if necessary, this check is done in engine already, if it exists, createProgram is not called
				appContext.program = appContext.programMap.get(programStore);
			}
		};
	};
}

function createBlurShaders() {
	const { gl, program } = appContext;

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

// Create a simple quad mesh for the blur shader
function createBlurMesh() {
	return {
		attributes: {
			positionsSize: 2,
			positions: new Float32Array([
				// Pos (xy)
				-1, 1, -1, -1, 1, 1, 1, -1,
			]),
			uvs: new Float32Array([
				// UV coordinate
				0, 1, 0, 0, 1, 1, 1, 0,
			]),
		},
		drawMode: drawModes[5],
	};
}

// Set the blur stride uniform, which define the direction of the blur
function setDirectionUniform(direction) {
	const { gl, program } = appContext;

	const unidirectionalUVStride =
		direction === BLUR_DIRECTION_HORIZONTAL
			? [1 / appContext.frameBufferWidth, 0]
			: [0, 1 / appContext.frameBufferHeight];
	const uvStrideUniformLocation = gl.getUniformLocation(program, "uvStride");
	gl.uniform2fv(uvStrideUniformLocation, unidirectionalUVStride);
}

// Generate a kernel
function getKernel(size) {
	const kernel1D = generate1DKernel(size);
	const kernel = convertKernelToOffsetsAndScales(kernel1D);
	return kernel;
}

// Set the kernel uniforms
function setKernelUniforms(kernel) {
	const { gl, program } = appContext;

	const offsetScaleLocation = gl.getUniformLocation(program, "offsetAndScale");
	gl.uniform2fv(offsetScaleLocation, kernel);

	const kernelWidthLocation = gl.getUniformLocation(program, "kernelWidth");
	gl.uniform1i(kernelWidthLocation, kernel.length / 2);
}

/**
 * @typedef {ContactShadowPass} ContactShadowPass
 * @property {Array} programs array of programs used in the pass
 * @property {number} order order of the pass in the rendering pipeline
 * @property {function} getTexture function to get the shadow texture
 */

/**
 *
 * @param {mat4} groundMatrix plane ground matrix used as orthographic camera for the shadow rendering
 * @param {number} depth how far objects in height are see from the shadow camera
 * @param {number} width width of the plane that will receive the shadow
 * @param {number} height height of the plane that will receive the shadow
 * @param {number} textureSize size of the texture used to render the shadow
 * @param {number} blurSize size of the blur
 * @param {number} darkness darkness of the shadow
 * @returns {ContactShadowPass} object containing the shadow pass
 *
 */
function createContactShadowPass(
	groundMatrix,
	depth,
	width,
	height,
	textureSize = 1024,
	blurSize = 128,
	darkness = 1,
) {
	const groundTranslation = getTranslation([], groundMatrix);
	const aspect = width / height;
	const textureWidth = textureSize * aspect;
	const textureHeight = textureSize / aspect;
	//log("creating contact shadow pass", width, height, depth, groundMatrix, blurSize);

	const projection = orthoNO(new Float32Array(16), -width / 2, width / 2, -height / 2, height / 2, 0, depth);

	const view = lookAt(
		new Float32Array(16),
		groundTranslation,
		[groundTranslation[0], groundTranslation[1] + 1, groundTranslation[2]],
		[0, 0, 1],
	);

	let horizontalBlurFBO;
	function setHorizontalBlurFBO(fbo) {
		horizontalBlurFBO = fbo;
	}
	function getHorizontalBlurFBO() {
		return horizontalBlurFBO;
	}

	let horizontalBlurTexture;
	function setHorizontalBlurTexture(texture) {
		horizontalBlurTexture = texture;
	}
	function getHorizontalBlurTexture() {
		return horizontalBlurTexture;
	}

	let verticalBlurFBO;
	function setVerticalBlurFBO(fbo) {
		verticalBlurFBO = fbo;
	}
	function getVerticalBlurFBO() {
		return verticalBlurFBO;
	}

	let verticalBlurTexture;
	function setVerticalBlurTexture(texture) {
		verticalBlurTexture = texture;
	}
	function getVerticalBlurTexture() {
		return verticalBlurTexture;
	}

	let geometryFBO;
	function setGeometryFBO(fbo) {
		geometryFBO = fbo;
	}
	function getGeometryFBO() {
		return geometryFBO;
	}

	let geometryTexture;
	function setGeometryTexture(texture) {
		geometryTexture = texture;
	}
	function getGeometryTexture() {
		return geometryTexture;
	}

	const blurMesh = createBlurMesh();

	return {
		programs: [
			{
				createProgram: createShadowProgram(),
				setupProgram: [
					createShaders,
					linkProgram,
					validateProgram,
					createFBO(textureWidth, textureHeight, setGeometryFBO, setGeometryTexture),
				],
				setupMaterial: [setupDarknessUniform(darkness)],
				useProgram,
				selectProgram,
				bindTextures: [],
				setupCamera: setupShadowCamera(projection, view),
				setFrameBuffer: setFrameBuffer(getGeometryFBO, textureWidth, textureHeight),
				allMeshes: true,
			},
			{
				createProgram: createBlurProgram(),
				setupProgram: [
					createBlurShaders,
					linkProgram,
					validateProgram,
					createFBO(textureWidth, textureHeight, setHorizontalBlurFBO, setHorizontalBlurTexture),
				],
				setupMaterial: [
					setupBlurKernel(blurSize),
					() => setDirectionUniform(BLUR_DIRECTION_HORIZONTAL),
					() => setSourceTexture(getGeometryTexture),
				],
				useProgram,
				selectProgram: selectBlurProgram(BLUR_DIRECTION_HORIZONTAL, getGeometryTexture),
				bindTextures: [],
				setupCamera: () => {},
				setFrameBuffer: setFrameBuffer(getHorizontalBlurFBO, textureWidth, textureHeight),
				meshes: [blurMesh],
				postDraw: unbindTexture,
			},
			{
				createProgram: createBlurProgram(true),
				setupProgram: [createFBO(textureWidth, textureHeight, setVerticalBlurFBO, setVerticalBlurTexture)],
				setupMaterial: [
					() => setDirectionUniform(BLUR_DIRECTION_VERTICAL),
					() => setSourceTexture(getHorizontalBlurTexture),
				],
				useProgram,
				selectProgram: selectBlurProgram(BLUR_DIRECTION_VERTICAL, getHorizontalBlurTexture),
				bindTextures: [],
				setupCamera: () => {},
				setFrameBuffer: setFrameBuffer(getVerticalBlurFBO, textureWidth, textureHeight),
				meshes: [blurMesh],
				postDraw: unbindTexture,
			},
		],
		getTexture: getVerticalBlurTexture,
		order: -1,
	};
}

function setupDarknessUniform(darkness) {
	return function setupDarknessUniform() {
		const { gl, program } = appContext;
		const darknessLocation = gl.getUniformLocation(program, "darkness");
		gl.uniform1f(darknessLocation, darkness);
	};
}

function setupBlurKernel(size) {
	return function setupBlurKernel() {
		//rollup will remove the "size" argument form getKernel call
		const rollupWorkAround = {
			size,
		};
		const kernel = getKernel(rollupWorkAround.size - 1);
		setKernelUniforms(kernel);
		//workaround to prevent rollup from removing the getKernel argument
		return rollupWorkAround;
	};
}

function unbindTexture() {
	const { gl } = appContext;
	gl.bindTexture(gl.TEXTURE_2D, null);
}

function selectBlurProgram(blurDirection, getTexture) {
	return function selectBlurProgram(programStore) {
		return function selectBlurProgram() {
			selectProgram(programStore)();
			useProgram();
			setSourceTexture(getTexture);
			setDirectionUniform(blurDirection);
		};
	};
}

function setSourceTexture(getTexture) {
	const { gl } = appContext;
	const texture = getTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);
}

function setFrameBuffer(getFBO = null, width, height) {
	return function setFrameBuffer() {
		const { gl } = appContext;
		const fbo = getFBO ? getFBO() : null;
		gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
		if (appContext.fbo !== fbo && fbo != null) {
			//log("framebuffer change clearing from", appContext.fbo, "to", fbo, [0, 0, 0, 1], width, height);
			gl.viewport(0, 0, width, height);
			appContext.frameBufferWidth = width;
			appContext.frameBufferHeight = height;
			gl.clearColor(...[0, 0, 0, 0]);
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		}
		appContext.fbo = fbo;
	};
}

function setupShadowCamera(projection, view) {
	return function setupShadowCamera() {
		const { gl, program } = appContext;

		const projectionLocation = gl.getUniformLocation(program, "projection");

		gl.uniformMatrix4fv(projectionLocation, false, projection);

		const viewLocation = gl.getUniformLocation(program, "view");
		gl.uniformMatrix4fv(viewLocation, false, view);
	};
}

function createShaders() {
	const { gl, program } = appContext;

	const vertexShader = gl.createShader(gl.VERTEX_SHADER);
	gl.shaderSource(vertexShader, depthVertexShader);
	gl.compileShader(vertexShader);
	if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
		console.error(gl.getShaderInfoLog(vertexShader));
	}
	gl.attachShader(program, vertexShader);

	const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
	gl.shaderSource(fragmentShader, depthFragmentShader);
	gl.compileShader(fragmentShader);
	if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
		console.error(gl.getShaderInfoLog(fragmentShader));
	}
	gl.attachShader(program, fragmentShader);
}

function createShadowProgram(textureWidth, textureHeight) {
	return function createShadowProgram(programStore) {
		return function createShadowProgram() {
			const { gl, programMap, vaoMap } = appContext;

			// Create shader program
			const program = gl.createProgram();
			programMap.set(programStore, program);
			vaoMap.set(programStore, new Map());

			appContext.program = program;
		};
	};
}

/*function createFBO(setTexture) {
	return function createFBO(width, height) {
		const { gl } = appContext;

		// Create FBO
		let fbo = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

		// Create texture
		const texture = gl.createTexture();
		setTexture(texture);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

		// Attach texture to FBO
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

		// Create renderbuffer
		const renderbuffer = gl.createRenderbuffer();
		gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
		gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);

		// Attach renderbuffer to FBO
		gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderbuffer);

		// Check FBO status
		const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
		if (status !== gl.FRAMEBUFFER_COMPLETE) {
			console.error("Framebuffer is incomplete:", status);
		}

		// Cleanup
		gl.bindTexture(gl.TEXTURE_2D, null);
		gl.bindRenderbuffer(gl.RENDERBUFFER, null);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		return {
			fbo,
			texture,
		};
	};
}*/

function createFBO(width, height, setFBO, setTexture) {
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
 * @returns
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

function createMeshFromGLTF(gltfScene, gltfObject) {
	const mesh = gltfObject;
	const gltfMaterial = gltfScene.materials[mesh.material];
	const material = {};
	if (gltfMaterial.pbrMetallicRoughness) {
		const { baseColorFactor, metallicFactor, roughnessFactor } = gltfMaterial.pbrMetallicRoughness;
		material.diffuse = baseColorFactor.slice(0, 3);
		material.metalness = 0;
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
		matrix: mesh.matrix,
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

function createCameraFromGLTF(gltfObject) {
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
function getAbsoluteNodeMatrix(node) {
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

function traverseScene(scene, callback) {
	scene.forEach((node) => {
		callback(node);
		if (node.children != null) {
			traverseScene(node.children, callback);
		}
	});
}

export { createMeshFromGLTF as a, createContactShadowPass as b, createCameraFromGLTF as c, createCube as d, createPlane as e, getAbsoluteNodeMatrix as g, loadGLTFFile as l, traverseScene as t };
