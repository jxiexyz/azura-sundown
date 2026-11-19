import { AUDIO } from './config.js';
import { mulberry32, clamp } from './utils.js';

export function createAudio() {
  let ctx = null;
  let master = null;
  let comp = null;
  let noiseBuf = null;
  let engineA = null;
  let engineB = null;
  let engineFilter = null;
  let engineGain = null;
  let screechGain = null;
  let sirenGain = null;
  let sirenPan = null;
  let heliGain = null;
  let ambGain = null;
  let voiceCount = 0;
  let muted = false;
  let volume = AUDIO.master;
  let ready = false;

  const noiseRand = mulberry32(0xa17a5e);

  function makeNoise(seconds = 2) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = noiseRand() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      data[i] = w * 0.7 + last * 0.5;
    }
    return buf;
  }

  function loopNoise(filterType, freq, q, gainValue) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = gainValue;
    src.connect(filter).connect(gain).connect(master);
    src.start();
    return { src, filter, gain };
  }

  function build() {
    master = ctx.createGain();
    master.gain.value = muted ? 0 : volume;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);

    engineA = ctx.createOscillator();
    engineA.type = 'sawtooth';
    engineB = ctx.createOscillator();
    engineB.type = 'sawtooth';
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 600;
    engineFilter.Q.value = 3;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineA.connect(engineFilter);
    engineB.connect(engineFilter);
    engineFilter.connect(engineGain).connect(master);
    engineA.start();
    engineB.start();

    const screech = loopNoise('bandpass', 1800, 2.5, 0);
    screechGain = screech.gain;

    const sirenLfo = ctx.createOscillator();
    sirenLfo.type = 'square';
    sirenLfo.frequency.value = 1 / AUDIO.sirenCycle;
    const sirenDepthA = ctx.createGain();
    sirenDepthA.gain.value = 0.5;
    const sirenDepthB = ctx.createGain();
    sirenDepthB.gain.value = -0.5;
    const sirenOscA = ctx.createOscillator();
    sirenOscA.type = 'square';
    sirenOscA.frequency.value = AUDIO.sirenA;
    const sirenOscB = ctx.createOscillator();
    sirenOscB.type = 'square';
    sirenOscB.frequency.value = AUDIO.sirenB;
    const sirenMixA = ctx.createGain();
    sirenMixA.gain.value = 0.5;
    const sirenMixB = ctx.createGain();
    sirenMixB.gain.value = 0.5;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenPan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    sirenOscA.connect(sirenMixA);
    sirenOscB.connect(sirenMixB);
    sirenLfo.connect(sirenDepthA).connect(sirenMixA.gain);
    sirenLfo.connect(sirenDepthB).connect(sirenMixB.gain);
    if (sirenPan) {
      sirenMixA.connect(sirenPan);
      sirenMixB.connect(sirenPan);
      sirenPan.connect(sirenGain).connect(master);
    } else {
      sirenMixA.connect(sirenGain);
      sirenMixB.connect(sirenGain);
      sirenGain.connect(master);
    }
    sirenLfo.start();
    sirenOscA.start();
    sirenOscB.start();

    const heli = loopNoise('lowpass', 400, 0.7, 0);
    heliGain = heli.gain;
    const heliLfo = ctx.createOscillator();
    heliLfo.type = 'sine';
    heliLfo.frequency.value = AUDIO.heliLfo;
    const heliDepth = ctx.createGain();
    heliDepth.gain.value = 0.35;
    heliLfo.connect(heliDepth).connect(heli.gain.gain);
    heliLfo.start();

    const amb = loopNoise('lowpass', 300, 0.5, 0.055);
    ambGain = amb.gain;

    ready = true;
  }

  function unlock() {
    if (!ctx) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return false;
      try {
        ctx = new AC();
        noiseBuf = makeNoise(2);
        build();
      } catch (e) {
        ctx = null;
        ready = false;
        return false;
      }
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return true;
  }

  function param(node, value, tc = 0.05) {
    if (!ready || !node) return;
    node.setTargetAtTime(value, ctx.currentTime, tc);
  }

  function tone(freq, dur, type, vol, sweep = 0) {
    if (!ready || voiceCount >= AUDIO.maxVoices) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (sweep) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + sweep), ctx.currentTime + dur);
    g.gain.setValueAtTime(Math.max(0.0001, vol), ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g).connect(master);
    voiceCount += 1;
    o.onended = () => { voiceCount = Math.max(0, voiceCount - 1); try { o.disconnect(); g.disconnect(); } catch (_) {} };
    o.start();
    o.stop(ctx.currentTime + dur + 0.02);
  }

  function burst(dur, vol, freq, type = 'highpass') {
    if (!ready || voiceCount >= AUDIO.maxVoices) return;
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.0001, vol), ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    s.connect(f).connect(g).connect(master);
    voiceCount += 1;
    s.onended = () => { voiceCount = Math.max(0, voiceCount - 1); try { s.disconnect(); f.disconnect(); g.disconnect(); } catch (_) {} };
    s.start();
    s.stop(ctx.currentTime + dur + 0.02);
  }

  function play(name, opts = {}) {
    if (!ready) return;
    switch (name) {
      case 'shot':
        burst(0.09, 0.22, 1200);
        tone(190, 0.07, 'square', 0.12, -120);
        break;
      case 'reload':
        tone(420, 0.05, 'square', 0.08, 120);
        break;
      case 'hit':
        tone(150, 0.12, 'sawtooth', 0.14, -90);
        break;
      case 'collision':
      case 'impact': {
        const v = clamp(opts.v ?? opts.volume ?? 0.5, 0.1, 1);
        tone(90, 0.16, 'sine', 0.16 * v, -50);
        burst(0.12, 0.13 * v, 500, 'lowpass');
        break;
      }
      case 'screech':
        burst(0.2, 0.09, 1900);
        break;
      case 'ui':
      case 'toast':
        tone(660, 0.09, 'sine', 0.1, 220);
        break;
      case 'mission':
        tone(523, 0.13, 'triangle', 0.13);
        setTimeout(() => tone(784, 0.22, 'triangle', 0.13), 110);
        break;
      case 'fail':
        tone(300, 0.3, 'sawtooth', 0.14, -160);
        break;
      case 'siren-burst':
        tone(760, 0.25, 'square', 0.1, 120);
        break;
      case 'heli-pass':
        burst(0.5, 0.08, 320, 'lowpass');
        break;
      default:
        break;
    }
  }

  function update(dt, snap = {}) {
    if (!ready) return;
    const car = snap.car || {};
    const police = snap.police || {};
    const heli = snap.heli || {};
    const weather = snap.weather || {};
    const inCar = snap.mode === 'car';
    const rpm = clamp(car.rpm ?? 0.2, 0, 1);
    const base = AUDIO.engineBase * (0.55 + rpm * 1.9);
    param(engineA.frequency, base, 0.06);
    param(engineB.frequency, base * 1.5, 0.06);
    param(engineFilter.frequency, 340 + rpm * 2100 + (car.throttle > 0 ? 500 : 0), 0.08);
    param(engineGain.gain, inCar ? 0.07 + (car.throttle > 0 ? 0.1 : 0.035) + rpm * 0.045 : 0.012, 0.1);
    const slip = car.slip ?? 0;
    param(screechGain.gain, inCar && slip > AUDIO.screechSlip ? clamp((slip - AUDIO.screechSlip) / 6, 0, 1) * 0.16 : 0, 0.05);
    const nd = police.nearestDist ?? Infinity;
    param(sirenGain.gain, police.level > 0 && nd < AUDIO.sirenRange ? clamp(1 - nd / AUDIO.sirenRange, 0, 1) * 0.11 : 0, 0.12);
    if (sirenPan) param(sirenPan.pan, clamp(optsPan(snap), -1, 1), 0.2);
    param(heliGain.gain, heli.active && heli.dist < AUDIO.heliRange ? clamp(1 - heli.dist / AUDIO.heliRange, 0, 1) * 0.08 : 0, 0.15);
    param(ambGain.gain, 0.05 + clamp(weather.rain ?? 0, 0, 1) * 0.05, 0.2);
  }

  function optsPan(snap) {
    return snap?.police?.bearing ?? 0;
  }

  function setMuted(v) {
    muted = !!v;
    param(master, muted ? 0 : volume, 0.05);
    if (muted && ctx && ready) master.gain.setValueAtTime(0, ctx.currentTime);
    return muted;
  }

  function setVolume(v) {
    volume = clamp(Number(v) || 0, 0, 1);
    param(master, muted ? 0 : volume, 0.05);
    return volume;
  }

  function suspend() {
    if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  return {
    unlock,
    update,
    step(dt, state) { update(dt, state); },
    play,
    setMuted,
    isMuted: () => muted,
    setVolume,
    getVolume: () => volume,
    suspend,
    resume,
    serialize: () => ({ muted, volume }),
    load(data) {
      if (!data) return;
      muted = !!data.muted;
      volume = clamp(data.volume ?? AUDIO.master, 0, 1);
      param(master, muted ? 0 : volume, 0.05);
    },
    engine(rpm, loadV = 0) {
      if (!ready) return;
      param(engineA.frequency, AUDIO.engineBase * (0.55 + clamp(rpm, 0, 1) * 1.9), 0.05);
      param(engineB.frequency, AUDIO.engineBase * (0.55 + clamp(rpm, 0, 1) * 1.9) * 1.5, 0.05);
      param(engineGain.gain, clamp(0.055 + loadV * 0.1, 0, 0.25), 0.05);
    },
    tireScreech(v) { param(screechGain.gain, clamp(v, 0, 1) * 0.16, 0.05); },
    siren(on, pan = 0) {
      param(sirenGain.gain, on ? 0.11 : 0, 0.08);
      if (sirenPan) param(sirenPan.pan, clamp(pan, -1, 1), 0.12);
    },
    heli(v) { param(heliGain.gain, clamp(v, 0, 1) * 0.08, 0.12); },
    ui(kind = 'ui') { play(kind === 'mission' ? 'mission' : kind === 'fail' ? 'fail' : 'ui'); },
    gunshot() { play('shot'); },
    impact(v = 0.5) { play('impact', { v }); },
  };
}
