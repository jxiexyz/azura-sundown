import THREE from 'three';
import { STEP, MAX_FRAME, districtAt } from './config.js';
import { createInput } from './input.js';
import { createWorld } from './world.js';
import { createVehicleMesh, Vehicle } from './vehicle.js';
import { ChaseCamera } from './camera.js';
import { createEffects, createSpeedOverlay } from './effects.js';
import { createHud } from './hud.js';
import { createMinimap } from './minimap.js';
import { createObjective } from './objective.js';

window.addEventListener('error', (e) => {
  window.__bootError = String(e.message);
  document.title = 'BOOT ERROR: ' + e.message;
});

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
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
const carMesh = createVehicleMesh();
scene.add(carMesh.root);
const car = new Vehicle(carMesh, world.spawn);
car.syncMesh(0);

const chase = new ChaseCamera(camera);
const effects = createEffects(scene);
const speedOverlay = createSpeedOverlay(document.getElementById('vignette'));
const hud = createHud();
const minimap = createMinimap(world);
const objective = createObjective(hud);
const input = createInput();

let state = 'start';
let elapsed = 0;
let accumulator = 0;
let last = performance.now();
let lastImpact = 0;
let lastDistrict = districtAt(car.x, car.z);
let frames = 0;

hud.setDistrict(lastDistrict.name);
hud.setDriving(true, carMesh.name);
hud.showScreen('start');

function startGame() {
  state = 'drive';
  hud.showScreen(null);
  hud.toast('WELCOME TO PORT AZURA', 3);
}

function setPaused(paused) {
  if (paused && state === 'drive') {
    state = 'pause';
    hud.showScreen('pause');
  } else if (!paused && state === 'pause') {
    state = 'drive';
    hud.showScreen(null);
    last = performance.now();
    accumulator = 0;
  }
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
    if (state === 'drive') setPaused(true);
    else if (state === 'pause') setPaused(false);
  }
  if (input.takePressed('reset') && state !== 'start') {
    car.reset(world.spawn);
    chase.initialized = false;
    hud.toast('CAR RESET', 1.6);
  }
}

function stepGame(dt) {
  car.step(dt, input, world.colliders);
  objective.update(car);
  if (car.impact > lastImpact + 0.04) {
    effects.sparks(car.x, car.groundY(), car.z, 16, 5 + car.impact * 9);
    chase.addShake(car.impact * 0.55);
  }
  lastImpact = car.impact;
  const d = districtAt(car.x, car.z);
  if (d.id !== lastDistrict.id) {
    lastDistrict = d;
    hud.setDistrict(d.name);
    hud.toast(d.label.toUpperCase(), 2.2);
  }
}

function renderFrame(dt) {
  elapsed += dt;
  world.update(dt, elapsed, { x: car.x, y: car.groundY(), z: car.z });
  effects.update(dt);
  if (state === 'start') {
    const a = elapsed * 0.12;
    camera.position.set(car.x + Math.sin(a) * 15, car.groundY() + 5.5, car.z + Math.cos(a) * 15);
    camera.lookAt(car.x, car.groundY() + 1, car.z);
  } else {
    chase.update(dt, car, world.colliders);
  }
  hud.drawSpeedo(Math.abs(car.forwardSpeed) * 3.6, car.rpm, car.gear);
  minimap.draw(car, objective.current(), elapsed);
  speedOverlay.update(car.speed, car.impact);
  hud.update(dt);
  renderer.render(scene, camera);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  handleActions();
  if (state === 'drive') {
    accumulator += dt;
    while (accumulator >= STEP) {
      stepGame(STEP);
      accumulator -= STEP;
    }
  } else {
    accumulator = 0;
  }
  renderFrame(state === 'pause' ? 0 : dt);
  input.endFrame();
  frames += 1;
  if (shot && frames === 4) window.__shotReady = true;
}

const SHOT_SPOTS = {
  drive: { x: -330, z: -60, heading: 0 },
  harbor: { x: -452, z: 280, heading: -Math.PI / 2 },
  city: { x: 30, z: -300, heading: 0 },
  ridge: { x: 470, z: 40, heading: Math.PI },
};

if (shot) {
  const spot = SHOT_SPOTS[shot] ?? SHOT_SPOTS.drive;
  car.reset(spot);
  car.syncMesh(0);
  state = 'drive';
  hud.showScreen(null);
}

window.__game = {
  car,
  world,
  hud,
  getState: () => state,
  start: startGame,
  teleport(x, z, heading) {
    car.x = x;
    car.z = z;
    car.heading = heading;
    car.vx = 0;
    car.vz = 0;
    chase.initialized = false;
    car.syncMesh(0);
  },
};

requestAnimationFrame(frame);
