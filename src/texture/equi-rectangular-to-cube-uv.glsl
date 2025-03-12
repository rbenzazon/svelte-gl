#version 300 es

precision mediump float;
precision mediump int;

#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535

uniform float flipEnvMap;

in vec3 vOutputDirection;

uniform sampler2D skyBox;

out vec4 fragColor;

vec2 equirectUv( in vec3 dir ) {
    float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
    float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
    return vec2( u, v );
}

void main() {
    vec3 outputDirection = normalize( vOutputDirection );
    vec2 uv = equirectUv( outputDirection );
    fragColor = vec4( texture ( skyBox, uv ).rgb, 1.0 );
}