import THREE from 'three';
import { STEP, MAX_FRAME, districtAt, PLAYER_NAME, START_CASH } from './config.js';
import { createInput } from './input.js';
import { createWorld } from './world.js';
import { createVehicleMesh, Vehicle } from './vehicle.js';
import { createPlayerMesh, Player } from './player.js';
import { ChaseCamera } from './camera.js';
import { createEffects, createSpeedOverlay } from './effects.js';
import { createHud } from './hud.js';
import { createMinimap } from './minimap.js';
import { createMissions } from './missions.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createAudio } from './audio.js';
import { createSave } from './save.js';

window.addEventListener('error', (e) => {
  window.__bootError = String(e.message);
  document.title = 'BOOT ERROR: ' + e.message;
});

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const isShot = !!shot;
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 7;

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 2600);

const world = createWorld(scene, seed);

const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene();
envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 24, 12), world.skyMat));
scene.environment = pmrem.fromScene(envScene, 0.06, 0.1, 300).texture;
pmrem.dispose();

const carMesh = createVehicleMesh();
scene.add(carMesh.root);
const car = new Vehicle(carMesh, world.spawn);
car.syncMesh(0);

const playerMesh = createPlayerMesh();
scene.add(playerMesh.root);
const player = new Player(playerMesh, { x: world.spawn.x + 2, z: world.spawn.z, heading: 0 });
player.hide();

const chase = new ChaseCamera(camera);
const effects = createEffects(scene);
const speedOverlay = createSpeedOverlay(document.getElementById('vignette'));
const hud = createHud();
const minimap = createMinimap(world);

const IDLE_INPUT = { throttle: () => 0, steer: () => 0, handbrake: () => false, down: () => false, takePressed: () => false };

let state = 'start';
let mode = 'car';
let activeVehicle = car;
let activeMesh = carMesh;
let invertY = false;
let elapsed = 0;
let accumulator = 0;
let last = performance.now();
let lastImpact = 0;
let heatGuard = 0;
let panelAcc = 0;
let shotFrozen = false;
let lastDistrict = districtAt(car.x, car.z);

const deps = {
  scene, camera, chase, hud, world, car, player, effects, seed, isShot: () => isShot,
  getMode: () => mode,
  getState: () => state,
  target: () => (mode === 'car' ? activeVehicle : player),
};

const missions = createMissions(deps);
deps.missions = missions;
const input = createInput();
deps.input = input;
const traffic = createTraffic(scene, world, seed);
deps.traffic = traffic;
const peds = createPedestrians(scene, world, seed);
deps.peds = peds;
const police = createPolice(scene, world, seed);
deps.police = police;
const combat = createCombat(deps);
deps.combat = combat;
const audio = createAudio();
deps.audio = audio;

deps.onShake = (v) => { chase.shakeEnabled = !!v; };
deps.onInvert = (v) => { invertY = !!v; };
deps.onQuality = (v) => {
  renderer.setPixelRatio(v === 'low' ? 1 : Math.min(window.devicePixelRatio, 1.75));
  world.sun.shadow.mapSize.set(v === 'low' ? 1024 : 2048, v === 'low' ? 1024 : 2048);
  world.sun.shadow.needsUpdate = true;
};
deps.onResume = () => setPaused(false);
deps.onQuit = () => { state = 'start'; audio.suspend(); };
deps.onContinue = () => startGame();
deps.onLoad = (data) => {
  mode = data.mode === 'foot' ? 'foot' : 'car';
  activeVehicle = car;
  activeMesh = carMesh;
  chase.setOnFoot(mode === 'foot');
  if (mode === 'foot') player.syncMesh();
  else player.hide();
  hud.setDriving(mode === 'car', activeMesh.name);
  hud.setWanted(police.getLevel());
  chase.initialized = false;
};
deps.onDeath = () => { state = 'pause'; };
deps.onComplete = () => { state = 'pause'; save.save(); };
deps.onFail = () => { state = 'pause'; };

const save = createSave(deps);
deps.save = save;

hud.setDistrict(lastDistrict.name);
hud.setDriving(true, carMesh.name);
hud.showScreen('start');
hud.setCash(START_CASH);

const unlockAudio = () => {
  audio.unlock();
  window.removeEventListener('pointerdown', unlockAudio);
  window.removeEventListener('keydown', unlockAudio);
};
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

function startGame() {
  state = 'play';
  audio.unlock();
  audio.resume();
  hud.showScreen(null);
  hud.toast('WELCOME TO PORT AZURA', 3);
}

function setPaused(paused) {
  if (paused && state === 'play') {
    state = 'pause';
    hud.showScreen('pause');
    audio.suspend();
  } else if (!paused && state === 'pause') {
    if (combat.dead()) { hud.showScreen('wasted'); return; }
    state = 'play';
    hud.showScreen(null);
    audio.resume();
    last = performance.now();
    accumulator = 0;
  }
}

function target() {
  return mode === 'car' ? activeVehicle : player;
}

function enterExit() {
  if (mode === 'car') {
    if (activeVehicle.speed > 9) {
      hud.toast('SLOW DOWN TO EXIT', 1.4);
      return;
    }
    const rx = Math.cos(activeVehicle.heading);
    const rz = -Math.sin(activeVehicle.heading);
    player.reset({ x: activeVehicle.x + rx * 1.8, z: activeVehicle.z + rz * 1.8, heading: activeVehicle.heading });
    player.syncMesh();
    mode = 'foot';
    chase.setOnFoot(true);
    police.setOnFoot(true);
    hud.setDriving(false);
    hud.toast('ON FOOT — ' + PLAYER_NAME.toUpperCase(), 1.8);
    return;
  }
  if (Math.hypot(player.x - activeVehicle.x, player.z - activeVehicle.z) < 3.8) {
    mode = 'car';
    player.hide();
    chase.setOnFoot(false);
    police.setOnFoot(false);
    hud.setDriving(true, activeMesh.name);
    return;
  }
  const found = traffic.nearestDrivable(player.x, player.z, 4.4);
  if (!found) {
    hud.toast('NO VEHICLE IN REACH', 1.4);
    return;
  }
  found.entry.stolen = true;
  peds.panic(found.vehicle.x, found.vehicle.z, 10);
  activeVehicle = found.vehicle;
  activeMesh = found.mesh;
  mode = 'car';
  player.hide();
  chase.setOnFoot(false);
  police.setOnFoot(false);
  chase.initialized = false;
  hud.setDriving(true, activeMesh.name);
  hud.toast('CARJACKED — ' + activeMesh.name.toUpperCase(), 2);
  audio.play('ui');
}

document.getElementById('start-button').addEventListener('click', startGame);
document.getElementById('resume-button').addEventListener('click', () => setPaused(false));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) setPaused(true);
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function handleActions() {
  if (input.takePressed('confirm') && state === 'start') startGame();
  if (input.takePressed('pause')) {
    if (state === 'play') setPaused(true);
    else if (state === 'pause') setPaused(false);
  }
  if (state !== 'play') return;
  if (input.takePressed('enter')) enterExit();
  if (input.takePressed('reset')) {
    car.reset(world.spawn);
    activeVehicle = car;
    activeMesh = carMesh;
    player.reset({ x: world.spawn.x + 2, z: world.spawn.z, heading: 0 });
    if (mode === 'foot') player.syncMesh();
    chase.initialized = false;
    hud.setDriving(mode === 'car', activeMesh.name);
    hud.toast('CAR RESET', 1.6);
  }
}

function stepGame(dt) {
  const t = target();
  if (mode === 'car') {
    activeVehicle.step(dt, input, world.colliders);
    player.x = activeVehicle.x;
    player.z = activeVehicle.z;
    player.heading = activeVehicle.heading;
  } else {
    player.step(dt, input, world.colliders);
  }
  traffic.update(dt, t);
  peds.update(dt, elapsed, { x: t.x, z: t.z, speed: t.speed });
  police.update(dt, elapsed, t);
  combat.update(dt, input, t);
  missions.update(dt, t);
  save.autosaveTick(dt);

  heatGuard = Math.max(0, heatGuard - dt);
  if (mode === 'car' && activeVehicle.impact > 0.12) {
    peds.panic(activeVehicle.x, activeVehicle.z, 16);
    if (heatGuard <= 0) {
      for (const u of police.units) {
        if (Math.hypot(u.vehicle.x - activeVehicle.x, u.vehicle.z - activeVehicle.z) < 4.2) {
          police.raise(1, activeVehicle);
          heatGuard = 2.5;
          hud.toast('WANTED LEVEL INCREASED', 2);
          break;
        }
      }
    }
  }
  if (police.getLevel() > 0 && mode === 'car' && activeVehicle.speed > 15) peds.panic(activeVehicle.x, activeVehicle.z, 9);

  if (activeVehicle.impact > lastImpact + 0.04) {
    effects.sparks(activeVehicle.x, activeVehicle.groundY(), activeVehicle.z, 16, 5 + activeVehicle.impact * 9);
    chase.addShake(activeVehicle.impact * 0.55);
    audio.play('impact', { v: activeVehicle.impact });
  }
  lastImpact = activeVehicle.impact;
  const d = districtAt(t.x, t.z);
  if (d.id !== lastDistrict.id) {
    lastDistrict = d;
    hud.setDistrict(d.name);
    hud.toast(d.label.toUpperCase(), 2.2);
  }
}

function minimapExtras() {
  let nearestDist = Infinity;
  let bearing = 0;
  for (const u of police.units) {
    const dx = u.vehicle.x - target().x;
    const dz = u.vehicle.z - target().z;
    const dist = Math.hypot(dx, dz);
    if (dist < nearestDist) {
      nearestDist = dist;
      const h = target().heading;
      const rx = Math.cos(h);
      const rz = -Math.sin(h);
      bearing = (dx * rx + dz * rz) / Math.max(1, dist);
    }
  }
  const hp = police.heliPos();
  return {
    police: police.units.map((u) => ({ x: u.vehicle.x, z: u.vehicle.z })),
    heli: hp,
    search: police.searchZone(),
    hostiles: isShot ? [] : combat.hostiles(),
    markers: isShot ? [] : missions.markers(),
    audio: {
      police: { level: police.getLevel(), nearestDist, bearing },
      heli: { active: !!hp, dist: hp ? Math.hypot(hp.x - target().x, hp.z - target().z) : Infinity },
    },
  };
}

function renderFrame(dt) {
  elapsed += dt;
  const t = target();
  world.update(dt, elapsed, { x: t.x, y: t.groundY(), z: t.z });
  effects.update(dt);
  if (state === 'start') {
    const a = elapsed * 0.12;
    camera.position.set(car.x + Math.sin(a) * 15, car.groundY() + 5.5, car.z + Math.cos(a) * 15);
    camera.lookAt(car.x, car.groundY() + 1, car.z);
  } else {
    chase.update(dt, t, world.colliders);
  }
  hud.drawSpeedo(Math.abs(activeVehicle.forwardSpeed) * 3.6, activeVehicle.rpm, activeVehicle.gear);
  hud.setCombatVisible(mode === 'foot' && !isShot);
  const extras = minimapExtras();
  minimap.draw(t, missions.current(), elapsed, extras);
  speedOverlay.update(mode === 'car' ? activeVehicle.speed : 0, activeVehicle.impact);
  panelAcc += dt;
  if (panelAcc >= 0.25) {
    panelAcc = 0;
    hud.setWanted(police.getLevel());
    hud.setPoliceUnits(police.info(t));
  }
  audio.update(dt, {
    car: {
      speed: activeVehicle.speed, rpm: activeVehicle.rpm, throttle: input.throttle(),
      slip: activeVehicle.slip, braking: activeVehicle.braking, impact: activeVehicle.impact,
    },
    police: extras.audio.police,
    heli: extras.audio.heli,
    weather: { rain: 0 },
    mode,
  });
  hud.update(dt);
  renderer.render(scene, camera);
}

function frame(now) {
  requestAnimationFrame(frame);
  if (shotFrozen) {
    renderer.render(scene, camera);
    return;
  }
  const dt = Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  handleActions();
  if (state === 'play') {
    accumulator += dt;
    while (accumulator >= STEP) {
      stepGame(STEP);
      accumulator -= STEP;
    }
  } else {
    accumulator = 0;
  }
  if (state === 'play' && combat.dead()) state = 'pause';
  const look = input.look();
  if (combat.aiming() && (look.dx || look.dy)) chase.addLook(look.dx, invertY ? -look.dy : look.dy);
  renderFrame(state === 'pause' ? 0 : dt);
  input.endFrame();
}

const SHOT_TIME = 9.0;
const SHOT_POSES = {
  chase: {
    mode: 'car',
    spawn: { x: -330, z: -60, heading: 0 },
    cruise: 31,
    wanted: 4,
    units: [
      { dx: -5.5, dz: -16, status: 'PURSUIT' },
      { dx: 5.5, dz: -28, status: 'PURSUIT' },
      { dx: 7.5, dz: 2, status: 'RAMMING' },
      { dx: 0, dz: 120, status: 'ROADBLOCK' },
    ],
    heli: { dx: -16, dy: 24, dz: 95 },
  },
  onfoot: {
    mode: 'foot',
    spawn: { x: -80.7, z: -150, heading: 0 },
    carPark: { x: -84.2, z: -158, heading: 0 },
    cruise: 0,
    wanted: 0,
    units: [],
    heli: null,
  },
  pursuit: {
    mode: 'car',
    spawn: { x: 10, z: -120, heading: Math.PI / 2 },
    cruise: 30,
    wanted: 5,
    units: [
      { dx: -4.5, dz: -15, status: 'PURSUIT' },
      { dx: 4.5, dz: -26, status: 'PURSUIT' },
      { dx: 6, dz: -38, status: 'PURSUIT' },
      { dx: -4, dz: 36, status: 'INTERCEPT' },
      { dx: 0, dz: 100, status: 'ROADBLOCK' },
    ],
    heli: { dx: 12, dy: 26, dz: 92 },
  },
  harbor: {
    mode: 'car',
    spawn: { x: -446, z: 280, heading: -Math.PI / 2 },
    cruise: 8,
    wanted: 0,
    units: [],
    heli: null,
  },
};

function stagePose(pose, t) {
  const fx = Math.sin(t.heading);
  const fz = Math.cos(t.heading);
  const rx = Math.cos(t.heading);
  const rz = -Math.sin(t.heading);
  police.setLevel(pose.wanted, t);
  police.setLastKnown(t.x, t.z);
  pose.units.forEach((u, i) => {
    const x = t.x + rx * u.dx + fx * u.dz;
    const z = t.z + rz * u.dx + fz * u.dz;
    const roadblock = u.status === 'ROADBLOCK';
    police.placeUnit(i, x, z, roadblock ? t.heading + Math.PI / 2 : t.heading, roadblock ? 0 : pose.cruise, u.status);
  });
  if (pose.heli) {
    const hx = t.x + rx * pose.heli.dx + fx * pose.heli.dz;
    const hz = t.z + rz * pose.heli.dx + fz * pose.heli.dz;
    police.placeHeli(hx, pose.heli.dy, hz, Math.atan2(t.x - hx, t.z - hz));
  }
  police.flash(SHOT_TIME);
}

function setupShot(name) {
  const pose = SHOT_POSES[name] ?? SHOT_POSES.chase;
  document.body.classList.add('shot');
  state = 'play';
  mode = pose.mode;
  activeVehicle = car;
  activeMesh = carMesh;
  hud.showScreen(null);
  if (pose.mode === 'car') {
    car.reset(pose.spawn);
    const fx = Math.sin(pose.spawn.heading);
    const fz = Math.cos(pose.spawn.heading);
    car.vx = fx * pose.cruise;
    car.vz = fz * pose.cruise;
    car.forwardSpeed = pose.cruise;
    car.speed = pose.cruise;
    player.hide();
    const cruiseInput = {
      throttle: () => (car.forwardSpeed < pose.cruise ? 1 : 0),
      steer: () => 0,
      handbrake: () => false,
    };
    for (let i = 0; i < 100; i++) {
      car.step(STEP, cruiseInput, world.colliders);
      traffic.update(STEP, car);
      peds.update(STEP, SHOT_TIME, { x: car.x, z: car.z, speed: car.speed });
    }
  } else {
    car.reset(pose.carPark);
    car.syncMesh(0);
    player.reset(pose.spawn);
    const walkInput = { down: (a) => a === 'up', takePressed: () => false };
    for (let i = 0; i < 40; i++) {
      player.step(STEP, walkInput, world.colliders);
      traffic.update(STEP, player);
      peds.update(STEP, SHOT_TIME, { x: player.x, z: player.z, speed: player.speed });
    }
  }
  const t = target();
  stagePose(pose, t);
  elapsed = SHOT_TIME;
  effects.update(STEP);
  world.update(0, SHOT_TIME, { x: t.x, y: t.groundY(), z: t.z });
  chase.setOnFoot(mode === 'foot');
  chase.initialized = false;
  chase.update(STEP, t, world.colliders);
  hud.setDistrict(districtAt(t.x, t.z).name);
  hud.setDriving(mode === 'car', activeMesh.name);
  hud.setWanted(pose.wanted);
  hud.setPoliceUnits(police.info(t));
  const stop = missions.current();
  if (stop) {
    const d = Math.round(Math.hypot(t.x - stop.x, t.z - stop.z));
    hud.setMission(stop.title, `${stop.objective} — ${d} m`, 'IN PROGRESS');
  }
  hud.drawSpeedo(Math.abs(car.forwardSpeed) * 3.6, car.rpm, car.gear, true);
  minimap.draw(t, stop, SHOT_TIME, minimapExtras());
  speedOverlay.update(mode === 'car' ? car.speed : 0, 0);
  hud.clearToast();
  shotFrozen = true;
  renderer.render(scene, camera);
  window.__shotReady = true;
}

window.__game = {
  car,
  player,
  world,
  hud,
  police,
  traffic,
  peds,
  missions,
  combat,
  audio,
  save,
  getState: () => state,
  getMode: () => mode,
  getVehicle: () => activeVehicle,
  start: startGame,
  enterExit,
  setWanted(n) {
    police.setLevel(n, target());
    hud.setWanted(police.getLevel());
  },
  teleport(x, z, heading) {
    activeVehicle.x = x;
    activeVehicle.z = z;
    activeVehicle.heading = heading;
    activeVehicle.vx = 0;
    activeVehicle.vz = 0;
    chase.initialized = false;
    activeVehicle.syncMesh(0);
  },
};

if (shot) setupShot(shot);

requestAnimationFrame(frame);
