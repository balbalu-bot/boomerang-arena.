// Impostazioni persistenti (salvate nel browser del dispositivo).

const KEY = 'bba-settings-v1';

export const DEFAULT_KEYS = {
  up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD',
  dash: 'Space', melee: 'KeyF', interact: 'KeyE', special: 'KeyQ',
  throwKey: 'KeyJ', pause: 'Escape',
};

const DEFAULTS = {
  lang: 'it',
  // bassa | media | alta — sui dispositivi touch si parte da "bassa" per fluidità
  quality: (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches) ? 'bassa' : 'media',
  music: 0.5,
  sfx: 0.8,
  showAim: true,
  screenShake: true,
  keys: { ...DEFAULT_KEYS },
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const s = JSON.parse(raw);
    return { ...structuredClone(DEFAULTS), ...s, keys: { ...DEFAULT_KEYS, ...(s.keys || {}) } };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export const settings = load();

export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* memoria non disponibile */ }
}

export function resetKeys() {
  settings.keys = { ...DEFAULT_KEYS };
  saveSettings();
}
