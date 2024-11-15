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
	for (int i = 0; i < kernelWidth; i++) {
		fragColor += texture(
			sampler,
			vTexCoord + offsetAndScale[i].x * uvStride
		    //   ^------------------------------------  UV coord for this fragment
		    //              ^-------------------------  Offset to sample (in texel space)
		    //                                  ^-----  Amount to move in UV space per texel (horizontal OR vertical only)
		    //   v------------------------------------  Scale down the sample
		) * offsetAndScale[i].y;
	}
}