#version 300 es
precision highp float;
  
uniform samplerCube skybox;
uniform mat4 viewDirectionProjectionInverse;
  
in vec4 v_position;
  
// we need to declare an output for the fragment shader
out vec4 outColor;
  
void main() {
  vec4 t = viewDirectionProjectionInverse * v_position;
  outColor = texture(skybox, normalize(t.xyz / t.w));
}