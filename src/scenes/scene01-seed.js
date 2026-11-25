import { Scene, Group, Mesh, SpotLight, DirectionalLight, Color, Vector3 } from 'three';
import { CameraRig } from '../camera.js';
import { beanMaterial } from '../objects/coffeeBean.js';
import { createDust } from '../objects/particles.js';
import { Q } from '../quality.js';

/** 01 — The Seed. One bean, darkness, and an approach. */
export function createSeed(assets, env) {
  const scene = new Scene();
  scene.background = new Color(0.0012, 0.001, 0.0009);

  const mat = beanMaterial(assets, { env, envIntensity: 0.28 });
  const mesh = new Mesh(assets.bean.geometry, mat);
  mesh.castShadow = mesh.receiveShadow = true;
  // Stand the bean up with its crease toward +z.
  mesh.rotation.x = Math.PI / 2;
  const bean = new Group();
  bean.add(mesh);
  scene.add(bean);

  const rim = new SpotLight(new Color(1, 0.52, 0.2), 0, 0, 0.5, 0.8, 1.4);
  rim.position.set(2.6, 1.6, -2.6);
  const kick = new SpotLight(new Color(1, 0.6, 0.32), 0, 0, 0.5, 0.9, 1.4);
  kick.position.set(-2.8, -0.6, -1.8);
  const key = new SpotLight(new Color(1, 0.82, 0.64), 0, 0, 0.45, 0.9, 1.4);
  key.position.set(-2.4, 3.2, 3.0);
  key.castShadow = true;
  key.shadow.mapSize.setScalar(Math.min(Q.shadow, 1024));
  key.shadow.camera.near = 1.5; key.shadow.camera.far = 8;
  key.shadow.bias = -0.0012; key.shadow.normalBias = 0.006; key.shadow.radius = 3;
  const fill = new DirectionalLight(new Color(0.55, 0.62, 0.75), 0);
  fill.position.set(1.5, -1, 4);
  scene.add(rim, rim.target, kick, kick.target, key, key.target, fill);

  const dust = createDust({ count: Math.round(Q.dust * 0.5), box: [7, 5, 7], size: 0.02, seed: 3 });
  scene.add(dust);

  const rig = new CameraRig([
    { t: 0, pos: [0, 0.1, 12.5], look: [0, -0.62, 0], fov: 30 },
    { t: 5, pos: [0.9, 0.35, 8.6], look: [0, -0.3, 0], fov: 31 },
    { t: 10, pos: [0.5, 0.35, 3.7], look: [0, 0, 0], fov: 34, roll: 0.05 },
    { t: 14, pos: [0.1, 0.16, 1.55], look: [0.0, 0.02, 0], fov: 40, roll: 0.02 },
    { t: 17, pos: [0.03, 0.05, 0.78], look: [0.01, 0.02, 0], fov: 46 },
    { t: 20, pos: [0.02, 0.03, 0.42], look: [0.01, 0.02, -0.4], fov: 52 },
  ], { near: 0.02, far: 40, parallax: 0.035, portraitFov: 0.6 });

  const v = new Vector3();
  return {
    scene, rig, camera: rig.camera,
    update(S, I, time, dt, px) {
      const t = S.seedTurn;
      bean.rotation.set(
        -0.5 * (1 - t) + Math.sin(time * 0.31) * 0.03 * (1 - t),
        -0.95 * (1 - t) + time * 0 + Math.sin(time * 0.2) * 0.07 * (1 - t) + 0.02,
        0.62 * (1 - t) + 0.1 * t + Math.sin(time * 0.17) * 0.02 * (1 - t));
      bean.position.y = Math.sin(time * 0.5) * 0.025 * (1 - t);
      const r = S.seedReveal;
      // Rims ease off as the lens closes, so the macro reads as surface, not glare.
      const near = 1 - 0.86 * S.macro;
      rim.intensity = 46 * r * near;
      kick.intensity = 8 * r * near;
      key.intensity = r * (3 + 34 * S.seedKey);
      fill.intensity = 0.05 + 0.25 * S.seedKey;
      mat.envMapIntensity = 0.05 + 0.2 * r + 0.15 * S.seedKey;
      mat.userData.u.uMacro.value = S.macro;
      mat.userData.u.uTime.value = time;
      const u = dust.material.uniforms;
      u.uTime.value = time; u.uPx.value = px; u.uAmt.value = 0.55 * r; u.uFlow.value.copy(v.set(0, 0, S.p * 0.06));
    },
  };
}
