import { useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import { useStore, useActions } from '../data/store.jsx';
import { computeWeeklyReview, reviewCardDue, reviewWeekId } from '../data/weeklyReview.js';
import { useMemo } from 'react';

// Offered on Home at the end of the week (from 4 PM on the last day, and the
// first day of the next one). Dismissing it hides it for that week only.
export default function WeeklyReviewCard() {
  const { state } = useStore();
  const actions = useActions();
  const navigate = useNavigate();
  const now = new Date();
  const due = reviewCardDue(now);
  const enabled = state.settings?.weeklyReviewCard !== false;
  const weekId = reviewWeekId(now);
  const review = useMemo(() => (due ? computeWeeklyReview(state, now) : null), [state, due]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!due || !enabled || state.settings?.reviewDismissed === weekId || !review) return null;
  const { recap } = review;
  return (
    <section className="detail-section review-card">
      <div className="review-card-head">
        <span className="detail-label"><Icon name="chart" /> Your week in review</span>
        <button
          className="icon-btn"
          onClick={() => actions.setSettings({ reviewDismissed: weekId })}
          aria-label="Dismiss weekly review"
        >
          <Icon name="close" size={16} />
        </button>
      </div>
      <p className="review-card-line">
        {review.wins.length ? review.wins.join(' · ') : 'See how the week went and plan the next one.'}
      </p>
      <div className="review-card-actions">
        <button className="btn btn-primary btn-sm" onClick={() => navigate('/review')}>
          See my week
        </button>
        {recap.goalsPossible > 0 && (
          <span className="muted small">
            {recap.goalsCompleted} of {recap.goalsPossible} goal check-ins met
          </span>
        )}
      </div>
    </section>
  );
}
