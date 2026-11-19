import THREE from 'three';
import { heightAt } from './world.js';
import { streakTexture, clamp } from './utils.js';

const MAX = 80;

export function createReflections(scene) {
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: streakTexture(),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, MAX);
  mesh.frustumCulled = false;
  mesh.renderOrder = 6;
  mesh.count = 0;
  scene.add(mesh);

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const col = new THREE.Color();
  const up = new THREE.Vector3(0, 1, 0);

  function update(cam, sources) {
    let n = 0;
    for (const s of sources) {
      if (n >= MAX) break;
      const dx = s.x - cam.x;
      const dz = s.z - cam.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 130 || dist < 0.6 || s.intensity <= 0.01) continue;
      const fade = clamp((130 - dist) / 45, 0, 1);
      const t = cam.y / Math.max(0.5, cam.y + s.y);
      const mx = cam.x + dx * t;
      const mz = cam.z + dz * t;
      let dirx = cam.x - mx;
      let dirz = cam.z - mz;
      const dl = Math.hypot(dirx, dirz) || 1;
      dirx /= dl;
      dirz /= dl;
      const len = clamp(dist * 0.3, 2.5, 18) * (s.stretch ?? 1);
      const cx = mx + dirx * len * 0.5;
      const cz = mz + dirz * len * 0.5;
      q.setFromAxisAngle(up, Math.atan2(dirx, dirz));
      pos.set(cx, heightAt(cx, cz) + 0.075, cz);
      scl.set(s.width, 1, len);
      m4.compose(pos, q, scl);
      mesh.setMatrixAt(n, m4);
      col.copy(s.color).multiplyScalar(s.intensity * fade);
      mesh.setColorAt(n, col);
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  return { update, mesh };
}