const CHANNELS = [
  { key: 'sgj', label: 'SimGamerJen', handle: '@SimGamerJen', postsUrl: 'https://www.youtube.com/@SimGamerJen/posts' },
  { key: 'stream', label: 'StreamGamerJen', handle: '@StreamGamerJen', postsUrl: 'https://www.youtube.com/@StreamGamerJen/posts' },
];

const CACHE_SECONDS = 600;
const MAX_PER_CHANNEL = 6;
const MAX_MERGED = 6;
const IMAGE_HOSTS = new Set(['yt3.ggpht.com', 'i.ytimg.com', 'ytimg.com']);

function json(data, status = 200, cache = `public, max-age=120, s-maxage=${CACHE_SECONDS}`) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': cache,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function extractBalancedJson(source, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return '';
}

function extractInitialData(html) {
  const markers = ['var ytInitialData = ', 'ytInitialData = ', 'window["ytInitialData"] = '];
  for (const marker of markers) {
    const markerAt = html.indexOf(marker);
    if (markerAt < 0) continue;
    const start = html.indexOf('{', markerAt + marker.length);
    if (start < 0) continue;
    const raw = extractBalancedJson(html, start);
    if (!raw) continue;
    try { return JSON.parse(raw); } catch {}
  }
  return null;
}

function textValue(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value.simpleText === 'string') return value.simpleText;
  if (Array.isArray(value.runs)) return value.runs.map(run => run?.text || '').join('');
  return '';
}

function thumbnails(value) {
  const list = value?.thumbnails || [];
  return [...list].filter(item => item?.url).sort((a, b) => Number(b.width || 0) - Number(a.width || 0));
}

function findFirstImage(node) {
  if (!node || typeof node !== 'object') return '';
  const candidates = [
    node.backstageImageRenderer?.image,
    node.imageRenderer?.image,
    node.videoRenderer?.thumbnail,
    node.videoLockupViewModel?.contentImage?.thumbnailViewModel?.image,
  ];
  for (const candidate of candidates) {
    const best = thumbnails(candidate)[0]?.url;
    if (best) return best;
  }
  for (const value of Object.values(node)) {
    if (value && typeof value === 'object') {
      const found = findFirstImage(value);
      if (found) return found;
    }
  }
  return '';
}

function parseRelativeAge(value, now = Date.now()) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return null;
  if (text === 'just now') return new Date(now).toISOString();
  const match = text.match(/^(?:streamed\s+)?(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago$/);
  if (!match) return null;
  const count = Number(match[1]);
  const units = { minute: 60e3, hour: 36e5, day: 864e5, week: 7 * 864e5, month: 30 * 864e5, year: 365 * 864e5 };
  return new Date(now - count * units[match[2]]).toISOString();
}

function pollSummary(node) {
  if (!node || typeof node !== 'object') return null;
  const poll = node.pollRenderer || node.backstagePollRenderer;
  if (poll) {
    const choices = (poll.choices || poll.options || [])
      .map(choice => textValue(choice.text || choice.choiceText || choice))
      .filter(Boolean)
      .slice(0, 6);
    return choices.length ? { choices } : { choices: [] };
  }
  for (const value of Object.values(node)) {
    if (value && typeof value === 'object') {
      const found = pollSummary(value);
      if (found) return found;
    }
  }
  return null;
}

function rendererAuthor(renderer) {
  const label = textValue(renderer.authorText || renderer.author || renderer.authorName);
  const endpoint = renderer.authorEndpoint || renderer.navigationEndpoint || {};
  const url = endpoint?.commandMetadata?.webCommandMetadata?.url || endpoint?.browseEndpoint?.canonicalBaseUrl || '';
  const handle = String(url).match(/\/@([^/?]+)/)?.[1] || '';
  const normalised = `${label} ${handle}`.toLowerCase();
  return CHANNELS.find(channel => normalised.includes(channel.label.toLowerCase()) || normalised.includes(channel.handle.slice(1).toLowerCase())) || null;
}

function normaliseRenderer(renderer, pageChannel) {
  const postId = renderer.postId || renderer.id || renderer.navigationEndpoint?.browseEndpoint?.browseId || '';
  const content = textValue(renderer.contentText || renderer.content || renderer.text);
  const publishedText = textValue(renderer.publishedTimeText || renderer.publishedTime || renderer.timestampText);
  const image = findFirstImage(renderer);
  const poll = pollSummary(renderer);
  if (!postId || (!content && !image && !poll)) return null;
  const author = rendererAuthor(renderer) || pageChannel;
  return {
    id: postId,
    source: 'youtube',
    channel: author.label,
    channelKey: author.key,
    handle: author.handle,
    type: poll ? 'poll' : (image ? 'image' : 'text'),
    text: content,
    publishedText,
    publishedAt: parseRelativeAge(publishedText),
    image,
    poll,
    url: `https://www.youtube.com/post/${encodeURIComponent(postId)}`,
  };
}

function collectPostRenderers(root, channel) {
  const posts = [];
  const seen = new Set();
  const rendererKeys = new Set(['backstagePostThreadRenderer', 'backstagePostRenderer', 'postRenderer']);
  function visit(node) {
    if (!node || typeof node !== 'object' || posts.length >= MAX_PER_CHANNEL) return;
    for (const [key, value] of Object.entries(node)) {
      if (rendererKeys.has(key) && value && typeof value === 'object') {
        const renderer = value.post || value;
        const post = normaliseRenderer(renderer, channel);
        if (post && !seen.has(post.id)) {
          seen.add(post.id);
          posts.push(post);
          if (posts.length >= MAX_PER_CHANNEL) return;
        }
      }
      if (value && typeof value === 'object') visit(value);
      if (posts.length >= MAX_PER_CHANNEL) return;
    }
  }
  visit(root);
  return posts;
}

async function fetchChannelPosts(channel) {
  const response = await fetch(channel.postsUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SimGamerJenWebsite/1.0; +https://simgamerjen.com)',
      'Accept-Language': 'en-GB,en;q=0.9',
    },
    cf: { cacheEverything: true, cacheTtl: CACHE_SECONDS },
  });
  if (!response.ok) throw new Error(`youtube-posts-${channel.key}-${response.status}`);
  const html = await response.text();
  const initialData = extractInitialData(html);
  if (!initialData) throw new Error(`youtube-posts-${channel.key}-initial-data-missing`);
  return collectPostRenderers(initialData, channel);
}

function mergePosts(groups) {
  const unique = new Map();
  groups.flat().forEach(post => {
    const existing = unique.get(post.id);
    if (!existing || (existing.channelKey !== post.channelKey && post.channelKey === 'sgj')) unique.set(post.id, post);
  });
  return [...unique.values()]
    .map((post, index) => ({ ...post, _index: index, _time: Date.parse(post.publishedAt || '') }))
    .sort((a, b) => {
      const aTime = Number.isFinite(a._time) ? a._time : 0;
      const bTime = Number.isFinite(b._time) ? b._time : 0;
      return bTime - aTime || a._index - b._index;
    })
    .slice(0, MAX_MERGED)
    .map(({ _index, _time, ...post }) => post);
}

async function getUpdates(request, ctx) {
  const cache = caches.default;
  const key = new Request(new URL('/api/updates-v3', request.url), { method: 'GET' });
  const cached = await cache.match(key);
  if (cached) return cached.json();

  const results = await Promise.allSettled(CHANNELS.map(fetchChannelPosts));
  const groups = [];
  const channels = {};
  results.forEach((result, index) => {
    const channel = CHANNELS[index];
    if (result.status === 'fulfilled') {
      groups.push(result.value);
      channels[channel.label] = { ok: true, fetchedPosts: result.value.length, posts: 0 };
    } else {
      channels[channel.label] = { ok: false, fetchedPosts: 0, posts: 0, error: String(result.reason?.message || result.reason) };
    }
  });

  const posts = mergePosts(groups);
  CHANNELS.forEach(channel => {
    if (channels[channel.label]) channels[channel.label].posts = posts.filter(post => post.channelKey === channel.key).length;
  });

  const data = {
    source: 'youtube-public-posts',
    checkedAt: new Date().toISOString(),
    posts,
    channels,
  };
  const response = json(data);
  ctx.waitUntil(cache.put(key, response.clone()));
  return data;
}

function allowedImageUrl(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    if (IMAGE_HOSTS.has(url.hostname) || url.hostname.endsWith('.ggpht.com') || url.hostname.endsWith('.ytimg.com')) return url;
  } catch {}
  return null;
}

async function handleUpdateImage(request, ctx) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id') || '';
  if (!id) return new Response('Missing post id', { status: 400 });
  const data = await getUpdates(request, ctx);
  const post = data.posts.find(item => item.id === id);
  const upstreamUrl = allowedImageUrl(post?.image || '');
  if (!upstreamUrl) return new Response('Image unavailable', { status: 404, headers: { 'Cache-Control': 'public, max-age=120' } });

  const cache = caches.default;
  const key = new Request(new URL(`/api/update-image-v1?id=${encodeURIComponent(id)}`, request.url), { method: 'GET' });
  const cached = await cache.match(key);
  if (cached) return cached;

  const upstream = await fetch(upstreamUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SimGamerJenWebsite/1.0; +https://simgamerjen.com)',
      Referer: 'https://www.youtube.com/',
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    },
    cf: { cacheEverything: true, cacheTtl: CACHE_SECONDS },
  });
  if (!upstream.ok) return new Response('Image unavailable', { status: 404, headers: { 'Cache-Control': 'public, max-age=120' } });
  const contentType = upstream.headers.get('Content-Type') || 'image/jpeg';
  if (!contentType.toLowerCase().startsWith('image/')) return new Response('Invalid image response', { status: 502 });

  const response = new Response(upstream.body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
  ctx.waitUntil(cache.put(key, response.clone()));
  return response;
}

export async function handleUpdates(request, env, ctx) {
  const url = new URL(request.url);
  if (request.method !== 'GET') return null;
  if (url.pathname === '/api/update-image') {
    try { return await handleUpdateImage(request, ctx); }
    catch { return new Response('Image unavailable', { status: 404, headers: { 'Cache-Control': 'public, max-age=60' } }); }
  }
  if (url.pathname !== '/api/updates') return null;
  try {
    return json(await getUpdates(request, ctx));
  } catch (error) {
    return json({ source: 'youtube-public-posts', checkedAt: new Date().toISOString(), posts: [], unavailable: true, error: String(error?.message || error) }, 200, 'public, max-age=60, s-maxage=120');
  }
}
