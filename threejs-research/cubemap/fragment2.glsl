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
#define SHADER_TYPE ShaderMaterial
#define SHADER_NAME BackgroundCubeMaterial
#define USE_ENVMAP
#define ENVMAP_TYPE_CUBE
#define ENVMAP_MODE_REFLECTION
#define ENVMAP_BLENDING_NONE
#define FLIP_SIDED
uniform mat4 viewMatrix;
uniform vec3 cameraPosition;
uniform bool isOrthographic;
#define TONE_MAPPING
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
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

#ifdef ENVMAP_TYPE_CUBE
uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#ifdef ENVMAP_TYPE_CUBE_UV
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
		#ifdef texture2DGradEXT
    return texture2DGradEXT(envMap, uv, vec2(0.0f), vec2(0.0f)).rgb;
		#else
    return texture2D(envMap, uv).rgb;
		#endif
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
#endif
void main() {
	#ifdef ENVMAP_TYPE_CUBE
    vec4 texColor = textureCube(envMap, backgroundRotation * vec3(flipEnvMap * vWorldDirection.x, vWorldDirection.yz));
	#elif defined( ENVMAP_TYPE_CUBE_UV )
    vec4 texColor = textureCubeUV(envMap, backgroundRotation * vWorldDirection, backgroundBlurriness);
	#else
    vec4 texColor = vec4(0.0f, 0.0f, 0.0f, 1.0f);
	#endif
    texColor.rgb *= backgroundIntensity;
    gl_FragColor = texColor;
#if defined( TONE_MAPPING )
    gl_FragColor.rgb = toneMapping(gl_FragColor.rgb);
#endif
    gl_FragColor = linearToOutputTexel(gl_FragColor);
}