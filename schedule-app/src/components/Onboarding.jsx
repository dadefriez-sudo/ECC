import { useState } from 'react';
import Logo from './Logo.jsx';
import Icon from './Icon.jsx';
import { GOAL_TEMPLATES } from '../data/goalTemplates.js';

// First-run setup, replacing the old eight card text tour (which still lives in
// Tutorial.jsx for "Replay tour" in More). The point is the first five
// minutes: pick a clean start or sample data, pick a few goals, and land in a
// planner that already has something of yours in it.
//
//   0 welcome  ->  1 how to start  ->  2 starter goals (fresh only)  ->  3 done
export default function Onboarding({ onStartFresh, onAddGoals, onDone }) {
  const [step, setStep] = useState(0);
  const [fresh, setFresh] = useState(true);
  const [picked, setPicked] = useState(() => new Set());

  const toggle = (title) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });

  const choose = (isFresh) => {
    setFresh(isFresh);
    if (isFresh) {
      onStartFresh();
      setStep(2);
    } else {
      setStep(3);
    }
  };

  const finishGoals = () => {
    const chosen = GOAL_TEMPLATES.filter((t) => picked.has(t.title));
    if (chosen.length) onAddGoals(chosen);
    setStep(3);
  };

  return (
    <div className="tutorial-backdrop">
      <div className="tutorial-card onboarding-card">
        {step < 3 && (
          <button className="tutorial-skip" onClick={() => onDone(null)}>
            Skip setup
          </button>
        )}

        {step === 0 && (
          <>
            <div className="tutorial-icon"><Logo size={64} /></div>
            <h2>Welcome to Keystone</h2>
            <p>
              Your calendar, tasks, goals, and the people you care about, all in one place. Let's set it up in about a
              minute.
            </p>
            <div className="tutorial-actions">
              <button className="btn btn-primary full" onClick={() => setStep(1)}>
                Get started
              </button>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2>How do you want to start?</h2>
            <p className="muted">You can change this later in More.</p>
            <div className="onboard-options">
              <button className="onboard-option onboard-option--rec" onClick={() => choose(true)}>
                <strong>Start fresh</strong>
                <span>An empty planner, ready for your own life.</span>
                <em>Recommended</em>
              </button>
              <button className="onboard-option" onClick={() => choose(false)}>
                <strong>Explore with sample data</strong>
                <span>See the app filled in with example events, goals, and people. Clear it any time in More.</span>
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2>Pick a few starter goals</h2>
            <p className="muted">Tap to add. You can change them or add more later.</p>
            <div className="template-chips template-chips--sheet onboard-chips">
              {GOAL_TEMPLATES.map((t) => (
                <button
                  key={t.title}
                  className={`template-chip${picked.has(t.title) ? ' template-chip--on' : ''}`}
                  aria-pressed={picked.has(t.title)}
                  onClick={() => toggle(t.title)}
                >
                  {picked.has(t.title) && <Icon name="check" size={14} />} {t.title}
                </button>
              ))}
            </div>
            <div className="tutorial-actions">
              <button className="btn btn-primary full" onClick={finishGoals}>
                {picked.size ? `Add ${picked.size} goal${picked.size === 1 ? '' : 's'}` : 'Skip for now'}
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="tutorial-icon"><Icon name="check" size={44} /></div>
            <h2>You're all set</h2>
            <p>
              {fresh
                ? 'Add your first event in the Planner, or tap + anywhere to add a task, a note, or a goal.'
                : 'Look around. Nothing here is permanent, and you can clear the sample data any time in More.'}
            </p>
            <div className="tutorial-actions onboard-final">
              {fresh && (
                <button className="btn btn-primary full" onClick={() => onDone('/planner')}>
                  Add my first event
                </button>
              )}
              <button className={`btn ${fresh ? 'btn-ghost' : 'btn-primary'} full`} onClick={() => onDone(null)}>
                {fresh ? 'Go to Home' : "Let's go"}
              </button>
            </div>
          </>
        )}

        {step < 3 && (
          <div className="tutorial-dots">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`tutorial-dot${i === step ? ' tutorial-dot--on' : ''}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
