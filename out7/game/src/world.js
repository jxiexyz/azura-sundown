import THREE from 'three';
import { WORLD } from './config.js';
import { mulberry32, clamp, smoothstep, mergeParts, mat4, canvasTexture, radialTexture, asphaltMaps, loftGeometry } from './utils.js';

export function heightAt(x, z) {
  if (x < WORLD.coastX + 2 && x > WORLD.pierMinX && z > WORLD.pierMinZ && z < WORLD.pierMaxZ) return 0.6;
  const t = smoothstep(WORLD.hillStartX, WORLD.hillFullX, x);
  if (t <= 0) return 0;
  return t * (WORLD.hillHeight + Math.sin(z * 0.012) * 4 + Math.sin(z * 0.031 + 1.7) * 2.5);
}

const ROAD_DEFS = [
  { axis: 'z', at: -330, from: -620, to: 620, w: 24, name: 'Crescent Highway' },
  { axis: 'x', at: -320, from: -330, to: 500, w: 16, name: 'North Loop' },
  { axis: 'x', at: -120, from: -330, to: 500, w: 16, name: 'Meridian Avenue' },
  { axis: 'x', at: 80, from: -330, to: 500, w: 16, name: 'Palms Boulevard' },
  { axis: 'x', at: 280, from: -545, to: 500, w: 16, name: 'Harborline Way' },
  { axis: 'x', at: 460, from: -330, to: 500, w: 16, name: 'Southgate Road' },
  { axis: 'z', at: -210, from: -420, to: 460, w: 14, name: 'Dock Street' },
  { axis: 'z', at: -90, from: -420, to: 460, w: 14, name: '3rd Street' },
  { axis: 'z', at: 30, from: -420, to: 460, w: 14, name: '5th Street' },
  { axis: 'z', at: 150, from: -420, to: 460, w: 14, name: '7th Street' },
  { axis: 'z', at: 270, from: -420, to: 460, w: 14, name: 'Ridge Approach' },
  { axis: 'z', at: 470, from: -120, to: 280, w: 12, name: 'Vista Ridge Road' },
];

function roadStripGeometry(road, offset, width, yLift) {
  const along = road.to - road.from;
  const steps = Math.max(2, Math.ceil(along / 8));
  const pos = [];
  const nor = [];
  const uvs = [];
  const idx = [];
  for (let i = 0; i <= steps; i++) {
    const s = road.from + (along * i) / steps;
    const x = road.axis === 'z' ? road.at + offset : s;
    const z = road.axis === 'z' ? s : road.at + offset;
    const y = heightAt(x, z) + yLift;
    const hx = road.axis === 'z' ? width / 2 : 0;
    const hz = road.axis === 'z' ? 0 : width / 2;
    pos.push(x - hx, y, z - hz, x + hx, y, z + hz);
    nor.push(0, 1, 0, 0, 1, 0);
    const lat = road.axis === 'z' ? x : z;
    uvs.push((lat - width / 2) / 8, s / 8, (lat + width / 2) / 8, s / 8);
    if (i < steps) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  return g;
}

function crosses(road, s) {
  for (const other of ROAD_DEFS) {
    if (other.axis === road.axis) continue;
    if (other.at < road.from || other.at > road.to) continue;
    if (road.at < other.from || road.at > other.to) continue;
    if (Math.abs(s - other.at) < other.w / 2 + 5) return true;
  }
  return false;
}

function intersections() {
  const out = [];
  for (const a of ROAD_DEFS) {
    for (const b of ROAD_DEFS) {
      if (a.axis === b.axis || a.axis !== 'z') continue;
      if (b.at < a.from || b.at > a.to) continue;
      if (a.at < b.from || a.at > b.to) continue;
      out.push({ x: a.at, z: b.at, wa: a.w, wb: b.w });
    }
  }
  return out;
}

function facadeTexture(rand, kind, rows) {
  return canvasTexture(256, 512, (ctx, w, h) => {
    const cols = 8;
    const rowH = h / rows;
    if (kind === 'glass') {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#2a3a4c');
      g.addColorStop(0.5, '#1c2a3a');
      g.addColorStop(1, '#243444');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const lit = rand() < 0.34;
          ctx.fillStyle = lit ? (rand() < 0.72 ? '#ffb45e' : '#a8d8ff') : `rgba(30,44,60,${(0.5 + rand() * 0.4).toFixed(2)})`;
          ctx.fillRect(c * 32 + 3, r * rowH + 3, 26, rowH - 6);
          ctx.fillStyle = 'rgba(120,160,190,0.16)';
          ctx.fillRect(c * 32 + 3, r * rowH + 3, 26, 3);
        }
        ctx.fillStyle = '#101820';
        ctx.fillRect(0, r * rowH, w, 2);
      }
      ctx.fillStyle = '#0c1218';
      for (let c = 0; c <= cols; c++) ctx.fillRect(c * 32 - 1, 0, 3, h);
    } else if (kind === 'concrete') {
      ctx.fillStyle = '#6a6660';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 300; i++) {
        ctx.fillStyle = `rgba(${40 + rand() * 40 | 0},${38 + rand() * 36 | 0},${34 + rand() * 30 | 0},0.12)`;
        ctx.fillRect(rand() * w, rand() * h, 6 + rand() * 14, 4 + rand() * 10);
      }
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const lit = rand() < 0.4;
          ctx.fillStyle = '#3a3833';
          ctx.fillRect(c * 32 + 5, r * rowH + 5, 22, rowH - 12);
          ctx.fillStyle = lit ? (rand() < 0.75 ? '#ffb45e' : '#a8d8ff') : '#1e2530';
          ctx.fillRect(c * 32 + 7, r * rowH + 7, 18, rowH - 16);
          ctx.fillStyle = '#57534c';
          ctx.fillRect(c * 32 + 3, r * rowH + rowH - 7, 26, 4);
          ctx.fillStyle = 'rgba(20,18,16,0.5)';
          ctx.fillRect(c * 32 + 3, r * rowH + rowH - 3, 26, 2);
        }
        ctx.fillStyle = 'rgba(30,28,24,0.55)';
        ctx.fillRect(0, r * rowH, w, 2);
      }
    } else if (kind === 'brick') {
      ctx.fillStyle = '#6a4a3c';
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 6) {
        for (let x = (y / 6) % 2 ? 0 : 8; x < w; x += 16) {
          ctx.fillStyle = `rgba(${90 + rand() * 40 | 0},${58 + rand() * 26 | 0},${44 + rand() * 20 | 0},0.5)`;
          ctx.fillRect(x, y, 14, 4);
        }
      }
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.fillStyle = '#2a2420';
          ctx.fillRect(c * 32 + 6, r * rowH + 6, 20, rowH - 14);
          const lit = rand() < 0.36;
          ctx.fillStyle = lit ? '#ffb45e' : '#1c222c';
          ctx.fillRect(c * 32 + 8, r * rowH + 8, 16, rowH - 18);
          ctx.fillStyle = '#8a8478';
          ctx.fillRect(c * 32 + 4, r * rowH + rowH - 8, 24, 3);
        }
      }
      ctx.fillStyle = '#141a22';
      ctx.fillRect(0, h - rowH * 0.9, w, rowH * 0.9);
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = rand() < 0.6 ? '#ffd9a0' : '#2a3440';
        ctx.fillRect(c * 32 + 4, h - rowH * 0.75, 24, rowH * 0.6);
        ctx.fillStyle = ['#a03028', '#2a6a8a', '#3a7a4a', '#c08030'][Math.floor(rand() * 4)];
        ctx.fillRect(c * 32 + 2, h - rowH * 0.95, 28, 6);
      }
    } else if (kind === 'stucco') {
      ctx.fillStyle = '#b8a890';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 240; i++) {
        ctx.fillStyle = `rgba(90,80,66,${(rand() * 0.1).toFixed(2)})`;
        ctx.fillRect(rand() * w, rand() * h, 8 + rand() * 16, 6 + rand() * 12);
      }
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.fillStyle = '#4a4238';
          ctx.fillRect(c * 32 + 7, r * rowH + 6, 18, rowH - 14);
          const lit = rand() < 0.34;
          ctx.fillStyle = lit ? '#ffc070' : '#202832';
          ctx.fillRect(c * 32 + 9, r * rowH + 8, 14, rowH - 18);
          if (r > 0 && rand() < 0.6) {
            ctx.fillStyle = '#8a8072';
            ctx.fillRect(c * 32 + 3, r * rowH + rowH - 9, 26, 4);
            ctx.fillStyle = 'rgba(40,36,30,0.7)';
            for (let k = 0; k < 6; k++) ctx.fillRect(c * 32 + 5 + k * 4, r * rowH + rowH - 15, 1.5, 6);
          }
        }
      }
      ctx.fillStyle = '#141a22';
      ctx.fillRect(0, h - rowH * 0.9, w, rowH * 0.9);
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = rand() < 0.6 ? '#ffd9a0' : '#2a3440';
        ctx.fillRect(c * 32 + 4, h - rowH * 0.75, 24, rowH * 0.6);
      }
    } else if (kind === 'warehouse') {
      ctx.fillStyle = '#7a828a';
      ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 8) {
        ctx.fillStyle = x % 16 ? 'rgba(255,255,255,0.08)' : 'rgba(20,24,28,0.18)';
        ctx.fillRect(x, 0, 4, h);
      }
      ctx.fillStyle = 'rgba(60,50,40,0.25)';
      for (let i = 0; i < 40; i++) ctx.fillRect(rand() * w, h * 0.6 + rand() * h * 0.4, 10 + rand() * 20, 4 + rand() * 14);
      for (let c = 0; c < 4; c++) {
        ctx.fillStyle = '#3a4048';
        ctx.fillRect(c * 64 + 12, h * 0.45, 40, h * 0.55);
        ctx.fillStyle = '#2a3038';
        for (let y = h * 0.45; y < h; y += 10) ctx.fillRect(c * 64 + 12, y, 40, 3);
        ctx.fillStyle = '#c8c040';
        ctx.fillRect(c * 64 + 10, h * 0.45 - 6, 44, 4);
      }
      for (let c = 0; c < 8; c++) {
        ctx.fillStyle = rand() < 0.4 ? '#ffd9a0' : '#1c242c';
        ctx.fillRect(c * 32 + 8, h * 0.16, 16, 14);
      }
    } else {
      ctx.fillStyle = '#c8b898';
      ctx.fillRect(0, 0, w, h);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.fillStyle = '#3a342c';
          ctx.fillRect(c * 32 + 8, r * rowH + 8, 16, rowH - 18);
          ctx.fillStyle = rand() < 0.4 ? '#ffc070' : '#202832';
          ctx.fillRect(c * 32 + 10, r * rowH + 10, 12, rowH - 22);
        }
      }
      ctx.fillStyle = '#4a3a2c';
      ctx.fillRect(w / 2 - 12, h - 40, 24, 40);
    }
  });
}

function signTexture(text, neon) {
  return canvasTexture(256, 64, (ctx, w, h) => {
    ctx.fillStyle = '#0a0d16';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = neon;
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.fillStyle = neon;
    ctx.font = 'bold 30px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 2);
  });
}

function roadSignTexture(lines) {
  return canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#1a5a34';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#e8ece8';
    ctx.lineWidth = 5;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = '#f0f4f0';
    ctx.font = 'bold 30px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, 20, 38 + i * 52));
  });
}

function roofGeometry() {
  const w = 1;
  const d = 1;
  const h = 0.55;
  const v = [
    [-w / 2, 0, -d / 2], [w / 2, 0, -d / 2], [0, h, -d / 2],
    [-w / 2, 0, d / 2], [w / 2, 0, d / 2], [0, h, d / 2],
  ];
  const faces = [
    [0, 3, 5], [0, 5, 2],
    [1, 2, 5], [1, 5, 4],
    [0, 2, 1], [3, 4, 5],
    [0, 1, 4], [0, 4, 3],
  ];
  const pos = [];
  for (const f of faces) for (const i of f) pos.push(...v[i]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

function frondTexture() {
  return canvasTexture(128, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#3a6a2c';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.stroke();
    for (let y = 6; y < h; y += 9) {
      const len = (w / 2 - 6) * (1 - Math.pow(y / h, 2.2) * 0.85);
      ctx.strokeStyle = y % 18 ? '#2e6b34' : '#357a3c';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(w / 2, y);
      ctx.lineTo(w / 2 - len, y + 14);
      ctx.moveTo(w / 2, y);
      ctx.lineTo(w / 2 + len, y + 14);
      ctx.stroke();
    }
  });
}

function palmGeometry() {
  const parts = [];
  const trunkProfile = [
    [0.24, 0], [0.21, 0.7], [0.185, 1.5], [0.16, 2.5], [0.14, 3.6], [0.12, 4.7], [0.105, 5.5],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const trunk = new THREE.LatheGeometry(trunkProfile, 8);
  parts.push({ geometry: trunk, matrix: mat4(0, 0, 0), color: 0x6b4a30 });
  const frond = new THREE.PlaneGeometry(0.85, 3.4, 1, 5);
  const fp = frond.attributes.position;
  for (let i = 0; i < fp.count; i++) {
    const y = fp.getY(i);
    const t = clamp((y + 1.7) / 3.4, 0, 1);
    fp.setZ(i, -Math.pow(t, 1.8) * 1.5);
    fp.setX(i, fp.getX(i) * (1 - t * 0.35));
  }
  frond.computeVertexNormals();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const m = new THREE.Matrix4();
    m.compose(
      new THREE.Vector3(Math.sin(a) * 0.9, 5.6, Math.cos(a) * 0.9),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.35 - (i % 3) * 0.22, a, 0, 'YXZ')),
      new THREE.Vector3(1, 1, 1),
    );
    parts.push({ geometry: frond, matrix: m, color: 0xffffff });
  }
  const crown = new THREE.SphereGeometry(0.22, 6, 5);
  parts.push({ geometry: crown, matrix: mat4(0, 5.55, 0), color: 0x4a3a20 });
  trunk.dispose();
  frond.dispose();
  crown.dispose();
  return mergeParts(parts);
}

function treeGeometry() {
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.16, 0.26, 2.6, 6);
  parts.push({ geometry: trunk, matrix: mat4(0, 1.3, 0), color: 0x4a3626 });
  const blob = new THREE.IcosahedronGeometry(1.5, 1);
  const spots = [[0, 3.6, 0, 1.25], [0.9, 3.1, 0.4, 0.9], [-0.8, 3.2, -0.3, 0.95], [0.2, 4.3, -0.5, 0.8], [-0.3, 3.0, 0.8, 0.85]];
  spots.forEach(([x, y, z, s], i) => {
    parts.push({ geometry: blob, matrix: mat4(x, y, z, i, s, s * 0.85, s), color: i % 2 ? 0x2e5a2c : 0x3a6a34 });
  });
  trunk.dispose();
  blob.dispose();
  return mergeParts(parts);
}

function streetlightGeometry() {
  const pole = new THREE.CylinderGeometry(0.09, 0.15, 7.4, 6);
  const arm = new THREE.TorusGeometry(1.7, 0.07, 5, 10, Math.PI / 2);
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(1.7, 7.35, 0),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)),
    new THREE.Vector3(1, 1, 1),
  );
  const head = new THREE.BoxGeometry(0.5, 0.14, 0.3);
  const g = mergeParts([
    { geometry: pole, matrix: mat4(0, 3.7, 0), color: 0x2c313a },
    { geometry: arm, matrix: m, color: 0x2c313a },
    { geometry: head, matrix: mat4(3.3, 7.3, 0), color: 0x2c313a },
  ]);
  pole.dispose(); arm.dispose(); head.dispose();
  return g;
}

function containerTexture() {
  return canvasTexture(128, 64, (ctx, w, h) => {
    ctx.fillStyle = '#c8c8c8';
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 8) {
      ctx.fillStyle = x % 16 ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.22)';
      ctx.fillRect(x, 0, 4, h);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, 0, w, 3);
    ctx.fillRect(0, h - 3, w, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('AZURA', 10, 22);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(w - 10, 4, 2, h - 8);
    ctx.fillRect(w - 18, 4, 2, h - 8);
  });
}

function hullRing(w, y0, y1) {
  const half = [
    [0, y0], [w * 0.7, y0], [w * 0.94, y0 + (y1 - y0) * 0.18], [w, y0 + (y1 - y0) * 0.5],
    [w, y1], [0, y1],
  ];
  const pts = half.slice();
  for (let i = half.length - 2; i >= 1; i--) pts.push([-half[i][0], half[i][1]]);
  return pts;
}

function buildShip(rand, palette, containerGeo, containerMat) {
  const ship = new THREE.Group();
  const stations = [
    [-82, 2, -3, 10], [-74, 8, -3.4, 11], [-60, 12, -3.6, 11.6], [-30, 13.6, -3.6, 12],
    [10, 14, -3.6, 12], [45, 14, -3.6, 12], [68, 13.4, -3.4, 12], [76, 12, -3, 12],
  ].map(([z, w, y0, y1]) => ({ z, pts: hullRing(w, y0, y1) }));
  const hullGeo = loftGeometry(stations);
  const pos = hullGeo.attributes.position;
  const col = new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3);
  const navy = new THREE.Color(0x26364e);
  const red = new THREE.Color(0x8a2a1c);
  for (let i = 0; i < pos.count; i++) {
    const c = pos.getY(i) < 1.4 ? red : navy;
    col.setXYZ(i, c.r, c.g, c.b);
  }
  hullGeo.setAttribute('color', col);
  const hull = new THREE.Mesh(hullGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.3 }));
  hull.castShadow = true;
  ship.add(hull);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(26, 0.6, 148), new THREE.MeshStandardMaterial({ color: 0x3a4a3a, roughness: 0.8 }));
  deck.position.set(0, 12, -4);
  ship.add(deck);
  const bridgeTex = canvasTexture(128, 64, (ctx, w, h) => {
    ctx.fillStyle = '#d8d4c8';
    ctx.fillRect(0, 0, w, h);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 10; c++) {
        ctx.fillStyle = r === 3 ? '#1a2a3a' : (rand() < 0.4 ? '#ffd9a0' : '#2a3440');
        ctx.fillRect(c * 12.8 + 3, r * 16 + 4, 9, 8);
      }
    }
  });
  const bridgeMat = new THREE.MeshStandardMaterial({ map: bridgeTex, emissive: 0xffffff, emissiveMap: bridgeTex, emissiveIntensity: 0.4, roughness: 0.7 });
  const superstructure = new THREE.Mesh(new THREE.BoxGeometry(24, 16, 12), bridgeMat);
  superstructure.position.set(0, 20, 62);
  superstructure.castShadow = true;
  ship.add(superstructure);
  const bridgeTop = new THREE.Mesh(new THREE.BoxGeometry(26, 3, 13), new THREE.MeshStandardMaterial({ color: 0xe8e4d8, roughness: 0.7 }));
  bridgeTop.position.set(0, 29.5, 62);
  ship.add(bridgeTop);
  const funnel = new THREE.Mesh(new THREE.BoxGeometry(6, 8, 5), new THREE.MeshStandardMaterial({ color: 0xd9662a, roughness: 0.7 }));
  funnel.position.set(0, 34, 66);
  ship.add(funnel);
  const funnelBand = new THREE.Mesh(new THREE.BoxGeometry(6.2, 2, 5.2), new THREE.MeshStandardMaterial({ color: 0x1c2430, roughness: 0.7 }));
  funnelBand.position.set(0, 36.5, 66);
  ship.add(funnelBand);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 12, 6), new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.7 }));
  mast.position.set(0, 36, 58);
  ship.add(mast);
  const deckBoxes = [];
  for (let dz = -66; dz < 50; dz += 13) {
    for (const dx of [-8.5, 0, 8.5]) {
      const stack = 1 + Math.floor(rand() * 3);
      for (let k = 0; k < stack; k++) deckBoxes.push({ x: dx, y: 12.4 + k * 2.62, z: dz, tint: palette[Math.floor(rand() * palette.length)] });
    }
  }
  const deckMesh = new THREE.InstancedMesh(containerGeo, containerMat, deckBoxes.length);
  const cc = new THREE.Color();
  deckBoxes.forEach((b, i) => {
    deckMesh.setMatrixAt(i, mat4(b.x, b.y, b.z, Math.PI / 2));
    deckMesh.setColorAt(i, cc.set(b.tint));
  });
  deckMesh.castShadow = true;
  ship.add(deckMesh);
  return ship;
}

function craneGeometry(z) {
  const parts = [];
  const orange = 0xc8501e;
  const dark = 0x39404a;
  const leg = new THREE.BoxGeometry(1.4, 28, 1.4);
  const brace = new THREE.BoxGeometry(0.5, 12, 0.5);
  for (const dx of [-8, 8]) {
    for (const dz of [-6.5, 6.5]) {
      parts.push({ geometry: leg, matrix: mat4(-505 + dx, 14.6, z + dz), color: orange });
    }
    parts.push({ geometry: brace, matrix: mat4(-505 + dx, 12, z, Math.PI / 5), color: orange });
    parts.push({ geometry: new THREE.BoxGeometry(1.2, 1.2, 14), matrix: mat4(-505 + dx, 28.4, z), color: orange });
  }
  parts.push({ geometry: new THREE.BoxGeometry(18, 2.4, 2.4), matrix: mat4(-505, 29.6, z - 6.5), color: orange });
  parts.push({ geometry: new THREE.BoxGeometry(18, 2.4, 2.4), matrix: mat4(-505, 29.6, z + 6.5), color: orange });
  const boomChord = new THREE.BoxGeometry(62, 1.1, 1.1);
  parts.push({ geometry: boomChord, matrix: mat4(-524, 32.4, z - 1.6), color: orange });
  parts.push({ geometry: boomChord, matrix: mat4(-524, 32.4, z + 1.6), color: orange });
  parts.push({ geometry: boomChord, matrix: mat4(-524, 30.2, z - 1.6), color: orange });
  parts.push({ geometry: boomChord, matrix: mat4(-524, 30.2, z + 1.6), color: orange });
  const diag = new THREE.BoxGeometry(0.35, 3.4, 0.35);
  for (let x = -552; x < -494; x += 4) {
    parts.push({ geometry: diag, matrix: mat4(x, 31.3, z - 1.6), color: orange });
    parts.push({ geometry: diag, matrix: mat4(x + 2, 31.3, z + 1.6), color: orange });
  }
  parts.push({ geometry: new THREE.BoxGeometry(1.1, 1.1, 4.4), matrix: mat4(-524, 31.3, z), color: orange });
  parts.push({ geometry: new THREE.BoxGeometry(8, 5, 6), matrix: mat4(-496, 33, z), color: 0xd8d4c8 });
  parts.push({ geometry: new THREE.BoxGeometry(3, 2.6, 3), matrix: mat4(-500, 28.6, z), color: 0x2a3440 });
  parts.push({ geometry: new THREE.BoxGeometry(1.6, 8, 1.6), matrix: mat4(-505, 37, z), color: orange });
  parts.push({ geometry: new THREE.BoxGeometry(30, 0.8, 0.8), matrix: mat4(-520, 40.6, z), color: dark });
  const tie = new THREE.BoxGeometry(0.25, 12, 0.25);
  parts.push({ geometry: tie, matrix: mat4(-540, 36, z, 0.5), color: dark });
  parts.push({ geometry: tie, matrix: mat4(-498, 36, z, -0.5), color: dark });
  const g = mergeParts(parts);
  for (const p of parts) p.geometry.dispose();
  return g;
}

export function createWorld(scene, seed = 7) {
  const rand = mulberry32(seed);
  const colliders = [];
  const addBox = (cx, cz, hx, hz) => colliders.push({ minX: cx - hx, maxX: cx + hx, minZ: cz - hz, maxZ: cz + hz });

  scene.fog = new THREE.Fog(0xd08050, 260, 1100);

  const sunDir = new THREE.Vector3(-0.5, 0.21, 0.66).normalize();
  const sun = new THREE.DirectionalLight(0xffa050, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -95;
  sun.shadow.camera.right = 95;
  sun.shadow.camera.top = 95;
  sun.shadow.camera.bottom = -95;
  sun.shadow.camera.near = 40;
  sun.shadow.camera.far = 650;
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);
  scene.add(sun.target);
  scene.add(new THREE.HemisphereLight(0x8a94a8, 0x4a4640, 0.8));

  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      sunDir: { value: sunDir },
      time: { value: 0 },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 sunDir;
      uniform float time;
      varying vec3 vDir;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      float fbm(vec2 p) {
        return 0.55 * noise(p) + 0.28 * noise(p * 2.1) + 0.17 * noise(p * 4.3);
      }
      void main() {
        vec3 dir = normalize(vDir);
        float h = max(dir.y, 0.0);
        vec3 zenith = vec3(0.07, 0.09, 0.24);
        vec3 mid = vec3(0.38, 0.24, 0.38);
        vec3 horizon = vec3(1.05, 0.5, 0.18);
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.2, h));
        col = mix(col, zenith, smoothstep(0.12, 0.62, h));
        if (dir.y < 0.0) col = mix(horizon, vec3(0.16, 0.1, 0.13), clamp(-dir.y * 4.0, 0.0, 1.0));
        float d = max(dot(dir, sunDir), 0.0);
        col += vec3(1.0, 0.5, 0.2) * exp(-abs(dir.y) * 14.0) * (0.18 + 0.4 * pow(d, 3.0));
        col += vec3(1.0, 0.78, 0.5) * (pow(d, 1800.0) * 4.0 + pow(d, 120.0) * 0.2 + pow(d, 10.0) * 0.08);
        if (dir.y > 0.012) {
          vec2 cp = dir.xz / (dir.y + 0.14) * 1.5 + vec2(time * 0.006, time * 0.0015);
          float cl = fbm(cp);
          float band = smoothstep(0.012, 0.07, dir.y) * (1.0 - smoothstep(0.16, 0.42, dir.y));
          float cm = smoothstep(0.48, 0.72, cl) * band;
          vec3 lit = vec3(1.0, 0.56, 0.36) * (0.5 + 0.7 * pow(d, 2.0));
          vec3 shade = vec3(0.36, 0.24, 0.36);
          col = mix(col, mix(shade, lit, smoothstep(0.5, 0.85, cl)), cm * 0.8);
          vec2 cp2 = dir.xz / (dir.y + 0.30) * 3.1 + vec2(time * 0.011, 4.7);
          float cl2 = fbm(cp2);
          float band2 = smoothstep(0.10, 0.22, dir.y) * (1.0 - smoothstep(0.34, 0.62, dir.y));
          float cm2 = smoothstep(0.54, 0.78, cl2) * band2;
          col = mix(col, mix(vec3(0.3, 0.2, 0.34), vec3(0.9, 0.5, 0.4), 0.3 + 0.5 * d), cm2 * 0.6);
        }
        col = pow(max(col, vec3(0.0)), vec3(2.2));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1550, 32, 16), skyMat);
  sky.renderOrder = -10;
  scene.add(sky);

  const oceanMat = new THREE.ShaderMaterial({
    fog: false,
    uniforms: {
      time: { value: 0 },
      sunDir: { value: sunDir },
      fogColor: { value: new THREE.Color(0xd08050) },
    },
    vertexShader: `
      uniform float time;
      varying vec3 vWorld;
      void main() {
        vec3 p = position;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        wp.y += sin(wp.x * 0.06 + time * 0.9) * 0.22 + cos(wp.z * 0.05 + time * 0.7) * 0.22;
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform float time;
      uniform vec3 sunDir;
      uniform vec3 fogColor;
      varying vec3 vWorld;
      void main() {
        vec2 p = vWorld.xz;
        vec3 n = normalize(vec3(
          sin(p.x * 0.09 + time * 1.1) * 0.035 + sin(p.x * 0.31 - time * 1.9) * 0.018 + sin(p.y * 0.17 + time) * 0.02,
          1.0,
          cos(p.y * 0.08 + time * 0.8) * 0.035 + cos(p.y * 0.27 + time * 1.5) * 0.018));
        vec3 viewDir = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(viewDir, n), 0.0), 2.2);
        vec3 deep = vec3(0.01, 0.04, 0.075);
        vec3 skyTint = vec3(1.0, 0.55, 0.3);
        vec3 col = mix(deep, skyTint, fres * 0.35);
        float spec = pow(max(dot(reflect(-viewDir, n), sunDir), 0.0), 120.0);
        float glitter = pow(max(dot(reflect(-viewDir, n), sunDir), 0.0), 900.0);
        col += vec3(1.0, 0.68, 0.38) * (pow(max(dot(reflect(-viewDir, n), sunDir), 0.0), 60.0) * 0.5 + spec * 1.4 + glitter * 3.5);
        float shoreBand = 1.0 - smoothstep(0.0, 4.0, abs(vWorld.x + 360.0));
        float foamNoise = sin(p.y * 0.35 + time * 1.4) * 0.5 + sin(p.y * 0.9 - time * 2.2) * 0.5;
        float foam = shoreBand * smoothstep(0.1, 0.7, foamNoise * 0.5 + 0.5 + shoreBand * 0.4);
        col = mix(col, vec3(0.75, 0.72, 0.66), foam * 0.4);
        col = pow(max(col, vec3(0.0)), vec3(2.2));
        float dist = length(cameraPosition - vWorld);
        col = mix(col, fogColor, smoothstep(260.0, 1100.0, dist));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(2100, 1900, 48, 48), oceanMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(-1410, -0.35, 0);
  scene.add(ocean);

  const terrainGeo = new THREE.PlaneGeometry(1120, 1320, 96, 96);
  terrainGeo.rotateX(-Math.PI / 2);
  terrainGeo.translate(200, 0, 0);
  const tp = terrainGeo.attributes.position;
  const colors = new Float32Array(tp.count * 3);
  const cSand = new THREE.Color(0xc9a86a);
  const cWetSand = new THREE.Color(0x8a7450);
  const cCity = new THREE.Color(0x3c3f3a);
  const cGrass = new THREE.Color(0x4a5a34);
  const cHigh = new THREE.Color(0x8a7a4e);
  const tmp = new THREE.Color();
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i);
    const z = tp.getZ(i);
    const h = heightAt(x, z);
    tp.setY(i, h - 0.05);
    if (x < -344) tmp.copy(cWetSand).lerp(cSand, smoothstep(-360, -346, x));
    else if (h > 1) tmp.copy(cGrass).lerp(cHigh, clamp(h / 45, 0, 1));
    else tmp.copy(cCity);
    tmp.multiplyScalar(0.9 + rand() * 0.16);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();
  const terrain = new THREE.Mesh(terrainGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  terrain.receiveShadow = true;
  scene.add(terrain);

  const wetMaps = asphaltMaps(rand);
  const asphalt = new THREE.MeshPhysicalMaterial({
    color: 0x4a4e54,
    roughness: 1.0,
    roughnessMap: wetMaps.rough,
    normalMap: wetMaps.normal,
    normalScale: new THREE.Vector2(0.4, 0.4),
    metalness: 0.0,
    specularIntensity: 0.6,
    clearcoat: 0.7,
    clearcoatRoughness: 0.15,
    envMapIntensity: 1.2,
  });
  const sidewalkTex = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#a0a4aa';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = `rgba(${30 + rand() * 40 | 0},${32 + rand() * 40 | 0},${36 + rand() * 40 | 0},${(rand() * 0.2).toFixed(2)})`;
      ctx.fillRect(rand() * w, rand() * h, 3 + rand() * 8, 3 + rand() * 8);
    }
    ctx.strokeStyle = 'rgba(24,26,30,0.6)';
    ctx.lineWidth = 2;
    for (let k = 0; k <= 2; k++) {
      ctx.beginPath(); ctx.moveTo(k * 64, 0); ctx.lineTo(k * 64, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, k * 64); ctx.lineTo(w, k * 64); ctx.stroke();
    }
  });
  sidewalkTex.wrapS = THREE.RepeatWrapping;
  sidewalkTex.wrapT = THREE.RepeatWrapping;
  const sidewalkMat = new THREE.MeshStandardMaterial({ map: sidewalkTex, color: 0xffffff, roughness: 0.8, envMapIntensity: 0.5 });
  const curbMat = new THREE.MeshStandardMaterial({ color: 0xb0b4ba, roughness: 0.75 });
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xe8eaee, roughness: 0.45 });
  const yellowMat = new THREE.MeshStandardMaterial({ color: 0xd8b45a, roughness: 0.55 });
  for (const road of ROAD_DEFS) {
    const surface = new THREE.Mesh(roadStripGeometry(road, 0, road.w, 0.03), asphalt);
    surface.receiveShadow = true;
    scene.add(surface);
    for (const side of [-1, 1]) {
      const walk = new THREE.Mesh(roadStripGeometry(road, side * (road.w / 2 + 2.6), 5.2, 0.12), sidewalkMat);
      walk.receiveShadow = true;
      scene.add(walk);
      const curb = new THREE.Mesh(roadStripGeometry(road, side * (road.w / 2 + 0.14), 0.3, 0.15), curbMat);
      scene.add(curb);
      const edge = new THREE.Mesh(roadStripGeometry(road, side * (road.w / 2 - 0.5), 0.18, 0.05), lineMat);
      scene.add(edge);
    }
    if (road.w >= 24) {
      for (const off of [-0.28, 0.28]) {
        const center = new THREE.Mesh(roadStripGeometry(road, off, 0.14, 0.05), yellowMat);
        scene.add(center);
      }
    }
  }

  const dashGeo = new THREE.PlaneGeometry(0.3, 3.2);
  dashGeo.rotateX(-Math.PI / 2);
  const dashTransforms = [];
  for (const road of ROAD_DEFS) {
    if (road.w >= 24) continue;
    for (let s = road.from + 6; s < road.to - 4; s += 9) {
      if (crosses(road, s)) continue;
      const x = road.axis === 'z' ? road.at : s;
      const z = road.axis === 'z' ? s : road.at;
      dashTransforms.push({ x, z, y: heightAt(x, z) + 0.055, ry: road.axis === 'z' ? 0 : Math.PI / 2 });
    }
  }
  const dashes = new THREE.InstancedMesh(dashGeo, new THREE.MeshStandardMaterial({ color: 0xcfd2d8, roughness: 0.55 }), dashTransforms.length);
  dashTransforms.forEach((d, i) => dashes.setMatrixAt(i, mat4(d.x, d.y, d.z, d.ry)));
  scene.add(dashes);

  const crossGeo = new THREE.PlaneGeometry(0.62, 2.6);
  crossGeo.rotateX(-Math.PI / 2);
  const crossTransforms = [];
  for (const it of intersections()) {
    for (const side of [-1, 1]) {
      for (let o = -it.wa / 2 + 1.2; o < it.wa / 2 - 0.8; o += 1.25) {
        crossTransforms.push({ x: it.x + o, z: it.z + side * (it.wb / 2 + 1.7), ry: 0 });
      }
      for (let o = -it.wb / 2 + 1.2; o < it.wb / 2 - 0.8; o += 1.25) {
        crossTransforms.push({ x: it.x + side * (it.wa / 2 + 1.7), z: it.z + o, ry: Math.PI / 2 });
      }
    }
  }
  const crosswalks = new THREE.InstancedMesh(crossGeo, new THREE.MeshStandardMaterial({ color: 0xc8cbd0, roughness: 0.6 }), crossTransforms.length);
  crossTransforms.forEach((d, i) => crosswalks.setMatrixAt(i, mat4(d.x, heightAt(d.x, d.z) + 0.06, d.z, d.ry)));
  scene.add(crosswalks);

  const jerseyShape = new THREE.Shape();
  jerseyShape.moveTo(0, 0);
  jerseyShape.lineTo(0.55, 0);
  jerseyShape.lineTo(0.55, 0.18);
  jerseyShape.lineTo(0.34, 0.5);
  jerseyShape.lineTo(0.27, 0.85);
  jerseyShape.lineTo(0.12, 0.85);
  jerseyShape.lineTo(0.05, 0.5);
  jerseyShape.lineTo(0, 0.18);
  jerseyShape.closePath();
  const jerseyGeo = new THREE.ExtrudeGeometry(jerseyShape, { depth: 7.8, bevelEnabled: false });
  const jerseySpots = [];
  const hwy = ROAD_DEFS[0];
  for (let s = hwy.from + 4; s < hwy.to - 4; s += 8) {
    if (crosses(hwy, s)) continue;
    jerseySpots.push({ x: hwy.at - hwy.w / 2 - 0.5, z: s });
  }
  const jerseyMesh = new THREE.InstancedMesh(jerseyGeo, new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.8 }), jerseySpots.length);
  jerseySpots.forEach((b, i) => jerseyMesh.setMatrixAt(i, mat4(b.x, heightAt(b.x, b.z), b.z)));
  jerseyMesh.castShadow = true;
  jerseyMesh.receiveShadow = true;
  scene.add(jerseyMesh);

  const railParts = [
    { geometry: new THREE.BoxGeometry(0.12, 0.75, 0.12), matrix: mat4(0, 0.37, -3.5), color: 0x6a6f76 },
    { geometry: new THREE.BoxGeometry(0.12, 0.75, 0.12), matrix: mat4(0, 0.37, 3.5), color: 0x6a6f76 },
    { geometry: new THREE.BoxGeometry(0.06, 0.16, 7.9), matrix: mat4(0, 0.62, 0), color: 0x8a9098 },
    { geometry: new THREE.BoxGeometry(0.06, 0.16, 7.9), matrix: mat4(0, 0.42, 0), color: 0x8a9098 },
  ];
  const railGeo = mergeParts(railParts);
  for (const p of railParts) p.geometry.dispose();
  const railSpots = [];
  for (let s = hwy.from + 4; s < hwy.to - 4; s += 8) {
    if (crosses(hwy, s)) continue;
    railSpots.push({ x: hwy.at + hwy.w / 2 + 0.45, z: s });
  }
  for (let z = WORLD.pierMinZ + 4; z < WORLD.pierMaxZ - 4; z += 8) {
    railSpots.push({ x: WORLD.pierMinX + 1, z, ry: Math.PI / 2 });
  }
  const railMesh = new THREE.InstancedMesh(railGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.6 }), railSpots.length);
  railSpots.forEach((b, i) => railMesh.setMatrixAt(i, mat4(b.x, heightAt(b.x, b.z), b.z, b.ry ?? 0)));
  scene.add(railMesh);

  const pier = new THREE.Mesh(
    new THREE.BoxGeometry(WORLD.coastX + 2 - WORLD.pierMinX, 1.4, WORLD.pierMaxZ - WORLD.pierMinZ),
    new THREE.MeshStandardMaterial({ color: 0x4a4e55, roughness: 0.9 }),
  );
  pier.position.set((WORLD.pierMinX + WORLD.coastX + 2) / 2, -0.1, (WORLD.pierMinZ + WORLD.pierMaxZ) / 2);
  pier.receiveShadow = true;
  scene.add(pier);

  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  unitBox.translate(0, 0.5, 0);
  const towerBands = [[], [], []];
  const towerStyles = [[], []];
  const midsBrick = [];
  const midsStucco = [];
  const podiums = [];
  const houses = [];
  const roofs = [];
  const warehouses = [];
  const balconies = [];
  const houseColors = [0xd8c8a8, 0xc4a882, 0xb8c4c8, 0xd8a890, 0xc8d0b8];
  const roofColors = [0x8a4a3a, 0x6a5a4a, 0x7a4a40, 0x5a5a60];

  const xs = [-210, -90, 30, 150, 270];
  const zs = [-320, -120, 80, 280, 460];
  for (let ix = 0; ix < xs.length - 1; ix++) {
    for (let iz = 0; iz < zs.length - 1; iz++) {
      const x0 = xs[ix] + 14;
      const x1 = xs[ix + 1] - 14;
      const z0 = zs[iz] + 15;
      const z1 = zs[iz + 1] - 15;
      const cw = x1 - x0;
      const cd = z1 - z0;
      const downtown = iz < 2 && ix >= 1 && ix <= 2;
      if (ix === 3 && iz === 1) continue;
      if (downtown) {
        const n = 2 + Math.floor(rand() * 2);
        for (let b = 0; b < n; b++) {
          const w = 17 + rand() * 12;
          const d = 17 + rand() * 12;
          const h = 45 + rand() * 72;
          const cx = x0 + (cw * (b + 0.5)) / n + (rand() - 0.5) * 8;
          const cz = z0 + cd * (0.25 + rand() * 0.5);
          const band = h < 70 ? 0 : h < 95 ? 1 : 2;
          const style = rand() < 0.5 ? 0 : 1;
          towerBands[band].push({ x: cx, z: cz, w, d, h, style });
          towerStyles[style].push({ x: cx, z: cz, w, d, h, band });
          if (rand() < 0.6) {
            const h2 = h * (0.2 + rand() * 0.2);
            towerBands[band].push({ x: cx, z: cz, w: w * 0.68, d: d * 0.68, h: h2, y: h, style });
          }
          if (rand() < 0.7) podiums.push({ x: cx, z: cz, w: w + 7, d: d + 7, h: 6 + rand() * 3 });
          if (style === 1) {
            const floors = Math.floor(h / 4);
            for (let f = 2; f < floors; f++) {
              for (const fz of [-1, 1]) {
                balconies.push({ x: cx, y: f * 4, z: cz + fz * (d / 2 + 0.7), w: w * 0.8, ry: fz > 0 ? 0 : Math.PI });
              }
            }
          }
          addBox(cx, cz, w / 2, d / 2);
        }
      } else if (iz >= 2 && (ix === 0 || iz === 3)) {
        const n = 1 + Math.floor(rand() * 2);
        for (let b = 0; b < n; b++) {
          const w = Math.min(cw - 6, 34 + rand() * 22);
          const d = 16 + rand() * 10;
          const h = 8 + rand() * 5;
          const cx = x0 + cw / 2 + (rand() - 0.5) * 10;
          const cz = z0 + (cd * (b + 0.5)) / n;
          warehouses.push({ x: cx, z: cz, w, d, h, tint: [0x8a949c, 0x9a8a7a, 0x7f8f98][Math.floor(rand() * 3)] });
          roofs.push({ x: cx, z: cz, w: w + 0.8, d: d + 0.8, h: 1.6, y: h, tint: 0x5a6068 });
          addBox(cx, cz, w / 2, d / 2);
        }
      } else if (iz >= 2) {
        const cols = Math.floor(cw / 18);
        const rows = Math.floor(cd / 20);
        for (let hx = 0; hx < cols; hx++) {
          for (let hz = 0; hz < rows; hz++) {
            if (rand() < 0.22) continue;
            const cx = x0 + 9 + hx * 18 + (rand() - 0.5) * 3;
            const cz = z0 + 10 + hz * 20 + (rand() - 0.5) * 3;
            const w = 8 + rand() * 3;
            const d = 9 + rand() * 3;
            const h = 4.5 + rand() * 2.5;
            houses.push({ x: cx, z: cz, w, d, h, tint: houseColors[Math.floor(rand() * houseColors.length)] });
            roofs.push({ x: cx, z: cz, w: w + 1.2, d: d + 1.2, h: 2.2 + rand(), y: h, tint: roofColors[Math.floor(rand() * roofColors.length)] });
            addBox(cx, cz, w / 2, d / 2);
          }
        }
      } else {
        const n = 2 + Math.floor(rand() * 2);
        for (let b = 0; b < n; b++) {
          const w = 14 + rand() * 12;
          const d = 14 + rand() * 12;
          const h = 14 + rand() * 26;
          const cx = x0 + (cw * (b + 0.5)) / n + (rand() - 0.5) * 6;
          const cz = z0 + cd * (0.3 + rand() * 0.4);
          (rand() < 0.5 ? midsBrick : midsStucco).push({ x: cx, z: cz, w, d, h });
          if (rand() < 0.5) podiums.push({ x: cx, z: cz, w: w + 4, d: d + 4, h: 4.5 });
          addBox(cx, cz, w / 2, d / 2);
        }
      }
    }
  }
  for (let b = 0; b < 5; b++) {
    const cx = -270 + (rand() - 0.5) * 20;
    const cz = -380 + b * 55;
    const w = 26 + rand() * 14;
    const d = 18 + rand() * 8;
    const h = 8 + rand() * 4;
    warehouses.push({ x: cx, z: cz, w, d, h, tint: 0x8a949c });
    roofs.push({ x: cx, z: cz, w: w + 0.8, d: d + 0.8, h: 1.6, y: h, tint: 0x5a6068 });
    addBox(cx, cz, w / 2, d / 2);
  }
  for (let i = 0; i < 14; i++) {
    const cx = 410 + rand() * 130;
    const cz = -520 + rand() * 1040;
    const w = 8 + rand() * 5;
    const d = 8 + rand() * 5;
    const h = 4.5 + rand() * 3.5;
    houses.push({ x: cx, z: cz, w, d, h, tint: houseColors[Math.floor(rand() * houseColors.length)] });
    roofs.push({ x: cx, z: cz, w: w + 1.2, d: d + 1.2, h: 2 + rand(), y: h, tint: roofColors[Math.floor(rand() * roofColors.length)] });
  }

  for (let z = -560; z < 560; z += 64) {
    if (z > 150 && z < 450) continue;
    const cx = -272 + (rand() - 0.5) * 16;
    const cz = z + (rand() - 0.5) * 10;
    const w = 16 + rand() * 10;
    const d = 14 + rand() * 8;
    const h = 10 + rand() * 18;
    (rand() < 0.5 ? midsBrick : midsStucco).push({ x: cx, z: cz, w, d, h });
    addBox(cx, cz, w / 2, d / 2);
  }

  function fillInstances(list, geo, mat, useTint) {
    if (!list.length) return null;
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    const c = new THREE.Color();
    list.forEach((b, i) => {
      mesh.setMatrixAt(i, mat4(b.x, heightAt(b.x, b.z) + (b.y ?? 0), b.z, 0, b.w, b.h, b.d));
      if (useTint) mesh.setColorAt(i, c.set(b.tint));
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }

  for (let band = 0; band < 3; band++) {
    for (let style = 0; style < 2; style++) {
      const list = towerBands[band].filter((b) => b.style === style);
      if (!list.length) continue;
      const tex = facadeTexture(rand, style === 0 ? 'glass' : 'concrete', [16, 22, 28][band]);
      const mat = new THREE.MeshStandardMaterial({
        map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.5,
        color: style === 0 ? 0xb8c4d0 : 0xc8c4bc, roughness: style === 0 ? 0.35 : 0.8, metalness: style === 0 ? 0.5 : 0.1,
        envMapIntensity: style === 0 ? 1.0 : 0.4,
      });
      fillInstances(list, unitBox, mat, false);
    }
  }
  const brickTex = facadeTexture(rand, 'brick', 9);
  const brickMat = new THREE.MeshStandardMaterial({ map: brickTex, emissiveMap: brickTex, emissive: 0xffffff, emissiveIntensity: 0.5, color: 0xc8b8a8, roughness: 0.85, envMapIntensity: 0.3 });
  fillInstances(midsBrick, unitBox, brickMat, false);
  const stuccoTex = facadeTexture(rand, 'stucco', 8);
  const stuccoMat = new THREE.MeshStandardMaterial({ map: stuccoTex, emissiveMap: stuccoTex, emissive: 0xffffff, emissiveIntensity: 0.5, color: 0xd8ccc0, roughness: 0.85, envMapIntensity: 0.3 });
  fillInstances(midsStucco, unitBox, stuccoMat, false);
  const podiumTex = facadeTexture(rand, 'brick', 3);
  const podiumMat = new THREE.MeshStandardMaterial({ map: podiumTex, emissiveMap: podiumTex, emissive: 0xffffff, emissiveIntensity: 0.55, color: 0xb8b0a4, roughness: 0.7 });
  fillInstances(podiums, unitBox, podiumMat, false);
  const houseTex = facadeTexture(rand, 'house', 3);
  const houseMat = new THREE.MeshStandardMaterial({ map: houseTex, emissiveMap: houseTex, emissive: 0xffffff, emissiveIntensity: 0.45, roughness: 0.85 });
  fillInstances(houses, unitBox, houseMat, true);
  const warehouseTex = facadeTexture(rand, 'warehouse', 4);
  const warehouseMat = new THREE.MeshStandardMaterial({ map: warehouseTex, emissiveMap: warehouseTex, emissive: 0xffffff, emissiveIntensity: 0.4, roughness: 0.6, metalness: 0.35 });
  fillInstances(warehouses, unitBox, warehouseMat, true);

  const balconyParts = [
    { geometry: new THREE.BoxGeometry(1, 0.14, 1.5), matrix: mat4(0, 0, 0.75), color: 0x8a8680 },
    { geometry: new THREE.BoxGeometry(1, 0.9, 0.06), matrix: mat4(0, 0.5, 1.45), color: 0x2a3440 },
    { geometry: new THREE.BoxGeometry(0.06, 0.9, 1.5), matrix: mat4(-0.5, 0.5, 0.75), color: 0x2a3440 },
    { geometry: new THREE.BoxGeometry(0.06, 0.9, 1.5), matrix: mat4(0.5, 0.5, 0.75), color: 0x2a3440 },
  ];
  const balconyGeo = mergeParts(balconyParts);
  for (const p of balconyParts) p.geometry.dispose();
  const balconyMesh = new THREE.InstancedMesh(balconyGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), balconies.length);
  balconies.forEach((b, i) => balconyMesh.setMatrixAt(i, mat4(b.x, heightAt(b.x, b.z) + b.y, b.z, b.ry, b.w, 1, 1)));
  balconyMesh.castShadow = true;
  scene.add(balconyMesh);

  const roofUnits = [];
  for (const t of towerStyles[0].concat(towerStyles[1])) {
    const y = heightAt(t.x, t.z) + t.h;
    roofUnits.push({ x: t.x + (rand() - 0.5) * t.w * 0.4, y, z: t.z + (rand() - 0.5) * t.d * 0.4, w: 3 + rand() * 3, h: 1.6 + rand() * 2.4, d: 3 + rand() * 3, tint: 0x3a4048 });
    if (rand() < 0.6) roofUnits.push({ x: t.x + (rand() - 0.5) * t.w * 0.5, y, z: t.z + (rand() - 0.5) * t.d * 0.5, w: 0.35, h: 4 + rand() * 6, d: 0.35, tint: 0x2a2f36 });
    if (rand() < 0.4) roofUnits.push({ x: t.x, y, z: t.z, w: t.w * 0.72, h: 1.2, d: t.d * 0.72, tint: 0x4a4e56 });
  }
  const roofUnitMesh = new THREE.InstancedMesh(unitBox, new THREE.MeshStandardMaterial({ roughness: 0.8 }), roofUnits.length);
  const ruc = new THREE.Color();
  roofUnits.forEach((b, i) => {
    roofUnitMesh.setMatrixAt(i, mat4(b.x, b.y, b.z, 0, b.w, b.h, b.d));
    roofUnitMesh.setColorAt(i, ruc.set(b.tint));
  });
  roofUnitMesh.castShadow = true;
  scene.add(roofUnitMesh);

  const neonColors = [0x2ad8e8, 0xff3a8a, 0xffa028];
  const neonLists = [[], [], []];
  towerStyles[0].concat(towerStyles[1]).forEach((t, i) => {
    if (i % 3) return;
    const k = i % 3;
    const y = heightAt(t.x, t.z);
    for (const sx of [-1, 1]) {
      neonLists[k].push({ x: t.x + sx * (t.w / 2 - 0.4), y, z: t.z + (t.d / 2 + 0.12), h: t.h * 0.7 });
      neonLists[k].push({ x: t.x + sx * (t.w / 2 - 0.4), y, z: t.z - (t.d / 2 + 0.12), h: t.h * 0.7 });
    }
  });
  neonLists.forEach((list, k) => {
    if (!list.length) return;
    const g = new THREE.BoxGeometry(0.18, 1, 0.18);
    g.translate(0, 0.5, 0);
    const m = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: neonColors[k], emissiveIntensity: 1.3 });
    const im = new THREE.InstancedMesh(g, m, list.length);
    list.forEach((b, i) => im.setMatrixAt(i, mat4(b.x, b.y + 2, b.z, 0, 1, b.h, 1)));
    scene.add(im);
  });

  const signTexts = ['AZURA', 'SUNDOWN', 'PORT AZURA', 'KESTREL', 'NOODLE BAR', 'HOTEL VISTA', 'DOCK 7', 'CLUB NEON'];
  const signNeons = ['#2ad8e8', '#ff3a8a', '#ffa028', '#8aff4a', '#ff6a3c', '#2ad8e8', '#ffa028', '#ff3a8a'];
  const allTowers = towerStyles[0].concat(towerStyles[1]);
  signTexts.forEach((text, i) => {
    const t = allTowers[(i * 3 + 1) % allTowers.length];
    if (!t) return;
    const tex = signTexture(text, signNeons[i]);
    const m = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.2, map: tex });
    const w = Math.min(t.w * 0.86, 13);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), m);
    const fz = t.z < -120 ? 1 : -1;
    mesh.position.set(t.x, heightAt(t.x, t.z) + t.h * (0.32 + (i % 3) * 0.1), t.z + fz * (t.d / 2 + 0.3));
    mesh.rotation.y = fz > 0 ? 0 : Math.PI;
    scene.add(mesh);
  });
  const roofGeo = roofGeometry();
  const roofMesh = new THREE.InstancedMesh(roofGeo, new THREE.MeshStandardMaterial({ roughness: 0.8 }), roofs.length);
  const rc = new THREE.Color();
  roofs.forEach((r, i) => {
    roofMesh.setMatrixAt(i, mat4(r.x, heightAt(r.x, r.z) + r.y, r.z, 0, r.w, r.h / 0.55, r.d));
    roofMesh.setColorAt(i, rc.set(r.tint));
  });
  roofMesh.castShadow = true;
  scene.add(roofMesh);

  const blockPaveGeo = new THREE.PlaneGeometry(1, 1);
  blockPaveGeo.rotateX(-Math.PI / 2);
  const blockPaveSpots = [];
  for (let ix = 0; ix < xs.length - 1; ix++) {
    for (let iz = 0; iz < zs.length - 1; iz++) {
      blockPaveSpots.push({ x: (xs[ix] + xs[ix + 1]) / 2, z: (zs[iz] + zs[iz + 1]) / 2, w: xs[ix + 1] - xs[ix] - 20, d: zs[iz + 1] - zs[iz] - 22 });
    }
  }
  blockPaveSpots.push({ x: -272, z: 0, w: 80, d: 1180 });
  const blockPave = new THREE.InstancedMesh(blockPaveGeo, new THREE.MeshStandardMaterial({ color: 0x43464c, roughness: 0.9 }), blockPaveSpots.length);
  blockPaveSpots.forEach((b, i) => blockPave.setMatrixAt(i, mat4(b.x, 0.015, b.z, 0, b.w, 1, b.d)));
  blockPave.receiveShadow = true;
  scene.add(blockPave);

  const containerGeo = new THREE.BoxGeometry(12.2, 2.6, 2.6);
  containerGeo.translate(0, 1.3, 0);
  const contTex = containerTexture();
  const containerMat = new THREE.MeshStandardMaterial({ map: contTex, roughness: 0.6, metalness: 0.35 });
  const containers = [];
  const palette = [0xb0402a, 0x2a6ab0, 0x2a8a4a, 0xd08020, 0x707880, 0x2a9a9a, 0x8a2a5a];
  for (const band of [[266, 274], [292, 352], [368, 432]]) {
    for (let x = -532; x < -382; x += 14.5) {
      for (let z = band[0]; z < band[1]; z += 7.5) {
        if (rand() < 0.3) continue;
        const stack = 1 + Math.floor(rand() * 3);
        for (let k = 0; k < stack; k++) {
          containers.push({ x: x + (rand() - 0.5), z, y: 0.6 + k * 2.62, tint: palette[Math.floor(rand() * palette.length)] });
        }
        addBox(x, z, 6.4, 1.6);
      }
    }
  }
  const containerMesh = new THREE.InstancedMesh(containerGeo, containerMat, containers.length);
  const cc = new THREE.Color();
  containers.forEach((b, i) => {
    containerMesh.setMatrixAt(i, mat4(b.x, b.y, b.z));
    containerMesh.setColorAt(i, cc.set(b.tint));
  });
  containerMesh.castShadow = true;
  containerMesh.receiveShadow = true;
  scene.add(containerMesh);

  const craneZs = [280, 330, 380, 420];
  const craneMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.4 });
  const trolleys = [];
  for (const z of craneZs) {
    const crane = new THREE.Mesh(craneGeometry(z), craneMat);
    crane.castShadow = true;
    scene.add(crane);
    const trolley = new THREE.Group();
    const tBody = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.6, 4), new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.6 }));
    trolley.add(tBody);
    const cable = new THREE.Mesh(new THREE.BoxGeometry(0.14, 14, 0.14), new THREE.MeshStandardMaterial({ color: 0x1c1f24 }));
    cable.position.y = -7.5;
    trolley.add(cable);
    const spreader = new THREE.Mesh(new THREE.BoxGeometry(3, 0.8, 2.6), new THREE.MeshStandardMaterial({ color: 0xe0a020, roughness: 0.6 }));
    spreader.position.y = -14.6;
    trolley.add(spreader);
    const loadMat = containerMat.clone();
    loadMat.color = new THREE.Color(palette[Math.floor(rand() * palette.length)]);
    const load = new THREE.Mesh(containerGeo, loadMat);
    load.position.y = -17.4;
    trolley.add(load);
    trolley.position.set(-530, 30, z);
    scene.add(trolley);
    trolleys.push({ group: trolley, phase: rand() * Math.PI * 2 });
  }
  for (const dx of [-497, -513]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(1, 0.3, WORLD.pierMaxZ - WORLD.pierMinZ - 10), new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.6, metalness: 0.5 }));
    rail.position.set(dx, 0.75, (WORLD.pierMinZ + WORLD.pierMaxZ) / 2);
    scene.add(rail);
  }

  const ship = buildShip(rand, palette, containerGeo, containerMat);
  ship.position.set(-615, -0.35, 210);
  scene.add(ship);
  const coaster = buildShip(rand, palette, containerGeo, containerMat);
  coaster.scale.setScalar(0.7);
  coaster.position.set(-405, -0.35, 150);
  coaster.rotation.y = 0.12;
  scene.add(coaster);
  const ship2 = buildShip(rand, palette, containerGeo, containerMat);
  ship2.scale.setScalar(0.55);
  ship2.position.set(-780, -0.35, -160);
  ship2.rotation.y = 0.4;
  scene.add(ship2);
  const tug = new THREE.Group();
  const tugHull = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 14), new THREE.MeshStandardMaterial({ color: 0x1c2430, roughness: 0.6 }));
  tugHull.position.y = 1;
  tug.add(tugHull);
  const tugCab = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 5), new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.7 }));
  tugCab.position.set(0, 3.6, 2);
  tug.add(tugCab);
  tug.position.set(-560, -0.3, 178);
  scene.add(tug);

  const yardMastParts = [
    { geometry: new THREE.CylinderGeometry(0.25, 0.4, 18, 6), matrix: mat4(0, 9, 0), color: 0x39404a },
    { geometry: new THREE.BoxGeometry(4, 0.3, 0.3), matrix: mat4(0, 17.8, 0), color: 0x39404a },
  ];
  const yardMastGeo = mergeParts(yardMastParts);
  for (const p of yardMastParts) p.geometry.dispose();
  const yardFloodGeo = new THREE.BoxGeometry(0.9, 0.5, 0.4);
  const yardFloodMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, emissive: 0xfff0c0, emissiveIntensity: 2.2 });
  const yardSpots = [[-470, 280], [-420, 320], [-470, 360], [-420, 420]];
  const yardMasts = new THREE.InstancedMesh(yardMastGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.5 }), yardSpots.length);
  const yardFloods = new THREE.InstancedMesh(yardFloodGeo, yardFloodMat, yardSpots.length * 4);
  yardSpots.forEach(([x, z], i) => {
    yardMasts.setMatrixAt(i, mat4(x, 0.6, z));
    for (let k = 0; k < 4; k++) yardFloods.setMatrixAt(i * 4 + k, mat4(x - 1.5 + k, 18.2, z));
  });
  scene.add(yardMasts);
  scene.add(yardFloods);

  const stackerParts = [
    { geometry: new THREE.BoxGeometry(3, 2.2, 6), matrix: mat4(0, 1.6, 0), color: 0xd08020 },
    { geometry: new THREE.BoxGeometry(2.4, 1.8, 2.4), matrix: mat4(0, 3.4, 1.4), color: 0x2a3440 },
    { geometry: new THREE.BoxGeometry(1.2, 1.2, 8), matrix: mat4(0, 3, -4.5, -0.3), color: 0xd08020 },
    { geometry: new THREE.CylinderGeometry(0.7, 0.7, 0.5, 10), matrix: mat4(-1.4, 0.7, 2), color: 0x14161a },
    { geometry: new THREE.CylinderGeometry(0.7, 0.7, 0.5, 10), matrix: mat4(1.4, 0.7, 2), color: 0x14161a },
    { geometry: new THREE.CylinderGeometry(0.6, 0.6, 0.5, 10), matrix: mat4(-1.4, 0.6, -2), color: 0x14161a },
    { geometry: new THREE.CylinderGeometry(0.6, 0.6, 0.5, 10), matrix: mat4(1.4, 0.6, -2), color: 0x14161a },
  ];
  const stackerGeo = mergeParts(stackerParts);
  for (const p of stackerParts) p.geometry.dispose();
  const stackerMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
  for (const [x, z, ry] of [[-450, 290, 0.4], [-430, 380, -1.2]]) {
    const st = new THREE.Mesh(stackerGeo, stackerMat);
    st.position.set(x, 0.6, z);
    st.rotation.y = ry;
    st.castShadow = true;
    scene.add(st);
  }

  const palmGeo = palmGeometry();
  const frondTex = frondTexture();
  const palmMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: frondTex, alphaTest: 0.35, roughness: 0.9, side: THREE.DoubleSide });
  const palmSpots = [];
  for (let z = -600; z < 600; z += 24) {
    palmSpots.push({ x: -352 + (rand() - 0.5) * 3, z: z + (rand() - 0.5) * 6 });
    if (rand() < 0.7) palmSpots.push({ x: -308 + (rand() - 0.5) * 3, z: z + 12 + (rand() - 0.5) * 6 });
  }
  for (const zx of [80, 280, 460]) {
    for (let x = -190; x < 260; x += 42) {
      if (rand() < 0.65) palmSpots.push({ x: x + (rand() - 0.5) * 8, z: zx + 12.5 });
    }
  }
  for (let i = 0; i < 14; i++) {
    palmSpots.push({ x: 392 + rand() * 160, z: -540 + rand() * 1080 });
  }
  palmSpots.push({ x: -322, z: -6, s: 1.3 });
  const palms = new THREE.InstancedMesh(palmGeo, palmMat, palmSpots.length);
  const palmColor = new THREE.Color();
  palmSpots.forEach((p, i) => {
    const s = p.s ?? 0.8 + rand() * 0.5;
    palms.setMatrixAt(i, mat4(p.x, heightAt(p.x, p.z), p.z, rand() * Math.PI * 2, s, s, s));
    palms.setColorAt(i, palmColor.setHSL(0.28 + rand() * 0.05, 0.4, 0.6 + rand() * 0.2));
  });
  palms.castShadow = true;
  scene.add(palms);

  const treeGeo = treeGeometry();
  const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const treeSpots = [];
  for (const road of ROAD_DEFS) {
    if (road.w < 14 || road.w >= 24) continue;
    for (let s = road.from + 25; s < road.to - 20; s += 34) {
      if (crosses(road, s)) continue;
      if (rand() < 0.35) continue;
      const side = rand() < 0.5 ? -1 : 1;
      const off = side * (road.w / 2 + 4.4);
      const x = road.axis === 'z' ? road.at + off : s;
      const z = road.axis === 'z' ? s : road.at + off;
      treeSpots.push({ x, z });
    }
  }
  for (let z = -580; z < 580; z += 40) {
    if (z > 150 && z < 450) continue;
    treeSpots.push({ x: -306 + (rand() - 0.5) * 2, z: z + (rand() - 0.5) * 8 });
  }

  const trees = new THREE.InstancedMesh(treeGeo, treeMat, treeSpots.length);
  const treeColor = new THREE.Color();
  treeSpots.forEach((p, i) => {
    const s = 0.85 + rand() * 0.5;
    trees.setMatrixAt(i, mat4(p.x, heightAt(p.x, p.z), p.z, rand() * Math.PI * 2, s, s, s));
    trees.setColorAt(i, treeColor.setHSL(0.26 + rand() * 0.06, 0.35, 0.62 + rand() * 0.2));
  });
  trees.castShadow = true;
  scene.add(trees);

  const hedgeGeo = new THREE.BoxGeometry(1, 0.8, 1);
  hedgeGeo.translate(0, 0.4, 0);
  const hedgeSpots = [];
  for (const t of allTowers) {
    if (rand() < 0.5) continue;
    for (const fz of [-1, 1]) {
      hedgeSpots.push({ x: t.x, z: t.z + fz * (t.d / 2 + 5.5), w: t.w * 0.9, d: 1.2 });
    }
  }
  for (let z = -560; z < 560; z += 26) {
    if (z > 150 && z < 450) continue;
    hedgeSpots.push({ x: -298, z, w: 1.4, d: 20 });
  }
  const hedges = new THREE.InstancedMesh(hedgeGeo, new THREE.MeshStandardMaterial({ color: 0x2e5a2c, roughness: 0.95 }), hedgeSpots.length);
  hedgeSpots.forEach((b, i) => hedges.setMatrixAt(i, mat4(b.x, heightAt(b.x, b.z) + 0.12, b.z, 0, b.w, 1, b.d)));
  hedges.castShadow = true;
  scene.add(hedges);

  const lampGeo = streetlightGeometry();
  const lampMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.5 });
  const headGeo = new THREE.BoxGeometry(0.9, 0.12, 0.4);
  const headMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, emissive: 0xffc46a, emissiveIntensity: 2.6 });
  const poolGeo = new THREE.PlaneGeometry(13, 13);
  poolGeo.rotateX(-Math.PI / 2);
  const poolMat = new THREE.MeshBasicMaterial({ map: radialTexture(128, 2.6), color: 0xff9d4a, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false });
  const lamps = [];
  for (let z = -590; z < 600; z += 42) {
    lamps.push({ x: -345, z, ry: 0 });
    lamps.push({ x: -315, z: z + 21, ry: Math.PI });
  }
  for (const road of ROAD_DEFS) {
    if (road.axis !== 'x') continue;
    for (let s = road.from + 30; s < road.to; s += 56) {
      if (crosses(road, s)) continue;
      lamps.push({ x: s, z: road.at + road.w / 2 + 3.4, ry: -Math.PI / 2 });
    }
    for (let s = road.from + 58; s < road.to; s += 56) {
      if (crosses(road, s)) continue;
      lamps.push({ x: s, z: road.at - road.w / 2 - 3.4, ry: Math.PI / 2 });
    }
  }
  for (const road of ROAD_DEFS) {
    if (road.axis !== 'z' || road.at === -330) continue;
    for (let s = road.from + 40; s < road.to; s += 62) {
      if (crosses(road, s)) continue;
      lamps.push({ x: road.at + road.w / 2 + 3.4, z: s, ry: Math.PI });
    }
  }
  const lampMesh = new THREE.InstancedMesh(lampGeo, lampMat, lamps.length);
  const headMesh = new THREE.InstancedMesh(headGeo, headMat, lamps.length);
  const poolMesh = new THREE.InstancedMesh(poolGeo, poolMat, lamps.length);
  const lampLights = [];
  lamps.forEach((l, i) => {
    const y = heightAt(l.x, l.z);
    lampMesh.setMatrixAt(i, mat4(l.x, y, l.z, l.ry));
    const hx = l.x + Math.cos(l.ry) * 3.3;
    const hz = l.z - Math.sin(l.ry) * 3.3;
    headMesh.setMatrixAt(i, mat4(hx, y + 7.28, hz, l.ry));
    poolMesh.setMatrixAt(i, mat4(hx, y + 0.07, hz));
    lampLights.push({ x: hx, y: y + 7.05, z: hz });
  });
  scene.add(lampMesh);
  scene.add(headMesh);
  scene.add(poolMesh);

  const signalParts = [
    { geometry: new THREE.CylinderGeometry(0.09, 0.13, 5.6, 6), matrix: mat4(0, 2.8, 0), color: 0x2c313a },
    { geometry: new THREE.BoxGeometry(3.6, 0.1, 0.1), matrix: mat4(1.8, 5.5, 0), color: 0x2c313a },
    { geometry: new THREE.BoxGeometry(0.32, 0.95, 0.24), matrix: mat4(3.4, 5.0, 0), color: 0x1c1f24 },
  ];
  const signalPoleGeo = mergeParts(signalParts);
  for (const p of signalParts) p.geometry.dispose();
  const signalLensGeo = new THREE.SphereGeometry(0.09, 6, 5);
  const sigRedMat = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2020, emissiveIntensity: 2 });
  const sigAmberMat = new THREE.MeshStandardMaterial({ color: 0x332200, emissive: 0xffaa20, emissiveIntensity: 0.2 });
  const sigGreenMat = new THREE.MeshStandardMaterial({ color: 0x003311, emissive: 0x20ff60, emissiveIntensity: 0.2 });
  const signalSpots = [];
  for (const it of intersections()) {
    if (it.wa >= 24 || (it.x >= -90 && it.x <= 150 && it.z <= 80)) {
      signalSpots.push({ x: it.x + it.wa / 2 + 1.2, z: it.z + it.wb / 2 + 1.2, ry: Math.PI });
      signalSpots.push({ x: it.x - it.wa / 2 - 1.2, z: it.z - it.wb / 2 - 1.2, ry: 0 });
    }
  }
  const signalPoles = new THREE.InstancedMesh(signalPoleGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.5 }), signalSpots.length);
  const sigRed = new THREE.InstancedMesh(signalLensGeo, sigRedMat, signalSpots.length);
  const sigAmber = new THREE.InstancedMesh(signalLensGeo, sigAmberMat, signalSpots.length);
  const sigGreen = new THREE.InstancedMesh(signalLensGeo, sigGreenMat, signalSpots.length);
  signalSpots.forEach((s, i) => {
    const y = heightAt(s.x, s.z);
    signalPoles.setMatrixAt(i, mat4(s.x, y, s.z, s.ry));
    const hx = s.x + Math.cos(s.ry) * 3.4;
    const hz = s.z - Math.sin(s.ry) * 3.4;
    sigRed.setMatrixAt(i, mat4(hx, y + 5.3, hz));
    sigAmber.setMatrixAt(i, mat4(hx, y + 5.0, hz));
    sigGreen.setMatrixAt(i, mat4(hx, y + 4.7, hz));
  });
  scene.add(signalPoles);
  scene.add(sigRed);
  scene.add(sigAmber);
  scene.add(sigGreen);

  const gantryTexA = roadSignTexture(['HARBORLINE', 'DOCKS  ->']);
  const gantryTexB = roadSignTexture(['DOWNTOWN', 'MERIDIAN  ->']);
  const gantryTexC = roadSignTexture(['PORT AZURA', 'NORTH LOOP  ->']);
  const gantryPoleGeo = new THREE.CylinderGeometry(0.22, 0.3, 7.4, 6);
  const gantryTrussGeo = new THREE.BoxGeometry(30, 0.7, 0.7);
  const gantryMat = new THREE.MeshStandardMaterial({ color: 0x4a5058, roughness: 0.6, metalness: 0.5 });
  const panelGeo = new THREE.PlaneGeometry(8, 4);
  for (const [z, texs] of [[-260, [gantryTexC, gantryTexB]], [-140, [gantryTexB, gantryTexA]], [300, [gantryTexA, gantryTexC]]]) {
    for (const x of [-344, -316]) {
      const pole = new THREE.Mesh(gantryPoleGeo, gantryMat);
      pole.position.set(x, heightAt(x, z) + 3.7, z);
      scene.add(pole);
    }
    const truss = new THREE.Mesh(gantryTrussGeo, gantryMat);
    truss.position.set(-330, heightAt(-330, z) + 7.2, z);
    scene.add(truss);
    texs.forEach((tex, i) => {
      const panel = new THREE.Mesh(panelGeo, new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.25, roughness: 0.6 }));
      panel.position.set(-336 + i * 12, heightAt(-330, z) + 5.6, z - 0.4);
      panel.rotation.y = Math.PI;
      scene.add(panel);
    });
  }

  const speedTex = canvasTexture(64, 80, (ctx, w, h) => {
    ctx.fillStyle = '#e8ece8';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 4;
    ctx.strokeRect(3, 3, w - 6, h - 6);
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SPEED', w / 2, 22);
    ctx.fillText('LIMIT', w / 2, 38);
    ctx.font = 'bold 30px monospace';
    ctx.fillText('50', w / 2, 68);
  });
  const speedSignGeo = new THREE.PlaneGeometry(0.7, 0.9);
  const speedPoleGeo = new THREE.CylinderGeometry(0.05, 0.06, 2.6, 5);
  const speedSpots = [[-318, -100, Math.PI], [-318, 180, Math.PI], [-76, -60, -Math.PI / 2], [44, 100, Math.PI / 2]];
  for (const [x, z, ry] of speedSpots) {
    const pole = new THREE.Mesh(speedPoleGeo, gantryMat);
    pole.position.set(x, heightAt(x, z) + 1.3, z);
    scene.add(pole);
    const sign = new THREE.Mesh(speedSignGeo, new THREE.MeshStandardMaterial({ map: speedTex, roughness: 0.5 }));
    sign.position.set(x, heightAt(x, z) + 2.7, z);
    sign.rotation.y = ry;
    scene.add(sign);
  }

  const benchParts = [
    { geometry: new THREE.BoxGeometry(1.8, 0.08, 0.5), matrix: mat4(0, 0.45, 0), color: 0x7a5a3a },
    { geometry: new THREE.BoxGeometry(1.8, 0.5, 0.08), matrix: mat4(0, 0.75, -0.25), color: 0x7a5a3a },
    { geometry: new THREE.BoxGeometry(0.08, 0.45, 0.5), matrix: mat4(-0.8, 0.22, 0), color: 0x2c313a },
    { geometry: new THREE.BoxGeometry(0.08, 0.45, 0.5), matrix: mat4(0.8, 0.22, 0), color: 0x2c313a },
  ];
  const benchGeo = mergeParts(benchParts);
  const binParts = [
    { geometry: new THREE.CylinderGeometry(0.28, 0.24, 0.8, 8), matrix: mat4(0, 0.4, 0), color: 0x2e4a3a },
    { geometry: new THREE.CylinderGeometry(0.3, 0.3, 0.08, 8), matrix: mat4(0, 0.82, 0), color: 0x1c2420 },
  ];
  const binGeo = mergeParts(binParts);
  const hydrantParts = [
    { geometry: new THREE.CylinderGeometry(0.14, 0.18, 0.6, 8), matrix: mat4(0, 0.3, 0), color: 0xb03028 },
    { geometry: new THREE.SphereGeometry(0.15, 8, 6), matrix: mat4(0, 0.62, 0), color: 0xb03028 },
    { geometry: new THREE.BoxGeometry(0.4, 0.1, 0.1), matrix: mat4(0, 0.42, 0), color: 0x8a2018 },
  ];
  const hydrantGeo = mergeParts(hydrantParts);
  for (const p of [...benchParts, ...binParts, ...hydrantParts]) p.geometry.dispose();
  const propMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
  const benchSpots = [];
  const binSpots = [];
  const hydrantSpots = [];
  for (const road of ROAD_DEFS) {
    if (road.w >= 24) continue;
    for (let s = road.from + 30; s < road.to - 20; s += 47) {
      if (crosses(road, s)) continue;
      const side = rand() < 0.5 ? -1 : 1;
      const off = side * (road.w / 2 + 4.2);
      const x = road.axis === 'z' ? road.at + off : s;
      const z = road.axis === 'z' ? s : road.at + off;
      const ry = road.axis === 'z' ? (side > 0 ? -Math.PI / 2 : Math.PI / 2) : (side > 0 ? Math.PI : 0);
      if (rand() < 0.6) benchSpots.push({ x, z, ry });
      binSpots.push({ x: x + (road.axis === 'z' ? 0 : 2.2), z: z + (road.axis === 'z' ? 2.2 : 0) });
      if (rand() < 0.4) hydrantSpots.push({ x: x + (road.axis === 'z' ? side * -1.5 : 4), z: z + (road.axis === 'z' ? 4 : side * -1.5) });
    }
  }
  const benches = new THREE.InstancedMesh(benchGeo, propMat, benchSpots.length);
  benchSpots.forEach((b, i) => benches.setMatrixAt(i, mat4(b.x, heightAt(b.x, b.z) + 0.12, b.z, b.ry)));
  benches.castShadow = true;
  scene.add(benches);
  const bins = new THREE.InstancedMesh(binGeo, propMat, binSpots.length);
  binSpots.forEach((b, i) => bins.setMatrixAt(i, mat4(b.x, heightAt(b.x, b.z) + 0.12, b.z)));
  bins.castShadow = true;
  scene.add(bins);
  const hydrants = new THREE.InstancedMesh(hydrantGeo, propMat, hydrantSpots.length);
  hydrantSpots.forEach((b, i) => hydrants.setMatrixAt(i, mat4(b.x, heightAt(b.x, b.z) + 0.12, b.z)));
  scene.add(hydrants);

  const shelterParts = [
    { geometry: new THREE.BoxGeometry(0.1, 2.4, 0.1), matrix: mat4(-1.5, 1.2, 0), color: 0x2c313a },
    { geometry: new THREE.BoxGeometry(0.1, 2.4, 0.1), matrix: mat4(1.5, 1.2, 0), color: 0x2c313a },
    { geometry: new THREE.BoxGeometry(3.4, 0.1, 1.4), matrix: mat4(0, 2.45, 0), color: 0x2c313a },
    { geometry: new THREE.BoxGeometry(3.2, 1.6, 0.06), matrix: mat4(0, 1.4, -0.65), color: 0x1a2a34 },
    { geometry: new THREE.BoxGeometry(1.8, 0.08, 0.4), matrix: mat4(0, 0.5, -0.3), color: 0x7a5a3a },
  ];
  const shelterGeo = mergeParts(shelterParts);
  for (const p of shelterParts) p.geometry.dispose();
  const adTex = canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#ff8a4c');
    g.addColorStop(1, '#8a2a5a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff0e0';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('AZURA', w / 2, 50);
    ctx.fillText('TRANSIT', w / 2, 78);
  });
  const shelterSpots = [[-76, -134, -Math.PI / 2], [44, -40, Math.PI / 2], [-196, 60, -Math.PI / 2], [164, 140, Math.PI / 2]];
  for (const [x, z, ry] of shelterSpots) {
    const sh = new THREE.Mesh(shelterGeo, propMat);
    sh.position.set(x, heightAt(x, z) + 0.12, z);
    sh.rotation.y = ry;
    sh.castShadow = true;
    scene.add(sh);
    const ad = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.5), new THREE.MeshStandardMaterial({ map: adTex, emissive: 0xffffff, emissiveMap: adTex, emissiveIntensity: 0.7 }));
    ad.position.set(x + Math.cos(ry) * 0.72, heightAt(x, z) + 1.5, z - Math.sin(ry) * 0.72);
    ad.rotation.y = ry + Math.PI / 2;
    scene.add(ad);
  }

  const bridgeZ = 140;
  const bridgeMat2 = new THREE.MeshStandardMaterial({ color: 0x5a626c, roughness: 0.55, metalness: 0.5 });
  const bridgeDeck = new THREE.Mesh(new THREE.BoxGeometry(34, 0.4, 3.2), bridgeMat2);
  bridgeDeck.position.set(-330, 6.4, bridgeZ);
  bridgeDeck.castShadow = true;
  scene.add(bridgeDeck);
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(34, 1.1, 0.1), new THREE.MeshStandardMaterial({ color: 0x3a424c, roughness: 0.6, metalness: 0.4 }));
    rail.position.set(-330, 7.1, bridgeZ + side * 1.55);
    scene.add(rail);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(17, 0.24, 6, 24, Math.PI), bridgeMat2);
    arch.scale.y = 0.3;
    arch.position.set(-330, 6.5, bridgeZ + side * 1.55);
    arch.castShadow = true;
    scene.add(arch);
    for (let hx = -14; hx <= 14; hx += 4) {
      const ay = 6.5 + Math.sqrt(Math.max(0, 1 - (hx / 17) ** 2)) * 17 * 0.3;
      const hanger = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, ay - 6.4, 4), bridgeMat2);
      hanger.position.set(-330 + hx, (ay + 6.4) / 2, bridgeZ + side * 1.55);
      scene.add(hanger);
    }
  }
  for (const x of [-346, -314]) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(1, 6.4, 3.4), bridgeMat2);
    col.position.set(x, 3.2, bridgeZ);
    col.castShadow = true;
    scene.add(col);
    addBox(x, bridgeZ, 0.6, 1.8);
  }

  const lotX = 210;
  const lotZ = -20;
  const lot = new THREE.Mesh(new THREE.PlaneGeometry(84, 150), new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.9 }));
  lot.rotation.x = -Math.PI / 2;
  lot.position.set(lotX, 0.02, lotZ);
  lot.receiveShadow = true;
  scene.add(lot);
  const stallGeo = new THREE.PlaneGeometry(0.15, 5);
  stallGeo.rotateX(-Math.PI / 2);
  const stallSpots = [];
  for (const row of [-30, -10, 10, 30]) {
    for (let k = 0; k < 10; k++) {
      stallSpots.push({ x: lotX + row, z: lotZ - 55 + k * 11 });
    }
  }
  const stalls = new THREE.InstancedMesh(stallGeo, new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: 0.6 }), stallSpots.length);
  stallSpots.forEach((b, i) => stalls.setMatrixAt(i, mat4(b.x, 0.04, b.z)));
  scene.add(stalls);

  const hillSignTex = canvasTexture(512, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#e8e4d8';
    ctx.font = 'bold 96px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('AZURA', w / 2, h / 2);
  });
  const hillSign = new THREE.Mesh(new THREE.PlaneGeometry(64, 16), new THREE.MeshStandardMaterial({ map: hillSignTex, transparent: true, emissive: 0xffffff, emissiveMap: hillSignTex, emissiveIntensity: 0.25, roughness: 0.8 }));
  hillSign.position.set(486, heightAt(486, -60) + 12, -60);
  hillSign.rotation.y = -Math.PI / 2;
  scene.add(hillSign);

  const beaconGeo = new THREE.SphereGeometry(0.5, 6, 5);
  const beaconMat = new THREE.MeshStandardMaterial({ color: 0x440000, emissive: 0xff2020, emissiveIntensity: 2 });
  const beaconSpots = craneZs.map((z) => ({ x: -505, y: 41.5, z }));
  for (const t of allTowers) if (t.h > 80) beaconSpots.push({ x: t.x, y: heightAt(t.x, t.z) + t.h + 1.5, z: t.z });
  const mastX = 552;
  const mastZ = -60;
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.9, 26, 6),
    new THREE.MeshStandardMaterial({ color: 0x39404a, roughness: 0.6, metalness: 0.5 }),
  );
  mast.position.set(mastX, heightAt(mastX, mastZ) + 13, mastZ);
  scene.add(mast);
  beaconSpots.push({ x: mastX, y: heightAt(mastX, mastZ) + 27, z: mastZ });
  const beacons = new THREE.InstancedMesh(beaconGeo, beaconMat, beaconSpots.length);
  beaconSpots.forEach((b, i) => beacons.setMatrixAt(i, mat4(b.x, b.y, b.z)));
  scene.add(beacons);

  const bollardGeo = new THREE.CylinderGeometry(0.3, 0.35, 0.9, 6);
  const bollards = [];
  for (let z = WORLD.pierMinZ + 8; z < WORLD.pierMaxZ; z += 18) bollards.push({ x: WORLD.pierMinX + 2, z });
  const bollardMesh = new THREE.InstancedMesh(bollardGeo, new THREE.MeshStandardMaterial({ color: 0x1c1f24, roughness: 0.7 }), bollards.length);
  bollards.forEach((b, i) => bollardMesh.setMatrixAt(i, mat4(b.x, 1.0, b.z)));
  scene.add(bollardMesh);

  const spawn = { x: -330, z: -60, heading: 0 };

  function update(dt, t, focus) {
    skyMat.uniforms.time.value = t;
    oceanMat.uniforms.time.value = t;
    ship.position.y = -0.35 + Math.sin(t * 0.4) * 0.18;
    ship.rotation.z = Math.sin(t * 0.3) * 0.004;
    tug.position.y = -0.3 + Math.sin(t * 0.7 + 2) * 0.12;
    for (const tr of trolleys) {
      tr.group.position.x = -528 + Math.sin(t * 0.11 + tr.phase) * 16;
      tr.group.position.y = 30 + Math.sin(t * 0.23 + tr.phase) * 1.5;
    }
    beaconMat.emissiveIntensity = 1.2 + Math.max(0, Math.sin(t * 2.4)) * 2.4;
    const phase = t % 12;
    sigGreenMat.emissiveIntensity = phase < 6 ? 2.2 : 0.15;
    sigAmberMat.emissiveIntensity = phase >= 6 && phase < 7.5 ? 2.2 : 0.15;
    sigRedMat.emissiveIntensity = phase >= 7.5 ? 2.2 : 0.15;
    wetMaps.normal.offset.set(t * 0.004, t * 0.0026);
    if (focus) {
      sun.position.set(focus.x + sunDir.x * 320, focus.y + sunDir.y * 320 + 60, focus.z + sunDir.z * 320);
      sun.target.position.set(focus.x, focus.y, focus.z);
    }
  }

  return { roads: ROAD_DEFS, colliders, spawn, update, sun, skyMat, oceanMat, lampLights, asphalt };
}


