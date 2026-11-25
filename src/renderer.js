import {
  WebGLRenderer, WebGLRenderTarget, HalfFloatType, ShaderMaterial, Vector2, NoToneMapping,
  PCFShadowMap, NoBlending,
} from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { Q } from './quality.js';
import { NOISE } from './utils/glsl.js';

const VERT = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';

/**
 * Renders up to two spaces, dissolves them through a directed mask (so one
 * place opens inside another), then bloom, then a single grade pass.
 */
export class Renderer {
  constructor(canvas) {
    this.gl = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    this.gl.toneMapping = NoToneMapping;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = PCFShadowMap;
    this.gl.info.autoReset = false;
    this.maxDpr = Q.dpr;
    this.dprScale = 1;

    const rt = (samples) => new WebGLRenderTarget(4, 4, { type: HalfFloatType, samples });
    this.a = rt(Q.msaa);
    this.b = rt(Q.msaa);
    this.m = rt(0);

    this.mix = new FullScreenQuad(new ShaderMaterial({
      blending: NoBlending, depthTest: false, depthWrite: false, vertexShader: VERT,
      uniforms: {
        tA: { value: null }, tB: { value: null }, uMix: { value: 0 }, uKind: { value: 0 }, uAspect: { value: 1 },
        uTime: { value: 0 }, uDistort: { value: 0 }, uSub: { value: 0 },
      },
      fragmentShader: /* glsl */ `
        uniform sampler2D tA,tB;uniform float uMix,uKind,uAspect,uTime,uDistort,uSub;varying vec2 vUv;
        ${NOISE}
        void main(){
          vec2 uv=vUv;vec2 c=(uv-.5)*vec2(uAspect,1.);
          if(uDistort>.001){
            // Rising heat shimmer, strongest low in frame.
            vec2 q=vec2(c.x*9.,c.y*5.-uTime*1.1);
            vec2 d=vec2(vnoise(vec3(q,uTime*.6)),vnoise(vec3(q+9.,uTime*.6)))-.5;
            uv+=d*uDistort*.012*smoothstep(1.1,0.,vUv.y);
          }
          if(uSub>.001){
            vec2 q=c*2.6;
            vec2 d=vec2(fbm(vec3(q,uTime*.35)),fbm(vec3(q+5.3,uTime*.35)))-.5;
            uv+=d*uSub*.09;
          }
          vec4 A=texture2D(tA,uv);
          vec3 col=A.rgb;
          if(uMix>.0005){
            vec4 B=texture2D(tB,uv);
            float m;
            if(uKind<.5){
              // Seed -> Descent: the crease itself opens, dark parts first.
              float n=fbm(vec3(c*3.2,1.7));
              float lum=dot(A.rgb,vec3(.333));
              float d=abs(c.x+(n-.5)*.22)*1.1+abs(c.y)*.28+lum*1.1+(n-.5)*.5;
              m=smoothstep(-.28,.28,uMix*2.1-.42-d);
            }else if(uKind<1.5){
              // Heat -> Collapse: light burns through, bright parts first.
              float n=fbm(vec3(c*4.,4.2));
              float lum=clamp(dot(A.rgb,vec3(.333))*1.4,0.,1.);
              m=smoothstep(-.3,.3,uMix*2.-.5-(1.-lum)*.55-(n-.5)*.7-length(c)*.12);
            }else{
              m=smoothstep(0.,1.,uMix);
            }
            col=mix(col,B.rgb,m);
          }
          if(uSub>.001){
            // Inside the coffee: absorption plus a slow amber scatter.
            float f=fbm(vec3(c*1.8+vec2(0.,uTime*.12),uTime*.1));
            vec3 liquor=mix(vec3(.010,.0035,.0012),vec3(.26,.088,.018),smoothstep(.35,.95,f+c.y*.35));
            col=mix(col,liquor+col*vec3(.75,.32,.1),uSub*.94);
          }
          gl_FragColor=vec4(min(col,vec3(24.)),1.);
        }`,
    }));

    this.bloom = new UnrealBloomPass(new Vector2(4, 4), 0.35, 0.55, 1.0);

    this.final = new FullScreenQuad(new ShaderMaterial({
      blending: NoBlending, depthTest: false, depthWrite: false, vertexShader: VERT,
      uniforms: { t: { value: null }, uTime: { value: 0 }, uExposure: { value: 1 }, uWarm: { value: 0 }, uVig: { value: 1 }, uAspect: { value: 1 } },
      fragmentShader: /* glsl */ `
        uniform sampler2D t;uniform float uTime,uExposure,uWarm,uVig,uAspect;varying vec2 vUv;
        vec3 aces(vec3 v){
          v=mat3(.59719,.07600,.02840,.35458,.90834,.13383,.04823,.01566,.83777)*v;
          vec3 a=v*(v+.0245786)-.000090537,b=v*(.983729*v+.4329510)+.238081;
          return clamp(mat3(1.60475,-.10208,-.00327,-.53108,1.10813,-.07276,-.07367,-.00605,1.07602)*(a/b),0.,1.);}
        float h(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
        void main(){
          vec2 c=vUv-.5;
          vec2 ca=c*dot(c,c)*.0035;
          vec3 col=vec3(texture2D(t,vUv+ca).r,texture2D(t,vUv).g,texture2D(t,vUv-ca).b);
          col*=uExposure*1.35;
          col*=mix(vec3(1.),vec3(1.06,.99,.88),uWarm);
          float r=length(c*vec2(mix(1.,uAspect,.35),1.));
          col*=1.-uVig*smoothstep(.28,.95,r)*.62;
          col=aces(col);
          col=mix(12.92*col,1.055*pow(col,vec3(1./2.4))-.055,step(.0031308,col));
          float g=h(gl_FragCoord.xy+fract(uTime)*317.)-.5;
          col+=g*(.022+.02*(1.-dot(col,vec3(.333))));
          gl_FragColor=vec4(col,1.);
        }`,
    }));
    this.resize();
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, this.maxDpr) * this.dprScale;
    this.gl.setPixelRatio(dpr);
    this.gl.setSize(w, h, false);
    const pw = Math.max(2, Math.round(w * dpr)), ph = Math.max(2, Math.round(h * dpr));
    for (const t of [this.a, this.b, this.m]) t.setSize(pw, ph);
    this.bloom.setSize(pw >> 1, ph >> 1);
    this.mix.material.uniforms.uAspect.value = this.final.material.uniforms.uAspect.value = w / h;
    this.aspect = w / h;
  }

  render(from, to, opts) {
    const gl = this.gl, mu = this.mix.material.uniforms, fu = this.final.material.uniforms;
    gl.info.reset();
    gl.setRenderTarget(this.a); gl.clear(); gl.render(from.scene, from.camera);
    if (to) { gl.setRenderTarget(this.b); gl.clear(); gl.render(to.scene, to.camera); }
    mu.tA.value = this.a.texture; mu.tB.value = this.b.texture;
    mu.uMix.value = to ? opts.mix : 0; mu.uKind.value = opts.kind;
    mu.uTime.value = opts.time; mu.uDistort.value = opts.distort; mu.uSub.value = opts.submerge;
    gl.setRenderTarget(this.m); this.mix.render(gl);
    if (opts.bloom > 0.01) {
      this.bloom.strength = opts.bloom;
      this.bloom.render(gl, null, this.m, 0, false);
    }
    fu.t.value = this.m.texture; fu.uTime.value = opts.time;
    fu.uExposure.value = opts.exposure; fu.uWarm.value = opts.warmth; fu.uVig.value = opts.vignette;
    gl.setRenderTarget(null); this.final.render(gl);
  }
}
