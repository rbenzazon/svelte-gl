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
${normalMapSample?
`
    normal = texture( normalMap, vUv ).xyz * 2.0 - 1.0;
    normal.xy *= -3.0;
    normal = normalize(normal + vNormal);
	//normal = normalize( normalMatrix * normal );
` : ''
}
