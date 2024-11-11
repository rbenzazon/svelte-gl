#version 300 es
#pragma vscode_glsllint_stage: vert

layout(location=0) in vec4 aPosition;
layout(location=1) in vec2 aTexCoord;

out vec2 vTexCoord;

void main()
{
    gl_Position = aPosition;
    vTexCoord = aTexCoord;
}