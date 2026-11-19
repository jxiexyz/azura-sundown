import { WORLD } from './config.js';

const SIZE = 200;
const SCALE = 0.36;

export function createMinimap(world) {
  const canvas = document.getElementById('minimap');
  const ctx = canvas.getContext('2d');
  const half = SIZE / 2;

  function draw(car, waypoint, t) {
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
    ctx.fillStyle = '#0d1119';
    ctx.fillRect(0, 0, SIZE, SIZE);

    const water = [[-2400, -2400], [WORLD.coastX, -2400], [WORLD.coastX, 2400], [-2400, 2400]];
    ctx.beginPath();
    water.forEach(([x, z], i) => {
      const [sx, sy] = tx(x, z);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    ctx.closePath();
    ctx.fillStyle = '#12293e';
    ctx.fill();

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

    ctx.fillStyle = '#272e3c';
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
      ctx.strokeStyle = road.w >= 24 ? '#5a6375' : '#454d5e';
      ctx.lineWidth = Math.max(2, road.w * SCALE);
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    if (waypoint) {
      const [wx, wy] = tx(waypoint.x, waypoint.z);
      const cx = Math.max(12, Math.min(SIZE - 12, wx));
      const cy = Math.max(12, Math.min(SIZE - 12, wy));
      const pulse = 4 + Math.sin(t * 5) * 1.4;
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

    ctx.beginPath();
    ctx.moveTo(half, half - 7);
    ctx.lineTo(half + 5, half + 6);
    ctx.lineTo(half, half + 3);
    ctx.lineTo(half - 5, half + 6);
    ctx.closePath();
    ctx.fillStyle = '#eaf2ff';
    ctx.fill();
    ctx.strokeStyle = '#1e5fd8';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    const nx = half + sa * (half - 10);
    const ny = half + ca * (half - 10);
    ctx.fillStyle = 'rgba(255,176,84,0.9)';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('N', nx, ny + 3);
  }

  return { draw };
}
