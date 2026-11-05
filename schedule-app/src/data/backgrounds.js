// Background themes (Pro): tinted dark backgrounds instead of plain black or
// white. Each one only sets the page, card, border and text colors (the colors
// in styles.css under [data-bg]); the accent still comes from the color theme,
// so any background can be paired with any accent. They are dark by nature, so
// choosing one switches the app to dark mode, and without Pro the app falls
// back to the normal Light / Dark / System setting.
export const BACKGROUNDS = [
  { value: 'default', label: 'Standard', bg: '#0f141a', surface: '#1a212a' },
  { value: 'navy', label: 'Navy', bg: '#0b1526', surface: '#121f36' },
  { value: 'maroon', label: 'Maroon', bg: '#1a0b0e', surface: '#261317' },
  { value: 'plum', label: 'Deep purple', bg: '#140d1f', surface: '#1d1430' },
  { value: 'forest', label: 'Forest', bg: '#0a1812', surface: '#10241b' },
  { value: 'graphite', label: 'Graphite', bg: '#141414', surface: '#1f1f1f' },
  { value: 'espresso', label: 'Espresso', bg: '#17100c', surface: '#221812' },
];

const KNOWN = new Set(BACKGROUNDS.map((b) => b.value));

// The background in force: only while Pro is active, and only a known one.
export function activeBackground(settings) {
  const v = settings?.background || 'default';
  return settings?.isPro && v !== 'default' && KNOWN.has(v) ? v : 'default';
}

// 'light' or 'dark': a background forces dark, otherwise the person's choice.
export function effectiveTheme(settings, systemDark = false) {
  if (activeBackground(settings) !== 'default') return 'dark';
  const t = settings?.theme || 'system';
  return t === 'dark' || (t === 'system' && systemDark) ? 'dark' : 'light';
}

// The colour for the phone's status bar and the browser's theme-color tag.
export function chromeColor(settings, systemDark = false) {
  const bg = activeBackground(settings);
  if (bg !== 'default') return BACKGROUNDS.find((b) => b.value === bg).bg;
  return effectiveTheme(settings, systemDark) === 'dark' ? '#0f141a' : '#eef1f4';
}
