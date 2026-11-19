import THREE from 'three';
import { COMBAT, SAFEHOUSE } from './config.js';
import { mulberry32, clamp } from './utils.js';
import { heightAt } from './world.js';

export const WEAPONS = {
  pistol: {
    name: 'Kestrel 9',
    dmg: COMBAT.dmg,
    mag: COMBAT.mag,
    reserve: COMBAT.reserve,
    rate: COMBAT.rate,
    reload: COMBAT.reload,
    range: COMBAT.range,
    spread: COMBAT.spread,
  },
};

function buildPistol() {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x262a32, metalness: 0.85, roughness: 0.32 });
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.75 });
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.11, 0.4), metal);
  slide.position.z = 0.06;
  g.add(slide);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.2, 0.1), gripMat);
  grip.position.set(0, -0.14, -0.08);
  grip.rotation.x = 0.22;
  g.add(grip);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.025, 0.03), metal);
  sight.position.set(0, 0.07, 0.23);
  g.add(sight);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, 0.12), metal);
  guard.position.set(0, -0.08, 0.02);
  g.add(guard);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.06, 8), metal);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.01, 0.28);
  g.add(barrel);
  g.scale.setScalar(1.25);
  return g;
}

export function createCombat(deps) {
  const scene = deps.scene;
  const hud = deps.hud;
  const player = deps.player;
  const car = deps.car;
  const police = deps.police;
  const peds = deps.peds;
  const traffic = deps.traffic;
  const effects = deps.effects;
  const audio = deps.audio;
  let camera = deps.camera;
  const rand = mulberry32((deps.seed ?? 1) * 2654435761 + 17);

  const raycaster = new THREE.Raycaster();
  const center = new THREE.Vector2(0, 0);
  const muzzle = new THREE.Vector3();
  const tmpBox = new THREE.Box3();
  const tmpVec = new THREE.Vector3();
  const tmpPoint = new THREE.Vector3();
  const hp = new WeakMap();
  const hostiles = [];

  const pistol = buildPistol();
  pistol.position.set(0, -0.56, 0.16);
  pistol.rotation.x = -0.18;
  pistol.visible = false;
  player.mesh.armR.add(pistol);

  let health = COMBAT.maxHealth;
  let mag = WEAPONS.pistol.mag;
  let reserve = WEAPONS.pistol.reserve;
  let fireTimer = 0;
  let reloadTimer = 0;
  let regenTimer = 0;
  let wantedTimer = 0;
  let isAiming = false;
  let dead = false;
  let damageFlash = 0;
  let hostileCounter = 0;

  const getMode = () => deps.getMode?.() ?? 'car';
  const currentTarget = () => getMode() === 'car' ? car : player;

  function hostileMesh() {
    const root = new THREE.Group();
    const coat = new THREE.MeshStandardMaterial({ color: 0x23262e, roughness: 0.8 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xa8795a, roughness: 0.8 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.6, 0.28), coat);
    torso.position.y = 1.1;
    torso.castShadow = true;
    root.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), skin);
    head.position.y = 1.56;
    root.add(head);
    const legGeo = new THREE.BoxGeometry(0.16, 0.8, 0.18);
    legGeo.translate(0, -0.4, 0);
    const legL = new THREE.Mesh(legGeo, coat);
    legL.position.set(-0.11, 0.82, 0);
    const legR = new THREE.Mesh(legGeo, coat);
    legR.position.set(0.11, 0.82, 0);
    root.add(legL, legR);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.34), new THREE.MeshStandardMaterial({ color: 0x14161b, metalness: 0.7, roughness: 0.4 }));
    gun.position.set(0.28, 1.08, 0.22);
    root.add(gun);
    return { root, legL, legR };
  }

  function addHostile(pos) {
    const mesh = hostileMesh();
    scene.add(mesh.root);
    const h = {
      id: ++hostileCounter,
      x: pos.x,
      z: pos.z,
      heading: 0,
      health: COMBAT.hostileHealth,
      mode: 'seek',
      cooldown: rand() * COMBAT.hostileRate,
      strafe: rand() < 0.5 ? 1 : -1,
      phase: rand() * Math.PI * 2,
      mesh,
    };
    hostiles.push(h);
    return h;
  }

  function spawnHostiles(x, z, count) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const r = 9 + rand() * 16;
      out.push(addHostile({ x: x + Math.sin(a) * r, z: z + Math.cos(a) * r }));
    }
    return out;
  }

  function setDamageFlash(v) {
    damageFlash = clamp(v, 0, 1);
    hud.setDamageFlash?.(damageFlash);
  }

  function die() {
    if (dead) return;
    dead = true;
    health = 0;
    isAiming = false;
    pistol.visible = false;
    hud.setCash(Math.max(0, hud.getCash() - 200));
    police?.setLevel?.(0, player);
    audio?.play?.('fail');
    hud.showScreen('wasted');
    deps.onDeath?.();
  }

  function damagePlayer(amount) {
    if (dead) return;
    health = Math.max(0, health - amount);
    regenTimer = 0;
    setDamageFlash(1);
    audio?.play?.('hit');
    if (health <= 0) die();
    hud.setHealth?.(health);
  }

  function damageVehicle(vehicle, amount) {
    const h = (hp.get(vehicle) ?? COMBAT.vehicleHealth) - amount * COMBAT.vehicleDmgScale;
    hp.set(vehicle, h);
    vehicle.impact = Math.min(1, (vehicle.impact ?? 0) + 0.2);
    vehicle.speed *= 0.9;
    vehicle.forwardSpeed *= 0.9;
    effects?.smoke?.(vehicle.x, vehicle.groundY() + 0.6, vehicle.z);
    audio?.play?.('impact');
    if (vehicle === car && h <= 0 && getMode() === 'car') damagePlayer(100);
  }

  function isVehicleDestroyed(vehicle) {
    return (hp.get(vehicle) ?? COMBAT.vehicleHealth) <= 0;
  }

  function collectTargets() {
    const out = [];
    const addBox = (x, z, hw, hh, hd, kind, ref) => {
      const y = heightAt(x, z) + hh;
      tmpBox.min.set(x - hw, y - hh, z - hd);
      tmpBox.max.set(x + hw, y + hh, z + hd);
      out.push({ box: tmpBox.clone(), kind, ref });
    };
    for (const h of hostiles) addBox(h.x, h.z, 0.45, 0.9, 0.45, 'hostile', h);
    if (police) {
      for (const u of police.units) addBox(u.vehicle.x, u.vehicle.z, 1.15, 0.95, 2.5, 'police', u);
    }
    if (traffic) {
      for (const m of traffic.list?.() ?? []) addBox(m.vehicle.x, m.vehicle.z, 1.1, 0.9, 2.4, 'vehicle', m.vehicle);
    }
    if (deps.world?.colliders) {
      for (const c of deps.world.colliders) {
        tmpBox.min.set(c.minX, -1, c.minZ);
        tmpBox.max.set(c.maxX, 48, c.maxZ);
        out.push({ box: tmpBox.clone(), kind: 'world', ref: null });
      }
    }
    return out;
  }

  function shoot() {
    if (dead || getMode() !== 'foot' || fireTimer > 0 || reloadTimer > 0) return false;
    if (mag <= 0) { reload(); return false; }
    mag -= 1;
    fireTimer = WEAPONS.pistol.rate;
    if (wantedTimer <= 0 && police) {
      police.raise?.(1, currentTarget());
      wantedTimer = COMBAT.wantedWindow;
    }
    camera?.updateMatrixWorld?.();
    raycaster.setFromCamera(center, camera);
    const dir = raycaster.ray.direction;
    dir.x += (rand() - 0.5) * COMBAT.spread;
    dir.y += (rand() - 0.5) * COMBAT.spread;
    dir.z += (rand() - 0.5) * COMBAT.spread;
    dir.normalize();
    let best = Infinity;
    let hit = null;
    for (const t of collectTargets()) {
      if (raycaster.ray.intersectBox(t.box, tmpPoint)) {
        const d = tmpPoint.distanceTo(raycaster.ray.origin);
        if (d < best && d <= COMBAT.range) { best = d; hit = { ...t, point: tmpPoint.clone() }; }
      }
    }
    pistol.getWorldPosition(muzzle);
    const end = hit ? hit.point : tmpVec.copy(raycaster.ray.origin).addScaledVector(dir, COMBAT.range).clone();
    effects?.tracer?.(muzzle.x, muzzle.y, muzzle.z, end.x, end.y, end.z);
    effects?.flash?.(muzzle.x, muzzle.y, muzzle.z);
    audio?.play?.('shot');
    peds?.panic?.(currentTarget().x, currentTarget().z, 30);
    if (hit) {
      if (hit.kind === 'hostile') {
        hit.ref.health -= WEAPONS.pistol.dmg;
        if (hit.ref.health < COMBAT.hostilFleeHealth) hit.ref.mode = 'flee';
        if (hit.ref.health <= 0) {
          scene.remove(hit.ref.mesh.root);
          const i = hostiles.indexOf(hit.ref);
          if (i >= 0) hostiles.splice(i, 1);
        }
      } else if (hit.kind === 'police') {
        police?.damageUnit?.(hit.ref, WEAPONS.pistol.dmg);
      } else if (hit.kind === 'vehicle') {
        damageVehicle(hit.ref, WEAPONS.pistol.dmg);
      }
      effects?.chip?.(hit.point.x, hit.point.y, hit.point.z);
    }
    hud.setAmmo?.(mag, reserve);
    return true;
  }

  function reload() {
    if (reloadTimer > 0 || mag >= WEAPONS.pistol.mag || reserve <= 0) return false;
    reloadTimer = WEAPONS.pistol.reload;
    audio?.play?.('reload');
    return true;
  }

  function updateHostiles(dt, target) {
    for (let i = hostiles.length - 1; i >= 0; i--) {
      const h = hostiles[i];
      const dx = target.x - h.x;
      const dz = target.z - h.z;
      const dist = Math.hypot(dx, dz) || 0.001;
      let mx = 0;
      let mz = 0;
      if (h.mode === 'flee') {
        mx = -dx / dist;
        mz = -dz / dist;
        if (dist > 55) {
          scene.remove(h.mesh.root);
          hostiles.splice(i, 1);
          continue;
        }
      } else {
        h.heading = Math.atan2(dx, dz);
        if (dist > COMBAT.hostileFar) { mx = dx / dist; mz = dz / dist; }
        else if (dist < COMBAT.hostileNear) { mx = -dx / dist; mz = -dz / dist; }
        else { mx = -dz / dist * h.strafe; mz = dx / dist * h.strafe; }
        h.cooldown -= dt;
        if (h.cooldown <= 0 && dist < COMBAT.hostileRange && !dead) {
          h.cooldown = COMBAT.hostileRate * (0.85 + rand() * 0.3);
          const chance = clamp(1.05 - dist / COMBAT.hostileRange, 0.18, 0.8);
          effects?.tracer?.(h.x, heightAt(h.x, h.z) + 1.15, h.z, target.x, target.groundY() + 1.1, target.z);
          audio?.play?.('shot');
          if (rand() < chance) damagePlayer(COMBAT.hostileDmg);
        }
      }
      const speed = h.mode === 'flee' ? 6.2 : 3.4;
      h.x += mx * speed * dt;
      h.z += mz * speed * dt;
      h.phase += speed * dt * 2.4;
      h.mesh.root.position.set(h.x, heightAt(h.x, h.z) + 0.09, h.z);
      h.mesh.root.rotation.y = h.mode === 'flee' ? Math.atan2(mx, mz) : h.heading;
      h.mesh.legL.rotation.x = Math.sin(h.phase) * 0.6;
      h.mesh.legR.rotation.x = -Math.sin(h.phase) * 0.6;
    }
  }

  function update(dt, input, target) {
    const t = target ?? currentTarget();
    const onFoot = getMode() === 'foot' && !dead;
    isAiming = onFoot && (input?.down?.('aim') ?? false);
    deps.chase?.setAiming?.(isAiming);
    pistol.visible = onFoot && (isAiming || fireTimer > 0);
    if (onFoot) {
      player.mesh.armR.rotation.x = isAiming ? -1.15 : (pistol.visible ? -0.75 : player.mesh.armR.rotation.x);
    }
    if (fireTimer > 0) fireTimer -= dt;
    if (wantedTimer > 0) wantedTimer -= dt;
    regenTimer += dt;
    if (reloadTimer > 0) {
      reloadTimer -= dt;
      if (reloadTimer <= 0) {
        const need = WEAPONS.pistol.mag - mag;
        const take = Math.min(need, reserve);
        mag += take;
        reserve -= take;
      }
    }
    if (mag <= 0 && reserve > 0 && reloadTimer <= 0) reload();
    if (onFoot && input?.takePressed?.('fire')) shoot();
    if (onFoot && input?.takePressed?.('reload')) reload();
    if (onFoot && isAiming && input?.takePressed?.('reset')) reload();
    if (!dead && regenTimer >= COMBAT.regenDelay && health < COMBAT.maxHealth) {
      health = Math.min(COMBAT.maxHealth, health + COMBAT.regenRate * dt);
    }
    if (damageFlash > 0) setDamageFlash(damageFlash - dt * COMBAT.damageFlashDecay);
    hud.setHealth?.(health);
    hud.setAmmo?.(mag, reserve);
    if (!dead) updateHostiles(dt, t);
  }

  function respawn() {
    health = COMBAT.maxHealth;
    dead = false;
    isAiming = false;
    fireTimer = 0;
    reloadTimer = 0;
    regenTimer = 0;
    mag = WEAPONS.pistol.mag;
    reserve = WEAPONS.pistol.reserve;
    setDamageFlash(0);
    player.reset({ ...SAFEHOUSE, heading: 0 });
    player.syncMesh();
    pistol.visible = false;
    hud.showScreen(null);
    hud.setHealth?.(health);
    hud.setAmmo?.(mag, reserve);
  }

  function serialize() {
    return { health, mag, reserve, hostiles: hostiles.map((h) => ({ x: h.x, z: h.z, health: h.health })) };
  }

  function load(data) {
    if (!data) return;
    health = clamp(data.health ?? COMBAT.maxHealth, 0, COMBAT.maxHealth);
    mag = clamp(data.mag ?? COMBAT.mag, 0, WEAPONS.pistol.mag);
    reserve = Math.max(0, data.reserve ?? COMBAT.reserve);
    dead = false;
    for (const h of hostiles) scene.remove(h.mesh.root);
    hostiles.length = 0;
    for (const h of data.hostiles ?? []) addHostile(h);
    hud.setHealth?.(health);
    hud.setAmmo?.(mag, reserve);
  }

  hud.setHealth?.(health);
  hud.setAmmo?.(mag, reserve);

  return {
    update,
    aiming: () => isAiming,
    health: () => health,
    ammo: () => ({ mag, reserve }),
    damagePlayer,
    damageVehicle,
    isVehicleDestroyed,
    hostiles: () => hostiles.map((h) => ({ x: h.x, z: h.z, heading: h.heading, health: h.health })),
    spawnHostiles,
    serialize,
    load,
    shoot,
    reload,
    addHostile,
    step(dt, input, cameraOverride) {
      if (cameraOverride && cameraOverride.updateMatrixWorld && !cameraOverride.throttle) { deps.camera = cameraOverride; camera = cameraOverride; }
      update(dt, input, currentTarget());
    },
    respawn,
    dead: () => dead,
  };
}
