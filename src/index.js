const CHANNELS = [
  { handle: 'SimGamerJen', label: 'SimGamerJen' },
  { handle: 'StreamGamerJen', label: 'StreamGamerJen' },
];

const YOUTUBE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; SimGamerJenWebsite/1.0; +https://simgamerjen.com)',
  'Accept-Language': 'en-GB,en;q=0.9',
};

function decodeXml(value = '') {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function textTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeXml(match[1].trim()) : '';
}

function stripMarkup(value = '') {
  return decodeXml(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

async function resolveChannelId(handle) {
  const response = await fetch(`https://www.youtube.com/@${encodeURIComponent(handle)}`, {
    headers: YOUTUBE_HEADERS,
    cf: { cacheEverything: true, cacheTtl: 21600 },
  });
  if (!response.ok) throw new Error(`channel-page-${response.status}`);
  const html = await response.text();
  const patterns = [
    /"channelId":"(UC[\w-]{20,})"/,
    /"externalId":"(UC[\w-]{20,})"/,
    /itemprop="channelId"\s+content="(UC[\w-]{20,})"/,
    /content="(UC[\w-]{20,})"\s+itemprop="channelId"/,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }
  throw new Error(`channel-id-not-found-${handle}`);
}

function parseFeed(xml, channel) {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/gi) || [];
  return entries.map(entry => {
    const videoId = textTag(entry, 'yt:videoId');
    const title = textTag(entry, 'title');
    const published = textTag(entry, 'published');
    const rawDescription = textTag(entry, 'media:description');
    const description = stripMarkup(rawDescription).slice(0, 220);
    if (!videoId || !title || !published) return null;
    return {
      id: videoId,
      title,
      published,
      description,
      channel: channel.label,
      handle: channel.handle,
      url: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
      thumbnail: `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`,
    };
  }).filter(Boolean);
}

async function fetchChannelItems(channel) {
  const channelId = await resolveChannelId(channel.handle);
  const response = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`, {
    headers: YOUTUBE_HEADERS,
    cf: { cacheEverything: true, cacheTtl: 900 },
  });
  if (!response.ok) throw new Error(`feed-${channel.handle}-${response.status}`);
  return parseFeed(await response.text(), channel);
}

async function latestYouTube(request, ctx) {
  const cache = caches.default;
  const cacheKey = new Request(new URL('/api/youtube/latest', request.url), { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const settled = await Promise.allSettled(CHANNELS.map(fetchChannelItems));
  const items = settled
    .filter(result => result.status === 'fulfilled')
    .flatMap(result => result.value)
    .sort((a, b) => new Date(b.published) - new Date(a.published))
    .slice(0, 3);

  if (!items.length) {
    return Response.json({ error: 'youtube-feed-unavailable' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const response = Response.json({
    generatedAt: new Date().toISOString(),
    channels: CHANNELS.map(channel => channel.handle),
    items,
  }, {
    headers: {
      'Cache-Control': 'public, max-age=300, s-maxage=900',
      'X-Content-Type-Options': 'nosniff',
    },
  });

  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/api/youtube/latest') {
      return latestYouTube(request, ctx);
    }
    return env.ASSETS.fetch(request);
  },
};
