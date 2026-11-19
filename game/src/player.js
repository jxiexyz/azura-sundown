import THREE from 'three';
import { PLAYER_NAME } from './config.js';
import { clamp, damp } from './utils.js';
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

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.58, 0.26), jacket);
  torso.position.y = 1.12;
  torso.castShadow = true;
  root.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 10, 8), skin);
  head.position.y = 1.56;
  head.castShadow = true;
  root.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
  cap.position.y = 1.585;
  root.add(cap);

  const legGeo = limbGeometry(0.16, 0.82, 0.18);
  const armGeo = limbGeometry(0.11, 0.56, 0.13);
  const legL = new THREE.Mesh(legGeo, jeans);
  legL.position.set(-0.11, 0.84, 0);
  const legR = new THREE.Mesh(legGeo, jeans);
  legR.position.set(0.11, 0.84, 0);
  const armL = new THREE.Mesh(armGeo, jacket);
  armL.position.set(-0.28, 1.38, 0);
  const armR = new THREE.Mesh(armGeo, jacket);
  armR.position.set(0.28, 1.38, 0);
  for (const m of [legL, legR, armL, armR]) {
    m.castShadow = true;
    root.add(m);
  }

  const shadowGeo = new THREE.CircleGeometry(0.42, 10);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadow = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
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
    m.torso.position.y = 1.12 + (this.moving ? Math.abs(Math.sin(this.phase)) * 0.035 : 0);
    m.root.visible = true;
  }

  hide() {
    this.mesh.root.visible = false;
  }
}
