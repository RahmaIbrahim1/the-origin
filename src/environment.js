import { Scene, Mesh, SphereGeometry, PlaneGeometry, MeshBasicMaterial, BackSide, DoubleSide, PMREMGenerator, Color } from 'three';

/** Softbox studio baked to a PMREM cube: long warm strips over black. */
export function studioEnvironment(gl) {
  const s = new Scene();
  s.add(new Mesh(new SphereGeometry(20, 24, 16), new MeshBasicMaterial({ color: new Color(0.012, 0.009, 0.007), side: BackSide })));
  const box = (w, h, x, y, z, r, g, b) => {
    const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color: new Color(r, g, b), side: DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m);
  };
  box(3, 11, -9, 2, 4, 6, 4.4, 3.0);
  box(2, 12, 10, 1, -2, 7, 3.3, 1.2);
  box(9, 3, 0, 10, 1, 4.2, 3.2, 2.3);
  box(1.2, 9, 4, 3, -11, 5, 2.2, 0.8);
  box(8, 1, 0, -3, 12, 0.5, 0.35, 0.22);
  const pm = new PMREMGenerator(gl);
  const t = pm.fromScene(s, 0.02).texture;
  pm.dispose();
  s.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  return t;
}
