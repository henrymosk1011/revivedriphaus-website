import * as THREE from 'three';
import { snoise } from './glsl.js';

// A morphing drop of liquid glass. Vertex noise keeps it alive, uDrop pulls
// it into a teardrop for the fall, and normals are rebuilt in the shader so
// refraction and reflections follow the deformed surface.
function liquidMaterial(uniforms, opts = {}) {
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#ffffff'),
    roughness: 0.02,
    metalness: 0,
    transmission: 1,
    thickness: 1.1,
    ior: 1.34,
    attenuationColor: new THREE.Color('#8dffbe'),
    attenuationDistance: 5.5,
    iridescence: 0.85,
    iridescenceIOR: 1.3,
    iridescenceThicknessMinimum: 180,
    iridescenceThicknessMaximum: 620,
    emissive: new THREE.Color('#3be07f'),
    emissiveIntensity: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    specularIntensity: 1,
    envMapIntensity: 1.25,
    dispersion: 0.4,
    ...opts,
  });

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        uniform float uTime, uAmp, uFreq, uDrop, uStretch, uSeed;
        ${snoise}
        vec3 displace(vec3 p){
          float t = uTime * 0.55 + uSeed;
          float n = snoise(p * uFreq + vec3(t * 0.6, t * 0.45, -t * 0.5));
          n += 0.14 * snoise(p * uFreq * 1.9 + vec3(-t, t * 0.8, t * 0.3));
          vec3 q = p * (1.0 + n * uAmp);
          float h = p.y;
          float pinch = smoothstep(-0.25, 1.0, h);
          q.xz *= 1.0 - uDrop * 0.8 * pinch * pinch;
          q.y += uDrop * (1.05 * pinch * pinch * pinch + 0.12 * h);
          q.y *= 1.0 + uStretch;
          q.xz *= 1.0 - uStretch * 0.22;
          return q;
        }`
      )
      .replace(
        '#include <beginnormal_vertex>',
        /* glsl */ `
        vec3 sp = normalize(position);
        vec3 dpos = displace(sp);
        vec3 tng = normalize(cross(sp, abs(sp.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
        vec3 btn = normalize(cross(sp, tng));
        vec3 pA = displace(normalize(sp + tng * 0.012));
        vec3 pB = displace(normalize(sp + btn * 0.012));
        vec3 objectNormal = normalize(cross(pA - dpos, pB - dpos));
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3(tangent.xyz);
        #endif`
      )
      .replace('#include <begin_vertex>', 'vec3 transformed = dpos;');
  };
  // Every droplet shares one compiled program; uniforms are per-instance.
  material.customProgramCacheKey = () => 'liquid-glass';
  return material;
}

export class Droplet {
  constructor({ detail = 72 } = {}) {
    this.group = new THREE.Group();

    this.uniforms = {
      uTime: { value: 0 },
      uAmp: { value: 0.11 },
      uFreq: { value: 0.95 },
      uDrop: { value: 0 },
      uStretch: { value: 0 },
      uSeed: { value: 0 },
    };
    this.mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, detail), liquidMaterial(this.uniforms));
    this.group.add(this.mesh);

    // Satellite droplets that orbit the hero drop.
    this.satellites = [];
    const satGeo = new THREE.IcosahedronGeometry(1, Math.max(8, Math.round(detail / 4)));
    const sats = [
      [2.5, 0.22, 0.0, 0.35, 0.18],
      [3.1, 0.14, 2.1, -0.28, 0.12],
      [2.2, 0.1, 4.0, 0.5, -0.2],
      [3.6, 0.18, 1.2, 0.12, 0.3],
      [2.8, 0.08, 5.1, -0.45, 0.05],
      [4.2, 0.12, 3.3, 0.3, -0.35],
    ];
    sats.forEach(([r, s, phase, tilt, y], i) => {
      const u = {
        uTime: { value: 0 },
        uAmp: { value: 0.05 },
        uFreq: { value: 1.2 },
        uDrop: { value: 0 },
        uStretch: { value: 0 },
        uSeed: { value: i * 11.3 },
      };
      const m = new THREE.Mesh(satGeo, liquidMaterial(u, { thickness: 0.6, dispersion: 0 }));
      m.scale.setScalar(s);
      m.userData = { r, phase, tilt, y, u, speed: 0.12 + i * 0.025 };
      this.satellites.push(m);
      this.group.add(m);
    });
  }

  update(time, { amp = 0.11, drop = 0, stretch = 0, spin = 0, satellites = 1, glow = 0 } = {}) {
    const u = this.uniforms;
    this.mesh.material.emissiveIntensity = glow;
    u.uTime.value = time;
    u.uAmp.value = amp;
    u.uDrop.value = drop;
    u.uStretch.value = stretch;
    this.mesh.rotation.y = time * 0.08 + spin;
    this.mesh.rotation.z = Math.sin(time * 0.3) * 0.06;

    for (const m of this.satellites) {
      const d = m.userData;
      const a = d.phase + time * d.speed + spin * 0.6;
      const r = d.r * (0.6 + 0.4 * satellites);
      m.position.set(Math.cos(a) * r, d.y + Math.sin(a * 1.3 + d.phase) * 0.35 + Math.sin(a) * d.tilt * r, Math.sin(a) * r * 0.75);
      m.visible = satellites > 0.02;
      m.scale.setScalar(m.userData.base ?? (m.userData.base = m.scale.x));
      m.scale.multiplyScalar(Math.max(0.0001, satellites));
      d.u.uTime.value = time;
    }
  }
}

// Background for the hero: light halo rings and falling drip streaks that the
// glass drop refracts.
export class HeroSet {
  constructor({ streaks = 90 } = {}) {
    this.group = new THREE.Group();

    const ringMat = (color, intensity, opacity) =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color).multiplyScalar(intensity),
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
    this.ringA = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.012, 8, 256), ringMat('#bfffd9', 4, 0.9));
    this.ringA.position.set(0, 0, -1.6);
    this.ringB = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.006, 8, 256), ringMat('#ceff65', 3, 0.55));
    this.ringB.position.set(0, 0, -2.4);
    this.ringC = new THREE.Mesh(new THREE.TorusGeometry(5.4, 0.004, 8, 256), ringMat('#3be07f', 3, 0.35));
    this.ringC.position.set(0, 0, -3.6);
    this.group.add(this.ringA, this.ringB, this.ringC);

    // Soft radial glow behind the drop.
    this.glow = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 16),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uColor: { value: new THREE.Color('#19c769') }, uAmt: { value: 1 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor; uniform float uAmt; varying vec2 vUv;
          void main(){
            float d = length(vUv - 0.5) * 2.0;
            float g = exp(-d * d * 6.0) * 0.32 + exp(-d * 9.0) * 0.22;
            gl_FragColor = vec4(uColor * g * uAmt, 1.0);
          }`,
      })
    );
    this.glow.position.set(0, 0, -6);
    this.group.add(this.glow);

    // Falling drip streaks.
    const geo = new THREE.PlaneGeometry(0.018, 1, 1, 1);
    const seeds = new Float32Array(streaks * 4);
    for (let i = 0; i < streaks; i++) {
      seeds[i * 4] = (Math.random() - 0.5) * 36; // x
      seeds[i * 4 + 1] = -5 - Math.random() * 22; // z
      seeds[i * 4 + 2] = Math.random(); // phase
      seeds[i * 4 + 3] = 0.5 + Math.random() * 1.6; // length
    }
    const inst = new THREE.InstancedBufferGeometry().copy(geo);
    inst.instanceCount = streaks;
    inst.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
    this.streakUniforms = { uTime: { value: 0 }, uAmt: { value: 1 } };
    this.streaks = new THREE.Mesh(
      inst,
      new THREE.ShaderMaterial({
        uniforms: this.streakUniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          uniform float uTime;
          attribute vec4 aSeed;
          varying float vY;
          varying float vFade;
          void main(){
            float span = 26.0;
            float y = 13.0 - mod(uTime * (1.2 + aSeed.w) * 1.3 + aSeed.z * span, span);
            vec3 p = position;
            p.y *= aSeed.w * 2.2;
            vY = 1.0 - uv.y;
            vFade = smoothstep(13.0, 8.0, y) * smoothstep(-13.0, -7.0, y);
            vec4 mv = modelViewMatrix * vec4(p + vec3(aSeed.x, y, aSeed.y), 1.0);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uAmt;
          varying float vY;
          varying float vFade;
          void main(){
            float a = pow(vY, 3.0) * vFade;
            vec3 col = mix(vec3(0.1, 0.7, 0.35), vec3(0.85, 1.0, 0.9), pow(vY, 6.0));
            gl_FragColor = vec4(col * 1.4 * a * uAmt, 1.0);
          }`,
      })
    );
    this.streaks.frustumCulled = false;
    this.group.add(this.streaks);
  }

  update(time, camera, amount = 1) {
    this.ringA.rotation.set(Math.sin(time * 0.2) * 0.25 + 0.35, time * 0.12, 0);
    this.ringB.rotation.set(-0.5 + Math.cos(time * 0.15) * 0.2, -time * 0.08, 0.3);
    this.ringC.rotation.set(1.2, time * 0.05, -0.2);
    this.glow.quaternion.copy(camera.quaternion);
    this.streakUniforms.uTime.value = time;
    this.streakUniforms.uAmt.value = amount;
    this.glow.material.uniforms.uAmt.value = amount;
    for (const r of [this.ringA, this.ringB, this.ringC]) r.material.opacity = r.userData.o ?? (r.userData.o = r.material.opacity);
    this.ringA.material.opacity = this.ringA.userData.o * amount;
    this.ringB.material.opacity = this.ringB.userData.o * amount;
    this.ringC.material.opacity = this.ringC.userData.o * amount;
  }
}
