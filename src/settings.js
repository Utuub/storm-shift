// Player settings, kept in localStorage. Everything has a working default
// so the game runs fine if storage is blocked.
const KEY = 'stormshift.settings.v1';

export const ACTIONS = [
  ['forward', 'Move forward'], ['back', 'Move back'], ['left', 'Strafe left'], ['right', 'Strafe right'],
  ['sprint', 'Sprint'], ['jump', 'Jump'], ['crouch', 'Crouch (hold)'],
  ['interact', 'Talk / unload into cart'], ['drop', 'Drop item'],
  ['cart', 'Push cart'], ['checklist', 'Checklist'],
];

export const DEFAULTS = {
  sensitivity: 1.0,
  invertY: false,
  fov: 75,
  renderScale: 1.0,
  shadows: true,
  showFps: false,
  fullscreen: true,
  master: 0.8,
  sfx: 0.8,
  ambient: 0.6,
  music: 0.45,
  binds: {
    forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', sprint: 'ShiftLeft',
    jump: 'Space', crouch: 'KeyC', interact: 'KeyE', drop: 'KeyQ', cart: 'KeyF', checklist: 'Tab',
  },
};

export function loadSettings() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { /* storage blocked */ }
  const binds = { ...DEFAULTS.binds };
  // keep only actions that still exist
  for (const [a, code] of Object.entries(saved.binds || {})) if (a in binds) binds[a] = code;
  return { ...DEFAULTS, ...saved, binds };
}

export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked */ }
}

// "KeyW" -> "W", "ShiftLeft" -> "L-Shift"
export function keyLabel(code) {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map = {
    ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl',
    AltLeft: 'L-Alt', AltRight: 'R-Alt', Space: 'Space', Tab: 'Tab', CapsLock: 'Caps',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Backquote: '`', Enter: 'Enter',
  };
  return map[code] || code;
}
