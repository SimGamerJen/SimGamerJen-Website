const YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';
const CHANNEL_SECRET = {
  sgj: 'YOUTUBE_REFRESH_TOKEN_SGJ',
  stream: 'YOUTUBE_REFRESH_TOKEN_STREAMGAMERJEN',
};

const enc = new TextEncoder();

function b64url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromB64url(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, ch => ch.charCodeAt(0));
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(value)));
}

async function makeState(secret, channel) {
  const payload = b64url(enc.encode(JSON.stringify({ channel, exp: Date.now() + 10 * 60 * 1000 })));
  const signature = b64url(await hmac(secret, payload));
  return `${payload}.${signature}`;
}

async function readState(secret, state) {
  const [payload, signature] = String(state || '').split('.');
  if (!payload || !signature) throw new Error('Invalid OAuth state');
  const expected = await hmac(secret, payload);
  const supplied = fromB64url(signature);
  if (expected.length !== supplied.length) throw new Error('Invalid OAuth state');
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ supplied[i];
  if (diff !== 0) throw new Error('Invalid OAuth state');
  const decoded = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
  if (!CHANNEL_SECRET[decoded.channel] || Number(decoded.exp) < Date.now()) throw new Error('OAuth state expired');
  return decoded;
}

function page(title, body, status = 200) {
  return new Response(`<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font-family:system-ui,sans-serif;background:#171515;color:#f7f0ec;margin:0;padding:3rem}main{max-width:850px;margin:auto}code,pre{background:#252121;border:1px solid #554843;border-radius:8px;padding:.15rem .35rem}pre{padding:1rem;overflow:auto;white-space:pre-wrap;word-break:break-all}a{color:#f2c7b8}.ok{color:#f2c7b8}.warn{color:#ffcf70}</style></head><body><main>${body}</main></body></html>`, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

async function channelIdentity(accessToken) {
  const url = new URL('https://www.googleapis.com/youtube/v3/channels');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('mine', 'true');
  url.searchParams.set('maxResults', '1');
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) return null;
  const payload = await response.json();
  const channel = payload.items?.[0];
  return channel ? { id: channel.id || '', title: channel.snippet?.title || '' } : null;
}

export async function handleYouTubeOAuth(request, env) {
  if (request.method !== 'GET') return null;
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/oauth/youtube/')) return null;

  if (!env.YOUTUBE_CLIENT_ID || !env.YOUTUBE_CLIENT_SECRET) {
    return page('YouTube OAuth not configured', '<h1>YouTube OAuth is not configured</h1><p>Add <code>YOUTUBE_CLIENT_ID</code> and <code>YOUTUBE_CLIENT_SECRET</code> as Cloudflare secrets for this environment first.</p>', 503);
  }

  const redirectUri = `${url.origin}/api/oauth/youtube/callback`;

  if (url.pathname === '/api/oauth/youtube/start') {
    const channel = (url.searchParams.get('channel') || '').trim();
    if (!CHANNEL_SECRET[channel]) return page('Bad channel', '<h1>Unknown channel</h1><p>Use <code>?channel=sgj</code> or <code>?channel=stream</code>.</p>', 400);
    const state = await makeState(env.YOUTUBE_CLIENT_SECRET, channel);
    const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    auth.searchParams.set('client_id', env.YOUTUBE_CLIENT_ID);
    auth.searchParams.set('redirect_uri', redirectUri);
    auth.searchParams.set('response_type', 'code');
    auth.searchParams.set('scope', YOUTUBE_SCOPE);
    auth.searchParams.set('access_type', 'offline');
    auth.searchParams.set('prompt', 'consent');
    auth.searchParams.set('include_granted_scopes', 'true');
    auth.searchParams.set('state', state);
    return Response.redirect(auth.toString(), 302);
  }

  if (url.pathname === '/api/oauth/youtube/callback') {
    const error = url.searchParams.get('error');
    if (error) return page('YouTube OAuth cancelled', `<h1>Google authorization did not complete</h1><p>${error}</p>`, 400);
    try {
      const state = await readState(env.YOUTUBE_CLIENT_SECRET, url.searchParams.get('state'));
      const code = url.searchParams.get('code');
      if (!code) throw new Error('Missing authorization code');
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: env.YOUTUBE_CLIENT_ID,
          client_secret: env.YOUTUBE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      const token = await response.json();
      if (!response.ok) throw new Error(token.error_description || token.error || `Token exchange failed (${response.status})`);
      const refreshToken = token.refresh_token || '';
      if (!refreshToken) throw new Error('Google did not return a refresh token. Revoke the app grant for this account/channel and run authorization again.');
      const identity = await channelIdentity(token.access_token);
      const secretName = CHANNEL_SECRET[state.channel];
      return page('YouTube OAuth complete', `<p class="ok">Authorization completed.</p><h1>${state.channel === 'sgj' ? 'SimGamerJen' : 'StreamGamerJen'} token</h1><p>Google reports the authorized YouTube identity as <strong>${identity?.title || 'Unknown channel'}</strong>${identity?.id ? ` (<code>${identity.id}</code>)` : ''}.</p><p>Add the following value to Cloudflare as the secret <code>${secretName}</code> for the <strong>preview environment</strong>:</p><pre>${refreshToken}</pre><p class="warn"><strong>Do not paste this token into chat, GitHub, screenshots or logs.</strong> Once it is saved in Cloudflare, close this page.</p>`);
    } catch (error) {
      return page('YouTube OAuth failed', `<h1>Authorization failed</h1><p>${String(error?.message || error)}</p><p>Confirm that the callback URI configured in Google exactly matches <code>${redirectUri}</code>.</p>`, 400);
    }
  }

  return null;
}
