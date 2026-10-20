#version 300 es
precision highp float;
precision highp int;

#define SHADER_NAME scanPointsVertex

uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
// px times device pixel ratio
uniform float pointSize;

${heightGrid}

void main() {
    int columns = textureSize(heightTexture, 0).x;
    ivec2 texel = ivec2(gl_VertexID % columns, gl_VertexID / columns);
    float h = heightAt(texel);
    if (isnan(h)) {
        // outside the clip volume, so the point is dropped
        gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
        gl_PointSize = 0.0;
        return;
    }
    gl_Position = projectionMatrix * modelViewMatrix * vec4(gridPosition(texel, h), 1.0);
    // Sits exactly on a vertex of the surface of the same data: a small depth bias (about 0.1% of the
    // distance with the viewer's near plane) wins the depth test without moving the point on screen.
    gl_Position.z -= 2e-5 * gl_Position.w;
    gl_PointSize = pointSize;
}
