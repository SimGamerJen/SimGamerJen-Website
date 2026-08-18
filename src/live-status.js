const TWITCH_LOGIN = 'simgamerjen';
const TWITCH_URL = `https://www.twitch.tv/${TWITCH_LOGIN}`;
const YOUTUBE_LIVE_URL = 'https://www.youtube.com/@SimGamerJen/live';

function json(data, status = 200, cache = 'public, max-age=30, s-maxage=45') {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': cache,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function getAppToken(request, env, ctx, force = false) {
  const cache = caches.default;
  const key = new Request(new URL('/api/internal/twitch-app-token-v1', request.url), { method: 'GET' });
  if (!force) {
    const cached = await cache.match(key);
    if (cached) return (await cached.json()).accessToken;
  } else {
    await cache.delete(key);
  }

  const body = new URLSearchParams({
    client_id: env.TWITCH_CLIENT_ID,
    client_secret: env.TWITCH_CLIENT_SECRET,
    grant_type: 'client_credentials',
  });
  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) throw new Error(`twitch-token-${response.status}`);
  const token = await response.json();
  if (!token.access_token) throw new Error('twitch-token-missing');

  const ttl = Math.max(300, Math.min(Number(token.expires_in || 3600) - 120, 86400));
  const cachedResponse = json({ accessToken: token.access_token }, 200, `public, max-age=${ttl}, s-maxage=${ttl}`);
  ctx.waitUntil(cache.put(key, cachedResponse));
  return token.access_token;
}

async function fetchStream(request, env, ctx, forceToken = false) {
  const token = await getAppToken(request, env, ctx, forceToken);
  return fetch(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(TWITCH_LOGIN)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Client-Id': env.TWITCH_CLIENT_ID,
    },
  });
}

async function getLiveData(request, env, ctx) {
  if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET) {
    return {
      configured: false,
      live: false,
      checkedAt: new Date().toISOString(),
      twitchUrl: TWITCH_URL,
      youtubeUrl: YOUTUBE_LIVE_URL,
    };
  }

  const cache = caches.default;
  const key = new Request(new URL('/api/live-status-v1', request.url), { method: 'GET' });
  const cached = await cache.match(key);
  if (cached) return cached.json();

  let response = await fetchStream(request, env, ctx);
  if (response.status === 401) response = await fetchStream(request, env, ctx, true);
  if (!response.ok) throw new Error(`twitch-streams-${response.status}`);

  const payload = await response.json();
  const stream = payload.data?.[0];
  const data = stream ? {
    configured: true,
    live: true,
    checkedAt: new Date().toISOString(),
    title: stream.title || 'SimGamerJen is live',
    game: stream.game_name || '',
    viewers: Number(stream.viewer_count || 0),
    startedAt: stream.started_at || '',
    language: stream.language || '',
    twitchUrl: TWITCH_URL,
    youtubeUrl: YOUTUBE_LIVE_URL,
    thumbnail: '/api/live-thumbnail',
  } : {
    configured: true,
    live: false,
    checkedAt: new Date().toISOString(),
    twitchUrl: TWITCH_URL,
    youtubeUrl: YOUTUBE_LIVE_URL,
  };

  const cachedResponse = json(data, 200, 'public, max-age=20, s-maxage=45');
  ctx.waitUntil(cache.put(key, cachedResponse.clone()));
  return data;
}

export async function handleLiveStatus(request, env, ctx) {
  const url = new URL(request.url);
  if (request.method !== 'GET') return null;

  if (url.pathname === '/api/live-status') {
    try {
      return json(await getLiveData(request, env, ctx));
    } catch (error) {
      return json({ configured: true, live: false, unavailable: true, error: String(error?.message || error) }, 503, 'no-store');
    }
  }

  if (url.pathname === '/api/live-thumbnail') {
    try {
      const status = await getLiveData(request, env, ctx);
      if (!status.live) return new Response('Not live', { status: 404, headers: { 'Cache-Control': 'public, max-age=20' } });

      const minute = Math.floor(Date.now() / 60000);
      const cache = caches.default;
      const key = new Request(new URL(`/api/live-thumbnail-v1?m=${minute}`, request.url), { method: 'GET' });
      const cached = await cache.match(key);
      if (cached) return cached;

      const source = `https://static-cdn.jtvnw.net/previews-ttv/live_user_${TWITCH_LOGIN}-640x360.jpg`;
      const upstream = await fetch(source, { cf: { cacheEverything: true, cacheTtl: 60 } });
      if (!upstream.ok) return new Response('Thumbnail unavailable', { status: 404, headers: { 'Cache-Control': 'public, max-age=20' } });

      const response = new Response(upstream.body, {
        headers: {
          'Content-Type': upstream.headers.get('Content-Type') || 'image/jpeg',
          'Cache-Control': 'public, max-age=30, s-maxage=60',
          'X-Content-Type-Options': 'nosniff',
        },
      });
      ctx.waitUntil(cache.put(key, response.clone()));
      return response;
    } catch {
      return new Response('Thumbnail unavailable', { status: 404, headers: { 'Cache-Control': 'public, max-age=20' } });
    }
  }

  return null;
}
