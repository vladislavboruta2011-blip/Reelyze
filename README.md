# Reelyze

Reelyze is an AI tool for analyzing YouTube Shorts scripts before publishing.

It helps creators improve their scripts by checking:

- Hook strength
- Retention risk
- Risky timestamps
- Suggested fixes
- Improved hooks

## Live Demo

https://reelyze.vercel.app

## Built With

- Next.js
- TypeScript
- Tailwind CSS
- OpenAI API
- Vercel

## What Reelyze Does

Reelyze reviews a YouTube Shorts script and gives feedback before the video goes live.

It focuses on:

1. Whether the opening line stops the scroll.
2. Whether the script keeps attention through the middle.
3. Whether the ending gives a clear payoff.
4. Which parts may cause viewers to leave.
5. How the hook can be improved.

## Production Environment

Admin feedback routes are protected with Basic Auth.

Set these server-side environment variables in production before accessing `/admin/feedback` or `/api/admin/feedback`:

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

If either value is missing, admin routes intentionally return `503` so private feedback data is not exposed.

## Status

MVP deployed and ready for testing.
