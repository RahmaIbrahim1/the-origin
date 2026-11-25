import {
  LoadingManager, TextureLoader, RepeatWrapping, SRGBColorSpace, DataTexture, RGBAFormat,
  LinearMipmapLinearFilter, LinearFilter, Mesh,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { rng } from './utils/math.js';

const BASE = import.meta.env.BASE_URL + 'assets/';

/** Loads every file the film depends on and reports true progress. */
export async function loadAssets(onProgress) {
  const manager = new LoadingManager();
  manager.onProgress = (_, done, total) => onProgress(done / total);
  const gltf = new GLTFLoader(manager);
  const tex = new TextureLoader(manager);

  const texture = async (file, srgb = false) => {
    const t = await tex.loadAsync(BASE + 'textures/' + file);
    t.wrapS = t.wrapT = RepeatWrapping;
    if (srgb) t.colorSpace = SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  const model = async (file) => {
    const g = await gltf.loadAsync(BASE + 'models/' + file);
    let mesh;
    g.scene.traverse((o) => { if (o instanceof Mesh) mesh = o; });
    if (!mesh) throw new Error(`No mesh in ${file}`);
    return { geometry: mesh.geometry, material: mesh.material };
  };

  const [bean, beanLod, barkNormal, barkArm, rockNormal] = await Promise.all([
    model('bean.glb'), model('bean-lod.glb'),
    texture('bark-normal.webp'), texture('bark-arm.webp'), texture('rock-normal.webp'),
    document.fonts.load('80px Italiana'), document.fonts.load('600 20px "Instrument Sans"'),
  ]);
  for (const b of [bean, beanLod]) {
    b.material.map.anisotropy = 8;
    b.material.normalMap.anisotropy = 8;
  }
  return { bean, beanLod, barkNormal, barkArm, rockNormal, fracture: fractureTexture(512) };
}

/**
 * Tileable fracture map.
 * R: distance to primary crack, G: distance to hairline crack, B: cloud noise, A: cell id.
 */
function fractureTexture(size) {
  const R = rng(77);
  const cellsOf = (n) => Array.from({ length: n * n }, () => [R(), R(), R()]);
  const layers = [[6, cellsOf(6)], [15, cellsOf(15)]];
  const lat = Array.from({ length: 32 * 32 }, () => R());
  const vn = (x, y, per) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    let u = x - xi, v = y - yi; u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
    const g = (a, b) => lat[(((a % per) + per) % per) + (((b % per) + per) % per) * 32];
    return (g(xi, yi) * (1 - u) + g(xi + 1, yi) * u) * (1 - v) + (g(xi, yi + 1) * (1 - u) + g(xi + 1, yi + 1) * u) * v;
  };
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u0 = x / size, v0 = y / size;
    const wx = (vn(u0 * 8, v0 * 8, 8) - 0.5) * 0.07 + (vn(u0 * 32, v0 * 32, 32) - 0.5) * 0.022;
    const wy = (vn(u0 * 8 + 3, v0 * 8 + 5, 8) - 0.5) * 0.07 + (vn(u0 * 32 + 7, v0 * 32 + 2, 32) - 0.5) * 0.022;
    const out = [];
    let id = 0;
    layers.forEach(([n, cells], l) => {
      const px = (u0 + wx) * n, py = (v0 + wy) * n;
      const cx = Math.floor(px), cy = Math.floor(py);
      let d1 = 9, d2 = 9, best = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const k = (((cx + i) % n) + n) % n + ((((cy + j) % n) + n) % n) * n;
        const c = cells[k];
        const d = Math.hypot(cx + i + c[0] - px, cy + j + c[1] - py);
        if (d < d1) { d2 = d1; d1 = d; best = c[2]; } else if (d < d2) d2 = d;
      }
      out[l] = Math.min(1, (d2 - d1) * 1.4);
      if (l === 0) id = best;
    });
    const i = (y * size + x) * 4;
    data[i] = out[0] * 255; data[i + 1] = out[1] * 255;
    data[i + 2] = (vn(u0 * 4, v0 * 4, 4) * 0.5 + vn(u0 * 8, v0 * 8, 8) * 0.3 + vn(u0 * 16, v0 * 16, 16) * 0.2) * 255;
    data[i + 3] = id * 255;
  }
  const t = new DataTexture(data, size, size, RGBAFormat);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.generateMipmaps = true;
  t.minFilter = LinearMipmapLinearFilter; t.magFilter = LinearFilter;
  t.anisotropy = 8; t.needsUpdate = true;
  return t;
}
