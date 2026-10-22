// Both renderers use the same screen-space wavefront and emergence clock.
// Keeping the optical field shared prevents the glass from moving independently
// of the water that it displaces. No changes to the original Balsa shader.
export const emergenceGLSL = `
vec3 emergenceField(vec2 uv, vec2 center, float aspect, float progress) {
  vec2 delta=(uv-center)*vec2(aspect,1.);
  vec2 ellipse=delta*vec2(.48,1.);
  float distance=length(ellipse);
  float energy=pow(max(0.,sin(clamp(progress,0.,1.)*3.14159265)),1.15);
  float front=distance-(.025+progress*.63);
  float envelope=exp(-front*front*105.)*energy;
  float trailing=exp(-pow(front+.075,2.)*140.)*energy*.24;
  float ripples=sin(front*48.)*envelope+sin((front+.075)*61.)*trailing;
  // Intersecting swells displace the whole submerged silhouette. There is no
  // vertical reveal line: crests and troughs resolve in several places at once.
  float swell=sin(dot(delta,vec2(18.,11.))+progress*7.)*.52
             +sin(dot(delta,vec2(-12.,23.))-progress*5.3)*.31
             +sin(dot(delta,vec2(32.,-9.))+progress*9.1)*.17;
  vec2 direction=normalize(ellipse+vec2(.00001));
  vec2 displacement=direction*ripples*.007;
  displacement+=vec2(swell,cos(dot(delta,vec2(15.,-20.))+progress*6.)*.55)*energy*.008*exp(-dot(delta,delta)*2.);
  return vec3(displacement,cos(front*48.)*envelope*.55+swell*energy*.25);
}`;
