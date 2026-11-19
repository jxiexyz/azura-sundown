import THREE from 'three';
import { CAR, WORLD, PLAYER_CAR_NAME } from './config.js';
import { clamp, damp } from './utils.js';
import { heightAt } from './world.js';

function bodyGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0.2, 0.18);
  s.lineTo(0.02, 0.3);
  s.lineTo(0.0, 0.62);
  s.lineTo(0.12, 0.76);
  s.lineTo(0.9, 0.82);
  s.lineTo(1.5, 0.85);
  s.lineTo(2.95, 0.8);
  s.lineTo(3.85, 0.64);
  s.lineTo(4.32, 0.5);
  s.lineTo(4.4, 0.32);
  s.lineTo(4.28, 0.18);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 1.9, bevelEnabled: true, bevelThickness: 0.09, bevelSize: 0.09, bevelSegments: 2, steps: 1 });
  g.rotateY(-Math.PI / 2);
  g.translate(0.95, 0, -2.2);
  return g;
}

function cabinGeometry() {
  const s = new THREE.Shape();
  s.moveTo(1.32, 0.82);
  s.lineTo(1.95, 1.2);
  s.lineTo(2.72, 1.22);
  s.lineTo(3.4, 0.82);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 1.56, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 1, steps: 1 });
  g.rotateY(-Math.PI / 2);
  g.translate(0.78, 0, -2.2);
  return g;
}

function buildWheel() {
  const group = new THREE.Group();
  const tireGeo = new THREE.CylinderGeometry(CAR.wheelRadius, CAR.wheelRadius, 0.26, 14);
  tireGeo.rotateZ(Math.PI / 2);
  const tire = new THREE.Mesh(tireGeo, new THREE.MeshStandardMaterial({ color: 0x0e0f12, roughness: 0.92 }));
  tire.castShadow = true;
  group.add(tire);
  const hubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.27, 10);
  hubGeo.rotateZ(Math.PI / 2);
  const hub = new THREE.Mesh(hubGeo, new THREE.MeshStandardMaterial({ color: 0xb8bcc4, roughness: 0.3, metalness: 0.85 }));
  group.add(hub);
  const spokeGeo = new THREE.BoxGeometry(0.28, 0.34, 0.07);
  const spokeMat = new THREE.MeshStandardMaterial({ color: 0x8a8f98, roughness: 0.35, metalness: 0.8 });
  for (let i = 0; i < 3; i++) {
    const spoke = new THREE.Mesh(spokeGeo, spokeMat);
    spoke.rotation.x = (i / 3) * Math.PI;
    group.add(spoke);
  }
  return group;
}

export function createVehicleMesh() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const paint = new THREE.MeshPhysicalMaterial({
    color: 0x2468e8,
    roughness: 0.3,
    metalness: 0.45,
    clearcoat: 1.0,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.3,
  });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0a1218, roughness: 0.08, metalness: 0.9, envMapIntensity: 1.6 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x101216, roughness: 0.6 });

  const hull = new THREE.Mesh(bodyGeometry(), paint);
  hull.castShadow = true;
  body.add(hull);
  const cabin = new THREE.Mesh(cabinGeometry(), glass);
  cabin.castShadow = true;
  body.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.07, 0.95), paint);
  roof.position.set(0, 1.24, -0.12);
  body.add(roof);

  const splitter = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.1, 0.5), trim);
  splitter.position.set(0, 0.16, 2.15);
  body.add(splitter);
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.16, 0.4), trim);
  diffuser.position.set(0, 0.2, -2.15);
  body.add(diffuser);
  const skirtGeo = new THREE.BoxGeometry(0.12, 0.16, 2.6);
  for (const side of [-1, 1]) {
    const skirt = new THREE.Mesh(skirtGeo, trim);
    skirt.position.set(side * 0.98, 0.2, 0);
    body.add(skirt);
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.16), paint);
    mirror.position.set(side * 1.06, 0.92, 1.05);
    body.add(mirror);
  }
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.07, 0.42), trim);
  spoiler.position.set(0, 1.0, -2.05);
  body.add(spoiler);
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.1), trim);
    strut.position.set(side * 0.7, 0.88, -2.05);
    body.add(strut);
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.2, 8), new THREE.MeshStandardMaterial({ color: 0x555a62, metalness: 0.9, roughness: 0.3 }));
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(side * 0.45, 0.26, -2.24);
    body.add(exhaust);
  }

  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff7e0, emissive: 0xfff2cc, emissiveIntensity: 2.4 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff2211, emissiveIntensity: 1.1 });
  const reverseMat = new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0xffffff, emissiveIntensity: 0 });
  const headGeo = new THREE.BoxGeometry(0.42, 0.12, 0.08);
  for (const side of [-1, 1]) {
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(side * 0.62, 0.52, 2.24);
    body.add(head);
  }
  const tailBar = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 0.06), tailMat);
  tailBar.position.set(0, 0.66, -2.26);
  body.add(tailBar);
  const reverseGeo = new THREE.BoxGeometry(0.2, 0.08, 0.06);
  for (const side of [-1, 1]) {
    const rev = new THREE.Mesh(reverseGeo, reverseMat);
    rev.position.set(side * 0.55, 0.48, -2.26);
    body.add(rev);
  }
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.03), new THREE.MeshStandardMaterial({ color: 0xe8e4d8, roughness: 0.5 }));
  plate.position.set(0, 0.36, -2.27);
  body.add(plate);

  const wheels = [];
  const steerGroups = [];
  for (const [x, z, front] of [[-0.88, 1.42, true], [0.88, 1.42, true], [-0.88, -1.45, false], [0.88, -1.45, false]]) {
    const steer = new THREE.Group();
    steer.position.set(x, CAR.wheelRadius, z);
    const wheel = buildWheel();
    steer.add(wheel);
    root.add(steer);
    wheels.push(wheel);
    steerGroups.push(front ? steer : null);
  }

  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false });
  const beamGeo = new THREE.PlaneGeometry(2.6, 9);
  beamGeo.rotateX(-Math.PI / 2);
  for (const side of [-1, 1]) {
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(side * 0.62, 0.06, 6.6);
    root.add(beam);
  }
  const tailGlowMat = new THREE.MeshBasicMaterial({ color: 0xff2211, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const tailGlowGeo = new THREE.PlaneGeometry(2.2, 1.6);
  tailGlowGeo.rotateX(-Math.PI / 2);
  const tailGlow = new THREE.Mesh(tailGlowGeo, tailGlowMat);
  tailGlow.position.set(0, 0.06, -3.1);
  root.add(tailGlow);

  const shadowGeo = new THREE.CircleGeometry(1.9, 14);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadow = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }));
  shadow.scale.set(1, 1, 1.5);
  shadow.position.y = 0.045;
  root.add(shadow);

  const headlights = [];
  for (const side of [-1, 1]) {
    const spot = new THREE.SpotLight(0xffd9a0, 60, 55, 0.42, 0.5, 1.4);
    spot.position.set(side * 0.62, 0.55, 2.2);
    const target = new THREE.Object3D();
    target.position.set(side * 0.9, 0, 22);
    root.add(target);
    spot.target = target;
    root.add(spot);
    headlights.push(spot);
  }

  return { root, body, wheels, steerGroups, headMat, tailMat, reverseMat, tailGlowMat, headlights, name: PLAYER_CAR_NAME };
}

export class Vehicle {
  constructor(mesh, spawn) {
    this.mesh = mesh;
    this.x = spawn.x;
    this.z = spawn.z;
    this.heading = spawn.heading;
    this.vx = 0;
    this.vz = 0;
    this.steer = 0;
    this.speed = 0;
    this.forwardSpeed = 0;
    this.slip = 0;
    this.braking = false;
    this.reversing = false;
    this.impact = 0;
    this.gear = 'N';
    this.rpm = 0.15;
    this.wheelSpin = 0;
    this.pitch = 0;
    this.roll = 0;
  }

  reset(spawn) {
    this.x = spawn.x;
    this.z = spawn.z;
    this.heading = spawn.heading;
    this.vx = 0;
    this.vz = 0;
    this.speed = 0;
    this.impact = 0;
  }

  step(dt, input, colliders) {
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    const rx = Math.cos(this.heading);
    const rz = -Math.sin(this.heading);
    let vF = this.vx * fx + this.vz * fz;
    let vL = this.vx * rx + this.vz * rz;

    const throttle = input.throttle();
    const handbrake = input.handbrake();
    this.braking = false;
    this.reversing = vF < -0.5;

    if (throttle > 0) {
      if (vF < -0.5) {
        vF += CAR.brake * dt;
        this.braking = true;
      } else {
        vF += CAR.accel * (1 - clamp(vF / CAR.maxSpeed, 0, 1) * 0.85) * dt;
      }
    } else if (throttle < 0) {
      if (vF > 0.5) {
        vF -= CAR.brake * dt;
        this.braking = true;
      } else {
        vF -= CAR.reverseAccel * (1 - clamp(-vF / CAR.maxReverse, 0, 1)) * dt;
      }
    }
    if (handbrake) {
      vF -= Math.sign(vF) * Math.min(Math.abs(vF), CAR.brake * 0.55 * dt);
      this.braking = Math.abs(vF) > 1;
    }

    vF -= vF * Math.abs(vF) * CAR.drag * dt;
    vF -= Math.sign(vF) * Math.min(Math.abs(vF), CAR.rolling * dt);
    vF = clamp(vF, -CAR.maxReverse, CAR.maxSpeed);

    const steerInput = input.steer();
    const steerTarget = steerInput * CAR.steerMax / (1 + Math.abs(vF) * CAR.steerSpeedFalloff);
    this.steer = damp(this.steer, steerTarget, CAR.steerLerp, dt);

    let grip = CAR.grip;
    if (handbrake) grip = CAR.gripHandbrake;
    else if (Math.abs(steerInput) > 0.5 && Math.abs(vF) > 22) grip = CAR.gripSlide;
    vL *= Math.exp(-grip * dt);
    if (handbrake && Math.abs(vF) > 8) vL += this.steer * Math.abs(vF) * 0.32 * dt;

    const yaw = (vF / CAR.wheelbase) * Math.tan(this.steer) * (handbrake ? 1.35 : 1);
    this.heading += clamp(yaw, -CAR.maxYawRate, CAR.maxYawRate) * dt;

    const fx2 = Math.sin(this.heading);
    const fz2 = Math.cos(this.heading);
    const rx2 = Math.cos(this.heading);
    const rz2 = -Math.sin(this.heading);
    this.vx = fx2 * vF + rx2 * vL;
    this.vz = fz2 * vF + rz2 * vL;
    this.x += this.vx * dt;
    this.z += this.vz * dt;

    this.impact = Math.max(0, this.impact - dt * 3);
    this.resolveCollisions(colliders);
    this.resolveBounds();

    this.forwardSpeed = vF;
    this.speed = Math.hypot(this.vx, this.vz);
    this.slip = Math.abs(vL);
    this.wheelSpin += (vF / CAR.wheelRadius) * dt;

    const accelFeel = throttle > 0 ? -0.028 : this.braking ? 0.04 : 0;
    this.pitch = damp(this.pitch, accelFeel * clamp(Math.abs(vF) / 20, 0, 1), 5, dt);
    this.roll = damp(this.roll, clamp(-yaw * vF * 0.006, -0.07, 0.07), 6, dt);

    const kmh = Math.abs(vF) * 3.6;
    if (vF < -0.5) this.gear = 'R';
    else if (kmh < 1) this.gear = 'N';
    else this.gear = String(clamp(1 + Math.floor(kmh / 34), 1, 6));
    const gearBand = this.gear === 'R' ? kmh / 45 : (kmh % 34) / 34;
    this.rpm = damp(this.rpm, clamp(0.18 + gearBand * 0.75 + (throttle > 0 ? 0.08 : 0), 0.1, 1), 8, dt);

    this.syncMesh(dt);
  }

  resolveCollisions(colliders) {
    const r = CAR.radius;
    for (const b of colliders) {
      if (this.x < b.minX - r || this.x > b.maxX + r || this.z < b.minZ - r || this.z > b.maxZ + r) continue;
      const cx = clamp(this.x, b.minX, b.maxX);
      const cz = clamp(this.z, b.minZ, b.maxZ);
      let dx = this.x - cx;
      let dz = this.z - cz;
      let dist = Math.hypot(dx, dz);
      if (dist >= r) continue;
      if (dist < 0.0001) {
        const left = this.x - b.minX;
        const right = b.maxX - this.x;
        const top = this.z - b.minZ;
        const bottom = b.maxZ - this.z;
        const m = Math.min(left, right, top, bottom);
        dx = m === left ? -1 : m === right ? 1 : 0;
        dz = m === top ? -1 : m === bottom ? 1 : 0;
        dist = 0;
      } else {
        dx /= dist;
        dz /= dist;
      }
      const push = r - dist;
      this.x += dx * push;
      this.z += dz * push;
      const vn = this.vx * dx + this.vz * dz;
      if (vn < 0) {
        this.vx -= (1 + CAR.restitution) * vn * dx;
        this.vz -= (1 + CAR.restitution) * vn * dz;
        this.vx *= 0.82;
        this.vz *= 0.82;
        const hit = Math.abs(vn);
        if (hit > 3) this.impact = Math.min(1, this.impact + hit / 22);
      }
    }
  }

  resolveBounds() {
    const onPier = this.z > WORLD.pierMinZ && this.z < WORLD.pierMaxZ;
    const minX = onPier ? WORLD.pierMinX + 2 : WORLD.coastX + 3;
    if (this.x < minX) {
      this.x = minX;
      if (this.vx < 0) this.vx *= -0.3;
    }
    if (this.x > WORLD.half - 12) {
      this.x = WORLD.half - 12;
      if (this.vx > 0) this.vx *= -0.3;
    }
    if (this.z < -WORLD.half + 8) {
      this.z = -WORLD.half + 8;
      if (this.vz < 0) this.vz *= -0.3;
    }
    if (this.z > WORLD.half - 8) {
      this.z = WORLD.half - 8;
      if (this.vz > 0) this.vz *= -0.3;
    }
  }

  syncMesh(dt) {
    const m = this.mesh;
    const y = this.groundY();
    m.root.position.set(this.x, y, this.z);
    m.root.rotation.y = this.heading;
    m.body.rotation.x = this.pitch;
    m.body.rotation.z = this.roll;
    for (const w of m.wheels) w.rotation.x = this.wheelSpin;
    for (const s of m.steerGroups) if (s) s.rotation.y = this.steer * 0.8;
    m.tailMat.emissiveIntensity = this.braking ? 3.6 : 1.1;
    m.tailGlowMat.opacity = this.braking ? 0.22 : 0;
    m.reverseMat.emissiveIntensity = this.reversing ? 1.6 : 0;
  }

  groundY() {
    return heightAt(this.x, this.z);
  }
}
