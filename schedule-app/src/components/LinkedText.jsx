import { splitLinks, isCanvasLink } from '../data/linkify.js';
import { openCanvasLink } from '../data/nativeBridge.js';
import { useStore } from '../data/store.jsx';

// Note text with its web links made tappable. Everything else stays plain text.
// A Canvas link opens in the Canvas Student app when it is installed.
export default function LinkedText({ text }) {
  const { state } = useStore();
  const feedUrl = state.settings?.canvasFeedUrl;
  const open = async (e, href) => {
    if (!isCanvasLink(href, feedUrl)) return;
    e.preventDefault();
    if (!(await openCanvasLink(href))) window.open(href, '_blank', 'noopener,noreferrer');
  };
  return splitLinks(text).map((p, i) =>
    p.href ? (
      <a key={i} className="notes-link" href={p.href} target="_blank" rel="noopener noreferrer" onClick={(e) => open(e, p.href)}>
        {p.text}
      </a>
    ) : (
      <span key={i}>{p.text}</span>
    ),
  );
}
