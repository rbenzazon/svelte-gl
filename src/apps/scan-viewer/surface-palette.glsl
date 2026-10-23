${declaration ? `
// written by the surface vertex animation (surface.glsl)
in float vScanHeight;
uniform sampler2D palette;
// maps 0..1 to the first and last texel centers
uniform vec2 paletteRemap;
// real heights, independent of zScale
uniform float colorMin;
uniform float colorMax;
uniform bool hideOutOfRange;

// the palette holds sRGB stops, filtered in sRGB like for the points; lighting needs linear colors
vec3 paletteToLinear(vec3 color) {
    return mix(pow(color * 0.9478672986 + vec3(0.0521327014), vec3(2.4)), color * 0.0773993808, vec3(lessThanEqual(color, vec3(0.04045))));
}
` : ''}
${diffuse ? `
    {
        float norm = (vScanHeight - colorMin) / (colorMax - colorMin);
        if (hideOutOfRange && (norm < 0.0 || norm > 1.0)) {
            discard;
        }
        vec3 paletteColor = texture(palette, vec2(clamp(norm, 0.0, 1.0) * paletteRemap.x + paletteRemap.y, 0.5)).rgb;
        material.diffuseColor *= paletteToLinear(paletteColor);
    }
` : ''}
