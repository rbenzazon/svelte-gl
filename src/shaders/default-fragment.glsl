#version 300 es
precision mediump float;

${defines}

struct PointLight {
    vec3 position;
    vec3 color;
    float intensity;
};

layout(std140) uniform PointLights {
    PointLight pointLights[NUM_POINT_LIGHTS];
};

uniform vec3 color;

in vec3 vertex;
in vec3 vNormal;

out vec4 fragColor;

float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {

	// based upon Frostbite 3 Moving to Physically-based Rendering
	// page 32, equation 26: E[window1]
	// https://seblagarde.files.wordpress.com/2015/07/course_notes_moving_frostbite_to_pbr_v32.pdf
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );

	if ( cutoffDistance > 0.0 ) {

		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );

	}

	return distanceFalloff;

}

vec3 calculateLightBrightness(vec3 lightPosition, vec3 lightColor, float lightIntensity, vec3 vertexPosition, vec3 normal) {
    vec3 offset = lightPosition - vertexPosition;
    //debug position
    //vec3 offset = vec3(0.0,3.0, -1.0) - vertexPosition;
    float distance = length(offset);
    vec3 direction = normalize(offset);
    float diffuse = max(dot(direction, normal), 0.0);
    // Assuming a simple attenuation model where lightIntensity is factored into the attenuation calculation
    float attenuation = lightIntensity / (0.1 + 0.1*distance + 0.1*distance*distance);
    
    float brightness = max(diffuse * attenuation, 0.2);
    return vec3(brightness*lightColor);
}

void main() {

    vec3 totalBrightness = vec3(0.0);
    for (int i = 0; i < NUM_POINT_LIGHTS; i++) {
        PointLight pointLight = pointLights[i];
        totalBrightness += calculateLightBrightness(pointLight.position, pointLight.color, pointLight.intensity, vertex, vNormal);
    }

    //debug normals
    //fragColor = vec4(normalize(vNormal) * 0.5 + 0.5, 1.0);
    fragColor = vec4(color*totalBrightness,1.0);
}