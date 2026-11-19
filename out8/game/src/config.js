export const GAME_TITLE = 'AZURA SUNDOWN';
export const CITY_NAME = 'Port Azura';
export const POLICE_NAME = 'Azura Bay Police Department';
export const POLICE_SHORT = 'ABPD';
export const PLAYER_CAR_NAME = 'Vantara S9';
export const PLAYER_NAME = 'Riko Vance';
export const START_CASH = 2500;

export const DISTRICTS = [
  { id: 'harborline', name: 'HARBORLINE', label: 'Harborline Docks' },
  { id: 'crescent', name: 'CRESCENT STRIP', label: 'Crescent Strip' },
  { id: 'meridian', name: 'MERIDIAN CORE', label: 'Meridian Core' },
  { id: 'palms', name: 'OLD PALMS', label: 'Old Palms' },
  { id: 'ridge', name: 'VISTA RIDGE', label: 'Vista Ridge' },
];

export function districtAt(x, z) {
  if (x < -352 && z > 150 && z < 450) return DISTRICTS[0];
  if (x < -252) return DISTRICTS[1];
  if (x > 372) return DISTRICTS[4];
  if (z > 96 && x < 280) return DISTRICTS[3];
  if (z > 150 && x < -196) return DISTRICTS[0];
  return DISTRICTS[2];
}

export const WORLD = {
  half: 620,
  coastX: -360,
  pierMinX: -545,
  pierMinZ: 260,
  pierMaxZ: 442,
  hillStartX: 380,
  hillFullX: 560,
  hillHeight: 42,
};

export const CAR = {
  accel: 16.5,
  brake: 32,
  reverseAccel: 9,
  maxSpeed: 54,
  maxReverse: 12,
  drag: 0.0035,
  rolling: 0.6,
  grip: 8.0,
  gripHandbrake: 1.5,
  gripSlide: 3.2,
  steerMax: 0.62,
  steerSpeedFalloff: 0.05,
  steerLerp: 7,
  wheelbase: 2.9,
  maxYawRate: 1.9,
  radius: 1.45,
  wheelRadius: 0.34,
  restitution: 0.28,
};

export const CAMERA = {
  distance: 6.6,
  distanceSpeedGain: 0.05,
  height: 2.4,
  heightSpeedGain: 0.012,
  lookAhead: 7.5,
  lag: 3.4,
  fovBase: 62,
  fovSpeedGain: 0.16,
  shakeSpeedStart: 30,
};

export const STEP = 1 / 60;
export const MAX_FRAME = 0.25;
export const SAVE_KEY = 'azura-sundown-save-v1';
export const SAVE_VERSION = 1;

export const SAFEHOUSE = { x: -270, z: -380 };

export const COMBAT = {
  dmg: 25,
  mag: 12,
  reserve: 60,
  rate: 0.18,
  reload: 1.1,
  range: 90,
  spread: 0.015,
  maxHealth: 100,
  regenDelay: 6,
  regenRate: 5,
  flashTime: 0.06,
  tracerTime: 0.05,
  wantedWindow: 20,
  hostileHealth: 60,
  hostileDmg: 8,
  hostileRate: 1.4,
  hostileRange: 55,
  hostileNear: 8,
  hostileFar: 14,
  hostilFleeHealth: 25,
  damageFlashDecay: 3.2,
  vehicleHealth: 100,
  vehicleDmgScale: 0.55,
};

export const AUDIO = {
  master: 0.5,
  maxVoices: 24,
  engineBase: 82,
  screechSlip: 3,
  sirenA: 660,
  sirenB: 880,
  sirenCycle: 0.55,
  heliLfo: 14,
  sirenRange: 150,
  heliRange: 220,
};

export const MISSION_TUNING = {
  escapeSeconds: 10,
  spottedFailSeconds: 6,
  harborTimeLimit: 150,
  bustedSeconds: 1.5,
  bustedRange: 2.5,
};
