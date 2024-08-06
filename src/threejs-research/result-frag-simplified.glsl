layout(location = 0) out highp vec4 pc_fragColor;
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

in vec3 vViewPosition;
in vec3 vNormal;

uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
uniform float ior;
uniform float specularIntensity;
uniform vec3 specularColor;
uniform vec3 ambientLightColor;

uniform PointLight pointLights[1];

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

struct PointLight {
	vec3 position;
	vec3 color;
	float distance;
	float decay;
};

struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	float dispersion;
	float ior;
};

vec4 sRGBTransferOETF(in vec4 value) {
	return vec4(mix(pow(value.rgb, vec3(0.41666)) * 1.055 - vec3(0.055), value.rgb * 12.92, vec3(lessThanEqual(value.rgb, vec3(0.0031308)))), value.a);
}
vec4 linearToOutputTexel(vec4 value) {
	return (sRGBTransferOETF(value));
}
float pow2(const in float x) {
	return x * x;
}

vec3 BRDF_Lambert(const in vec3 diffuseColor) {
	return 0.3183098861837907 * diffuseColor;
}
vec3 F_Schlick(const in vec3 f0, const in float f90, const in float dotVH) {
	float fresnel = exp2((-5.55473 * dotVH - 6.98316) * dotVH);
	return f0 * (1.0 - fresnel) + (f90 * fresnel);
}

vec3 shGetIrradianceAt(in vec3 normal, in vec3 shCoefficients[9]) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[0] * 0.886227;
	result += shCoefficients[1] * 2.0 * 0.511664 * y;
	result += shCoefficients[2] * 2.0 * 0.511664 * z;
	result += shCoefficients[3] * 2.0 * 0.511664 * x;
	result += shCoefficients[4] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[5] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[6] * (0.743125 * z * z - 0.247708);
	result += shCoefficients[7] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[8] * 0.429043 * (x * x - y * y);
	return result;
}
vec3 getAmbientLightIrradiance(const in vec3 ambientLightColor) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation(const in float lightDistance, const in float cutoffDistance, const in float decayExponent) {
	float distanceFalloff = 1.0 / max(pow(lightDistance, decayExponent), 0.01);
	if(cutoffDistance > 0.0) {
		distanceFalloff *= pow2(clamp(a, 0.0, 1.0));
	}
	return distanceFalloff;
}
void getPointLightInfo(const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light) {
	vec3 lVector = pointLight.position - geometryPosition;
	light.direction = normalize(lVector);
	float lightDistance = length(lVector);
	light.color = pointLight.color;
	light.color *= getDistanceAttenuation(lightDistance, pointLight.distance, pointLight.decay);
	light.visible = (light.color != vec3(0.0));
}
vec3 Schlick_to_F0(const in vec3 f, const in float f90, const in float dotVH) {
	float x = clamp(1.0 - dotVH, 0.0, 1.0);
	float x2 = x * x;
	float x5 = clamp(x * x2 * x2, 0.0, 0.9999);
	return (f - vec3(f90) * x5) / (1.0 - x5);
}
float V_GGX_SmithCorrelated(const in float alpha, const in float dotNL, const in float dotNV) {
	float a2 = pow2(alpha);
	float gv = dotNL * sqrt(a2 + (1.0 - a2) * pow2(dotNV));
	float gl = dotNV * sqrt(a2 + (1.0 - a2) * pow2(dotNL));
	return 0.5 / max(gv + gl, 1e-6);
}
float D_GGX(const in float alpha, const in float dotNH) {
	float a2 = pow2(alpha);
	float denom = pow2(dotNH) * (a2 - 1.0) + 1.0;
	return 0.3183098861837907 * a2 / pow2(denom);
}
vec3 BRDF_GGX(const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2(roughness);
	vec3 halfDir = normalize(lightDir + viewDir);
	float dotNL = clamp(a, 0.0, 1.0);
	float dotNV = clamp(a, 0.0, 1.0);
	float dotNH = clamp(a, 0.0, 1.0);
	float dotVH = clamp(a, 0.0, 1.0);
	vec3 F = F_Schlick(f0, f90, dotVH);
	float V = V_GGX_SmithCorrelated(alpha, dotNL, dotNV);
	float D = D_GGX(alpha, dotNH);
	return F * (V * D);
}
vec2 DFGApprox(const in vec3 normal, const in vec3 viewDir, const in float roughness) {
	float dotNV = clamp(a, 0.0, 1.0);
	const vec4 c0 = vec4(-1, -0.0275, -0.572, 0.022);
	const vec4 c1 = vec4(1, 0.0425, 1.04, -0.04);
	vec4 r = roughness * c0 + c1;
	float a004 = min(r.x * r.x, exp2(-9.28 * dotNV)) * r.x + r.y;
	vec2 fab = vec2(-1.04, 1.04) * a004 + r.zw;
	return fab;
}

void computeMultiscattering(const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter) {
	vec2 fab = DFGApprox(normal, viewDir, roughness);
	vec3 Fr = specularColor;
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + (1.0 - Fr) * 0.047619;
	vec3 Fms = FssEss * Favg / (1.0 - Ems * Favg);
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
void RE_Direct_Physical(const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	float dotNL = clamp(a, 0.0, 1.0);
	vec3 irradiance = dotNL * directLight.color;
	//specular
	reflectedLight.directSpecular += irradiance * BRDF_GGX(directLight.direction, geometryViewDir, geometryNormal, material);
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert(material.diffuseColor);
}
void RE_IndirectDiffuse_Physical(const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert(material.diffuseColor);
}
void RE_IndirectSpecular_Physical(const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	vec3 singleScattering = vec3(0.0);
	vec3 multiScattering = vec3(0.0);
	vec3 cosineWeightedIrradiance = irradiance * 0.3183098861837907;
	computeMultiscattering(geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering);
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * (1.0 - max(max(totalScattering.r, totalScattering.g), totalScattering.b));
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
void main() {
	//uniform readings
	vec4 diffuseColor = vec4(diffuse, opacity);
	vec3 normal = normalize(vNormal);

	//material - All Done
	PhysicalMaterial material;
	material.diffuseColor = diffuseColor.rgb * (1.0 - metalness);
	material.roughness = clamp(roughness, 0.0525, 1.0);
	material.ior = ior;
	material.specularF90 = mix(specularIntensity, 1.0, metalness);
	material.specularColor = mix(min(pow2((material.ior - 1.0) / (material.ior + 1.0)) * specularColor, vec3(1.0)) * specularIntensity, diffuseColor.rgb, metalness);
	//vec3 nonPerturbedNormal = normal;
	//vec3 dxy = max(abs(dFdx(nonPerturbedNormal)), abs(dFdy(nonPerturbedNormal)));
	//float geometryRoughness = max(max(dxy.x, dxy.y), dxy.z);
	//material.roughness += geometryRoughness;
	
	ReflectedLight reflectedLight = ReflectedLight(vec3(0.0), vec3(0.0), vec3(0.0), vec3(0.0));
	IncidentLight directLight;	


	vec3 geometryPosition = -vViewPosition; //in vertex shader : vec3 transformed = vec3(position);vec4 mvPosition = vec4(transformed, 1.0);mvPosition = modelViewMatrix * mvPosition;vViewPosition = -mvPosition.xyz;
	vec3 geometryViewDir = normalize(vViewPosition);
	vec3 geometryClearcoatNormal = vec3(0.0);
	
	PointLight pointLight;
	pointLight = pointLights[0];

	getPointLightInfo(pointLight, geometryPosition, directLight);
	RE_Direct_Physical(directLight, geometryPosition, normal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);

	vec3 iblIrradiance = vec3(0.0);
	vec3 irradiance = getAmbientLightIrradiance(ambientLightColor);
	vec3 radiance = vec3(0.0);
	vec3 clearcoatRadiance = vec3(0.0);
	RE_IndirectDiffuse_Physical(irradiance, geometryPosition, normal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);//done
	RE_IndirectSpecular_Physical(radiance, iblIrradiance, clearcoatRadiance, geometryPosition, normal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	vec3 outgoingLight = totalDiffuse + totalSpecular + emissive;
	diffuseColor.a = 1.0;
	pc_fragColor = vec4(outgoingLight, diffuseColor.a);
	pc_fragColor = linearToOutputTexel(pc_fragColor);
}
