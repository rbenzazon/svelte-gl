${declaration?
`

uniform float roughness;
uniform float ior;
uniform float specularIntensity;
uniform vec3 specularColor;

in vec3 vViewPosition;

#define EPSILON 1e-6

vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {

	// Original approximation by Christophe Schlick '94
	// float fresnel = pow( 1.0 - dotVH, 5.0 );

	// Optimized variant (presented by Epic at SIGGRAPH '13)
	// https://cdn2.unrealengine.com/Resources/files/2013SiggraphPresentationsNotes-26915738.pdf
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );

	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );

} 

// Moving Frostbite to Physically Based Rendering 3.0 - page 12, listing 2
// https://seblagarde.files.wordpress.com/2015/07/course_notes_moving_frostbite_to_pbr_v32.pdf
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {

	float a2 = pow2( alpha );

	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );

	return 0.5 / max( gv + gl, EPSILON );

}

// Microfacet Models for Refraction through Rough Surfaces - equation (33)
// http://graphicrants.blogspot.com/2013/08/specular-brdf-reference.html
// alpha is "roughness squared" in Disney’s reparameterization
float D_GGX( const in float alpha, const in float dotNH ) {

	float a2 = pow2( alpha );

	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0; // avoid alpha = 0 with dotNH = 1

	return RECIPROCAL_PI * a2 / pow2( denom );

}

vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float specularF90, const in float roughness) {

	float alpha = pow2( roughness ); // UE4's roughness

	vec3 halfDir = normalize( lightDir + viewDir );

	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );

	vec3 F = F_Schlick( specularColor, specularF90, dotVH );

	float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );

	float D = D_GGX( alpha, dotNH );

	return F * ( V * D );

}
` : ''
}
${irradiance?
`
	material.roughness = clamp(roughness, 0.0525, 1.0);
	material.ior = ior;
	material.specularF90 = mix(specularIntensity, 1.0, metalness);
	material.specularColor = mix(min(pow2((material.ior - 1.0) / (material.ior + 1.0)) * specularColor, vec3(1.0)) * specularIntensity, diffuse.rgb, metalness);

        vec3 geometryViewDir = normalize( cameraPosition - vertex );
        reflectedLight.directSpecular += lightParams.irradiance * BRDF_GGX( lightParams.direction, geometryViewDir, normalize(vNormal), material.specularColor, material.specularF90, material.roughness);//lightParams.irradiance; //* 
        //totalIrradiance = -vec3(geometryViewDir.z,geometryViewDir.z,geometryViewDir.z);//BRDF_GGX( lightParams.direction, geometryViewDir, normalize(vNormal), specularColor, specularF90, roughness);
		//totalIrradiance = lightParams.irradiance;//vec3(-lightParams.direction.z,-lightParams.direction.z,-lightParams.direction.z);
` : ''
}