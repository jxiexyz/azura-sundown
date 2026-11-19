import THREE from 'three';
import { mulberry32, mergeParts, mat4 } from './utils.js';
import { heightAt } from './world.js';

const SHIRTS = [0xb0483a, 0x3a6ab0, 0x3a8a4a, 0xd0a030, 0x8a3a6a, 0xd8d0c0, 0x40485a, 0x2a8a8a, 0xc06030, 0x6a5a9a];
const SKINS = [0xc99a72, 0x8a5a3a, 0xe0b890, 0x5a3a26];
const HAIRS = [0x1c1410, 0x3a2a18, 0x5a4a30, 0x20242c, 0x6a3a20];
const PANTS = [0x262c3c, 0x3a3630, 0x1e2228];
const WALK = 1.5;
const PANIC_SPEED = 5.4;
const ACTIVE_RANGE = 210;

function bodyGeometry(shirt, skin, hairColor, pants) {
  const pelvis = new THREE.CapsuleGeometry(0.14, 0.08, 3, 8);
  const torso = new THREE.CylinderGeometry(0.17, 0.145, 0.44, 10);
  const shoulders = new THREE.CapsuleGeometry(0.075, 0.22, 3, 8);
  const neck = new THREE.CylinderGeometry(0.045, 0.05, 0.08, 6);
  const head = new THREE.SphereGeometry(0.11, 10, 8);
  const hair = new THREE.SphereGeometry(0.116, 9, 6, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const sh = new THREE.Matrix4().makeRotationZ(Math.PI / 2);
  sh.setPosition(0, 1.4, 0);
  const parts = [
    { geometry: pelvis, matrix: mat4(0, 0.92, 0, 0, 1.1, 0.8, 0.8), color: pants },
    { geometry: torso, matrix: mat4(0, 1.17, 0, 0, 1, 1, 0.72), color: shirt },
    { geometry: shoulders, matrix: sh, color: shirt },
    { geometry: neck, matrix: mat4(0, 1.46, 0), color: skin },
    { geometry: head, matrix: mat4(0, 1.57, 0, 0, 0.92, 1.05, 0.98), color: skin },
    { geometry: hair, matrix: mat4(0, 1.585, 0, 0, 0.94, 1.04, 1), color: hairColor },
  ];
  const g = mergeParts(parts);
  for (const p of parts) p.geometry.dispose();
  return g;
}

function legGeometry(pants) {
  const thigh = new THREE.CapsuleGeometry(0.07, 0.26, 3, 8);
  const shin = new THREE.CapsuleGeometry(0.052, 0.24, 3, 8);
  const shoe = new THREE.BoxGeometry(0.11, 0.08, 0.24);
  const parts = [
    { geometry: thigh, matrix: mat4(0, -0.2, 0), color: pants },
    { geometry: shin, matrix: mat4(0, -0.6, 0), color: pants },
    { geometry: shoe, matrix: mat4(0, -0.8, 0.04), color: 0x14161a },
  ];
  const g = mergeParts(parts);
  for (const p of parts) p.geometry.dispose();
  return g;
}

function armGeometry(shirt, skin) {
  const upper = new THREE.CapsuleGeometry(0.05, 0.18, 3, 8);
  const fore = new THREE.CapsuleGeometry(0.042, 0.16, 3, 8);
  const hand = new THREE.SphereGeometry(0.045, 7, 5);
  const parts = [
    { geometry: upper, matrix: mat4(0, -0.13, 0), color: shirt },
    { geometry: fore, matrix: mat4(0, -0.38, 0), color: shirt },
    { geometry: hand, matrix: mat4(0, -0.52, 0, 0, 0.8, 1.1, 0.6), color: skin },
  ];
  const g = mergeParts(parts);
  for (const p of parts) p.geometry.dispose();
  return g;
}

export function createPedestrians(scene, world, seed = 1) {
  const rand = mulberry32(seed * 104729 + 7);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
  const variants = [];
  for (let i = 0; i < 10; i++) {
    const shirt = SHIRTS[i % SHIRTS.length];
    const skin = SKINS[Math.floor(rand() * SKINS.length)];
    const hairColor = HAIRS[Math.floor(rand() * HAIRS.length)];
    const pants = PANTS[Math.floor(rand() * PANTS.length)];
    variants.push({
      body: bodyGeometry(shirt, skin, hairColor, pants),
      leg: legGeometry(pants),
      arm: armGeometry(shirt, skin),
    });
  }
  const peds = [];

  const makePed = (road, side, dir, s) => {
    const v = variants[Math.floor(rand() * variants.length)];
    const upper = new THREE.Mesh(v.body, mat);
    upper.castShadow = true;
    const legL = new THREE.Mesh(v.leg, mat);
    legL.position.set(-0.09, 0.88, 0);
    const legR = new THREE.Mesh(v.leg, mat);
    legR.position.set(0.09, 0.88, 0);
    const armL = new THREE.Mesh(v.arm, mat);
    armL.position.set(-0.225, 1.4, 0);
    const armR = new THREE.Mesh(v.arm, mat);
    armR.position.set(0.225, 1.4, 0);
    const group = new THREE.Group();
    group.rotation.order = 'YXZ';
    group.add(upper, legL, legR, armL, armR);
    const scale = 0.92 + rand() * 0.14;
    group.scale.setScalar(scale);
    scene.add(group);
    const ped = {
      group, legL, legR, armL, armR, road, side, dir, s,
      speed: WALK * (0.8 + rand() * 0.5),
      phase: rand() * Math.PI * 2,
      mode: 'walk',
      panicT: 0,
      idleT: 0,
      facing: 0,
      fleeX: 0,
      fleeZ: 0,
      x: 0,
      z: 0,
    };
    peds.push(ped);
    return ped;
  };

  for (const road of world.roads) {
    const downtown = road.w >= 14 && road.w < 24;
    const clusterMax = road.w >= 24 ? 3 : downtown ? 4 : 2;
    for (const side of [-1, 1]) {
      const stops = downtown ? 4 : 2;
      for (let c = 0; c < stops; c++) {
        const anchor = road.from + 22 + ((road.to - road.from - 44) * (c + rand() * 0.7)) / stops;
        const n = 2 + Math.floor(rand() * (clusterMax - 1));
        for (let k = 0; k < n; k++) {
          const dir = rand() < 0.5 ? 1 : -1;
          const s = anchor + (k - n / 2) * (1.3 + rand() * 1.1);
          const ped = makePed(road, side, dir, s);
          if (k > 0 && rand() < 0.45) {
            ped.mode = 'idle';
            ped.idleT = 4 + rand() * 8;
            ped.facing = Math.atan2(0, 1);
          }
        }
      }
      for (let i = 0; i < (road.w >= 24 ? 3 : 1); i++) {
        const dir = rand() < 0.5 ? 1 : -1;
        makePed(road, side, dir, road.from + 12 + rand() * (road.to - road.from - 24));
      }
    }
  }

  const SIDEWALK_BASE = 2.3;
  const sidewalkOff = (p, extra = 0) => p.side * (p.road.w / 2 + SIDEWALK_BASE + extra);

  function sidewalkPos(p) {
    const off = sidewalkOff(p);
    if (p.road.axis === 'z') {
      p.x = p.road.at + off + (p.lateralOffset ?? 0);
      p.z = p.s;
      p.heading = p.dir > 0 ? 0 : Math.PI;
    } else {
      p.x = p.s;
      p.z = p.road.at + off + (p.lateralOffset ?? 0);
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
      if (distFocus > ACTIVE_RANGE) {
        p.group.visible = false;
        continue;
      }
      p.group.visible = true;
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
      } else if (p.mode === 'idle') {
        p.idleT -= dt;
        sidewalkPos(p);
        const toFacing = p.facing !== undefined ? p.facing : p.heading;
        p.heading = toFacing;
        p.phase += dt * 1.2;
        if (p.idleT <= 0) p.mode = 'walk';
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
      const walkMode = p.mode === 'walk';
      const bob = walkMode ? Math.abs(Math.sin(p.phase)) * 0.025 : Math.sin(p.phase * 0.8) * 0.01;
      const y = heightAt(p.x, p.z) + (p.mode === 'panic' ? 0.03 : 0.09) + bob;
      p.group.position.set(p.x, y, p.z);
      p.group.rotation.y = p.heading;
      const panic = p.mode === 'panic';
      const idle = p.mode === 'idle';
      const swing = Math.sin(p.phase) * (panic ? 0.95 : 0.5);
      p.legL.rotation.x = idle ? 0 : swing;
      p.legR.rotation.x = idle ? 0 : -swing;
      if (panic) {
        p.group.rotation.x = 0.22;
        p.armL.rotation.x = -2.3 + Math.sin(p.phase * 1.6) * 0.4;
        p.armR.rotation.x = -2.3 - Math.sin(p.phase * 1.6) * 0.4;
      } else if (idle) {
        p.group.rotation.x = 0;
        p.armL.rotation.x = -0.35 + Math.sin(p.phase * 2.1) * 0.22;
        p.armR.rotation.x = -0.3 + Math.sin(p.phase * 1.7 + 1) * 0.2;
      } else {
        p.group.rotation.x = 0.04;
        p.armL.rotation.x = -swing * 0.55;
        p.armR.rotation.x = swing * 0.55;
      }
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

  function sync() {
    for (const p of peds) {
      sidewalkPos(p);
      p.group.position.set(p.x, heightAt(p.x, p.z) + 0.09, p.z);
      p.group.rotation.y = p.heading;
    }
  }
  sync();

  return { peds, update, panic, hitTest, serialize, load, sync };
}
