import { WORLD } from './config.js';

const SIZE = 200;
const SCALE = 0.36;

export function createMinimap(world) {
  const canvas = document.getElementById('minimap');
  const ctx = canvas.getContext('2d');
  const half = SIZE / 2;

  function draw(car, waypoint, t, extras = {}) {
    const a = car.heading;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const px = car.x;
    const pz = car.z;
    const tx = (x, z) => {
      const dx = x - px;
      const dz = z - pz;
      return [half + (dx * ca - dz * sa) * SCALE, half - (dx * sa + dz * ca) * SCALE];
    };

    ctx.clearRect(0, 0, SIZE, SIZE);
    const land = ctx.createLinearGradient(0, 0, SIZE, SIZE);
    land.addColorStop(0, '#161c28');
    land.addColorStop(1, '#10151f');
    ctx.fillStyle = land;
    ctx.fillRect(0, 0, SIZE, SIZE);

    const water = [[-2400, -2400], [WORLD.coastX, -2400], [WORLD.coastX, 2400], [-2400, 2400]];
    ctx.beginPath();
    water.forEach(([x, z], i) => {
      const [sx, sy] = tx(x, z);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    ctx.closePath();
    const sea = ctx.createLinearGradient(0, 0, SIZE, 0);
    sea.addColorStop(0, '#0e2a40');
    sea.addColorStop(1, '#123a54');
    ctx.fillStyle = sea;
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,190,220,0.35)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    const pier = [
      [WORLD.pierMinX, WORLD.pierMinZ],
      [WORLD.coastX, WORLD.pierMinZ],
      [WORLD.coastX, WORLD.pierMaxZ],
      [WORLD.pierMinX, WORLD.pierMaxZ],
    ];
    ctx.beginPath();
    pier.forEach(([x, z], i) => {
      const [sx, sy] = tx(x, z);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    ctx.closePath();
    ctx.fillStyle = '#232a34';
    ctx.fill();
    ctx.strokeStyle = 'rgba(150,160,175,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#242b39';
    for (const b of world.colliders) {
      const [x0, y0] = tx(b.minX, b.minZ);
      const [x1, y1] = tx(b.maxX, b.maxZ);
      const minX = Math.min(x0, x1);
      const minY = Math.min(y0, y1);
      const w = Math.abs(x1 - x0);
      const h = Math.abs(y1 - y0);
      if (minX > SIZE || minY > SIZE || minX + w < 0 || minY + h < 0) continue;
      ctx.fillRect(minX, minY, Math.max(w, 1.2), Math.max(h, 1.2));
    }

    ctx.lineCap = 'round';
    for (const road of world.roads) {
      const x1 = road.axis === 'z' ? road.at : road.from;
      const z1 = road.axis === 'z' ? road.from : road.at;
      const x2 = road.axis === 'z' ? road.at : road.to;
      const z2 = road.axis === 'z' ? road.to : road.at;
      const [sx1, sy1] = tx(x1, z1);
      const [sx2, sy2] = tx(x2, z2);
      ctx.beginPath();
      ctx.moveTo(sx1, sy1);
      ctx.lineTo(sx2, sy2);
      ctx.strokeStyle = '#0b0e15';
      ctx.lineWidth = Math.max(3, road.w * SCALE) + 2;
      ctx.stroke();
    }
    for (const road of world.roads) {
      const x1 = road.axis === 'z' ? road.at : road.from;
      const z1 = road.axis === 'z' ? road.from : road.at;
      const x2 = road.axis === 'z' ? road.at : road.to;
      const z2 = road.axis === 'z' ? road.to : road.at;
      const [sx1, sy1] = tx(x1, z1);
      const [sx2, sy2] = tx(x2, z2);
      ctx.beginPath();
      ctx.moveTo(sx1, sy1);
      ctx.lineTo(sx2, sy2);
      ctx.strokeStyle = road.w >= 24 ? '#6a7488' : '#4a5265';
      ctx.lineWidth = Math.max(2, road.w * SCALE);
      ctx.stroke();
      if (road.w >= 24) {
        ctx.beginPath();
        ctx.moveTo(sx1, sy1);
        ctx.lineTo(sx2, sy2);
        ctx.strokeStyle = 'rgba(216,180,90,0.55)';
        ctx.lineWidth = 0.8;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    if (extras.search) {
      const [sx, sy] = tx(extras.search.x, extras.search.z);
      const r = extras.search.r * SCALE;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(77,141,255,0.12)';
      ctx.fill();
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = 'rgba(127,178,255,0.7)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (extras.police) {
      for (const p of extras.police) {
        const [sx, sy] = tx(p.x, p.z);
        if (sx < -6 || sy < -6 || sx > SIZE + 6 || sy > SIZE + 6) continue;
        ctx.beginPath();
        ctx.arc(sx, sy, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = Math.sin(t * 9) > 0 ? '#ff4444' : '#4d8dff';
        ctx.fill();
        ctx.strokeStyle = '#f2f6ff';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }

    if (extras.hostiles) {
      for (const h of extras.hostiles) {
        const [sx, sy] = tx(h.x, h.z);
        if (sx < -6 || sy < -6 || sx > SIZE + 6 || sy > SIZE + 6) continue;
        ctx.beginPath();
        ctx.arc(sx, sy, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ff3a7a';
        ctx.fill();
        ctx.strokeStyle = '#160810';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    if (extras.markers) {
      for (const m of extras.markers) {
        const [mx, my] = tx(m.x, m.z);
        const cx = Math.max(10, Math.min(SIZE - 10, mx));
        const cy = Math.max(10, Math.min(SIZE - 10, my));
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,176,84,0.8)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, 1.6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,176,84,0.8)';
        ctx.fill();
      }
    }

    if (extras.heli) {
      const [sx, sy] = tx(extras.heli.x, extras.heli.z);
      ctx.strokeStyle = '#ffd9a0';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(sx, sy, 4.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx - 6.5, sy);
      ctx.lineTo(sx + 6.5, sy);
      ctx.moveTo(sx, sy - 6.5);
      ctx.lineTo(sx, sy + 6.5);
      ctx.stroke();
    }

    if (waypoint) {
      const [wx, wy] = tx(waypoint.x, waypoint.z);
      const cx = Math.max(12, Math.min(SIZE - 12, wx));
      const cy = Math.max(12, Math.min(SIZE - 12, wy));
      const pulse = 4 + Math.sin(t * 5) * 1.2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - pulse - 2);
      ctx.lineTo(cx + pulse + 2, cy);
      ctx.lineTo(cx, cy + pulse + 2);
      ctx.lineTo(cx - pulse - 2, cy);
      ctx.closePath();
      ctx.fillStyle = '#ffb054';
      ctx.fill();
      ctx.strokeStyle = '#3a2a10';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.save();
    ctx.shadowColor = 'rgba(90,160,255,0.9)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(half, half - 7.5);
    ctx.lineTo(half + 5.5, half + 6.5);
    ctx.lineTo(half, half + 3.5);
    ctx.lineTo(half - 5.5, half + 6.5);
    ctx.closePath();
    ctx.fillStyle = '#f2f7ff';
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#1e5fd8';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    const nx = half + sa * (half - 11);
    const ny = half + ca * (half - 11);
    ctx.beginPath();
    ctx.arc(nx, ny - 3, 7, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10,14,22,0.8)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,176,84,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,200,130,0.95)';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('N', nx, ny);
  }

  return { draw };
}
