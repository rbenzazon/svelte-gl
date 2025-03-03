import { a8 as templateLiteralRenderer, R as appContext } from './Menu-CrCjuat-.js';

var specularShader = "${declaration?\r\n`\r\n\r\nuniform float roughness;\r\nfloat roughnessFactor;\r\nuniform float ior;\r\nuniform float specularIntensity;\r\nuniform vec3 specularColor;\r\n\r\n\r\n\r\n#define EPSILON 1e-6\r\n\r\nvec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {\r\n\r\n\t// Original approximation by Christophe Schlick '94\r\n\t// float fresnel = pow( 1.0 - dotVH, 5.0 );\r\n\r\n\t// Optimized variant (presented by Epic at SIGGRAPH '13)\r\n\t// https://cdn2.unrealengine.com/Resources/files/2013SiggraphPresentationsNotes-26915738.pdf\r\n\tfloat fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );\r\n\r\n\treturn f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );\r\n\r\n} \r\n\r\n// Moving Frostbite to Physically Based Rendering 3.0 - page 12, listing 2\r\n// https://seblagarde.files.wordpress.com/2015/07/course_notes_moving_frostbite_to_pbr_v32.pdf\r\nfloat V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {\r\n\r\n\tfloat a2 = pow2( alpha );\r\n\r\n\tfloat gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );\r\n\tfloat gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );\r\n\r\n\treturn 0.5 / max( gv + gl, EPSILON );\r\n\r\n}\r\n\r\n// Microfacet Models for Refraction through Rough Surfaces - equation (33)\r\n// http://graphicrants.blogspot.com/2013/08/specular-brdf-reference.html\r\n// alpha is \"roughness squared\" in Disney’s reparameterization\r\nfloat D_GGX( const in float alpha, const in float dotNH ) {\r\n\r\n\tfloat a2 = pow2( alpha );\r\n\r\n\tfloat denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0; // avoid alpha = 0 with dotNH = 1\r\n\r\n\treturn RECIPROCAL_PI * a2 / pow2( denom );\r\n\r\n}\r\n\r\nvec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float specularF90, const in float roughness) {\r\n\r\n\tfloat alpha = pow2( roughness ); // UE4's roughness\r\n\r\n\tvec3 halfDir = normalize( lightDir + viewDir );\r\n\r\n\tfloat dotNL = saturate( dot( normal, lightDir ) );\r\n\tfloat dotNV = saturate( dot( normal, viewDir ) );\r\n\tfloat dotNH = saturate( dot( normal, halfDir ) );\r\n\tfloat dotVH = saturate( dot( viewDir, halfDir ) );\r\n\r\n\tvec3 F = F_Schlick( specularColor, specularF90, dotVH );\r\n\r\n\tfloat V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );\r\n\r\n\tfloat D = D_GGX( alpha, dotNH );\r\n\r\n\treturn F * ( V * D );\r\n\r\n}\r\n` : ''\r\n}\r\n${irradiance?\r\n`\r\n\tmaterial.roughness = clamp(roughness * roughnessFactor, 0.0525, 1.0);\r\n\tmaterial.ior = ior;\r\n\tmaterial.specularF90 = mix(specularIntensity, 1.0, metalness);\r\n\tmaterial.specularColor = mix(min(pow2((material.ior - 1.0) / (material.ior + 1.0)) * specularColor, vec3(1.0)) * specularIntensity, diffuse.rgb, metalness);\r\n\r\n        vec3 geometryViewDir = normalize( cameraPosition - vertex );\r\n        reflectedLight.directSpecular += lightParams.irradiance * BRDF_GGX( lightParams.direction, geometryViewDir, normal, material.specularColor, material.specularF90, material.roughness);//lightParams.irradiance; //* \r\n        //totalIrradiance = -vec3(geometryViewDir.z,geometryViewDir.z,geometryViewDir.z);//BRDF_GGX( lightParams.direction, geometryViewDir, normalize(vNormal), specularColor, specularF90, roughness);\r\n\t\t//totalIrradiance = lightParams.irradiance;//vec3(-lightParams.direction.z,-lightParams.direction.z,-lightParams.direction.z);\r\n` : ''\r\n}";

//{ roughness = 0, ior = 1.5, intensity = 1, color = [1, 1, 1] } =
/**
 * @typedef SpecularProps
 * @property {number} [roughness=0]
 * @property {number} [ior=1.5]
 * @property {number} [intensity=1]
 * @property {number[]} [color=[1, 1, 1]]
 */
/**
 * @typedef SpecularExtended
 * @property {import("../../shaders/template.js").TemplateRenderer} shader
 * @property {()=>void} setupSpecular
 */
/**
 * @typedef {SpecularProps & SpecularExtended} SvelteGLSpecular
 */

/**
 *
 * @param {SpecularProps} props
 * @returns
 */
const createSpecular = (props) => {
	return {
		...props,
		shader: templateLiteralRenderer(specularShader, {
			declaration: false,
			irradiance: false,
		}),
		setupSpecular: setupSpecular(props),
	};
};

function setupSpecular({ roughness, ior, intensity, color }) {
	return function setupSpecular() {
		const { gl, program } = appContext;

		const colorLocation = gl.getUniformLocation(program, "specularColor");
		const roughnessLocation = gl.getUniformLocation(program, "roughness");
		const iorLocation = gl.getUniformLocation(program, "ior");
		const specularIntensityLocation = gl.getUniformLocation(program, "specularIntensity");

		gl.uniform3fv(colorLocation, color);
		gl.uniform1f(roughnessLocation, roughness);
		gl.uniform1f(iorLocation, ior);
		gl.uniform1f(specularIntensityLocation, intensity);
	};
}

export { createSpecular as c };
