#version 300 es
precision highp float;

#define SHADER_NAME skyboxFragment

uniform samplerCube skybox;
uniform mat4 viewDirectionProjectionInverse;

${declarations}
  
in vec4 v_position;
  
// we need to declare an output for the fragment shader
out vec4 fragColor;
vec4 sRGBTransferOETF( in vec4 value ) {
  return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}
void main() {
  vec4 t = viewDirectionProjectionInverse * v_position;
  fragColor = texture(skybox, normalize(t.xyz / t.w));
  ${toneMappings}
  fragColor = sRGBTransferOETF(fragColor);
}