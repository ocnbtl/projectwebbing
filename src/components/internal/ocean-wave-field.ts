// World X/Z and seconds. Linear deep-water dispersion guides the offshore
// field; the authored surf envelope is not a bathymetric fluid simulation.
export const OCEAN_WAVE_FIELD = `
  uniform float uWaveTime;
  uniform float uMeshSpacing;
  float oceanCoast(vec2 p) {
    return -690.0 + sin(p.y * 0.012 + 0.8) * 18.0
      + sin(p.y * 0.029 - 1.3) * 7.5
      + sin(p.y * 0.061 + 0.35) * 2.8;
  }
  vec3 swell(vec2 p, vec2 k, float amplitude, float offset) {
    float magnitude = length(k);
    float phase = dot(p, k) - sqrt(9.81 * magnitude) * uWaveTime + offset;
    // Displacement must resolve on the selected mesh, including compact LOD.
    float resolved = 1.0 - smoothstep(2.0, 3.0, magnitude * uMeshSpacing);
    return vec3(sin(phase), k * cos(phase)) * amplitude * resolved;
  }
  vec3 oceanSwell(vec2 p) {
    return swell(p, vec2(0.067, -0.0209), 0.62, 0.8)
      + swell(p, vec2(0.0399, 0.0266), 0.32, 1.7)
      + swell(p, vec2(0.102, 0.048), 0.13, 4.2)
      + swell(p, vec2(0.15, -0.08), 0.045, 2.4)
      + swell(p, vec2(0.0279, -0.0279), 0.38, -0.9)
      + swell(p, vec2(0.067, 0.077), 0.085, 5.3);
  }
  float surfPhase(vec2 p, float distance) {
    // Increasing phase carries crests toward smaller offshore distance.
    return distance * 0.22 + uWaveTime * 0.72
      + sin(p.y * 0.021) * 0.6 + sin(p.y * 0.053) * 0.24;
  }
  float surfEnvelope(float distance) {
    return smoothstep(1.0, 12.0, distance)
      * (1.0 - smoothstep(40.0, 78.0, distance));
  }
`;

// Fragment derivatives fade each unresolved frequency continuously instead of
// switching fine water normals off at a fixed distance from the camera.
export const OCEAN_WIND_NORMAL = `
  vec2 oceanWindSlope(vec2 p) {
    vec2 slope = vec2(0.0);
    for (int i = 0; i < 7; i++) {
      float index = float(i);
      float angle = -0.35 + sin(index * 2.399) * 0.64;
      vec2 direction = vec2(cos(angle), sin(angle));
      float k = 0.18 * pow(1.63, index);
      float phase = dot(p, direction) * k - sqrt(9.81 * k) * uWaveTime + index * 1.71;
      float footprint = fwidth(phase);
      float resolved = exp(-0.35 * footprint * footprint);
      slope += direction * cos(phase) * 0.026 * pow(0.86, index) * resolved;
    }
    return slope;
  }
`;
