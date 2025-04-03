#version 300 es
precision mediump float;

out vec4 fragColor;

in vec2 uv; 

void main() {

  float absV = abs(uv.y);

  float border = 1. - pow(uv.x - 1.0, 2.) - absV; 
  float alpha = smoothstep(0.4, 0.5, border);

  vec3 rgb = vec3(0.01, 0.2, 0.05) + vec3(0.05, 0.3, 0.1) * border * 0.5; 

  // riffel
  rgb += abs(mod((uv.x - absV) * 20., 2.0) - 1.) * vec3(0.2, 0.2, 0.1) * 0.3; 

  fragColor = vec4(rgb, alpha); // Unicolored red
}
