import THREE from 'three';
import { mulberry32, mergeParts, mat4 } from './utils.js';
import { heightAt } from './world.js';

const SHIRTS = [0xb0483a, 0x3a6ab0, 0x3a8a4a, 0xd0a030, 0x8a3a6a, 0xd8d0c0, 0x40485a, 0x2a8a8a];
const SKINS = [0xc99a72, 0x8a5a3a, 0xe0b890, 0x5a3a26];
const WALK = 1.5;
const PANIC_SPEED = 5.4;
const ACTIVE_RANGE = 210;

function upperBodyGeometry(shirt, skin) {
  const torso = new THREE.BoxGeometry(0.4, 0.55, 0.24);
  const head = new THREE.SphereGeometry(0.15, 8, 6);
  const arm = new THREE.BoxGeometry(0.1, 0.5, 0.12);
  const parts = [
    { geometry: torso, matrix: mat4(0, 1.08, 0), color: shirt },
    { geometry: head, matrix: mat4(0, 1.52, 0), color: skin },
    { geometry: arm, matrix: mat4(-0.26, 1.05, 0), color: shirt },
    { geometry: arm, matrix: mat4(0.26, 1.05, 0), color: shirt },
  ];
  const g = mergeParts(parts);
  torso.dispose();
  head.dispose();
  arm.dispose();
  return g;
}

export function createPedestrians(scene, world, seed = 1) {
  const rand = mulberry32(seed * 104729 + 7);
  const legGeo = new THREE.BoxGeometry(0.15, 0.8, 0.17);
  legGeo.translate(0, -0.4, 0);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x262c3c, roughness: 0.85 });
  const upperMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
  const peds = [];

  for (const road of world.roads) {
    const perSide = road.w >= 24 ? 4 : 2;
    for (const side of [-1, 1]) {
      for (let i = 0; i < perSide; i++) {
        const dir = rand() < 0.5 ? 1 : -1;
        const s = road.from + 12 + rand() * (road.to - road.from - 24);
        const shirt = SHIRTS[Math.floor(rand() * SHIRTS.length)];
        const skin = SKINS[Math.floor(rand() * SKINS.length)];
        const upper = new THREE.Mesh(upperBodyGeometry(shirt, skin), upperMat);
        upper.castShadow = true;
        const legL = new THREE.Mesh(legGeo, legMat);
        legL.position.set(-0.1, 0.8, 0);
        const legR = new THREE.Mesh(legGeo, legMat);
        legR.position.set(0.1, 0.8, 0);
        const group = new THREE.Group();
        group.add(upper, legL, legR);
        scene.add(group);
        peds.push({
          group, legL, legR, road, side, dir, s,
          speed: WALK * (0.8 + rand() * 0.5),
          phase: rand() * Math.PI * 2,
          mode: 'walk',
          panicT: 0,
          fleeX: 0,
          fleeZ: 0,
          x: 0,
          z: 0,
        });
      }
    }
  }

  function sidewalkPos(p) {
    const off = p.side * (p.road.w / 2 + 2.3);
    if (p.road.axis === 'z') {
      p.x = p.road.at + off;
      p.z = p.s;
      p.heading = p.dir > 0 ? 0 : Math.PI;
    } else {
      p.x = p.s;
      p.z = p.road.at + off;
      p.heading = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
  }

  function panic(x, z, radius) {
    for (const p of peds) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d > radius) continue;
      p.mode = 'panic';
      p.panicT = 3.2 + rand() * 2;
      const inv = 1 / Math.max(0.001, d);
      p.fleeX = (p.x - x) * inv;
      p.fleeZ = (p.z - z) * inv;
    }
  }

  function update(dt, t, focus) {
    for (const p of peds) {
      const distFocus = Math.hypot(p.x - focus.x, p.z - focus.z);
      if (distFocus > ACTIVE_RANGE) continue;
      if (p.mode === 'walk' && focus.speed > 12 && distFocus < 6.5) {
        p.mode = 'panic';
        p.panicT = 2.8;
        const inv = 1 / Math.max(0.001, distFocus);
        p.fleeX = (p.x - focus.x) * inv;
        p.fleeZ = (p.z - focus.z) * inv;
      }
      if (p.mode === 'panic') {
        p.panicT -= dt;
        p.x += p.fleeX * PANIC_SPEED * dt;
        p.z += p.fleeZ * PANIC_SPEED * dt;
        p.heading = Math.atan2(p.fleeX, p.fleeZ);
        p.phase += PANIC_SPEED * dt * 2.4;
        if (p.panicT <= 0) {
          p.mode = 'walk';
          p.s = p.road.axis === 'z' ? p.z : p.x;
          p.s = Math.max(p.road.from + 6, Math.min(p.road.to - 6, p.s));
        }
      } else {
        p.s += p.dir * p.speed * dt;
        if (p.s > p.road.to - 6) {
          p.s = p.road.from + 6;
        } else if (p.s < p.road.from + 6) {
          p.s = p.road.to - 6;
        }
        sidewalkPos(p);
        p.phase += p.speed * dt * 2.6;
      }
      const y = heightAt(p.x, p.z) + (p.mode === 'walk' ? 0.09 : 0.03);
      p.group.position.set(p.x, y, p.z);
      p.group.rotation.y = p.heading;
      const swing = Math.sin(p.phase) * (p.mode === 'panic' ? 0.85 : 0.5);
      p.legL.rotation.x = swing;
      p.legR.rotation.x = -swing;
    }
  }

  function hitTest(x, z, radius) {
    let best = null;
    let bestD = radius;
    for (const p of peds) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  function serialize() {
    return peds.map((p) => ({ s: p.s, mode: p.mode }));
  }

  function load(data) {
    if (!Array.isArray(data)) return;
    data.forEach((d, i) => {
      const p = peds[i];
      if (!p) return;
      p.s = d.s ?? p.s;
      p.mode = d.mode === 'panic' ? 'walk' : 'walk';
      sidewalkPos(p);
    });
  }

  for (const p of peds) {
    sidewalkPos(p);
    p.group.position.set(p.x, heightAt(p.x, p.z) + 0.09, p.z);
    p.group.rotation.y = p.heading;
  }

  return { peds, update, panic, hitTest, serialize, load };
}
