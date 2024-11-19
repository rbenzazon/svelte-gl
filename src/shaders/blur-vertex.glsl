#version 300 es

in vec4 position;
in vec2 uv;

out vec2 vTexCoord;

void main()
{
    gl_Position = position;
    vTexCoord = aTexCoord;
}