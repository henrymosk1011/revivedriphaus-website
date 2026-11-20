import * as THREE from 'three';

// A bright photo studio baked into a PMREM environment map: big white
// softboxes for long clean highlights on glass and plastic, and a soft green
// bounce so liquid picks up the brand colour.
export function createEnvironment(renderer, { room = '#5f766a', floor = '#2fcf78', floorIntensity = 1.4 } = {}) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();

  env.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(30, 32, 16),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(room), side: THREE.BackSide })
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
  panel('#ffffff', 6, 14, 4, [0, 14, 5]); // overhead key
  panel('#ffffff', 5, 2.4, 16, [-13, 1, 6]); // tall strip, left
  panel('#ffffff', 4, 2.4, 16, [13, 1, 3]); // tall strip, right
  panel(floor, floorIntensity, 24, 6, [0, -12, 2]); // green floor bounce

  const rt = pmrem.fromScene(env, 0.03);
  pmrem.dispose();
  env.traverse((o) => {
    if (o.isMesh) {
      o.geometry.dispose();
      o.material.dispose();
    }
  });
  return rt.texture;
}
