import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import Icon from './Icon.jsx';
import { hexToHsl, hslToHex, normalizeHex } from '../data/colorUtils.js';
import { selectTick } from '../data/haptics.js';

// Colours chosen to read on both the light and dark themes: reds and oranges, greens, blues and
// purples, then pinks and neutrals.
export const PICKER_COLORS = [
  '#d1384a', '#d9552b', '#e08a1e', '#c99a06', '#a8642a', '#8a6d3b',
  '#6aa11f', '#2a9d6f', '#2e9e6b', '#3a9188', '#14a3b8', '#1f8aa8',
  '#2f7fd1', '#1f5f8b', '#4c5bd4', '#5b7fb0', '#8a5cd6', '#6d4aa8',
  '#d94f86', '#c2547a', '#b0476a', '#5d7389', '#7a8794', '#3d4852',
];

// A colour swatch that opens an in-app picker (a grid of good colours, plus sliders for any other
// colour) instead of the phone's built-in dialog, which is out of place and hard to use.
export default function ColorPicker({ value, onChange, label = 'Color', title = 'Pick a color' }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [hsl, setHsl] = useState(() => hexToHsl(value));
  const [hexText, setHexText] = useState(value);

  useEffect(() => {
    if (!open) return;
    setCustom(false);
    setHsl(hexToHsl(value));
    setHexText(value);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = (normalizeHex(value) || value || '').toLowerCase();
  const draft = hslToHex(hsl);
  const choose = (hex) => {
    selectTick();
    onChange(hex);
    setOpen(false);
  };
  const setPart = (part, n) => {
    const next = { ...hsl, [part]: Number(n) };
    setHsl(next);
    setHexText(hslToHex(next));
  };
  const typeHex = (text) => {
    setHexText(text);
    const n = normalizeHex(text);
    if (n) setHsl(hexToHsl(n));
  };

  return (
    <>
      <button type="button" className="color-swatch-btn" aria-label={label} onClick={() => setOpen(true)}>
        <span style={{ background: value }} />
      </button>
      <Modal open={open} title={title} onClose={() => setOpen(false)}>
        <div className="color-grid" role="listbox" aria-label={title}>
          {PICKER_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="option"
              aria-selected={c === current}
              aria-label={c}
              className={`color-cell${c === current ? ' color-cell--on' : ''}`}
              style={{ background: c }}
              onClick={() => choose(c)}
            >
              {c === current && <Icon name="check" size={18} />}
            </button>
          ))}
        </div>
        {!custom ? (
          <button type="button" className="btn btn-ghost full" onClick={() => setCustom(true)}>
            Custom color…
          </button>
        ) : (
          <div className="color-custom">
            <div className="color-custom-head">
              <span className="color-preview" style={{ background: draft }} />
              <input
                className="color-hex"
                value={hexText}
                onChange={(e) => typeHex(e.target.value)}
                aria-label="Hex color"
                maxLength={7}
                spellCheck={false}
                autoCapitalize="off"
              />
            </div>
            <label className="color-slider">
              <span>Hue</span>
              <input
                type="range" min="0" max="360" value={hsl.h}
                onChange={(e) => setPart('h', e.target.value)}
                style={{ background: 'linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)' }}
              />
            </label>
            <label className="color-slider">
              <span>Strength</span>
              <input
                type="range" min="0" max="100" value={hsl.s}
                onChange={(e) => setPart('s', e.target.value)}
                style={{ background: `linear-gradient(90deg,${hslToHex({ ...hsl, s: 0 })},${hslToHex({ ...hsl, s: 100 })})` }}
              />
            </label>
            <label className="color-slider">
              <span>Lightness</span>
              <input
                type="range" min="10" max="90" value={hsl.l}
                onChange={(e) => setPart('l', e.target.value)}
                style={{ background: `linear-gradient(90deg,${hslToHex({ ...hsl, l: 10 })},${hslToHex({ ...hsl, l: 50 })},${hslToHex({ ...hsl, l: 90 })})` }}
              />
            </label>
            <button type="button" className="btn btn-primary full" onClick={() => choose(normalizeHex(hexText) || draft)}>
              Use this color
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}
