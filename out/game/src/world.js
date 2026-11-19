import THREE from 'three';
import { WORLD } from './config.js';
import { mulberry32, clamp, smoothstep, mergeParts, mat4, canvasTexture } from './utils.js';

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
    if (i < steps) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
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

function windowTexture(rand) {
  return canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#141926';
    ctx.fillRect(0, 0, w, h);
    const cols = 8;
    const rows = 22;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lit = rand() < 0.5;
        ctx.fillStyle = lit ? (rand() < 0.7 ? '#ffb45e' : '#a8d8ff') : '#1e2536';
        ctx.fillRect(c * 16 + 4, r * 11.6 + 3, 9, 6.5);
      }
    }
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

function palmGeometry() {
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.13, 0.24, 2.3, 5);
  parts.push({ geometry: trunk, matrix: mat4(0, 1.15, 0), color: 0x6b4a30 });
  parts.push({ geometry: trunk, matrix: mat4(0.14, 3.2, 0, 0, 0.85, 0.95, 0.85), color: 0x755238 });
  parts.push({ geometry: trunk, matrix: mat4(0.34, 5.0, 0, 0, 0.7, 0.85, 0.7), color: 0x7d5a3e });
  const frond = new THREE.PlaneGeometry(0.62, 2.9, 1, 3);
  const fp = frond.attributes.position;
  for (let i = 0; i < fp.count; i++) {
    const y = fp.getY(i);
    fp.setZ(i, -Math.pow(Math.max(0, y + 1.45) / 2.9, 2) * 1.1);
  }
  frond.computeVertexNormals();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const m = new THREE.Matrix4();
    m.compose(
      new THREE.Vector3(0.34 + Math.sin(a) * 1.05, 5.75, Math.cos(a) * 1.05),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.55, a, 0, 'YXZ')),
      new THREE.Vector3(1, 1, 1),
    );
    parts.push({ geometry: frond, matrix: m, color: i % 2 ? 0x2e6b34 : 0x357a3c });
  }
  trunk.dispose();
  frond.dispose();
  return mergeParts(parts);
}

function streetlightGeometry() {
  const pole = new THREE.CylinderGeometry(0.1, 0.16, 7.2, 5);
  const arm = new THREE.BoxGeometry(2.8, 0.12, 0.12);
  return mergeParts([
    { geometry: pole, matrix: mat4(0, 3.6, 0), color: 0x2c313a },
    { geometry: arm, matrix: mat4(1.35, 7.1, 0), color: 0x2c313a },
  ]);
}

function craneGeometry(zs) {
  const parts = [];
  const leg = new THREE.BoxGeometry(1.3, 27, 1.3);
  const beam = new THREE.BoxGeometry(30, 2.2, 2.2);
  const boom = new THREE.BoxGeometry(52, 1.7, 1.7);
  const house = new THREE.BoxGeometry(7, 4.5, 5);
  const cable = new THREE.BoxGeometry(0.16, 15, 0.16);
  const spreader = new THREE.BoxGeometry(3, 1, 2.6);
  for (const z of zs) {
    for (const dx of [-8, 8]) {
      for (const dz of [-6.5, 6.5]) {
        parts.push({ geometry: leg, matrix: mat4(-505 + dx, 13.5, z + dz), color: 0x39404a });
      }
    }
    parts.push({ geometry: beam, matrix: mat4(-505, 27.5, z), color: 0xd9662a });
    parts.push({ geometry: boom, matrix: mat4(-524, 29.2, z), color: 0xd9662a });
    parts.push({ geometry: house, matrix: mat4(-496, 30.5, z), color: 0xb8581f });
    parts.push({ geometry: cable, matrix: mat4(-536, 21, z), color: 0x1c1f24 });
    parts.push({ geometry: spreader, matrix: mat4(-536, 13.2, z), color: 0xe0a020 });
  }
  return mergeParts(parts);
}

export function createWorld(scene, seed = 7) {
  const rand = mulberry32(seed);
  const colliders = [];
  const addBox = (cx, cz, hx, hz) => colliders.push({ minX: cx - hx, maxX: cx + hx, minZ: cz - hz, maxZ: cz + hz });

  scene.fog = new THREE.Fog(0xd8855a, 260, 1150);

  const sunDir = new THREE.Vector3(-0.82, 0.17, -0.3).normalize();
  const sun = new THREE.DirectionalLight(0xffb066, 2.7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -95;
  sun.shadow.camera.right = 95;
  sun.shadow.camera.top = 95;
  sun.shadow.camera.bottom = -95;
  sun.shadow.camera.near = 40;
  sun.shadow.camera.far = 650;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);
  scene.add(new THREE.HemisphereLight(0x8a6aa8, 0x46342a, 0.55));

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
        vec3 zenith = vec3(0.10, 0.07, 0.24);
        vec3 mid = vec3(0.72, 0.30, 0.42);
        vec3 horizon = vec3(1.0, 0.60, 0.24);
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.18, h));
        col = mix(col, zenith, smoothstep(0.12, 0.62, h));
        if (dir.y < 0.0) col = mix(horizon, vec3(0.16, 0.10, 0.18), clamp(-dir.y * 4.0, 0.0, 1.0));
        float d = max(dot(dir, sunDir), 0.0);
        col += vec3(1.0, 0.78, 0.5) * (pow(d, 350.0) * 4.0 + pow(d, 24.0) * 0.55 + pow(d, 4.0) * 0.16);
        if (dir.y > 0.015) {
          vec2 cp = dir.xz / (dir.y + 0.12) * 1.6 + vec2(time * 0.006, 0.0);
          float cl = fbm(cp);
          float band = smoothstep(0.015, 0.10, dir.y) * (1.0 - smoothstep(0.22, 0.55, dir.y));
          float cm = smoothstep(0.52, 0.78, cl) * band;
          col = mix(col, vec3(1.0, 0.62, 0.52) * (0.7 + 0.5 * d), cm * 0.75);
        }
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
      fogColor: { value: new THREE.Color(0xd8855a) },
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
        float fres = pow(1.0 - max(dot(viewDir, n), 0.0), 3.0);
        vec3 deep = vec3(0.03, 0.10, 0.18);
        vec3 skyTint = vec3(0.85, 0.45, 0.30);
        vec3 col = mix(deep, skyTint, fres * 0.75);
        float spec = pow(max(dot(reflect(-viewDir, n), sunDir), 0.0), 120.0);
        float glitter = pow(max(dot(reflect(-viewDir, n), sunDir), 0.0), 900.0);
        col += vec3(1.0, 0.72, 0.42) * (spec * 1.4 + glitter * 3.0);
        float dist = length(cameraPosition - vWorld);
        col = mix(col, fogColor, smoothstep(260.0, 1150.0, dist));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(2100, 1900, 48, 48), oceanMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(-1410, -0.35, 0);
  scene.add(ocean);

  const terrainGeo = new THREE.PlaneGeometry(1260, 1320, 96, 96);
  terrainGeo.rotateX(-Math.PI / 2);
  terrainGeo.translate(130, 0, 0);
  const tp = terrainGeo.attributes.position;
  const colors = new Float32Array(tp.count * 3);
  const cSand = new THREE.Color(0xc9a86a);
  const cCity = new THREE.Color(0x474d44);
  const cDry = new THREE.Color(0x8a7a4e);
  const cHigh = new THREE.Color(0x9a8a5c);
  const tmp = new THREE.Color();
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i);
    const z = tp.getZ(i);
    const h = heightAt(x, z);
    tp.setY(i, h - 0.05);
    if (x < -338) tmp.copy(cSand);
    else if (h > 1) tmp.copy(cDry).lerp(cHigh, clamp(h / 45, 0, 1));
    else tmp.copy(cCity).lerp(cSand, smoothstep(-338, -352, x) * 0);
    if (x >= -352 && x < -338) tmp.copy(cSand).lerp(cCity, (x + 352) / 14);
    tmp.multiplyScalar(0.92 + rand() * 0.12);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();
  const terrain = new THREE.Mesh(terrainGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  terrain.receiveShadow = true;
  scene.add(terrain);

  const asphalt = new THREE.MeshPhysicalMaterial({
    color: 0x14161c,
    roughness: 0.32,
    metalness: 0.18,
    clearcoat: 0.65,
    clearcoatRoughness: 0.22,
  });
  const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x585c64, roughness: 0.9 });
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xb9bdc4, roughness: 0.6 });
  for (const road of ROAD_DEFS) {
    const surface = new THREE.Mesh(roadStripGeometry(road, 0, road.w, 0.03), asphalt);
    surface.receiveShadow = true;
    scene.add(surface);
    for (const side of [-1, 1]) {
      const walk = new THREE.Mesh(roadStripGeometry(road, side * (road.w / 2 + 2.3), 4.6, 0.09), sidewalkMat);
      walk.receiveShadow = true;
      scene.add(walk);
      const edge = new THREE.Mesh(roadStripGeometry(road, side * (road.w / 2 - 0.45), 0.2, 0.05), lineMat);
      scene.add(edge);
    }
  }

  const dashGeo = new THREE.PlaneGeometry(0.35, 3.2);
  dashGeo.rotateX(-Math.PI / 2);
  const dashTransforms = [];
  for (const road of ROAD_DEFS) {
    for (let s = road.from + 6; s < road.to - 4; s += 9) {
      if (crosses(road, s)) continue;
      const x = road.axis === 'z' ? road.at : s;
      const z = road.axis === 'z' ? s : road.at;
      dashTransforms.push({ x, z, y: heightAt(x, z) + 0.055, ry: road.axis === 'z' ? 0 : Math.PI / 2, yellow: road.w >= 24 });
    }
  }
  const dashes = new THREE.InstancedMesh(dashGeo, new THREE.MeshStandardMaterial({ roughness: 0.55 }), dashTransforms.length);
  const dashColor = new THREE.Color();
  dashTransforms.forEach((d, i) => {
    dashes.setMatrixAt(i, mat4(d.x, d.y, d.z, d.ry));
    dashes.setColorAt(i, dashColor.set(d.yellow ? 0xd8b45a : 0xcfd2d8));
  });
  scene.add(dashes);

  const pier = new THREE.Mesh(
    new THREE.BoxGeometry(WORLD.coastX + 2 - WORLD.pierMinX, 1.4, WORLD.pierMaxZ - WORLD.pierMinZ),
    new THREE.MeshStandardMaterial({ color: 0x4a4e55, roughness: 0.9 }),
  );
  pier.position.set((WORLD.pierMinX + WORLD.coastX + 2) / 2, -0.1, (WORLD.pierMinZ + WORLD.pierMaxZ) / 2);
  pier.receiveShadow = true;
  scene.add(pier);

  const towerTex = windowTexture(rand);
  const towerMat = new THREE.MeshStandardMaterial({
    map: towerTex,
    emissiveMap: towerTex,
    emissive: 0xffffff,
    emissiveIntensity: 0.6,
    color: 0x9aa2b2,
    roughness: 0.65,
    metalness: 0.25,
  });
  const midMat = new THREE.MeshStandardMaterial({ color: 0x7d7468, roughness: 0.85 });
  const houseMat = new THREE.MeshStandardMaterial({ roughness: 0.85 });
  const roofMat = new THREE.MeshStandardMaterial({ roughness: 0.8 });
  const warehouseMat = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.3 });

  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  unitBox.translate(0, 0.5, 0);
  const towers = [];
  const mids = [];
  const houses = [];
  const roofs = [];
  const warehouses = [];
  const houseColors = [0xd8c8a8, 0xc4a882, 0xb8c4c8, 0xd8a890, 0xc8d0b8];
  const roofColors = [0x8a4a3a, 0x6a5a4a, 0x7a4a40, 0x5a5a60];
  const towerTints = [0x8a92a2, 0x9a8a80, 0x7a8a9a, 0xa09a8a, 0x88909c];

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
      if (downtown) {
        const n = 2 + Math.floor(rand() * 2);
        for (let b = 0; b < n; b++) {
          const w = 17 + rand() * 12;
          const d = 17 + rand() * 12;
          const h = 45 + rand() * 72;
          const cx = x0 + (cw * (b + 0.5)) / n + (rand() - 0.5) * 8;
          const cz = z0 + cd * (0.25 + rand() * 0.5);
          towers.push({ x: cx, z: cz, w, d, h, tint: towerTints[Math.floor(rand() * towerTints.length)] });
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
          warehouses.push({ x: cx, z: cz, w, d, h, tint: [0x6a7a82, 0x8a7a6a, 0x5f6f78][Math.floor(rand() * 3)] });
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
          mids.push({ x: cx, z: cz, w, d, h, tint: [0x8a8278, 0x7a7268, 0x96897c][Math.floor(rand() * 3)] });
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
    warehouses.push({ x: cx, z: cz, w, d, h, tint: 0x6a7a82 });
    addBox(cx, cz, w / 2, d / 2);
  }

  function fillInstances(list, geo, mat, useTint) {
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    const c = new THREE.Color();
    list.forEach((b, i) => {
      mesh.setMatrixAt(i, mat4(b.x, heightAt(b.x, b.z), b.z, 0, b.w, b.h, b.d));
      if (useTint) mesh.setColorAt(i, c.set(b.tint));
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }
  fillInstances(towers, unitBox, towerMat, true);
  fillInstances(mids, unitBox, midMat, true);
  fillInstances(warehouses, unitBox, warehouseMat, true);
  fillInstances(houses, unitBox, houseMat, true);
  const roofGeo = roofGeometry();
  const roofMesh = new THREE.InstancedMesh(roofGeo, roofMat, roofs.length);
  const rc = new THREE.Color();
  roofs.forEach((r, i) => {
    roofMesh.setMatrixAt(i, mat4(r.x, heightAt(r.x, r.z) + r.y, r.z, 0, r.w, r.h / 0.55, r.d));
    roofMesh.setColorAt(i, rc.set(r.tint));
  });
  roofMesh.castShadow = true;
  scene.add(roofMesh);

  const containerGeo = new THREE.BoxGeometry(12.2, 2.6, 2.6);
  containerGeo.translate(0, 1.3, 0);
  const containerMat = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.35 });
  const containers = [];
  const palette = [0xb0402a, 0x2a6ab0, 0x2a8a4a, 0xd08020, 0x707880, 0x2a9a9a, 0x8a2a5a];
  for (const band of [[172, 254], [302, 430]]) {
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

  const craneZs = [200, 262, 324, 386];
  const cranes = new THREE.Mesh(craneGeometry(craneZs), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.4 }));
  cranes.castShadow = true;
  scene.add(cranes);

  const ship = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(28, 15, 150), new THREE.MeshStandardMaterial({ color: 0x2a3a52, roughness: 0.6 }));
  hull.position.y = 4.5;
  hull.castShadow = true;
  ship.add(hull);
  const bow = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 15, 3, 1), new THREE.MeshStandardMaterial({ color: 0x2a3a52, roughness: 0.6 }));
  bow.rotation.y = Math.PI / 6;
  bow.position.set(0, 4.5, -80);
  bow.scale.set(1, 1, 0.8);
  ship.add(bow);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(28.4, 3, 150.4), new THREE.MeshStandardMaterial({ color: 0xa03020, roughness: 0.6 }));
  stripe.position.y = 0.5;
  ship.add(stripe);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(22, 18, 14), new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.7 }));
  bridge.position.set(0, 21, 62);
  bridge.castShadow = true;
  ship.add(bridge);
  const funnel = new THREE.Mesh(new THREE.BoxGeometry(6, 8, 5), new THREE.MeshStandardMaterial({ color: 0xd9662a, roughness: 0.7 }));
  funnel.position.set(0, 33, 66);
  ship.add(funnel);
  const deckBoxes = [];
  for (let dz = -66; dz < 52; dz += 13) {
    for (const dx of [-8, 0, 8]) {
      const stack = 1 + Math.floor(rand() * 3);
      for (let k = 0; k < stack; k++) deckBoxes.push({ x: dx, y: 12 + k * 2.62, z: dz, tint: palette[Math.floor(rand() * palette.length)] });
    }
  }
  const deckMesh = new THREE.InstancedMesh(containerGeo, containerMat, deckBoxes.length);
  deckBoxes.forEach((b, i) => {
    deckMesh.setMatrixAt(i, mat4(b.x, b.y, b.z, Math.PI / 2));
    deckMesh.setColorAt(i, cc.set(b.tint));
  });
  deckMesh.castShadow = true;
  ship.add(deckMesh);
  ship.position.set(-615, -0.35, 310);
  scene.add(ship);

  const palmGeo = palmGeometry();
  const palmMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
  const palmSpots = [];
  for (let z = -600; z < 600; z += 27) {
    palmSpots.push({ x: -352 + (rand() - 0.5) * 3, z: z + (rand() - 0.5) * 6 });
    if (rand() < 0.7) palmSpots.push({ x: -308 + (rand() - 0.5) * 3, z: z + 13 + (rand() - 0.5) * 6 });
  }
  for (let i = 0; i < 26; i++) {
    palmSpots.push({ x: -344 + rand() * 12, z: -560 + rand() * 640 });
  }
  for (const zx of [80, 280, 460]) {
    for (let x = -190; x < 260; x += 46) {
      if (rand() < 0.6) palmSpots.push({ x: x + (rand() - 0.5) * 8, z: zx + 13.5 });
    }
  }
  const palms = new THREE.InstancedMesh(palmGeo, palmMat, palmSpots.length);
  palmSpots.forEach((p, i) => {
    const s = 0.8 + rand() * 0.5;
    palms.setMatrixAt(i, mat4(p.x, heightAt(p.x, p.z), p.z, rand() * Math.PI * 2, s, s, s));
  });
  palms.castShadow = true;
  scene.add(palms);

  const lampGeo = streetlightGeometry();
  const lampMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.5 });
  const headGeo = new THREE.BoxGeometry(1.0, 0.2, 0.45);
  const headMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, emissive: 0xffc46a, emissiveIntensity: 2.2 });
  const poolGeo = new THREE.CircleGeometry(5.5, 12);
  poolGeo.rotateX(-Math.PI / 2);
  const poolMat = new THREE.MeshBasicMaterial({ color: 0xff9d4a, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false });
  const lamps = [];
  for (let z = -590; z < 600; z += 42) {
    lamps.push({ x: -345, z, ry: 0 });
    lamps.push({ x: -315, z: z + 21, ry: Math.PI });
  }
  for (const road of ROAD_DEFS) {
    if (road.axis !== 'x' || road.at === 280) continue;
    for (let s = road.from + 30; s < road.to; s += 58) {
      lamps.push({ x: s, z: road.at + road.w / 2 + 3, ry: -Math.PI / 2 });
    }
  }
  const lampMesh = new THREE.InstancedMesh(lampGeo, lampMat, lamps.length);
  const headMesh = new THREE.InstancedMesh(headGeo, headMat, lamps.length);
  const poolMesh = new THREE.InstancedMesh(poolGeo, poolMat, lamps.length);
  lamps.forEach((l, i) => {
    const y = heightAt(l.x, l.z);
    lampMesh.setMatrixAt(i, mat4(l.x, y, l.z, l.ry));
    const hx = l.x + Math.cos(l.ry) * 2.6;
    const hz = l.z - Math.sin(l.ry) * 2.6;
    headMesh.setMatrixAt(i, mat4(hx, y + 7.05, hz, l.ry));
    poolMesh.setMatrixAt(i, mat4(hx, y + 0.07, hz));
  });
  scene.add(lampMesh);
  scene.add(headMesh);
  scene.add(poolMesh);

  const beaconGeo = new THREE.SphereGeometry(0.5, 6, 5);
  const beaconMat = new THREE.MeshStandardMaterial({ color: 0x440000, emissive: 0xff2020, emissiveIntensity: 2 });
  const beaconSpots = craneZs.map((z) => ({ x: -505, y: 32.5, z }));
  for (const t of towers) if (t.h > 80) beaconSpots.push({ x: t.x, y: heightAt(t.x, t.z) + t.h + 1.5, z: t.z });
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
    beaconMat.emissiveIntensity = 1.2 + Math.max(0, Math.sin(t * 2.4)) * 2.4;
    if (focus) {
      sun.position.set(focus.x + sunDir.x * 320, focus.y + sunDir.y * 320 + 60, focus.z + sunDir.z * 320);
      sun.target.position.set(focus.x, focus.y, focus.z);
    }
  }

  return { roads: ROAD_DEFS, colliders, spawn, update, sun, skyMat, oceanMat };
}
