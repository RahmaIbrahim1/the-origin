import { PlaneGeometry, Mesh, MeshBasicMaterial, BackSide, Color } from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { NOISE } from '../utils/glsl.js';
import { Q } from '../quality.js';

/** Still black coffee: planar reflection, rippled, with Fresnel falloff and distance fade. */
export function createPool() {
  const shader = {
    name: 'CoffeePool',
    uniforms: {
      color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null },
      uTime: { value: 0 }, uRipple: { value: 1 }, uLight: { value: 0 },
    },
    vertexShader: `uniform mat4 textureMatrix;varying vec4 vR;varying vec3 vW;
      void main(){vR=textureMatrix*vec4(position,1.);vW=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.);}`,
    fragmentShader: `uniform sampler2D tDiffuse;uniform float uTime,uRipple,uLight;varying vec4 vR;varying vec3 vW;${NOISE}
      float hgt(vec2 p){
        float r=length(p);
        float w=sin(r*8.5-uTime*1.5)*exp(-r*.55)*.5*uRipple;
        return w*.05+(fbm(vec3(p*1.1,uTime*.12))-.5)*.10*(.3+uRipple)+(vnoise(vec3(p*5.,uTime*.25))-.5)*.008;}
      void main(){
        vec2 p=vW.xz;float e=.02;
        float h0=hgt(p);vec3 n=normalize(vec3(h0-hgt(p+vec2(e,0.)),e,h0-hgt(p+vec2(0.,e))));
        vec3 V=normalize(cameraPosition-vW);
        float f=.03+.97*pow(1.-clamp(dot(n,V),0.,1.),4.);
        vec2 uv=vR.xy/vR.w+n.xz*.10;
        vec3 refl=(texture2D(tDiffuse,uv).rgb*2.+texture2D(tDiffuse,uv+vec2(.004,.002)).rgb+texture2D(tDiffuse,uv-vec2(.004,-.003)).rgb)*.25;
        float r=length(p);
        vec3 H=normalize(V+normalize(vec3(-.35,.5,-.9)));
        float sp=pow(max(dot(n,H),0.),140.);
        vec3 body=vec3(.0105,.0042,.0018)+vec3(.05,.019,.005)*exp(-r*.5)*uLight;
        vec3 col=body+refl*f*1.1+vec3(1.,.55,.22)*sp*.22*uLight*exp(-r*.2);
        col*=smoothstep(15.,3.,r);
        gl_FragColor=vec4(col,1.);
      }`,
  };
  const pool = new Reflector(new PlaneGeometry(40, 40), {
    shader, textureWidth: Q.reflect, textureHeight: Q.reflect, clipBias: 0.002, multisample: 0,
  });
  pool.rotation.x = -Math.PI / 2;

  const under = new Mesh(new PlaneGeometry(40, 40), new MeshBasicMaterial({ color: new Color(0.012, 0.0045, 0.0016), side: BackSide }));
  under.rotation.x = -Math.PI / 2; under.position.y = -0.004;
  return { pool, under, u: pool.material.uniforms };
}
