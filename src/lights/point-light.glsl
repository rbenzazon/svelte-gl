${declaration?
`
struct LightParams {
    vec3 irradiance;
    vec3 direction;
    vec3 color;
    float distance;
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

LightParams getDirectDiffuse(const in PointLight pointLight,const in vec3 geometryPosition, const in vec3 normal,const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
    LightParams lightParams = LightParams(vec3(0.0f), vec3(0.0f), vec3(0.0f), 0.0f);
    vec3 lVector = pointLight.position - geometryPosition;
    lightParams.distance = length(lVector);
    lightParams.direction = normalize(lVector);
    float dotNL = saturate(dot(normal, lightParams.direction));
    lightParams.color = pointLight.color;
    lightParams.color *= getDistanceAttenuation(lightParams.distance, pointLight.cutoffDistance, pointLight.decayExponent);
    lightParams.irradiance = dotNL * lightParams.color;
    
    reflectedLight.directDiffuse += lightParams.irradiance * BRDF_Lambert(material.diffuseColor);
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
        LightParams lightParams = getDirectDiffuse(pointLight, geometryPosition, normal, material, reflectedLight);
        totalIrradiance += reflectedLight.directDiffuse;
        ${specularIrradiance}
    }
` : ''
}
