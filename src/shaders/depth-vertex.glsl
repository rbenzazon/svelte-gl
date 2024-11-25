#version 300 es

precision highp float;

uniform mat4 view;
uniform mat4 projection;
uniform mat4 world;

in vec3 position;

out vec2 vHighPrecisionZW;

void main() {
	gl_Position = projection * view * world * vec4( position, 1.0 );
	vHighPrecisionZW = gl_Position.zw;
}