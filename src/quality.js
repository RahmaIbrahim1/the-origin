/** Device tiering. Override with ?q=low|medium|high. */
const coarse = matchMedia('(pointer: coarse)').matches;
const small = Math.min(innerWidth, innerHeight) < 620;
const cores = navigator.hardwareConcurrency || 4;
const mem = navigator.deviceMemory || 8;

let tier = 'high';
if (coarse || small || cores <= 4 || mem <= 4) tier = 'medium';
if ((coarse && small && cores <= 4) || mem <= 2) tier = 'low';
// Integrated graphics cannot carry the full film; discrete GPUs on the same CPU can.
try {
  const gl = document.createElement('canvas').getContext('webgl2', { powerPreference: 'high-performance' });
  const ext = gl?.getExtension('WEBGL_debug_renderer_info');
  const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
  if (/Intel.*(HD|UHD) Graphics|SwiftShader|llvmpipe|Basic Render/i.test(name)) tier = 'low';
  else if (/Intel/i.test(name) && tier === 'high') tier = 'medium';
  gl?.getExtension('WEBGL_lose_context')?.loseContext();
} catch { /* keep the guess from device signals */ }
const forced = new URLSearchParams(location.search).get('q');
if (['low', 'medium', 'high'].includes(forced)) tier = forced;

const presets = {
  high:   { dpr: 1.75, msaa: 4, grains: 56000, chunks: 1100, dust: 2600, terrain: [170, 620], liquid: [220, 260], shadow: 2048, reflect: 640, smoke: 34, beans: 24 },
  medium: { dpr: 1.4,  msaa: 2, grains: 24000, chunks: 520,  dust: 1300, terrain: [110, 400], liquid: [140, 170], shadow: 1024, reflect: 384, smoke: 22, beans: 16 },
  low:    { dpr: 1,    msaa: 0, grains: 11000, chunks: 240,  dust: 700,  terrain: [76, 270],  liquid: [96, 120],  shadow: 512,  reflect: 256, smoke: 14, beans: 11 },
};

export const Q = { tier, ...presets[tier] };
