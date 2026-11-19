const KEYMAP = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  Space: 'handbrake',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
  KeyR: 'reset',
  KeyF: 'enter',
  Escape: 'pause',
  Enter: 'confirm',
  KeyH: 'horn',
  KeyQ: 'aim',
  KeyZ: 'fire',
  KeyE: 'interact',
  KeyV: 'reload',
  KeyTab: 'map',
};

const MOUSEMAP = { 0: 'fire', 2: 'aim' };

export function createInput() {
  const held = new Set();
  const pressed = new Set();
  const prevent = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);
  let lookX = 0;
  let lookY = 0;

  window.addEventListener('keydown', (e) => {
    const action = KEYMAP[e.code];
    if (!action) return;
    if (prevent.has(e.code)) e.preventDefault();
    if (!e.repeat) {
      pressed.add(action);
      if (window.__inputLog) window.__inputLog.push({ type: 'press', action, size: pressed.size, t: performance.now() });
    }
    held.add(action);
  });
  window.addEventListener('keyup', (e) => {
    const action = KEYMAP[e.code];
    if (action) held.delete(action);
  });
  window.addEventListener('mousedown', (e) => {
    const action = MOUSEMAP[e.button];
    if (!action) return;
    if (!e.repeat) pressed.add(action);
    held.add(action);
  });
  window.addEventListener('mouseup', (e) => {
    const action = MOUSEMAP[e.button];
    if (action) held.delete(action);
  });
  window.addEventListener('mousemove', (e) => {
    lookX += e.movementX || 0;
    lookY += e.movementY || 0;
  });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('blur', () => { held.clear(); lookX = 0; lookY = 0; });

  return {
    down: (action) => held.has(action),
    takePressed(action) {
      const had = pressed.has(action);
      pressed.delete(action);
      if (window.__inputLog) window.__inputLog.push({ type: 'take', action, had, t: performance.now() });
      return had;
    },
    look() {
      return { dx: lookX, dy: lookY };
    },
    endStep() {
      pressed.clear();
    },
    endFrame() {
      lookX = 0;
      lookY = 0;
    },
    throttle() {
      return (held.has('up') ? 1 : 0) - (held.has('down') ? 1 : 0);
    },
    steer() {
      return (held.has('left') ? 1 : 0) - (held.has('right') ? 1 : 0);
    },
    handbrake: () => held.has('handbrake'),
  };
}
