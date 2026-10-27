import { splitLinks } from '../data/linkify.js';

// Note text with its web links made tappable. Everything else stays plain text.
export default function LinkedText({ text }) {
  return splitLinks(text).map((p, i) =>
    p.href ? (
      <a key={i} className="notes-link" href={p.href} target="_blank" rel="noopener noreferrer">
        {p.text}
      </a>
    ) : (
      <span key={i}>{p.text}</span>
    ),
  );
}
