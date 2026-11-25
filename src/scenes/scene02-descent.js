import { Scene, FogExp2, Color, DirectionalLight, HemisphereLight, PointLight, Mesh, PlaneGeometry, MeshBasicMaterial, CanvasTexture, Vector3 } from 'three';
import { CameraRig } from '../camera.js';
import { createTerrain, pathX, pathY } from '../objects/terrain.js';
import { createDust, createSmoke } from '../objects/particles.js';
import { createHeat } from './scene03-heat.js';
import { lerp } from '../utils/math.js';
import { Q } from '../quality.js';

/** 02 — Descent. The crease as a world. Scene 03 heats this same place. */
export function createDescent(assets) {
  const scene = new Scene();
  const bg = new Color();
  scene.background = bg;
  scene.fog = new FogExp2(0x000000, 0.02);

  const terrain = createTerrain(assets);
  scene.add(terrain.group);

  const sky = new DirectionalLight(new Color(0.96, 0.82, 0.68), 0);
  sky.position.set(-14, 34, -18);
  sky.target.position.set(0, 0, -30);
  const hemi = new HemisphereLight(new Color(0.40, 0.37, 0.35), new Color(0.07, 0.04, 0.025), 0);
  // A lamp that rides ahead of the lens and rakes the near walls.
  const lamp = new PointLight(new Color(1, 0.74, 0.5), 0, 34, 1.5);
  scene.add(sky, sky.target, hemi, lamp);

  const dust = createDust({ count: Q.dust, box: [26, 18, 34], size: 0.055, color: new Color(0.75, 0.72, 0.66), seed: 12 });
  scene.add(dust);

  const smoke = createSmoke({
    count: Q.smoke,
    place: (i, R) => {
      const z = -10 - (i / Q.smoke) * 198;
      const wide = Math.exp(-(((z + 92) / 32) ** 2));
      return [pathX(z) + (R() - 0.5) * (8 + wide * 22), pathY(z) + R() * (4 + wide * 10), z, 9 + R() * 8 + wide * 12];
    },
  });
  scene.add(smoke);

  // Camera: low through the throat, over the great chamber, down to the fissure.
  const pass = [
    // t, z, lateral, height, look ahead, look dx, look dy, fov, roll
    [14, 9, 0, 6.2, 16, 0, -1.2, 50, 0],
    [18, -8, 0.6, 5.2, 16, 0, -1.0, 48, 0.03],
    [23, -36, -1.3, 3.8, 18, 0.5, 0.2, 46, -0.07],
    [28, -62, 1.6, 5.4, 24, -1, 1.8, 44, 0.06],
    [33, -86, -2.4, 6.8, 26, 1.5, 0.6, 43, 0.04],
    [38, -112, 2.2, 5.0, 22, -0.5, 0.6, 44, -0.06],
    [43, -144, -0.8, 4.2, 20, 0, 0.4, 46, 0.05],
    [47, -172, 0.4, 4.6, 20, 0, 0.4, 48, -0.03],
    [50, -192, 0, 5.0, 18, 0, 0.2, 48, 0],
    [53, -204.5, 0, 5.2, 12, 0, 0, 46, 0],
  ];
  const rig = new CameraRig(pass.map(([t, z, dx, h, ahead, lx, ly, fov, roll]) => {
    const tz = Math.max(z - ahead, -214);
    return { t, pos: [pathX(z) + dx, pathY(z) + h, z], look: [pathX(tz) + lx, pathY(tz) + h * 0.9 + ly, tz], fov, roll };
  }), { near: 0.1, far: 170, parallax: 0.05, portraitFov: 0.65 });

  // Scene title, standing in the canyon as an object the camera travels past.
  const title = createTitle(['A WORLD', 'HIDDEN IN', 'PLAIN SIGHT.']);
  scene.add(title.mesh);

  const heat = createHeat(scene, terrain);
  const cCool = new Color(0.044, 0.034, 0.027), cWarm = new Color(0.040, 0.0125, 0.004), v = new Vector3();

  return {
    scene, rig, camera: rig.camera,
    update(S, I, time, dt, px, aspect) {
      const cam = rig.camera, h = S.heat;
      bg.copy(cCool).multiplyScalar(0.35 + 0.65 * S.cool).lerp(cWarm, h);
      scene.fog.color.copy(bg);
      scene.fog.density = lerp(0.0165, 0.026, S.mist) + 0.004 * h;
      sky.intensity = 8.5 * S.cool * (1 - 0.9 * h);
      sky.position.set(cam.position.x - 14, cam.position.y + 34, cam.position.z - 22);
      sky.target.position.set(cam.position.x + 2, cam.position.y, cam.position.z - 20);
      sky.target.updateMatrixWorld();
      hemi.intensity = 0.8 * S.cool * (1 - 0.8 * h);
      lamp.position.copy(cam.position).add(v.set(-2.6, 2.4, -9));
      lamp.intensity = (12 + 13 * S.cool) * (1 - 0.7 * h);

      terrain.u.uHeat.value = h; terrain.u.uTime.value = time; terrain.u.uCamZ.value = cam.position.z;
      terrain.updateShards(time, h, S.p * 0.09);

      const d = dust.material.uniforms;
      d.uTime.value = time; d.uPx.value = px; d.uAmt.value = S.dust * (0.32 + S.ember * 0.8);
      d.uEmber.value = S.ember; d.uRise.value = S.ember * 5 + S.p * 0.12; d.uSize.value = 0.055 + 0.03 * S.ember;
      const s = smoke.material.uniforms;
      s.uTime.value = time; s.uMist.value = S.mist * (1 - h); s.uSmoke.value = S.smoke;

      title.update(cam, S, aspect);
      heat.update(S, time, cam);
    },
  };
}

function createTitle(lines) {
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 1024;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.font = '250px Italiana'; g.letterSpacing = '10px'; g.textBaseline = 'middle';
  g.textAlign = 'left'; g.fillText(lines[0], 60, 190);
  g.textAlign = 'right'; g.fillText(lines[1], 1990, 500);
  g.fillText(lines[2], 1990, 810);
  const tex = new CanvasTexture(c);
  tex.anisotropy = 16;
  const mat = new MeshBasicMaterial({ alphaMap: tex, color: new Color(0.86, 0.78, 0.68), transparent: true, depthWrite: false, fog: false, opacity: 0 });
  const mesh = new Mesh(new PlaneGeometry(2, 1), mat);
  mesh.renderOrder = 4;
  const z = -74;
  return {
    mesh,
    update(cam, S, aspect) {
      const w = aspect < 0.85 ? 7.5 : 17;
      mesh.position.set(pathX(z) + 0.4, pathY(z) + (aspect < 0.85 ? 7.2 : 7.6), z);
      mesh.scale.setScalar(w / 2);
      mesh.lookAt(cam.position.x, mesh.position.y, cam.position.z);
      const d = cam.position.z - z;
      mat.opacity = Math.min(1, Math.max(0, (52 - d) / 22)) * Math.min(1, Math.max(0, (d - 3) / 9)) * 0.92;
      mesh.visible = mat.opacity > 0.002;
    },
  };
}
