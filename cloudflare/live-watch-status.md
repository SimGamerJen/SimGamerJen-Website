# Watch page live status

The Watch page can switch its existing live section into a live-now card when the `SimGamerJen` Twitch channel is broadcasting.

## Cloudflare Worker secrets

Configure these as **secrets**, not plain-text variables:

- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`

The client secret must never be committed to GitHub or exposed to browser JavaScript.

## Twitch application

Create a Twitch Developer application for the SimGamerJen website. The Worker uses Twitch's OAuth client-credentials flow to obtain an app access token and calls Helix `GET /streams?user_login=simgamerjen`.

No user OAuth scopes are required for the live-status check.

## Behaviour

- `/api/live-status` caches the Twitch status at the edge for roughly 45 seconds.
- The Watch page checks immediately on load and then once per minute while open.
- When offline, the existing static Twitch promotion remains unchanged.
- When live, the section presents the current title, Twitch category, elapsed time, viewer count, live thumbnail and Twitch/YouTube buttons.
- `/api/live-thumbnail` proxies the Twitch preview image through the SGJ Worker so the browser does not need a Twitch CDN exception in the site CSP.
- If Twitch is temporarily unavailable, the static offline presentation remains in place.

## Visual preview without credentials

Append this query string to the Watch page on a preview deployment:

`/watch/?liveDemo=1`

This renders representative live data without calling Twitch and is intended only for visual testing.
