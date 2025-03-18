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
#define SHADER_NAME SphericalGaussianBlur
#define n 20
#define CUBEUV_TEXEL_WIDTH 0.0013020833333333333
#define CUBEUV_TEXEL_HEIGHT 0.0009765625
#define CUBEUV_MAX_MIP 8.0
uniform mat4 viewMatrix;
uniform vec3 cameraPosition;
uniform bool isOrthographic;

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
    return (LinearTransferOETF(value));
}

precision mediump float;
precision mediump int;

varying vec3 vOutputDirection;

uniform sampler2D envMap;
uniform int samples;
uniform float weights[n];
uniform bool latitudinal;
uniform float dTheta;
uniform float mipInt;
uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
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

vec3 getSample(float theta, vec3 axis) {

    float cosTheta = cos(theta);
				// Rodrigues' axis-angle rotation
    vec3 sampleDirection = vOutputDirection * cosTheta + cross(axis, vOutputDirection) * sin(theta) + axis * dot(axis, vOutputDirection) * (1.0f - cosTheta);

    return bilinearCubeUV(envMap, sampleDirection, mipInt);

}

void main() {

    vec3 axis = latitudinal ? poleAxis : cross(poleAxis, vOutputDirection);

    if(all(equal(axis, vec3(0.0f)))) {

        axis = vec3(vOutputDirection.z, 0.0f, -vOutputDirection.x);

    }

    axis = normalize(axis);

    gl_FragColor = vec4(0.0f, 0.0f, 0.0f, 1.0f);
    gl_FragColor.rgb += weights[0] * getSample(0.0f, axis);

    for(int i = 1; i < n; i++) {

        if(i >= samples) {

            break;

        }

        float theta = dTheta * float(i);
        gl_FragColor.rgb += weights[i] * getSample(-1.0f * theta, axis);
        gl_FragColor.rgb += weights[i] * getSample(theta, axis);

    }

}