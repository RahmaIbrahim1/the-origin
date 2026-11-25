import {
  BufferGeometry, BufferAttribute, CanvasTexture, SRGBColorSpace, MeshPhysicalMaterial, Mesh, Group, DoubleSide,
  CylinderGeometry, MeshStandardMaterial, TorusGeometry,
} from 'three';
import { noise3, fbm3, lerp, smooth } from '../utils/math.js';
import { Q } from '../quality.js';

/*
 * A side-gusset coffee pouch built from scratch: front, back, two folded gussets,
 * base, and a crimped heat-seal. Units: 1.5 wide, 2.6 tall, 0.82 deep.
 */
const W = 1.5, H = 2.6, D = 0.82, SEAL = 0.885;

const depthAt = (v) => {
  if (v >= SEAL) return 0.012;
  const t = v / SEAL;
  return lerp(D, 0.012, Math.pow(t, 2.3)) * (0.9 + 0.1 * Math.sin(Math.min(1, t * 3) * Math.PI * 0.5));
};
const halfW = (v) => (W / 2) * (1 + 0.012 * Math.sin(v * 9) - 0.012 * smooth(0, 0.06, 0.06 - v));

/** One panel of the pouch as a displaced grid. fn(u, v) -> [x, y, z]. */
function panel(nu, nv, fn, flip) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const u = i / nu, v = j / nv;
    pos.push(...fn(u, v)); uv.push(u, v);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
    if (flip) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const face = (sign) => (u, v) => {
  const x = (u * 2 - 1), hw = halfW(v), d = depthAt(v);
  const edge = 1 - Math.pow(Math.abs(x), 6);
  // Contents press outward low in the body; film tension creases toward the seal.
  const belly = 0.085 * Math.sin(Math.PI * Math.min(1, v / SEAL)) * (1 - x * x) * smooth(SEAL, 0.5, v);
  const near = smooth(0.42, 0.84, v) * (1 - smooth(SEAL - 0.04, SEAL, v));
  const crease = (fbm3(x * 2.1 + sign * 4, v * 3.2, 2, 3) - 0.45) * 0.085 * near
    + (noise3(x * 7 + v * 5, v * 2.5, 7 + sign) - 0.5) * 0.026 * near
    + (fbm3(x * 3.1, v * 4.4, 9 + sign, 3) - 0.45) * 0.022;
  const crimp = v > SEAL ? Math.sin(v * 520) * 0.0035 * smooth(SEAL, SEAL + 0.012, v) * (1 - smooth(0.985, 1, v)) : 0;
  const z = sign * (d / 2 * (0.96 + 0.04 * edge) + (belly + crease) * edge + crimp);
  return [x * hw, v * H - H / 2, v >= SEAL ? sign * 0.008 + crimp : z];
};

const gusset = (sign) => (u, v) => {
  const s = u * 2 - 1, d = depthAt(v), hw = halfW(v);
  const fold = smooth(0.02, 0.5, v) * (1 - smooth(SEAL - 0.02, SEAL, v));
  const inX = (1 - Math.abs(s)) * d * 0.52 * fold;
  const wob = (noise3(s * 3, v * 6, 4 + sign) - 0.5) * 0.03 * (1 - s * s) * (1 - smooth(0.75, SEAL, v));
  return [sign * (hw - inX + wob), v * H - H / 2, v >= SEAL ? s * 0.008 : s * d / 2 * 0.96];
};

const COPPER = '#d28a55', CREAM = '#d9c9b4', BODY = '#14100e';

/** Printed artwork: colour, plus a mask of where copper foil is stamped. */
function artwork(side) {
  const w = Q.tier === 'low' ? 640 : 1152, h = Math.round(w * (H / W)), k = w / 1000;
  const mk = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const colour = mk(), mr = mk(), bump = mk();
  const c = colour.getContext('2d'), m = mr.getContext('2d'), b = bump.getContext('2d');
  // glTF packing: G roughness, B metalness.
  const MATTE = 'rgb(0,150,0)', FOIL = 'rgb(0,72,255)', INK = 'rgb(0,120,0)';
  c.fillStyle = BODY; c.fillRect(0, 0, w, h);
  m.fillStyle = MATTE; m.fillRect(0, 0, w, h);
  b.fillStyle = '#808080'; b.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) {
    const g = 118 + Math.random() * 20; b.fillStyle = `rgb(${g},${g},${g})`;
    b.fillRect(Math.random() * w, Math.random() * h, 1.6 * k, 1.6 * k);
  }
  const each = (fn, ink, rough, raise) => {
    c.fillStyle = c.strokeStyle = ink; fn(c);
    m.fillStyle = m.strokeStyle = rough; fn(m);
    if (raise) { b.fillStyle = b.strokeStyle = raise; fn(b); }
  };
  const text = (str, x, y, size, font, spacing, align, ink, rough, raise) => each((g) => {
    g.font = `${size * k}px ${font}`; g.letterSpacing = `${spacing * k}px`; g.textAlign = align; g.textBaseline = 'alphabetic';
    g.fillText(str, x * k, y * k);
  }, ink, rough, raise);
  const rule = (x, y, len, t = 1.6) => each((g) => g.fillRect(x * k, y * k, len * k, t * k), COPPER, FOIL, '#b0b0b0');
  const SANS = '"Instrument Sans"', DISP = 'Italiana';
  const bottom = h / k;

  if (side === 'front') {
    // Survey of the crease: the canyon from scene two, drawn as contour lines.
    each((g) => {
      g.lineWidth = 1.7 * k;
      const cx = 500, cy = 865, RX = 250, RY = 340;
      for (let r = 1; r <= 15; r++) {
        const q = r / 15;
        for (const s of [-1, 1]) {
          g.beginPath();
          for (let i = 0; i <= 120; i++) {
            const t = (i / 120) * 2 - 1;
            const env = Math.sqrt(Math.max(0, 1 - t * t));
            const crease = Math.sin(t * 2.7) * 34;
            const wob = (fbm3(t * 2.4 + s * 7, q * 2.6, 3, 3) - 0.45) * 60 * Math.sin(q * 3.14);
            const x = cx + crease * (1 - q * 0.75) + s * (9 + (RX - 9) * Math.pow(q, 0.86)) * env + wob * env;
            const y = cy + t * RY * (0.93 + 0.07 * q);
            if (i) g.lineTo(x * k, y * k); else g.moveTo(x * k, y * k);
          }
          g.stroke();
        }
      }
    }, COPPER, FOIL, '#c4c4c4');
    text('LOT 001', 110, 398, 21, SANS, 5, 'left', COPPER, INK);
    text('250 G', 890, 398, 21, SANS, 5, 'right', COPPER, INK);
    rule(110, 424, 780);
    text('THE', 124, 1298, 42, DISP, 17, 'left', CREAM, INK, '#a8a8a8');
    text('ORIGIN', 498, 1462, 178, DISP, 13, 'center', CREAM, INK, '#a8a8a8');
    rule(110, 1518, 780);
    text('TERRA PRIMA', 110, 1566, 23, SANS, 6, 'left', CREAM, INK);
    text('GUJI, ETHIOPIA', 890, 1566, 23, SANS, 5, 'right', COPPER, INK);
  } else {
    text('THE ORIGIN', 110, 470, 64, DISP, 8, 'left', CREAM, INK, '#a8a8a8');
    rule(110, 510, 780);
    const copy = ['A single seed, grown above the', 'clouds of Guji, dried slowly on', 'raised beds and roasted until the', 'world inside it opened.'];
    copy.forEach((l, i) => text(l, 110, 606 + i * 58, 43, DISP, 1, 'left', CREAM, INK));
    const rows = [['ALTITUDE', '2,100 m'], ['VARIETY', 'Heirloom'], ['PROCESS', 'Natural, 21 days'], ['ROAST', 'Medium dark'], ['NOTES', 'Black fig, raw cacao, burnt honey']];
    rows.forEach(([a, d], i) => {
      const y = 960 + i * 84;
      rule(110, y - 48, 780, 1);
      text(a, 110, y, 20, SANS, 4, 'left', COPPER, INK);
      text(d, 890, y, 27, SANS, 0.5, 'right', CREAM, INK);
    });
    text('LOT 001', 110, bottom - 150, 21, SANS, 5, 'left', COPPER, FOIL);
    text('BEST WITHIN 60 DAYS OF ROAST', 890, bottom - 150, 19, SANS, 3, 'right', COPPER, FOIL);
  }
  // Copper foil line under the heat seal.
  each((g) => g.fillRect(0, h * (1 - SEAL) + 8 * k, w, 7 * k), COPPER, FOIL, '#b0b0b0');

  const tex = (cv, srgb) => {
    const t = new CanvasTexture(cv);
    if (srgb) t.colorSpace = SRGBColorSpace;
    t.anisotropy = 16;
    return t;
  };
  return { map: tex(colour, true), mr: tex(mr), bump: tex(bump) };
}

export function createPouch(env) {
  const group = new Group();
  const mk = (art) => new MeshPhysicalMaterial({
    color: art ? 0xffffff : 0x14100e, roughness: art ? 1 : 0.6, metalness: art ? 1 : 0, bumpScale: 1.6,
    envMap: env, envMapIntensity: 1.05, side: DoubleSide,
    sheen: 0.06, sheenRoughness: 0.5,
    ...(art && { map: art.map, roughnessMap: art.mr, metalnessMap: art.mr, bumpMap: art.bump }),
  });
  const [nu, nv] = Q.tier === 'low' ? [36, 120] : [64, 260];
  const front = new Mesh(panel(nu, nv, face(1), false), mk(artwork('front')));
  const back = new Mesh(panel(nu, nv, (u, v) => face(-1)(1 - u, v), false), mk(artwork('back')));
  const plain = mk(null);
  const left = new Mesh(panel(24, 120, gusset(-1), false), plain);
  const right = new Mesh(panel(24, 120, (u, v) => gusset(1)(1 - u, v), false), plain);
  const base = new Mesh(panel(12, 12, (u, v) => {
    const x = u * 2 - 1, z = v * 2 - 1;
    return [x * halfW(0), -H / 2 + 0.03 * (1 - x * x) * (1 - z * z), z * D / 2 * 0.86];
  }, true), plain);
  group.add(front, back, left, right, base);

  // Degassing valve.
  const steel = new MeshStandardMaterial({ color: 0x1b1512, roughness: 0.42, metalness: 0.2, envMap: env });
  const valve = new Mesh(new CylinderGeometry(0.062, 0.066, 0.014, 48), steel);
  const ring = new Mesh(new TorusGeometry(0.064, 0.006, 10, 48), new MeshStandardMaterial({ color: 0xc27a45, roughness: 0.3, metalness: 1, envMap: env }));
  const vy = 0.805, p = face(1)(0.5, vy), q = face(1)(0.5, vy + 0.02);
  const tilt = Math.atan2(q[2] - p[2], q[1] - p[1]);
  for (const o of [valve, ring]) { o.position.set(p[0], p[1], p[2] + 0.004); }
  valve.rotation.x = Math.PI / 2 + tilt; ring.rotation.x = tilt;
  group.add(valve, ring);

  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.userData.height = H;
  return group;
}
