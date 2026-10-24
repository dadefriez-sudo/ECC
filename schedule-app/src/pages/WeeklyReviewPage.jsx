import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../data/store.jsx';
import { Brand } from '../components/Logo.jsx';
import Icon from '../components/Icon.jsx';
import AnimatedNumber from '../components/AnimatedNumber.jsx';
import { computeWeeklyReview } from '../data/weeklyReview.js';
import { useBackDismiss } from '../data/useBackDismiss.js';

// Your week in review: what landed, what slipped, who to call, and one thing
// to do next. Everything comes from data already on the phone.
export default function WeeklyReviewPage() {
  const { state } = useStore();
  const navigate = useNavigate();
  useBackDismiss(true, () => navigate('/'));
  const review = useMemo(() => computeWeeklyReview(state), [state]);
  const { recap } = review;
  const pct = recap.goalsPossible > 0 ? Math.round((recap.goalsCompleted / recap.goalsPossible) * 100) : 0;
  const nothingYet = recap.goalsCompleted + recap.tasksCompleted + recap.contactsReconnected === 0;

  return (
    <div className="page">
      <header className="page-head">
        <div className="page-head-row">
          <Brand>Week in review</Brand>
        </div>
        <p className="muted small review-range">{review.label}</p>
      </header>

      <section className="detail-section review-hero">
        {recap.goalsPossible > 0 && (
          <div className="review-ring" style={{ '--p': pct }} aria-hidden="true">
            <span>{pct}%</span>
          </div>
        )}
        <div className="review-hero-text">
          <strong className="review-title">
            {nothingYet ? 'A quiet week' : review.wins.length ? review.wins.join(' · ') : 'Week complete'}
          </strong>
          <span className="muted small">
            {recap.goalsPossible > 0
              ? `${recap.goalsCompleted} of ${recap.goalsPossible} goal check-ins met`
              : 'No goals tracked this week'}
          </span>
        </div>
      </section>

      <section className="detail-section recap-block">
        <span className="detail-label"><Icon name="chart" /> The numbers</span>
        <div className="recap-stats">
          <div className="recap-stat">
            <strong>
              <AnimatedNumber value={recap.goalsCompleted} />
              {recap.goalsPossible > 0 && <span className="recap-of">/{recap.goalsPossible}</span>}
            </strong>
            <span className="muted small">Goals hit</span>
          </div>
          <div className="recap-stat">
            <strong>
              <AnimatedNumber value={recap.tasksCompleted} />
            </strong>
            <span className="muted small">Tasks done</span>
          </div>
          <div className="recap-stat">
            <strong>
              <AnimatedNumber value={recap.contactsReconnected} />
            </strong>
            <span className="muted small">People reconnected</span>
          </div>
        </div>
      </section>

      {(review.missedGoals.length > 0 || review.overdueContacts.length > 0 || review.overdueTasks > 0) && (
        <section className="detail-section">
          <span className="detail-label"><Icon name="lightbulb" /> Worth a look</span>
          <ul className="review-list">
            {review.missedGoals.slice(0, 3).map((g) => (
              <li key={g.id}>
                <button className="review-row" onClick={() => navigate('/goals', { state: { openGoalId: g.id } })}>
                  <span className="review-row-title">{g.title}</span>
                  <span className="muted small">{g.detail}</span>
                </button>
              </li>
            ))}
            {review.overdueContacts.map((c) => (
              <li key={c.id}>
                <button className="review-row" onClick={() => navigate(`/contacts/${c.id}`)}>
                  <span className="review-row-title">{c.name}</span>
                  <span className="muted small">{c.days} days since you talked</span>
                </button>
              </li>
            ))}
            {review.overdueTasks > 0 && (
              <li>
                <button className="review-row" onClick={() => navigate('/tasks')}>
                  <span className="review-row-title">Overdue tasks</span>
                  <span className="muted small">{review.overdueTasks} open</span>
                </button>
              </li>
            )}
          </ul>
        </section>
      )}

      <section className="detail-section">
        <span className="detail-label"><Icon name="calendar" /> Next week</span>
        <p className="review-next">
          {review.next.events === 0 && review.next.tasks === 0
            ? 'Nothing planned yet.'
            : `${review.next.events} event${review.next.events === 1 ? '' : 's'} and ${review.next.tasks} task${
                review.next.tasks === 1 ? '' : 's'
              } on the calendar.`}
        </p>
      </section>

      <section className="detail-section review-suggestion">
        <span className="detail-label"><Icon name="compass" /> One thing for next week</span>
        <p className="review-next">{review.suggestion.text}</p>
        <button className="btn btn-primary" onClick={() => navigate(review.suggestion.to)}>
          {review.suggestion.label}
        </button>
      </section>
    </div>
  );
}
