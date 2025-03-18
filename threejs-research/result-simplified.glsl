precision highp float;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
in vec3 position;
in vec3 normal;

out vec3 vViewPosition;
out vec3 vNormal;

void main() {
	vNormal = normalize(normal);
	gl_Position = modelViewMatrix * projectionMatrix * vec4(position, 1.0);
	vViewPosition = -mvPosition.xyz;
}
