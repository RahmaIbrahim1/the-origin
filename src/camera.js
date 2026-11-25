import { PerspectiveCamera, Vector3, MathUtils } from 'three';
import { Track } from './utils/track.js';

const _r = new Vector3(), _u = new Vector3(), _f = new Vector3();

/** A space's camera: scroll track + portrait adaptation + restrained parallax. */
export class CameraRig {
  constructor(keys, { near = 0.01, far = 200, parallax = 0.06, portraitKeys = null, portraitFov = 1 } = {}) {
    this.camera = new PerspectiveCamera(35, 1, near, far);
    this.track = new Track(keys);
    this.portrait = portraitKeys ? new Track(portraitKeys) : null;
    this.parallax = parallax;
    this.portraitFov = portraitFov;
    this.px = 0; this.py = 0;
  }

  update(p, aspect, mx, my, dt) {
    const s = (aspect < 0.85 && this.portrait ? this.portrait : this.track).sample(p);
    const cam = this.camera;
    const k = 1 - Math.exp(-dt * 2.5);
    this.px += (mx - this.px) * k; this.py += (my - this.py) * k;

    cam.position.copy(s.pos);
    cam.up.set(0, 1, 0);
    _f.subVectors(s.look, s.pos).normalize();
    _r.crossVectors(_f, cam.up).normalize();
    _u.crossVectors(_r, _f);
    const dist = Math.min(s.pos.distanceTo(s.look), 9);
    cam.position.addScaledVector(_r, this.px * this.parallax * dist).addScaledVector(_u, -this.py * this.parallax * 0.6 * dist);
    cam.lookAt(s.look);
    if (s.roll) cam.rotateZ(s.roll);

    // Narrow screens keep most of the horizontal coverage instead of cropping in.
    let fov = s.fov;
    if (aspect < 1.4) {
      const need = Math.min(1.4 / aspect, 2);
      fov = MathUtils.radToDeg(2 * Math.atan(Math.tan(MathUtils.degToRad(fov / 2)) * MathUtils.lerp(1, need, 0.6 * this.portraitFov)));
    }
    if (Math.abs(cam.fov - fov) > 0.001 || cam.aspect !== aspect) {
      cam.fov = fov; cam.aspect = aspect; cam.updateProjectionMatrix();
    }
    cam.updateMatrixWorld();
  }
}
