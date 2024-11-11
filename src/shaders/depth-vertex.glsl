#version 300 es

precision highp float;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

in vec3 position;

out vec2 vHighPrecisionZW;

void main() {
	vec3 transformed = vec3( position );
	vec4 mvPosition = vec4( transformed, 1.0 );
	mvPosition = modelViewMatrix * mvPosition;
	gl_Position = projectionMatrix * mvPosition;
	vHighPrecisionZW = gl_Position.zw;
}