#version 300 es

precision mediump float;
precision mediump int;

uniform float flipEnvMap;

in vec3 vOutputDirection;

uniform samplerCube skyBox;

out vec4 fragColor;

void main() {

    fragColor = texture(skyBox, vec3(flipEnvMap * vOutputDirection.x, vOutputDirection.yz));

}