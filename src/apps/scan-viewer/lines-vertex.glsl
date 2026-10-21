#version 300 es
precision highp float;

#define SHADER_NAME scanLinesVertex

uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
// data units relative to the scene origin: lineOffset + position * lineScale
uniform vec3 lineOffset;
uniform vec3 lineScale;

in vec3 position;

${scene}

void main() {
    vec3 relative = lineOffset + position * lineScale;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(relative.xy, relative.z * sceneOriginZScale.w, 1.0);
}
