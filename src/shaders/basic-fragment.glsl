#version 300 es
precision mediump float;

#define SHADER_NAME basicFragment

// Input from vertex shader
in vec3 vertexColor;
in vec3 vNormal;
in vec3 vertex;
in vec3 vViewPosition;
in highp vec2 vUv;

// Output color
out vec4 fragColor;

void main() {
    // Simply use the vertex color for the fragment color
    // This will create a simple colored line with no lighting effects
    fragColor = vec4(vertexColor, 1.0);
    
    // Alternative: if you want slightly smoother lines with anti-aliasing
    // float intensity = 1.0;
    // fragColor = vec4(vertexColor * intensity, 1.0);
}