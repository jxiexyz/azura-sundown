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
  Escape: 'pause',
  Enter: 'confirm',
  KeyH: 'horn',
};

export function createInput() {
  const held = new Set();
  const pressed = new Set();
  const prevent = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

  window.addEventListener('keydown', (e) => {
    const action = KEYMAP[e.code];
    if (!action) return;
    if (prevent.has(e.code)) e.preventDefault();
    if (!e.repeat) pressed.add(action);
    held.add(action);
  });
  window.addEventListener('keyup', (e) => {
    const action = KEYMAP[e.code];
    if (action) held.delete(action);
  });
  window.addEventListener('blur', () => held.clear());

  return {
    down: (action) => held.has(action),
    takePressed(action) {
      const had = pressed.has(action);
      pressed.delete(action);
      return had;
    },
    endFrame() {
      pressed.clear();
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
