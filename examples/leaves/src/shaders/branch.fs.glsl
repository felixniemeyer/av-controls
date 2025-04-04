#version 300 es
precision mediump float;

out vec4 fragColor;

uniform float invLeafScale; 

in vec2 uv; 
in vec3 color; 
in float style; 
in float bowFactor; 

void main() {
  float bow = pow(uv.x - 1.0, 2.); 

  float uvY = uv.y + bow * bowFactor * uv.x * 0.5; 
  float absV = abs(uvY);

  float border = 1. - bow - absV; 
  float alpha = smoothstep(0.3, 0.3 + invLeafScale * 0.1, border);

  vec3 rgb = color * (1. - border * 0.3); 
  rgb += ((bow + absV)) * vec3(0.1, -0.1, 0.1) * 0.5; 

  float darkCorner = uv.x + absV;
  rgb *= (alpha * darkCorner + 1. - darkCorner) - darkCorner * 0.1;

  float center = abs(1. - pow(2. - uv.x, 2.) * 0.5);
  rgb *= 0.5 + 0.5 * smoothstep(0., 0.05 * invLeafScale, absV + center * 0.025 * invLeafScale); 

  // riffel
  rgb += abs(mod((uv.x - absV) * 20., 2.0) - 1.) * (border * 0.1);

  rgb *= 1.5; 

  fragColor = vec4(rgb, alpha); // Unicolored red
}
