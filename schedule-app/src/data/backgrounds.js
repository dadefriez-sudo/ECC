// Background themes (Pro): tinted backgrounds instead of plain black or white.
// Each one only sets the page, card, border and text colors (the colors in
// styles.css under [data-bg]); the accent still comes from the color theme, so
// any background can be paired with any accent. Each is either light or dark by
// nature (`mode`), so choosing one switches the app to that mode, and without
// Pro the app falls back to the normal Light / Dark / System setting.
export const BACKGROUNDS = [
  { value: 'default', label: 'Standard', bg: '#0f141a', surface: '#1a212a', mode: 'dark' },
  { value: 'cream', label: 'Cream', bg: '#f5efe2', surface: '#fffdf8', mode: 'light' },
  { value: 'navy', label: 'Navy', bg: '#0b1526', surface: '#121f36', mode: 'dark' },
  { value: 'maroon', label: 'Maroon', bg: '#1a0b0e', surface: '#261317', mode: 'dark' },
  { value: 'plum', label: 'Midnight purple', bg: '#0d0b17', surface: '#151226', mode: 'dark' },
  { value: 'forest', label: 'Forest', bg: '#0a1812', surface: '#10241b', mode: 'dark' },
  { value: 'graphite', label: 'Graphite', bg: '#141414', surface: '#1f1f1f', mode: 'dark' },
  { value: 'espresso', label: 'Espresso', bg: '#17100c', surface: '#221812', mode: 'dark' },
];

const KNOWN = new Set(BACKGROUNDS.map((b) => b.value));

// The background in force: only while Pro is active, and only a known one.
export function activeBackground(settings) {
  const v = settings?.background || 'default';
  return settings?.isPro && v !== 'default' && KNOWN.has(v) ? v : 'default';
}

// 'light' or 'dark': a background brings its own mode, otherwise the person's choice.
export function effectiveTheme(settings, systemDark = false) {
  const bg = activeBackground(settings);
  if (bg !== 'default') return BACKGROUNDS.find((b) => b.value === bg).mode;
  const t = settings?.theme || 'system';
  return t === 'dark' || (t === 'system' && systemDark) ? 'dark' : 'light';
}

// The colour for the phone's status bar and the browser's theme-color tag.
export function chromeColor(settings, systemDark = false) {
  const bg = activeBackground(settings);
  if (bg !== 'default') return BACKGROUNDS.find((b) => b.value === bg).bg;
  return effectiveTheme(settings, systemDark) === 'dark' ? '#0f141a' : '#eef1f4';
}
