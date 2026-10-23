import { weekSummary, weekReportText } from '../data/activityLog.js';
import { formatShortDate } from '../data/helpers.js';
import { useToast } from '../data/toast.jsx';

// "Your week in Keystone": made to be screenshotted or sent. Counts only, kept
// on this phone; nothing leaves it unless the person taps Send or Copy.
export default function WeekCard() {
  const showToast = useToast();
  const s = weekSummary();
  const text = weekReportText(s);
  const mail = `mailto:keystone.planner@gmail.com?subject=${encodeURIComponent('My Keystone week')}&body=${encodeURIComponent(text)}`;

  const copy = () =>
    navigator.clipboard?.writeText(text).then(
      () => showToast('Copied. Paste it into a message.'),
      () => showToast('Could not copy.')
    );

  return (
    <div className="week-card">
      <div className="week-card-head">
        <strong>{s.daysActive} of 7 days</strong>
        <span className="muted small">
          {formatShortDate(s.days[0].iso)} to {formatShortDate(s.days[6].iso)}
        </span>
      </div>
      <div className="week-card-days" aria-label={`Used on ${s.daysActive} of the last 7 days`}>
        {s.days.map((d) => (
          <span key={d.iso} className={`week-dot${d.active ? ' week-dot--on' : d.opened ? ' week-dot--open' : ''}`} />
        ))}
      </div>
      <div className="week-card-stats">
        <div><b>{s.adds}</b><span>items added</span></div>
        <div><b>{s.changes}</b><span>things done</span></div>
        <div><b>{s.sinceFirst || 1}</b><span>{(s.sinceFirst || 1) === 1 ? 'day' : 'days'} with Keystone</span></div>
      </div>
      <p className="muted small">
        Only these counts, never what's in your planner. They stay on your phone until you send them.
      </p>
      <div className="stack-btns">
        <a className="btn btn-primary full" href={mail}>Send my week</a>
        <button className="btn btn-ghost full" onClick={copy}>Copy my week</button>
      </div>
    </div>
  );
}
