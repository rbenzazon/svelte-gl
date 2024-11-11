#version 300 es

out highp vec4 fragColor;

precision highp float;
precision highp int;

uniform float darkness;
in vec2 vHighPrecisionZW;

void main() {
	float fragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;
	fragColor = vec4( vec3( 0.0 ), ( 1.0 - fragCoordZ ) * darkness );
}
					