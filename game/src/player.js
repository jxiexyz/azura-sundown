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

function limbGeometry(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, -h / 2, 0);
  return g;
}

export function createPlayerMesh() {
  const root = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: 0x2a7a86, roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc99a72, roughness: 0.75 });
  const jeans = new THREE.MeshStandardMaterial({ color: 0x2c3448, roughness: 0.85 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x1c1410, roughness: 0.9 });
  const shoe = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x101216, roughness: 0.6 });

  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.24), jeans);
  hips.position.y = 0.9;
  hips.castShadow = true;
  root.add(hips);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.54, 0.25), jacket);
  torso.position.y = 1.16;
  torso.castShadow = true;
  root.add(torso);
  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.2), jacket);
  collar.position.y = 1.44;
  root.add(collar);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.1, 8), skin);
  neck.position.y = 1.46;
  root.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), skin);
  head.position.y = 1.6;
  head.scale.set(0.94, 1.05, 0.98);
  head.castShadow = true;
  root.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.158, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58), hair);
  cap.position.y = 1.615;
  cap.scale.set(0.96, 1.02, 1.0);
  root.add(cap);
  const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.06), hair);
  fringe.position.set(0, 1.665, 0.115);
  root.add(fringe);
  const eyeGeo = new THREE.BoxGeometry(0.032, 0.022, 0.02);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, dark);
    eye.position.set(side * 0.055, 1.605, 0.132);
    root.add(eye);
  }
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.035, 0.03), skin);
  nose.position.set(0, 1.575, 0.145);
  root.add(nose);

  const legGeo = limbGeometry(0.15, 0.8, 0.17);
  const armGeo = limbGeometry(0.1, 0.54, 0.12);
  const legL = new THREE.Mesh(legGeo, jeans);
  legL.position.set(-0.1, 0.86, 0);
  const legR = new THREE.Mesh(legGeo, jeans);
  legR.position.set(0.1, 0.86, 0);
  const armL = new THREE.Mesh(armGeo, jacket);
  armL.position.set(-0.26, 1.4, 0);
  const armR = new THREE.Mesh(armGeo, jacket);
  armR.position.set(0.26, 1.4, 0);
  const shoeGeo = new THREE.BoxGeometry(0.16, 0.09, 0.26);
  const handGeo = new THREE.SphereGeometry(0.055, 8, 6);
  for (const leg of [legL, legR]) {
    const s = new THREE.Mesh(shoeGeo, shoe);
    s.position.set(0, -0.78, 0.05);
    leg.add(s);
  }
  for (const arm of [armL, armR]) {
    const h = new THREE.Mesh(handGeo, skin);
    h.position.set(0, -0.55, 0);
    arm.add(h);
  }
  for (const m of [legL, legR, armL, armR]) {
    m.castShadow = true;
    root.add(m);
  }

  const shadowGeo = new THREE.PlaneGeometry(1.1, 1.1);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadow = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial({ map: radialTexture(64, 2.6), color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false }));
  shadow.position.y = 0.045;
  root.add(shadow);

  return { root, legL, legR, armL, armR, torso, head, name: PLAYER_NAME };
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
  }

  reset(spawn) {
    this.x = spawn.x;
    this.z = spawn.z;
    this.heading = spawn.heading ?? 0;
    this.speed = 0;
    this.jumpY = 0;
    this.vy = 0;
  }

  groundY() {
    return heightAt(this.x, this.z);
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
    this.phase += Math.abs(this.speed) * dt * 2.6;
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
    const swing = this.moving ? Math.sin(this.phase) * (this.sprinting ? 0.85 : 0.6) : 0;
    m.legL.rotation.x = swing;
    m.legR.rotation.x = -swing;
    m.armL.rotation.x = -swing * 0.8;
    m.armR.rotation.x = swing * 0.8;
    m.torso.position.y = 1.16 + (this.moving ? Math.abs(Math.sin(this.phase)) * 0.035 : 0);
    m.root.visible = true;
  }

  hide() {
    this.mesh.root.visible = false;
  }
}
