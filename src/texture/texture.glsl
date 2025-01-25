${declaration?
`
uniform sampler2D ${mapType};
` : ''
}
${declarationNormal?
`
uniform vec2 normalScale;
mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
    vec3 q0 = dFdx( eye_pos.xyz );
    vec3 q1 = dFdy( eye_pos.xyz );
    vec2 st0 = dFdx( uv.st );
    vec2 st1 = dFdy( uv.st );
    vec3 N = surf_norm;
    vec3 q1perp = cross( q1, N );
    vec3 q0perp = cross( N, q0 );
    vec3 T = q1perp * st0.x + q0perp * st1.x;
    vec3 B = q1perp * st0.y + q0perp * st1.y;
    float det = max( dot( T, T ), dot( B, B ) );
    float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
    return mat3( T * scale, B * scale, N );
}
` : ''
}
${diffuseMapSample?
`
    //atan(uv.y, uv.x)
    ${coordinateSpace === 'circular' ?
`   vec2 uv = vec2(vUv.x/vUv.y, vUv.y);
` :
`   vec2 uv = vUv;
`}
    vec4 textureColor = texture( ${mapType}, uv );
    material.diffuseColor *= textureColor.rgb;
    material.diffuseAlpha = textureColor.a;
    
` : ''
}
${normalMapSample?
`
    mat3 tbn =  getTangentFrame( -vViewPosition, vNormal, vUv );
    normal = texture( normalMap, vUv ).xyz * 2.0 - 1.0;
    normal.xy *= normalScale;
    normal = normalize(tbn * normal);
	//normal = normalize( normalMatrix * normal );
` : ''
}
