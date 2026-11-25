/** Shared GLSL chunks. */
export const NOISE = /* glsl */ `
float h13(vec3 p){p=fract(p*.1031);p+=dot(p,p.zyx+31.32);return fract((p.x+p.y)*p.z);}
float vnoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(mix(h13(i),h13(i+vec3(1,0,0)),f.x),mix(h13(i+vec3(0,1,0)),h13(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(h13(i+vec3(0,0,1)),h13(i+vec3(1,0,1)),f.x),mix(h13(i+vec3(0,1,1)),h13(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*vnoise(p);p=p*2.03+vec3(17.1,3.7,9.2);a*=.5;}return s;}
vec3 vnoise3(vec3 p){return vec3(vnoise(p),vnoise(p+vec3(31.4,7.7,19.2)),vnoise(p+vec3(5.1,47.3,71.9)))*2.-1.;}
mat3 rotAxis(vec3 a,float t){float c=cos(t),s=sin(t),o=1.-c;return mat3(o*a.x*a.x+c,o*a.x*a.y+a.z*s,o*a.z*a.x-a.y*s,o*a.x*a.y-a.z*s,o*a.y*a.y+c,o*a.y*a.z+a.x*s,o*a.z*a.x+a.y*s,o*a.y*a.z-a.x*s,o*a.z*a.z+c);}
`;

/** Triplanar helpers. Blend weights sharpened so seams stay out of sight. */
export const TRIPLANAR = /* glsl */ `
vec3 triW(vec3 n){vec3 w=pow(abs(n),vec3(4.));return w/(w.x+w.y+w.z);}
vec4 tri(sampler2D t,vec3 p,vec3 w){return texture2D(t,p.zy)*w.x+texture2D(t,p.xz)*w.y+texture2D(t,p.xy)*w.z;}
vec3 triNormal(sampler2D t,vec3 p,vec3 n,float amt){
  vec3 w=triW(n);
  vec3 x=texture2D(t,p.zy).xyz*2.-1.,y=texture2D(t,p.xz).xyz*2.-1.,z=texture2D(t,p.xy).xyz*2.-1.;
  vec3 d=vec3(0.,x.y,x.x)*w.x+vec3(y.x,0.,y.y)*w.y+vec3(z.x,z.y,0.)*w.z;
  return normalize(n+d*amt);
}
`;

/**
 * One choreography shared by point grounds and instanced grounds:
 * bean volume -> tilted galaxy -> spiral -> funnel wall.
 * Pure function of the scroll uniforms (plus a small idle drift), so it reverses.
 */
export const FUNNEL = /* glsl */ `
const vec3 FUNNEL_AXIS = vec3(0.,0.,-10.);
float funnelR(float y){float s=clamp((y+21.)/16.,0.,1.4);return 1.25+8.2*pow(s,2.1);}
`;

export const GRAIN_PATH = /* glsl */ `
uniform float uBurst,uGather,uSpin,uMelt,uTime;
float gBirth;
float gMelt;
vec3 grainPath(vec3 bean,vec4 r){
  float t=clamp(uBurst*1.55-r.x*.55,0.,1.);
  gBirth=smoothstep(0.,.06,t);
  float e=1.-pow(1.-t,2.4);
  vec3 dir=normalize(bean+vec3(.0001));
  // An oblate, tilted disc rather than a sphere: the cloud has a direction.
  vec3 shape=vec3(1.5,.42,1.15);
  float reach=(1.2+6.2*pow(r.y,1.7))*e;
  vec3 p=bean+normalize(dir*shape+vnoise3(bean*1.7)*.25)*reach;
  float a=e*(1.7-.16*length(p.xz))+uTime*.012*e;
  p.xz=mat2(cos(a),-sin(a),sin(a),cos(a))*p.xz;
  p=rotAxis(vec3(0.,0.,1.),.36*e)*p;
  p+=vnoise3(p*.42+vec3(0.,uBurst*1.5,uTime*.05))*.95*e;
  // Gather: each grain leaves the cloud on its own cue and joins the spiral.
  float g=smoothstep(0.,1.,clamp(uGather*1.7-r.z*.7,0.,1.));
  float lane=fract(r.x*7.31+r.w);
  float fall=fract(r.w+uSpin*.22);
  float y=mix(1.5,-19.5,pow(fall,.8))+(r.y-.5)*.5;
  float R=funnelR(y)*(.97-.30*lane*lane)-.06;
  float ang=r.z*r.z*.5+floor(r.x*5.)*1.2566+(y*-.30)+uSpin*2.1+lane*.42+uTime*.03;
  vec3 q=FUNNEL_AXIS+vec3(cos(ang)*R,y,sin(ang)*R);
  q+=vnoise3(q*.6+uTime*.06)*.22;
  vec3 mid=vec3(-3.5+r.y*7.,-1.-r.x*2.,-4.5);
  p=mix(mix(p,mid,g),mix(mid,q,g),g);
  gMelt=1.-smoothstep(0.,1.,clamp(uMelt*1.6-r.y*.6,0.,1.))*g;
  return p;
}
`;
