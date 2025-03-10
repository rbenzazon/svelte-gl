import { L as drawModes, av as createProgram, X as linkProgram, Y as validateProgram, Z as useProgram, _ as selectProgram, a7 as templateLiteralRenderer, az as defaultVertex, R as appContext } from './Menu-Cr0GMpwH.js';

//this geometry will take an existing object and normals as lines


/**
 *
 * @param {SvelteGLMeshReadyData} object
 * @returns {SvelteGLMeshReadyData}
 */
function createDebugObject(object) {
	const { normals, positions } = object.attributes;
	const positionsData = typeof positions !== "Float32Array" && "data" in positions ? positions.data : positions;
	const normalsData = typeof normals !== "Float32Array" && "data" in normals ? normals.data : normals;
	//for each vertex, create a line with the normal
	const lines = [];
	const lineLength = 0.2;
	for (let i = 0; i < positionsData.length; i += 3) {
		lines.push(positionsData[i], positionsData[i + 1], positionsData[i + 2]);
		lines.push(
			positionsData[i] + normalsData[i] * lineLength,
			positionsData[i + 1] + normalsData[i + 1] * lineLength,
			positionsData[i + 2] + normalsData[i + 2] * lineLength,
		);
	}
	return {
		attributes: {
			positions: new Float32Array(lines),
		},
		matrix: object.matrix,
		material: object.material,
		drawMode: drawModes[1],
	};
}

var basicFragment = "#version 300 es\r\nprecision mediump float;\r\n\r\n// Input from vertex shader\r\nin vec3 vertexColor;\r\nin vec3 vNormal;\r\nin vec3 vertex;\r\nin vec3 vViewPosition;\r\nin highp vec2 vUv;\r\n\r\n// Output color\r\nout vec4 fragColor;\r\n\r\nvoid main() {\r\n    // Simply use the vertex color for the fragment color\r\n    // This will create a simple colored line with no lighting effects\r\n    fragColor = vec4(vertexColor, 1.0);\r\n    \r\n    // Alternative: if you want slightly smoother lines with anti-aliasing\r\n    // float intensity = 1.0;\r\n    // fragColor = vec4(vertexColor * intensity, 1.0);\r\n}";

/**
 *
 * @return {import("./programs").SvelteGLProgram}
 */
function createDebugNormalsProgram() {
	const debugProgram = {
		createProgram,
		setupProgram: [createShaders, linkProgram, validateProgram],
		setupMaterial: [],
		useProgram,
		selectProgram,
		updateProgram: [],
	};
	return debugProgram;
}

function createShaders() {
	const { gl, program } = appContext;

	const vertexShaderSource = templateLiteralRenderer(defaultVertex, {
		instances: false,
		declarations: "",
		positionModifier: "",
	})({
		instances: false,
		declarations: "",
		positionModifier: "",
	});
	const vertexShader = gl.createShader(gl.VERTEX_SHADER);
	gl.shaderSource(vertexShader, vertexShaderSource);
	gl.compileShader(vertexShader);
	if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
		console.error(gl.getShaderInfoLog(vertexShader));
	}
	gl.attachShader(program, vertexShader);

	const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
	gl.shaderSource(fragmentShader, basicFragment);
	gl.compileShader(fragmentShader);
	if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
		console.error(gl.getShaderInfoLog(fragmentShader));
	}
	gl.attachShader(program, fragmentShader);
}

export { createDebugNormalsProgram as a, createDebugObject as c };
