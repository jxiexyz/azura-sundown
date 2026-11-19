import THREE from 'three';
import { CAMERA } from './config.js';
import { clamp, damp } from './utils.js';
import { heightAt } from './world.js';

export class ChaseCamera {
  constructor(camera) {
    this.camera = camera;
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.shake = 0;
    this.time = 0;
    this.initialized = false;
    this.onFoot = false;
  }

  setOnFoot(onFoot) {
    if (this.onFoot !== onFoot) {
      this.onFoot = onFoot;
      this.initialized = false;
    }
  }

  addShake(amount) {
    this.shake = Math.min(1.2, this.shake + amount);
  }

  update(dt, car, colliders) {
    this.time += dt;
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    const speed = car.speed;
    const baseDist = this.onFoot ? 5.2 : CAMERA.distance;
    const baseHeight = this.onFoot ? 2.3 : CAMERA.height;
    const lookAhead = this.onFoot ? 3.2 : CAMERA.lookAhead;
    const dist = baseDist + speed * (this.onFoot ? 0.02 : CAMERA.distanceSpeedGain);
    const height = baseHeight + speed * (this.onFoot ? 0.005 : CAMERA.heightSpeedGain);
    const carY = car.groundY();

    let desiredX = car.x - fx * dist;
    let desiredZ = car.z - fz * dist;
    let desiredY = carY + height;

    for (const b of colliders) {
      if (desiredX > b.minX - 0.8 && desiredX < b.maxX + 0.8 && desiredZ > b.minZ - 0.8 && desiredZ < b.maxZ + 0.8) {
        desiredX = car.x - fx * dist * 0.45;
        desiredZ = car.z - fz * dist * 0.45;
        desiredY = carY + height + 1.5;
        break;
      }
    }
    desiredY = Math.max(desiredY, heightAt(desiredX, desiredZ) + 1.2);

    if (!this.initialized) {
      this.pos.set(desiredX, desiredY, desiredZ);
      this.look.set(car.x, carY + 1.2, car.z);
      this.initialized = true;
    }
    const lag = CAMERA.lag + speed * 0.02;
    this.pos.x = damp(this.pos.x, desiredX, lag, dt);
    this.pos.y = damp(this.pos.y, desiredY, lag * 1.4, dt);
    this.pos.z = damp(this.pos.z, desiredZ, lag, dt);

    const lookX = car.x + fx * lookAhead;
    const lookZ = car.z + fz * lookAhead;
    this.look.x = damp(this.look.x, lookX, 8, dt);
    this.look.y = damp(this.look.y, carY + (this.onFoot ? 1.35 : 1.15), 8, dt);
    this.look.z = damp(this.look.z, lookZ, 8, dt);

    this.shake = Math.max(0, this.shake - dt * 2.2);
    const speedShake = clamp((speed - CAMERA.shakeSpeedStart) / 30, 0, 1) * 0.05;
    const amp = this.shake * 0.35 + speedShake;
    const t = this.time;
    const ox = Math.sin(t * 47.3) * amp + Math.sin(t * 23.1) * amp * 0.5;
    const oy = Math.cos(t * 39.7) * amp * 0.7 + Math.sin(t * 61.3) * amp * 0.3;
    const oz = Math.sin(t * 31.9) * amp * 0.5;

    this.camera.position.set(this.pos.x + ox, this.pos.y + oy, this.pos.z + oz);
    this.camera.lookAt(this.look.x + ox * 0.4, this.look.y + oy * 0.4, this.look.z);
    const fov = (this.onFoot ? 58 : CAMERA.fovBase) + speed * (this.onFoot ? 0.05 : CAMERA.fovSpeedGain);
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov = damp(this.camera.fov, fov, 4, dt);
      this.camera.updateProjectionMatrix();
    }
  }
}
