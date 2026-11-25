import { BufferGeometry, BufferAttribute, Vector3, Mesh } from 'three';
import { NOISE } from '../utils/glsl.js';
import { rng, noise3 } from '../utils/math.js';
import { beanMaterial } from './coffeeBean.js';

/**
 * Cuts the scanned bean into solid shards: two nested Voronoi levels, extruded
 * inward, with walls along every broken edge. One draw call, moved in the vertex shader.
 */
function shatter(src, scale, n1 = 30, n2 = 190) {
  const R = rng(33);
  const P = src.attributes.position, N = src.attributes.normal, UV = src.attributes.uv, I = src.index;
  const tris = I.count / 3;
  const warp = (v, a) => {
    const { x, y, z } = v;
    v.x += (noise3(x * 2.2 + 5, y * 2.2, z * 2.2) - 0.5) * a;
    v.y += (noise3(x * 2.2, y * 2.2 + 11, z * 2.2) - 0.5) * a;
    v.z += (noise3(x * 2.2, y * 2.2, z * 2.2 + 23) - 0.5) * a;
    return v;
  };
  const cent = [], raw = [];
  for (let t = 0; t < tris; t++) {
    const c = new Vector3();
    for (let k = 0; k < 3; k++) c.add(new Vector3().fromBufferAttribute(P, I.getX(t * 3 + k)));
    c.multiplyScalar(scale / 3);
    raw.push(c); cent.push(warp(c.clone(), 0.75));
  }
  // Best-candidate seeds: evenly sized shards.
  const pick = (n) => {
    const s = [];
    while (s.length < n) {
      let best = null, bd = -1;
      for (let k = 0; k < 10; k++) {
        const c = cent[Math.floor(R() * tris)];
        let d = 1e9;
        for (const q of s) d = Math.min(d, q.distanceToSquared(c));
        if (d > bd) { bd = d; best = c; }
      }
      s.push(best);
    }
    return s;
  };
  const near = (s, c) => {
    let b = 0, d = 1e9;
    for (let i = 0; i < s.length; i++) { const e = s[i].distanceToSquared(c); if (e < d) { d = e; b = i; } }
    return b;
  };
  const s1 = pick(n1), s2 = pick(n2);
  const l1of2 = s2.map((c) => near(s1, c));
  const cell2 = cent.map((c) => near(s2, c));
  const C2 = s2.map(() => new Vector3()), k2 = s2.map(() => 0), C1 = s1.map(() => new Vector3()), k1 = s1.map(() => 0);
  raw.forEach((c, t) => { const b = cell2[t], a = l1of2[b]; C2[b].add(c); k2[b]++; C1[a].add(c); k1[a]++; });
  C2.forEach((c, i) => c.multiplyScalar(0.78 / Math.max(1, k2[i])));
  C1.forEach((c, i) => c.multiplyScalar(0.74 / Math.max(1, k1[i])));
  const r1 = s1.map(() => [R(), R(), R()]), r2 = s2.map(() => [R(), R(), R()]);

  // Weld by position, then flood distance from level-1 borders: drives the glowing seam.
  const weld = new Map(), vid = new Int32Array(P.count), vpos = [];
  for (let i = 0; i < P.count; i++) {
    const k = `${Math.round(P.getX(i) * 2e4)},${Math.round(P.getY(i) * 2e4)},${Math.round(P.getZ(i) * 2e4)}`;
    if (!weld.has(k)) { weld.set(k, vpos.length); vpos.push(new Vector3().fromBufferAttribute(P, i).multiplyScalar(scale)); }
    vid[i] = weld.get(k);
  }
  const NV = vpos.length;
  const ekey = (a, b) => (a < b ? a * NV + b : b * NV + a);
  const edges = new Map();
  for (let t = 0; t < tris; t++) for (let e = 0; e < 3; e++) {
    const k = ekey(vid[I.getX(t * 3 + e)], vid[I.getX(t * 3 + (e + 1) % 3)]);
    if (edges.has(k)) edges.get(k).push(t); else edges.set(k, [t]);
  }
  const dist = new Float32Array(NV).fill(9);
  const adj = vpos.map(() => []);
  for (const [k, ts] of edges) {
    const a = Math.floor(k / NV), b = k % NV, len = vpos[a].distanceTo(vpos[b]);
    adj[a].push([b, len]); adj[b].push([a, len]);
    if (ts.length === 2 && l1of2[cell2[ts[0]]] !== l1of2[cell2[ts[1]]]) { dist[a] = 0; dist[b] = 0; }
  }
  const queue = [];
  dist.forEach((d, i) => { if (d === 0) queue.push(i); });
  for (let h = 0; h < queue.length; h++) {
    const a = queue[h];
    for (const [b, l] of adj[a]) if (dist[a] + l < dist[b] - 1e-5 && dist[a] + l < 0.6) { dist[b] = dist[a] + l; queue.push(b); }
  }

  const O = { p: [], n: [], uv: [], c1: [], c2: [], ra: [], rb: [], f: [] };
  const push = (pos, nor, u, w, t, inside, d) => {
    const b = cell2[t], a = l1of2[b];
    O.p.push(pos.x, pos.y, pos.z); O.n.push(nor.x, nor.y, nor.z); O.uv.push(u, w);
    O.c1.push(C1[a].x, C1[a].y, C1[a].z); O.c2.push(C2[b].x, C2[b].y, C2[b].z);
    O.ra.push(...r1[a]); O.rb.push(...r2[b]); O.f.push(inside, d);
  };
  const inner = (pos) => pos.clone().multiplyScalar(0.5 + 0.12 * noise3(pos.x * 2, pos.y * 2, pos.z * 2));
  const nn = new Vector3(), fn = new Vector3();
  for (let t = 0; t < tris; t++) {
    const ids = [0, 1, 2].map((k) => I.getX(t * 3 + k));
    const pts = ids.map((i) => new Vector3().fromBufferAttribute(P, i).multiplyScalar(scale));
    ids.forEach((i, k) => {
      nn.fromBufferAttribute(N, i);
      push(pts[k], nn, UV.getX(i), UV.getY(i), t, 0, dist[vid[i]]);
    });
    const ins = pts.map(inner);
    // Broken faces are shaded from the shard's own centre, so walls read as one rough surface.
    const heart = C2[cell2[t]];
    const away = (q) => fn.subVectors(q, heart).normalize();
    [0, 2, 1].forEach((k) => push(ins[k], away(ins[k]), 0, 0, t, 1, 0));
    for (let e = 0; e < 3; e++) {
      const ts = edges.get(ekey(vid[ids[e]], vid[ids[(e + 1) % 3]]));
      if (ts.length === 2 && cell2[ts[0]] === cell2[ts[1]]) continue;
      const A = pts[e], B = pts[(e + 1) % 3], Ai = ins[e], Bi = ins[(e + 1) % 3];
      for (const q of [A, Ai, B, B, Ai, Bi]) push(q, away(q), 0, 0, t, 1, 0);
    }
  }
  const g = new BufferGeometry();
  const set = (n, arr, s) => g.setAttribute(n, new BufferAttribute(new Float32Array(arr), s));
  set('position', O.p, 3); set('normal', O.n, 3); set('uv', O.uv, 2);
  set('aC1', O.c1, 3); set('aC2', O.c2, 3); set('aA', O.ra, 3); set('aB', O.rb, 3); set('aF', O.f, 2);
  return g;
}

const MOVE = /* glsl */ `
attribute vec3 aC1,aC2,aA,aB;attribute vec2 aF;
uniform float uOpen,uSplit,uShatter,uDissolve;
varying float vIn;varying float vDist;varying float vDis;
mat3 gRot;
vec3 fragMove(vec3 pos){
  float t1=clamp(uSplit*1.5-aA.x*.5,0.,1.);t1=1.-pow(1.-t1,2.2);
  float t2=clamp(uShatter*1.6-aB.x*.6,0.,1.);t2=t2*t2*(3.-2.*t2);
  float ds=clamp(uDissolve*1.8-aB.y*.8,0.,1.);
  mat3 R2=rotAxis(normalize(aB-.5+.001),t2*(1.5+aB.z*3.5));
  mat3 R1=rotAxis(normalize(aA-.5+.001),t1*(.5+aA.z*1.5));
  vec3 p=aC2+R2*(pos-aC2)*(1.-ds);
  p+=(normalize(aC2-aC1+.0001)*(.35+.9*aB.y)+normalize(aC2)*.5*aB.z)*t2*1.25;
  p=aC1+R1*(p-aC1);
  vec3 d1=normalize(aC1);
  // Outward, but flattened and swept, so the break reads as a slow bloom.
  p+=d1*(uOpen*.055*(.5+aA.y)+t1*(.55+2.3*aA.y)*vec3(1.35,.8,1.2));
  float sw=t1*.75;float c=cos(sw),s=sin(sw);
  mat3 W=mat3(c,0.,-s,0.,1.,0.,s,0.,c);
  p=W*p;
  gRot=W*R1*R2;
  vIn=aF.x;vDist=aF.y;vDis=ds;
  return p;
}`;

export function createFragments(geometry, assets, env, scale) {
  const g = shatter(geometry, scale);
  const mat = beanMaterial(assets, { env, envIntensity: 0.9 });
  const u = {
    uOpen: { value: 0 }, uSplit: { value: 0 }, uShatter: { value: 0 }, uDissolve: { value: 0 }, uGlow: { value: 1 },
  };
  const base = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    base(sh, r);
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${NOISE}${MOVE}`)
      .replace('#include <beginnormal_vertex>', 'vec3 fp=fragMove(position);vec3 objectNormal=gRot*normal;')
      .replace('#include <begin_vertex>', 'vec3 transformed=fp;')
      .replace('vDM=normalMatrix;', 'vDM=normalMatrix*gRot;')
      .replace('vOP=position;', `vOP=position/${scale.toFixed(1)};`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vIn;varying float vDist;varying float vDis;uniform float uGlow,uOpen;')
      .replace('float mottling=fbm(vOP*9.);', `float mottling=fbm(vOP*9.);
        if(vDis>.02&&fbm(vOP*7.+3.)<vDis*.8)discard;
        if(vIn>.5){float c=fbm(vOP*16.);diffuseColor.rgb=mix(vec3(.030,.011,.004),vec3(.17,.075,.030),c*c*1.5);}`)
      .replace('normal=normalize(normal+vDM*(d*.28', `if(vIn>.5)normal=normalize(normal+vDM*(vnoise3(vOP*13.)*.75+vnoise3(vOP*34.)*.4));
         else normal=normalize(normal+vDM*(d*.28`)
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
        if(vIn>.5){material.clearcoat=0.;material.roughness=.92;material.specularColor*=.3;}`)
      .replace('totalEmissiveRadiance+=hot*vec3(1.6,.42,.07);', `
        if(vIn>.5){
          float depth=smoothstep(.95,.35,length(vOP));
          float vein=smoothstep(.45,.74,fbm(vOP*11.));
          totalEmissiveRadiance+=uGlow*vec3(1.1,.27,.04)*depth*(.02+.8*vein*vein);
        }else{
          float n=fbm(vOP*22.);
          float seam=smoothstep(.016,.0,vDist-(n-.5)*.026)*smoothstep(.2,.6,n+uOpen*.4);
          float halo=exp(-vDist*13.);
          float live=smoothstep(.25,.75,fbm(vOP*3.1+7.));
          totalEmissiveRadiance+=uGlow*(mix(vec3(.75,.12,.014),vec3(2.1,.62,.10),live*uOpen)*seam*(.2+.8*live)+vec3(.20,.038,.006)*halo*.5*live);
          totalEmissiveRadiance+=uGlow*hot*vec3(.55,.13,.02)*(1.-uOpen*.4);
        }`);
  };
  const mesh = new Mesh(g, mat);
  mesh.frustumCulled = false;
  return { mesh, u, mat };
}
