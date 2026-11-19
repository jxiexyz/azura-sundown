import { SAVE_KEY, SAVE_VERSION, START_CASH } from './config.js';

const DEFAULT_SETTINGS = { muted: false, volume: 0.5, shake: true, invertY: false, quality: 'high' };

export function createSave(deps) {
  const hud = deps.hud;
  const missions = deps.missions;
  const police = deps.police;
  const combat = deps.combat;
  const car = deps.car;
  const player = deps.player;
  const audio = deps.audio;
  const settings = { ...DEFAULT_SETTINGS };
  let lastState = null;
  let autoTimer = 0;

  const $ = (id) => document.getElementById(id);
  const el = {
    continueBtn: $('continue-button'),
    settingsBtn: $('settings-button'),
    pauseSettings: $('pause-settings-button'),
    saveBtn: $('save-button'),
    quitBtn: $('quit-button'),
    resultContinue: $('result-continue'),
    resultTitle: $('result-title'),
    resultReward: $('result-reward'),
    resultStats: $('result-stats'),
    failTitle: $('fail-title'),
    failRetry: $('fail-retry'),
    failFree: $('fail-free'),
    respawn: $('respawn-button'),
    settingsClose: $('settings-close'),
    volume: $('volume-slider'),
    shake: $('shake-toggle'),
    invert: $('invert-toggle'),
    quality: $('quality-select'),
    start: $('start-screen'),
  };

  function read() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || data.v !== SAVE_VERSION) return null;
      return data;
    } catch (_) {
      return null;
    }
  }

  function buildState() {
    const mode = deps.getMode?.() ?? 'car';
    return {
      v: SAVE_VERSION,
      cash: hud.getCash(),
      mode,
      player: { x: player.x, z: player.z, heading: player.heading },
      car: { x: car.x, z: car.z, heading: car.heading },
      wanted: police?.getLevel?.() ?? 0,
      missions: missions?.serialize?.() ?? null,
      combat: combat?.serialize?.() ?? null,
      settings: { ...settings },
    };
  }

  function applySettings(data = {}) {
    if (typeof data.muted === 'boolean') settings.muted = data.muted;
    if (typeof data.volume === 'number') settings.volume = data.volume;
    if (typeof data.shake === 'boolean') settings.shake = data.shake;
    if (typeof data.invertY === 'boolean') settings.invertY = data.invertY;
    if (data.quality === 'low' || data.quality === 'high') settings.quality = data.quality;
    audio?.setMuted?.(settings.muted);
    audio?.setVolume?.(settings.volume);
    deps.onShake?.(settings.shake);
    deps.onInvert?.(settings.invertY);
    deps.onQuality?.(settings.quality);
    if (el.volume) el.volume.value = String(Math.round(settings.volume * 100));
    if (el.shake) el.shake.checked = settings.shake;
    if (el.invert) el.invert.checked = settings.invertY;
    if (el.quality) el.quality.value = settings.quality;
  }

  function hasSave() {
    return !!read();
  }

  function save(state) {
    const data = state ?? buildState();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      lastState = data;
      hud.toast('GAME SAVED', 2);
      return true;
    } catch (_) {
      return false;
    }
  }

  function load() {
    const data = read();
    if (!data) return false;
    try {
      hud.setCash(typeof data.cash === 'number' ? data.cash : START_CASH);
      if (data.player) player.reset(data.player);
      if (data.car) car.reset(data.car);
      player.syncMesh();
      car.syncMesh(0);
      police?.setLevel?.(data.wanted ?? 0, { x: car.x, z: car.z, heading: car.heading });
      missions?.load?.(data.missions);
      combat?.load?.(data.combat);
      applySettings(data.settings);
      lastState = data;
      deps.onLoad?.(data);
      return true;
    } catch (_) {
      return false;
    }
  }

  function clear() {
    try { localStorage.removeItem(SAVE_KEY); } catch (_) {}
    lastState = null;
    if (el.continueBtn) el.continueBtn.classList.add('hidden');
  }

  function autosaveTick(dt) {
    if (deps.getState?.() !== 'play') return;
    autoTimer += dt;
    if (autoTimer >= 30) { autoTimer = 0; save(); }
  }

  function setSetting(key, value) {
    if (key === 'masterVolume') settings.volume = Math.max(0, Math.min(1, Number(value) || 0));
    else if (key === 'muted') settings.muted = !!value;
    else if (key === 'shake') settings.shake = !!value;
    else if (key === 'invertY') settings.invertY = !!value;
    else if (key === 'quality') settings.quality = value === 'low' ? 'low' : 'high';
    applySettings({});
    return settings[key === 'masterVolume' ? 'volume' : key];
  }

  function showResult(kind = 'complete', opts = {}) {
    if (kind === 'complete') {
      const info = missions?.active?.();
      if (el.resultTitle) el.resultTitle.textContent = opts.title ?? 'MISSION COMPLETE';
      if (el.resultReward) el.resultReward.textContent = '+' + '$' + Number(opts.reward ?? 0).toLocaleString('en-US');
      if (el.resultStats) {
        const secs = Math.round(info?.timer ?? 0);
        const speed = Math.round(Math.abs(car.speed ?? 0) * 3.6);
        el.resultStats.textContent = `TIME ${secs}s   ·   TOP ${speed} km/h   ·   WANTED ${police?.getLevel?.() ?? 0}`;
      }
      hud.showScreen('mission-complete');
    } else if (kind === 'failed') {
      if (el.failTitle) el.failTitle.textContent = opts.title ?? 'BUSTED';
      hud.showScreen('failed');
    } else if (kind === 'wasted') {
      hud.showScreen('wasted');
    }
  }

  function wire(id, fn) {
    const node = $(id);
    if (node) node.addEventListener('click', fn);
  }

  wire('continue-button', () => { if (load()) deps.onContinue?.(); });
  wire('settings-button', () => hud.showScreen('settings'));
  wire('pause-settings-button', () => hud.showScreen('settings'));
  wire('save-button', () => save());
  wire('quit-button', () => { deps.onQuit?.(); hud.showScreen('start'); });
  wire('result-continue', () => { hud.showScreen(null); deps.onResume?.(); });
  wire('fail-retry', () => { missions?.retry?.(); hud.showScreen(null); deps.onResume?.(); });
  wire('fail-free', () => { missions?.abort?.(); hud.showScreen(null); deps.onResume?.(); });
  wire('respawn-button', () => { combat?.respawn?.(); deps.onResume?.(); });
  wire('settings-close', () => {
    const back = deps.getState?.() === 'start' ? 'start' : deps.getState?.() === 'pause' ? 'pause' : null;
    hud.showScreen(back);
  });
  if (el.volume) el.volume.addEventListener('input', (e) => setSetting('masterVolume', e.target.value / 100));
  if (el.shake) el.shake.addEventListener('change', (e) => setSetting('shake', e.target.checked));
  if (el.invert) el.invert.addEventListener('change', (e) => setSetting('invertY', e.target.checked));
  if (el.quality) el.quality.addEventListener('change', (e) => setSetting('quality', e.target.value));

  if (hasSave() && el.continueBtn) el.continueBtn.classList.remove('hidden');
  applySettings({});

  return {
    hasSave,
    has: hasSave,
    save,
    load,
    clear,
    autosaveTick,
    settings: () => settings,
    setSetting,
    showResult,
    state: () => lastState,
  };
}
