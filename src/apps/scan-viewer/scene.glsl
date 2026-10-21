layout(std140) uniform Scene {
    // xyz: origin subtracted from data coordinates, w: zScale
    vec4 sceneOriginZScale;
};
