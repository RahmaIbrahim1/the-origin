import {
  BufferGeometry, BufferAttribute, MeshStandardMaterial, Mesh, Group, CatmullRomCurve3, Vector3, TubeGeometry,
  IcosahedronGeometry, InstancedMesh, Matrix4, Quaternion, Euler, PlaneGeometry, ShaderMaterial, DoubleSide, Color,
} from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { NOISE, TRIPLANAR } from '../utils/glsl.js';
import { ridged3, fbm3, noise3, rng, smooth, lerp } from '../utils/math.js';
import { Q } from '../quality.js';

export const Z0 = 16, Z1 = -226;
const gauss = (z, c, w) => Math.exp(-(((z - c) / w) ** 2));

/** The canyon is the bean's crease at geological scale: floor, walls, and two lips that curl overhead. */
export const pathX = (z) => Math.sin(z * 0.043) * 6 + Math.sin(z * 0.018 + 1) * 8 - 6.7;
export const pathY = (z) => z * 0.17 + Math.sin(z * 0.055) * 2;
const width = (z) => 5.2 + 15 * gauss(z, -92, 30) + 2 * gauss(z, -20, 12) - 2.9 * smooth(-170, -214, z);
const height = (z) => 8.5 + 13 * gauss(z, -92, 32) - 2 * smooth(-170, -214, z);
const openAngle = (z) => Math.PI * (0.83 - 0.2 * gauss(z, -92, 34) + 0.1 * smooth(-150, -200, z));

function canyonGeometry([nu, nv]) {
  const pos = new Float32Array((nu + 1) * (nv + 1) * 3);
  let i = 0;
  for (let v = 0; v <= nv; v++) {
    const z0 = lerp(Z0, Z1, v / nv);
    const cx = pathX(z0), cy = pathY(z0), W = width(z0), H = height(z0), A = openAngle(z0);
    for (let k = 0; k <= nu; k++) {
      const u = (k / nu) * 2 - 1, s = Math.abs(u), sg = Math.sign(u);
      let x, y, nx, ny, amp;
      if (s < 0.72) {
        const a = (s / 0.72) * A;
        x = sg * W * Math.sin(a) * (1 + 0.12 * Math.cos(a * 2));
        y = H * (1 - Math.cos(a));
        nx = -sg * Math.sin(a); ny = Math.cos(a);
        amp = (1.5 + 0.13 * W) * lerp(0.6, 1, smooth(0, 0.35, s));
      } else {
        const q = (s - 0.72) / 0.28;
        x = sg * (W * Math.sin(A) * (1 + 0.12 * Math.cos(A * 2)) + Math.pow(q, 1.7) * 70);
        y = H * (1 - Math.cos(A)) + Math.sin(Math.min(q * 2.4, 1.57)) * 3.4 - q * q * 5;
        nx = -sg * Math.sin(A) * (1 - q); ny = lerp(Math.cos(A), 1, Math.min(1, q * 3));
        amp = 1.5 + 0.13 * W + q * 6;
      }
      const wx = cx + x, wy = cy + y;
      // Grain runs along the crease, like the wrinkles of a roasted seed.
      const warp = fbm3(wx * 0.05, wy * 0.05, z0 * 0.03, 3) * 5;
      const big = ridged3(wx * 0.085 + warp * 0.35, wy * 0.1 + warp * 0.3, z0 * 0.04, 4) - 0.45;
      const fine = ridged3(wx * 0.5 + warp, wy * 0.5, z0 * 0.16, 3) - 0.4;
      const d = big * amp * 1.9 + fine * amp * 0.26;
      pos[i++] = wx - nx * d;
      pos[i++] = wy - ny * d;
      pos[i++] = z0 + (noise3(wx * 0.2, wy * 0.2, z0 * 0.2) - 0.5) * 1.2;
    }
  }
  const idx = new Uint32Array(nu * nv * 6);
  let j = 0;
  for (let v = 0; v < nv; v++) for (let k = 0; k < nu; k++) {
    const a = v * (nu + 1) + k, b = a + 1, c = a + nu + 1, d = c + 1;
    idx.set([a, b, c, b, d, c], j); j += 6;
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setIndex(new BufferAttribute(idx, 1));
  g.computeVertexNormals();
  return g;
}

/** Fibres: silverskin strands stretched wall to wall, at the size of bridges. */
function fibreGeometry() {
  const R = rng(21), list = [];
  const zs = [-26, -43, -52, -64, -78, -90, -101, -112, -120, -133, -146, -158, -169, -181];
  for (const z of zs) {
    const n = R() > 0.55 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const W = width(z) * 1.25, H = height(z), side = R() > 0.5 ? 1 : -1;
      const y0 = pathY(z) + H * (1.15 + R() * 0.5), y1 = pathY(z) + H * (1.2 + R() * 0.6);
      const dz = (R() - 0.5) * 18, sag = (0.05 + R() * 0.15) * H;
      const pts = [];
      for (let t = 0; t <= 8; t++) {
        const q = t / 8;
        pts.push(new Vector3(
          pathX(z) + side * lerp(-W, W, q),
          lerp(y0, y1, q) - Math.sin(q * Math.PI) * sag + (R() - 0.5) * 0.9,
          z + dz * (q - 0.5) + (R() - 0.5) * 1.6));
      }
      const g = new TubeGeometry(new CatmullRomCurve3(pts), 70, 0.35 + R() * 0.55 + W * 0.018, 9);
      const p = g.attributes.position, nrm = g.attributes.normal;
      for (let i = 0; i < p.count; i++) {
        const q = Math.floor(i / 10) / 70;
        const x = p.getX(i), y = p.getY(i), zz = p.getZ(i);
        const f = (ridged3(x * 0.35, y * 0.9, zz * 0.9, 3) - 0.35) * 0.75 + Math.pow(Math.abs(q * 2 - 1), 3) * 1.9;
        p.setXYZ(i, x + nrm.getX(i) * f, y + nrm.getY(i) * f, zz + nrm.getZ(i) * f);
      }
      g.deleteAttribute('uv');
      g.computeVertexNormals();
      list.push(g);
    }
  }
  return mergeGeometries(list);
}

/** Blades standing in the great chamber: the distant silhouettes. */
function bladeGeometry() {
  const R = rng(8), list = [];
  for (let k = 0; k < 13; k++) {
    const z = -77 - k * 4.9, side = k % 2 ? 1 : -1;
    const W = width(z), h = 8 + R() * 15, w = 1.6 + R() * 2.4;
    const off = side * (5.2 + R() * Math.max(1, W * 0.75 - 3));
    const rows = 40, cols = 20, pos = [], idx = [];
    const lean = -side * (0.1 + R() * 0.3), tw = (R() - 0.5) * 1.6, ph = R() * 9;
    for (let r = 0; r <= rows; r++) {
      const t = r / rows, rad = w * Math.pow(1 - t, 0.62) * (1 + 0.9 * Math.pow(1 - t, 6));
      for (let c = 0; c <= cols; c++) {
        const a = (c / cols) * Math.PI * 2, b = a + tw * t;
        const n = (ridged3(Math.cos(a) * 1.4 + ph, t * 2.6, Math.sin(a) * 1.4 + ph, 4) - 0.35) * 1.3 * (1 - t * 0.6) * Math.min(1, (1 - t) * 6);
        const x = Math.cos(b) * (rad * 0.5 + n), zz = Math.sin(b) * (rad * 1.35 + n);
        pos.push(pathX(z) + off + x + lean * h * t * t, pathY(z) - 1 + t * h, z + zz);
      }
    }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c, b = a + 1, d = a + cols + 1, e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    g.setIndex(idx); g.computeVertexNormals();
    list.push(g);
  }
  return mergeGeometries(list);
}

function shardGeometry() {
  const raw = new IcosahedronGeometry(1, 5);
  raw.deleteAttribute('uv'); raw.deleteAttribute('normal');
  const g = mergeVertices(raw), p = g.attributes.position, v = new Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.multiplyScalar(0.5 + ridged3(v.x * 1.3 + 2, v.y * 1.3, v.z * 1.3, 4) * 0.95);
    p.setXYZ(i, v.x * 0.6, v.y * 1.7, v.z);
  }
  g.computeVertexNormals();
  return g;
}

export function createTerrain(assets) {
  const group = new Group();
  const u = {
    uBark: { value: assets.barkNormal }, uArm: { value: assets.barkArm }, uRock: { value: assets.rockNormal },
    uFrac: { value: assets.fracture }, uHeat: { value: 0 }, uTime: { value: 0 }, uCamZ: { value: 0 },
  };
  const mat = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0, side: DoubleSide });
  if (Q.tier !== 'high') mat.defines = { ...mat.defines, LITE: '' };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;varying vec3 vWN;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
        vWP=(modelMatrix*instanceMatrix*vec4(position,1.)).xyz;vWN=mat3(modelMatrix)*mat3(instanceMatrix)*normal;
        #else
        vWP=(modelMatrix*vec4(position,1.)).xyz;vWN=mat3(modelMatrix)*normal;
        #endif`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWP;varying vec3 vWN;uniform sampler2D uBark,uArm,uRock,uFrac;uniform float uHeat,uTime,uCamZ;${NOISE}${TRIPLANAR}`)
      .replace('#include <map_fragment>', `
        vec3 wn=normalize(vWN)*(gl_FrontFacing?1.:-1.);vec3 tw=triW(wn);
        vec4 fr=tri(uFrac,vWP*.047,tw);
        vec4 fr2=tri(uFrac,vWP*.16+.4,tw);
        #ifdef LITE
        vec3 arm=vec3(.62,.85,0.);
        #else
        vec3 arm=tri(uArm,vWP*.13,tw).rgb;
        #endif
        float strata=fbm(vWP*vec3(.5,.8,.12));
        vec3 cA=vec3(.022,.011,.0065),cB=vec3(.115,.054,.026);
        vec3 cc=mix(cA,cB,smoothstep(.2,.8,strata*.7+fr.b*.3));
        cc*=.45+.75*arm.r;
        cc*=mix(.55,1.,smoothstep(0.,.12,fr2.r));
        // Silverskin caught in the folds: the scan's pale gold, sparingly.
        cc+=vec3(.16,.085,.03)*smoothstep(.72,.9,fr2.b)*smoothstep(.5,.75,strata);
        cc=mix(cc,cc*vec3(.50,.40,.34),uHeat);
        diffuseColor.rgb=cc;`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor=mix(.92,.5,smoothstep(.35,.75,fr2.b)*(.4+.6*uHeat))*(.7+.3*arm.g);')
      .replace('#include <normal_fragment_maps>', `
        {vec3 a=triNormal(uBark,vWP*.085,wn,1.)-wn;
         #ifdef LITE
         vec3 b=a*.5;
         #else
         vec3 b=triNormal(uRock,vWP*.31,wn,1.)-wn;
         #endif
         normal=normalize(normal+(viewMatrix*vec4(a*1.05+b*.55,0.)).xyz);}`)
      .replace('#include <emissivemap_fragment>', `if(uHeat>.001){
        // Heat travels: cracks wake from the far end of the crease toward the viewer.
        float ahead=clamp((uCamZ-vWP.z)/95.,-.25,1.2);
        float front=smoothstep(0.,.55,uHeat*1.75-.75+ahead*.45-(fr.b-.5)*.9);
        float w=mix(.005,.028,uHeat);
        float gate=smoothstep(.34,.66,fr.b*.5+fr2.b*.15+.5*vnoise(vWP*.14+3.));
        float core=smoothstep(w,w*.12,fr.r)*gate;
        float hair=smoothstep(w*1.3,0.,fr2.r)*smoothstep(.5,.8,fr2.b)*.5*gate;
        float halo=exp(-fr.r*17.)*gate;
        float pulse=.82+.18*sin(uTime*.9+vWP.z*.22+fr.a*6.);
        // Ember, not lava: hot only in the hairline, char on the shoulders.
        vec3 hot=mix(vec3(.75,.12,.015),vec3(1.9,.56,.09),core*uHeat);
        diffuseColor.rgb*=1.-.75*smoothstep(.16,.02,fr.r)*gate*front*uHeat;
        totalEmissiveRadiance+=front*pulse*(hot*(core*1.2+hair*.5)*(.35+.9*fr2.b)+vec3(.20,.045,.008)*halo*.6*uHeat);
      }`);
  };

  group.add(new Mesh(canyonGeometry(Q.terrain), mat), new Mesh(fibreGeometry(), mat), new Mesh(bladeGeometry(), mat));

  // Suspended shards: splinters of the same matter, hung at choreographed distances from the path.
  const n = 64, R = rng(40), shards = new InstancedMesh(shardGeometry(), mat, n);
  const base = [];
  for (let i = 0; i < n; i++) {
    const z = -18 - (i / n) * 178 - R() * 3, W = width(z), a = R() * Math.PI * 2;
    const r = 2.3 + R() * Math.max(0.8, W * 0.75 - 2);
    base.push({
      p: new Vector3(pathX(z) + Math.cos(a) * r, pathY(z) + height(z) * 0.62 + Math.sin(a) * r * 0.75, z),
      e: [R() * 6, R() * 6, R() * 6], s: 0.1 + Math.pow(R(), 3) * (0.5 + W * 0.06), k: R(),
    });
  }
  const M = new Matrix4(), qt = new Quaternion(), sc = new Vector3(), pv = new Vector3(), eu = new Euler();
  const updateShards = (time, heat, travel) => {
    for (let i = 0; i < n; i++) {
      const b = base[i];
      eu.set(b.e[0] + time * 0.05 * b.k + heat * b.k * 2, b.e[1] + travel * b.k * 2.2, b.e[2] + time * 0.03);
      qt.setFromEuler(eu);
      pv.copy(b.p); pv.y += Math.sin(time * 0.25 + i) * 0.12 + heat * heat * (1 + b.k * 3);
      sc.setScalar(b.s);
      shards.setMatrixAt(i, M.compose(pv, qt, sc));
    }
    shards.instanceMatrix.needsUpdate = true;
  };
  shards.frustumCulled = false;
  group.add(shards);

  // The breaking point: a ragged vertical fissure at the end of the crease.
  const fz = -212;
  const fissure = new Mesh(new PlaneGeometry(26, 30), new ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uOpen: { value: 0 }, uHeat: u.uHeat, uTime: u.uTime, uCol: { value: new Color(3.4, 1.15, 0.24) } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float uOpen,uHeat,uTime;uniform vec3 uCol;varying vec2 vUv;${NOISE}
      void main(){vec2 c=(vUv-.5)*vec2(26.,30.);
        float j=(fbm(vec3(c.y*.55,3.,0.))-.5)*2.4+(fbm(vec3(c.y*2.2,9.,0.))-.5)*.5;
        float d=abs(c.x-j);
        float w=uOpen*1.5*smoothstep(13.,0.,abs(c.y))*(.55+.9*fbm(vec3(c.y*.9,1.,uTime*.1)));
        float core=smoothstep(w,w*.35,d)*step(.002,w);
        float halo=exp(-max(d-w,0.)*1.5)*smoothstep(14.,2.,abs(c.y));
        float f=.75+.5*fbm(vec3(c*.9,uTime*.3));
        gl_FragColor=vec4(uCol*(core*f+halo*.10*uHeat),clamp(core+halo*.25*uHeat,0.,1.));}`,
  }));
  fissure.position.set(pathX(fz), pathY(fz) + 5.2, fz);
  group.add(fissure);

  return { group, u, updateShards, fissure };
}
