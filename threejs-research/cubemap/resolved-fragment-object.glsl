#version 300 es
#define varying in
layout(location = 0) out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
#define gl_FragDepthEXT gl_FragDepth
#define texture2D texture
#define textureCube texture
#define texture2DProj textureProj
#define texture2DLodEXT textureLod
#define texture2DProjLodEXT textureProjLod
#define textureCubeLodEXT textureLod
#define texture2DGradEXT textureGrad
#define texture2DProjGradEXT textureProjGrad
#define textureCubeGradEXT textureGrad
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

#define HIGH_PRECISION
#define SHADER_TYPE MeshStandardMaterial
#define SHADER_NAME Material_MR
#define STANDARD 
#define USE_MAP
#define USE_ENVMAP
#define ENVMAP_TYPE_CUBE_UV
#define ENVMAP_MODE_REFLECTION
#define ENVMAP_BLENDING_NONE
#define CUBEUV_TEXEL_WIDTH 0.0013020833333333333
#define CUBEUV_TEXEL_HEIGHT 0.0009765625
#define CUBEUV_MAX_MIP 8.0
#define USE_AOMAP
#define USE_NORMALMAP
#define USE_NORMALMAP_TANGENTSPACE
#define USE_EMISSIVEMAP
#define USE_ROUGHNESSMAP
#define USE_METALNESSMAP
uniform mat4 viewMatrix;
uniform vec3 cameraPosition;
uniform bool isOrthographic;
#define TONE_MAPPING
#define saturate( a ) clamp( a, 0.0, 1.0 )
uniform float toneMappingExposure;
vec3 LinearToneMapping(vec3 color) {
	return saturate(toneMappingExposure * color);
}
vec3 ReinhardToneMapping(vec3 color) {
	color *= toneMappingExposure;
	return saturate(color / (vec3(1.0f) + color));
}
vec3 OptimizedCineonToneMapping(vec3 color) {
	color *= toneMappingExposure;
	color = max(vec3(0.0f), color - 0.004f);
	return pow((color * (6.2f * color + 0.5f)) / (color * (6.2f * color + 1.7f) + 0.06f), vec3(2.2f));
}
vec3 RRTAndODTFit(vec3 v) {
	vec3 a = v * (v + 0.0245786f) - 0.000090537f;
	vec3 b = v * (0.983729f * v + 0.4329510f) + 0.238081f;
	return a / b;
}
vec3 ACESFilmicToneMapping(vec3 color) {
	const mat3 ACESInputMat = mat3(vec3(0.59719f, 0.07600f, 0.02840f), vec3(0.35458f, 0.90834f, 0.13383f), vec3(0.04823f, 0.01566f, 0.83777f));
	const mat3 ACESOutputMat = mat3(vec3(1.60475f, -0.10208f, -0.00327f), vec3(-0.53108f, 1.10813f, -0.07276f), vec3(-0.07367f, -0.00605f, 1.07602f));
	color *= toneMappingExposure / 0.6f;
	color = ACESInputMat * color;
	color = RRTAndODTFit(color);
	color = ACESOutputMat * color;
	return saturate(color);
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(vec3(1.6605f, -0.1246f, -0.0182f), vec3(-0.5876f, 1.1329f, -0.1006f), vec3(-0.0728f, -0.0083f, 1.1187f));
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(vec3(0.6274f, 0.0691f, 0.0164f), vec3(0.3293f, 0.9195f, 0.0880f), vec3(0.0433f, 0.0113f, 0.8956f));
vec3 agxDefaultContrastApprox(vec3 x) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return +15.5f * x4 * x2 - 40.14f * x4 * x + 31.96f * x4 - 6.868f * x2 * x + 0.4298f * x2 + 0.1191f * x - 0.00232f;
}
vec3 AgXToneMapping(vec3 color) {
	const mat3 AgXInsetMatrix = mat3(vec3(0.856627153315983f, 0.137318972929847f, 0.11189821299995f), vec3(0.0951212405381588f, 0.761241990602591f, 0.0767994186031903f), vec3(0.0482516061458583f, 0.101439036467562f, 0.811302368396859f));
	const mat3 AgXOutsetMatrix = mat3(vec3(1.1271005818144368f, -0.1413297634984383f, -0.14132976349843826f), vec3(-0.11060664309660323f, 1.157823702216272f, -0.11060664309660294f), vec3(-0.016493938717834573f, -0.016493938717834257f, 1.2519364065950405f));
	const float AgxMinEv = -12.47393f;
	const float AgxMaxEv = 4.026069f;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max(color, 1e-10f);
	color = log2(color);
	color = (color - AgxMinEv) / (AgxMaxEv - AgxMinEv);
	color = clamp(color, 0.0f, 1.0f);
	color = agxDefaultContrastApprox(color);
	color = AgXOutsetMatrix * color;
	color = pow(max(vec3(0.0f), color), vec3(2.2f));
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp(color, 0.0f, 1.0f);
	return color;
}
vec3 NeutralToneMapping(vec3 color) {
	const float StartCompression = 0.8f - 0.04f;
	const float Desaturation = 0.15f;
	color *= toneMappingExposure;
	float x = min(color.r, min(color.g, color.b));
	float offset = x < 0.08f ? x - 6.25f * x * x : 0.04f;
	color -= offset;
	float peak = max(color.r, max(color.g, color.b));
	if(peak < StartCompression)
		return color;
	float d = 1.f - StartCompression;
	float newPeak = 1.f - d * d / (peak + d - StartCompression);
	color *= newPeak / peak;
	float g = 1.f - 1.f / (Desaturation * (peak - newPeak) + 1.f);
	return mix(color, vec3(newPeak), g);
}
vec3 CustomToneMapping(vec3 color) {
	return color;
}
vec3 toneMapping(vec3 color) {
	return ACESFilmicToneMapping(color);
}
#define OPAQUE

const mat3 LINEAR_SRGB_TO_LINEAR_DISPLAY_P3 = mat3(vec3(0.8224621f, 0.177538f, 0.0f), vec3(0.0331941f, 0.9668058f, 0.0f), vec3(0.0170827f, 0.0723974f, 0.9105199f));
const mat3 LINEAR_DISPLAY_P3_TO_LINEAR_SRGB = mat3(vec3(1.2249401f, -0.2249404f, 0.0f), vec3(-0.0420569f, 1.0420571f, 0.0f), vec3(-0.0196376f, -0.0786361f, 1.0982735f));
vec4 LinearSRGBToLinearDisplayP3(in vec4 value) {
	return vec4(value.rgb * LINEAR_SRGB_TO_LINEAR_DISPLAY_P3, value.a);
}
vec4 LinearDisplayP3ToLinearSRGB(in vec4 value) {
	return vec4(value.rgb * LINEAR_DISPLAY_P3_TO_LINEAR_SRGB, value.a);
}
vec4 LinearTransferOETF(in vec4 value) {
	return value;
}
vec4 sRGBTransferOETF(in vec4 value) {
	return vec4(mix(pow(value.rgb, vec3(0.41666f)) * 1.055f - vec3(0.055f), value.rgb * 12.92f, vec3(lessThanEqual(value.rgb, vec3(0.0031308f)))), value.a);
}
vec4 LinearToLinear(in vec4 value) {
	return value;
}
vec4 LinearTosRGB(in vec4 value) {
	return sRGBTransferOETF(value);
}
vec4 linearToOutputTexel(vec4 value) {
	return (sRGBTransferOETF(value));
}

#define STANDARD
	#define IOR
	#define USE_SPECULAR
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
uniform float ior;
uniform float specularIntensity;
uniform vec3 specularColor;
varying vec3 vViewPosition;
#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#define saturate( a ) clamp( a, 0.0, 1.0 )
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2(const in float x) {
	return x * x;
}
vec3 pow2(const in vec3 x) {
	return x * x;
}
float pow3(const in float x) {
	return x * x * x;
}
float pow4(const in float x) {
	float x2 = x * x;
	return x2 * x2;
}
float max3(const in vec3 v) {
	return max(max(v.x, v.y), v.z);
}
float average(const in vec3 v) {
	return dot(v, vec3(0.3333333f));
}
highp float rand(const in vec2 uv) {
	const highp float a = 12.9898f, b = 78.233f, c = 43758.5453f;
	highp float dt = dot(uv.xy, vec2(a, b)), sn = mod(dt, PI);
	return fract(sin(sn) * c);
}
float precisionSafeLength(vec3 v) {
	return length(v);
}
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
vec3 transformDirection(in vec3 dir, in mat4 matrix) {
	return normalize((matrix * vec4(dir, 0.0f)).xyz);
}
vec3 inverseTransformDirection(in vec3 dir, in mat4 matrix) {
	return normalize((vec4(dir, 0.0f) * matrix).xyz);
}
mat3 transposeMat3(const in mat3 m) {
	mat3 tmp;
	tmp[0] = vec3(m[0].x, m[1].x, m[2].x);
	tmp[1] = vec3(m[0].y, m[1].y, m[2].y);
	tmp[2] = vec3(m[0].z, m[1].z, m[2].z);
	return tmp;
}
float luminance(const in vec3 rgb) {
	const vec3 weights = vec3(0.2126729f, 0.7151522f, 0.0721750f);
	return dot(weights, rgb);
}
bool isPerspectiveMatrix(mat4 m) {
	return m[2][3] == -1.0f;
}
vec2 equirectUv(in vec3 dir) {
	float u = atan(dir.z, dir.x) * RECIPROCAL_PI2 + 0.5f;
	float v = asin(clamp(dir.y, -1.0f, 1.0f)) * RECIPROCAL_PI + 0.5f;
	return vec2(u, v);
}
vec3 BRDF_Lambert(const in vec3 diffuseColor) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick(const in vec3 f0, const in float f90, const in float dotVH) {
	float fresnel = exp2((-5.55473f * dotVH - 6.98316f) * dotVH);
	return f0 * (1.0f - fresnel) + (f90 * fresnel);
}
float F_Schlick(const in float f0, const in float f90, const in float dotVH) {
	float fresnel = exp2((-5.55473f * dotVH - 6.98316f) * dotVH);
	return f0 * (1.0f - fresnel) + (f90 * fresnel);
} // validated
vec3 packNormalToRGB(const in vec3 normal) {
	return normalize(normal) * 0.5f + 0.5f;
}
vec3 unpackRGBToNormal(const in vec3 rgb) {
	return 2.0f * rgb.xyz - 1.0f;
}
const float PackUpscale = 256.f / 255.f;
const float UnpackDownscale = 255.f / 256.f;
const vec3 PackFactors = vec3(256.f * 256.f * 256.f, 256.f * 256.f, 256.f);
const vec4 UnpackFactors = UnpackDownscale / vec4(PackFactors, 1.f);
const float ShiftRight8 = 1.f / 256.f;
vec4 packDepthToRGBA(const in float v) {
	vec4 r = vec4(fract(v * PackFactors), v);
	r.yzw -= r.xyz * ShiftRight8;
	return r * PackUpscale;
}
float unpackRGBAToDepth(const in vec4 v) {
	return dot(v, UnpackFactors);
}
vec2 packDepthToRG(in highp float v) {
	return packDepthToRGBA(v).yx;
}
float unpackRGToDepth(const in highp vec2 v) {
	return unpackRGBAToDepth(vec4(v.xy, 0.0f, 0.0f));
}
vec4 pack2HalfToRGBA(vec2 v) {
	vec4 r = vec4(v.x, fract(v.x * 255.0f), v.y, fract(v.y * 255.0f));
	return vec4(r.x - r.y / 255.0f, r.y, r.z - r.w / 255.0f, r.w);
}
vec2 unpackRGBATo2Half(vec4 v) {
	return vec2(v.x + (v.y / 255.0f), v.z + (v.w / 255.0f));
}
float viewZToOrthographicDepth(const in float viewZ, const in float near, const in float far) {
	return (viewZ + near) / (near - far);
}
float orthographicDepthToViewZ(const in float depth, const in float near, const in float far) {
	return depth * (near - far) - near;
}
float viewZToPerspectiveDepth(const in float viewZ, const in float near, const in float far) {
	return ((near + viewZ) * far) / ((far - near) * viewZ);
}
float perspectiveDepthToViewZ(const in float depth, const in float near, const in float far) {
	return (near * far) / ((far - near) * depth - far);
}
varying vec2 vMapUv;
varying vec2 vAoMapUv;
varying vec2 vNormalMapUv;
varying vec2 vEmissiveMapUv;
varying vec2 vMetalnessMapUv;
varying vec2 vRoughnessMapUv;
uniform sampler2D map;
uniform sampler2D aoMap;
uniform float aoMapIntensity;
uniform sampler2D emissiveMap;
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
float getFace(vec3 direction) {
	vec3 absDirection = abs(direction);
	float face = -1.0f;
	if(absDirection.x > absDirection.z) {
		if(absDirection.x > absDirection.y)
			face = direction.x > 0.0f ? 0.0f : 3.0f;
		else
			face = direction.y > 0.0f ? 1.0f : 4.0f;
	} else {
		if(absDirection.z > absDirection.y)
			face = direction.z > 0.0f ? 2.0f : 5.0f;
		else
			face = direction.y > 0.0f ? 1.0f : 4.0f;
	}
	return face;
}
vec2 getUV(vec3 direction, float face) {
	vec2 uv;
	if(face == 0.0f) {
		uv = vec2(direction.z, direction.y) / abs(direction.x);
	} else if(face == 1.0f) {
		uv = vec2(-direction.x, -direction.z) / abs(direction.y);
	} else if(face == 2.0f) {
		uv = vec2(-direction.x, direction.y) / abs(direction.z);
	} else if(face == 3.0f) {
		uv = vec2(-direction.z, direction.y) / abs(direction.x);
	} else if(face == 4.0f) {
		uv = vec2(-direction.x, direction.z) / abs(direction.y);
	} else {
		uv = vec2(direction.x, direction.y) / abs(direction.z);
	}
	return 0.5f * (uv + 1.0f);
}
vec3 bilinearCubeUV(sampler2D envMap, vec3 direction, float mipInt) {
	float face = getFace(direction);
	float filterInt = max(cubeUV_minMipLevel - mipInt, 0.0f);
	mipInt = max(mipInt, cubeUV_minMipLevel);
	float faceSize = exp2(mipInt);
	highp vec2 uv = getUV(direction, face) * (faceSize - 2.0f) + 1.0f;
	if(face > 2.0f) {
		uv.y += faceSize;
		face -= 3.0f;
	}
	uv.x += face * faceSize;
	uv.x += filterInt * 3.0f * cubeUV_minTileSize;
	uv.y += 4.0f * (exp2(CUBEUV_MAX_MIP) - faceSize);
	uv.x *= CUBEUV_TEXEL_WIDTH;
	uv.y *= CUBEUV_TEXEL_HEIGHT;
	return texture2DGradEXT(envMap, uv, vec2(0.0f), vec2(0.0f)).rgb;
}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
float roughnessToMip(float roughness) {
	float mip = 0.0f;
	if(roughness >= cubeUV_r1) {
		mip = (cubeUV_r0 - roughness) * (cubeUV_m1 - cubeUV_m0) / (cubeUV_r0 - cubeUV_r1) + cubeUV_m0;
	} else if(roughness >= cubeUV_r4) {
		mip = (cubeUV_r1 - roughness) * (cubeUV_m4 - cubeUV_m1) / (cubeUV_r1 - cubeUV_r4) + cubeUV_m1;
	} else if(roughness >= cubeUV_r5) {
		mip = (cubeUV_r4 - roughness) * (cubeUV_m5 - cubeUV_m4) / (cubeUV_r4 - cubeUV_r5) + cubeUV_m4;
	} else if(roughness >= cubeUV_r6) {
		mip = (cubeUV_r5 - roughness) * (cubeUV_m6 - cubeUV_m5) / (cubeUV_r5 - cubeUV_r6) + cubeUV_m5;
	} else {
		mip = -2.0f * log2(1.16f * roughness);
	}
	return mip;
}
vec4 textureCubeUV(sampler2D envMap, vec3 sampleDir, float roughness) {
	float mip = clamp(roughnessToMip(roughness), cubeUV_m0, CUBEUV_MAX_MIP);
	float mipF = fract(mip);
	float mipInt = floor(mip);
	vec3 color0 = bilinearCubeUV(envMap, sampleDir, mipInt);
	if(mipF == 0.0f) {
		return vec4(color0, 1.0f);
	} else {
		vec3 color1 = bilinearCubeUV(envMap, sampleDir, mipInt + 1.0f);
		return vec4(mix(color0, color1, mipF), 1.0f);
	}
}
uniform float envMapIntensity;
uniform float flipEnvMap;
uniform mat3 envMapRotation;
uniform sampler2D envMap;

vec3 getIBLIrradiance(const in vec3 normal) {
	vec3 worldNormal = inverseTransformDirection(normal, viewMatrix);
	vec4 envMapColor = textureCubeUV(envMap, envMapRotation * worldNormal, 1.0f);
	return PI * envMapColor.rgb * envMapIntensity;
}
vec3 getIBLRadiance(const in vec3 viewDir, const in vec3 normal, const in float roughness) {
	vec3 reflectVec = reflect(-viewDir, normal);
	reflectVec = normalize(mix(reflectVec, normal, roughness * roughness));
	reflectVec = inverseTransformDirection(reflectVec, viewMatrix);
	vec4 envMapColor = textureCubeUV(envMap, envMapRotation * reflectVec, roughness);
	return envMapColor.rgb * envMapIntensity;
}
uniform bool receiveShadow;
uniform vec3 ambientLightColor;
vec3 shGetIrradianceAt(in vec3 normal, in vec3 shCoefficients[9]) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[0] * 0.886227f;
	result += shCoefficients[1] * 2.0f * 0.511664f * y;
	result += shCoefficients[2] * 2.0f * 0.511664f * z;
	result += shCoefficients[3] * 2.0f * 0.511664f * x;
	result += shCoefficients[4] * 2.0f * 0.429043f * x * y;
	result += shCoefficients[5] * 2.0f * 0.429043f * y * z;
	result += shCoefficients[6] * (0.743125f * z * z - 0.247708f);
	result += shCoefficients[7] * 2.0f * 0.429043f * x * z;
	result += shCoefficients[8] * 0.429043f * (x * x - y * y);
	return result;
}
vec3 getLightProbeIrradiance(const in vec3 lightProbe[9], const in vec3 normal) {
	vec3 worldNormal = inverseTransformDirection(normal, viewMatrix);
	vec3 irradiance = shGetIrradianceAt(worldNormal, lightProbe);
	return irradiance;
}
vec3 getAmbientLightIrradiance(const in vec3 ambientLightColor) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation(const in float lightDistance, const in float cutoffDistance, const in float decayExponent) {
	float distanceFalloff = 1.0f / max(pow(lightDistance, decayExponent), 0.01f);
	if(cutoffDistance > 0.0f) {
		distanceFalloff *= pow2(saturate(1.0f - pow4(lightDistance / cutoffDistance)));
	}
	return distanceFalloff;
}
float getSpotAttenuation(const in float coneCosine, const in float penumbraCosine, const in float angleCosine) {
	return smoothstep(coneCosine, penumbraCosine, angleCosine);
}
varying vec3 vNormal;
struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	float dispersion;
	float ior;
};
vec3 clearcoatSpecularDirect = vec3(0.0f);
vec3 clearcoatSpecularIndirect = vec3(0.0f);
vec3 sheenSpecularDirect = vec3(0.0f);
vec3 sheenSpecularIndirect = vec3(0.0f);
vec3 Schlick_to_F0(const in vec3 f, const in float f90, const in float dotVH) {
	float x = clamp(1.0f - dotVH, 0.0f, 1.0f);
	float x2 = x * x;
	float x5 = clamp(x * x2 * x2, 0.0f, 0.9999f);
	return (f - vec3(f90) * x5) / (1.0f - x5);
}
float V_GGX_SmithCorrelated(const in float alpha, const in float dotNL, const in float dotNV) {
	float a2 = pow2(alpha);
	float gv = dotNL * sqrt(a2 + (1.0f - a2) * pow2(dotNV));
	float gl = dotNV * sqrt(a2 + (1.0f - a2) * pow2(dotNL));
	return 0.5f / max(gv + gl, EPSILON);
}
float D_GGX(const in float alpha, const in float dotNH) {
	float a2 = pow2(alpha);
	float denom = pow2(dotNH) * (a2 - 1.0f) + 1.0f;
	return RECIPROCAL_PI * a2 / pow2(denom);
}
vec3 BRDF_GGX(const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2(roughness);
	vec3 halfDir = normalize(lightDir + viewDir);
	float dotNL = saturate(dot(normal, lightDir));
	float dotNV = saturate(dot(normal, viewDir));
	float dotNH = saturate(dot(normal, halfDir));
	float dotVH = saturate(dot(viewDir, halfDir));
	vec3 F = F_Schlick(f0, f90, dotVH);
	float V = V_GGX_SmithCorrelated(alpha, dotNL, dotNV);
	float D = D_GGX(alpha, dotNH);
	return F * (V * D);
}
vec2 LTC_Uv(const in vec3 N, const in vec3 V, const in float roughness) {
	const float LUT_SIZE = 64.0f;
	const float LUT_SCALE = (LUT_SIZE - 1.0f) / LUT_SIZE;
	const float LUT_BIAS = 0.5f / LUT_SIZE;
	float dotNV = saturate(dot(N, V));
	vec2 uv = vec2(roughness, sqrt(1.0f - dotNV));
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor(const in vec3 f) {
	float l = length(f);
	return max((l * l + f.z) / (l + 1.0f), 0.0f);
}
vec3 LTC_EdgeVectorFormFactor(const in vec3 v1, const in vec3 v2) {
	float x = dot(v1, v2);
	float y = abs(x);
	float a = 0.8543985f + (0.4965155f + 0.0145206f * y) * y;
	float b = 3.4175940f + (4.1616724f + y) * y;
	float v = a / b;
	float theta_sintheta = (x > 0.0f) ? v : 0.5f * inversesqrt(max(1.0f - x * x, 1e-7f)) - v;
	return cross(v1, v2) * theta_sintheta;
}
vec3 LTC_Evaluate(const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[4]) {
	vec3 v1 = rectCoords[1] - rectCoords[0];
	vec3 v2 = rectCoords[3] - rectCoords[0];
	vec3 lightNormal = cross(v1, v2);
	if(dot(lightNormal, P - rectCoords[0]) < 0.0f)
		return vec3(0.0f);
	vec3 T1, T2;
	T1 = normalize(V - N * dot(V, N));
	T2 = -cross(N, T1);
	mat3 mat = mInv * transposeMat3(mat3(T1, T2, N));
	vec3 coords[4];
	coords[0] = mat * (rectCoords[0] - P);
	coords[1] = mat * (rectCoords[1] - P);
	coords[2] = mat * (rectCoords[2] - P);
	coords[3] = mat * (rectCoords[3] - P);
	coords[0] = normalize(coords[0]);
	coords[1] = normalize(coords[1]);
	coords[2] = normalize(coords[2]);
	coords[3] = normalize(coords[3]);
	vec3 vectorFormFactor = vec3(0.0f);
	vectorFormFactor += LTC_EdgeVectorFormFactor(coords[0], coords[1]);
	vectorFormFactor += LTC_EdgeVectorFormFactor(coords[1], coords[2]);
	vectorFormFactor += LTC_EdgeVectorFormFactor(coords[2], coords[3]);
	vectorFormFactor += LTC_EdgeVectorFormFactor(coords[3], coords[0]);
	float result = LTC_ClippedSphereFormFactor(vectorFormFactor);
	return vec3(result);
}
float IBLSheenBRDF(const in vec3 normal, const in vec3 viewDir, const in float roughness) {
	float dotNV = saturate(dot(normal, viewDir));
	float r2 = roughness * roughness;
	float a = roughness < 0.25f ? -339.2f * r2 + 161.4f * roughness - 25.9f : -8.48f * r2 + 14.3f * roughness - 9.95f;
	float b = roughness < 0.25f ? 44.0f * r2 - 23.7f * roughness + 3.26f : 1.97f * r2 - 3.27f * roughness + 0.72f;
	float DG = exp(a * dotNV + b) + (roughness < 0.25f ? 0.0f : 0.1f * (roughness - 0.25f));
	return saturate(DG * RECIPROCAL_PI);
}
vec2 DFGApprox(const in vec3 normal, const in vec3 viewDir, const in float roughness) {
	float dotNV = saturate(dot(normal, viewDir));
	const vec4 c0 = vec4(-1, -0.0275f, -0.572f, 0.022f);
	const vec4 c1 = vec4(1, 0.0425f, 1.04f, -0.04f);
	vec4 r = roughness * c0 + c1;
	float a004 = min(r.x * r.x, exp2(-9.28f * dotNV)) * r.x + r.y;
	vec2 fab = vec2(-1.04f, 1.04f) * a004 + r.zw;
	return fab;
}
vec3 EnvironmentBRDF(const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness) {
	vec2 fab = DFGApprox(normal, viewDir, roughness);
	return specularColor * fab.x + specularF90 * fab.y;
}
void computeMultiscattering(const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter) {
	vec2 fab = DFGApprox(normal, viewDir, roughness);
	vec3 Fr = specularColor;
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0f - Ess;
	vec3 Favg = Fr + (1.0f - Fr) * 0.047619f;
	vec3 Fms = FssEss * Favg / (1.0f - Ems * Favg);
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
void RE_Direct_Physical(const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	float dotNL = saturate(dot(geometryNormal, directLight.direction));
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directSpecular += irradiance * BRDF_GGX(directLight.direction, geometryViewDir, geometryNormal, material);
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert(material.diffuseColor);
}
void RE_IndirectDiffuse_Physical(const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert(material.diffuseColor);
}
void RE_IndirectSpecular_Physical(const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	vec3 singleScattering = vec3(0.0f);
	vec3 multiScattering = vec3(0.0f);
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	computeMultiscattering(geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering);
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * (1.0f - max(max(totalScattering.r, totalScattering.g), totalScattering.b));
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion(const in float dotNV, const in float ambientOcclusion, const in float roughness) {
	return saturate(pow(dotNV + ambientOcclusion, exp2(-16.0f * roughness - 1.0f)) - 1.0f + ambientOcclusion);
}
uniform sampler2D normalMap;
uniform vec2 normalScale;
mat3 getTangentFrame(vec3 eye_pos, vec3 surf_norm, vec2 uv) {
	vec3 q0 = dFdx(eye_pos.xyz);
	vec3 q1 = dFdy(eye_pos.xyz);
	vec2 st0 = dFdx(uv.st);
	vec2 st1 = dFdy(uv.st);
	vec3 N = surf_norm;
	vec3 q1perp = cross(q1, N);
	vec3 q0perp = cross(N, q0);
	vec3 T = q1perp * st0.x + q0perp * st1.x;
	vec3 B = q1perp * st0.y + q0perp * st1.y;
	float det = max(dot(T, T), dot(B, B));
	float scale = (det == 0.0f) ? 0.0f : inversesqrt(det);
	return mat3(T * scale, B * scale, N);
}
uniform sampler2D roughnessMap;
uniform sampler2D metalnessMap;
void main() {
	vec4 diffuseColor = vec4(diffuse, opacity);
	ReflectedLight reflectedLight = ReflectedLight(vec3(0.0f), vec3(0.0f), vec3(0.0f), vec3(0.0f));
	vec3 totalEmissiveRadiance = emissive;
	vec4 sampledDiffuseColor = texture2D(map, vMapUv);
	diffuseColor *= sampledDiffuseColor;
	float roughnessFactor = roughness;
	vec4 texelRoughness = texture2D(roughnessMap, vRoughnessMapUv);
	roughnessFactor *= texelRoughness.g;
	float metalnessFactor = metalness;
	vec4 texelMetalness = texture2D(metalnessMap, vMetalnessMapUv);
	metalnessFactor *= texelMetalness.b;
	float faceDirection = gl_FrontFacing ? 1.0f : -1.0f;
	vec3 normal = normalize(vNormal);
	mat3 tbn = getTangentFrame(-vViewPosition, normal, vNormalMapUv vUv);
	vec3 nonPerturbedNormal = normal;
	vec3 mapN = texture2D(normalMap, vNormalMapUv).xyz * 2.0f - 1.0f;
	mapN.xy *= normalScale;
	normal = normalize(tbn * mapN);
	vec4 emissiveColor = texture2D(emissiveMap, vEmissiveMapUv);
	totalEmissiveRadiance *= emissiveColor.rgb;
	PhysicalMaterial material;
	material.diffuseColor = diffuseColor.rgb * (1.0f - metalnessFactor);
	vec3 dxy = max(abs(dFdx(nonPerturbedNormal)), abs(dFdy(nonPerturbedNormal)));
	float geometryRoughness = max(max(dxy.x, dxy.y), dxy.z);
	material.roughness = max(roughnessFactor, 0.0525f);
	material.roughness += geometryRoughness;
	material.roughness = min(material.roughness, 1.0f);
	material.ior = ior;
	float specularIntensityFactor = specularIntensity;
	vec3 specularColorFactor = specularColor;
	material.specularF90 = mix(specularIntensityFactor, 1.0f, metalnessFactor);
	material.specularColor = mix(min(pow2((material.ior - 1.0f) / (material.ior + 1.0f)) * specularColorFactor, vec3(1.0f)) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor);

	vec3 geometryPosition = -vViewPosition;
	vec3 geometryNormal = normal;
	vec3 geometryViewDir = (isOrthographic) ? vec3(0, 0, 1) : normalize(vViewPosition);
	vec3 geometryClearcoatNormal = vec3(0.0f);
	IncidentLight directLight;
	vec3 iblIrradiance = vec3(0.0f);
	vec3 irradiance = getAmbientLightIrradiance(ambientLightColor);
	vec3 radiance = vec3(0.0f);
	vec3 clearcoatRadiance = vec3(0.0f);
	iblIrradiance += getIBLIrradiance(geometryNormal);
	radiance += getIBLRadiance(geometryViewDir, geometryNormal, material.roughness);
	RE_IndirectDiffuse(irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);
	RE_IndirectSpecular(radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);
	float ambientOcclusion = (texture2D(aoMap, vAoMapUv).r - 1.0f) * aoMapIntensity + 1.0f;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	float dotNV = saturate(dot(geometryNormal, geometryViewDir));
	reflectedLight.indirectSpecular *= computeSpecularOcclusion(dotNV, ambientOcclusion, material.roughness);
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	diffuseColor.a = 1.0f;
	gl_FragColor = vec4(outgoingLight, diffuseColor.a);
	gl_FragColor.rgb = toneMapping(gl_FragColor.rgb);
	gl_FragColor = linearToOutputTexel(gl_FragColor);
}