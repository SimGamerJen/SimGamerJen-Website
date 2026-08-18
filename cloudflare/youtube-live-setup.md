# YouTube live-status setup

The Watch page live-status service can aggregate Twitch plus either of the two SGJ YouTube channels. Twitch remains independent: a YouTube configuration or API failure must not prevent Twitch live detection.

## Cloudflare secrets

Configure these as Worker **secrets**, never as repository files or client-side JavaScript:

- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `YOUTUBE_REFRESH_TOKEN_SGJ`
- `YOUTUBE_REFRESH_TOKEN_STREAMGAMERJEN`

The same Google OAuth client ID/secret is used for both channels. Each YouTube identity gets its own refresh token.

## Google Cloud

1. Create or select the SGJ Google Cloud project.
2. Enable **YouTube Data API v3**.
3. Configure the OAuth consent screen.
4. Create an OAuth 2.0 client suitable for a confidential/server-side application.
5. Request the minimum scope needed by the live detector: `https://www.googleapis.com/auth/youtube.readonly`.
6. Request **offline** access so Google issues a refresh token.

## Authorise each channel separately

Generate one refresh token while authorised as the YouTube identity that owns **SimGamerJen**, then a second refresh token while authorised as the identity that owns **StreamGamerJen**. Store them under the matching Cloudflare secret names above.

If both channels are Brand Accounts managed by the same Google login, verify carefully which YouTube identity is selected during each consent flow before storing the token.

## Runtime behaviour

For each configured YouTube identity the Worker:

1. exchanges the refresh token for a short-lived access token;
2. calls `liveBroadcasts.list` with `mine=true` and `broadcastStatus=active`;
3. if a live broadcast exists, calls `videos.list` for `snippet,liveStreamingDetails`;
4. reports title, active channel, watch URL, thumbnail, actual start time and concurrent viewers where YouTube exposes them;
5. combines the active YouTube result with the independent Twitch result into `/api/live-status`.

Only one SGJ YouTube channel is expected to be live at once. If both are ever reported live, SimGamerJen currently wins the YouTube-selection tie because it is checked first.

## Testing

The UI demo modes remain available on Preview without OAuth:

- `/watch/?liveDemo=twitch`
- `/watch/?liveDemo=youtube-sgj`
- `/watch/?liveDemo=youtube-stream`
- `/watch/?liveDemo=both-sgj`
- `/watch/?liveDemo=both-stream`

After adding the real secrets, inspect `/api/live-status` on the Preview deployment. The response includes platform-specific `configured`, `live` and `unavailable` state so a bad YouTube token can be diagnosed without exposing any credential value.
