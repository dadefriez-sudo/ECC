import { expandEventOnDay } from './helpers.js';

// How many event occurrences land on one day (recurring ones included).
export function occurrencesForReview(events, iso) {
  let n = 0;
  for (const e of events) n += expandEventOnDay(e, iso).length;
  return n;
}
