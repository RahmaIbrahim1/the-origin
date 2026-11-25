import { S, I } from './state.js';
import { SCENES, SHOP_URL } from './config.js';

export function createInteractions(film) {
  const ac = new AbortController(), o = { signal: ac.signal };

  if (matchMedia('(hover: hover)').matches && !I.reduced) {
    addEventListener('pointermove', (e) => {
      I.mx = (e.clientX / innerWidth) * 2 - 1;
      I.my = (e.clientY / innerHeight) * 2 - 1;
    }, { ...o, passive: true });
  }

  // Drag to turn the pouch, only once it is on stage.
  let from = null, base = 0;
  addEventListener('pointerdown', (e) => {
    if (S.studio < 0.6 || e.target.closest?.('button,a')) return;
    from = e.clientX; base = I.drag;
  }, o);
  addEventListener('pointermove', (e) => { if (from !== null) I.drag = base + (e.clientX - from) * 0.006; }, { ...o, passive: true });
  const up = () => { from = null; };
  addEventListener('pointerup', up, o);
  addEventListener('pointercancel', up, o);

  // Scene ticks
  const nav = document.querySelector('.chapters');
  const ticks = SCENES.map((s) => {
    const b = document.createElement('button');
    b.type = 'button'; b.title = s.name;
    b.setAttribute('aria-label', `Scene ${s.n}: ${s.name}`);
    b.append(document.createElement('i'));
    b.addEventListener('click', () => film.scrollTo(s.at), o);
    nav.append(b);
    return b;
  });

  // Final frame
  const disc = document.getElementById('discover'), shop = document.getElementById('shop'), note = document.getElementById('shop-note');
  const front = document.querySelector('.product-front'), back = document.querySelector('.product-back');
  const setDisc = (v) => {
    I.discover = v ? 1 : 0; I.drag = 0;
    front.hidden = v; back.hidden = !v;
    disc.setAttribute('aria-expanded', String(v));
    disc.textContent = v ? 'Back to the front' : 'Discover the coffee';
  };
  disc.addEventListener('click', () => setDisc(!I.discover), o);
  if (SHOP_URL) shop.href = SHOP_URL;
  else {
    shop.addEventListener('click', (e) => {
      e.preventDefault();
      note.textContent = 'Lot 001 is resting after roast. The shop opens soon.';
    }, o);
  }

  const n = document.querySelector('.where .n'), name = document.querySelector('.where .name');
  const starts = [0, 17, 33.5, 50.5, 67, 86];
  let cur = -1;
  return {
    update() {
      let i = 0;
      starts.forEach((s, k) => { if (S.p >= s) i = k; });
      if (i !== cur) {
        cur = i;
        n.textContent = SCENES[i].n; name.textContent = SCENES[i].name;
        ticks.forEach((t, k) => {
          t.classList.toggle('on', k === i);
          if (k === i) t.setAttribute('aria-current', 'step'); else t.removeAttribute('aria-current');
        });
      }
      nav.classList.toggle('away', S.p > 93);
      if (S.studio < 0.6 && (I.discover || I.drag)) { setDisc(false); note.textContent = ''; }
      I.headTl?.progress(Math.min(1, Math.max(0, (S.p - 92.6) / 1.6)));
    },
    dispose: () => ac.abort(),
  };
}
