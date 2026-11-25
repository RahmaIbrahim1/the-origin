import './styles/main.css';
import './styles/responsive.css';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Renderer } from './renderer.js';
import { loadAssets } from './assetManager.js';
import { createWorld } from './scene.js';
import { createTimeline } from './timeline.js';
import { createInteractions } from './interactions.js';
import { createAudio } from './audio.js';
import { S, I } from './state.js';

const loader = document.querySelector('.loader');
const setProgress = (v) => {
  const n = Math.round(v * 100);
  loader.setAttribute('aria-valuenow', n);
  loader.querySelector('.track i').style.transform = `scaleX(${v})`;
  loader.querySelector('.pct').textContent = n;
};
const fail = (e) => {
  console.error(e);
  loader.remove();
  document.querySelector('.fallback').hidden = false;
};

async function boot() {
  history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);
  I.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const R = new Renderer(document.getElementById('stage'));
  const assets = await loadAssets((v) => setProgress(v * 0.6));
  const world = await createWorld(R.gl, assets, (v) => setProgress(0.6 + v * 0.25));
  await world.compile(R.b, (v) => setProgress(0.85 + v * 0.13));

  document.body.classList.remove('is-loading');
  const film = createTimeline();
  const ui = createInteractions(film);
  const audio = createAudio(document.querySelector('.sound'));

  let last = performance.now(), raf = 0, time = 0, acc = 0, frames = 0;
  // Pixels per world unit at distance 1: keeps point sizes physical at any resolution.
  const pxOf = (s) => R.a.height / (2 * Math.tan((s.camera.fov * Math.PI) / 360));

  const frame = (now, manual) => {
    const raw = (now - last) / 1000;
    last = now;
    const dt = Math.min(Math.max(raw, 0), 0.05);
    time += dt * (I.reduced ? 0.35 : 1);

    const [from, to, mix, kind] = world.active();
    for (const s of to ? [from, to] : [from]) {
      s.rig.update(S.p, R.aspect, I.mx, I.my, dt);
      s.update(S, I, time, dt, pxOf(s), R.aspect);
    }
    R.render(from, to, {
      mix: mix ?? 0, kind: kind ?? 0, time, distort: I.reduced ? 0 : S.distort, submerge: S.submerge,
      bloom: S.bloom, exposure: S.exposure, warmth: S.warmth, vignette: S.vignette,
    });
    ui.update();
    audio.update(time, dt);

    // Adaptive resolution: trade pixels, never story.
    if (!manual && raw < 0.25) { acc += raw; frames++; }
    if (frames >= 50) {
      const ms = (acc / frames) * 1000;
      if (ms > 24 && R.dprScale > 0.5) { R.dprScale = Math.max(0.5, R.dprScale * 0.8); R.resize(); }
      else if (ms < 12 && R.dprScale < 1) { R.dprScale = Math.min(1, R.dprScale * 1.08); R.resize(); }
      acc = frames = 0;
    }
  };
  const loop = (now) => { frame(now); raf = requestAnimationFrame(loop); };

  // Draw every space once, off screen, so nothing hitches on first sight.
  for (const s of world.spaces) {
    s.rig.update(0, R.aspect, 0, 0, 0.016);
    s.update({ ...S, liquid: 1, burst: 0.5, ribbons: 1, beans: 1, rise: 1, fissure: 1 }, I, 0, 0.016, 600, R.aspect);
    R.gl.setRenderTarget(R.b);
    R.gl.render(s.scene, s.camera);
  }
  R.gl.setRenderTarget(null);
  setProgress(1);

  let width = innerWidth, timer;
  addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      R.resize();
      // Mobile URL bars change height only; leave the scroll ruler alone for those.
      if (innerWidth !== width) { width = innerWidth; ScrollTrigger.refresh(); }
    }, 80);
  });
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(raf);
    if (!document.hidden) { last = performance.now(); raf = requestAnimationFrame(loop); }
  });
  document.getElementById('stage').addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    cancelAnimationFrame(raf);
    fail(new Error('WebGL context lost'));
  });

  if (import.meta.env.DEV) window.__origin = { S, I, R, world, film, frame: () => frame(performance.now(), true) };

  raf = requestAnimationFrame(loop);
  loader.style.transition = 'opacity 1.4s';
  loader.style.opacity = 0;
  loader.style.pointerEvents = 'none';
  setTimeout(() => loader.remove(), 1500);
  film.open();
}

boot().catch(fail);
