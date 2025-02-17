#version 300 es
precision mediump float;
    
in vec3 position;
in vec3 normal;
in vec2 uv;
${instances ?
`
in mat4 world;
in mat4 normalMatrix;
` : `
uniform mat4 world;
uniform mat4 normalMatrix;
`}


uniform float time;
uniform mat4 view;
uniform mat4 projection;

// Pass the color attribute down to the fragment shader
out vec3 vertexColor;
out vec3 vNormal;
out vec3 vertex;
out vec3 vViewPosition;
out highp vec2 vUv;

${declarations}

void main() {
    vec3 modifiedNormal = normal;
    vec3 animatedPosition = position;
    ${positionModifier}

    vUv = vec3( uv, 1 ).xy;
    // Pass the color down to the fragment shader
    vertexColor = vec3(1.27,1.27,1.27);
    // Pass the vertex down to the fragment shader
    //vertex = vec3(world * vec4(position, 1.0));
    vertex = vec3(world * vec4(animatedPosition, 1.0));
    // Pass the normal down to the fragment shader
    // todo : use modifiedNormal when effect is done
    vNormal = vec3(normalMatrix * vec4(modifiedNormal , 1.0));
    //vNormal = normal;
    
    // Pass the position down to the fragment shader
    gl_Position = projection * view * world * vec4(animatedPosition, 1.0);
    vViewPosition = -gl_Position.xyz;
}