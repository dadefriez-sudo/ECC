// "Looks": whole-app styles that go beyond a color scheme. Two are free (the
// default light and dark themes) and two are Pro: Heritage Crimson (parchment,
// burgundy and navy, with serif headings) and Midnight Navy (deep navy with
// gold). A Pro look sets its own light or dark mode, and it falls back to the
// default look if Pro isn't active, so a lapsed purchase never leaves the app
// stuck in a look the person can't change.
export const LOOKS = [
  {
    id: 'light',
    name: 'Default Light',
    note: 'Keystone as it comes',
    pro: false,
    theme: 'light',
    skin: 'default',
    swatch: { bg: '#eef1f4', card: '#ffffff', head: '#eef1f4', accent: '#946f16', text: '#1a2430' },
  },
  {
    id: 'dark',
    name: 'Dark Slate',
    note: 'Easy on the eyes at night',
    pro: false,
    theme: 'dark',
    skin: 'default',
    swatch: { bg: '#0f141a', card: '#1a212a', head: '#0f141a', accent: '#e0c15a', text: '#e6ebf0' },
  },
  {
    id: 'heritage',
    name: 'Heritage Crimson',
    note: 'Parchment, burgundy and navy',
    pro: true,
    theme: 'light',
    skin: 'heritage',
    swatch: { bg: '#fbf9f6', card: '#ffffff', head: '#7a1c24', accent: '#7a1c24', text: '#1a202c' },
  },
  {
    id: 'midnight',
    name: 'Midnight Navy',
    note: 'Deep navy with gold',
    pro: true,
    theme: 'dark',
    skin: 'midnight',
    swatch: { bg: '#0e1a2e', card: '#16243b', head: '#0a1424', accent: '#d4a93a', text: '#edf1f7' },
  },
];

const PRO_SKINS = new Set(['heritage', 'midnight']);

// The skin in force: a Pro skin only counts while Pro is active.
export function activeSkin(settings) {
  const skin = settings?.skin || 'default';
  return settings?.isPro && PRO_SKINS.has(skin) ? skin : 'default';
}

// 'light' or 'dark'. A Pro skin decides this itself; otherwise the person's
// Light / Dark / System choice does.
export function effectiveTheme(settings, systemDark = false) {
  const skin = activeSkin(settings);
  if (skin === 'heritage') return 'light';
  if (skin === 'midnight') return 'dark';
  const t = settings?.theme || 'system';
  return t === 'dark' || (t === 'system' && systemDark) ? 'dark' : 'light';
}

// Which card in the Look picker is selected.
export function currentLookId(settings, systemDark = false) {
  const skin = activeSkin(settings);
  if (skin !== 'default') return skin;
  return effectiveTheme(settings, systemDark) === 'dark' ? 'dark' : 'light';
}

// The colour for the phone's status bar and the browser's theme-color tag.
export function chromeColor(settings, systemDark = false) {
  const skin = activeSkin(settings);
  if (skin === 'heritage') return '#7a1c24';
  if (skin === 'midnight') return '#0a1424';
  return effectiveTheme(settings, systemDark) === 'dark' ? '#0f141a' : '#eef1f4';
}

// The settings change that picks a look.
// The two Pro looks also switch Home to the Tracker layout, so they come as a
// complete style. The layout can be changed again from Home or Settings.
export function settingsForLook(look) {
  return look.skin === 'default' ? { skin: 'default', theme: look.theme } : { skin: look.skin, homeStyle: 'tracker' };
}
