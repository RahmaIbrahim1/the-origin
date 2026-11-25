import { studioEnvironment } from './environment.js';
import { createSeed } from './scenes/scene01-seed.js';
import { createDescent } from './scenes/scene02-descent.js';
import { createCollapse } from './scenes/scene04-collapse.js';
import { createReveal } from './scenes/scene06-reveal.js';
import { S } from './state.js';

const breathe = () => new Promise((r) => setTimeout(r, 0));

/**
 * The film is four connected spaces for six scenes:
 * A seed, B crease (descent + heat), C bean & vortex (collapse + brew), D reveal.
 */
export async function createWorld(gl, assets, onStep) {
  const env = studioEnvironment(gl);
  const A = createSeed(assets, env); onStep(1 / 4); await breathe();
  const B = createDescent(assets); onStep(2 / 4); await breathe();
  const C = createCollapse(assets, env); onStep(3 / 4); await breathe();
  const D = createReveal(assets, env); onStep(1); await breathe();
  const spaces = [A, B, C, D];

  return {
    spaces,
    /** Which one or two spaces are on screen right now: [from, to?, mix?, kind?]. */
    active() {
      if (S.mixCD > 0.0005) return S.mixCD >= 0.9995 ? [D] : [C, D, S.mixCD, 2];
      if (S.mixBC > 0.0005) return S.mixBC >= 0.9995 ? [C] : [B, C, S.mixBC, 1];
      if (S.mixAB > 0.0005) return S.mixAB >= 0.9995 ? [B] : [A, B, S.mixAB, 0];
      return [A];
    },
    /**
     * Build every program in parallel, off the main thread where the driver allows.
     * Must target the offscreen buffer: canvas output uses different program variants.
     */
    async compile(target, onStep) {
      let done = 0;
      gl.setRenderTarget(target);
      const jobs = spaces.map((s) => {
        const hidden = [];
        s.scene.traverse((o) => { if (!o.visible) { hidden.push(o); o.visible = true; } });
        const job = gl.compileAsync(s.scene, s.camera);
        hidden.forEach((o) => { o.visible = false; });
        return job.then(() => onStep(++done / spaces.length));
      });
      gl.setRenderTarget(null);
      await Promise.all(jobs);
    },
  };
}
