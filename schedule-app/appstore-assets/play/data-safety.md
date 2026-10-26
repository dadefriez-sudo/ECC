# Play Console: Data safety form (draft to check against the real form)

Matches the privacy policy dated October 24, 2026. Play's wording changes, so read each
question as you fill it in. Not legal advice.

## Overview questions

| Question | Answer |
| --- | --- |
| Does the app collect or share any of the required user data types? | Yes |
| Is all of the user data collected by the app encrypted in transit? | Yes (HTTPS to our server, Clerk, and Google) |
| Do you provide a way for users to request that their data is deleted? | Yes: Settings → Account → Delete account, or email keystone.planner@gmail.com |

## Data that leaves the device

Everything below is optional: it only happens if the person signs in, buys Pro, and turns the feature on. Nothing is collected for a free, signed-out user.

| Data type | Collected | Shared | Why | Optional |
| --- | --- | --- | --- | --- |
| Personal info: Email address | Yes (account, via Clerk) | No | Account management | Yes |
| Personal info: User IDs | Yes (account id) | No | Account management | Yes |
| Calendar: Calendar events | Yes (cloud sync, shared calendars, Google Calendar sync) | No | App functionality | Yes |
| Contacts | Yes (cloud sync; Google Contacts import is read-only; the phone's contacts are read only when you tap Import from phone, and only the ones you pick are copied into the app) | No | App functionality | Yes |
| Photos and videos | Yes (contact photos inside cloud sync) | No | App functionality | Yes |
| App activity: Other user-generated content | Yes (goals, tasks, notes inside cloud sync; goal progress sent to an accountability partner) | No | App functionality | Yes |
| Location: Precise location | Yes (saved pins and contact addresses inside cloud sync). The phone's own GPS position is used on the device and is not sent. | No | App functionality | Yes |
| Financial info: Purchase history | Yes (that Pro was bought, and its transaction id) | No | App functionality | Required for Pro |

## Things to decide or double check

- **"Shared":** answer No for Clerk, Google, and the hosting provider, because they process data for you as service providers. Map searches and address lookups go from the phone to OpenStreetMap; if the form asks about third parties receiving location-related text, say it is the search text the person typed, sent at their request.
- **Accountability partners:** goal titles and progress go to the one person the user invited. That is user-directed, but read Play's current definition of "sharing" and answer the way it says.
- **Not collected:** advertising IDs, device IDs, usage analytics, crash logs (until crash reporting is added; when it is, add Crash logs and Diagnostics here).
- **Data deletion URL:** Play asks for a web page. The in-app Delete account screen is the real action; if you want a public page for the form, point it at your site's delete-account route.
