// A bank of daily prompts shown on Home — one featured per day, the same
// one for everyone on a given date. Mixed on purpose: some are specific to
// readjusting after a mission (rebuilding structure, reconnecting with
// people), the rest are general "step outside your comfort zone" prompts
// useful to anyone, so the feature stays worth showing even as the
// audience grows past just returned missionaries.
export const DAILY_CHALLENGES = [
  // Missionary readjustment
  { id: 'rm-1', text: 'Reach out to someone you served with — a text or call counts', type: 'task', category: 'rm' },
  { id: 'rm-2', text: 'Write down 3 things from your mission you want to keep doing now', type: 'task', category: 'rm' },
  { id: 'rm-3', text: 'Plan tomorrow tonight, the way you planned every day on your mission', type: 'task', category: 'rm' },
  { id: 'rm-4', text: 'Follow up with someone you taught or served', type: 'task', category: 'rm' },
  { id: 'rm-5', text: 'Set a goal for your first month home', type: 'goal', category: 'rm' },
  { id: 'rm-6', text: 'Go a full meal without checking your phone', type: 'task', category: 'rm' },
  { id: 'rm-7', text: 'Wake up at the time you did on your mission, just for today', type: 'task', category: 'rm' },
  { id: 'rm-8', text: 'Ask someone how their week is going, and actually listen', type: 'task', category: 'rm' },
  { id: 'rm-9', text: 'Revisit your mission goals and set one for this transition', type: 'goal', category: 'rm' },
  { id: 'rm-10', text: 'Introduce yourself to one new person today', type: 'task', category: 'rm' },
  { id: 'rm-11', text: 'Set a weekly goal to keep studying scripture like you did before', type: 'goal', category: 'rm' },
  { id: 'rm-12', text: 'Write a letter or message to your old companion', type: 'task', category: 'rm' },
  // General comfort-zone
  { id: 'gen-1', text: 'Strike up a conversation with a stranger', type: 'task', category: 'general' },
  { id: 'gen-2', text: 'Try a food you have never had before', type: 'task', category: 'general' },
  { id: 'gen-3', text: 'Give a genuine compliment to someone you do not know well', type: 'task', category: 'general' },
  { id: 'gen-4', text: 'Spend 10 minutes on something you have been putting off', type: 'task', category: 'general' },
  { id: 'gen-5', text: 'Ask a question in a meeting or class instead of staying quiet', type: 'task', category: 'general' },
  { id: 'gen-6', text: 'Go somewhere in your city you have never been', type: 'task', category: 'general' },
  { id: 'gen-7', text: 'Set a goal to learn one new skill this month', type: 'goal', category: 'general' },
  { id: 'gen-8', text: 'Say no to something that does not serve you', type: 'task', category: 'general' },
  { id: 'gen-9', text: 'Call someone instead of texting them', type: 'task', category: 'general' },
  { id: 'gen-10', text: 'Share something you are working on with someone else', type: 'task', category: 'general' },
  { id: 'gen-11', text: 'Set a goal to exercise consistently this week', type: 'goal', category: 'general' },
  { id: 'gen-12', text: 'Sit with feeling uncomfortable for 5 minutes instead of reaching for your phone', type: 'task', category: 'general' },
  { id: 'gen-13', text: 'Apply, sign up, or ask for something you feel unqualified for', type: 'task', category: 'general' },
  { id: 'gen-14', text: 'Set a goal to read for 15 minutes a day this week', type: 'goal', category: 'general' },
];

// A stable per-day pick — a small string hash of the date, not Math.random,
// so it's the same challenge for everyone on a given date and doesn't
// reshuffle on every reload.
export function todaysChallenge(iso) {
  let h = 0;
  for (let i = 0; i < iso.length; i++) h = (h * 31 + iso.charCodeAt(i)) | 0;
  const idx = Math.abs(h) % DAILY_CHALLENGES.length;
  return DAILY_CHALLENGES[idx];
}
