#version 300 es
precision highp float;

#define SHADER_NAME skyboxFragment

uniform samplerCube skybox;
uniform mat4 viewDirectionProjectionInverse;

${declarations}
  
in vec4 v_position;
  
// we need to declare an output for the fragment shader
out vec4 fragColor;
  
void main() {
  vec4 t = viewDirectionProjectionInverse * v_position;
  fragColor = texture(skybox, normalize(t.xyz / t.w));
  ${toneMappings}
}