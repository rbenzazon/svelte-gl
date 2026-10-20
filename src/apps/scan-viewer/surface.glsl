${declaration ? `
// two counter-clockwise triangles per grid cell
const ivec2 surfaceCorners[6] = ivec2[6](ivec2(0, 0), ivec2(1, 0), ivec2(0, 1), ivec2(1, 0), ivec2(1, 1), ivec2(0, 1));

float surfaceNeighbor(ivec2 texel, float fallback) {
    float h = heightAt(texel);
    return isnan(h) ? fallback : h;
}
` : ''}
${position ? `
    {
        int cells = textureSize(heightTexture, 0).x - 1;
        int cell = gl_VertexID / 6;
        int corner = gl_VertexID % 6;
        ivec2 cellTexel = ivec2(cell % cells, cell / cells);
        ivec2 texel = cellTexel + surfaceCorners[corner];
        int first = corner / 3 * 3;
        // all three vertices of a triangle touching NaN collapse to one point, so it draws nothing
        bool hole = isnan(heightAt(cellTexel + surfaceCorners[first]))
            || isnan(heightAt(cellTexel + surfaceCorners[first + 1]))
            || isnan(heightAt(cellTexel + surfaceCorners[first + 2]));
        float h = heightAt(texel);
        float zScale = sceneOriginZScale.w;
        animatedPosition = hole ? vec3(0.0) : gridPosition(texel, h);
        float dzdx = (surfaceNeighbor(texel + ivec2(1, 0), h) - surfaceNeighbor(texel - ivec2(1, 0), h)) * zScale / (2.0 * heightGrid.z);
        float dzdy = (surfaceNeighbor(texel + ivec2(0, 1), h) - surfaceNeighbor(texel - ivec2(0, 1), h)) * zScale / (2.0 * heightGrid.w);
        transformedNormal = normalize(vec3(-dzdx, -dzdy, 1.0));
    }
` : ''}
