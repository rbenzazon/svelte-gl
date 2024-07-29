#version 300 es
precision mediump float;
    
in vec3 position;
in vec3 normal;

in mat4 world;
in mat4 normalMatrix;

uniform mat4 view;
uniform mat4 projection;

// Pass the color attribute down to the fragment shader
out vec3 vertexColor;
out vec3 vNormal;
out vec3 vertex;

void main() {
    // Pass the color down to the fragment shader
    vertexColor = vec3(1.27,1.27,1.27);
    // Pass the vertex down to the fragment shader
    //vertex = vec3(world * vec4(position, 1.0));
    vertex = vec3(world * vec4(position, 1.0));
    // Pass the normal down to the fragment shader
    vNormal = vec3(normalMatrix * vec4(normal, 1.0));
    //vNormal = normal;
    
    // Pass the position down to the fragment shader
    gl_Position = projection * view * world * vec4(position, 1.0);
}