import THREE from 'three';
import { mulberry32, radialTexture } from './utils.js';

const softDot = radialTexture(64, 2.0);

export function createEffects(scene) {
  const rand = mulberry32(99);
  const MAX = 90;
  const positions = new Float32Array(MAX * 3);
  const velocities = new Float32Array(MAX * 3);
  const life = new Float32Array(MAX);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffc860,
    size: 0.22,
    map: softDot,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  let cursor = 0;

  function sparks(x, y, z, count, force) {
    for (let i = 0; i < count; i++) {
      const k = cursor;
      cursor = (cursor + 1) % MAX;
      positions[k * 3] = x;
      positions[k * 3 + 1] = y + 0.4;
      positions[k * 3 + 2] = z;
      velocities[k * 3] = (rand() - 0.5) * force;
      velocities[k * 3 + 1] = rand() * force * 0.7;
      velocities[k * 3 + 2] = (rand() - 0.5) * force;
      life[k] = 0.35 + rand() * 0.4;
    }
  }

  function makePool(color, size, count, gravity, baseOpacity) {
    const p = new Float32Array(count * 3);
    const v = new Float32Array(count * 3);
    const l = new Float32Array(count);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const m = new THREE.PointsMaterial({ color, size, map: softDot, transparent: true, opacity: baseOpacity, blending: THREE.AdditiveBlending, depthWrite: false });
    const mesh = new THREE.Points(g, m);
    mesh.frustumCulled = false;
    scene.add(mesh);
    let cur = 0;
    return {
      fire(x, y, z, n, force, up = 0.4, biasX = 0, biasZ = 0) {
        for (let i = 0; i < n; i++) {
          const k = cur;
          cur = (cur + 1) % count;
          p[k * 3] = x;
          p[k * 3 + 1] = y;
          p[k * 3 + 2] = z;
          v[k * 3] = (rand() - 0.5) * force + biasX;
          v[k * 3 + 1] = rand() * force * up;
          v[k * 3 + 2] = (rand() - 0.5) * force + biasZ;
          l[k] = 0.3 + rand() * 0.45;
        }
      },
      update(dt) {
        let any = false;
        for (let k = 0; k < count; k++) {
          if (l[k] <= 0) { p[k * 3 + 1] = -100; continue; }
          any = true;
          l[k] -= dt;
          v[k * 3 + 1] += gravity * dt;
          p[k * 3] += v[k * 3] * dt;
          p[k * 3 + 1] += v[k * 3 + 1] * dt;
          p[k * 3 + 2] += v[k * 3 + 2] * dt;
        }
        g.attributes.position.needsUpdate = true;
        m.opacity = any ? baseOpacity : 0;
      },
    };
  }

  const chips = makePool(0xbfe4ff, 0.11, 40, -18, 0.9);
  const smokePool = makePool(0x8a8f9a, 0.85, 60, 1.2, 0.32);
  const sprayPool = makePool(0xaebccd, 0.28, 150, -3.5, 0.09);

  const RAIN_N = 420;
  const rainPos = new Float32Array(RAIN_N * 6);
  const rainTip = new Float32Array(RAIN_N * 2);
  const rainSeed = new Float32Array(RAIN_N * 2);
  for (let i = 0; i < RAIN_N; i++) {
    const x = (rand() - 0.5) * 46;
    const y = rand() * 24;
    const z = (rand() - 0.5) * 46;
    const sd = rand();
    for (let k = 0; k < 2; k++) {
      rainPos[(i * 2 + k) * 3] = x;
      rainPos[(i * 2 + k) * 3 + 1] = y;
      rainPos[(i * 2 + k) * 3 + 2] = z;
      rainTip[i * 2 + k] = k;
      rainSeed[i * 2 + k] = sd;
    }
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  rainGeo.setAttribute('aTip', new THREE.BufferAttribute(rainTip, 1));
  rainGeo.setAttribute('aSeed', new THREE.BufferAttribute(rainSeed, 1));
  const rainMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0.55, 0.62, 0.75) },
      uOpacity: { value: 0.22 },
    },
    vertexShader: `
      attribute float aTip;
      attribute float aSeed;
      uniform float uTime;
      varying float vFade;
      void main() {
        vec3 p = position;
        float fall = mod(p.y - uTime * (13.0 + aSeed * 5.0) + aSeed * 24.0, 24.0);
        p.y = fall - 1.0 - aTip * 0.55;
        p.x += aTip * 0.12;
        p.z += aTip * 0.05;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vFade = smoothstep(0.0, 2.0, fall) * (1.0 - smoothstep(20.0, 24.0, fall));
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vFade;
      void main() {
        gl_FragColor = vec4(uColor, uOpacity * vFade);
      }`,
  });
  const rain = new THREE.LineSegments(rainGeo, rainMat);
  rain.frustumCulled = false;
  scene.add(rain);

  function spray(vehicle) {
    const speed = vehicle.speed ?? 0;
    if (speed < 6) return;
    const fx = Math.sin(vehicle.heading);
    const fz = Math.cos(vehicle.heading);
    const rx = Math.cos(vehicle.heading);
    const rz = -Math.sin(vehicle.heading);
    const y = vehicle.groundY();
    const force = 1.1 + speed * 0.03;
    for (const side of [-1, 1]) {
      sprayPool.fire(
        vehicle.x - fx * 1.6 + rx * side * 0.85,
        y + 0.16,
        vehicle.z - fz * 1.6 + rz * side * 0.85,
        1, force, 1.1,
        -fx * speed * 0.16, -fz * speed * 0.16,
      );
    }
  }

  const flashLight = new THREE.PointLight(0xffd7a0, 0, 16);
  scene.add(flashLight);
  let flashTimer = 0;

  const tracerGeo = new THREE.BufferGeometry();
  const tracerPos = new Float32Array(6);
  tracerGeo.setAttribute('position', new THREE.BufferAttribute(tracerPos, 3));
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const tracerLine = new THREE.Line(tracerGeo, tracerMat);
  tracerLine.frustumCulled = false;
  tracerLine.visible = false;
  scene.add(tracerLine);
  let tracerTimer = 0;

  function flash(x, y, z) {
    flashLight.position.set(x, y, z);
    flashLight.intensity = 9;
    flashTimer = 0.06;
  }

  function tracer(x1, y1, z1, x2, y2, z2) {
    tracerPos[0] = x1; tracerPos[1] = y1; tracerPos[2] = z1;
    tracerPos[3] = x2; tracerPos[4] = y2; tracerPos[5] = z2;
    tracerGeo.attributes.position.needsUpdate = true;
    tracerLine.visible = true;
    tracerTimer = 0.05;
  }

  function chip(x, y, z) { chips.fire(x, y, z, 7, 5, 0.8); }
  function smoke(x, y, z) { smokePool.fire(x, y, z, 3, 1.6, 0.9); }

  function update(dt, t = 0, focus = null) {
    rainMat.uniforms.uTime.value = t;
    if (focus) rain.position.set(focus.x, focus.y ?? 0, focus.z);
    let any = false;
    for (let k = 0; k < MAX; k++) {
      if (life[k] <= 0) {
        positions[k * 3 + 1] = -100;
        continue;
      }
      any = true;
      life[k] -= dt;
      velocities[k * 3 + 1] -= 14 * dt;
      positions[k * 3] += velocities[k * 3] * dt;
      positions[k * 3 + 1] += velocities[k * 3 + 1] * dt;
      positions[k * 3 + 2] += velocities[k * 3 + 2] * dt;
    }
    geo.attributes.position.needsUpdate = true;
    mat.opacity = any ? 0.95 : 0;

    chips.update(dt);
    smokePool.update(dt);
    sprayPool.update(dt);
    if (flashTimer > 0) {
      flashTimer -= dt;
      if (flashTimer <= 0) flashLight.intensity = 0;
    }
    if (tracerTimer > 0) {
      tracerTimer -= dt;
      if (tracerTimer <= 0) tracerLine.visible = false;
    }
  }

  return { sparks, flash, tracer, chip, smoke, spray, update };
}

export function createSpeedOverlay(element) {
  return {
    update(speed, impact) {
      const t = Math.max(0, Math.min(1, (speed - 26) / 32));
      element.style.opacity = String(t * 0.55 + impact * 0.4);
    },
  };
}
