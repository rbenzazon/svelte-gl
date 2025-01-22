import { J as appContext, D as drawModes, K as getTranslation, L as orthoNO, N as lookAt, O as linkProgram, P as validateProgram, Q as useProgram, R as selectProgram } from './Menu-QHUA3apL.js';

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

export { createContactShadowPass as c };
