import THREE from 'three';
import { CAR, WORLD, PLAYER_CAR_NAME, POLICE_SHORT } from './config.js';
import { clamp, damp, canvasTexture, mergeParts, loftGeometry, radialTexture, beamTexture } from './utils.js';
import { heightAt } from './world.js';

const WHEEL_Z = 1.44;
const ARCH_R = 0.6;

function archLift(z, base) {
  let lift = 0;
  for (const zw of [WHEEL_Z, -WHEEL_Z - 0.02]) {
    const d = (z - zw) / ARCH_R;
    if (Math.abs(d) < 1) lift = Math.max(lift, 0.44 * Math.sqrt(1 - d * d));
  }
  return base + lift;
}

function ring(w, y0, y1) {
  const h = y1 - y0;
  const half = [
    [0, y0],
    [w * 0.5, y0],
    [w * 0.82, y0 + 0.025],
    [w * 0.96, y0 + h * 0.24],
    [w, y0 + h * 0.55],
    [w * 0.97, y1 - h * 0.12],
    [w * 0.8, y1 - 0.015],
    [w * 0.55, y1],
    [0, y1],
  ];
  const pts = half.slice();
  for (let i = half.length - 2; i >= 1; i--) pts.push([-half[i][0], half[i][1]]);
  return pts;
}

function bodyStations(style) {
  const raw = style.body;
  return raw.map(([z, w, y0, y1]) => ({
    z,
    pts: ring(w, style.arches ? archLift(z, y0) : y0, y1),
  }));
}

function cabinStations(style) {
  return style.cabin.map(([z, w, y0, y1]) => ({ z, pts: ring(w, y0, y1) }));
}

const STYLES = {
  sports: {
    arches: true,
    body: [
      [-2.3, 0.72, 0.32, 0.5],
      [-2.2, 0.86, 0.24, 0.7],
      [-1.9, 0.93, 0.2, 0.8],
      [-1.46, 0.97, 0.2, 0.85],
      [-0.95, 0.95, 0.2, 0.81],
      [-0.3, 0.94, 0.22, 0.77],
      [0.35, 0.94, 0.22, 0.77],
      [0.95, 0.97, 0.2, 0.81],
      [1.44, 0.96, 0.2, 0.75],
      [1.9, 0.9, 0.24, 0.62],
      [2.2, 0.82, 0.28, 0.5],
      [2.32, 0.68, 0.34, 0.44],
    ],
    cabin: [
      [-1.4, 0.66, 0.76, 0.82],
      [-1.05, 0.7, 0.78, 1.08],
      [-0.55, 0.68, 0.78, 1.17],
      [-0.05, 0.66, 0.76, 1.18],
      [0.55, 0.7, 0.74, 1.0],
      [1.05, 0.74, 0.72, 0.78],
    ],
    roof: [[-0.66, 0.6, 1.13, 1.2], [-0.3, 0.62, 1.15, 1.22], [0.02, 0.6, 1.14, 1.2]],
    headY: 0.5, headZ: 2.24, tailY: 0.72, tailZ: -2.3,
  },
  sedan: {
    arches: true,
    body: [
      [-2.42, 0.74, 0.34, 0.56],
      [-2.3, 0.86, 0.26, 0.78],
      [-1.95, 0.92, 0.22, 0.86],
      [-1.46, 0.94, 0.22, 0.88],
      [-0.9, 0.93, 0.22, 0.86],
      [0.3, 0.93, 0.22, 0.86],
      [0.95, 0.94, 0.22, 0.88],
      [1.44, 0.93, 0.22, 0.84],
      [1.95, 0.88, 0.26, 0.72],
      [2.28, 0.8, 0.3, 0.58],
      [2.42, 0.68, 0.36, 0.5],
    ],
    cabin: [
      [-1.5, 0.68, 0.82, 0.9],
      [-1.15, 0.72, 0.84, 1.26],
      [-0.6, 0.7, 0.84, 1.36],
      [0.1, 0.68, 0.82, 1.37],
      [0.7, 0.72, 0.8, 1.16],
      [1.15, 0.76, 0.78, 0.86],
    ],
    roof: [[-0.72, 0.62, 1.32, 1.39], [-0.25, 0.64, 1.34, 1.41], [0.18, 0.62, 1.33, 1.4]],
    headY: 0.62, headZ: 2.34, tailY: 0.78, tailZ: -2.42,
  },
  suv: {
    arches: true,
    body: [
      [-2.36, 0.8, 0.42, 0.66],
      [-2.24, 0.92, 0.34, 0.94],
      [-1.9, 0.97, 0.3, 1.0],
      [-1.46, 0.99, 0.3, 1.02],
      [-0.8, 0.98, 0.3, 1.0],
      [0.4, 0.98, 0.3, 1.0],
      [0.95, 0.99, 0.3, 1.02],
      [1.44, 0.98, 0.3, 0.98],
      [1.95, 0.92, 0.34, 0.86],
      [2.26, 0.84, 0.4, 0.72],
      [2.38, 0.72, 0.46, 0.62],
    ],
    cabin: [
      [-1.85, 0.74, 0.96, 1.06],
      [-1.6, 0.78, 0.98, 1.5],
      [-0.9, 0.76, 0.98, 1.58],
      [0.1, 0.74, 0.96, 1.59],
      [0.75, 0.78, 0.94, 1.34],
      [1.2, 0.82, 0.92, 1.02],
    ],
    roof: [[-1.5, 0.68, 1.54, 1.62], [-0.7, 0.7, 1.56, 1.64], [0.15, 0.68, 1.55, 1.62]],
    headY: 0.78, headZ: 2.3, tailY: 1.06, tailZ: -2.36,
  },
  van: {
    arches: true,
    body: [
      [-2.4, 0.8, 0.4, 0.7],
      [-2.3, 0.92, 0.32, 1.7],
      [-1.9, 0.96, 0.3, 1.92],
      [-1.46, 0.97, 0.3, 1.96],
      [-0.6, 0.97, 0.3, 1.98],
      [0.5, 0.97, 0.3, 1.96],
      [1.1, 0.95, 0.3, 1.86],
      [1.5, 0.92, 0.32, 1.5],
      [1.95, 0.88, 0.36, 1.0],
      [2.26, 0.8, 0.42, 0.76],
      [2.38, 0.68, 0.48, 0.64],
    ],
    cabin: null,
    roof: null,
    headY: 0.72, headZ: 2.3, tailY: 1.3, tailZ: -2.4,
  },
};

const wheelMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.35 });

function buildWheel() {
  const parts = [];
  const tireProfile = [
    [0.21, -0.125], [0.29, -0.13], [0.325, -0.1], [0.34, -0.045],
    [0.34, 0.045], [0.325, 0.1], [0.29, 0.13], [0.21, 0.125],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const tireGeo = new THREE.LatheGeometry(tireProfile, 20);
  tireGeo.rotateZ(Math.PI / 2);
  parts.push({ geometry: tireGeo, color: 0x111216 });
  const barrel = new THREE.CylinderGeometry(0.215, 0.215, 0.24, 16);
  barrel.rotateZ(Math.PI / 2);
  parts.push({ geometry: barrel, color: 0x565b64 });
  const disc = new THREE.CylinderGeometry(0.165, 0.165, 0.03, 14);
  disc.rotateZ(Math.PI / 2);
  parts.push({ geometry: disc, color: 0x33373d });
  const spokeGeo = new THREE.BoxGeometry(0.05, 0.3, 0.055);
  const faceGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.025, 16);
  faceGeo.rotateZ(Math.PI / 2);
  for (const side of [-1, 1]) {
    parts.push({ geometry: faceGeo, matrix: new THREE.Matrix4().makeTranslation(side * 0.115, 0, 0), color: 0xb8bcc6 });
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Matrix4().makeRotationX((i / 6) * Math.PI * 2);
      m.setPosition(side * 0.12, 0, 0);
      parts.push({ geometry: spokeGeo, matrix: m, color: 0x9aa0aa });
    }
  }
  const hub = new THREE.CylinderGeometry(0.055, 0.055, 0.27, 10);
  hub.rotateZ(Math.PI / 2);
  parts.push({ geometry: hub, color: 0x2a2e34 });
  const geo = mergeParts(parts);
  for (const p of parts) p.geometry.dispose();
  const mesh = new THREE.Mesh(geo, wheelMat);
  mesh.castShadow = true;
  return mesh;
}

function placed(geometry, x, y, z, color, rx = 0, ry = 0) {
  const m = new THREE.Matrix4();
  m.compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0, 'YXZ')),
    new THREE.Vector3(1, 1, 1),
  );
  return { geometry, matrix: m, color };
}

function paintTwoTone(geo, topY, paint) {
  const pos = geo.attributes.position;
  let col = geo.attributes.color;
  if (!col) {
    col = new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3);
    geo.setAttribute('color', col);
  }
  const base = new THREE.Color(paint);
  const black = new THREE.Color(0x14161c);
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    const y = pos.getY(i);
    const c = y > topY - 0.16 && (z > 1.15 || z < -1.6) ? black : base;
    col.setXYZ(i, c.r, c.g, c.b);
  }
  col.needsUpdate = true;
}

export function createVehicleMesh(opts = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const styleKey = opts.police ? 'sedan' : (opts.body ?? 'sports');
  const style = STYLES[styleKey] ?? STYLES.sedan;
  const isSports = styleKey === 'sports' && !opts.police;
  const paintColor = opts.paint ?? (opts.police ? 0xe8eaee : 0x2468e8);
  const trimColor = 0x101216;
  const bodyMat = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: opts.police ? 0.35 : 0.28,
    metalness: 0.45,
    clearcoat: 0.8,
    clearcoatRoughness: 0.18,
    envMapIntensity: 1.1,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x1a2836, roughness: 0.15, metalness: 0.4, envMapIntensity: 1.6,
    clearcoat: 1, clearcoatRoughness: 0.08,
  });

  const parts = [];
  const bodyGeo = loftGeometry(bodyStations(style));
  if (opts.police) paintTwoTone(bodyGeo, 0.88, 0xe8eaee);
  parts.push({ geometry: bodyGeo, color: opts.police ? null : paintColor });

  const flareGeo = new THREE.TorusGeometry(0.42, 0.055, 6, 14, Math.PI);
  flareGeo.rotateY(Math.PI / 2);
  for (const [x, z] of [[-0.92, WHEEL_Z], [0.92, WHEEL_Z], [-0.92, -WHEEL_Z - 0.02], [0.92, -WHEEL_Z - 0.02]]) {
    parts.push(placed(flareGeo, x * 1.02, CAR.wheelRadius, z, isSports ? paintColor : trimColor));
  }

  const skirtGeo = new THREE.BoxGeometry(0.1, 0.14, 2.5);
  for (const side of [-1, 1]) parts.push(placed(skirtGeo, side * 0.95, 0.24, 0, trimColor));
  const mirrorStalk = new THREE.BoxGeometry(0.16, 0.05, 0.06);
  const mirrorGeo = new THREE.BoxGeometry(0.09, 0.11, 0.17);
  const mirrorY = styleKey === 'van' ? 1.3 : styleKey === 'suv' ? 1.12 : styleKey === 'sedan' ? 0.98 : 0.88;
  for (const side of [-1, 1]) {
    parts.push(placed(mirrorStalk, side * 0.98, mirrorY, 0.72, trimColor));
    parts.push(placed(mirrorGeo, side * 1.08, mirrorY + 0.03, 0.72, paintColor));
  }
  const exhaustGeo = new THREE.CylinderGeometry(0.055, 0.06, 0.16, 10);
  exhaustGeo.rotateX(Math.PI / 2);
  if (isSports) {
    for (const side of [-1, 1]) {
      parts.push(placed(exhaustGeo, side * 0.42, 0.3, -2.32, 0x8a8f98));
      parts.push(placed(exhaustGeo, side * 0.56, 0.3, -2.32, 0x8a8f98));
    }
    parts.push(placed(new THREE.BoxGeometry(1.5, 0.16, 0.3), 0, 0.24, -2.2, trimColor));
    for (let i = -2; i <= 2; i++) parts.push(placed(new THREE.BoxGeometry(0.04, 0.14, 0.34), i * 0.28, 0.22, -2.2, 0x22252b));
    parts.push(placed(new THREE.BoxGeometry(1.78, 0.05, 0.34), 0, 0.2, 2.24, trimColor));
    const wingGeo = new THREE.BoxGeometry(1.72, 0.05, 0.36);
    parts.push(placed(wingGeo, 0, 1.06, -2.02, paintColor));
    for (const side of [-1, 1]) {
      parts.push(placed(new THREE.BoxGeometry(0.06, 0.24, 0.3), side * 0.62, 0.94, -2.02, trimColor));
      parts.push(placed(new THREE.BoxGeometry(0.03, 0.16, 0.4), side * 0.86, 1.08, -2.02, paintColor));
      parts.push(placed(new THREE.BoxGeometry(0.08, 0.16, 0.7), side * 0.94, 0.56, -0.85, trimColor));
    }
    parts.push(placed(new THREE.BoxGeometry(0.5, 0.16, 0.03), 0, 0.44, -2.32, 0xd8d4c8));
  } else {
    for (const side of [-1, 1]) parts.push(placed(exhaustGeo, side * 0.5, 0.3, -2.4, 0x6a6f78));
    parts.push(placed(new THREE.BoxGeometry(1.7, 0.14, 0.24), 0, 0.32, styleKey === 'van' ? -2.36 : -2.38, trimColor));
    parts.push(placed(new THREE.BoxGeometry(1.7, 0.12, 0.2), 0, 0.36, 2.36, trimColor));
    parts.push(placed(new THREE.BoxGeometry(0.44, 0.14, 0.03), 0, 0.5, -2.44, 0xd8d4c8));
  }
  if (styleKey === 'suv') {
    for (const side of [-1, 1]) parts.push(placed(new THREE.BoxGeometry(0.06, 0.05, 2.2), side * 0.6, 1.66, -0.6, trimColor));
  }
  if (styleKey === 'van') {
    const winMat = glass;
    const sideWin = new THREE.PlaneGeometry(2.6, 0.62);
    const wins = [];
    for (const side of [-1, 1]) wins.push(placed(sideWin, side * 0.965, 1.42, -0.5, 0xffffff, 0, side * Math.PI / 2));
    const wind = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.7), winMat);
    wind.position.set(0, 1.42, 1.62);
    wind.rotation.x = -0.42;
    body.add(wind);
    const rear = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.6), winMat);
    rear.position.set(0, 1.42, -2.32);
    rear.rotation.y = Math.PI;
    body.add(rear);
    body.add(new THREE.Mesh(mergeParts(wins), winMat));
    sideWin.dispose();
  }
  if (opts.taxi) {
    const signTex = canvasTexture(64, 32, (ctx, w, h) => {
      ctx.fillStyle = '#f8f4e8';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', w / 2, 23);
    });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.2), new THREE.MeshStandardMaterial({ map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.4 }));
    sign.position.set(0, 1.48, 0.1);
    body.add(sign);
  }
  if (opts.police) {
    parts.push(placed(new THREE.BoxGeometry(1.3, 0.1, 0.34), 0, 1.42, -0.2, trimColor));
    parts.push(placed(new THREE.BoxGeometry(1.5, 0.2, 0.1), 0, 0.44, 2.46, trimColor));
    for (const side of [-1, 1]) parts.push(placed(new THREE.BoxGeometry(0.08, 0.18, 0.08), side * 0.6, 0.5, 2.46, trimColor));
  }
  const hull = new THREE.Mesh(mergeParts(parts), bodyMat);
  hull.castShadow = true;
  body.add(hull);
  for (const p of parts) p.geometry.dispose();

  if (style.cabin) {
    const cabin = new THREE.Mesh(loftGeometry(cabinStations(style)), glass);
    cabin.castShadow = true;
    body.add(cabin);
    const roof = new THREE.Mesh(loftGeometry(style.roof.map(([z, w, y0, y1]) => ({ z, pts: ring(w, y0, y1) }))), new THREE.MeshPhysicalMaterial({
      color: opts.police ? 0x14161c : paintColor, roughness: 0.28, metalness: 0.45, clearcoat: 0.8, clearcoatRoughness: 0.18, envMapIntensity: 1.1,
    }));
    roof.castShadow = true;
    body.add(roof);
  }

  let sirenRedMat = null;
  let sirenBlueMat = null;
  let sirenGlowRedMat = null;
  let sirenGlowBlueMat = null;
  if (opts.police) {
    sirenRedMat = new THREE.MeshStandardMaterial({ color: 0x440000, emissive: 0xff2222, emissiveIntensity: 2 });
    sirenBlueMat = new THREE.MeshStandardMaterial({ color: 0x000844, emissive: 0x2255ff, emissiveIntensity: 2 });
    const lensGeo = new THREE.BoxGeometry(0.5, 0.14, 0.3);
    const lensRed = new THREE.Mesh(lensGeo, sirenRedMat);
    lensRed.position.set(-0.32, 1.52, -0.2);
    body.add(lensRed);
    const lensBlue = new THREE.Mesh(lensGeo, sirenBlueMat);
    lensBlue.position.set(0.32, 1.52, -0.2);
    body.add(lensBlue);
    const decalTex = canvasTexture(128, 64, (ctx, w, h) => {
      ctx.fillStyle = '#e8eaee';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#16203a';
      ctx.font = 'bold 30px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(POLICE_SHORT, w / 2, 34);
      ctx.fillStyle = '#16203a';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('PORT AZURA', w / 2, 50);
      ctx.fillStyle = '#c8a030';
      ctx.fillRect(6, 55, w - 12, 4);
    });
    const decalMat = new THREE.MeshStandardMaterial({ map: decalTex, roughness: 0.4 });
    const decalGeo = new THREE.PlaneGeometry(1.3, 0.55);
    const decalParts = [];
    for (const side of [-1, 1]) decalParts.push(placed(decalGeo, side * 0.945, 0.62, 0.05, 0xffffff, 0, side * Math.PI / 2));
    body.add(new THREE.Mesh(mergeParts(decalParts), decalMat));
    decalGeo.dispose();
    const glowGeo = new THREE.PlaneGeometry(3.0, 4.5);
    glowGeo.rotateX(-Math.PI / 2);
    const glowTex = radialTexture(128, 2.4);
    sirenGlowRedMat = new THREE.MeshBasicMaterial({ map: glowTex, color: 0xff2222, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    sirenGlowBlueMat = new THREE.MeshBasicMaterial({ map: glowTex, color: 0x2255ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const glowRed = new THREE.Mesh(glowGeo, sirenGlowRedMat);
    glowRed.position.set(-1.9, 0.06, 0);
    root.add(glowRed);
    const glowBlue = new THREE.Mesh(glowGeo, sirenGlowBlueMat);
    glowBlue.position.set(1.9, 0.06, 0);
    root.add(glowBlue);
  }

  const lightsOn = opts.lightsOn !== false;
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff7e0, emissive: 0xfff2cc, emissiveIntensity: lightsOn ? 1.1 : 0.06 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff2211, emissiveIntensity: lightsOn ? 1.5 : 0.08 });
  const reverseMat = new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0xffffff, emissiveIntensity: 0 });
  const headParts = [];
  const headLens = isSports ? new THREE.BoxGeometry(0.4, 0.08, 0.06) : new THREE.BoxGeometry(0.36, 0.13, 0.06);
  for (const side of [-1, 1]) {
    headParts.push(placed(headLens, side * 0.6, style.headY, style.headZ, 0xffffff));
    if (isSports) headParts.push(placed(new THREE.BoxGeometry(0.34, 0.025, 0.05), side * 0.62, style.headY - 0.07, style.headZ, 0xffffff));
  }
  body.add(new THREE.Mesh(mergeParts(headParts), headMat));
  headLens.dispose();
  const tailParts = [];
  if (isSports) {
    tailParts.push(placed(new THREE.BoxGeometry(1.62, 0.07, 0.05), 0, style.tailY, style.tailZ, 0xffffff));
    for (const side of [-1, 1]) tailParts.push(placed(new THREE.BoxGeometry(0.42, 0.1, 0.05), side * 0.58, style.tailY, style.tailZ - 0.005, 0xffffff));
  } else if (styleKey === 'van') {
    for (const side of [-1, 1]) tailParts.push(placed(new THREE.BoxGeometry(0.1, 0.5, 0.05), side * 0.82, style.tailY, style.tailZ, 0xffffff));
  } else {
    for (const side of [-1, 1]) tailParts.push(placed(new THREE.BoxGeometry(0.44, 0.12, 0.05), side * 0.6, style.tailY, style.tailZ, 0xffffff));
  }
  body.add(new THREE.Mesh(mergeParts(tailParts), tailMat));
  const revParts = [];
  const revGeo = new THREE.BoxGeometry(0.16, 0.06, 0.05);
  for (const side of [-1, 1]) revParts.push(placed(revGeo, side * 0.32, style.tailY - 0.12, style.tailZ, 0xffffff));
  body.add(new THREE.Mesh(mergeParts(revParts), reverseMat));
  revGeo.dispose();

  const wheels = [];
  const steerGroups = [];
  for (const [x, z, front] of [[-0.92, WHEEL_Z, true], [0.92, WHEEL_Z, true], [-0.92, -WHEEL_Z - 0.02, false], [0.92, -WHEEL_Z - 0.02, false]]) {
    const steer = new THREE.Group();
    steer.position.set(x, CAR.wheelRadius, z);
    const wheel = buildWheel();
    steer.add(wheel);
    root.add(steer);
    wheels.push(wheel);
    steerGroups.push(front ? steer : null);
  }

  const beamMat = new THREE.MeshBasicMaterial({ map: beamTexture(), color: 0xffd9a0, transparent: true, opacity: lightsOn ? 0.05 : 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const beamGeo = new THREE.PlaneGeometry(2.4, 9);
  beamGeo.rotateX(-Math.PI / 2);
  const beamParts = [];
  for (const side of [-1, 1]) beamParts.push(placed(beamGeo, side * 0.6, 0.06, 6.6, 0xffffff));
  root.add(new THREE.Mesh(mergeParts(beamParts), beamMat));
  beamGeo.dispose();
  const tailGlowMat = new THREE.MeshBasicMaterial({ map: radialTexture(128, 2.4), color: 0xff2211, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const tailGlowGeo = new THREE.PlaneGeometry(2.4, 1.8);
  tailGlowGeo.rotateX(-Math.PI / 2);
  const tailGlow = new THREE.Mesh(tailGlowGeo, tailGlowMat);
  tailGlow.position.set(0, 0.06, -3.1);
  root.add(tailGlow);

  const shadowGeo = new THREE.PlaneGeometry(4.2, 6.2);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadow = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial({ map: radialTexture(128, 2.8), color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false }));
  shadow.position.y = 0.045;
  root.add(shadow);

  const headlights = [];
  if (opts.spotlights !== false) {
    for (const side of [-1, 1]) {
      const spot = new THREE.SpotLight(0xffd9a0, 60, 55, 0.42, 0.5, 1.4);
      spot.position.set(side * 0.6, style.headY + 0.05, style.headZ);
      const target = new THREE.Object3D();
      target.position.set(side * 0.9, 0, 22);
      root.add(target);
      spot.target = target;
      root.add(spot);
      headlights.push(spot);
    }
  }

  return {
    root, body, wheels, steerGroups, headMat, tailMat, reverseMat, tailGlowMat, beamMat, headlights,
    sirenRedMat, sirenBlueMat, sirenGlowRedMat, sirenGlowBlueMat,
    lightsOn,
    name: opts.name ?? PLAYER_CAR_NAME,
  };
}

export class Vehicle {
  constructor(mesh, spawn) {
    this.mesh = mesh;
    this.x = spawn.x;
    this.z = spawn.z;
    this.heading = spawn.heading;
    this.vx = 0;
    this.vz = 0;
    this.steer = 0;
    this.speed = 0;
    this.forwardSpeed = 0;
    this.slip = 0;
    this.braking = false;
    this.reversing = false;
    this.impact = 0;
    this.gear = 'N';
    this.rpm = 0.15;
    this.wheelSpin = 0;
    this.pitch = 0;
    this.roll = 0;
  }

  reset(spawn) {
    this.x = spawn.x;
    this.z = spawn.z;
    this.heading = spawn.heading;
    this.vx = 0;
    this.vz = 0;
    this.speed = 0;
    this.impact = 0;
  }

  step(dt, input, colliders) {
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    const rx = Math.cos(this.heading);
    const rz = -Math.sin(this.heading);
    let vF = this.vx * fx + this.vz * fz;
    let vL = this.vx * rx + this.vz * rz;

    const throttle = input.throttle();
    const handbrake = input.handbrake();
    this.braking = false;
    this.reversing = vF < -0.5;

    if (throttle > 0) {
      if (vF < -0.5) {
        vF += CAR.brake * dt;
        this.braking = true;
      } else {
        vF += CAR.accel * (1 - clamp(vF / CAR.maxSpeed, 0, 1) * 0.85) * dt;
      }
    } else if (throttle < 0) {
      if (vF > 0.5) {
        vF -= CAR.brake * dt;
        this.braking = true;
      } else {
        vF -= CAR.reverseAccel * (1 - clamp(-vF / CAR.maxReverse, 0, 1)) * dt;
      }
    }
    if (handbrake) {
      vF -= Math.sign(vF) * Math.min(Math.abs(vF), CAR.brake * 0.55 * dt);
      this.braking = Math.abs(vF) > 1;
    }

    vF -= vF * Math.abs(vF) * CAR.drag * dt;
    vF -= Math.sign(vF) * Math.min(Math.abs(vF), CAR.rolling * dt);
    vF = clamp(vF, -CAR.maxReverse, CAR.maxSpeed);

    const steerInput = input.steer();
    const steerTarget = steerInput * CAR.steerMax / (1 + Math.abs(vF) * CAR.steerSpeedFalloff);
    this.steer = damp(this.steer, steerTarget, CAR.steerLerp, dt);

    let grip = CAR.grip;
    if (handbrake) grip = CAR.gripHandbrake;
    else if (Math.abs(steerInput) > 0.5 && Math.abs(vF) > 22) grip = CAR.gripSlide;
    vL *= Math.exp(-grip * dt);
    if (handbrake && Math.abs(vF) > 8) vL += this.steer * Math.abs(vF) * 0.32 * dt;

    const yaw = (vF / CAR.wheelbase) * Math.tan(this.steer) * (handbrake ? 1.35 : 1);
    this.heading += clamp(yaw, -CAR.maxYawRate, CAR.maxYawRate) * dt;

    const fx2 = Math.sin(this.heading);
    const fz2 = Math.cos(this.heading);
    const rx2 = Math.cos(this.heading);
    const rz2 = -Math.sin(this.heading);
    this.vx = fx2 * vF + rx2 * vL;
    this.vz = fz2 * vF + rz2 * vL;
    this.x += this.vx * dt;
    this.z += this.vz * dt;

    this.impact = Math.max(0, this.impact - dt * 3);
    this.resolveCollisions(colliders);
    this.resolveBounds();

    this.forwardSpeed = vF;
    this.speed = Math.hypot(this.vx, this.vz);
    this.slip = Math.abs(vL);
    this.wheelSpin += (vF / CAR.wheelRadius) * dt;

    const accelFeel = throttle > 0 ? -0.028 : this.braking ? 0.04 : 0;
    this.pitch = damp(this.pitch, accelFeel * clamp(Math.abs(vF) / 20, 0, 1), 5, dt);
    this.roll = damp(this.roll, clamp(-yaw * vF * 0.006, -0.07, 0.07), 6, dt);

    const kmh = Math.abs(vF) * 3.6;
    if (vF < -0.5) this.gear = 'R';
    else if (kmh < 1) this.gear = 'N';
    else this.gear = String(clamp(1 + Math.floor(kmh / 34), 1, 6));
    const gearBand = this.gear === 'R' ? kmh / 45 : (kmh % 34) / 34;
    this.rpm = damp(this.rpm, clamp(0.18 + gearBand * 0.75 + (throttle > 0 ? 0.08 : 0), 0.1, 1), 8, dt);

    this.syncMesh(dt);
  }

  resolveCollisions(colliders) {
    const r = CAR.radius;
    for (const b of colliders) {
      if (this.x < b.minX - r || this.x > b.maxX + r || this.z < b.minZ - r || this.z > b.maxZ + r) continue;
      const cx = clamp(this.x, b.minX, b.maxX);
      const cz = clamp(this.z, b.minZ, b.maxZ);
      let dx = this.x - cx;
      let dz = this.z - cz;
      let dist = Math.hypot(dx, dz);
      if (dist >= r) continue;
      if (dist < 0.0001) {
        const left = this.x - b.minX;
        const right = b.maxX - this.x;
        const top = this.z - b.minZ;
        const bottom = b.maxZ - this.z;
        const m = Math.min(left, right, top, bottom);
        dx = m === left ? -1 : m === right ? 1 : 0;
        dz = m === top ? -1 : m === bottom ? 1 : 0;
        dist = 0;
      } else {
        dx /= dist;
        dz /= dist;
      }
      const push = r - dist;
      this.x += dx * push;
      this.z += dz * push;
      const vn = this.vx * dx + this.vz * dz;
      if (vn < 0) {
        this.vx -= (1 + CAR.restitution) * vn * dx;
        this.vz -= (1 + CAR.restitution) * vn * dz;
        this.vx *= 0.82;
        this.vz *= 0.82;
        const hit = Math.abs(vn);
        if (hit > 3) this.impact = Math.min(1, this.impact + hit / 22);
      }
    }
  }

  resolveBounds() {
    const onPier = this.z > WORLD.pierMinZ && this.z < WORLD.pierMaxZ;
    const minX = onPier ? WORLD.pierMinX + 2 : WORLD.coastX + 3;
    if (this.x < minX) {
      this.x = minX;
      if (this.vx < 0) this.vx *= -0.3;
    }
    if (this.x > WORLD.half - 12) {
      this.x = WORLD.half - 12;
      if (this.vx > 0) this.vx *= -0.3;
    }
    if (this.z < -WORLD.half + 8) {
      this.z = -WORLD.half + 8;
      if (this.vz < 0) this.vz *= -0.3;
    }
    if (this.z > WORLD.half - 8) {
      this.z = WORLD.half - 8;
      if (this.vz > 0) this.vz *= -0.3;
    }
  }

  syncMesh(dt) {
    const m = this.mesh;
    const y = this.groundY();
    m.root.position.set(this.x, y, this.z);
    m.root.rotation.y = this.heading;
    m.body.rotation.x = this.pitch;
    m.body.rotation.z = this.roll;
    for (const w of m.wheels) w.rotation.x = this.wheelSpin;
    for (const s of m.steerGroups) if (s) s.rotation.y = this.steer * 0.8;
    m.tailMat.emissiveIntensity = this.braking ? 3.8 : m.lightsOn ? 1.5 : 0.08;
    m.tailGlowMat.opacity = this.braking ? 0.26 : m.lightsOn ? 0.09 : 0;
    m.headMat.emissiveIntensity = m.lightsOn ? 1.1 : 0.06;
    m.beamMat.opacity = m.lightsOn ? 0.05 : 0;
    m.reverseMat.emissiveIntensity = this.reversing ? 1.6 : 0;
  }

  groundY() {
    return heightAt(this.x, this.z);
  }
}
