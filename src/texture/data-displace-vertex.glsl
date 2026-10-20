#version 300 es
precision highp float;

in vec3 position;
in vec2 uv;

uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
uniform sampler2D dataTexture;
uniform float amplitude;

out float vHeight;

void main() {
	float height = texture(dataTexture, uv).r;
	vHeight = height;
	vec3 displaced = position + vec3(0.0, height * amplitude, 0.0);
	gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
