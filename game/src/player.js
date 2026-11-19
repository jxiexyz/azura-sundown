import THREE from 'three';
import { PLAYER_NAME } from './config.js';
import { clamp, damp, radialTexture } from './utils.js';
import { heightAt } from './world.js';

const WALK_SPEED = 3.2;
const RUN_SPEED = 5.6;
const SPRINT_SPEED = 8.4;
const TURN_RATE = 3.4;
const RADIUS = 0.45;
const GRAVITY = 22;
const JUMP_VEL = 7.2;

function capsule(r, len, mat, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 3, 10), mat);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  return m;
}

export function createPlayerMesh() {
  const root = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: 0x2a7a86, roughness: 0.75 });
  const jacketDark = new THREE.MeshStandardMaterial({ color: 0x1f5f6a, roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc99a72, roughness: 0.65 });
  const jeans = new THREE.MeshStandardMaterial({ color: 0x2c3448, roughness: 0.85 });
  const jeansDark = new THREE.MeshStandardMaterial({ color: 0x232a3c, roughness: 0.85 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x1c1410, roughness: 0.9 });
  const shoe = new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.6 });
  const sole = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x101216, roughness: 0.5 });

  const hips = new THREE.Group();
  hips.position.y = 0.95;
  root.add(hips);
  const pelvis = capsule(0.15, 0.08, jeans, 1.15, 0.8, 0.8);
  pelvis.position.y = -0.02;
  hips.add(pelvis);
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.05, 12), dark);
  belt.scale.z = 0.75;
  belt.position.y = 0.05;
  hips.add(belt);

  const torso = new THREE.Group();
  torso.position.y = 0.07;
  hips.add(torso);
  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.155, 0.42, 12), jacket);
  chest.scale.z = 0.72;
  chest.position.y = 0.24;
  chest.castShadow = true;
  torso.add(chest);
  const shoulders = capsule(0.09, 0.24, jacket, 1, 1, 0.85);
  shoulders.rotation.z = Math.PI / 2;
  shoulders.position.y = 0.44;
  torso.add(shoulders);
  const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.08, 12), jacketDark);
  hem.scale.z = 0.74;
  hem.position.y = 0.02;
  torso.add(hem);
  const zip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.4, 0.02), dark);
  zip.position.set(0, 0.24, 0.135);
  torso.add(zip);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.06, 10), jacketDark);
  collar.position.y = 0.49;
  torso.add(collar);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.055, 0.09, 8), skin);
  neck.position.y = 0.52;
  torso.add(neck);

  const head = new THREE.Group();
  head.position.y = 0.62;
  torso.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 12), skin);
  skull.scale.set(0.92, 1.06, 0.98);
  skull.castShadow = true;
  head.add(skull);
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), skin);
  jaw.scale.set(0.85, 0.8, 0.9);
  jaw.position.set(0, -0.05, 0.015);
  head.add(jaw);
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.121, 12, 9, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
  hairCap.scale.set(0.94, 1.04, 1.0);
  hairCap.position.y = 0.012;
  head.add(hairCap);
  const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.035, 0.05), hair);
  fringe.position.set(0, 0.075, 0.095);
  head.add(fringe);
  const eyeGeo = new THREE.BoxGeometry(0.026, 0.016, 0.015);
  const browGeo = new THREE.BoxGeometry(0.04, 0.01, 0.012);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, dark);
    eye.position.set(side * 0.045, 0.005, 0.102);
    head.add(eye);
    const brow = new THREE.Mesh(browGeo, hair);
    brow.position.set(side * 0.045, 0.035, 0.104);
    head.add(brow);
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5), skin);
    ear.position.set(side * 0.105, -0.01, 0);
    head.add(ear);
  }
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.032, 0.025), skin);
  nose.position.set(0, -0.02, 0.112);
  head.add(nose);

  function buildArm(side) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.215, 0.42, 0);
    torso.add(arm);
    const upper = capsule(0.055, 0.2, jacket);
    upper.position.y = -0.14;
    arm.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.3;
    arm.add(elbow);
    const fore = capsule(0.045, 0.17, jacketDark);
    fore.position.y = -0.12;
    elbow.add(fore);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 6), skin);
    hand.scale.set(0.8, 1.15, 0.6);
    hand.position.y = -0.27;
    hand.castShadow = true;
    elbow.add(hand);
    arm.userData.elbow = elbow;
    return arm;
  }
  const armL = buildArm(-1);
  const armR = buildArm(1);

  function buildLeg(side) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.095, -0.03, 0);
    hips.add(leg);
    const thigh = capsule(0.075, 0.28, jeans);
    thigh.position.y = -0.2;
    leg.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.44;
    leg.add(knee);
    const shin = capsule(0.055, 0.26, jeansDark);
    shin.position.y = -0.18;
    knee.add(shin);
    const foot = new THREE.Group();
    foot.position.y = -0.4;
    knee.add(foot);
    const shoeBody = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.24), shoe);
    shoeBody.position.set(0, -0.04, 0.04);
    shoeBody.castShadow = true;
    foot.add(shoeBody);
    const toe = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), shoe);
    toe.scale.set(1, 0.72, 1.1);
    toe.position.set(0, -0.045, 0.15);
    foot.add(toe);
    const soleBox = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.03, 0.27), sole);
    soleBox.position.set(0, -0.085, 0.05);
    foot.add(soleBox);
    leg.userData.knee = knee;
    leg.userData.foot = foot;
    return leg;
  }
  const legL = buildLeg(-1);
  const legR = buildLeg(1);

  const shadowGeo = new THREE.PlaneGeometry(1.15, 1.15);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadow = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial({ map: radialTexture(64, 2.6), color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false }));
  shadow.position.y = 0.045;
  root.add(shadow);

  return { root, hips, legL, legR, armL, armR, torso, head, name: PLAYER_NAME };
}

export class Player {
  constructor(mesh, spawn) {
    this.mesh = mesh;
    this.x = spawn.x;
    this.z = spawn.z;
    this.heading = spawn.heading ?? 0;
    this.speed = 0;
    this.jumpY = 0;
    this.vy = 0;
    this.phase = 0;
    this.moving = false;
    this.sprinting = false;
    this.exitT = 0;
    this.enterT = 0;
    this.enterVehicle = null;
    this.enterFrom = { x: 0, z: 0 };
  }

  reset(spawn) {
    this.x = spawn.x;
    this.z = spawn.z;
    this.heading = spawn.heading ?? 0;
    this.speed = 0;
    this.jumpY = 0;
    this.vy = 0;
    this.exitT = 0;
    this.enterT = 0;
  }

  groundY() {
    return heightAt(this.x, this.z);
  }

  playExit() {
    this.exitT = 0.5;
  }

  playEnter(vehicle) {
    this.enterT = 0.42;
    this.enterVehicle = vehicle;
    this.enterFrom = { x: this.x, z: this.z };
    this.mesh.root.visible = true;
  }

  updateEnter(dt) {
    if (this.enterT <= 0) return;
    this.enterT -= dt;
    const v = this.enterVehicle;
    const t = clamp(1 - this.enterT / 0.42, 0, 1);
    const rx = Math.cos(v.heading);
    const rz = -Math.sin(v.heading);
    const doorX = v.x + rx * 1.15;
    const doorZ = v.z + rz * 1.15;
    const x = this.enterFrom.x + (doorX - this.enterFrom.x) * t;
    const z = this.enterFrom.z + (doorZ - this.enterFrom.z) * t;
    const m = this.mesh;
    m.root.position.set(x, this.groundY(), z);
    m.root.rotation.y = Math.atan2(v.x - x, v.z - z);
    const crouch = t * 0.8;
    m.hips.position.y = 0.95 - crouch * 0.3;
    m.torso.rotation.x = crouch * 0.7;
    m.legL.rotation.x = -crouch * 0.9;
    m.legR.rotation.x = -crouch * 0.5;
    m.legL.userData.knee.rotation.x = crouch * 1.4;
    m.legR.userData.knee.rotation.x = crouch * 1.0;
    m.armL.rotation.x = -crouch * 0.8;
    m.armR.rotation.x = -crouch * 1.1;
    if (this.enterT <= 0) {
      this.enterVehicle = null;
      m.root.visible = false;
    }
  }

  step(dt, input, colliders) {
    const turn = (input.down('left') ? 1 : 0) - (input.down('right') ? 1 : 0);
    this.heading += turn * TURN_RATE * dt;
    const fwd = (input.down('up') ? 1 : 0) - (input.down('down') ? 1 : 0);
    this.sprinting = input.down('sprint') && fwd > 0;
    const target = fwd > 0 ? (this.sprinting ? SPRINT_SPEED : RUN_SPEED) : fwd < 0 ? -WALK_SPEED * 0.6 : 0;
    this.speed = damp(this.speed, target, 10, dt);
    this.moving = Math.abs(this.speed) > 0.25;

    if (input.takePressed('handbrake') && this.jumpY <= 0.001) this.vy = JUMP_VEL;
    this.vy -= GRAVITY * dt;
    this.jumpY = Math.max(0, this.jumpY + this.vy * dt);
    if (this.jumpY === 0) this.vy = Math.max(0, this.vy);

    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    this.x += fx * this.speed * dt;
    this.z += fz * this.speed * dt;
    this.resolveCollisions(colliders);
    this.phase += Math.abs(this.speed) * dt * 2.3;
    if (this.exitT > 0) this.exitT = Math.max(0, this.exitT - dt);
    this.syncMesh();
  }

  resolveCollisions(colliders) {
    for (const b of colliders) {
      if (this.x < b.minX - RADIUS || this.x > b.maxX + RADIUS || this.z < b.minZ - RADIUS || this.z > b.maxZ + RADIUS) continue;
      const cx = clamp(this.x, b.minX, b.maxX);
      const cz = clamp(this.z, b.minZ, b.maxZ);
      const dx = this.x - cx;
      const dz = this.z - cz;
      const dist = Math.hypot(dx, dz);
      if (dist >= RADIUS) continue;
      if (dist < 0.0001) {
        this.x = b.minX - RADIUS;
        continue;
      }
      const push = RADIUS - dist;
      this.x += (dx / dist) * push;
      this.z += (dz / dist) * push;
    }
    const half = 612;
    this.x = clamp(this.x, -half, half);
    this.z = clamp(this.z, -half, half);
  }

  syncMesh() {
    const m = this.mesh;
    m.root.position.set(this.x, this.groundY() + this.jumpY, this.z);
    m.root.rotation.y = this.heading;
    const mov = this.moving ? 1 : 0;
    const amp = this.sprinting ? 0.85 : 0.6;
    const swing = Math.sin(this.phase) * amp * mov;
    const crouch = this.exitT > 0 ? this.exitT / 0.5 : 0;
    m.legL.rotation.x = swing - crouch * 0.8;
    m.legR.rotation.x = -swing - crouch * 0.5;
    m.legL.userData.knee.rotation.x = Math.max(0, Math.sin(this.phase + 0.7)) * 0.85 * mov + 0.06 + crouch * 1.3;
    m.legR.userData.knee.rotation.x = Math.max(0, -Math.sin(this.phase + 0.7)) * 0.85 * mov + 0.06 + crouch * 1.0;
    m.legL.userData.foot.rotation.x = -swing * 0.3;
    m.legR.userData.foot.rotation.x = swing * 0.3;
    m.armL.rotation.x = -swing * 0.95 - crouch * 0.7;
    m.armR.rotation.x = swing * 0.95 - crouch * 0.9;
    m.armL.userData.elbow.rotation.x = -0.22 - Math.max(0, -swing) * 0.5;
    m.armR.userData.elbow.rotation.x = -0.22 - Math.max(0, swing) * 0.5;
    m.hips.position.y = 0.95 + Math.abs(Math.sin(this.phase)) * 0.035 * mov - crouch * 0.28;
    m.hips.rotation.y = -Math.sin(this.phase) * 0.06 * mov;
    m.torso.rotation.x = (this.sprinting ? 0.16 : this.moving ? 0.06 : 0.015) + crouch * 0.6;
    m.torso.rotation.y = Math.sin(this.phase) * 0.08 * mov;
    m.head.rotation.x = -m.torso.rotation.x * 0.6;
    m.root.visible = true;
  }

  hide() {
    this.mesh.root.visible = false;
    this.enterT = 0;
    this.enterVehicle = null;
  }
}
