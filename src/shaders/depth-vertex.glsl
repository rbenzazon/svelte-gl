#version 300 es

precision highp float;

uniform mat4 view;
uniform mat4 projectionMatrix;
uniform mat4 modelMatrix;

in vec3 position;

out vec2 vHighPrecisionZW;

void main() {
	gl_Position = projectionMatrix * view * modelMatrix * vec4( position, 1.0 );
	vHighPrecisionZW = gl_Position.zw;
}