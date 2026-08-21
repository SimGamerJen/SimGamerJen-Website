const CHANNELS = [
  { key: 'sgj', label: 'SimGamerJen', handle: '@SimGamerJen', postsUrl: 'https://www.youtube.com/@SimGamerJen/posts' },
  { key: 'stream', label: 'StreamGamerJen', handle: '@StreamGamerJen', postsUrl: 'https://www.youtube.com/@StreamGamerJen/posts' },
];

const CACHE_SECONDS = 600;
const MAX_PER_CHANNEL = 6;
const MAX_MERGED = 6;

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

function normaliseRenderer(renderer, channel) {
  const postId = renderer.postId || renderer.id || renderer.navigationEndpoint?.browseEndpoint?.browseId || '';
  const content = textValue(renderer.contentText || renderer.content || renderer.text);
  const publishedText = textValue(renderer.publishedTimeText || renderer.publishedTime || renderer.timestampText);
  const image = findFirstImage(renderer);
  const poll = pollSummary(renderer);
  if (!postId || (!content && !image && !poll)) return null;
  return {
    id: postId,
    source: 'youtube',
    channel: channel.label,
    channelKey: channel.key,
    handle: channel.handle,
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
  return groups.flat()
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
  const key = new Request(new URL('/api/updates-v1', request.url), { method: 'GET' });
  const cached = await cache.match(key);
  if (cached) return cached.json();

  const results = await Promise.allSettled(CHANNELS.map(fetchChannelPosts));
  const groups = [];
  const channels = {};
  results.forEach((result, index) => {
    const channel = CHANNELS[index];
    if (result.status === 'fulfilled') {
      groups.push(result.value);
      channels[channel.label] = { ok: true, posts: result.value.length };
    } else {
      channels[channel.label] = { ok: false, posts: 0, error: String(result.reason?.message || result.reason) };
    }
  });

  const data = {
    source: 'youtube-public-posts',
    checkedAt: new Date().toISOString(),
    posts: mergePosts(groups),
    channels,
  };
  const response = json(data);
  ctx.waitUntil(cache.put(key, response.clone()));
  return data;
}

export async function handleUpdates(request, env, ctx) {
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.pathname !== '/api/updates') return null;
  try {
    return json(await getUpdates(request, ctx));
  } catch (error) {
    return json({ source: 'youtube-public-posts', checkedAt: new Date().toISOString(), posts: [], unavailable: true, error: String(error?.message || error) }, 200, 'public, max-age=60, s-maxage=120');
  }
}
