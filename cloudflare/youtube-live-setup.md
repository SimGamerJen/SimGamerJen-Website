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

## Public uploads: server-side API key (no OAuth required)

The Watch page and homepage retrieve **public upload metadata** from both SGJ channels. These requests can use a Google Cloud **YouTube Data API v3 API key** rather than channel OAuth tokens, so public video listings do not depend on the OAuth app's Publishing status or seven-day Testing-mode refresh tokens.

Setup, in the same Google Cloud project:
1. Confirm **YouTube Data API v3** is enabled.
2. Open **APIs & Services → Credentials → Create credentials → API key**.
3. Restrict the key to **YouTube Data API v3** under API restrictions. For a Cloudflare Worker calling Google from dynamically assigned egress IPs, do not configure a fixed source-IP restriction unless you have a genuinely stable egress solution. Keep the key secret and review usage/quota in Google Cloud.
4. In Cloudflare, add the key as an encrypted Worker secret named **`YOUTUBE_API_KEY`** in the environment hosting the site. Set it separately for preview and production, if both need to access the API. Never include it in browser JavaScript, screenshots, a GitHub commit, a PR comment or chat.
5. After the deployment, open **`/api/youtube/health`**. Each working channel should show `source: public-youtube-data-api`, `uploads > 0`, and `publicApiConfigured: true`. The `healthy` property is true only when both channels' uploads were retrieved; `partial` flags incomplete combined results.

Each channel uses the low-quota `channels.list`, `playlistItems.list`, and `videos.list` operations. The Worker caches the combined response to limit quota use. The public key is used for publicly visible videos only. **Channel-authorised, unlisted and scheduled livestream access still requires OAuth**, so complete the OAuth publishing/re-authorisation steps separately.

When the public API key is missing or a request fails, the Worker still falls back to the existing OAuth uploads route and then public RSS, while preserving whichever channel succeeds.

## Watch page feed troubleshooting

If the Watch page's **Latest on YouTube** section shows an outage message instead of current video cards:

1. Open `/api/youtube/health` on the corresponding Cloudflare deployment. It reports only source names, per-channel counts and upstream failure codes; it never returns credentials.
2. `source: youtube-data-api` indicates that the authenticated uploads lookup succeeded. `source: public-rss-fallback` means public RSS is keeping that channel running while OAuth needs attention. `source: unavailable` and an error explain why neither route worked.
3. Check the four Cloudflare YouTube secrets listed above and the Google OAuth consent screen's publishing status, separately for the preview and production deployments.
4. **Important:** If the external Google OAuth app is in **Testing** status, Google generally expires refresh tokens for YouTube scopes after seven days. To avoid repeat outages, change its publishing status to **In production** where appropriate, then reauthorise and securely replace the channel refresh tokens if they have already expired. Never copy secrets into an issue, PR, screenshot or chat.

The Watch page's latest uploads should remain independent of Twitch/YouTube live-status errors. It now shows a clear outage state with links to both channels instead of implying that the static editorial series cards are current uploads.
