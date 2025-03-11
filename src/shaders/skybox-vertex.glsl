#version 300 es

#define SHADER_NAME skyboxVertex

in vec4 position;
out vec4 v_position;
void main() {
    v_position = position;
    gl_Position = position;
    gl_Position.z = 1.0;
}