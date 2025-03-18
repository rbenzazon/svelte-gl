#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
precision highp samplerCube;

#define SHADER_NAME defaultFragment

${defines}

#define RECIPROCAL_PI 0.3183098861837907

uniform vec3 diffuse;
uniform float opacity;
uniform float metalness;
uniform vec3 ambientLightColor;
uniform vec3 cameraPosition;
uniform mat4 viewMatrix;
//uniform mat3 normalMatrix;

in vec3 vertex;
in vec3 vNormal;
in highp vec2 vUv;
in vec3 vViewPosition;

out vec4 fragColor;

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

struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};

struct PhysicalMaterial {
	vec3 diffuseColor;
	float diffuseAlpha;
	float roughness;
	vec3 specularColor;
	float specularF90;
	float ior;
};

vec3 BRDF_Lambert(const in vec3 diffuseColor) {
	return RECIPROCAL_PI * diffuseColor;
}


${declarations}

vec4 sRGBTransferOETF(in vec4 value) {
	return vec4(mix(pow(value.rgb, vec3(0.41666)) * 1.055 - vec3(0.055), value.rgb * 12.92, vec3(lessThanEqual(value.rgb, vec3(0.0031308)))), value.a);
}

vec4 linearToOutputTexel(vec4 value) {
	return (sRGBTransferOETF(value));
}

void main() {
    PhysicalMaterial material;
	material.diffuseAlpha = 1.0;
	material.diffuseColor = diffuse.rgb * (1.0 - metalness);
	${roughnessMapSample}
	${material}
	${diffuseMapSample}
	

	vec3 normal = normalize( vNormal );
	vec3 geometryPosition = - vViewPosition;
    vec3 geometryNormal = normal;
    vec3 geometryViewDir = normalize( vViewPosition );
	${normalMapSample}
	

    ReflectedLight reflectedLight = ReflectedLight(vec3(0.0), vec3(0.0), vec3(0.0), vec3(0.0));

    reflectedLight.indirectDiffuse += ambientLightColor * BRDF_Lambert(material.diffuseColor);

    vec3 totalIrradiance = vec3(0.0f);
    ${irradiance}
	vec3 outgoingLight = reflectedLight.indirectDiffuse + reflectedLight.directDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular;
    fragColor = vec4(outgoingLight, opacity*material.diffuseAlpha);
    //fragColor = vec4(totalIrradiance, 1.0f);
    ${toneMapping}
	fragColor = linearToOutputTexel(fragColor);
	//fragColor = vec4(pointLights[0].position - geometryPosition,1.0);
	//fragColor = vec4(material.roughness,material.roughness,material.roughness,1.0);
}