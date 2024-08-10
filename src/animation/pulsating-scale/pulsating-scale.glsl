${declaration ? `
// Adjust the frequency of the pulsating scale
uniform float pScaleFrequency;
// Adjust the minimum scale of the pulsating scale
uniform float pScaleMinScale;
// Adjust the maximum scale of the pulsating scale
uniform float pScaleMaxScale;

vec3 getPulsatingScale(vec3 position) {
    return position * vec3(1.0+pScaleMinScale+(sin(time* pScaleFrequency) ) * pScaleMaxScale/2.0 );
}
` : ''}
${position ? `
    animatedPosition = getPulsatingScale(animatedPosition);
` : ''}