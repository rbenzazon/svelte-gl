#version 300 es

precision mediump float;
precision mediump int;

#define MAX_SAMPLES 20

in vec3 vOutputDirection;

uniform sampler2D envMap;

uniform int samples;
uniform float weights[MAX_SAMPLES];
uniform bool latitudinal;
uniform float dTheta;
uniform float mipInt;
uniform vec3 poleAxis;

out vec4 fragColor;

float getFace(vec3 direction) {
    vec3 absDirection = abs(direction);
    float face = -1.0f;
    if(absDirection.x > absDirection.z) {
        if(absDirection.x > absDirection.y)
            face = direction.x > 0.0f ? 0.0f : 3.0f;
        else
            face = direction.y > 0.0f ? 1.0f : 4.0f;
    } else {
        if(absDirection.z > absDirection.y)
            face = direction.z > 0.0f ? 2.0f : 5.0f;
        else
            face = direction.y > 0.0f ? 1.0f : 4.0f;
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

vec3 getSample(float theta, vec3 axis) {
    float cosTheta = cos(theta);
    // Rodrigues' axis-angle rotation
    vec3 sampleDirection = vOutputDirection * cosTheta + cross(axis, vOutputDirection) * sin(theta) + axis * dot(axis, vOutputDirection) * (1.0f - cosTheta);
    return bilinearCubeUV(envMap, sampleDirection, mipInt);
}

void main() {

    vec3 axis = latitudinal ? poleAxis : cross(poleAxis, vOutputDirection);
    if(all(equal(axis, vec3(0.0f)))) {
        axis = vec3(vOutputDirection.z, 0.0f, -vOutputDirection.x);
    }

    axis = normalize(axis);
    fragColor = vec4(0.0f, 0.0f, 0.0f, 1.0f);
    fragColor.rgb += weights[0] * getSample(0.0f, axis);
    for(int i = 1; i < MAX_SAMPLES; i++) {
        if(i >= samples) {
            break;
        }
        float theta = dTheta * float(i);
        fragColor.rgb += weights[i] * getSample(-1.0f * theta, axis);
        fragColor.rgb += weights[i] * getSample(theta, axis);
    }

}