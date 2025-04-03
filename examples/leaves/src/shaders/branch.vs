#version 300 es
precision mediump float;

in vec2 position; // Vertex position
in vec4 posRotScale; // Instance data: x, y, angle, scale

uniform vec2 worldScale; // Projection matrix

out vec2 uv; 

void main() {
    // Apply translation
    vec2 instancePosition = posRotScale.xy;
    float angle = posRotScale.z;
    float scale = posRotScale.w;

    uv = position; 
    vec2 pos = position; // Declare pos variable

    float cosAngle = cos(angle);
    float sinAngle = sin(angle);
    mat2 rotationMatrix = mat2(cosAngle, -sinAngle, sinAngle, cosAngle);

    pos = rotationMatrix * pos;
    pos *= scale;
    pos += instancePosition; 

    // Set the final position
    gl_Position = vec4(worldScale * pos, 0.0, 1.0);
}