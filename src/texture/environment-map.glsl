uniform float envMapIntensity;
uniform float flipEnvMap;
uniform mat3 envMapRotation;
uniform samplerCube envMap;

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
    float filterInt = max( 4.0 - mipInt, 0.0 );
    mipInt = max( mipInt, 4.0 );
    float faceSize = exp2( mipInt );
    highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
    if ( face > 2.0 ) {
        uv.y += faceSize;
        face -= 3.0;
    }
    uv.x += face * faceSize;
    uv.x += filterInt * 3.0 * 16.0;
    uv.y += 4.0 * ( exp2( 8.0 ) - faceSize );
    uv.x *= 0.0013020833333333333;
    uv.y *= 0.0009765625;
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


iblIrradiance += getIBLIrradiance( geometryNormal );
    radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
    