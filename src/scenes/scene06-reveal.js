import { Scene, Color, FogExp2, SpotLight, InstancedMesh, Matrix4, Quaternion, Vector3, Euler, Mesh, PlaneGeometry, ShaderMaterial, PointLight, AdditiveBlending } from 'three';
import { CameraRig } from '../camera.js';
import { createPouch } from '../objects/packaging.js';
import { createPool } from '../objects/pool.js';
import { createDust } from '../objects/particles.js';
import { beanMaterial } from '../objects/coffeeBean.js';
import { rng, lerp, smooth } from '../utils/math.js';
import { Q } from '../quality.js';

/** 06 — The Origin. Out of the coffee, into the light. */
export function createReveal(assets, env) {
  const scene = new Scene();
  const bg = new Color(0.0035, 0.0024, 0.0018);
  scene.background = bg;
  scene.fog = new FogExp2(bg, 0.03);

  const pouch = createPouch(env);
  scene.add(pouch);
  const { pool, under, u: pu } = createPool();
  scene.add(pool, under);

  // Warm wash on the dark behind the product.
  const wash = new Mesh(new PlaneGeometry(15, 11), new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false,
    uniforms: { uA: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform float uA;varying vec2 vUv;void main(){vec2 c=(vUv-vec2(.5,.46))*2.;float a=pow(max(1.-length(c*vec2(1.,1.1)),0.),2.2);gl_FragColor=vec4(vec3(.125,.052,.019)*a*uA,1.);}',
  }));
  wash.position.set(0, 1.9, -5.5);
  scene.add(wash);

  const spot = (c, pos, angle, pen) => {
    const l = new SpotLight(c, 0, 0, angle, pen, 1.3);
    l.position.set(...pos); l.target.position.set(0, 1.4, 0);
    scene.add(l, l.target);
    return l;
  };
  const key = spot(new Color(1, 0.86, 0.7), [-3.6, 5.2, 5.2], 0.42, 0.9);
  key.castShadow = true;
  key.shadow.mapSize.setScalar(Q.shadow);
  key.shadow.camera.near = 3; key.shadow.camera.far = 14;
  key.shadow.bias = -0.0006; key.shadow.normalBias = 0.012; key.shadow.radius = 5;
  const rimR = spot(new Color(1, 0.58, 0.26), [4.2, 3.4, -3.6], 0.5, 0.8);
  const rimL = spot(new Color(1, 0.7, 0.42), [-4.4, 2.2, -3.2], 0.5, 0.8);
  const low = new PointLight(new Color(1, 0.5, 0.18), 0, 7, 1.6);
  low.position.set(0, 0.35, 1.7);
  scene.add(low);

  // Beans hung on two deliberate arcs, never in front of the label.
  const mat = beanMaterial(assets, { env, envIntensity: 0.55 });
  const beans = new InstancedMesh(assets.beanLod.geometry, mat, Q.beans);
  mat.map = assets.beanLod.material.map; mat.normalMap = assets.beanLod.material.normalMap;
  beans.frustumCulled = false; beans.castShadow = false;
  scene.add(beans);
  const R = rng(99), seeds = [];
  for (let i = 0; i < Q.beans; i++) {
    const t = i / (Q.beans - 1), side = i % 2 ? 1 : -1;
    const a = lerp(-0.75, 1.05, t) + (R() - 0.5) * 0.25;
    // Kept inside the column between headline and copy.
    const rad = (side > 0 ? 0.95 : 1.05) + R() * (side > 0 ? 0.42 : 0.6);
    const depth = -0.3 - R() * 2.4;
    seeds.push({
      p: new Vector3(side * ((side > 0 ? 0.16 : 0.3) + Math.cos(a) * rad), 1.5 + Math.sin(a) * 1.75 + (R() - 0.5) * 0.5, depth),
      s: 0.10 + Math.pow(R(), 2) * 0.10, e: [R() * 6, R() * 6, R() * 6], k: R(), d: R(),
    });
  }

  const dust = createDust({ count: Math.round(Q.dust * 0.35), box: [9, 7, 9], size: 0.018, seed: 70 });
  scene.add(dust);

  const land = [
    { t: 83, pos: [0.9, -2.6, 4.2], look: [0, 0.6, 0], fov: 42 },
    { t: 87, pos: [0.5, -0.5, 4.6], look: [0, 1.0, 0], fov: 40 },
    { t: 90, pos: [-1.5, 0.75, 5.4], look: [0, 1.4, 0], fov: 36 },
    { t: 95, pos: [1.9, 1.55, 6.4], look: [0, 1.42, 0], fov: 33 },
    { t: 100, pos: [0.55, 1.75, 7.4], look: [0, 1.34, 0], fov: 32 },
  ];
  const port = [
    { t: 83, pos: [0.6, -2.6, 4.6], look: [0, 0.6, 0], fov: 42 },
    { t: 87, pos: [0.4, -0.5, 5.2], look: [0, 1.0, 0], fov: 40 },
    { t: 90, pos: [-1.4, 0.9, 6.2], look: [0, 1.5, 0], fov: 38 },
    { t: 94, pos: [1.2, 1.5, 7.0], look: [0, 1.2, 0], fov: 37 },
    { t: 100, pos: [0.4, 1.4, 9.2], look: [0, 0.12, 0], fov: 37 },
  ];
  const rig = new CameraRig(land, { near: 0.05, far: 40, parallax: 0.02, portraitKeys: port, portraitFov: 0.55 });

  const M = new Matrix4(), q = new Quaternion(), e = new Euler(), p = new Vector3(), s = new Vector3();
  let drag = 0, disc = 0;
  return {
    scene, rig, camera: rig.camera, pouch,
    update(S, I, time, dt, px) {
      const k = 1 - Math.exp(-dt * 5);
      drag += (I.drag - drag) * k;
      disc += (I.discover - disc) * (1 - Math.exp(-dt * 2.4));
      pouch.position.y = lerp(-1.7, 1.46, S.rise) + Math.sin(time * 0.6) * 0.025 * S.rise;
      pouch.rotation.y = -0.5 + S.orbit * 0.62 + Math.sin(time * 0.25) * 0.035 + drag + disc * Math.PI;
      pouch.rotation.z = Math.sin(time * 0.4) * 0.006;

      const L = S.studio;
      key.intensity = 112 * L; rimR.intensity = 120 * L; rimL.intensity = 60 * L;
      low.intensity = 1.7 * L + 5 * S.rise * (1 - L);
      wash.material.uniforms.uA.value = 0.35 * S.rise + 0.65 * L;

      for (let i = 0; i < Q.beans; i++) {
        const b = seeds[i];
        const t = smooth(b.d * 0.5, b.d * 0.5 + 0.5, S.beans);
        e.set(b.e[0] + time * 0.11 * (b.k - 0.5) + S.orbit * b.k, b.e[1] + time * 0.14 * b.k + S.orbit * 0.9, b.e[2]);
        p.copy(b.p);
        p.y = lerp(-0.6, b.p.y, t) + Math.sin(time * (0.3 + b.k * 0.3) + i) * 0.05;
        p.x *= lerp(0.6, 1, t);
        beans.setMatrixAt(i, M.compose(p, q.setFromEuler(e), s.setScalar(b.s * smooth(0, 0.3, t))));
      }
      beans.instanceMatrix.needsUpdate = true;
      beans.visible = S.beans > 0.001;

      const camUnder = rig.camera.position.y < 0.02;
      pool.visible = !camUnder; under.visible = camUnder;
      pu.uTime.value = time; pu.uRipple.value = lerp(0.35, 1.6, 1 - smooth(0.2, 1, S.studio)); pu.uLight.value = 0.3 + 0.7 * L;
      const d = dust.material.uniforms;
      d.uTime.value = time; d.uPx.value = px; d.uAmt.value = 0.45 * L; d.uRise.value = time * 0.01;
    },
  };
}
