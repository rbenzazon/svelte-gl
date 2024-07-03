#version 300 es
precision mediump float;

${defines}

#if NUM_POINT_LIGHTS > 0
    uniform vec3 pointLightPositions[NUM_POINT_LIGHTS];
    uniform vec3 pointLightColors[NUM_POINT_LIGHTS];
    uniform float pointLightIntensities[NUM_POINT_LIGHTS];
#endif

uniform vec3 lightPosition;
uniform vec3 color;

in vec3 vertex;
in vec3 vNormal;    
in vec3 vertexColor;

out vec4 fragColor;

float calculateLightBrightness(vec3 lightPosition, vec3 lightColor, float lightIntensity, vec3 vertexPosition, vec3 normal) {
    vec3 offset = lightPosition - vertexPosition;
    float distance = length(offset);
    vec3 direction = normalize(offset);
    float diffuse = max(dot(direction, normal), 0.0);
    // Assuming a simple attenuation model where lightIntensity is factored into the attenuation calculation
    float attenuation = lightIntensity / (0.1 + 0.1*distance + 0.1*distance*distance);
    float brightness = max(diffuse * attenuation, 0.1);
    return brightness;
}

void main() {
    float totalBrightness = 0.0;
    for (int i = 0; i < NUM_POINT_LIGHTS; i++) {
        totalBrightness += calculateLightBrightness(pointLightPositions[i], pointLightColors[i], pointLightIntensities[i], vertex, vNormal);
    }
    //vec3 offset = lightPosition - vertex;
    /*vec3 offset = vec3(0.0,7.0,-3.0) - vertex;
    float distance = length(offset);
    vec3 direction = normalize(offset);

    float diffuse = max(dot(direction, vNormal), 0.0);
    float attenuation = 10.0 / (0.1 + 0.1*distance + 0.1*distance*distance);
    float brightness = max(diffuse * attenuation,0.1);*/
    fragColor = vec4(totalBrightness*color,1.0);
}