#version 300 es
precision mediump float;

#define SHADER_NAME scanLinesFragment

// unlit, written to the canvas as is
uniform vec3 lineColor;

out vec4 fragColor;

void main() {
    fragColor = vec4(lineColor, 1.0);
}
