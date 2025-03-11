import { createVec3, createZeroMatrix } from "../geometries/common";
import { mat4 } from "gl-matrix";
import { createACESFilmicToneMapping } from "../tone-mapping/aces-filmic-tone-mapping";

/**
 * Converts the HDR image to a cube map texture
 * @param {Uint16Array} halfFloatRGBA16 - Uint16Array containing RGBA16F data
 * @param {WebGL2RenderingContext} gl - WebGL2 rendering context
 * @param {number} width - Width of the equirectangular HDR image
 * @param {number} height - Height of the equirectangular HDR image
 * @param {number} cubeSize - Size of each face of the output cubemap
 * @returns {WebGLTexture} The created cubemap texture
 */
export function hdrToCube(halfFloatRGBA16, gl, width, height, cubeSize = 1024) {
	console.log("hdrToCube");

	const ext = gl.getExtension("EXT_color_buffer_float");
	if (!ext) {
		throw new Error("EXT_color_buffer_float extension not supported");
	}
	// 2. Create a temporary framebuffer and textures for conversion
	const equirectTexture = createEquirectTexture(gl, halfFloatRGBA16, width, height);
	const cubemapTexture = createCubemapTexture(gl, cubeSize);

	// 3. Set up conversion shader
	const { program, vertexArray } = createEquirectToCubeProgram(gl);

	// 4. Render each face of the cubemap
	const framebuffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

	// Set up common state
	gl.useProgram(program);
	gl.bindVertexArray(vertexArray);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, equirectTexture);
	gl.uniform1i(gl.getUniformLocation(program, "equirectangularMap"), 0);

	// Projection matrix for each face view
	const projectionMatrix = createZeroMatrix();
	// Create a perspective projection with a 90-degree FOV
	const fov = Math.PI / 2; // 90 degrees in radians
	const aspect = 1; // cube faces are square
	const near = 0.1;
	const far = 10.0;
	const f = 1.0 / Math.tan(fov / 2); // cotangent of the FOV

	projectionMatrix[0] = f / aspect;
	projectionMatrix[5] = f;
	projectionMatrix[10] = (far + near) / (near - far);
	projectionMatrix[11] = -1;
	projectionMatrix[14] = (2 * far * near) / (near - far);
	const projectionLocation = gl.getUniformLocation(program, "projection");
	console.log("projectionLocation", projectionLocation);
	gl.uniformMatrix4fv(projectionLocation, false, projectionMatrix);

	// ... inside your function
	const views = [];
	/**@type {import("gl-matrix").ReadonlyVec3} */
	const eye = createVec3();

	// For each face
	for (let i = 0; i < 6; i++) {
		const viewMatrix = mat4.create();
		let lookDir, upDir;

		switch (i) {
			case 0: // POSITIVE_X
				lookDir = [1, 0, 0];
				upDir = [0, -1, 0];
				break;
			case 1: // NEGATIVE_X
				lookDir = [-1, 0, 0];
				upDir = [0, -1, 0];
				break;
			case 2: // POSITIVE_Y
				lookDir = [0, 1, 0];
				upDir = [0, 0, 1];
				break;
			case 3: // NEGATIVE_Y
				lookDir = [0, -1, 0];
				upDir = [0, 0, -1];
				break;
			case 4: // POSITIVE_Z
				lookDir = [0, 0, 1];
				upDir = [0, -1, 0];
				break;
			case 5: // NEGATIVE_Z
				lookDir = [0, 0, -1];
				upDir = [0, -1, 0];
				break;
		}

		const target = [eye[0] + lookDir[0], eye[1] + lookDir[1], eye[2] + lookDir[2]];
		mat4.lookAt(viewMatrix, eye, target, upDir);
		views.push(viewMatrix);
	}

	// Render each face
	for (let i = 0; i < 6; i++) {
		// Attach the corresponding cubemap face to the framebuffer
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, cubemapTexture, 0);

		// Check framebuffer status
		const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
		if (status !== gl.FRAMEBUFFER_COMPLETE) {
			console.error("Framebuffer not complete:", status);
			continue;
		}
		const viewLocation = gl.getUniformLocation(program, "view");
		console.log("viewLocation", viewLocation);

		// Set the view matrix for this face
		gl.uniformMatrix4fv(gl.getUniformLocation(program, "view"), false, views[i]);

		// Clear and render
		gl.viewport(0, 0, cubeSize, cubeSize);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		// Draw a full-screen quad with two triangles (6 vertices)
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	}

	// Clean up
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.deleteFramebuffer(framebuffer);
	gl.deleteTexture(equirectTexture);

	// Generate mipmaps for the cubemap
	gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubemapTexture);
	gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
	console.log("hdrToCube end");
	return cubemapTexture;
}
/**
 *
 * @param {number} exposure
 * @returns {SvelteGLToneMapping}
 */
export function getToneMapping(exposure) {
	return createACESFilmicToneMapping({ exposure });
}

/**
 * Create a texture for the equirectangular HDR data
 * @param {WebGL2RenderingContext} gl - WebGL2 rendering context
 * @param {Uint16Array} data - RGBA16F data
 * @param {number} width - Width of the texture
 * @param {number} height - Height of the texture
 * @returns {WebGLTexture} The created texture
 */
function createEquirectTexture(gl, data, width, height) {
	const texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);

	// Upload the data
	gl.texImage2D(
		gl.TEXTURE_2D,
		0,
		gl.RGBA16F, // Internal format for HDR
		width,
		height,
		0,
		gl.RGBA,
		gl.HALF_FLOAT,
		data,
	);

	// Set texture parameters
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

	return texture;
}

/**
 * Create an empty cubemap texture
 * @param {WebGL2RenderingContext} gl - WebGL2 rendering context
 * @param {number} size - Size of each face
 * @returns {WebGLTexture} The created cubemap texture
 */
function createCubemapTexture(gl, size) {
	const texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

	// Create empty texture for each face
	for (let i = 0; i < 6; i++) {
		gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, gl.RGBA16F, size, size, 0, gl.RGBA, gl.HALF_FLOAT, null);
	}

	// Set texture parameters
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

	return texture;
}

/**
 * Create the shader program and VAO for equirect to cubemap conversion
 * @param {WebGL2RenderingContext} gl - WebGL2 rendering context
 * @returns {{program:WebGLProgram,vertexArray:WebGLVertexArrayObject}} Object containing the program and VAO
 */
function createEquirectToCubeProgram(gl) {
	// Vertex shader: render a fullscreen quad properly mapped to cube face
	const vertexShaderSource = /*glsl*/ `#version 300 es

    #define SHADER_NAME hdrToCubeVertex

    layout(location = 0) in vec2 position;
    out vec3 localPos;
    uniform mat4 projection;
    uniform mat4 view;

    void main() {
        // Use the quad positions directly for rendering
        gl_Position = vec4(position, 0.0, 1.0);
        
        // Create the ray direction for this fragment
        // Map from [-1,1] to [-1,1] in view space for proper cubemap sampling
        vec4 viewPos = inverse(projection * view) * vec4(position, 1.0, 1.0);
        localPos = viewPos.xyz / viewPos.w;
    }`;

	// Fragment shader with improved spherical mapping
	const fragmentShaderSource = /*glsl*/ `#version 300 es

    #define SHADER_NAME hdrToCubeFragment

    precision highp float;
    in vec3 localPos;
    out vec4 fragColor;
    uniform sampler2D equirectangularMap;

    vec2 SampleSphericalMap(vec3 v) {
        // Convert direction vector to spherical coordinates
        float phi = atan(v.z, v.x);
        float theta = asin(v.y);
        
        // Map from [-π to π] for phi and [-π/2 to π/2] for theta to [0,1] range
        vec2 uv = vec2(
            0.5 + 0.5 * phi / 3.1415926535897932,
            0.5 - theta / 3.1415926535897932
        );
        
        return uv;
    }

    void main() {
        vec3 direction = normalize(localPos);
        vec2 uv = SampleSphericalMap(direction);
        fragColor = texture(equirectangularMap, uv);
    }`;

	// Create and compile shaders
	const vertexShader = gl.createShader(gl.VERTEX_SHADER);
	gl.shaderSource(vertexShader, vertexShaderSource);
	gl.compileShader(vertexShader);

	const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
	gl.shaderSource(fragmentShader, fragmentShaderSource);
	gl.compileShader(fragmentShader);

	// Create and link program
	const program = gl.createProgram();
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);

	// Check for shader compilation and program link errors
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		console.error("Shader program error:", gl.getProgramInfoLog(program));
		console.error("Vertex shader log:", gl.getShaderInfoLog(vertexShader));
		console.error("Fragment shader log:", gl.getShaderInfoLog(fragmentShader));
		throw new Error("Failed to compile shaders");
	}

	// Use a simple full-screen quad
	const vertexArray = gl.createVertexArray();
	gl.bindVertexArray(vertexArray);

	// Define a full-screen quad (two triangles)
	const vertices = new Float32Array([
		-1.0,
		-1.0, // bottom-left
		1.0,
		-1.0, // bottom-right
		-1.0,
		1.0, // top-left
		1.0,
		1.0, // top-right
	]);

	// Create and bind buffers
	const vertexBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

	// Set up vertex attribute
	gl.enableVertexAttribArray(0);
	gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

	return { program, vertexArray };
}
