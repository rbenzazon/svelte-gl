${declaration?
`
uniform sampler2D ${mapType};
` : ''
}
${diffuseMapSample?
`
    material.diffuseColor *= texture( ${mapType}, vUv ).xyz;
` : ''
}
