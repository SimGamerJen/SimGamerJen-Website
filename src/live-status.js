const TWITCH_LOGIN = 'simgamerjen';
const TWITCH_URL = `https://www.twitch.tv/${TWITCH_LOGIN}`;
const UPCOMING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const UPCOMING_GRACE_MS = 2 * 60 * 60 * 1000;
const YOUTUBE_CHANNELS = {
  sgj: { label: 'SimGamerJen', url: 'https://www.youtube.com/@SimGamerJen/live', refreshSecret: 'YOUTUBE_REFRESH_TOKEN_SGJ' },
  stream: { label: 'StreamGamerJen', url: 'https://www.youtube.com/@StreamGamerJen/live', refreshSecret: 'YOUTUBE_REFRESH_TOKEN_STREAMGAMERJEN' },
};

function json(data, status = 200, cache = 'public, max-age=30, s-maxage=45') {
  return Response.json(data, { status, headers: { 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff' } });
}

async function getTwitchAppToken(request, env, ctx, force = false) {
  const cache = caches.default;
  const key = new Request(new URL('/api/internal/twitch-app-token-v1', request.url), { method: 'GET' });
  if (!force) { const cached = await cache.match(key); if (cached) return (await cached.json()).accessToken; }
  else await cache.delete(key);
  const response = await fetch('https://id.twitch.tv/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: env.TWITCH_CLIENT_ID, client_secret: env.TWITCH_CLIENT_SECRET, grant_type: 'client_credentials' }) });
  if (!response.ok) throw new Error(`twitch-token-${response.status}`);
  const token = await response.json();
  if (!token.access_token) throw new Error('twitch-token-missing');
  const ttl = Math.max(300, Math.min(Number(token.expires_in || 3600) - 120, 86400));
  ctx.waitUntil(cache.put(key, json({ accessToken: token.access_token }, 200, `public, max-age=${ttl}, s-maxage=${ttl}`)));
  return token.access_token;
}

async function fetchTwitchStream(request, env, ctx, forceToken = false) {
  const token = await getTwitchAppToken(request, env, ctx, forceToken);
  return fetch(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(TWITCH_LOGIN)}`, { headers: { Authorization: `Bearer ${token}`, 'Client-Id': env.TWITCH_CLIENT_ID } });
}

async function getTwitchStatus(request, env, ctx) {
  if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET) return { configured: false, live: false, url: TWITCH_URL };
  try {
    let response = await fetchTwitchStream(request, env, ctx);
    if (response.status === 401) response = await fetchTwitchStream(request, env, ctx, true);
    if (!response.ok) throw new Error(`twitch-streams-${response.status}`);
    const stream = (await response.json()).data?.[0];
    if (!stream) return { configured: true, live: false, url: TWITCH_URL };
    return { configured: true, live: true, title: stream.title || 'SimGamerJen is live', game: stream.game_name || '', viewers: Number(stream.viewer_count || 0), startedAt: stream.started_at || '', language: stream.language || '', url: TWITCH_URL, thumbnail: '/api/live-thumbnail' };
  } catch (error) { return { configured: true, live: false, unavailable: true, error: String(error?.message || error), url: TWITCH_URL }; }
}

async function googleTokenRequest(env, refreshToken) {
  return fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: env.YOUTUBE_CLIENT_ID, client_secret: env.YOUTUBE_CLIENT_SECRET, refresh_token: refreshToken, grant_type: 'refresh_token' }) });
}

async function getGoogleAccessToken(request, env, ctx, channelKey, refreshToken, force = false) {
  const cache = caches.default;
  const key = new Request(new URL(`/api/internal/youtube-access-token-v1?channel=${encodeURIComponent(channelKey)}`, request.url), { method: 'GET' });
  if (!force) { const cached = await cache.match(key); if (cached) return (await cached.json()).accessToken; }
  else await cache.delete(key);
  const response = await googleTokenRequest(env, refreshToken);
  if (!response.ok) throw new Error(`youtube-token-${channelKey}-${response.status}`);
  const payload = await response.json();
  if (!payload.access_token) throw new Error(`youtube-token-${channelKey}-missing`);
  const ttl = Math.max(120, Math.min(Number(payload.expires_in || 3600) - 120, 3300));
  ctx.waitUntil(cache.put(key, json({ accessToken: payload.access_token }, 200, `public, max-age=${ttl}, s-maxage=${ttl}`)));
  return payload.access_token;
}

async function youtubeApi(url, token) { return fetch(url, { headers: { Authorization: `Bearer ${token}` } }); }
function bestYouTubeThumbnail(snippet = {}) { const thumbs = snippet.thumbnails || {}; return (thumbs.maxres || thumbs.standard || thumbs.high || thumbs.medium || thumbs.default || {}).url || ''; }
function broadcastsUrl() {
  const url = new URL('https://www.googleapis.com/youtube/v3/liveBroadcasts');
  url.searchParams.set('part', 'id,snippet,status');
  url.searchParams.set('mine', 'true');
  url.searchParams.set('broadcastType', 'all');
  url.searchParams.set('maxResults', '50');
  return url;
}
function activeBroadcast(items = []) { return items.find(item => item?.status?.lifeCycleStatus === 'live') || null; }
function upcomingBroadcast(items = [], now = Date.now()) {
  return items
    .filter(item => item?.status?.lifeCycleStatus === 'ready')
    .map(item => ({ item, time: Date.parse(item?.snippet?.scheduledStartTime || '') }))
    .filter(entry => Number.isFinite(entry.time) && entry.time >= now - UPCOMING_GRACE_MS && entry.time <= now + UPCOMING_WINDOW_MS)
    .sort((a, b) => a.time - b.time)[0]?.item || null;
}
function upcomingSummary(broadcast, config) {
  if (!broadcast?.id) return null;
  return {
    channel: config.label,
    videoId: broadcast.id,
    title: broadcast.snippet?.title || `${config.label} livestream`,
    scheduledStartTime: broadcast.snippet?.scheduledStartTime || '',
    url: `https://www.youtube.com/watch?v=${encodeURIComponent(broadcast.id)}`,
    channelUrl: config.url,
    thumbnail: bestYouTubeThumbnail(broadcast.snippet),
    privacyStatus: broadcast.status?.privacyStatus || '',
  };
}

async function getYouTubeChannelStatus(request, env, ctx, channelKey, config) {
  const refreshToken = env[config.refreshSecret];
  const configured = Boolean(env.YOUTUBE_CLIENT_ID && env.YOUTUBE_CLIENT_SECRET && refreshToken);
  if (!configured) return { configured: false, live: false, channel: config.label, url: config.url };
  try {
    let token = await getGoogleAccessToken(request, env, ctx, channelKey, refreshToken);
    let response = await youtubeApi(broadcastsUrl(), token);
    if (response.status === 401) { token = await getGoogleAccessToken(request, env, ctx, channelKey, refreshToken, true); response = await youtubeApi(broadcastsUrl(), token); }
    if (!response.ok) throw new Error(`youtube-broadcasts-${channelKey}-${response.status}`);
    const items = (await response.json()).items || [];
    const broadcast = activeBroadcast(items);
    const upcoming = upcomingSummary(upcomingBroadcast(items), config);
    if (!broadcast?.id) return { configured: true, live: false, channel: config.label, url: config.url, upcoming };
    const videosUrl = new URL('https://www.googleapis.com/youtube/v3/videos'); videosUrl.searchParams.set('part', 'snippet,liveStreamingDetails'); videosUrl.searchParams.set('id', broadcast.id);
    const videoResponse = await youtubeApi(videosUrl, token); const video = videoResponse.ok ? (await videoResponse.json()).items?.[0] || {} : {};
    const snippet = video.snippet || broadcast.snippet || {}; const liveDetails = video.liveStreamingDetails || {}; const concurrent = Number(liveDetails.concurrentViewers);
    return { configured: true, live: true, channel: config.label, videoId: broadcast.id, title: snippet.title || broadcast.snippet?.title || `${config.label} is live`, viewers: Number.isFinite(concurrent) ? concurrent : undefined, startedAt: liveDetails.actualStartTime || broadcast.snippet?.actualStartTime || '', url: `https://www.youtube.com/watch?v=${encodeURIComponent(broadcast.id)}`, channelUrl: config.url, thumbnail: bestYouTubeThumbnail(snippet) || bestYouTubeThumbnail(broadcast.snippet), upcoming };
  } catch (error) { return { configured: true, live: false, unavailable: true, error: String(error?.message || error), channel: config.label, url: config.url }; }
}

async function safeGoogleError(response) {
  let body = {};
  try { body = await response.json(); } catch {}
  const err = body?.error;
  const first = err?.errors?.[0];
  return { status: response.status, code: typeof err === 'string' ? err : (err?.code || response.status), reason: first?.reason || '', message: first?.message || err?.message || body?.error_description || '' };
}

async function diagnoseYouTubeChannel(env, channelKey, config) {
  const refreshToken = env[config.refreshSecret];
  const configured = Boolean(env.YOUTUBE_CLIENT_ID && env.YOUTUBE_CLIENT_SECRET && refreshToken);
  if (!configured) return { channel: config.label, configured: false, stage: 'configuration' };
  const tokenResponse = await googleTokenRequest(env, refreshToken);
  if (!tokenResponse.ok) return { channel: config.label, configured: true, ok: false, stage: 'token', ...(await safeGoogleError(tokenResponse)) };
  const tokenPayload = await tokenResponse.json();
  if (!tokenPayload.access_token) return { channel: config.label, configured: true, ok: false, stage: 'token', reason: 'missing_access_token' };
  const response = await youtubeApi(broadcastsUrl(), tokenPayload.access_token);
  if (!response.ok) return { channel: config.label, configured: true, ok: false, stage: 'liveBroadcasts', ...(await safeGoogleError(response)) };
  const payload = await response.json();
  const items = payload.items || [];
  const broadcast = activeBroadcast(items);
  const upcoming = upcomingBroadcast(items);
  return { channel: config.label, configured: true, ok: true, stage: 'liveBroadcasts', live: Boolean(broadcast?.id), activeBroadcasts: broadcast ? 1 : 0, upcomingBroadcasts: upcoming ? 1 : 0, nextScheduledStartTime: upcoming?.snippet?.scheduledStartTime || '', returnedBroadcasts: items.length };
}

function nearestUpcoming(...candidates) {
  return candidates
    .filter(Boolean)
    .map(item => ({ item, time: Date.parse(item.scheduledStartTime || '') }))
    .filter(entry => Number.isFinite(entry.time))
    .sort((a, b) => a.time - b.time)[0]?.item || null;
}

async function getLiveData(request, env, ctx) {
  const cache = caches.default; const key = new Request(new URL('/api/live-status-v3', request.url), { method: 'GET' }); const cached = await cache.match(key); if (cached) return cached.json();
  const [twitch, sgjYouTube, streamYouTube] = await Promise.all([getTwitchStatus(request, env, ctx), getYouTubeChannelStatus(request, env, ctx, 'sgj', YOUTUBE_CHANNELS.sgj), getYouTubeChannelStatus(request, env, ctx, 'stream', YOUTUBE_CHANNELS.stream)]);
  const activeYouTube = sgjYouTube.live ? sgjYouTube : (streamYouTube.live ? streamYouTube : null);
  const live = Boolean(twitch.live || activeYouTube);
  const upcoming = live ? null : nearestUpcoming(sgjYouTube.upcoming, streamYouTube.upcoming);
  const state = live ? 'live' : (upcoming ? 'upcoming' : 'offline');
  const data = {
    configured: Boolean(twitch.configured || sgjYouTube.configured || streamYouTube.configured),
    live,
    state,
    checkedAt: new Date().toISOString(),
    title: live ? (twitch.live ? twitch.title : (activeYouTube?.title || '')) : (upcoming?.title || ''),
    game: twitch.live ? twitch.game : '',
    startedAt: twitch.live ? twitch.startedAt : (activeYouTube?.startedAt || ''),
    scheduledStartTime: upcoming?.scheduledStartTime || '',
    thumbnail: live ? (twitch.live ? twitch.thumbnail : (activeYouTube?.thumbnail || '')) : (upcoming?.thumbnail || ''),
    upcoming,
    platforms: {
      twitch,
      youtube: activeYouTube || {
        configured: Boolean(sgjYouTube.configured || streamYouTube.configured),
        live: false,
        channels: {
          SimGamerJen: { configured: sgjYouTube.configured, unavailable: Boolean(sgjYouTube.unavailable), upcoming: sgjYouTube.upcoming || null },
          StreamGamerJen: { configured: streamYouTube.configured, unavailable: Boolean(streamYouTube.unavailable), upcoming: streamYouTube.upcoming || null },
        },
      },
    },
  };
  const cachedResponse = json(data, 200, 'public, max-age=20, s-maxage=45'); ctx.waitUntil(cache.put(key, cachedResponse.clone())); return data;
}

export async function handleLiveStatus(request, env, ctx) {
  const url = new URL(request.url); if (request.method !== 'GET') return null;
  if (url.pathname === '/api/live-status') { try { return json(await getLiveData(request, env, ctx)); } catch (error) { return json({ configured: false, live: false, state: 'offline', unavailable: true, error: String(error?.message || error) }, 503, 'no-store'); } }
  if (url.pathname === '/api/live-status/diagnostics') {
    try { const [sgj, stream] = await Promise.all([diagnoseYouTubeChannel(env, 'sgj', YOUTUBE_CHANNELS.sgj), diagnoseYouTubeChannel(env, 'stream', YOUTUBE_CHANNELS.stream)]); return json({ checkedAt: new Date().toISOString(), youtube: { SimGamerJen: sgj, StreamGamerJen: stream } }, 200, 'no-store'); }
    catch (error) { return json({ unavailable: true, stage: 'diagnostics', error: String(error?.message || error) }, 503, 'no-store'); }
  }
  if (url.pathname === '/api/live-thumbnail') {
    try {
      const status = await getLiveData(request, env, ctx); if (!status.platforms?.twitch?.live) return new Response('Twitch not live', { status: 404, headers: { 'Cache-Control': 'public, max-age=20' } });
      const minute = Math.floor(Date.now() / 60000); const cache = caches.default; const key = new Request(new URL(`/api/live-thumbnail-v1?m=${minute}`, request.url), { method: 'GET' }); const cached = await cache.match(key); if (cached) return cached;
      const upstream = await fetch(`https://static-cdn.jtvnw.net/previews-ttv/live_user_${TWITCH_LOGIN}-640x360.jpg`, { cf: { cacheEverything: true, cacheTtl: 60 } }); if (!upstream.ok) return new Response('Thumbnail unavailable', { status: 404, headers: { 'Cache-Control': 'public, max-age=20' } });
      const response = new Response(upstream.body, { headers: { 'Content-Type': upstream.headers.get('Content-Type') || 'image/jpeg', 'Cache-Control': 'public, max-age=30, s-maxage=60', 'X-Content-Type-Options': 'nosniff' } }); ctx.waitUntil(cache.put(key, response.clone())); return response;
    } catch { return new Response('Thumbnail unavailable', { status: 404, headers: { 'Cache-Control': 'public, max-age=20' } }); }
  }
  return null;
}
