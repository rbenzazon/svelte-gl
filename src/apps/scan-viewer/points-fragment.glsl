#version 300 es
precision mediump float;

#define SHADER_NAME scanPointsFragment

// unlit, written to the canvas as is
in vec3 vColor;

out vec4 fragColor;

void main() {
    // Round point with a one pixel soft edge; the alpha becomes MSAA coverage (alpha-to-coverage).
    float r = length(gl_PointCoord * 2.0 - 1.0);
    float edge = fwidth(r);
    fragColor = vec4(vColor, 1.0 - smoothstep(1.0 - edge, 1.0 + edge, r));
}
