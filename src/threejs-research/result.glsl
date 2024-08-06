precision highp float;
precision highp int;
precision highp sampler2D;
precision highp samplerCube;
precision highp sampler3D;
precision highp sampler2DArray;
precision highp sampler2DShadow;
precision highp samplerCubeShadow;
precision highp sampler2DArrayShadow;
precision highp isampler2D;
precision highp isampler3D;
precision highp isamplerCube;
precision highp isampler2DArray;
precision highp usampler2D;
precision highp usampler3D;
precision highp usamplerCube;
precision highp usampler2DArray;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
in vec3 position;
in vec3 normal;

out vec3 vViewPosition;



out vec3 vNormal;
void main() {
	vec3 objectNormal = vec3(normal);
	vec3 transformedNormal = objectNormal;
	transformedNormal = normalMatrix * transformedNormal;
	vNormal = normalize(transformedNormal);
	vec3 transformed = vec3(position);
	vec4 mvPosition = vec4(transformed, 1.0);
	mvPosition = modelViewMatrix * mvPosition;
	gl_Position = projectionMatrix * mvPosition;
	vViewPosition = -mvPosition.xyz;
}
