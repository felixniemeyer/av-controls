#version 300 es
precision mediump float;

in vec2 position; // Vertex position
in vec4 posRotScale; // Instance data: x, y, angle, scale
in vec4 colorAndStyle; 

uniform vec2 worldScale; // Projection matrix

uniform float wiggleFrequency; // has to compensate for leafScale
uniform float leafScale; 

out vec2 uv; 
out vec3 color; 
out float bowFactor; 

void main() {
    vec2 instancePosition = posRotScale.xy;
    float angle = posRotScale.z;
    float scale = posRotScale.w;

    color = colorAndStyle.xyz; 
    float style = colorAndStyle.a; 

    bowFactor = sin(scale * wiggleFrequency) * 0.3; 

    // Apply translation
    uv = position; 
    // uv.y *= style + 1.; 
    vec2 pos = position; // Declare pos variable

    float cosAngle = cos(angle);
    float sinAngle = sin(angle);
    mat2 rotationMatrix = mat2(cosAngle, -sinAngle, sinAngle, cosAngle);


    pos = rotationMatrix * pos;
    pos *= scale * leafScale;
    pos += instancePosition; 

    // Set the final position
    gl_Position = vec4(worldScale * pos, 0.0, 1.0);
}