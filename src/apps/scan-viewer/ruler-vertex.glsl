#version 300 es
precision highp float;
precision highp int;

#define SHADER_NAME scanRulerVertex

uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
// all in data units relative to the scene origin, z not yet scaled
// axis line ends
uniform vec3 rulerFrom;
uniform vec3 rulerTo;
// first minor tick and the step between two ticks
uniform vec3 rulerStart;
uniform vec3 rulerStep;
// major tick, minor ticks are half as long
uniform vec3 rulerTick;
// a tick is major when (rulerFirstIndex + tick) % rulerMajorEvery == 0
uniform int rulerFirstIndex;
uniform int rulerMajorEvery;

${scene}

// vertices 0 and 1: the axis line; then two vertices per tick
void main() {
    vec3 relative;
    if (gl_VertexID < 2) {
        relative = gl_VertexID == 0 ? rulerFrom : rulerTo;
    } else {
        int tick = (gl_VertexID - 2) / 2;
        bool major = (rulerFirstIndex + tick) % rulerMajorEvery == 0;
        relative = rulerStart + rulerStep * float(tick);
        if (gl_VertexID % 2 == 1) {
            relative += rulerTick * (major ? 1.0 : 0.5);
        }
    }
    gl_Position = projectionMatrix * modelViewMatrix * vec4(relative.xy, relative.z * sceneOriginZScale.w, 1.0);
}
