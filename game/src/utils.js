import THREE from 'three';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

export function mergeParts(parts) {
  const geos = parts.map((p) => {
    let g = p.geometry.index ? p.geometry.toNonIndexed() : p.geometry.clone();
    if (p.matrix) g.applyMatrix4(p.matrix);
    return { g, color: new THREE.Color(p.color ?? 0xffffff) };
  });
  let total = 0;
  for (const { g } of geos) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  let at = 0;
  for (const { g, color } of geos) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, at * 3);
    nor.set(g.attributes.normal.array, at * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, at * 2);
    for (let i = 0; i < n; i++) {
      col[(at + i) * 3] = color.r;
      col[(at + i) * 3 + 1] = color.g;
      col[(at + i) * 3 + 2] = color.b;
    }
    at += n;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}

export function mat4(x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Matrix4();
  m.compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry),
    new THREE.Vector3(sx, sy, sz),
  );
  return m;
}

export function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function linearCanvasTexture(width, height, draw) {
  const tex = canvasTexture(width, height, draw);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

export function radialTexture(size = 128, power = 2.2) {
  return canvasTexture(size, size, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      g.addColorStop(t, `rgba(255,255,255,${Math.pow(1 - t, power).toFixed(3)})`);
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

export function streakTexture() {
  return canvasTexture(64, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const v = y / (h - 1);
      const along = Math.pow(Math.sin(Math.PI * Math.pow(v, 0.75)), 2.0) * (1 - v * 0.6);
      for (let x = 0; x < w; x++) {
        const u = (x / (w - 1)) * 2 - 1;
        const across = Math.exp(-u * u * 9.0);
        const a = Math.max(0, Math.min(1, along * across));
        const k = (y * w + x) * 4;
        img.data[k] = 255;
        img.data[k + 1] = 255;
        img.data[k + 2] = 255;
        img.data[k + 3] = Math.round(a * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
  });
}

export function beamTexture() {
  return canvasTexture(64, 128, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const v = y / (h - 1);
      const along = Math.pow(1 - v, 1.7) * smoothstep(0, 0.12, v);
      for (let x = 0; x < w; x++) {
        const u = (x / (w - 1)) * 2 - 1;
        const spread = 0.35 + v * 0.65;
        const across = Math.exp(-(u * u) / (spread * spread) * 3.2);
        const a = Math.max(0, Math.min(1, along * across));
        const k = (y * w + x) * 4;
        img.data[k] = 255;
        img.data[k + 1] = 255;
        img.data[k + 2] = 255;
        img.data[k + 3] = Math.round(a * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
  });
}

export function asphaltMaps(rand) {
  const S = 256;
  const height = new Float32Array(S * S);
  const puddle = new Float32Array(S * S);
  const grid = (n) => {
    const g = new Float32Array(n * n);
    for (let i = 0; i < n * n; i++) g[i] = rand();
    return g;
  };
  const sample = (g, n, x, y) => {
    const fx = x * n;
    const fy = y * n;
    const x0 = Math.floor(fx) % n;
    const y0 = Math.floor(fy) % n;
    const x1 = (x0 + 1) % n;
    const y1 = (y0 + 1) % n;
    const tx = fx - Math.floor(fx);
    const ty = fy - Math.floor(fy);
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const a = g[y0 * n + x0];
    const b = g[y0 * n + x1];
    const c = g[y1 * n + x0];
    const d = g[y1 * n + x1];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  const g8 = grid(8);
  const g16 = grid(16);
  const g32 = grid(32);
  const g64 = grid(64);
  const gp = grid(5);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const v = y / S;
      const h = sample(g8, 8, u, v) * 0.4 + sample(g16, 16, u, v) * 0.3 + sample(g32, 32, u, v) * 0.2 + sample(g64, 64, u, v) * 0.1;
      height[y * S + x] = h;
      puddle[y * S + x] = smoothstep(0.36, 0.56, sample(gp, 5, u, v) * 0.7 + sample(g16, 16, u, v) * 0.3);
    }
  }
  const normal = linearCanvasTexture(S, S, (ctx) => {
    const img = ctx.createImageData(S, S);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const l = height[y * S + ((x - 1 + S) % S)];
        const r = height[y * S + ((x + 1) % S)];
        const d = height[((y - 1 + S) % S) * S + x];
        const u = height[((y + 1) % S) * S + x];
        const nx = (l - r) * 2.2;
        const ny = (d - u) * 2.2;
        const nz = 1;
        const il = 1 / Math.hypot(nx, ny, nz);
        const k = (y * S + x) * 4;
        img.data[k] = Math.round((nx * il * 0.5 + 0.5) * 255);
        img.data[k + 1] = Math.round((ny * il * 0.5 + 0.5) * 255);
        img.data[k + 2] = Math.round((nz * il * 0.5 + 0.5) * 255);
        img.data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  const rough = linearCanvasTexture(S, S, (ctx) => {
    const img = ctx.createImageData(S, S);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const p = puddle[y * S + x];
        const fine = sample(g64, 64, x / S, y / S);
        const r = clamp(0.38 - p * 0.3 + (fine - 0.5) * 0.1, 0.05, 1);
        const c = Math.round(r * 255);
        const k = (y * S + x) * 4;
        img.data[k] = c;
        img.data[k + 1] = c;
        img.data[k + 2] = c;
        img.data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  for (const t of [normal, rough]) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
  }
  return { normal, rough };
}
