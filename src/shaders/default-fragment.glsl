#version 300 es
precision mediump float;

${defines}

#define RECIPROCAL_PI 0.3183098861837907

uniform vec3 color;

in vec3 vertex;
in vec3 vNormal;

out vec4 fragColor;


${declarations}

void main() {
    vec3 totalIrradiance = vec3(0.0f);
    ${irradiance}

    //debug normals
    //fragColor = vec4(normalize(vNormal) * 0.5 + 0.5, 1.0);
    fragColor = vec4(RECIPROCAL_PI * color * totalIrradiance, 1.0f);
    ${toneMapping}
}