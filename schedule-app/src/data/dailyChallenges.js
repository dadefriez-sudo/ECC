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
  // Health & fitness
  { id: 'gen-15', text: 'Take a 20 minute walk outside', type: 'task', category: 'general' },
  { id: 'gen-16', text: 'Stretch for 10 minutes before bed', type: 'task', category: 'general' },
  { id: 'gen-17', text: 'Drink a full glass of water before each meal today', type: 'task', category: 'general' },
  { id: 'gen-18', text: 'Try a workout style you have never done before', type: 'task', category: 'general' },
  { id: 'gen-19', text: 'Set a goal to get 8 hours of sleep three nights this week', type: 'goal', category: 'general' },
  { id: 'gen-20', text: 'Cook a meal at home instead of ordering out', type: 'task', category: 'general' },
  { id: 'gen-21', text: 'Take the stairs instead of the elevator today', type: 'task', category: 'general' },
  { id: 'gen-22', text: 'Set a goal to stand up and move every hour at your desk this week', type: 'goal', category: 'general' },
  // Mindfulness & mental health
  { id: 'gen-23', text: 'Write down one thing you are grateful for', type: 'task', category: 'general' },
  { id: 'gen-24', text: 'Spend 5 minutes in silence — no music, no phone, no talking', type: 'task', category: 'general' },
  { id: 'gen-25', text: 'Name three things you are feeling right now, out loud or on paper', type: 'task', category: 'general' },
  { id: 'gen-26', text: 'Set a goal to meditate for 5 minutes a day this week', type: 'goal', category: 'general' },
  { id: 'gen-27', text: 'Take 10 slow breaths before responding next time you feel frustrated', type: 'task', category: 'general' },
  { id: 'gen-28', text: 'Write a short list of what went well today, before bed', type: 'task', category: 'general' },
  { id: 'gen-29', text: 'Notice one beautiful thing on your way somewhere today', type: 'task', category: 'general' },
  { id: 'gen-30', text: 'Set a goal to put your phone away an hour before bed this week', type: 'goal', category: 'general' },
  // Social & relationships
  { id: 'gen-31', text: 'Send a message to someone you have lost touch with', type: 'task', category: 'general' },
  { id: 'gen-32', text: 'Ask someone a question about their life you have never asked before', type: 'task', category: 'general' },
  { id: 'gen-33', text: 'Invite someone to do something with you this week', type: 'task', category: 'general' },
  { id: 'gen-34', text: 'Thank someone specifically for something they did for you', type: 'task', category: 'general' },
  { id: 'gen-35', text: 'Set a goal to have one real conversation a day with no phones out', type: 'goal', category: 'general' },
  { id: 'gen-36', text: 'Introduce two people you know who should meet', type: 'task', category: 'general' },
  { id: 'gen-37', text: 'Write a short note to someone and actually give it to them', type: 'task', category: 'general' },
  { id: 'gen-38', text: 'Listen to someone fully today without planning what you will say next', type: 'task', category: 'general' },
  // Productivity & organization
  { id: 'gen-39', text: 'Clear off one surface in your space completely', type: 'task', category: 'general' },
  { id: 'gen-40', text: 'Unsubscribe from five emails you never read', type: 'task', category: 'general' },
  { id: 'gen-41', text: 'Make your bed first thing, even if nothing else gets done today', type: 'task', category: 'general' },
  { id: 'gen-42', text: 'Set a timer for 25 minutes and work on one thing with no interruptions', type: 'task', category: 'general' },
  { id: 'gen-43', text: "Write tomorrow's plan before you go to sleep tonight", type: 'task', category: 'general' },
  { id: 'gen-44', text: 'Delete one app you do not use from your phone', type: 'task', category: 'general' },
  { id: 'gen-45', text: 'Set a goal to finish the task at the bottom of your list this week', type: 'goal', category: 'general' },
  { id: 'gen-46', text: 'Organize one drawer, folder, or shelf that has bothered you for a while', type: 'task', category: 'general' },
  // Learning & growth
  { id: 'gen-47', text: 'Watch or read something that teaches you one new thing today', type: 'task', category: 'general' },
  { id: 'gen-48', text: 'Set a goal to practice a skill for 10 minutes a day this week', type: 'goal', category: 'general' },
  { id: 'gen-49', text: 'Ask someone who knows more than you one question about it', type: 'task', category: 'general' },
  { id: 'gen-50', text: 'Look up something you have always wondered about', type: 'task', category: 'general' },
  { id: 'gen-51', text: 'Set a goal to finish one chapter of a book you have started this week', type: 'goal', category: 'general' },
  { id: 'gen-52', text: 'Try explaining something you know well to someone who does not know it', type: 'task', category: 'general' },
  // Creativity
  { id: 'gen-53', text: 'Make something with your hands today, however small', type: 'task', category: 'general' },
  { id: 'gen-54', text: 'Set a goal to write for 10 minutes a day this week', type: 'goal', category: 'general' },
  { id: 'gen-55', text: 'Rearrange something in your space just to see it differently', type: 'task', category: 'general' },
  { id: 'gen-56', text: 'Take a photo of something ordinary and try to make it look interesting', type: 'task', category: 'general' },
  { id: 'gen-57', text: 'Doodle or sketch for 10 minutes with no goal in mind', type: 'task', category: 'general' },
  // Financial
  { id: 'gen-58', text: 'Check your account balance, even if you do not want to', type: 'task', category: 'general' },
  { id: 'gen-59', text: 'Set a goal to make no non-essential purchases this week', type: 'goal', category: 'general' },
  { id: 'gen-60', text: 'Write down everything you spent money on today', type: 'task', category: 'general' },
  { id: 'gen-61', text: 'Set a goal to put a specific amount into savings this week', type: 'goal', category: 'general' },
  { id: 'gen-62', text: 'Cancel one subscription you are not using', type: 'task', category: 'general' },
  // Home & environment
  { id: 'gen-63', text: 'Donate or throw away five things you do not need', type: 'task', category: 'general' },
  { id: 'gen-64', text: 'Open the windows and air out your space for 10 minutes', type: 'task', category: 'general' },
  { id: 'gen-65', text: 'Do one chore today that you have been avoiding', type: 'task', category: 'general' },
  { id: 'gen-66', text: 'Set a goal to keep your space tidy for one full week', type: 'goal', category: 'general' },
  // Kindness & service
  { id: 'gen-67', text: 'Do something helpful for someone without being asked', type: 'task', category: 'general' },
  { id: 'gen-68', text: 'Leave a genuine positive review for a small business you like', type: 'task', category: 'general' },
  { id: 'gen-69', text: 'Hold the door, let someone go first, or give up your seat today', type: 'task', category: 'general' },
  { id: 'gen-70', text: 'Set a goal to check in on someone once this week, unprompted', type: 'goal', category: 'general' },
  { id: 'gen-71', text: 'Pick up litter you see today instead of walking past it', type: 'task', category: 'general' },
  // Courage & comfort zone
  { id: 'gen-72', text: 'Do the thing you have been putting off because it feels awkward', type: 'task', category: 'general' },
  { id: 'gen-73', text: 'Speak up about what you actually think, even if it is not popular', type: 'task', category: 'general' },
  { id: 'gen-74', text: 'Try doing something alone that you would normally only do with others', type: 'task', category: 'general' },
  { id: 'gen-75', text: 'Set a goal to try one new thing every day this week', type: 'goal', category: 'general' },
  { id: 'gen-76', text: 'Ask for help with something instead of struggling through it alone', type: 'task', category: 'general' },
  // Career & school
  { id: 'gen-77', text: 'Update one thing on your resume or portfolio', type: 'task', category: 'general' },
  { id: 'gen-78', text: 'Set a goal to arrive 10 minutes early all week', type: 'goal', category: 'general' },
  { id: 'gen-79', text: 'Ask for feedback on something you made or did', type: 'task', category: 'general' },
  { id: 'gen-80', text: 'Reach out to someone in a field you are curious about', type: 'task', category: 'general' },
  { id: 'gen-81', text: 'Set a goal to tackle your hardest task first each day this week', type: 'goal', category: 'general' },
  // Digital wellbeing
  { id: 'gen-82', text: 'Go one hour today with your phone in another room', type: 'task', category: 'general' },
  { id: 'gen-83', text: 'Turn off notifications for the one app that distracts you most', type: 'task', category: 'general' },
  { id: 'gen-84', text: 'Set a goal to not check your phone for 30 minutes after waking this week', type: 'goal', category: 'general' },
  { id: 'gen-85', text: 'Charge your phone outside your bedroom tonight', type: 'task', category: 'general' },
  // Adventure & novelty
  { id: 'gen-86', text: 'Take a different route than usual today', type: 'task', category: 'general' },
  { id: 'gen-87', text: 'Try a restaurant or cafe you have never been to', type: 'task', category: 'general' },
  { id: 'gen-88', text: 'Start a new hobby, even just for one session', type: 'task', category: 'general' },
  { id: 'gen-89', text: 'Set a goal to do one spontaneous thing this week', type: 'goal', category: 'general' },
  // Reflection & gratitude
  { id: 'gen-90', text: 'Write down one thing you are proud of from this past month', type: 'task', category: 'general' },
  { id: 'gen-91', text: 'Think of someone who helped shape who you are and tell them', type: 'task', category: 'general' },
  { id: 'gen-92', text: 'Set a goal to write one sentence about your day, every day this week', type: 'goal', category: 'general' },
  { id: 'gen-93', text: 'Look back at a goal you hit and notice how you actually did it', type: 'task', category: 'general' },
  // Habits
  { id: 'gen-94', text: 'Set a goal to wake up at the same time every day this week', type: 'goal', category: 'general' },
  { id: 'gen-95', text: 'Pick one habit you want to build and do it for just two minutes today', type: 'task', category: 'general' },
  { id: 'gen-96', text: 'Set a goal to go screen-free the last 30 minutes before bed this week', type: 'goal', category: 'general' },
  { id: 'gen-97', text: 'Track one thing about your day you have never tracked before', type: 'task', category: 'general' },
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
