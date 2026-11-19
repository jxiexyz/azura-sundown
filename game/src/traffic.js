import { createVehicleMesh, Vehicle } from './vehicle.js';
import { CAR } from './config.js';
import { mulberry32, clamp, damp } from './utils.js';

const PAINTS = [0xc8ccd4, 0x8a2a2a, 0x2a4a7a, 0x3a3f46, 0xd0a030, 0x6a7a6a, 0xe0dcd0, 0x4a3a5a];
const ACTIVE_RANGE = 300;
const MOVER_COUNT = 12;

function lanePose(road, dir, s) {
  const lane = road.w / 4;
  if (road.axis === 'z') {
    return { x: road.at + dir * lane, z: s, heading: dir > 0 ? 0 : Math.PI };
  }
  return { x: s, z: road.at - dir * lane, heading: dir > 0 ? Math.PI / 2 : -Math.PI / 2 };
}

function intersectionStops(road, roads) {
  const stops = [];
  for (const other of roads) {
    if (other.axis === road.axis) continue;
    if (other.at < road.from || other.at > road.to) continue;
    if (road.at < other.from || road.at > other.to) continue;
    stops.push(other.at);
  }
  return stops;
}

export function createTraffic(scene, world, seed = 1) {
  const rand = mulberry32(seed * 15485863 + 31);
  const movers = [];
  const parked = [];

  for (let i = 0; i < MOVER_COUNT; i++) {
    const road = world.roads[Math.floor(rand() * world.roads.length)];
    const dir = rand() < 0.5 ? 1 : -1;
    const s = road.from + 15 + rand() * (road.to - road.from - 30);
    const pose = lanePose(road, dir, s);
    const mesh = createVehicleMesh({
      paint: PAINTS[Math.floor(rand() * PAINTS.length)],
      body: rand() < 0.3 ? 'suv' : 'sedan',
      spotlights: false,
      name: 'Civilian',
    });
    scene.add(mesh.root);
    const vehicle = new Vehicle(mesh, pose);
    vehicle.syncMesh(0);
    movers.push({
      vehicle, mesh, road, dir, s,
      cruise: 11 + rand() * 7,
      speed: 0,
      stops: intersectionStops(road, world.roads),
    });
  }

  const parkSpots = [
    { road: world.roads[7], side: 1, s: -165 },
    { road: world.roads[7], side: 1, s: -138 },
    { road: world.roads[2], side: -1, s: -52 },
    { road: world.roads[0], side: 1, s: -210 },
    { road: world.roads[0], side: -1, s: 130 },
    { road: world.roads[3], side: 1, s: 210 },
    { road: world.roads[8], side: -1, s: 240 },
    { road: world.roads[5], side: 1, s: 60 },
  ];
  for (const spot of parkSpots) {
    const off = spot.side * (spot.road.w / 2 - 1.25);
    const pose = spot.road.axis === 'z'
      ? { x: spot.road.at + off, z: spot.s, heading: spot.side > 0 ? 0 : Math.PI }
      : { x: spot.s, z: spot.road.at + off, heading: spot.side > 0 ? Math.PI / 2 : -Math.PI / 2 };
    const mesh = createVehicleMesh({
      paint: PAINTS[Math.floor(rand() * PAINTS.length)],
      body: rand() < 0.35 ? 'suv' : 'sedan',
      spotlights: false,
      name: 'Parked',
    });
    scene.add(mesh.root);
    const vehicle = new Vehicle(mesh, pose);
    vehicle.syncMesh(0);
    parked.push({ vehicle, mesh, road: spot.road, s: spot.s });
  }

  function update(dt, focus) {
    for (const m of movers) {
      if (Math.hypot(m.vehicle.x - focus.x, m.vehicle.z - focus.z) > ACTIVE_RANGE) continue;
      let target = m.cruise;
      if (Math.hypot(m.vehicle.x - focus.x, m.vehicle.z - focus.z) < 10) target = Math.min(target, 2);
      for (const other of movers) {
        if (other === m || other.road !== m.road || other.dir !== m.dir) continue;
        const gap = (other.s - m.s) * m.dir;
        if (gap > 0 && gap < 20) target = Math.min(target, other.speed * clamp(gap / 20, 0, 1));
        if (gap > 0 && gap < 7) target = 0;
      }
      for (const stop of m.stops) {
        const d = Math.abs(m.s - stop);
        if (d < 13) target = Math.min(target, 5.5 + d * 0.4);
      }
      m.speed = damp(m.speed, target, 2.6, dt);
      m.s += m.dir * m.speed * dt;
      if (m.s > m.road.to - 4) m.s = m.road.from + 4;
      else if (m.s < m.road.from + 4) m.s = m.road.to - 4;
      const pose = lanePose(m.road, m.dir, m.s);
      const v = m.vehicle;
      v.x = pose.x;
      v.z = pose.z;
      v.heading = pose.heading;
      v.forwardSpeed = m.speed;
      v.speed = m.speed;
      v.braking = target < m.speed - 2.5;
      v.wheelSpin += (m.speed / CAR.wheelRadius) * dt;
      v.syncMesh(dt);
    }
  }

  function list() {
    return [...movers, ...parked];
  }

  return { movers, parked, update, list };
}
