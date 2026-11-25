import { Vector3 } from 'three';

/**
 * Non-uniform cubic Hermite camera track.
 * Keys are placed directly on master progress (0–100), so the path is a pure
 * function of scroll and always reverses exactly.
 */
export class Track {
  constructor(keys) {
    this.keys = keys;
    this.values = keys.map((k) => [...k.pos, ...k.look, k.fov ?? 35, k.roll ?? 0]);
    this.n = 8;
    this.tangents = this.values.map((_, i) => {
      if (i === 0 || i === keys.length - 1) return new Array(this.n).fill(0);
      const a = keys[i - 1].t, b = keys[i].t, c = keys[i + 1].t;
      return this.values[i].map((v, k) => {
        const s0 = (v - this.values[i - 1][k]) / (b - a);
        const s1 = (this.values[i + 1][k] - v) / (c - b);
        // Weighted by the opposite interval: smooth speed across uneven keys.
        return (s0 * (c - b) + s1 * (b - a)) / (c - a);
      });
    });
    this.out = new Array(this.n).fill(0);
    this.pos = new Vector3();
    this.look = new Vector3();
    this.fov = 35;
    this.roll = 0;
  }

  sample(t) {
    const k = this.keys;
    const last = k.length - 1;
    let i = 0;
    const tt = Math.min(Math.max(t, k[0].t), k[last].t);
    while (i < last - 1 && tt > k[i + 1].t) i++;
    const h = k[i + 1].t - k[i].t;
    const x = (tt - k[i].t) / h;
    const x2 = x * x, x3 = x2 * x;
    const a = 2 * x3 - 3 * x2 + 1, b = x3 - 2 * x2 + x, c = -2 * x3 + 3 * x2, d = x3 - x2;
    for (let n = 0; n < this.n; n++) {
      this.out[n] = a * this.values[i][n] + b * h * this.tangents[i][n]
        + c * this.values[i + 1][n] + d * h * this.tangents[i + 1][n];
    }
    this.pos.set(this.out[0], this.out[1], this.out[2]);
    this.look.set(this.out[3], this.out[4], this.out[5]);
    this.fov = this.out[6];
    this.roll = this.out[7];
    return this;
  }
}
