import { S } from './state.js';

/**
 * All sound is synthesised. Nothing is created until the visitor asks for it.
 * Every layer follows the film state, so sound tracks scroll in both directions.
 */
export function createAudio(button) {
  let ctx, master, L, on = false, crackAt = 0, lastP = 0, speed = 0;
  const label = button.querySelector('.lbl');

  const noise = (sec, brown) => {
    const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate), d = b.getChannelData(0);
    let l = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { l = (l + 0.02 * w) / 1.02; d[i] = l * 3.2; } else d[i] = w;
    }
    const fade = Math.floor(ctx.sampleRate * 0.1);
    for (let i = 0; i < fade; i++) { const k = i / fade; d[i] = d[i] * k + d[d.length - fade + i] * (1 - k); }
    const s = ctx.createBufferSource();
    s.buffer = b; s.loop = true; s.loopEnd = sec - 0.1; s.start();
    return s;
  };
  const layer = (src, type, freq, q) => {
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = 0;
    src.connect(f).connect(g).connect(master);
    return { f, g };
  };
  function build() {
    ctx = new AudioContext();
    master = ctx.createGain(); master.gain.value = 0;
    master.connect(ctx.createDynamicsCompressor()).connect(ctx.destination);
    const bus = ctx.createGain(); bus.gain.value = 0.22;
    [41.2, 61.9, 82.6, 123.4].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      o.type = i ? 'sine' : 'triangle'; o.frequency.value = f; o.detune.value = (i - 1.5) * 5;
      g.gain.value = 0.34 / (i + 1); lfo.frequency.value = 0.04 + i * 0.023; lg.gain.value = 0.12 / (i + 1);
      lfo.connect(lg).connect(g.gain); o.connect(g).connect(bus); o.start(); lfo.start();
    });
    L = {
      drone: layer(bus, 'lowpass', 320, 0.4),
      wind: layer(noise(5, true), 'bandpass', 260, 0.7),
      fire: layer(noise(4, true), 'lowpass', 520, 0.3),
      grit: layer(noise(3), 'bandpass', 2600, 0.8),
      pour: layer(noise(4), 'bandpass', 820, 1.1),
      deep: layer(noise(4, true), 'lowpass', 140, 0.6),
    };
  }
  const crack = (vol, lo) => {
    const len = 0.02 + Math.random() * 0.07, n = ctx.createBufferSource();
    const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * len), ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 5);
    n.buffer = b;
    const f = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner();
    f.type = 'bandpass'; f.frequency.value = lo + Math.random() * 2600; f.Q.value = 1.5;
    g.gain.value = vol; p.pan.value = Math.random() * 1.6 - 0.8;
    n.connect(f).connect(g).connect(p).connect(master);
    n.start();
  };

  button.addEventListener('click', async () => {
    on = !on;
    button.setAttribute('aria-pressed', String(on));
    label.textContent = on ? 'Sound on' : 'Sound off';
    if (on && !ctx) build();
    if (on) await ctx.resume();
    master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.4);
    if (!on) setTimeout(() => { if (!on) ctx.suspend(); }, 1800);
  });
  document.addEventListener('visibilitychange', () => {
    if (!ctx || !on) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });

  return {
    update(time, dt) {
      speed += (Math.min(1, Math.abs(S.p - lastP) / Math.max(dt, 0.001) / 8) - speed) * 0.1;
      lastP = S.p;
      if (!on || !ctx) return;
      const set = (k, v) => L[k].g.gain.setTargetAtTime(v, ctx.currentTime, 0.18);
      const heat = S.heat * (1 - S.mixBC) + S.glow * S.mixBC * (1 - S.gather);
      const brk = S.mixBC * S.split * (1 - S.gather), fluid = S.liquid * (1 - S.submerge) * (1 - S.mixCD);
      set('drone', 0.55 - 0.25 * S.studio);
      set('wind', 0.5 * S.mixAB * (1 - heat) * (1 - S.mixBC));
      set('fire', 0.8 * heat);
      set('grit', 0.05 * brk + 0.09 * speed * S.burst * (1 - S.melt) + 0.02 * S.gather * (1 - S.melt));
      set('pour', 0.06 * fluid * (0.6 + speed));
      set('deep', 0.4 * S.submerge + 0.25 * S.fissure * (1 - S.gather));
      L.pour.f.frequency.setTargetAtTime(620 + 260 * Math.sin(time * 1.3) * Math.sin(time * 2.9), ctx.currentTime, 0.1);
      L.drone.f.frequency.setTargetAtTime(240 + 420 * heat - 120 * S.submerge, ctx.currentTime, 0.3);
      const rate = heat * 9 + brk * 14;
      if (rate > 0.2 && time > crackAt) {
        crack(0.12 + Math.random() * 0.35 * Math.max(heat, brk), brk > 0.1 ? 700 : 1400);
        crackAt = time + (0.02 + Math.random() * 0.4) / Math.max(0.5, rate / 4);
      }
    },
  };
}
