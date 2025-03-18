${declaration?
`
#ifndef saturate
    #define saturate( a ) clamp( a, 0.0, 1.0 )
#endif

float toneMappingExposure = ${exposure};

vec3 NeutralToneMapping( vec3 color ) {
    const float StartCompression = 0.8 - 0.04;
    const float Desaturation = 0.15;
    color *= toneMappingExposure;
    float x = min( color.r, min( color.g, color.b ) );
    float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
    color -= offset;
    float peak = max( color.r, max( color.g, color.b ) );
    if ( peak < StartCompression ) return color;
    float d = 1. - StartCompression;
    float newPeak = 1. - d * d / ( peak + d - StartCompression );
    color *= newPeak / peak;
    float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
    return mix( color, vec3( newPeak ), g );
}
` : ''
}
${color?
`
    fragColor = vec4(NeutralToneMapping(fragColor.rgb),1.0f);
` : ''
}