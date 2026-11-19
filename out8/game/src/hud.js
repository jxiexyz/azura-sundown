import { GAME_TITLE, START_CASH } from './config.js';
import { clamp } from './utils.js';

const MAX_KMH = 220;

export function createHud() {
  const el = {
    hud: document.getElementById('hud'),
    cash: document.getElementById('cash'),
    wanted: document.getElementById('wanted'),
    district: document.getElementById('district'),
    missionTitle: document.getElementById('mission-title'),
    missionObjective: document.getElementById('mission-objective'),
    missionStatus: document.getElementById('mission-status'),
    speedo: document.getElementById('speedo'),
    speedoCanvas: document.getElementById('speedo-canvas'),
    toast: document.getElementById('toast'),
    start: document.getElementById('start-screen'),
    pause: document.getElementById('pause-screen'),
    carName: document.getElementById('car-name'),
    policePanel: document.getElementById('police-panel'),
    policeHeader: document.getElementById('police-header'),
    policeUnits: document.getElementById('police-units'),
    damageFlash: document.getElementById('damage-flash'),
    combatPanel: document.getElementById('combat-panel'),
    healthFill: document.getElementById('health-fill'),
    ammo: document.getElementById('ammo'),
    reserve: document.getElementById('reserve'),
    result: document.getElementById('result-screen'),
    fail: document.getElementById('fail-screen'),
    wasted: document.getElementById('wasted-screen'),
    settings: document.getElementById('settings-screen'),
    crosshair: document.getElementById('aim-reticle'),
    minimapDistrict: document.getElementById('minimap-district'),
    barHealth: document.getElementById('mbar-health'),
    barHeat: document.getElementById('mbar-heat'),
    barFuel: document.getElementById('mbar-fuel'),
    icons: {
      sound: document.getElementById('icon-sound'),
      camera: document.getElementById('icon-camera'),
      save: document.getElementById('icon-save'),
      pause: document.getElementById('icon-pause'),
    },
  };
  const ctx = el.speedoCanvas.getContext('2d');
  const stars = [...el.wanted.querySelectorAll('.star')];
  let cash = START_CASH;
  let toastTimer = 0;
  let shownSpeed = 0;

  function setCash(value) {
    cash = value;
    el.cash.textContent = '$' + cash.toLocaleString('en-US');
  }

  function setWanted(level) {
    stars.forEach((s, i) => s.classList.toggle('active', i < level));
    el.wanted.classList.toggle('hot', level > 0);
  }

  function setDistrict(name) {
    if (el.district.textContent !== name) el.district.textContent = name;
    if (el.minimapDistrict && el.minimapDistrict.textContent !== name) el.minimapDistrict.textContent = name;
  }

  function setStatusBars(health, heat, fuel) {
    if (el.barHealth) {
      el.barHealth.style.width = clamp(health, 0, 100) + '%';
      el.barHealth.style.background = health > 55 ? '#6de08a' : health > 25 ? '#ffcf4d' : '#ff5a4a';
    }
    if (el.barHeat) el.barHeat.style.width = clamp(heat * 20, 0, 100) + '%';
    if (el.barFuel) el.barFuel.style.width = clamp(fuel, 0, 100) + '%';
  }

  function setIcon(name, on) {
    const node = el.icons[name];
    if (node) node.classList.toggle('off', !on);
  }

  function showCrosshair(visible) {
    el.crosshair?.classList.toggle('hidden', !visible);
  }

  function onIcon(name, fn) {
    const node = el.icons[name];
    if (!node) return;
    node.style.pointerEvents = 'auto';
    node.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
  }

  function setMission(title, objective, status) {
    el.missionTitle.textContent = title;
    el.missionObjective.textContent = objective;
    el.missionStatus.textContent = status;
  }

  function toast(message, seconds = 3) {
    el.toast.textContent = message;
    el.toast.classList.add('show');
    toastTimer = seconds;
  }

  function clearToast() {
    toastTimer = 0;
    el.toast.classList.remove('show');
  }

  function setPoliceUnits(list) {
    const active = Array.isArray(list) && list.length > 0;
    el.policePanel.classList.toggle('hidden', !active);
    if (!active) return;
    el.policeHeader.textContent = `ABPD DISPATCH · ${list.length} UNIT${list.length > 1 ? 'S' : ''}`;
    el.policeUnits.innerHTML = list
      .map((u) => `<div class="pu-row"><span class="pu-id">${u.id}</span><span class="pu-dist">${Math.round(u.dist)} m</span><span class="pu-st st-${u.status.toLowerCase()}">${u.status}</span></div>`)
      .join('');
  }

  function setDriving(driving, carName) {
    el.speedo.classList.toggle('hidden', !driving);
    if (carName) el.carName.textContent = carName;
  }

  function showScreen(name) {
    const screens = {
      start: el.start,
      pause: el.pause,
      'mission-complete': el.result,
      failed: el.fail,
      wasted: el.wasted,
      settings: el.settings,
    };
    for (const key of Object.keys(screens)) {
      if (screens[key]) screens[key].classList.toggle('hidden', key !== name);
    }
    el.hud.classList.toggle('hidden', name === 'start');
  }

  function setHealth(value) {
    const pct = clamp(value, 0, 100);
    el.healthFill.style.width = pct + '%';
    el.healthFill.style.background = pct > 55 ? '#6de08a' : pct > 25 ? '#ffcf4d' : '#ff5a4a';
  }

  function setAmmo(mag, reserve) {
    el.ammo.textContent = String(mag);
    el.reserve.textContent = String(reserve);
    el.ammo.classList.toggle('empty', mag <= 0);
  }

  function setDamageFlash(value) {
    el.damageFlash.style.opacity = String(clamp(value, 0, 1) * 0.62);
  }

  function setCombatVisible(visible) {
    el.combatPanel.classList.toggle('hidden', !visible);
  }

  function drawSpeedo(kmh, rpm, gear, snap = false) {
    shownSpeed = snap ? kmh : shownSpeed + (kmh - shownSpeed) * 0.25;
    const w = el.speedoCanvas.width;
    const c = w / 2;
    const r = c - 12;
    ctx.clearRect(0, 0, w, w);
    ctx.save();
    ctx.translate(c, c);

    const bg = ctx.createRadialGradient(0, -r * 0.3, r * 0.2, 0, 0, r + 10);
    bg.addColorStop(0, 'rgba(16,20,30,0.82)');
    bg.addColorStop(1, 'rgba(6,8,14,0.66)');
    ctx.beginPath();
    ctx.arc(0, 0, r + 9, 0, Math.PI * 2);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,176,84,0.3)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    const a0 = Math.PI * 0.75;
    const a1 = Math.PI * 2.25;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, r - 4, a0, a1);
    ctx.strokeStyle = 'rgba(255,255,255,0.09)';
    ctx.lineWidth = 6;
    ctx.stroke();

    const redStart = a0 + (a1 - a0) * (175 / MAX_KMH);
    ctx.beginPath();
    ctx.arc(0, 0, r - 4, redStart, a1);
    ctx.strokeStyle = 'rgba(255,60,50,0.55)';
    ctx.stroke();

    const frac = clamp(shownSpeed / MAX_KMH, 0, 1);
    ctx.beginPath();
    ctx.arc(0, 0, r - 4, a0, a0 + (a1 - a0) * frac);
    ctx.strokeStyle = '#ffb054';
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.lineCap = 'butt';
    ctx.textAlign = 'center';
    for (let v = 0; v <= MAX_KMH; v += 10) {
      const a = a0 + (a1 - a0) * (v / MAX_KMH);
      const major = v % 40 === 0;
      const inner = r - (major ? 16 : 11);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (r - 8), Math.sin(a) * (r - 8));
      ctx.lineTo(Math.cos(a) * inner, Math.sin(a) * inner);
      ctx.strokeStyle = v >= 175 ? 'rgba(255,90,70,0.85)' : 'rgba(210,216,228,0.55)';
      ctx.lineWidth = major ? 1.8 : 0.8;
      ctx.stroke();
      if (major) {
        ctx.fillStyle = 'rgba(226,232,242,0.85)';
        ctx.font = '600 9px "Segoe UI", Arial, sans-serif';
        ctx.fillText(String(v), Math.cos(a) * (r - 26), Math.sin(a) * (r - 26) + 3);
      }
    }

    const rpmA = a0 + (a1 - a0) * clamp(rpm, 0, 1);
    ctx.beginPath();
    ctx.arc(0, 0, r - 13, a0, rpmA);
    ctx.strokeStyle = rpm > 0.88 ? 'rgba(255,70,50,0.8)' : 'rgba(90,200,255,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const needleA = a0 + (a1 - a0) * frac;
    ctx.save();
    ctx.rotate(needleA);
    ctx.beginPath();
    ctx.moveTo(-12, -2.2);
    ctx.lineTo(r - 14, -0.7);
    ctx.lineTo(r - 14, 0.7);
    ctx.lineTo(-12, 2.2);
    ctx.closePath();
    ctx.fillStyle = '#ff6a3c';
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1e28';
    ctx.fill();
    ctx.strokeStyle = '#ff6a3c';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.fillStyle = '#f4f6fa';
    ctx.font = 'italic 800 30px "Segoe UI", Arial, sans-serif';
    ctx.fillText(String(Math.round(shownSpeed)), 0, 36);
    ctx.font = '600 9px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = 'rgba(220,225,235,0.6)';
    ctx.fillText('km/h', 0, 48);
    const gearColor = gear === 'R' ? '#ff8a6a' : '#8ad2ff';
    ctx.beginPath();
    ctx.roundRect(-13, 54, 26, 17, 4);
    ctx.fillStyle = 'rgba(90,160,255,0.12)';
    ctx.fill();
    ctx.strokeStyle = gearColor;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = '700 11px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = gearColor;
    ctx.fillText(gear, 0, 66);
    ctx.restore();
  }

  function update(dt) {
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) el.toast.classList.remove('show');
    }
  }

  setCash(START_CASH);
  setWanted(0);
  document.getElementById('game-title').textContent = GAME_TITLE;
  document.title = GAME_TITLE + ' — Port Azura';

  return {
    setCash, setWanted, setDistrict, setMission, toast, clearToast, setPoliceUnits, setDriving,
    showScreen, drawSpeedo, update, setHealth, setAmmo, setDamageFlash, setCombatVisible,
    setStatusBars, setIcon, onIcon,
    showCrosshair,
    getCash: () => cash,
  };
}
