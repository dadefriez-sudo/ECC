import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import Modal from './Modal.jsx';
import { LOOKS, currentLookId, settingsForLook } from '../data/looks.js';
import { selectTick } from '../data/haptics.js';

// A small drawn preview of a look: header band, a card with a title line and a
// progress bar, and the tab bar. It uses the look's own colors, so each card
// shows what the app will really look like.
function Preview({ swatch }) {
  const line = (w, c, h = 5) => <i style={{ display: 'block', width: w, height: h, borderRadius: 3, background: c }} />;
  return (
    <div className="look-preview" style={{ background: swatch.bg }} aria-hidden="true">
      <div className="look-preview-head" style={{ background: swatch.head }}>
        {line('46%', swatch.head === swatch.bg ? swatch.text : '#ffffff', 5)}
      </div>
      <div className="look-preview-card" style={{ background: swatch.card }}>
        {line('62%', swatch.text, 5)}
        {line('90%', swatch.text, 3)}
        <div style={{ height: 5, borderRadius: 3, background: `${swatch.text}22`, overflow: 'hidden' }}>
          <i style={{ display: 'block', width: '55%', height: '100%', background: swatch.accent }} />
        </div>
      </div>
      <div className="look-preview-tabs" style={{ background: swatch.card }}>
        <i style={{ width: 14, height: 3, borderRadius: 2, background: swatch.accent }} />
        <i style={{ width: 8, height: 8, borderRadius: 4, background: `${swatch.text}33` }} />
        <i style={{ width: 8, height: 8, borderRadius: 4, background: `${swatch.text}33` }} />
      </div>
    </div>
  );
}

// Non-blocking: it explains what Pro adds and lets the person carry on free.
export function PremiumThemeModal({ open, onClose }) {
  const navigate = useNavigate();
  return (
    <Modal open={open} title="Unlock Premium Themes" onClose={onClose}>
      <div className="form">
        <p className="muted">
          Heritage Crimson and Midnight Navy are part of Keystone Pro, a one-time purchase with no
          subscription.
        </p>
        <ul className="premium-points">
          <li><Icon name="check" size={16} /> <span><b>Two premium looks</b> with their own colors, serif headings and layout touches</span></li>
          <li><Icon name="check" size={16} /> <span><b>Calm, readable pages</b> built around clear type and plenty of space</span></li>
          <li><Icon name="check" size={16} /> <span><b>Everything else in Pro</b>: contact timelines, goal history, 22 color themes and more</span></li>
        </ul>
        <button
          className="btn btn-primary full premium-upgrade"
          onClick={() => {
            onClose();
            navigate('/pricing');
          }}
        >
          Upgrade to Pro
        </button>
        <button className="btn btn-ghost full premium-dismiss" onClick={onClose}>
          Continue free
        </button>
      </div>
    </Modal>
  );
}

export default function LookPicker({ settings, isPro, onPick }) {
  const [paywall, setPaywall] = useState(false);
  const systemDark = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const current = currentLookId(settings, systemDark);
  return (
    <>
      <p className="muted small color-scheme-label">Look</p>
      <div className="look-grid" role="radiogroup" aria-label="Look">
        {LOOKS.map((look) => {
          const locked = look.pro && !isPro;
          const on = current === look.id;
          return (
            <button
              key={look.id}
              type="button"
              role="radio"
              aria-checked={on}
              className={`look-card${on ? ' look-card--on' : ''}`}
              onClick={() => {
                selectTick();
                if (locked) setPaywall(true);
                else onPick(settingsForLook(look));
              }}
            >
              <span className="look-card-art">
                <Preview swatch={look.swatch} />
                {look.pro && (
                  <span className="look-pro-badge">
                    {locked && <Icon name="lock" size={11} />} PRO
                  </span>
                )}
                {on && (
                  <span className="look-check" aria-hidden="true">
                    <Icon name="check" size={14} />
                  </span>
                )}
              </span>
              <strong>{look.name}</strong>
              <span className="muted small">{look.note}</span>
            </button>
          );
        })}
      </div>
      <PremiumThemeModal open={paywall} onClose={() => setPaywall(false)} />
    </>
  );
}
