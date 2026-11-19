import THREE from 'three';
import { MISSION_TUNING, SAFEHOUSE } from './config.js';
import { SPOTTED_RANGE } from './police.js';

export const MISSIONS = [
  {
    id: 'shipment',
    title: 'THE SHIPMENT',
    giver: 'Mara Voss',
    reward: 1200,
    dialogue: 'Mara Voss: The harbor is holding cargo that isn\'t cargo. Pick it up, then come find me.',
    trigger: { x: -330, z: -180, r: 16 },
    steps: [
      { type: 'reach', x: -470, z: 280, r: 14, objective: 'Drive to the Harborline gate' },
      { type: 'vehicle', objective: 'Behind the wheel of any vehicle' },
      { type: 'interact', x: -500, z: 330, r: 7, objective: 'Collect the cargo package [E]' },
      { type: 'reach', x: -330, z: -180, r: 16, objective: 'Deliver the package to the Crescent overlook' },
    ],
  },
  {
    id: 'chase',
    title: 'THE CHASE',
    giver: 'Mara Voss',
    reward: 1800,
    dialogue: 'Mara Voss: That package was bait. ABPD is already moving — lose them.',
    autoStart: true,
    after: 'shipment',
    steps: [
      { type: 'escape', objective: 'Escape the ABPD search zone', onEnter: (a, deps, target) => deps.police?.setLevel(2, target) },
    ],
  },
  {
    id: 'harbor',
    title: 'HARBOR RUN',
    giver: 'Dockmaster Ile',
    reward: 2400,
    dialogue: 'Dockmaster Ile: Yard is hot tonight. Thread the checkpoint, dodge the blocks, reach the safehouse.',
    trigger: { x: -210, z: 380, r: 16 },
    timeLimit: MISSION_TUNING.harborTimeLimit,
    steps: [
      { type: 'checkpoint', x: -452, z: 280, r: 14, objective: 'Drive through the harbor checkpoint' },
      {
        type: 'roadblock',
        x: SAFEHOUSE.x,
        z: SAFEHOUSE.z,
        r: 12,
        objective: 'Dodge the roadblock — reach the safehouse',
        onEnter: (a, deps, target) => deps.police?.setLevel(3, target),
      },
    ],
  },
  {
    id: 'signal',
    title: 'DEAD SIGNAL',
    giver: 'Unknown',
    reward: 3200,
    dialogue: 'UNKNOWN: A helicopter is sweeping the grid. Break its lock before it names you.',
    trigger: { x: 470, z: 40, r: 16 },
    steps: [
      {
        type: 'survive',
        objective: 'Break the helicopter search — stay unseen',
        onEnter: (a, deps, target) => deps.police?.setLevel(5, target),
      },
      {
        type: 'reach-safe',
        x: SAFEHOUSE.x,
        z: SAFEHOUSE.z,
        r: 12,
        objective: 'Reach the safehouse garage before you are identified',
      },
    ],
  },
];

const byId = Object.fromEntries(MISSIONS.map((m) => [m.id, m]));

export function createMissions(deps) {
  const hud = deps.hud;
  const completed = [];
  let active = null;
  let clock = 0;

  const rings = MISSIONS.map((def, i) => {
    const geo = new THREE.RingGeometry(2.2, 2.75, 24);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: [0xffb054, 0xff5a4a, 0x7fb2ff, 0xc07bff][i],
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(def.trigger ? def.trigger.x : 0, 0.12, def.trigger ? def.trigger.z : 0);
    mesh.renderOrder = 2;
    deps.scene?.add(mesh);
    return mesh;
  });

  function refreshMarkers() {
    for (let i = 0; i < MISSIONS.length; i++) {
      const def = MISSIONS[i];
      const available = !!def.trigger && !completed.includes(def.id) && (!active || active.id !== def.id);
      rings[i].visible = available && !deps.isShot?.();
    }
  }

  function hudFreeRoam() {
    hud.setMission('FREE ROAM', 'Explore Port Azura — drive to a glowing marker to start a job', 'COMPLETE');
  }

  function say(def, step) {
    const line = step?.dialogue ?? def.dialogue;
    if (line) hud.toast(line, 4.5);
    deps.audio?.play?.('toast');
  }

  function enterStep(target) {
    if (!active) return;
    const step = active.def.steps[active.stepIndex];
    active.entered = false;
    if (step?.onEnter) {
      step.onEnter(active, deps, target);
      active.entered = true;
    }
    if (active.stepIndex === 0) say(active.def, step);
    else if (step?.dialogue) say(active.def, step);
    refreshMissionText(target);
  }

  function refreshMissionText(target) {
    if (!active) return;
    const step = active.def.steps[active.stepIndex];
    if (!step) return;
    let text = step.objective;
    if (step.x !== undefined && target) {
      const d = Math.round(Math.hypot(target.x - step.x, target.z - step.z));
      text += `  —  ${d} m`;
    }
    const status = active.state === 'failed'
      ? 'FAILED'
      : active.stepIndex === active.def.steps.length - 1
        ? 'FINAL OBJECTIVE'
        : `OBJECTIVE ${active.stepIndex + 1}/${active.def.steps.length}`;
    hud.setMission(active.def.title, text, status);
  }

  function start(id) {
    const def = typeof id === 'string' ? byId[id] : id;
    if (!def || completed.includes(def.id)) return false;
    active = {
      id: def.id,
      def,
      stepIndex: 0,
      timer: 0,
      escapeTimer: 0,
      spottedTimer: 0,
      state: 'active',
      entered: false,
    };
    deps.audio?.play?.('mission');
    if (def.id === 'signal') deps.combat?.spawnHostiles?.(def.trigger.x + 12, def.trigger.z + 8, 3);
    enterStep(deps.target?.());
    refreshMarkers();
    return true;
  }

  function fail(kind = 'FAILED') {
    if (!active) return;
    active.state = 'failed';
    hud.setMission(active.def.title + ' — ' + kind, 'Job failed. Retry or return to free roam.', 'FAILED');
    deps.police?.setLevel?.(0, deps.target?.() ?? deps.player);
    deps.audio?.play?.('fail');
    if (deps.save?.showResult) deps.save.showResult(kind === 'BUSTED' ? 'failed' : 'wasted', { title: kind });
    else hud.showScreen(kind === 'BUSTED' ? 'failed' : 'wasted');
    deps.onFail?.(active.id, kind);
  }

  function complete() {
    if (!active) return;
    const def = active.def;
    const reward = def.reward;
    completed.push(def.id);
    active.state = 'complete';
    hud.setCash(hud.getCash() + reward);
    hud.toast(`MISSION COMPLETE  +$${reward.toLocaleString('en-US')}`, 5);
    hud.setMission('FREE ROAM', 'Job complete. Explore Port Azura or find the next marker.', 'COMPLETE');
    deps.audio?.play?.('mission');
    deps.save?.showResult?.('complete', { title: def.title, reward });
    if (!deps.save?.showResult) hud.showScreen('mission-complete');
    deps.onComplete?.(def.id, reward);
    active = null;
    refreshMarkers();
  }

  function abort() {
    if (!active) return;
    active.state = 'active';
    active = null;
    hudFreeRoam();
    refreshMarkers();
  }

  function retry() {
    if (!active) return;
    active.stepIndex = 0;
    active.timer = 0;
    active.escapeTimer = 0;
    active.spottedTimer = 0;
    active.state = 'active';
    enterStep(deps.target?.());
    hud.showScreen(null);
  }

  function reset() {
    completed.length = 0;
    active = null;
    hud.setCash(2500);
    hudFreeRoam();
    refreshMarkers();
  }

  function stepDone(step, target, dt) {
    if (!step) return false;
    switch (step.type) {
      case 'reach':
      case 'checkpoint':
      case 'roadblock':
      case 'reach-safe':
        return !!target && Math.hypot(target.x - step.x, target.z - step.z) < step.r;
      case 'vehicle':
        return deps.getMode?.() === 'car';
      case 'interact':
        return !!target
          && Math.hypot(target.x - step.x, target.z - step.z) < step.r
          && !!deps.input?.takePressed?.('interact');
      case 'escape':
        return !!deps.police && deps.police.getLevel() === 0;
      case 'survive': {
        let seen = !!deps.police?.isSpotted?.();
        if (!seen && deps.police) {
          for (const u of deps.police.units) {
            if (Math.hypot(u.vehicle.x - target.x, u.vehicle.z - target.z) < SPOTTED_RANGE) { seen = true; break; }
          }
        }
        active.escapeTimer = seen ? 0 : active.escapeTimer + dt;
        return active.escapeTimer >= MISSION_TUNING.escapeSeconds;
      }
      default:
        return false;
    }
  }

  function checkFailure() {
    if (!active || active.state !== 'active') return false;
    const def = active.def;
    if (def.id === 'shipment') return false;
    if (deps.police?.busted?.()) { fail('BUSTED'); return true; }
    if (deps.getMode?.() === 'car' && deps.combat?.isVehicleDestroyed?.(deps.car)) {
      fail('WASTED');
      return true;
    }
    if (def.timeLimit && active.timer > def.timeLimit) { fail('TIME EXPIRED'); return true; }
    const step = def.steps[active.stepIndex];
    if (step?.type === 'reach-safe' && deps.police?.isSpotted?.()) {
      active.spottedTimer += 1 / 60;
      if (active.spottedTimer >= MISSION_TUNING.spottedFailSeconds) { fail('IDENTIFIED'); return true; }
    } else {
      active.spottedTimer = 0;
    }
    return false;
  }

  function update(dt, target) {
    clock += dt;
    for (let i = 0; i < rings.length; i++) {
      if (!rings[i].visible) continue;
      const s = 1 + Math.sin(clock * 2.4 + i) * 0.09;
      rings[i].scale.set(s, 1, s);
      rings[i].material.opacity = 0.35 + Math.sin(clock * 2.4 + i) * 0.14;
    }
    if (!active) {
      if (deps.isShot?.()) return;
      for (const def of MISSIONS) {
        if (def.autoStart && def.after && completed.includes(def.after) && !completed.includes(def.id)) {
          start(def.id);
          return;
        }
      }
      for (const def of MISSIONS) {
        if (!def.trigger || completed.includes(def.id)) continue;
        if (target && Math.hypot(target.x - def.trigger.x, target.z - def.trigger.z) < def.trigger.r) {
          start(def.id);
          return;
        }
      }
      return;
    }
    if (active.state !== 'active') return;
    active.timer += dt;
    refreshMissionText(target);
    if (checkFailure()) return;
    const step = active.def.steps[active.stepIndex];
    if (stepDone(step, target, dt)) {
      active.stepIndex += 1;
      if (active.stepIndex >= active.def.steps.length) complete();
      else enterStep(target);
    }
  }

  function current() {
    if (!active || active.state !== 'active') return null;
    const step = active.def.steps[active.stepIndex];
    if (!step || step.x === undefined) return null;
    return {
      x: step.x,
      z: step.z,
      radius: step.r ?? 10,
      title: active.def.title,
      objective: step.objective,
    };
  }

  function activeInfo() {
    if (!active) return null;
    return {
      id: active.id,
      title: active.def.title,
      stepIndex: active.stepIndex,
      steps: active.def.steps,
      timer: active.timer,
      state: active.state,
    };
  }

  function markers() {
    return MISSIONS
      .filter((m) => m.trigger && !completed.includes(m.id) && (!active || active.id !== m.id))
      .map((m) => ({ x: m.trigger.x, z: m.trigger.z, id: m.id, title: m.title }));
  }

  function serialize() {
    return { completed: [...completed], activeId: active?.id ?? null, stepIndex: active?.stepIndex ?? 0, cash: hud.getCash() };
  }

  function load(data) {
    if (!data) return;
    completed.length = 0;
    for (const id of data.completed ?? []) if (byId[id]) completed.push(id);
    active = null;
    if (data.activeId && byId[data.activeId] && !completed.includes(data.activeId)) {
      active = {
        id: data.activeId,
        def: byId[data.activeId],
        stepIndex: Math.min(data.stepIndex ?? 0, byId[data.activeId].steps.length - 1),
        timer: 0,
        escapeTimer: 0,
        spottedTimer: 0,
        state: 'active',
        entered: false,
      };
      enterStep(deps.target?.());
    }
    if (typeof data.cash === 'number') hud.setCash(data.cash);
    refreshMarkers();
  }

  refreshMarkers();
  hudFreeRoam();

  return {
    update,
    current,
    active: activeInfo,
    start,
    abort,
    retry,
    reset,
    markers,
    serialize,
    load,
    complete,
    fail,
    step(dt, player, vehicle) {
      update(dt, deps.getMode?.() === 'car' ? (vehicle ?? deps.car) : (player ?? deps.player));
    },
  };
}
