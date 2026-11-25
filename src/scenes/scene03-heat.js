import { PointLight, Color } from 'three';
import { pathX, pathY } from '../objects/terrain.js';

/** 03 — Heat. Adds real light to the descent: fissure sources that wake along the path. */
export function createHeat(scene, terrain) {
  const spots = [[-98, 6, 1.5], [-128, -4, 1], [-158, 3, 1.5], [-190, -1.2, 2]];
  const lights = spots.map(([z, dx, y]) => {
    const l = new PointLight(new Color(1, 0.4, 0.1), 0, 46, 1.6);
    l.position.set(pathX(z) + dx, pathY(z) + y, z);
    scene.add(l);
    return l;
  });
  const end = new PointLight(new Color(1, 0.48, 0.16), 0, 60, 1.4);
  end.position.copy(terrain.fissure.position);
  end.position.z += 4;
  scene.add(end);

  return {
    update(S, time, cam) {
      lights.forEach((l, i) => {
        const breath = 0.86 + 0.14 * Math.sin(time * 1.1 + i * 1.9) * Math.sin(time * 0.63 + i);
        const wake = Math.min(1, Math.max(0, S.heat * 1.9 - 0.25 * Math.max(0, (cam.position.z - l.position.z) / 70)));
        l.intensity = 85 * wake * wake * breath;
      });
      end.intensity = 120 * S.fissure * (0.92 + 0.08 * Math.sin(time * 2.1));
      terrain.fissure.material.uniforms.uOpen.value = S.fissure;
      terrain.fissure.visible = S.fissure > 0.001 || S.heat > 0.2;
    },
  };
}
