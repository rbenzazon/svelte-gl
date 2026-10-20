#version 300 es
precision highp float;

in float vHeight;
out vec4 fragColor;

void main() {
	vec3 low = vec3(0.15, 0.25, 0.45);
	vec3 high = vec3(0.95, 0.75, 0.35);
	float t = clamp(vHeight * 0.5 + 0.5, 0.0, 1.0);
	fragColor = vec4(mix(low, high, t), 1.0);
}
