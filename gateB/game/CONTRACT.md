# AZURA SUNDOWN — implementation contract (pass 2)

This file is the interface contract for the coder pass. Every module below must be
implemented at the exact path, with the exact export names and signatures, reusing the
existing APIs listed in §1. Do not invent parallel APIs. Do not rename existing exports.
The game is static, offline, and deterministic for `?shot=…&seed=N` (see §4).

Hard limits: `game/index.html` ≤ 1 MiB, `game/` ≤ 48 MiB and ≤ 993 files+dirs, no network
references anywhere, no assets outside `game/` or `data:` URIs, never edit
`vendor/makefun-game.ts` or `game/vendor/three.min.js`. All randomness in simulation must
come from `mulberry32(seed)` — never `Math.random()` or `Date.now()` in game state.

---

## 1. Existing APIs you must reuse (already implemented, do not rewrite)

### `src/config.js`
```
GAME_TITLE='AZURA SUNDOWN', CITY_NAME='Port Azura',
POLICE_NAME='Azura Bay Police Department', POLICE_SHORT='ABPD',
PLAYER_CAR_NAME='Vantara S9', PLAYER_NAME='Riko Vance', START_CASH=2500
DISTRICTS: [{id,name,label}]           // harborline, crescent, meridian, palms, ridge
districtAt(x, z) -> {id,name,label}
WORLD = { half:620, coastX:-360, pierMinX:-545, pierMinZ:158, pierMaxZ:442,
          hillStartX:380, hillFullX:560, hillHeight:42 }
CAR   = { accel, brake, reverseAccel, maxSpeed:54, maxReverse, drag, rolling, grip,
          gripHandbrake, gripSlide, steerMax, steerSpeedFalloff, steerLerp,
          wheelbase:2.9, maxYawRate, radius:1.45, wheelRadius:0.34, restitution }
CAMERA = { distance, distanceSpeedGain, height, heightSpeedGain, lookAhead, lag,
           fovBase:62, fovSpeedGain, shakeSpeedStart }
STEP = 1/60, MAX_FRAME = 0.25, SAVE_KEY = 'azura-sundown-save-v1'
```
Add new tuning constants here (e.g. `TRAFFIC`, `PEDS`, `COMBAT`, `AUDIO`), not inline.

### `src/utils.js`
```
mulberry32(seed) -> () => float in [0,1)
clamp(v,lo,hi), lerp(a,b,t), damp(a,b,rate,dt), smoothstep(e0,e1,x)
mergeParts([{geometry, matrix, color}]) -> BufferGeometry (vertex-colored, merged)
mat4(x,y,z, ry=0, sx=1,sy=1,sz=1) -> THREE.Matrix4
canvasTexture(w,h, draw(ctx,w,h)) -> THREE.CanvasTexture   // procedural textures only
```

### `src/world.js`
```
heightAt(x, z) -> number                 // terrain height; pier deck = 0.6
createWorld(scene, seed) -> {
  roads: ROAD_DEFS,                      // see shape below
  colliders: [{minX,maxX,minZ,maxZ}],    // static AABBs: buildings, containers, warehouses
  spawn: {x:-330, z:-60, heading:0},
  update(dt, t, focus{x,y,z}),           // sky/ocean time, ship bob, beacons, sun tracking
  sun: THREE.DirectionalLight, skyMat, oceanMat
}
```
`ROAD_DEFS` entry: `{ axis:'x'|'z', at:number, from:number, to:number, w:number, name:string }`.
`axis:'z'` means the road runs along z at x=`at`. Roads: Crescent Highway (z, -330, w24),
North Loop (x,-320), Meridian Avenue (x,-120), Palms Boulevard (x,80), Harborline Way (x,280),
Southgate Road (x,460), Dock Street (z,-210), 3rd Street (z,-90), 5th Street (z,30),
7th Street (z,150), Ridge Approach (z,270), Vista Ridge Road (z,470). Sidewalks exist on
both sides of every road at offset ±(w/2+2.3), width 4.6, lifted 0.09.
Do not add roads without also extending `crosses()`-style intersection logic and the minimap.

### `src/vehicle.js`
```
createVehicleMesh(opts={}) -> {
  root, body, wheels[4], steerGroups[4|null],
  headMat, tailMat, reverseMat, tailGlowMat, headlights: SpotLight[],
  sirenRedMat, sirenBlueMat, sirenGlowRedMat, sirenGlowBlueMat,   // null unless opts.police
  name
}
// opts: { paint:hex, police:bool, body:'sedan'|'suv'|undefined, spotlights:bool, name:string }
class Vehicle {
  constructor(mesh, spawn{x,z,heading})
  fields: x, z, heading, vx, vz, steer, speed, forwardSpeed, slip, braking, reversing,
          impact (0..1, decays), gear ('R'|'N'|'1'..'6'), rpm (0..1), wheelSpin, pitch, roll
  reset(spawn), step(dt, input, colliders), syncMesh(dt), groundY()
  resolveCollisions(colliders), resolveBounds()
}
```
`Vehicle.step` consumes only `input.throttle()`, `input.steer()`, `input.handbrake()` —
AI drivers pass a synthetic object with those three methods (see `police.js driveUnit`).

### `src/player.js`
```
createPlayerMesh() -> { root, legL, legR, armL, armR, torso, head, name }
class Player {
  constructor(mesh, spawn{x,z,heading})
  fields: x, z, heading, speed, jumpY, vy, phase, moving, sprinting
  reset(spawn), groundY(), step(dt, input, colliders), syncMesh(), hide(),
  resolveCollisions(colliders)
}
```
`Player` and `Vehicle` both satisfy the **target shape** consumed by camera/HUD/minimap:
`{ x, z, heading, speed, groundY() }`. `main.js` picks `target()` = car in mode 'car',
player in mode 'foot'. Combat/missions must accept the same shape.

### `src/camera.js`
```
class ChaseCamera {
  constructor(camera)
  setOnFoot(bool), addShake(amount), update(dt, target, colliders)
  fields: initialized (set false to snap), pos, look, shake
}
```

### `src/input.js`
```
createInput() -> {
  down(action), takePressed(action), endFrame(),
  throttle() -> -1|0|1, steer() -> -1|0|1, handbrake() -> bool
}
```
KEYMAP actions: up, down, left, right, handbrake (Space), sprint (Shift), reset (R),
enter (F), pause (Escape), confirm (Enter), horn (H). Add new actions here
(e.g. `KeyQ:'aim'`, `Mouse0:'fire'`, `KeyE:'interact'`, `KeyTab:'map'`) — mouse support
must be added in `createInput` (mousedown/mouseup/mousemove on window), keeping the same
`down/takePressed` interface. Prevent default only for game keys.

### `src/hud.js`
```
createHud() -> {
  setCash(v), getCash(), setWanted(level0..5), setDistrict(name),
  setMission(title, objective, status), toast(msg, seconds=3), clearToast(),
  setPoliceUnits([{id, dist, status}]),       // renders #police-units rows, hides panel when []
  setDriving(bool, carName),                  // shows/hides circular speedo
  showScreen('start'|'pause'|null),
  drawSpeedo(kmh, rpm, gear, snap=false),
  update(dt)
}
```
DOM ids already in `index.html`: hud, cash, wanted (.star ×5), district, mission-title,
mission-objective, mission-status, police-panel, police-header, police-units, minimap,
speedo, speedo-canvas, car-name, toast, start-screen, pause-screen, start-button,
resume-button, game-title, vignette. New screens (mission complete/fail, settings) must
add ids in the same naming style and be wired through `showScreen` (extend its union).

### `src/minimap.js`
```
createMinimap(world) -> { draw(target, waypoint, t, extras={}) }
// waypoint: {x,z} | null (diamond marker, pulses with t)
// extras: { police:[{x,z}], heli:{x,y,z}|null, search:{x,z,r}|null }
```
Rotating player-centered map, 200×200 canvas, SCALE 0.36. Keep it representing the real
world (roads from `world.roads`, buildings from `world.colliders`).

### `src/effects.js`
```
createEffects(scene) -> { sparks(x,y,z,count,force), update(dt) }
createSpeedOverlay(element) -> { update(speed, impact) }
```
Extend this file (do not create a second particle system) with: rain streaks, tire smoke,
muzzle flash, bullet impact chips. Pool everything; no per-frame allocations.

### `src/main.js` (wiring — read it before editing)
State machine: `state ∈ {'start','play','pause'}`, `mode ∈ {'car','foot'}`.
Fixed-step loop: `handleActions()` → while accumulator ≥ STEP: `stepGame(STEP)` →
`renderFrame(dt)` → `input.endFrame()`. `window.__game` exposes debug handles.
`?shot=<pose>&seed=N` runs `setupShot()` which warms up 100 fixed steps, stages actors,
freezes (`shotFrozen`), and re-renders the identical frame — see §4.

---

## 2. Init order (main.js, top to bottom — keep this order)

1. renderer, scene, camera
2. `createWorld(scene, seed)`
3. PMREM environment from `world.skyMat`
4. `createVehicleMesh()` + `new Vehicle(carMesh, world.spawn)`
5. `createPlayerMesh()` + `new Player(playerMesh, …)` (hidden while driving)
6. `new ChaseCamera(camera)`
7. `createEffects(scene)`, `createSpeedOverlay`
8. `createHud()`, `createMinimap(world)`
9. `createMissions(deps)` — replaces `createObjective(hud)`; delete `src/objective.js`
10. `createInput()`
11. `createTraffic(scene, world, seed)`
12. `createPedestrians(scene, world, seed)`
13. `createPolice(scene, world, seed)`
14. `createCombat(deps)`
15. `createAudio()` (lazy AudioContext — create on first user gesture)
16. `createSave(deps)` (reads localStorage, decides start-menu Continue state)
17. shot setup (`setupShot`) or start menu

## 3. Update order

Per fixed step (`stepGame(dt)`), after player/car physics:
```
traffic.update(dt, target)
peds.update(dt, elapsed, focus{x,z,speed})
police.update(dt, elapsed, target)
combat.update(dt, input, target)
missions.update(dt, target)
```
Per render frame (`renderFrame(dt)`):
```
world.update(dt, elapsed, focus{x,y,z})
effects.update(dt)
chase.update(dt, target, world.colliders)   // or start-screen orbit
hud.drawSpeedo(...); minimap.draw(target, missions.current(), elapsed, extras)
speedOverlay.update(...); hud.setWanted/setPoliceUnits (throttled 4 Hz); hud.update(dt)
audio.update(dt, snapshot)
renderer.render(scene, camera)
```
`elapsed` advances only in `renderFrame`; simulation reads it, never writes it.

---

## 4. Determinism rules for screenshots (non-negotiable)

- `shots.json` poses: `chase`, `onfoot`, `pursuit`, `harbor` (see `SHOT_POSES` in main.js).
  Each pose warms up with fixed STEP increments, stages actors relative to the player
  frame (`dx` = right offset, `dz` = forward offset), then freezes. Same seed → same bytes.
- Any new module used during warmup (`traffic.update`, `peds.update`, and anything you
  add to the warmup loop) must be a pure function of its inputs and its seeded RNG.
- No `Math.random`, no `Date.now`, no `performance.now` inside simulation.
- No CSS animations/transitions may affect shot pixels: `body.shot` disables them all
  (style.css). Any new animated HUD element must respect that rule.
- HUD canvases drawn for shots use `snap=true` / fixed `t`; never smooth values across
  frames in shot mode.
- Verify with `bash tools/shoot_ibx.sh` twice and `sha256sum -c` — never run a browser
  on the build VPS (AGENTS.md).

---

## 5. Modules to implement

### 5.1 `game/src/traffic.js` — civilian traffic (exists thin; extend to full)
Job: lane-graph traffic over `world.roads`, spawn/despawn around the player, car-following,
intersection stops, stealable vehicles.
```
export function createTraffic(scene, world, seed) -> {
  movers: [{ vehicle:Vehicle, mesh, road, dir, s, cruise, speed, stops }],
  parked: [{ vehicle:Vehicle, mesh, road, s }],
  update(dt, focus{x,z,speed}),
  list() -> [{vehicle, mesh, parked:bool}],        // for vehicle stealing
  nearestDrivable(x, z, maxDist) -> {vehicle,mesh} | null,
  serialize() -> [{roadIndex,dir,s,speed}], load(data)
}
```
Requirements:
- Lane pose: right-hand traffic. `axis:'z'`, dir +1 → x = at + w/4, heading 0; dir −1 →
  x = at − w/4, heading π. `axis:'x'`, dir +1 → z = at − w/4, heading π/2; dir −1 →
  z = at + w/4, heading −π/2 (see existing `lanePose`).
- Build a lane graph: nodes at intersections (`intersectionStops` already computes the
  crossing s-values); at each intersection a mover may continue, turn onto the crossing
  road (pick with seeded rand), or U-turn at road ends. Turns must respect lane offsets.
- Stop at intersections when cross-traffic is within 18 m; yield to the player within
  10 m (already implemented); follow the car ahead (gap < 20 → slow, < 7 → stop).
- Population budget: ≤ 18 movers + ≤ 12 parked active at once; despawn beyond 420 m of
  focus, respawn on a random road segment 180–320 m ahead/behind. All meshes pooled —
  reuse `Vehicle` instances, never allocate geometry per spawn.
- `main.js enterExit()` must accept any `nearestDrivable` result: swap the controlled
  `Vehicle` (keep the blue Vantara as a persistent world object), update
  `hud.setDriving(true, mesh.name)`. The player's original car stays where it was left.
- Brake lights via `vehicle.braking`, wheel spin via `vehicle.wheelSpin` (existing).

### 5.2 `game/src/pedestrians.js` — sidewalk walkers (exists thin; extend)
Job: pedestrians on sidewalks, panic, avoidance, reactions to gunfire/sirens.
```
export function createPedestrians(scene, world, seed) -> {
  peds: [{ group, legL, legR, road, side, dir, s, speed, phase, mode, panicT, fleeX, fleeZ, x, z }],
  update(dt, t, focus{x,z,speed}),
  panic(x, z, radius),
  hitTest(x, z, radius) -> ped | null,        // for combat hitscan vs civilians (non-graphic: they flee)
  serialize(), load(data)
}
```
Requirements:
- Sidewalk center offset ±(w/2+2.3) from road centerline; y = `heightAt(x,z)+0.09`.
- Keep the merged vertex-colored upper body + 2 leg meshes per ped (3 draw calls);
  budget ≤ 64 peds. Only simulate within 210 m of focus (already).
- Add: separation steering between peds (< 0.9 m), avoid the player vehicle (< 2.5 m at
  speed > 8 → panic), cross at intersections when the crossing road has no car within
  25 m, varied speeds/heights (scale 0.9–1.1), idle pauses.
- `panic(x,z,r)` sets flee direction away from the threat for 3–5 s at 5.4 m/s
  (already implemented — keep the signature).
- Gunfire (`combat`) calls `panic(shotX, shotZ, 30)`. Sirens near peds → panic (main.js
  already does this for the player car; extend to police units).

### 5.3 `game/src/police.js` — wanted system (exists functional; deepen)
Job: 5 wanted levels, dispatch, pursuit/intercept/roadblock/ramming/searching, helicopter
at levels 4–5, cooldown and escape.
```
export const LEVEL_UNITS = [0,1,2,3,4,5]
export const HELI_LEVEL = 4
export const SPOTTED_RANGE = 150
export const ESCAPE_SECONDS = 9
export function createHelicopterMesh() -> { root, rotor, tailRotor, beaconMat, coneMat }
export function createPolice(scene, world, seed) -> {
  units: [{ id:'ABPD-11'…, vehicle:Vehicle, mesh, status, roadblock, phase }],
  setLevel(n, focus{x,z,heading}), raise(amount, focus),
  update(dt, t, target),            // target = {x,z,heading,speed}
  flash(t),                         // siren emissive + ground glow phase (shot-safe)
  info(target) -> [{ id, dist, status }],
  placeUnit(index, x, z, heading, speed, status), placeHeli(x, y, z, heading),
  heliPos() -> {x,y,z}|null, searchZone() -> {x,z,r}|null, setLastKnown(x,z),
  getLevel(), isSpotted(),
  busted() -> bool,                 // NEW: on-foot player surrounded (unit < 2.5 m, speed < 1)
  damageUnit(unit, amount),         // NEW: combat → unit disabled state
  serialize(), load(data)
}
```
Status vocabulary (HUD + minimap rely on it): `PURSUIT`, `INTERCEPT`, `ROADBLOCK`,
`SEARCHING`, `RAMMING`.
Requirements:
- Level semantics: 1 local patrol; 2 two cruisers; 3 aggressive pursuit + ramming;
  4 roadblocks + helicopter; 5 helicopter search + coordinated intercepts.
- Pursuit steering already uses synthetic input into `Vehicle.step` — keep that pattern
  (real physics, real collisions with `world.colliders`).
- Add: car-vs-car collision impulses between police and the player (circle-circle,
  restitution 0.3, exchange momentum; register `impact` on both), ramming damage to the
  player vehicle (feeds `combat.damagePlayer` only when on foot; vehicle damage is
  visual + speed loss), roadblocks placed on the player's current road 120–160 m ahead
  (use `world.roads` to find it), search behavior: when `!isSpotted()`, units converge on
  `lastKnown` then sweep expanding rings; `searchZone()` drives the minimap dashed circle.
- Escape: no unit within `SPOTTED_RANGE` and heli farther than 170 m for
  `ESCAPE_SECONDS` → level −1 (already). At level 0 all units despawn (pool the meshes).
- Helicopter: orbit radius 44 m, altitude 46 m (already); add a spotlight that tracks the
  player when spotted (`coneMat.opacity` up), and `heliPos()` must stay minimap-compatible.
- `busted()`: on foot, any unit within 2.5 m for 1.5 s continuous → missions fail hook.
- Dispatch panel content comes only from `info(target)`; do not touch the DOM here.

### 5.4 `game/src/missions.js` — story missions (NEW; replaces `src/objective.js`)
Job: 4 playable missions with triggers, objectives, completion, failure, reward.
Delete `src/objective.js` and its import; `main.js` calls `createMissions` in its place.
```
export const MISSIONS = [
  { id:'shipment', title:'THE SHIPMENT', giver:'Mara Voss', reward:1200, … },
  { id:'chase',    title:'THE CHASE',    giver:'Mara Voss', reward:1800, … },
  { id:'harbor',   title:'HARBOR RUN',   giver:'Dockmaster Ile', reward:2400, … },
  { id:'signal',   title:'DEAD SIGNAL',  giver:'Unknown',   reward:3200, … },
]
export function createMissions(deps{ hud, police, traffic, peds, world, car, player, combat, audio }) -> {
  update(dt, target),               // target shape; advances steps, checks fail/complete
  current() -> { x, z, radius, title, objective } | null,   // minimap waypoint shape
  active() -> { id, title, stepIndex, steps, timer, state:'active'|'complete'|'failed' } | null,
  start(id),                        // trigger: marker radius or hud prompt
  abort(), retry(),
  markers() -> [{x,z,id,title}],    // mission-start markers in the world (HUD/minimap)
  serialize() -> { completed:[ids], activeId, stepIndex, cash }, load(data)
}
```
Mission flow (each step updates `hud.setMission(title, objectiveText, status)`;
completion pays `hud.setCash(getCash()+reward)`, `hud.toast`, `audio.play('mission')`,
and shows the mission-complete screen via `hud.showScreen('mission-complete')`):
1. **The Shipment** — trigger marker at Crescent Strip overlook (−330, −180). Steps:
   reach the Harborline gate (−470, 280, r14) → enter any vehicle → collect the cargo
   package at container row (−500, 330, r6, `interact` prompt) → return to the overlook.
   Fail: none (tutorial). Reward $1200.
2. **The Chase** — auto-starts after Shipment. `police.setLevel(2, target)`; objective:
   escape the pursuit (police level reaches 0). Fail: busted (on foot) or vehicle
   destroyed. Reward $1800.
3. **Harbor Run** — trigger at Dock Street warehouse (−210, 380). Steps: drive through
   the harbor checkpoint (−452, 280) → dodge the roadblock (`police.setLevel(3)`,
   roadblock on Harborline Way) → reach the safehouse (−270, −380, r10). Fail: busted,
   or timer 150 s. Reward $2400.
4. **Dead Signal** — trigger at Vista Ridge (470, 40). `police.setLevel(5)` (heli
   searches). Steps: leave the search zone (stay > `SPOTTED_RANGE` from all units for
   10 s) → reach the safehouse garage (−270, −380) before the heli re-acquires
   (`isSpotted()` for 6 s continuous → fail). Reward $3200.
Free roam after mission 4: `current()` returns null, HUD shows FREE ROAM. Mission
markers are glowing ground rings (add geometry in missions.js, pooled, ≤ 4).
Cinematic transitions: letterbox bars + 1.2 s camera ease (use `chase.addShake(0)` and a
`hud.showScreen` overlay), never block input for more than 1.5 s.

### 5.5 `game/src/combat.js` — arcade combat (NEW)
Job: aim, shoot, hitscan, damage, health, ammo/reload, hostile NPCs. Stylized, non-graphic.
```
export const WEAPONS = { pistol: { name:'Kestrel 9', dmg:25, mag:12, reserve:60, rate:0.18, reload:1.1, range:90, spread:0.015 } }
export function createCombat(deps{ scene, hud, player, car, police, peds, traffic, effects, audio }) -> {
  update(dt, input, target),
  aiming() -> bool, health() -> number, ammo() -> {mag, reserve},
  damagePlayer(amount), damageVehicle(vehicle, amount),
  hostiles() -> [{x,z,heading,health}],      // for minimap extras (extend minimap extras.hostiles)
  spawnHostiles(x, z, count),                // mission 4 gang guards, seeded
  serialize(), load(data)
}
```
Requirements:
- On foot only: hold RMB (new input action `aim`) → over-shoulder camera (extend
  `ChaseCamera` with `setAiming(bool)`, distance 2.6, height 1.9, offset right 0.5);
  LMB (`fire`) → hitscan `THREE.Raycaster` from camera center, spread cone, range 90 m.
- Hit targets: police units (`police.damageUnit`), hostiles, traffic vehicles
  (`damageVehicle` → smoke via effects, speed loss), pedestrians → `peds.panic` only
  (no gore, no civilian kills). Register hitboxes as AABBs; do not raycast the whole scene.
- Muzzle flash: `effects` point light flash ≤ 0.06 s + spark burst; tracer line ≤ 0.05 s.
- Ammo: mag/reserve, RMB+R or auto reload at 0 (`reload` timer), HUD ammo readout
  (new ids `#ammo`, `#health-bar` bottom-right above speedo; hide speedo while aiming).
- Health 100; damage feedback: red vignette pulse (reuse `#vignette` with a second
  overlay `#damage-flash`), regen 5/s after 6 s without damage. Health 0 →
  `hud.showScreen('wasted')`, respawn at safehouse, lose $200, wanted cleared.
- Hostiles: simple seek-and-shoot NPCs (reuse ped mesh builder with dark palette),
  strafing at 8–14 m, fire every 1.4 s with 0.35 hit chance scaled by distance;
  damage 8/hit. They panic-flee when health < 25.
- Firing raises wanted: `police.raise(1, target)` on first shot in a 20 s window.

### 5.6 `game/src/audio.js` — procedural Web Audio (NEW)
Job: everything audible, synthesized at runtime. No audio files, no network.
```
export function createAudio() -> {
  unlock(),                          // call on first pointerdown/keydown (start button)
  update(dt, snap{ car:{speed,rpm,throttle,slip,braking,impact}, police:{level,nearestDist},
                   heli:{active,dist}, weather:{rain}, mode:'car'|'foot' }),
  play(name, opts={}),               // one-shots: 'collision','screech','shot','reload','hit',
                                     // 'ui','toast','mission','fail','siren-burst','heli-pass'
  setMuted(bool), isMuted(), suspend(), resume(),
  serialize() -> {muted}, load(data)
}
```
Requirements:
- Single `AudioContext`, master gain → compressor → destination. Create lazily in
  `unlock()`; every node built from oscillators/noise buffers (seeded noise via
  `mulberry32`, generated once into an `AudioBuffer`).
- Engine: 2 saw oscillators (rpm × 80 Hz and × 1.5) + lowpass (rpm-tracked) + gain by
  throttle; idle loop always in car mode. Tire screech: bandpassed noise, gain by
  `slip` > 3. Siren: two-tone square (660/880 Hz, 0.55 s cycle), gain by nearest unit
  distance (≤ 150 m), pan by relative bearing (`StereoPannerNode`). Helicopter: noise +
  14 Hz LFO gain, lowpass 400, gain by dist ≤ 220 m. Ambience: pink-ish noise lowpass
  300 (coastal wind) + occasional distant horn one-shots (seeded schedule). Rain:
  highpassed noise, gain by `weather.rain`. UI: short sine blips.
- Cap simultaneous voices at 24; stop/disconnect one-shots on `ended`.
- `update` must be allocation-free per frame (reuse nodes, ramp params with
  `setTargetAtTime`).
- Pause: `suspend()` on pause/visibilitychange, `resume()` on play (wire in main.js).

### 5.7 `game/src/save.js` — persistence + menus (NEW)
Job: localStorage save/load, start menu, pause menu, mission complete/failure screens.
```
export function createSave(deps{ hud, missions, police, combat, car, player, audio, traffic }) -> {
  hasSave() -> bool,
  save() -> bool,                    // writes SAVE_KEY; hud.toast('GAME SAVED')
  load() -> bool,                    // restores cash, missions, wanted, position, mode, settings
  clear(),
  autosaveTick(dt),                  // every 30 s of play + on mission complete
  settings() -> { muted, invertY, quality:'low'|'high' },
  setSetting(key, value),
  showResult('complete'|'failed'|'wasted', { title, reward })
}
```
Requirements:
- Save shape (versioned): `{ v:1, cash, mode, player:{x,z,heading}, car:{x,z,heading},
  wanted, missions:missions.serialize(), combat:combat.serialize(),
  settings:{muted,invertY,quality} }`. JSON only, ≤ 8 KiB. Guard every
  localStorage access with try/catch (private mode must not crash the game).
- Start menu: extend `#start-screen` with a Continue button (`#continue-button`, hidden
  unless `hasSave()`), New Game (`#start-button` existing), Settings (`#settings-button`)
  and Controls (existing grid). Continue → `load()` then `startGame()`.
- Pause menu: add Save (`#save-button`), Settings, Quit to menu (`#quit-button`).
- Mission complete screen: new `#result-screen` overlay — title, reward, stats
  (time, top speed, units escaped), Continue button. Failure: `#fail-screen` with
  Retry (`missions.retry()`) and Free roam. Wasted: respawn flow from combat.
- Settings panel: `#settings-screen` — mute toggle, quality (pixelRatio cap 1 vs 1.75
  and shadow map 1024 vs 2048 via `renderer`/`world.sun.shadow.mapSize`), invert Y.
  Persist through `setSetting`.
- All screens route through `hud.showScreen(name)`; extend its union and the
  `hidden`-class toggling consistently. No screen may trap the pointer lock or block
  Escape.

---

## 6. Cross-module data shapes (summary)

```
target   = { x, z, heading, speed, groundY() }            // car or player
focus    = { x, z, speed }                                 // traffic/peds LOD center
waypoint = { x, z, radius, title, objective } | null       // missions.current → minimap
unitInfo = { id:'ABPD-NN', dist:number, status:'PURSUIT'|'INTERCEPT'|'ROADBLOCK'|'SEARCHING'|'RAMMING' }
extras   = { police:[{x,z}], heli:{x,y,z}|null, search:{x,z,r}|null, hostiles:[{x,z}] }
collider = { minX, maxX, minZ, maxZ }                      // static AABB, world.colliders
snapshot = see audio.update                                // read-only view of sim state
```

## 7. Acceptance checklist for the coder pass

- [ ] `bash tools/shoot_ibx.sh` renders all four poses, OK lines, byte-identical on re-run.
- [ ] Playable loop: start → drive → exit (F) → walk/sprint/jump → steal a traffic car →
      ram a cruiser → wanted escalates 1→5 → roadblock + heli → escape → cooldown →
      mission 1–4 complete/fail paths → combat aim/fire/reload → save → reload page →
      Continue restores state.
- [ ] No console errors; `document.title` never becomes `BOOT ERROR:…`.
- [ ] `MAKEFUN_OUTPUT_DIR=out node main.ts` runs twice, byte-identical output.
- [ ] Caps: index.html ≤ 1 MiB, game/ ≤ 48 MiB / ≤ 993 entries, screenshots ≤ 256 KiB.
- [ ] All content original (names in config.js are the canon: Port Azura, ABPD,
      Vantara S9, Riko Vance, Mara Voss). No GTA/Rockstar names, logos, maps, art, audio.
