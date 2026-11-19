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

    ctx.beginPath();
    ctx.arc(0, 0, r + 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(8,10,16,0.72)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,170,90,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const a0 = Math.PI * 0.75;
    const a1 = Math.PI * 2.25;
    ctx.beginPath();
    ctx.arc(0, 0, r - 4, a0, a1);
    ctx.strokeStyle = 'rgba(120,130,150,0.35)';
    ctx.lineWidth = 5;
    ctx.stroke();

    const redStart = a0 + (a1 - a0) * (175 / MAX_KMH);
    ctx.beginPath();
    ctx.arc(0, 0, r - 4, redStart, a1);
    ctx.strokeStyle = 'rgba(255,60,50,0.75)';
    ctx.stroke();

    const frac = clamp(shownSpeed / MAX_KMH, 0, 1);
    ctx.beginPath();
    ctx.arc(0, 0, r - 4, a0, a0 + (a1 - a0) * frac);
    ctx.strokeStyle = '#ffb054';
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.fillStyle = 'rgba(220,225,235,0.8)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    for (let v = 0; v <= MAX_KMH; v += 20) {
      const a = a0 + (a1 - a0) * (v / MAX_KMH);
      const inner = r - 14;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (r - 8), Math.sin(a) * (r - 8));
      ctx.lineTo(Math.cos(a) * inner, Math.sin(a) * inner);
      ctx.strokeStyle = v >= 175 ? 'rgba(255,90,70,0.9)' : 'rgba(200,205,215,0.6)';
      ctx.lineWidth = v % 40 === 0 ? 2 : 1;
      ctx.stroke();
      if (v % 40 === 0) ctx.fillText(String(v), Math.cos(a) * (r - 26), Math.sin(a) * (r - 26) + 3);
    }

    const rpmA = a0 + (a1 - a0) * clamp(rpm, 0, 1);
    ctx.beginPath();
    ctx.arc(0, 0, r + 3, a0, rpmA);
    ctx.strokeStyle = rpm > 0.88 ? 'rgba(255,70,50,0.9)' : 'rgba(90,200,255,0.55)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    const needleA = a0 + (a1 - a0) * frac;
    ctx.beginPath();
    ctx.moveTo(Math.cos(needleA + Math.PI) * 10, Math.sin(needleA + Math.PI) * 10);
    ctx.lineTo(Math.cos(needleA) * (r - 12), Math.sin(needleA) * (r - 12));
    ctx.strokeStyle = '#ff6a3c';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ff6a3c';
    ctx.fill();

    ctx.fillStyle = '#f2f4f8';
    ctx.font = 'bold 24px monospace';
    ctx.fillText(String(Math.round(shownSpeed)), 0, 34);
    ctx.font = '9px monospace';
    ctx.fillStyle = 'rgba(220,225,235,0.65)';
    ctx.fillText('km/h', 0, 46);
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = gear === 'R' ? '#ff8a6a' : '#8ad2ff';
    ctx.fillText(gear, 0, 62);
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
    getCash: () => cash,
  };
}
