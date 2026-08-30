// Basemap choices.
//
// All of these are free, keyless raster tile services, which is the whole
// constraint: Keystone has no server and no API budget, so anything needing
// a token (Mapbox, Google, Thunderforest) is out. Esri's World Imagery and
// Light/Dark Gray Canvas are the standard no-key options, and each requires
// its attribution to be shown — hence the `attribution` field being
// mandatory rather than decorative.
//
// Carto's Positron/Dark Matter tiles used to live here instead of the Esri
// Canvas ones — Carto gated basemaps.cartocdn.com behind a required API key
// at some point after this was written, and unauthenticated requests now
// come back as a visible "API KEY REQUIRED" watermark tile instead of an
// error, which is why it looked like the map was just broken rather than
// misconfigured.
//
// 'auto' isn't in this list because it isn't a tile source: it resolves to
// positron or dark depending on the app theme (see resolveMapStyle). A bright
// white map inside a dark-themed app is the single most jarring thing about
// the map page, and matching it automatically is what most people want
// without having to think about it.
export const MAP_STYLES = {
  standard: {
    label: 'Standard',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  },
  positron: {
    label: 'Light',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 16,
    attribution: 'Esri, HERE, Garmin, &copy; OpenStreetMap contributors',
  },
  dark: {
    label: 'Dark',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 16,
    attribution: 'Esri, HERE, Garmin, &copy; OpenStreetMap contributors',
  },
  satellite: {
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
    attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
  },
};

export const MAP_STYLE_OPTIONS = [
  { value: 'auto', label: 'Match app theme' },
  ...Object.entries(MAP_STYLES).map(([value, s]) => ({ value, label: s.label })),
];

// `dark` is whether the app is currently rendering its dark palette — the
// caller knows this (it's already resolving system vs explicit theme), so
// this stays a pure function rather than reading the DOM itself.
export function resolveMapStyle(setting, dark) {
  if (!setting || setting === 'auto') return MAP_STYLES[dark ? 'dark' : 'positron'];
  return MAP_STYLES[setting] || MAP_STYLES.standard;
}
