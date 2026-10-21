#version 300 es
precision mediump float;

#define SHADER_NAME scanPointsFragment

// unlit, written to the canvas as is
in vec3 vColor;

out vec4 fragColor;

void main() {
    vec2 offset = gl_PointCoord * 2.0 - 1.0;
    if (dot(offset, offset) > 1.0) {
        discard;
    }
    fragColor = vec4(vColor, 1.0);
}
