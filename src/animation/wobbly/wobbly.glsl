${declaration ? `
// Adjust the frequency of the wave
uniform float wobblyFrequency;
// Adjust the amplitude of the wave
uniform float wobblyAmplitude;

vec3 getWobblyPosition(vec3 position) {
    return position + vec3(sin((time+position.y*1.0/wobblyFrequency) * wobblyFrequency) * wobblyAmplitude,0.0, 0.0);
}
` : ''}
${position ? `
    animatedPosition = getWobblyPosition(animatedPosition);
` : ''}