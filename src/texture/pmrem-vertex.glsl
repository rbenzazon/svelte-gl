#version 300 es

precision mediump float;
precision mediump int;

in vec3 position;
in vec2 uv;
in float faceIndex;

out vec3 vOutputDirection;

// RH coordinate system; PMREM face-indexing convention
vec3 getDirection(vec2 uv, float face) {

    uv = 2.0 * uv - 1.0;

    vec3 direction = vec3(uv, 1.0);

    if(face == 0.0) {
        // 0 0 0
        // X 0 0
        direction = direction.zyx; // ( 1, v, u ) pos x
        direction.y *= -1.0;

    } else if(face == 1.0) {
        //0 0 0
        //0 X 0
        direction = direction.xzy;
        direction.xyz *= -1.0; // ( -u, 1, -v ) pos y

    } else if(face == 2.0) {
        //0 0 0
        //0 0 X
        direction.x *= -1.0; // ( -u, v, 1 ) pos z
        direction.y *= -1.0;

    } else if(face == 3.0) {
        // X 0 0
        // 0 0 0
        direction = direction.zyx;
        direction.xyz *= -1.0; // ( -1, v, -u ) neg x

    } else if(face == 4.0) {
        //0 X 0
        //0 0 0
        direction = direction.xzy;
        direction.x *= -1.0; // ( -u, -1, v ) neg y

    } else if(face == 5.0) {
        //0 0 X
        //0 0 0
        direction.zy *= -1.0; // ( u, v, -1 ) neg z
    }

    return direction;

}

void main() {

    vOutputDirection = getDirection(uv, faceIndex);
    gl_Position = vec4(position, 1.0);

}