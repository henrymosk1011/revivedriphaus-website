import * as THREE from 'three';

// A tiny "studio" of emissive softboxes baked into a PMREM environment map,
// so glass and chrome reflect brand greens instead of a generic room.
export function createEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();

  env.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(30, 32, 16),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#03140c'), side: THREE.BackSide })
    )
  );

  const panel = (color, intensity, w, h, pos) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide })
    );
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  panel('#ffffff', 7, 10, 3.2, [0, 12, 7]); // key softbox
  panel('#3be07f', 5, 3.5, 14, [-14, 1, 3]); // green strip
  panel('#ceff65', 3.5, 3, 10, [14, -2, -4]); // lime strip
  panel('#bfffd9', 2.5, 16, 2.5, [0, -12, 4]); // floor bounce
  panel('#19a352', 2, 20, 8, [0, 3, -20]); // back wash

  const rt = pmrem.fromScene(env, 0.035);
  pmrem.dispose();
  env.traverse((o) => {
    if (o.isMesh) {
      o.geometry.dispose();
      o.material.dispose();
    }
  });
  return rt.texture;
}
