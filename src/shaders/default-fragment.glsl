#version 300 es
precision mediump float;

${defines}

#define RECIPROCAL_PI 0.3183098861837907

float saturate(const in float a) {
    return clamp(a, 0.0f, 1.0f);
}
float pow4(const in float x) {
    float x2 = x * x;
    return x2 * x2;
}
float pow2(const in float x) {
    return x * x;
}

struct PointLight {
    vec3 position;
    vec3 color;
    float cutoffDistance;
    float decayExponent;
};

layout(std140) uniform PointLights {
    PointLight pointLights[NUM_POINT_LIGHTS];
};

uniform vec3 color;

in vec3 vertex;
in vec3 vNormal;

out vec4 fragColor;

// tone mapping taken from three.js
float toneMappingExposure = 1.0f;

    // Matrices for rec 2020 <> rec 709 color space conversion
    // matrix provided in row-major order so it has been transposed
    // https://www.itu.int/pub/R-REP-BT.2407-2017
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(vec3(1.6605f, -0.1246f, -0.0182f), vec3(-0.5876f, 1.1329f, -0.1006f), vec3(-0.0728f, -0.0083f, 1.1187f));

const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(vec3(0.6274f, 0.0691f, 0.0164f), vec3(0.3293f, 0.9195f, 0.0880f), vec3(0.0433f, 0.0113f, 0.8956f));

    // https://iolite-engine.com/blog_posts/minimal_agx_implementation
    // Mean error^2: 3.6705141e-06
vec3 agxDefaultContrastApprox(vec3 x) {

    vec3 x2 = x * x;
    vec3 x4 = x2 * x2;

    return +15.5f * x4 * x2 - 40.14f * x4 * x + 31.96f * x4 - 6.868f * x2 * x + 0.4298f * x2 + 0.1191f * x - 0.00232f;

}

vec3 AgXToneMapping(vec3 color) {

        // AgX constants
    const mat3 AgXInsetMatrix = mat3(vec3(0.856627153315983f, 0.137318972929847f, 0.11189821299995f), vec3(0.0951212405381588f, 0.761241990602591f, 0.0767994186031903f), vec3(0.0482516061458583f, 0.101439036467562f, 0.811302368396859f));

        // explicit AgXOutsetMatrix generated from Filaments AgXOutsetMatrixInv
    const mat3 AgXOutsetMatrix = mat3(vec3(1.1271005818144368f, -0.1413297634984383f, -0.14132976349843826f), vec3(-0.11060664309660323f, 1.157823702216272f, -0.11060664309660294f), vec3(-0.016493938717834573f, -0.016493938717834257f, 1.2519364065950405f));

        // LOG2_MIN      = -10.0
        // LOG2_MAX      =  +6.5
        // MIDDLE_GRAY   =  0.18
    const float AgxMinEv = -12.47393f;  // log2( pow( 2, LOG2_MIN ) * MIDDLE_GRAY )
    const float AgxMaxEv = 4.026069f;    // log2( pow( 2, LOG2_MAX ) * MIDDLE_GRAY )

    color *= toneMappingExposure;

    color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;

    color = AgXInsetMatrix * color;

        // Log2 encoding
    color = max(color, 1e-10f); // avoid 0 or negative numbers for log2
    color = log2(color);
    color = (color - AgxMinEv) / (AgxMaxEv - AgxMinEv);

    color = clamp(color, 0.0f, 1.0f);

        // Apply sigmoid
    color = agxDefaultContrastApprox(color);

        // Apply AgX look
        // v = agxLook(v, look);

    color = AgXOutsetMatrix * color;

        // Linearize
    color = pow(max(vec3(0.0f), color), vec3(2.2f));

    color = LINEAR_REC2020_TO_LINEAR_SRGB * color;

        // Gamut mapping. Simple clamp for now.
    color = clamp(color, 0.0f, 1.0f);

    return color;

}

float getDistanceAttenuation(const in float lightDistance, const in float cutoffDistance, const in float decayExponent) {

	// based upon Frostbite 3 Moving to Physically-based Rendering
	// page 32, equation 26: E[window1]
	// https://seblagarde.files.wordpress.com/2015/07/course_notes_moving_frostbite_to_pbr_v32.pdf
    float distanceFalloff = 1.0f / max(pow(lightDistance, decayExponent), 0.01f);

    if(cutoffDistance > 0.0f) {

        distanceFalloff *= pow2(saturate(1.0f - pow4(lightDistance / cutoffDistance)));

    }

    return distanceFalloff;

}

vec3 calculateLightBrightness(vec3 lightPosition, vec3 lightColor, float cutoffDistance, float decayExponent, vec3 vertexPosition, vec3 normal) {
    vec3 offset = lightPosition - vertexPosition;
    float lightDistance = length(offset);
    vec3 direction = normalize(offset);
    vec3 irradiance = saturate(dot(normal, direction)) * lightColor;
    float distanceFalloff = getDistanceAttenuation(lightDistance, cutoffDistance, decayExponent);
    return vec3(irradiance * distanceFalloff);
}

void main() {

    vec3 totalIrradiance = vec3(0.0f);
    for(int i = 0; i < NUM_POINT_LIGHTS; i++) {
        PointLight pointLight = pointLights[i];
        totalIrradiance += calculateLightBrightness(pointLight.position, pointLight.color, pointLight.cutoffDistance, pointLight.decayExponent, vertex, vNormal);
    }

    //debug normals
    //fragColor = vec4(normalize(vNormal) * 0.5 + 0.5, 1.0);
    fragColor = vec4(AgXToneMapping(RECIPROCAL_PI * color * totalIrradiance), 1.0f);
}