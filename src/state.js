/**
 * Everything the film needs to know, in one flat object.
 * The GSAP master timeline is the only writer; scenes only read.
 */
export const S = {
  p: 0,             // master progress, 0–100

  // mix between spaces (each is a screen-space dissolve)
  mixAB: 0, mixBC: 0, mixCD: 0,

  // 01 seed
  seedReveal: 0, seedTurn: 0, seedKey: 0, macro: 0,

  // 02 descent
  cool: 0, mist: 0, dust: 1,

  // 03 heat
  heat: 0, smoke: 0, ember: 0, distort: 0, fissure: 0,

  // 04 collapse
  glow: 1, crackOpen: 0, split: 0, shatter: 0, dissolve: 0, burst: 0,

  // 05 brew
  gather: 0, spin: 0, liquid: 0, ribbons: 0, melt: 0, submerge: 0,

  // 06 reveal
  rise: 0, studio: 0, orbit: 0, beans: 0, product: 0,

  // grade
  exposure: 1, warmth: 0, bloom: 0.2, vignette: 1,
};

/** Interaction state; never on the timeline. */
export const I = { mx: 0, my: 0, drag: 0, discover: 0, reduced: false };
