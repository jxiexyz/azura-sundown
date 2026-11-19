import THREE from 'three';
import { mulberry32 } from './utils.js';

export function createEffects(scene) {
  const rand = mulberry32(99);
  const MAX = 90;
  const positions = new Float32Array(MAX * 3);
  const velocities = new Float32Array(MAX * 3);
  const life = new Float32Array(MAX);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffc860,
    size: 0.22,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  let cursor = 0;

  function sparks(x, y, z, count, force) {
    for (let i = 0; i < count; i++) {
      const k = cursor;
      cursor = (cursor + 1) % MAX;
      positions[k * 3] = x;
      positions[k * 3 + 1] = y + 0.4;
      positions[k * 3 + 2] = z;
      velocities[k * 3] = (rand() - 0.5) * force;
      velocities[k * 3 + 1] = rand() * force * 0.7;
      velocities[k * 3 + 2] = (rand() - 0.5) * force;
      life[k] = 0.35 + rand() * 0.4;
    }
  }

  function update(dt) {
    let any = false;
    for (let k = 0; k < MAX; k++) {
      if (life[k] <= 0) {
        positions[k * 3 + 1] = -100;
        continue;
      }
      any = true;
      life[k] -= dt;
      velocities[k * 3 + 1] -= 14 * dt;
      positions[k * 3] += velocities[k * 3] * dt;
      positions[k * 3 + 1] += velocities[k * 3 + 1] * dt;
      positions[k * 3 + 2] += velocities[k * 3 + 2] * dt;
    }
    geo.attributes.position.needsUpdate = true;
    mat.opacity = any ? 0.95 : 0;
  }

  return { sparks, update };
}

export function createSpeedOverlay(element) {
  return {
    update(speed, impact) {
      const t = Math.max(0, Math.min(1, (speed - 26) / 32));
      element.style.opacity = String(t * 0.55 + impact * 0.4);
    },
  };
}
