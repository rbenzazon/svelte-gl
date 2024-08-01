${declaration?
`

float pow4(const in float x) {
    float x2 = x * x;
    return x2 * x2;
}
float pow2(const in float x) {
    return x * x;
}

float saturate(const in float a) {
    return clamp(a, 0.0f, 1.0f);
}

struct LightParams {
    float distance;
    vec3 direction;
    vec3 irradiance;
};

struct PointLight {
    vec3 position;
    vec3 color;
    float cutoffDistance;
    float decayExponent;
};

layout(std140) uniform PointLights {
    PointLight pointLights[NUM_POINT_LIGHTS];
};

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

LightParams getIrradiance(vec3 lightPosition, vec3 lightColor,vec3 vertexPosition, vec3 normal) {
    LightParams lightParams;
    vec3 offset = lightPosition - vertexPosition;
    lightParams.distance = length(offset);
    lightParams.direction = normalize(offset);
    lightParams.irradiance = saturate(dot(normal, lightParams.direction)) * lightColor;
    return lightParams;
}

float calculatePointLightBrightness(float lightDistance, float cutoffDistance, float decayExponent) {
    return getDistanceAttenuation(lightDistance, cutoffDistance, decayExponent);
}
` : ''
}
${irradiance?
`
    vec3 irradiance = vec3(0.0f);
    vec3 direction = vec3(0.0f);
    for(int i = 0; i < NUM_POINT_LIGHTS; i++) {
        PointLight pointLight = pointLights[i];
        LightParams lightParams = getIrradiance(pointLight.position, pointLight.color, vertex, vNormal);
        totalIrradiance += lightParams.irradiance * calculatePointLightBrightness(lightParams.distance, pointLight.cutoffDistance, pointLight.decayExponent);
        ${specularIrradiance}
    }
` : ''
}
