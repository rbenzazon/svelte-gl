uniform highp sampler2D heightTexture;
// x0, y0, dx, dy of the height grid
uniform vec4 heightGrid;

float heightAt(ivec2 texel) {
    return texelFetch(heightTexture, clamp(texel, ivec2(0), textureSize(heightTexture, 0) - 1), 0).r;
}

// position relative to the scene origin, z scaled
vec3 gridPosition(ivec2 texel, float h) {
    vec2 xy = heightGrid.xy + vec2(texel) * heightGrid.zw;
    return vec3(xy - sceneOriginZScale.xy, (h - sceneOriginZScale.z) * sceneOriginZScale.w);
}
