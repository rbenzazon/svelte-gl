#version 300 es

precision mediump float;

uniform sampler2D sampler;
uniform vec2 uvStride;
uniform vec2[128] offsetAndScale; // x=offset, y=scale
uniform int kernelWidth;

in vec2 vTexCoord;

out vec4 fragColor;

void main()
{
	//fragColor = vec4(vec3(vTexCoord.y),1.0);
	//fragColor += vec4(vec3(texture(sampler,vTexCoord).w),1.0);
	for (int i = 0; i < kernelWidth; i++) {

		fragColor += texture(
			sampler,
			vTexCoord + offsetAndScale[i].x * uvStride
		    //   ^------------------------------------  UV coord for this fragment
		    //              ^-------------------------  Offset to sample (in texel space)
		    //                                  ^-----  Amount to move in UV space per texel (horizontal OR vertical only)
		    //   v------------------------------------  Scale down the sample
		) * offsetAndScale[i].y;

		//fragColor += vec4(vec3(0.01),1.0);
	}
	//float value = offsetAndScale[int(vTexCoord.x)].x;
	//fragColor = vec4(vec3(offsetAndScale[8].x/12.0),1.0);
	//fragColor = vec4(offsetAndScale[32].x,offsetAndScale[32].x,offsetAndScale[32].x,1.0);//texture(sampler,vTexCoord);
}