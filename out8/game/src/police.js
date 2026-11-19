import THREE from 'three';
import { createVehicleMesh, Vehicle } from './vehicle.js';
import { POLICE_SHORT } from './config.js';
import { mulberry32, clamp } from './utils.js';

export const LEVEL_UNITS = [0, 1, 2, 3, 4, 5];
export const HELI_LEVEL = 4;
export const SPOTTED_RANGE = 150;
export const ESCAPE_SECONDS = 9;

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function createHelicopterMesh() {
  const root = new THREE.Group();
  const navy = new THREE.MeshStandardMaterial({ color: 0x1c2440, roughness: 0.45, metalness: 0.4 });
  const white = new THREE.MeshStandardMaterial({ color: 0xe8ecf4, roughness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x101216, roughness: 0.6 });

  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.0, 5.2), navy);
  hull.castShadow = true;
  root.add(hull);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.05, 10, 8), navy);
  nose.position.set(0, -0.15, 2.6);
  nose.scale.set(1, 0.85, 1.2);
  root.add(nose);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(0.85, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), new THREE.MeshPhysicalMaterial({ color: 0x0a1218, roughness: 0.1, metalness: 0.8 }));
  glass.position.set(0, 0.55, 2.3);
  glass.rotation.x = Math.PI * 0.42;
  root.add(glass);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.35, 5.24), white);
  stripe.position.y = 0.1;
  root.add(stripe);
  const boom = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.5, 4.8), navy);
  boom.position.set(0, 0.35, -4.6);
  root.add(boom);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.5, 0.9), white);
  fin.position.set(0, 1.0, -6.8);
  root.add(fin);
  const tailRotor = new THREE.Group();
  const bladeGeo = new THREE.BoxGeometry(0.08, 1.7, 0.16);
  const bladeA = new THREE.Mesh(bladeGeo, dark);
  const bladeB = new THREE.Mesh(bladeGeo, dark);
  bladeB.rotation.x = Math.PI / 2;
  tailRotor.add(bladeA, bladeB);
  tailRotor.position.set(0.14, 1.0, -6.8);
  root.add(tailRotor);
  const rotor = new THREE.Group();
  const mainGeo = new THREE.BoxGeometry(8.4, 0.06, 0.3);
  const mainA = new THREE.Mesh(mainGeo, dark);
  const mainB = new THREE.Mesh(mainGeo, dark);
  mainB.rotation.y = Math.PI / 2;
  rotor.add(mainA, mainB);
  rotor.position.y = 1.35;
  root.add(rotor);
  const blurGeo = new THREE.CircleGeometry(4.3, 24);
  blurGeo.rotateX(-Math.PI / 2);
  const blurMat = new THREE.MeshBasicMaterial({ color: 0x2a2f38, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
  const blurDisc = new THREE.Mesh(blurGeo, blurMat);
  blurDisc.position.y = 1.37;
  root.add(blurDisc);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.6, 6), dark);
  mast.position.y = 1.1;
  root.add(mast);
  for (const side of [-1, 1]) {
    const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.6, 6), dark);
    skid.rotation.x = Math.PI / 2;
    skid.position.set(side * 0.9, -1.35, 0.2);
    root.add(skid);
    const strutF = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), dark);
    strutF.position.set(side * 0.9, -1.1, 1.1);
    root.add(strutF);
    const strutB = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), dark);
    strutB.position.set(side * 0.9, -1.1, -0.8);
    root.add(strutB);
  }
  const beaconMat = new THREE.MeshStandardMaterial({ color: 0x440000, emissive: 0xff2020, emissiveIntensity: 2 });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), beaconMat);
  beacon.position.set(0, -0.9, -2.2);
  root.add(beacon);
  const coneMat = new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(7, 30, 12, 1, true), coneMat);
  cone.position.y = -16;
  root.add(cone);
  root.scale.setScalar(1.18);

  return { root, rotor, tailRotor, beaconMat, coneMat };
}

export function createPolice(scene, world, seed = 1) {
  const rand = mulberry32(seed * 7919 + 101);
  const units = [];
  let level = 0;
  let unitCounter = 0;
  let heli = null;
  let heliAngle = rand() * Math.PI * 2;
  let searchTimer = 0;
  let spotted = false;
  let onFoot = false;
  let footBustedTimer = 0;
  const lastKnown = { x: 0, z: 0 };

  function spawnUnit(spawn, status) {
    const mesh = createVehicleMesh({ police: true, paint: 0xdde1e8, spotlights: false, name: 'ABPD Cruiser' });
    scene.add(mesh.root);
    const vehicle = new Vehicle(mesh, spawn);
    vehicle.syncMesh(0);
    unitCounter += 1;
    const unit = {
      id: `${POLICE_SHORT}-${10 + unitCounter}`,
      vehicle,
      mesh,
      status,
      roadblock: status === 'ROADBLOCK',
      phase: rand() * Math.PI * 2,
    };
    units.push(unit);
    return unit;
  }

  function removeUnit(unit) {
    scene.remove(unit.mesh.root);
    const i = units.indexOf(unit);
    if (i >= 0) units.splice(i, 1);
  }

  function setLevel(n, focus) {
    n = clamp(Math.round(n), 0, 5);
    const want = LEVEL_UNITS[n];
    while (units.length > want) removeUnit(units[units.length - 1]);
    while (units.length < want) {
      const a = rand() * Math.PI * 2;
      const r = 95 + rand() * 55;
      const spawn = { x: focus.x + Math.sin(a) * r, z: focus.z + Math.cos(a) * r, heading: a + Math.PI };
      spawnUnit(spawn, 'PURSUIT');
    }
    if (n >= 4 && units.length > 0) {
      const blocker = units[units.length - 1];
      if (!blocker.roadblock) {
        blocker.roadblock = true;
        blocker.status = 'ROADBLOCK';
        const fx = Math.sin(focus.heading ?? 0);
        const fz = Math.cos(focus.heading ?? 0);
        blocker.vehicle.x = focus.x + fx * 130;
        blocker.vehicle.z = focus.z + fz * 130;
        blocker.vehicle.heading = (focus.heading ?? 0) + Math.PI / 2;
        blocker.vehicle.vx = 0;
        blocker.vehicle.vz = 0;
        blocker.vehicle.syncMesh(0);
      }
    }
    if (n >= HELI_LEVEL && !heli) {
      heli = createHelicopterMesh();
      heli.root.position.set(focus.x, 48, focus.z);
      scene.add(heli.root);
    } else if (n < HELI_LEVEL && heli) {
      scene.remove(heli.root);
      heli = null;
    }
    if (n < level) for (const u of units) if (!u.roadblock) u.status = 'SEARCHING';
    level = n;
    searchTimer = 0;
  }

  function raise(amount, focus) {
    setLevel(level + amount, focus);
  }

  function driveUnit(u, dt, target) {
    if (u.disabled) {
      u.vehicle.vx = 0;
      u.vehicle.vz = 0;
      u.vehicle.forwardSpeed = 0;
      u.vehicle.syncMesh(dt);
      return Math.hypot(target.x - u.vehicle.x, target.z - u.vehicle.z);
    }
    const v = u.vehicle;
    const fx = Math.sin(target.heading);
    const fz = Math.cos(target.heading);
    const dist = Math.hypot(target.x - v.x, target.z - v.z);
    let aimX = target.x;
    let aimZ = target.z;
    let desired = 30;
    if (u.status === 'PURSUIT') {
      aimX -= fx * 9;
      aimZ -= fz * 9;
      desired = clamp(target.speed + 4 + dist * 0.07, 12, 50);
    } else if (u.status === 'INTERCEPT') {
      aimX += fx * 34;
      aimZ += fz * 34;
      desired = 46;
    } else if (u.status === 'RAMMING') {
      desired = clamp(target.speed + 8, 16, 52);
    } else if (u.status === 'SEARCHING') {
      aimX = lastKnown.x + Math.sin(heliAngle + u.phase) * 24;
      aimZ = lastKnown.z + Math.cos(heliAngle + u.phase) * 24;
      desired = 15;
    }
    const dx = aimX - v.x;
    const dz = aimZ - v.z;
    const err = wrapAngle(Math.atan2(dx, dz) - v.heading);
    const steer = clamp(err * 2.4, -1, 1);
    const throttle = v.forwardSpeed < desired ? 1 : v.forwardSpeed > desired + 3 ? -1 : 0;
    v.step(dt, { throttle: () => throttle, steer: () => steer, handbrake: () => false }, world.colliders);
    if (!u.roadblock) {
      if (!spotted) u.status = 'SEARCHING';
      else if (dist > 110) u.status = 'INTERCEPT';
      else if (dist < 22 && level >= 3) u.status = 'RAMMING';
      else u.status = 'PURSUIT';
    }
    return dist;
  }

  function flash(t) {
    for (const u of units) {
      const s = Math.sin(t * 9 + u.phase);
      const red = s > 0;
      if (u.mesh.sirenRedMat) u.mesh.sirenRedMat.emissiveIntensity = red ? 2.2 : 0.25;
      if (u.mesh.sirenBlueMat) u.mesh.sirenBlueMat.emissiveIntensity = red ? 0.25 : 2.2;
      if (u.mesh.sirenGlowRedMat) u.mesh.sirenGlowRedMat.opacity = red ? 0.1 : 0.015;
      if (u.mesh.sirenGlowBlueMat) u.mesh.sirenGlowBlueMat.opacity = red ? 0.015 : 0.1;
    }
    if (heli) heli.beaconMat.emissiveIntensity = Math.sin(t * 6) > 0 ? 4.5 : 0.5;
  }

  function update(dt, t, target) {
    if (level === 0) {
      spotted = false;
      return;
    }
    spotted = false;
    for (const u of units) {
      if (u.roadblock) {
        u.vehicle.syncMesh(dt);
        continue;
      }
      const dist = driveUnit(u, dt, target);
      if (dist < SPOTTED_RANGE) spotted = true;
    }
    if (onFoot && target) {
      let close = false;
      for (const u of units) {
        if (u.roadblock || u.disabled) continue;
        if (Math.hypot(u.vehicle.x - target.x, u.vehicle.z - target.z) < 2.5 && (target.speed ?? 0) < 1) { close = true; break; }
      }
      footBustedTimer = close ? footBustedTimer + dt : 0;
    } else {
      footBustedTimer = 0;
    }
    if (heli) {
      heliAngle += dt * 0.32;
      const hx = target.x + Math.sin(heliAngle) * 44;
      const hz = target.z + Math.cos(heliAngle) * 44;
      const hy = 46 + Math.sin(t * 0.5) * 2;
      heli.root.position.set(hx, hy, hz);
      heli.root.rotation.y = heliAngle + Math.PI / 2;
      heli.rotor.rotation.y += dt * 24;
      heli.tailRotor.rotation.x += dt * 32;
      if (Math.hypot(hx - target.x, hz - target.z) < 170) spotted = true;
    }
    if (spotted) {
      lastKnown.x = target.x;
      lastKnown.z = target.z;
      searchTimer = 0;
    } else {
      searchTimer += dt;
      if (searchTimer >= ESCAPE_SECONDS) setLevel(level - 1, target);
    }
    flash(t);
  }

  function info(target) {
    return units.map((u) => ({
      id: u.id,
      dist: Math.hypot(u.vehicle.x - target.x, u.vehicle.z - target.z),
      status: u.status,
    }));
  }

  function placeUnit(index, x, z, heading, speed, status) {
    const u = units[index];
    if (!u) return;
    const v = u.vehicle;
    v.x = x;
    v.z = z;
    v.heading = heading;
    v.vx = Math.sin(heading) * speed;
    v.vz = Math.cos(heading) * speed;
    v.forwardSpeed = speed;
    v.speed = speed;
    u.status = status;
    u.roadblock = status === 'ROADBLOCK';
    v.syncMesh(0);
  }

  function placeHeli(x, y, z, heading) {
    if (!heli) return;
    heli.root.position.set(x, y, z);
    heli.root.rotation.y = heading ?? Math.atan2(x - lastKnown.x, z - lastKnown.z);
  }

  function heliPos() {
    return heli ? { x: heli.root.position.x, y: heli.root.position.y, z: heli.root.position.z } : null;
  }

  function searchZone() {
    return level > 0 && !spotted ? { x: lastKnown.x, z: lastKnown.z, r: SPOTTED_RANGE } : null;
  }

  function setLastKnown(x, z) {
    lastKnown.x = x;
    lastKnown.z = z;
  }

  function setOnFoot(value) {
    onFoot = !!value;
    footBustedTimer = 0;
  }

  function damageUnit(unit, amount) {
    if (!unit || unit.disabled) return;
    unit.disabled = true;
    unit.roadblock = true;
    unit.status = 'SEARCHING';
    unit.vehicle.vx = 0;
    unit.vehicle.vz = 0;
    unit.vehicle.forwardSpeed = 0;
    unit.vehicle.impact = Math.min(1, (unit.vehicle.impact ?? 0) + amount / 120);
    unit.vehicle.syncMesh(0);
  }

  function serialize() {
    return {
      level,
      lastKnown: { ...lastKnown },
      units: units.map((u) => ({ x: u.vehicle.x, z: u.vehicle.z, heading: u.vehicle.heading, status: u.status, roadblock: u.roadblock })),
    };
  }

  function load(data) {
    if (!data) return;
    setLevel(data.level ?? 0, { x: lastKnown.x, z: lastKnown.z, heading: 0 });
    if (data.lastKnown) setLastKnown(data.lastKnown.x, data.lastKnown.z);
    (data.units ?? []).forEach((u, i) => placeUnit(i, u.x, u.z, u.heading, 0, u.status));
  }

  return {
    units,
    setLevel,
    raise,
    update,
    flash,
    info,
    placeUnit,
    placeHeli,
    heliPos,
    searchZone,
    setLastKnown,
    getLevel: () => level,
    isSpotted: () => spotted,
    busted: () => onFoot && footBustedTimer >= 1.5,
    setOnFoot,
    damageUnit,
    serialize,
    load,
  };
}
