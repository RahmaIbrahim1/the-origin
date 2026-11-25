import { Scene, Color, SpotLight, PointLight, FogExp2, Mesh, PlaneGeometry, ShaderMaterial, AdditiveBlending, DirectionalLight } from 'three';
import { CameraRig } from '../camera.js';
import { createFragments } from '../objects/fragments.js';
import { createGrains, createChunks, createDust } from '../objects/particles.js';
import { createBrew } from './scene05-brew.js';
import { Q } from '../quality.js';

/** 04 — Collapse. The world is a bean again, and it comes apart. Scene 05 continues in this space. */
export function createCollapse(assets, env) {
  const SCALE = 2;
  const scene = new Scene();
  const bg = new Color(0.004, 0.0022, 0.0014);
  scene.background = bg;
  scene.fog = new FogExp2(bg, 0.028);

  const geo = assets.bean.geometry.clone();
  geo.rotateX(Math.PI / 2); geo.rotateZ(0.1);
  const frag = createFragments(geo, assets, env, SCALE);
  scene.add(frag.mesh);

  const grains = createGrains(geo, Q.grains, SCALE);
  const chunks = createChunks(grains, Q.chunks, env);
  scene.add(grains.points, chunks);

  const rim = new SpotLight(new Color(1, 0.6, 0.3), 0, 0, 0.7, 0.8, 1.2);
  rim.position.set(6, 5, -6);
  const key = new SpotLight(new Color(1, 0.8, 0.6), 0, 0, 0.6, 0.9, 1.2);
  key.position.set(-6, 5, 7);
  const core = new PointLight(new Color(1, 0.42, 0.11), 0, 16, 1.5);
  scene.add(rim, rim.target, key, key.target, core);

  const glow = new Mesh(new PlaneGeometry(1, 1), new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending,
    uniforms: { uA: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;vec4 m=modelViewMatrix*vec4(0.,0.,0.,1.);m.xy+=position.xy*7.5;gl_Position=projectionMatrix*m;}',
    fragmentShader: 'uniform float uA;varying vec2 vUv;void main(){float r=length(vUv-.5)*2.;float a=pow(max(1.-r,0.),3.);gl_FragColor=vec4(vec3(1.,.33,.07)*a*uA,1.);}',
  }));
  scene.add(glow);

  const dust = createDust({ count: Math.round(Q.dust * 0.5), box: [14, 12, 14], size: 0.028, seed: 51 });
  scene.add(dust);

  const brew = createBrew(scene, env);

  const rig = new CameraRig([
    { t: 48, pos: [0.05, 0.1, 1.5], look: [0, 0, 0], fov: 46 },
    { t: 51, pos: [0.1, 0.2, 2.6], look: [0, 0, 0], fov: 42 },
    { t: 55, pos: [1.6, 0.9, 8.4], look: [0, 0.05, 0], fov: 33, roll: -0.03 },
    { t: 59, pos: [-1.3, 0.5, 7.2], look: [0, 0, 0], fov: 36, roll: 0.02 },
    { t: 62.5, pos: [-0.9, 0.35, 3.8], look: [0.1, -0.1, -1.4], fov: 44, roll: 0.06 },
    { t: 65.2, pos: [0.5, 2.4, 2.2], look: [0.1, -2.6, -6], fov: 52, roll: 0.03 },
    { t: 68.5, pos: [0.4, 3.9, -1.2], look: [0, -6.5, -9.6], fov: 54, roll: -0.05 },
    { t: 72, pos: [2.6, 0.2, -3.6], look: [-0.3, -8, -10.4], fov: 50, roll: 0.08 },
    { t: 75.5, pos: [4.2, -4.0, -8.2], look: [-1.3, -11.6, -10.6], fov: 50, roll: 0.14 },
    { t: 79, pos: [1.0, -8.4, -12.6], look: [0, -17, -9.8], fov: 52, roll: 0.02 },
    { t: 82, pos: [-0.7, -13.6, -10.5], look: [0.05, -21, -10], fov: 52, roll: -0.12 },
    { t: 86, pos: [0, -20.4, -10], look: [0, -25, -10.02], fov: 54, roll: 0 },
  ], { near: 0.04, far: 70, parallax: 0.035, portraitFov: 0.7 });

  const side = new DirectionalLight(new Color(1, 0.7, 0.42), 0);
  side.position.set(8, 6, 4);
  scene.add(side);

  return {
    scene, rig, camera: rig.camera,
    update(S, I, time, dt, px) {
      const f = frag.u;
      f.uOpen.value = S.crackOpen; f.uSplit.value = S.split; f.uShatter.value = S.shatter; f.uDissolve.value = S.dissolve;
      const breath = 0.9 + 0.1 * Math.sin(time * 1.7);
      f.uGlow.value = S.glow * breath;
      const mu = frag.mat.userData.u;
      mu.uHeat.value = S.glow; mu.uMacro.value = Math.max(0, 1 - (S.p - 49) / 4); mu.uTime.value = time;
      frag.mesh.visible = S.dissolve < 0.999;
      const tremor = S.crackOpen * (1 - S.split) * 0.004;
      frag.mesh.position.set(Math.sin(time * 41) * tremor, Math.cos(time * 37) * tremor, 0);

      const g = grains.uniforms;
      g.uBurst.value = S.burst; g.uGather.value = S.gather; g.uSpin.value = S.spin; g.uMelt.value = S.melt;
      g.uTime.value = time; g.uPx.value = px; g.uHot.value = S.glow * 0.8; g.uLit.value = 1 + 0.15 * S.burst + 1.45 * S.gather ** 3;
      grains.points.visible = chunks.visible = S.burst > 0.002 && S.melt < 0.999;

      const leave = 1 - S.liquid;
      rim.intensity = 55 * (0.35 + 0.65 * leave);
      key.intensity = 13 * leave;
      core.intensity = 22 * S.glow * breath;
      side.intensity = 1.1 * S.burst * (1 - S.melt);
      // The bloom of heat must never flood the lens as the camera passes through it.
      const away = Math.min(1, Math.max(0, (rig.camera.position.length() - 1.6) / 4));
      glow.material.uniforms.uA.value = S.glow * (0.10 + 0.30 * S.split) * (1 - S.gather) * away;
      glow.visible = glow.material.uniforms.uA.value > 0.002;

      const d = dust.material.uniforms;
      d.uTime.value = time; d.uPx.value = px; d.uAmt.value = 0.5 * (1 - S.liquid * 0.6); d.uEmber.value = S.glow; d.uRise.value = S.p * 0.05;
      brew.update(S, time, rig.camera);
    },
  };
}
