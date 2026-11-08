// Map pictures kept on the phone, so places you have already looked at still show with
// no signal. Tiles go into the browser's Cache Storage as they are viewed; nothing is
// downloaded ahead of time (the free tile servers don't allow bulk downloads). The cache
// is capped, and the oldest tiles are dropped first once it is full.
const CACHE_NAME = 'keystone-map-tiles-v1';
export const MAX_TILES = 2000;
const PRUNE_EVERY = 25;
const APPROX_TILE_KB = 20;

const available = () => typeof caches !== 'undefined' && typeof URL !== 'undefined' && !!URL.createObjectURL;

let putsSincePrune = 0;
async function prune(cache) {
  const keys = await cache.keys();
  const extra = keys.length - MAX_TILES;
  for (let i = 0; i < extra; i++) await cache.delete(keys[i]);
}

// A blob: URL for the tile at `src`: from the cache if it is there, otherwise from the
// network (and saved). Rejects when neither works, so the caller can fall back.
export async function tileObjectUrl(src) {
  if (!available()) throw new Error('no cache');
  const cache = await caches.open(CACHE_NAME);
  let res = await cache.match(src);
  if (!res) {
    res = await fetch(src, { mode: 'cors' });
    if (!res.ok) throw new Error(`tile ${res.status}`);
    cache.put(src, res.clone()).catch(() => {});
    if (++putsSincePrune >= PRUNE_EVERY) {
      putsSincePrune = 0;
      prune(cache).catch(() => {});
    }
  }
  return URL.createObjectURL(await res.blob());
}

// A Leaflet tile layer that reads through the cache above. Same options as L.tileLayer.
export function cachedTileLayer(L, url, options = {}) {
  const Layer = L.TileLayer.extend({
    createTile(coords, done) {
      const img = document.createElement('img');
      img.alt = '';
      img.setAttribute('role', 'presentation');
      const src = this.getTileUrl(coords);
      let blobUrl = '';
      img.onload = () => {
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        done(null, img);
      };
      img.onerror = (e) => done(e, img);
      tileObjectUrl(src)
        .then((u) => {
          blobUrl = u;
          img.src = u;
        })
        // Not cacheable here (no Cache Storage, or the server refused a cross-origin read):
        // draw it the ordinary way.
        .catch(() => {
          img.src = src;
        });
      return img;
    },
  });
  // One subdomain only, so a tile has one address and one cache entry.
  return new Layer(url, { subdomains: ['a'], ...options });
}

export async function tileCacheStats() {
  if (!available()) return { tiles: 0, approxMB: 0 };
  try {
    const keys = await (await caches.open(CACHE_NAME)).keys();
    return { tiles: keys.length, approxMB: Math.round((keys.length * APPROX_TILE_KB) / 1024) };
  } catch {
    return { tiles: 0, approxMB: 0 };
  }
}

export async function clearTileCache() {
  if (!available()) return;
  try {
    await caches.delete(CACHE_NAME);
  } catch {
    /* nothing to clear */
  }
}
