import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { S, I } from './state.js';
import { FILM_LENGTH } from './config.js';

gsap.registerPlugin(ScrollTrigger);

/** Split lines into words and characters so each letter can resolve on its own. */
function split() {
  document.querySelectorAll('.act .line').forEach((el) => {
    const text = el.textContent;
    const sr = document.createElement('span');
    sr.className = 'sr'; sr.textContent = text;
    el.textContent = '';
    el.append(sr);
    text.split(' ').forEach((word, i) => {
      if (i) el.append(' ');
      const w = document.createElement('span');
      w.className = 'w'; w.setAttribute('aria-hidden', 'true');
      [...word].forEach((c) => {
        const s = document.createElement('span');
        s.className = 'ch'; s.textContent = c; w.append(s);
      });
      el.append(w);
    });
  });
}

export function createTimeline() {
  split();
  document.getElementById('scroll').style.height = `${FILM_LENGTH * 100}vh`;
  const $ = (q) => gsap.utils.toArray(q);

  // Master. Units are percent of the film; every value below is placed on that ruler.
  const tl = gsap.timeline({ defaults: { ease: 'none' }, paused: true });
  const to = (vars, at, dur, ease = 'none') => tl.to(S, { ...vars, duration: dur, ease }, at);
  to({ p: 100 }, 0, 100);

  // 01 — The Seed
  to({ seedTurn: 1 }, 2.5, 11.5, 'sine.inOut');
  to({ seedKey: 1 }, 4, 9, 'sine.inOut');
  to({ macro: 1 }, 9, 7, 'sine.in');
  to({ mixAB: 1 }, 15.4, 4.2, 'sine.inOut');

  // 02 — Descent
  to({ cool: 1 }, 15, 6, 'sine.out');
  to({ mist: 1 }, 18, 8, 'sine.inOut');
  to({ bloom: 0.3 }, 18, 8);

  // 03 — Heat
  to({ heat: 1 }, 32, 16, 'sine.in');
  to({ mist: 0.35 }, 34, 10, 'sine.inOut');
  to({ ember: 1 }, 35, 11, 'sine.inOut');
  to({ smoke: 1 }, 36, 10, 'sine.inOut');
  to({ distort: 1 }, 38, 8, 'sine.in');
  to({ warmth: 1 }, 34, 12);
  to({ fissure: 1 }, 43, 9, 'power2.in');
  to({ exposure: 1.04 }, 44, 7, 'power2.in');
  to({ mixBC: 1 }, 48.8, 3.4, 'sine.inOut');

  // 04 — Collapse
  to({ exposure: 1 }, 51, 3);
  to({ distort: 0 }, 50.5, 4, 'sine.out');
  to({ crackOpen: 1 }, 50.5, 6.5, 'sine.in');
  to({ split: 1 }, 55.6, 9.4, 'sine.inOut');
  to({ burst: 1 }, 57.8, 8.7, 'sine.out');
  to({ shatter: 1 }, 58.5, 7.5, 'sine.inOut');
  to({ dissolve: 1 }, 61, 6.5, 'sine.inOut');
  to({ glow: 0 }, 61.5, 8, 'sine.inOut');

  // 05 — The Brew
  to({ bloom: 0.14 }, 62, 8);
  to({ gather: 1 }, 62.8, 7.2, 'sine.inOut');
  to({ spin: 1 }, 62.8, 23.2, 'sine.out');
  to({ warmth: 0.6 }, 66, 8);
  to({ liquid: 1 }, 66.6, 8.2, 'sine.inOut');
  to({ ribbons: 1 }, 66.4, 8, 'sine.inOut');
  to({ melt: 1 }, 75.5, 6, 'sine.inOut');
  to({ submerge: 1 }, 82.4, 2.4, 'sine.in');
  to({ mixCD: 1 }, 84.2, 1.6);

  // 06 — The Origin
  to({ rise: 1 }, 85.4, 5.2, 'sine.out');
  to({ submerge: 0 }, 86.2, 2.6, 'sine.out');
  to({ orbit: 1 }, 86, 13, 'sine.inOut');
  to({ bloom: 0.2 }, 86, 6);
  to({ studio: 1 }, 86.6, 6, 'sine.inOut');
  to({ beans: 1 }, 87.2, 7, 'sine.out');

  // Typography. Letters resolve out of blur, and leave the same way.
  const enter = (act, at, dur) => {
    tl.fromTo(`.act-${act}`, { visibility: 'hidden' }, { visibility: 'visible', duration: 0.01 }, at);
    tl.fromTo(`.act-${act} .line .ch`, { opacity: 0, filter: 'blur(14px)', y: '0.16em' },
      { opacity: 1, filter: 'blur(0px)', y: 0, duration: dur * 0.55, ease: 'sine.out', stagger: { amount: dur * 0.45 } }, at);
  };
  const leave = (act, at, dur) => {
    tl.fromTo(`.act-${act} .line .ch`, { opacity: 1, filter: 'blur(0px)' },
      { opacity: 0, filter: 'blur(16px)', duration: dur * 0.6, ease: 'sine.in', stagger: { amount: dur * 0.4, from: 'end' }, immediateRender: false }, at);
  };
  tl.fromTo('.cue', { autoAlpha: 1 }, { autoAlpha: 0, duration: 1.2 }, 0.8);
  tl.fromTo('.act-1 .line', { opacity: 1, filter: 'blur(0px)', x: 0 },
    { opacity: 0, filter: 'blur(14px)', x: (i) => (i ? '5vw' : '-4vw'), duration: 3.4, ease: 'sine.in', stagger: 0.5 }, 4);
  enter(3, 35.5, 3.6); leave(3, 41.2, 2.6);
  enter(4, 54.2, 2.2); leave(4, 59.6, 2.2);
  enter(5, 71, 2.6); leave(5, 77, 2.4);
  enter(6, 89, 3);

  tl.fromTo('.product', { autoAlpha: 0 }, { autoAlpha: 1, duration: 2.4, ease: 'sine.out' }, 94);
  tl.fromTo('.product-front, .product-back, .product .cta', { y: 26 }, { y: 0, duration: 4, ease: 'sine.out', stagger: 0.5 }, 94);

  // Narrow screens hand the frame from headline to product; wide screens hold both.
  const mm = gsap.matchMedia();
  mm.add('(max-aspect-ratio: 17/20)', () => {
    I.headTl = gsap.timeline({ paused: true }).fromTo('.final-head', { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -24, duration: 1, ease: 'none' });
    return () => { I.headTl = null; gsap.set('.final-head', { clearProps: 'all' }); };
  });

  const st = ScrollTrigger.create({
    trigger: document.body, start: 0, end: () => ScrollTrigger.maxScroll(window),
    scrub: I.reduced ? true : 1.1, animation: tl,
  });
  return {
    tl, st,
    scrollTo: (pct) => window.scrollTo({ top: ((st.end - st.start) * pct) / 100, behavior: I.reduced ? 'auto' : 'smooth' }),
    /** Jump without smoothing (testing only). */
    seek(pct) {
      window.scrollTo(0, ((st.end - st.start) * pct) / 100);
      ScrollTrigger.update();
      st.getTween()?.progress(1);
      tl.progress(pct / 100);
    },
    /** Opening: the film fades up on its own clock, before any scroll. */
    open() {
      gsap.to(S, { seedReveal: 1, duration: 4.5, ease: 'sine.inOut' });
      gsap.set('.act-1', { visibility: 'visible' });
      gsap.fromTo('.act-1 .ch', { opacity: 0, filter: 'blur(16px)' },
        { opacity: 1, filter: 'blur(0px)', duration: 2, delay: 1.4, ease: 'sine.out', stagger: { amount: 2.2 } });
    },
  };
}
