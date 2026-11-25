import {
  BufferGeometry, BufferAttribute, InstancedBufferAttribute, ShaderMaterial, Points, AdditiveBlending,
  InstancedMesh, MeshStandardMaterial, IcosahedronGeometry, Color, Vector3, Matrix4, Mesh,
  PlaneGeometry, InstancedBufferGeometry, Sphere, NormalBlending,
} from 'three';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';
import { NOISE, FUNNEL, GRAIN_PATH } from '../utils/glsl.js';
import { rng, noise3 } from '../utils/math.js';

/** Suspended dust: a wrapped box of points around the camera, drifting slowly. */
export function createDust({ count, box = [10, 10, 10], size = 1, color = new Color(0.9, 0.62, 0.36), seed = 1 }) {
  const R = rng(seed);
  const pos = new Float32Array(count * 3), rnd = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    for (let k = 0; k < 3; k++) pos[i * 3 + k] = R() * box[k];
    for (let k = 0; k < 4; k++) rnd[i * 4 + k] = R();
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('aR', new BufferAttribute(rnd, 4));
  const mat = new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uBox: { value: new Vector3(...box) }, uSize: { value: size }, uColor: { value: color },
      uAmt: { value: 1 }, uRise: { value: 0 }, uEmber: { value: 0 }, uPx: { value: 1 }, uFlow: { value: new Vector3() },
    },
    vertexShader: /* glsl */ `
      attribute vec4 aR;uniform float uTime,uSize,uRise,uEmber,uPx;uniform vec3 uBox,uFlow;varying float vA;varying float vE;
      ${NOISE}
      void main(){
        vec3 p=position;
        float sp=.35+aR.x;
        p+=vec3(sin(uTime*.21*sp+aR.y*6.3),cos(uTime*.17*sp+aR.z*6.3),sin(uTime*.13+aR.w*6.3))*.25;
        p.y+=uRise*sp+uTime*.03*sp; p+=uFlow*sp;
        p=mod(p-cameraPosition+uBox*.5,uBox)-uBox*.5+cameraPosition;
        vec4 mv=viewMatrix*vec4(p,1.);
        float d=-mv.z;
        vec3 e=abs(p-cameraPosition)/(uBox*.5);
        float edge=1.-smoothstep(.7,1.,max(e.x,max(e.y,e.z)));
        float s=uSize*(.35+1.9*pow(aR.x,5.));
        vE=step(.72,aR.y)*uEmber;
        gl_PointSize=clamp(s*(1.+vE*.5)*uPx/max(d,.05),0.,uPx*.035);
        vA=edge*smoothstep(.04,.5,d)*(.15+.85*aR.w)*(.7+.3*sin(uTime*(.4+aR.z)+aR.y*20.));
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;uniform float uAmt;varying float vA;varying float vE;
      void main(){float r=length(gl_PointCoord-.5)*2.;float a=smoothstep(1.,0.,r);a*=a;
        gl_FragColor=vec4(mix(uColor*.45,vec3(2.4,.75,.14),vE)*a*vA*uAmt,1.);}`,
  });
  const pts = new Points(g, mat);
  pts.frustumCulled = false;
  return pts;
}

/** Soft lit smoke: camera-facing instanced sheets with scrolling noise. */
export function createSmoke({ count, place, seed = 9 }) {
  const base = new PlaneGeometry(1, 1);
  const g = new InstancedBufferGeometry();
  g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
  const R = rng(seed);
  const off = new Float32Array(count * 4), rnd = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    off.set(place(i, R), i * 4);
    rnd.set([R(), R(), R(), R()], i * 4);
  }
  g.setAttribute('aO', new InstancedBufferAttribute(off, 4));
  g.setAttribute('aR', new InstancedBufferAttribute(rnd, 4));
  g.instanceCount = count;
  const mat = new ShaderMaterial({
    transparent: true, depthWrite: false, blending: NormalBlending,
    uniforms: { uTime: { value: 0 }, uMist: { value: 0 }, uSmoke: { value: 0 }, uA: { value: new Color(0.05, 0.05, 0.055) }, uB: { value: new Color(0.3, 0.1, 0.025) } },
    vertexShader: /* glsl */ `
      attribute vec4 aO,aR;uniform float uTime,uSmoke;varying vec2 vUv;varying vec4 vR;varying float vD;
      void main(){
        vUv=uv;vR=aR;
        vec3 c=aO.xyz;
        c.y+=uSmoke*(2.+3.*aR.x)+sin(uTime*.1+aR.y*6.)*.5;c.x+=sin(uTime*.07+aR.z*6.)*1.2;
        vec4 mv=viewMatrix*vec4(c,1.);
        mv.xy+=position.xy*aO.w*vec2(1.5,1.);
        vD=-mv.z;gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime,uMist,uSmoke;uniform vec3 uA,uB;varying vec2 vUv;varying vec4 vR;varying float vD;
      ${NOISE}
      void main(){
        vec2 c=vUv-.5;float r=length(c)*2.;
        vec2 q=vUv*2.6+vR.xy*30.;
        float w=vnoise(vec3(q*.8,uTime*.06));
        float n=fbm(vec3(q+w*1.1+vec2(0.,-uTime*(.05+.14*uSmoke)),uTime*.045+vR.z*9.));
        float a=smoothstep(1.,.15,r)*smoothstep(.34,.85,n);
        a*=smoothstep(1.5,9.,vD)*(1.-smoothstep(55.,90.,vD));
        a*=(uMist*.34+uSmoke*.42)*(.5+.5*vR.w);
        vec3 col=mix(uA,uB,uSmoke*(.25+.75*smoothstep(.75,.1,vUv.y)));
        gl_FragColor=vec4(col*(.55+.9*n),a);
      }`,
  });
  const m = new Mesh(g, mat);
  m.frustumCulled = false; m.renderOrder = 5;
  return m;
}

const grainUniforms = () => ({
  uBurst: { value: 0 }, uGather: { value: 0 }, uSpin: { value: 0 }, uMelt: { value: 0 }, uTime: { value: 0 },
  uPx: { value: 1 }, uHot: { value: 1 }, uLit: { value: 1 },
});

/** Ground coffee: tens of thousands of points on the shared grain path. */
export function createGrains(beanGeometry, count, beanScale) {
  const R = rng(5);
  const sampler = new MeshSurfaceSampler(new Mesh(beanGeometry)).setRandomGenerator(R).build();
  const v = new Vector3();
  const make = (n) => {
    const pos = new Float32Array(n * 3), rnd = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      sampler.sample(v);
      v.multiplyScalar(beanScale * (0.55 + 0.45 * Math.cbrt(R())));
      pos.set([v.x, v.y, v.z], i * 3);
      rnd.set([R(), R(), R(), R()], i * 4);
    }
    return { pos, rnd };
  };
  const uniforms = grainUniforms();

  const d = make(count);
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(d.pos, 3));
  g.setAttribute('aR', new BufferAttribute(d.rnd, 4));
  g.boundingSphere = new Sphere(new Vector3(), 1e4);
  const mat = new ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      attribute vec4 aR;uniform float uPx,uHot;varying vec3 vCol;varying float vSeed;varying float vFar;
      ${NOISE}${FUNNEL}${GRAIN_PATH}
      void main(){
        vec3 p=grainPath(position,aR);
        vec4 mv=modelViewMatrix*vec4(p,1.);
        float d=-mv.z;
        float s=(mix(.010,.021,uGather*uGather*uGather)+.052*pow(aR.w,6.))*gBirth*gMelt;
        gl_PointSize=clamp(s*uPx/max(d,.1),0.,uPx*.03);
        if(gBirth*gMelt<.01||d<.12)gl_Position=vec4(2.,2.,2.,1.);else gl_Position=projectionMatrix*mv;
        vec3 base=mix(vec3(.050,.022,.010),vec3(.23,.10,.038),aR.y*aR.y);
        float core=exp(-length(p*vec3(1.,1.4,1.))*.42)*uHot;
        vCol=base+core*vec3(1.5,.48,.10)*(.35+.65*aR.z);
        // Once gathered, the light comes from the throat of the spiral.
        float heart=exp(-length((p-vec3(0.,-9.,-10.))*vec3(1.,.55,1.))*.22);
        vCol=mix(vCol,vCol*(1.6+14.*heart)+vec3(1.5,.52,.12)*heart*heart,uGather*uGather*uGather);
        vFar=smoothstep(38.,12.,d);vSeed=aR.z;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vCol;varying float vSeed;varying float vFar;uniform float uLit;
      void main(){
        vec2 c=gl_PointCoord*2.-1.;c.y=-c.y;
        float a=atan(c.y,c.x);
        float e=.80+.14*sin(a*3.+vSeed*40.)+.07*sin(a*7.-vSeed*90.);
        float r=length(c)/e;if(r>1.)discard;
        vec3 n=vec3(c/e,sqrt(1.-r*r));
        float k=max(dot(n,normalize(vec3(.55,.75,.4))),0.);
        float rim=max(dot(n,normalize(vec3(-.8,.15,-.1))),0.);
        gl_FragColor=vec4((vCol*(.18+1.5*k)+vec3(.55,.2,.05)*rim*.4)*vFar*uLit,1.);
      }`,
  });
  const points = new Points(g, mat);
  points.frustumCulled = false;

  return { points, uniforms, make };
}

/** Tactile chunks riding the same path, for the grains that pass the lens. */
export function createChunks(grains, count, env) {
  const geo = new IcosahedronGeometry(1, 2);
  const p = geo.attributes.position, v = new Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = noise3(v.x * 1.6 + 4, v.y * 1.6, v.z * 1.6) * 0.75 + noise3(v.x * 4, v.y * 4 + 8, v.z * 4) * 0.35;
    v.multiplyScalar(0.55 + n * 0.75);
    v.y *= 0.72;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const d = grains.make(count);
  geo.setAttribute('aBean', new InstancedBufferAttribute(d.pos, 3));
  geo.setAttribute('aR', new InstancedBufferAttribute(d.rnd, 4));
  const mat = new MeshStandardMaterial({ color: 0x33190c, roughness: 0.72, envMap: env, envMapIntensity: 0.5 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, grains.uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec3 aBean;attribute vec4 aR;varying vec3 vOP;varying float vCore;uniform float uHot;${NOISE}${FUNNEL}${GRAIN_PATH}`)
      .replace('#include <beginnormal_vertex>', `
        vec3 gp=grainPath(aBean,aR);
        mat3 gm=rotAxis(normalize(aR.xyz-.5+.001),aR.w*20.+uBurst*(6.+aR.x*9.)+uGather*5.+uSpin*2.+uTime*.15);
        vec3 objectNormal=gm*normal;`)
      .replace('#include <begin_vertex>', `
        float gs=(.018+.12*pow(aR.y,5.))*gBirth*gMelt;
        vec3 transformed=gp+gm*position*gs;vOP=position;
        vCore=exp(-length(gp)*.4)*uHot;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vOP;varying float vCore;${NOISE}`)
      .replace('#include <map_fragment>', `float gn=fbm(vOP*3.5);diffuseColor.rgb*=.35+1.5*gn;`)
      .replace('#include <emissivemap_fragment>', `totalEmissiveRadiance+=vCore*vec3(1.1,.3,.05)*smoothstep(.42,.7,gn);`);
  };
  const mesh = new InstancedMesh(geo, mat, count);
  const m = new Matrix4();
  for (let i = 0; i < count; i++) mesh.setMatrixAt(i, m);
  mesh.frustumCulled = false;
  return mesh;
}
