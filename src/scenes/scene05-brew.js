import { SpotLight, PointLight, Color } from 'three';
import { createFunnel, createRibbons } from '../objects/liquid.js';

/** 05 — The Brew. Grains find an order, then a fluid. Lives in the collapse space. */
export function createBrew(scene, env) {
  const funnel = createFunnel(env);
  const ribbons = createRibbons(env);
  scene.add(funnel.mesh, ribbons.mesh);

  const top = new SpotLight(new Color(1, 0.72, 0.44), 0, 0, 0.8, 0.9, 1.1);
  top.position.set(-9, 13, -18);
  top.target.position.set(1, -10, -9);
  const deep = new PointLight(new Color(1, 0.45, 0.13), 0, 14, 1.4);
  deep.position.set(0, -18.5, -10);
  const follow = new PointLight(new Color(1, 0.66, 0.36), 0, 16, 1.6);
  scene.add(top, top.target, deep, follow);

  return {
    update(S, time, cam) {
      const on = S.liquid > 0.002;
      funnel.mesh.visible = on;
      ribbons.mesh.visible = S.ribbons > 0.002 && S.melt < 0.999;
      funnel.u.uTime.value = ribbons.u.uTime.value = time;
      funnel.u.uSpin.value = ribbons.u.uSpin.value = S.spin;
      funnel.u.uLiquid.value = S.liquid; funnel.u.uCalm.value = S.melt;
      ribbons.u.uGrow.value = S.ribbons; ribbons.u.uFade.value = S.melt;
      funnel.mesh.material.envMapIntensity = 0.5 + 0.25 * S.liquid;
      ribbons.mesh.material.envMapIntensity = 0.8;
      top.intensity = 70 * S.gather * (1 - 0.55 * S.melt);
      deep.intensity = 5 * S.liquid * (1 - 0.5 * S.melt) * (0.9 + 0.1 * Math.sin(time * 0.8));
      follow.position.set(cam.position.x * 0.5, cam.position.y - 2.4, -10 + (cam.position.z + 10) * 0.4);
      follow.intensity = 3.2 * S.liquid;
    },
  };
}
