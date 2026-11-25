export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

/** Deterministic PRNG so every visit and every reload shows the same composition. */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash3 = (x, y, z) => {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647 ^ 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
const f5 = (t) => t * t * t * (t * (t * 6 - 15) + 10);

/** Value noise, 0–1. */
export function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const u = f5(x - xi), v = f5(y - yi), w = f5(z - zi);
  const L = lerp;
  return L(
    L(L(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), L(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v),
    L(L(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), L(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v),
    w,
  );
}
export function fbm3(x, y, z, oct = 4) {
  let a = 0.5, s = 0;
  for (let i = 0; i < oct; i++) {
    s += a * noise3(x, y, z);
    x = x * 2.03 + 17.1; y = y * 2.03 + 3.7; z = z * 2.03 + 9.2; a *= 0.5;
  }
  return s;
}
export function ridged3(x, y, z, oct = 4) {
  let a = 0.5, s = 0;
  for (let i = 0; i < oct; i++) {
    const n = 1 - Math.abs(noise3(x, y, z) * 2 - 1);
    s += a * n * n;
    x = x * 2.07 + 5.3; y = y * 2.07 + 11.9; z = z * 2.07 + 2.6; a *= 0.5;
  }
  return s;
}
