#version 300 es
precision highp float;
precision highp int;

#define SHADER_NAME scanPointsVertex

uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
// px times device pixel ratio
uniform float pointSize;
${palette ? `
uniform sampler2D palette;
// maps 0..1 to the first and last texel centers
uniform vec2 paletteRemap;
// real heights, independent of zScale
uniform float colorMin;
uniform float colorMax;
uniform bool hideOutOfRange;
` : `
uniform vec3 pointColor;
`}
${cloud ? `
// interleaved xyz of the cloud, relative to its origin
in vec3 position;
// cloud origin minus scene origin
uniform vec3 cloudOffset;
` : ''}

out vec3 vColor;

${declarations}

void main() {
    ${cloud ? `
    vec3 relative = position + cloudOffset;
    // real height
    float h = relative.z + sceneOriginZScale.z;
    vec3 scenePosition = vec3(relative.xy, relative.z * sceneOriginZScale.w);
    bool dropped = any(isnan(position));
    ` : `
    int columns = textureSize(heightTexture, 0).x;
    ivec2 texel = ivec2(gl_VertexID % columns, gl_VertexID / columns);
    float h = heightAt(texel);
    vec3 scenePosition = gridPosition(texel, h);
    bool dropped = isnan(h);
    `}
    ${palette ? `
    float norm = (h - colorMin) / (colorMax - colorMin);
    dropped = dropped || (hideOutOfRange && (norm < 0.0 || norm > 1.0));
    vColor = texture(palette, vec2(clamp(norm, 0.0, 1.0) * paletteRemap.x + paletteRemap.y, 0.5)).rgb;
    ` : `
    vColor = pointColor;
    `}
    if (dropped) {
        // outside the clip volume, so the point is dropped
        gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
        gl_PointSize = 0.0;
        return;
    }
    gl_Position = projectionMatrix * modelViewMatrix * vec4(scenePosition, 1.0);
    // Sits exactly on a vertex of the surface of the same data: a small depth bias (about 0.1% of the
    // distance with the viewer's near plane) wins the depth test without moving the point on screen.
    gl_Position.z -= 2e-5 * gl_Position.w;
    gl_PointSize = pointSize;
}
