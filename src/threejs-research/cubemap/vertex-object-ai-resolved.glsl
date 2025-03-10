#version 300 es

// Alias WebGL1 attributes and varyings to WebGL2 equivalents
in vec3 position;
in vec3 normal;
in vec2 uv;
in vec3 color;
out vec2 vUv;
out vec3 vColor;
out vec3 vNormal;
out vec3 vViewPosition;

// Uniforms
uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat3 normalMatrix;
uniform vec3 cameraPosition;
uniform bool isOrthographic;

// Map transform uniforms
uniform mat3 mapTransform;
uniform mat3 aoMapTransform;
uniform mat3 normalMapTransform;
uniform mat3 emissiveMapTransform;
uniform mat3 metalnessMapTransform;
uniform mat3 roughnessMapTransform;

// UV varyings for all enabled maps
varying vec2 vMapUv;
varying vec2 vAoMapUv;
varying vec2 vNormalMapUv;
varying vec2 vEmissiveMapUv;
varying vec2 vMetalnessMapUv;
varying vec2 vRoughnessMapUv;

// Math constants
#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6

// Math helper functions
float saturate(const in float a) { return clamp(a, 0.0, 1.0); }
float pow2(const in float x) { return x * x; }
vec3 pow2(const in vec3 x) { return x * x; }
float pow3(const in float x) { return x * x * x; }
float pow4(const in float x) { float x2 = x * x; return x2 * x2; }
float max3(const in vec3 v) { return max(max(v.x, v.y), v.z); }
float average(const in vec3 v) { return dot(v, vec3(0.3333333)); }
highp float rand(const in vec2 uv) {
    const highp float a = 12.9898, b = 78.233, c = 43758.5453;
    highp float dt = dot(uv.xy, vec2(a, b)), sn = mod(dt, PI);
    return fract(sin(sn) * c);
}

float precisionSafeLength(vec3 v) {
    return length(v);
}

// Light and reflection structs
struct IncidentLight {
    vec3 color;
    vec3 direction;
    bool visible;
};

struct ReflectedLight {
    vec3 directDiffuse;
    vec3 directSpecular;
    vec3 indirectDiffuse;
    vec3 indirectSpecular;
};

// Direction transformation functions
vec3 transformDirection(in vec3 dir, in mat4 matrix) {
    return normalize((matrix * vec4(dir, 0.0)).xyz);
}

vec3 inverseTransformDirection(in vec3 dir, in mat4 matrix) {
    return normalize((vec4(dir, 0.0) * matrix).xyz);
}

mat3 transposeMat3(const in mat3 m) {
    mat3 tmp;
    tmp[0] = vec3(m[0].x, m[1].x, m[2].x);
    tmp[1] = vec3(m[0].y, m[1].y, m[2].y);
    tmp[2] = vec3(m[0].z, m[1].z, m[2].z);
    return tmp;
}

float luminance(const in vec3 rgb) {
    const vec3 weights = vec3(0.2126729, 0.7151522, 0.0721750);
    return dot(weights, rgb);
}

bool isPerspectiveMatrix(mat4 m) {
    return m[2][3] == -1.0;
}

vec2 equirectUv(in vec3 dir) {
    float u = atan(dir.z, dir.x) * RECIPROCAL_PI2 + 0.5;
    float v = asin(clamp(dir.y, -1.0, 1.0)) * RECIPROCAL_PI + 0.5;
    return vec2(u, v);
}

// BRDF functions
vec3 BRDF_Lambert(const in vec3 diffuseColor) {
    return RECIPROCAL_PI * diffuseColor;
}

vec3 F_Schlick(const in vec3 f0, const in float f90, const in float dotVH) {
    float fresnel = exp2((-5.55473 * dotVH - 6.98316) * dotVH);
    return f0 * (1.0 - fresnel) + (f90 * fresnel);
}

float F_Schlick(const in float f0, const in float f90, const in float dotVH) {
    float fresnel = exp2((-5.55473 * dotVH - 6.98316) * dotVH);
    return f0 * (1.0 - fresnel) + (f90 * fresnel);
}

void main() {
    // Set UV coordinates for all maps
    vUv = vec3(uv, 1).xy;
    
    // Set up texture coordinates for each map type
    vMapUv = (mapTransform * vec3(uv, 1)).xy;
    vAoMapUv = (aoMapTransform * vec3(uv, 1)).xy;
    vNormalMapUv = (normalMapTransform * vec3(uv, 1)).xy;
    vEmissiveMapUv = (emissiveMapTransform * vec3(uv, 1)).xy;
    vMetalnessMapUv = (metalnessMapTransform * vec3(uv, 1)).xy;
    vRoughnessMapUv = (roughnessMapTransform * vec3(uv, 1)).xy;
    
    // Set up color
    vColor = vec3(1.0);
    vColor *= color;
    
    // Normal transformation
    vec3 objectNormal = vec3(normal);
    vec3 transformedNormal = objectNormal;
    transformedNormal = normalMatrix * transformedNormal;
    vNormal = normalize(transformedNormal);
    
    // Position transformation
    vec3 transformed = vec3(position);
    vec4 mvPosition = vec4(transformed, 1.0);
    mvPosition = modelViewMatrix * mvPosition;
    gl_Position = projectionMatrix * mvPosition;
    
    // Set up view position for lighting calculations
    vViewPosition = -mvPosition.xyz;
    
    // For environment mapping and shadows
    vec4 worldPosition = vec4(transformed, 1.0);
    worldPosition = modelMatrix * worldPosition;
}