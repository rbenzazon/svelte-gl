//https://stackoverflow.com/questions/72840432/animate-vertex-positions-with-webgl2-transform-feedback-using-two-programs
// Setup FBO and texture
/**
 * Calculates whether a given point intersects with the rendered scene.
 *
 * @param {WebGLRenderingContext} gl - The WebGL rendering context.
 * @param {number} x - The x-coordinate of the point to check.
 * @param {number} y - The y-coordinate of the point to check.
 * @param {number} width - The width of the viewport.
 * @param {number} height - The height of the viewport.
 * @param {function} renderScene - A function that renders the scene or object.
 * @returns {boolean} - True if the point intersects with the rendered scene, false otherwise.
 */
function getIntersection(gl, x, y, width, height, renderScene) {
	let res = false;

	let texture;
	let x;
	let y;
	let width = 100;
	let height = 100;

	let fbo = initializeFBO();
	if (fbo === null) {
		return false;
	}

	// Bind FBO for off-screen rendering
	gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

	// Render your scene or object
	renderScene();

	isPixelRendered();

	// Cleanup: Unbind FBO, etc.
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

	displayBuffer();

	function isPixelRendered() {
		// Read pixel data
		const pixels = new Uint8Array(4); // Assuming RGBA
		gl.readPixels(x, y, 1, 1, gl.ALPHA, gl.UNSIGNED_BYTE, pixels);

		if (pixels[0] > 0) {
			// Check alpha value to see if pixel was drawn
			res = true;
		}
	}

	function initializeFBO() {
		// Create FBO
		let fbo = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

		// Create texture
		const texture = gl.createTexture();
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
		return fbo;
	}

	function createDisplayProgram() {
		const vertexShaderSource = `#version 300 es
        in vec2 a_position;
        out vec2 v_uv;
        void main() {
            gl_Position = vec4(a_position, 0.0, 1.0);
            v_uv = a_position * 0.5 + 0.5;
        }`;
		const fragmentShaderSource = `#version 300 es
        precision highp float;
        in vec2 v_uv;
        uniform sampler2D u_texture;
        out vec4 fragColor;
        void main() {
            fragColor = texture(u_texture, v_uv);
        }`;

		// Create shader program
		program = gl.createProgram();
		gl.attachShader(program, createShader(gl.VERTEX_SHADER, vertexShaderSource));
		gl.attachShader(program, createShader(gl.FRAGMENT_SHADER, fragmentShaderSource));
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			console.error("ERROR linking program!", gl.getProgramInfoLog(program));
		}

		// Get attribute and uniform locations
		positionLocation = gl.getAttribLocation(program, "a_position");
		textureLocation = gl.getUniformLocation(program, "u_texture");
		const quadBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
	}

	function displayBuffer() {
		createDisplayProgram();
		// Bind default framebuffer
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);

		// Clear screen
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		// Use shader program
		gl.useProgram(program);

		// Bind texture
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.uniform1i(textureLocation, 0);

		// Draw a quad
		gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
		gl.enableVertexAttribArray(positionLocation);
		gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
		gl.drawArrays(gl.TRIANGLES, 0, 6);
		gl.disableVertexAttribArray(positionLocation);
	}
}
