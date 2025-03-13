${declaration?
`
#define PI 3.141592653589793

#define CUBEUV_TEXEL_WIDTH ${CUBEUV_TEXEL_WIDTH}
#define CUBEUV_TEXEL_HEIGHT ${CUBEUV_TEXEL_HEIGHT}
#define CUBEUV_MAX_MIP ${CUBEUV_MAX_MIP}

#define cubeUV_minMipLevel 4.0
#define cubeUV_minTileSize 16.0

uniform float envMapIntensity;
uniform mat3 envMapRotation;
uniform sampler2D envMap;

float getFace( vec3 direction ) {
    vec3 absDirection = abs( direction );
    float face = - 1.0;
    if ( absDirection.x > absDirection.z ) {
        if ( absDirection.x > absDirection.y )
        face = direction.x > 0.0 ? 0.0 : 3.0;
        else
        face = direction.y > 0.0 ? 1.0 : 4.0;
    }
    else {
        if ( absDirection.z > absDirection.y )
        face = direction.z > 0.0 ? 2.0 : 5.0;
        else
        face = direction.y > 0.0 ? 1.0 : 4.0;
    }
    return face;
}
vec2 getUV( vec3 direction, float face ) {
    vec2 uv;
    if ( face == 0.0 ) {
        uv = vec2( direction.z, direction.y ) / abs( direction.x );
    }
    else if ( face == 1.0 ) {
        uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
    }
    else if ( face == 2.0 ) {
        uv = vec2( - direction.x, direction.y ) / abs( direction.z );
    }
    else if ( face == 3.0 ) {
        uv = vec2( - direction.z, direction.y ) / abs( direction.x );
    }
    else if ( face == 4.0 ) {
        uv = vec2( - direction.x, direction.z ) / abs( direction.y );
    }
    else {
        uv = vec2( direction.x, direction.y ) / abs( direction.z );
    }
    return 0.5 * ( uv + 1.0 );
}

vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
    float face = getFace( direction );
    float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
    mipInt = max( mipInt, cubeUV_minMipLevel );
    float faceSize = exp2( mipInt );
    highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
    if ( face > 2.0 ) {
        uv.y += faceSize;
        face -= 3.0;
    }
    uv.x += face * faceSize;
    uv.x += filterInt * 3.0 * cubeUV_minTileSize;
    uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
    uv.x *= CUBEUV_TEXEL_WIDTH;
    uv.y *= CUBEUV_TEXEL_HEIGHT;
    //return texture( envMap, uv).rgb;
    return textureGrad( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
}
float roughnessToMip( float roughness ) {
    float mip = 0.0;
    if ( roughness >= 0.8 ) {
        mip = ( 1.0 - roughness ) * ( - 1.0 - - 2.0 ) / ( 1.0 - 0.8 ) + - 2.0;
    }
    else if ( roughness >= 0.4 ) {
        mip = ( 0.8 - roughness ) * ( 2.0 - - 1.0 ) / ( 0.8 - 0.4 ) + - 1.0;
    }
    else if ( roughness >= 0.305 ) {
        mip = ( 0.4 - roughness ) * ( 3.0 - 2.0 ) / ( 0.4 - 0.305 ) + 2.0;
    }
    else if ( roughness >= 0.21 ) {
        mip = ( 0.305 - roughness ) * ( 4.0 - 3.0 ) / ( 0.305 - 0.21 ) + 3.0;
    }
    else {
        mip = - 2.0 * log2( 1.16 * roughness );
    }
    return mip;
}
vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
    float mip = clamp( roughnessToMip( roughness ), - 2.0, 8.0 );
    float mipF = fract( mip );
    float mipInt = floor( mip );
    vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
    if ( mipF == 0.0 ) {
        return vec4( color0, 1.0 );
    }
    else {
        vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
        return vec4( mix( color0, color1, mipF ), 1.0 );
    }
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
    return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
vec3 getIBLIrradiance( const in vec3 normal ) {
    vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
    vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
    return PI * envMapColor.rgb * envMapIntensity;
}
vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
    vec3 reflectVec = reflect( - viewDir, normal );
    reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
    reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
    vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
    return envMapColor.rgb * envMapIntensity;
}
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
    float dotNV = saturate( dot( normal, viewDir ) );
    const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
    const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
    vec4 r = roughness * c0 + c1;
    float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
    vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
    return fab;
}
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
    vec2 fab = DFGApprox( normal, viewDir, roughness );
    vec3 Fr = specularColor;
    vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
    float Ess = fab.x + fab.y;
    float Ems = 1.0 - Ess;
    vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;
    vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
    singleScatter += FssEss;
    multiScatter += Fms * Ems;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
    vec3 singleScattering = vec3( 0.0 );
    vec3 multiScattering = vec3( 0.0 );
    vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
    computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
    vec3 totalScattering = singleScattering + multiScattering;
    vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );
    reflectedLight.indirectSpecular += radiance * singleScattering;
    reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
    reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
` : ''
}
${irradiance?
`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
vec3 clearcoatRadiance = vec3( 0.0 );
vec3 iblIrradiance = vec3( 0.0 );
vec3 radiance = vec3( 0.0 );
iblIrradiance += getIBLIrradiance( geometryNormal );
radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
RE_IndirectSpecular_Physical( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
` : ''
}
