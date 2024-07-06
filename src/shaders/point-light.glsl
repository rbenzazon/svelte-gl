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

vec3 calculatePointLightBrightness(vec3 lightPosition, vec3 lightColor, float cutoffDistance, float decayExponent, vec3 vertexPosition, vec3 normal) {
    vec3 offset = lightPosition - vertexPosition;
    float lightDistance = length(offset);
    vec3 direction = normalize(offset);
    vec3 irradiance = saturate(dot(normal, direction)) * lightColor;
    float distanceFalloff = getDistanceAttenuation(lightDistance, cutoffDistance, decayExponent);
    return vec3(irradiance * distanceFalloff);
}
` : ''
}
${irradiance?
`
    for(int i = 0; i < NUM_POINT_LIGHTS; i++) {
        PointLight pointLight = pointLights[i];
        totalIrradiance += calculatePointLightBrightness(pointLight.position, pointLight.color, pointLight.cutoffDistance, pointLight.decayExponent, vertex, vNormal);
    }
` : ''
}
