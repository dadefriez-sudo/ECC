// Splits note text into plain pieces and tappable links. Handles the
// markdown-style `[label](https://…)` that Canvas puts in assignment notes and
// bare https links. Only http(s) is ever turned into a link.
const PATTERN = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>()\[\]]+)/gi;
const TRAILING = /[.,;:!?'"]+$/;

export function splitLinks(text) {
  const src = String(text ?? '');
  const parts = [];
  let last = 0;
  for (const m of src.matchAll(PATTERN)) {
    if (m.index > last) parts.push({ text: src.slice(last, m.index) });
    if (m[2]) {
      parts.push({ text: m[1], href: m[2] });
    } else {
      const url = m[3].replace(TRAILING, '');
      parts.push({ text: url, href: url });
      if (url.length < m[3].length) parts.push({ text: m[3].slice(url.length) });
    }
    last = m.index + m[0].length;
  }
  if (last < src.length) parts.push({ text: src.slice(last) });
  return parts;
}

// A Canvas address: *.instructure.com, or the same site as the person's own
// Calendar Feed link (some schools use their own domain).
export function isCanvasLink(href, feedUrl) {
  try {
    const host = new URL(href).hostname.toLowerCase();
    if (host === 'instructure.com' || host.endsWith('.instructure.com')) return true;
    return !!feedUrl && host === new URL(feedUrl).hostname.toLowerCase();
  } catch {
    return false;
  }
}
