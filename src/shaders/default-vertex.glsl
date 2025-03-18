#version 300 es
precision highp float;
precision highp int;

#define SHADER_NAME defaultVertex
    
in vec3 position;
in vec3 normal;
in vec2 uv;
${instances ?
`
in mat4 modelMatrix;
in mat4 modelViewMatrix;
in mat3 normalMatrix;
` : `
uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat3 normalMatrix;
`}


uniform float time;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;

// Pass the color attribute down to the fragment shader
out vec3 vertexColor;
out vec3 vNormal;
out vec3 vertex;
out vec3 vViewPosition;
out highp vec2 vUv;

${declarations}

void main() {
    vec3 objectNormal = vec3( normal );
    vec3 transformedNormal = objectNormal;
    vec3 animatedPosition = position;
    ${positionModifier}

    vUv = vec3( uv, 1 ).xy;
    // Pass the color down to the fragment shader (debug)
    vertexColor = vec3(1.27,1.27,1.27);
    // Pass the vertex down to the fragment shader TODO, change to support modelViewMatrix
    vertex = vec3(modelMatrix * vec4(animatedPosition, 1.0));

    transformedNormal = normalMatrix * transformedNormal;
    vNormal = normalize( transformedNormal );
    //vNormal = normal;
    vec3 transformed = vec3( animatedPosition );
    vec4 mvPosition = vec4( transformed, 1.0 );
    mvPosition = modelViewMatrix * mvPosition;
    gl_Position = projectionMatrix * mvPosition;
    vViewPosition = -mvPosition.xyz;
}