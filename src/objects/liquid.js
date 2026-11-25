import { BufferGeometry, BufferAttribute, Mesh, MeshPhysicalMaterial, DoubleSide, Vector3, Color } from 'three';
import { NOISE, FUNNEL } from '../utils/glsl.js';
import { Q } from '../quality.js';
import { rng } from '../utils/math.js';

const LIQUID_FRAG = /* glsl */ `
  // Dense body, with crema-amber only where light would pass through thin edges.
  float fres=pow(1.-abs(dot(normalize(vViewPosition),normal)),3.);
  totalEmissiveRadiance+=vec3(.085,.026,.005)*fres*uAmber+vec3(.045,.014,.003)*vCrest*uAmber;
`;

/** Coffee warms everything it reflects. */
const TINT = 'vec3(1.,.80,.56)';

const liquidMaterial = (env) => new MeshPhysicalMaterial({
  color: new Color(0.034, 0.0125, 0.005), roughness: 0.2, metalness: 0, envMap: env, envMapIntensity: 1,
  clearcoat: 0.3, clearcoatRoughness: 0.14, side: DoubleSide, specularIntensity: 0.7,
});

/** The vortex: a polar sheet whose swirl, arms and ripples live in the vertex shader. */
export function createFunnel(env) {
  const [na, ns] = Q.liquid;
  const pos = new Float32Array((na + 1) * (ns + 1) * 3), idx = [];
  let i = 0;
  for (let s = 0; s <= ns; s++) for (let a = 0; a <= na; a++) { pos[i++] = (a / na) * Math.PI * 2; pos[i++] = s / ns; pos[i++] = 0; }
  for (let s = 0; s < ns; s++) for (let a = 0; a < na; a++) {
    const k = s * (na + 1) + a;
    idx.push(k, k + 1, k + na + 1, k + 1, k + na + 2, k + na + 1);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  // Replaced in the shader, but three falls back to flat shading without it.
  g.setAttribute('normal', new BufferAttribute(new Float32Array(pos.length), 3));
  g.setIndex(idx);
  const u = { uTime: { value: 0 }, uSpin: { value: 0 }, uLiquid: { value: 0 }, uAmber: { value: 1 }, uCalm: { value: 0 } };
  const mat = liquidMaterial(env);
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime,uSpin,uCalm;varying vec3 vLP;varying float vS;varying float vCrest;
        ${NOISE}${FUNNEL}
        float gW;
        vec3 surf(float a,float s){
          float y,R;
          if(s<.07){y=-21.;R=1.25*s/.07;}else{float q=(s-.07)/.93;y=mix(-21.,.9,pow(q,1.15));R=funnelR(y);}
          float turn=uSpin*2.1+uTime*.16;
          float b=a-turn+y*.34;
          float arms=sin(b*3.+sin(y*.5)*1.2)*.5+sin(b*5.+y*.9+uTime*.2)*.28+sin(b*9.-y*1.7)*.12;
          vec3 q3=vec3(cos(b)*2.2,sin(b)*2.2,y*.35);
          float n=fbm(q3*1.35+vec3(0.,0.,uTime*.1))-.5;
          float n2=vnoise(q3*vec3(4.,4.,3.)+uTime*.15)-.5;
          float k=smoothstep(.0,.3,s)*(1.-.5*uCalm);
          gW=(arms*.30+n*.9+n2*.13)*k;
          float amp=gW*(.14+R*.115);
          R-=amp;
          float rip=sin(R*9.-uTime*1.4)*.018*(1.-smoothstep(.05,.12,s))*(1.-.6*uCalm);
          y+=rip-amp*.25;
          return FUNNEL_AXIS+vec3(cos(a)*R,y,sin(a)*R);
        }`)
      .replace('#include <beginnormal_vertex>', `
        float sa=position.x,ss=position.y,ee=.004;
        vec3 p0=surf(sa,ss);float cw=gW;vec3 pa=surf(sa+ee*3.,ss);vec3 ps=surf(sa,ss+ee);
        vec3 objectNormal=normalize(cross(pa-p0,ps-p0)+vec3(0.,1e-7,0.));
        if(ss<.012)objectNormal=vec3(0.,1.,0.);
        if(dot(objectNormal,vec3(FUNNEL_AXIS.x,p0.y+2.,FUNNEL_AXIS.z)-p0)<0.)objectNormal=-objectNormal;
        vCrest=smoothstep(.12,.5,cw);`)
      .replace('#include <begin_vertex>', 'vec3 transformed=p0;vLP=p0;vS=ss;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uTime,uLiquid,uAmber,uSpin;varying vec3 vLP;varying float vS;varying float vCrest;${NOISE}`)
      .replace('#include <map_fragment>', `
        float form=fbm(vLP*.55+vec3(0.,uSpin*.6,0.))*.8+vS*.55;
        float cut=uLiquid*1.6;if(form>cut)discard;
        float lip=smoothstep(.022,.0,cut-form)*step(uLiquid,.99);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.13,.052,.019),vCrest*.35);
        diffuseColor.rgb*=smoothstep(0.,.12,vS)*.8+.2;`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor=roughness+.20*lip;')
      // The sheet is single-walled; keep normals facing into the funnel on both sides.
      .replace('#include <normal_fragment_begin>', 'float faceDirection=gl_FrontFacing?1.:-1.;vec3 normal=normalize(vNormal);vec3 nonPerturbedNormal=normal;')
      .replace('#include <normal_fragment_maps>', `
        {vec3 q=vLP*2.4+vec3(0.,uTime*.12,0.);vec3 m=vnoise3(q)*.5+vnoise3(q*2.6)*.25;
         normal=normalize(normal+(viewMatrix*vec4(m,0.)).xyz*.11);}`)
      .replace('#include <emissivemap_fragment>', LIQUID_FRAG + 'totalEmissiveRadiance+=vec3(.10,.032,.006)*lip;')
      // The throat falls into black.
      .replace('#include <opaque_fragment>', `outgoingLight*=${TINT}*mix(.045,1.,smoothstep(.015,.17,vS));
        #include <opaque_fragment>`);
  };
  const mesh = new Mesh(g, mat);
  mesh.frustumCulled = false;
  return { mesh, u };
}

/** Ribbons: pours of coffee that braid down into the vortex. */
export function createRibbons(env) {
  const R = rng(64), nT = Q.tier === 'low' ? 120 : 240, nA = Q.tier === 'low' ? 10 : 18, COUNT = 6;
  const pos = [], cen = [], tt = [], idx = [];
  const P = new Vector3(), P2 = new Vector3(), T = new Vector3(), Nn = new Vector3(), B = new Vector3();
  const funnelR = (y) => 1.25 + 8.2 * Math.pow(Math.min(1.4, Math.max(0, (y + 21) / 16)), 2.1);
  for (let k = 0; k < COUNT; k++) {
    const a0 = (k / COUNT) * 6.283 + R() * 0.5, turns = 3.6 + R() * 1.6, top = 2.2 - R() * 2.5, bot = -14 - R() * 5;
    const w0 = 0.13 + R() * 0.3, lane = 0.62 + R() * 0.2;
    const at = (t, o) => {
      const y = top + (bot - top) * Math.pow(t, 0.9);
      const r = Math.min(funnelR(y) * lane, 7.4) * (1 - 0.15 * Math.sin(t * 7 + k));
      const a = a0 + t * turns;
      return o.set(Math.cos(a) * r, y + Math.sin(t * 11 + k * 2) * 0.35, -10 + Math.sin(a) * r);
    };
    const start = pos.length / 3;
    for (let i = 0; i <= nT; i++) {
      const t = i / nT;
      at(t, P); at(t + 0.002, P2);
      T.subVectors(P2, P).normalize(); Nn.set(0, 1, 0).cross(T).normalize(); B.crossVectors(T, Nn);
      const taper = Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, t * 0.97 + 0.015))), 0.55);
      const w = w0 * taper * (0.75 + 0.35 * Math.sin(t * 17 + k * 3) + 0.22 * Math.sin(t * 41 + k));
      for (let j = 0; j <= nA; j++) {
        const a = (j / nA) * 6.283, c = Math.cos(a) * 0.55 * w, s = Math.sin(a) * 1.5 * w;
        // Flattened section: it reads as a poured ribbon, not a hose.
        pos.push(P.x + Nn.x * c + B.x * s, P.y + Nn.y * c + B.y * s, P.z + Nn.z * c + B.z * s);
        cen.push(P.x, P.y, P.z); tt.push(t, k);
      }
    }
    for (let i = 0; i < nT; i++) for (let j = 0; j < nA; j++) {
      const a = start + i * (nA + 1) + j, b = a + nA + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('aC', new BufferAttribute(new Float32Array(cen), 3));
  g.setAttribute('aT', new BufferAttribute(new Float32Array(tt), 2));
  g.setIndex(idx); g.computeVertexNormals();
  const u = { uTime: { value: 0 }, uGrow: { value: 0 }, uSpin: { value: 0 }, uAmber: { value: 1 }, uFade: { value: 0 } };
  const mat = liquidMaterial(env);
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec2 aT;attribute vec3 aC;uniform float uTime,uGrow,uSpin,uFade;varying float vT;varying float vCrest;${NOISE}`)
      .replace('#include <beginnormal_vertex>', `
        float ph=uSpin*.9+uTime*.05;mat2 rr=mat2(cos(ph),sin(ph),-sin(ph),cos(ph));
        vec3 objectNormal=normal;objectNormal.xz=rr*objectNormal.xz;`)
      .replace('#include <begin_vertex>', `
        float flow=vnoise(vec3(aT.x*26.-uTime*.8-uSpin*5.,aT.y*7.,0.))-.5;
        float tip=smoothstep(uGrow*1.15,uGrow*1.15-.16,aT.x)*(1.-uFade);
        vec3 transformed=mix(aC,position,tip*(1.+flow*.8));
        transformed.z+=10.;transformed.xz=rr*transformed.xz;transformed.z-=10.;
        vT=tip;vCrest=smoothstep(.1,.5,flow);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uAmber;varying float vT;varying float vCrest;')
      .replace('#include <map_fragment>', 'if(vT<.02)discard;')
      .replace('#include <emissivemap_fragment>', LIQUID_FRAG)
      .replace('#include <opaque_fragment>', `outgoingLight*=${TINT};
        #include <opaque_fragment>`);
  };
  const mesh = new Mesh(g, mat);
  mesh.frustumCulled = false;
  return { mesh, u };
}
