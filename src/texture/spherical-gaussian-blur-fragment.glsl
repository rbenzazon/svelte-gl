#version 300 es

precision mediump float;
precision mediump int;

#define n 20
#define CUBEUV_TEXEL_WIDTH ${CUBEUV_TEXEL_WIDTH}
#define CUBEUV_TEXEL_HEIGHT ${CUBEUV_TEXEL_HEIGHT}
#define CUBEUV_MAX_MIP ${CUBEUV_MAX_MIP}
#define cubeUV_minMipLevel 4.0
#define cubeUV_minTileSize 16.0

in vec3 vOutputDirection;

uniform sampler2D envMap;

uniform int samples;
uniform float weights[n];
uniform bool latitudinal;
uniform float dTheta;
uniform float mipInt;
uniform vec3 poleAxis;

out vec4 fragColor;

float getFace(vec3 direction) {
    vec3 absDirection = abs(direction);
    float face = -1.0;
    if(absDirection.x > absDirection.z) {
        if(absDirection.x > absDirection.y)
            face = direction.x > 0.0 ? 0.0 : 3.0;
        else
            face = direction.y > 0.0 ? 1.0 : 4.0;
    } else {
        if(absDirection.z > absDirection.y)
            face = direction.z > 0.0 ? 2.0 : 5.0;
        else
            face = direction.y > 0.0 ? 1.0 : 4.0;
    }
    return face;
}

// RH coordinate system; PMREM face-indexing convention
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

vec3 getSample(float theta, vec3 axis) {
    float cosTheta = cos(theta);
    // Rodrigues' axis-angle rotation
    vec3 sampleDirection = vOutputDirection * cosTheta
    + cross(axis, vOutputDirection) * sin(theta)
    + axis * dot(axis, vOutputDirection) * (1.0 - cosTheta);
    return bilinearCubeUV(envMap, sampleDirection, mipInt);
}

void main() {

    vec3 axis = latitudinal ? poleAxis : cross(poleAxis, vOutputDirection);
    if(all(equal(axis, vec3(0.0)))) {
        axis = vec3(vOutputDirection.z, 0.0, -vOutputDirection.x);
    }

    axis = normalize(axis);
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    //fragColor = vec4(mipInt/10.0, mipInt/10.0, mipInt/10.0, 1.0f);
    //fragColor = vec4(dTheta*40.0, dTheta*40.0, dTheta*40.0, 1.0f);
    //fragColor.rgb = dTheta;
    //fragColor.rgb += texture(envMap, vOutputDirection.xy).rgb;
    fragColor.rgb += weights[0] * getSample(0.0, axis);
    for(int i = 1; i < n; i++) {
        if(i >= samples) {
            break;
        }
        float theta = dTheta * float(i);
        fragColor.rgb += weights[i] * getSample(-1.0 * theta, axis);
        fragColor.rgb += weights[i] * getSample(theta, axis);
    }
}