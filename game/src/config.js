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
  pierMinZ: 158,
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
  distance: 7.6,
  distanceSpeedGain: 0.055,
  height: 3.1,
  heightSpeedGain: 0.014,
  lookAhead: 6.5,
  lag: 3.4,
  fovBase: 62,
  fovSpeedGain: 0.16,
  shakeSpeedStart: 30,
};

export const STEP = 1 / 60;
export const MAX_FRAME = 0.25;
export const SAVE_KEY = 'azura-sundown-save-v1';
