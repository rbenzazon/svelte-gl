${declaration ? `
uniform highp sampler2D surfaceHeights;
// x0, y0, dx, dy of the height grid
uniform vec4 surfaceGrid;
layout(std140) uniform Scene {
    // xyz: origin subtracted from data coordinates, w: zScale
    vec4 sceneOriginZScale;
};

// two counter-clockwise triangles per grid cell
const ivec2 surfaceCorners[6] = ivec2[6](ivec2(0, 0), ivec2(1, 0), ivec2(0, 1), ivec2(1, 0), ivec2(1, 1), ivec2(0, 1));

float surfaceHeight(ivec2 texel) {
    return texelFetch(surfaceHeights, clamp(texel, ivec2(0), textureSize(surfaceHeights, 0) - 1), 0).r;
}

float surfaceNeighbor(ivec2 texel, float fallback) {
    float h = surfaceHeight(texel);
    return isnan(h) ? fallback : h;
}
` : ''}
${position ? `
    {
        int cells = textureSize(surfaceHeights, 0).x - 1;
        int cell = gl_VertexID / 6;
        int corner = gl_VertexID % 6;
        ivec2 cellTexel = ivec2(cell % cells, cell / cells);
        ivec2 texel = cellTexel + surfaceCorners[corner];
        int first = corner / 3 * 3;
        // all three vertices of a triangle touching NaN collapse to one point, so it draws nothing
        bool hole = isnan(surfaceHeight(cellTexel + surfaceCorners[first]))
            || isnan(surfaceHeight(cellTexel + surfaceCorners[first + 1]))
            || isnan(surfaceHeight(cellTexel + surfaceCorners[first + 2]));
        float h = surfaceHeight(texel);
        float zScale = sceneOriginZScale.w;
        vec2 xy = surfaceGrid.xy + vec2(texel) * surfaceGrid.zw;
        animatedPosition = hole ? vec3(0.0) : vec3(xy - sceneOriginZScale.xy, (h - sceneOriginZScale.z) * zScale);
        float dzdx = (surfaceNeighbor(texel + ivec2(1, 0), h) - surfaceNeighbor(texel - ivec2(1, 0), h)) * zScale / (2.0 * surfaceGrid.z);
        float dzdy = (surfaceNeighbor(texel + ivec2(0, 1), h) - surfaceNeighbor(texel - ivec2(0, 1), h)) * zScale / (2.0 * surfaceGrid.w);
        transformedNormal = normalize(vec3(-dzdx, -dzdy, 1.0));
    }
` : ''}
