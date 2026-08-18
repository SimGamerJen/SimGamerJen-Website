(() => {
  const block = document.querySelector('[data-live-block]');
  if (!block) return;

  const offlineMarkup = block.innerHTML;
  let lastLive = false;

  const esc = (value = '') => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const duration = startedAt => {
    const start = Date.parse(startedAt || '');
    if (!Number.isFinite(start)) return '';
    const minutes = Math.max(0, Math.floor((Date.now() - start) / 60000));
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60), mins = minutes % 60;
    return mins ? `${hours} hr ${mins} min` : `${hours} hr`;
  };

  const demoBase = () => ({
    configured: true,
    live: true,
    title: 'Coffee Empire | The Roastery Goes Live | Farming Simulator 25',
    game: 'Farming Simulator 25',
    startedAt: new Date(Date.now() - 47 * 60000).toISOString(),
    thumbnail: '',
    demo: true,
  });

  function demoStatus(mode = 'twitch') {
    const base = demoBase();
    const twitch = { live: true, viewers: 42, url: 'https://www.twitch.tv/simgamerjen' };
    const sgj = { live: true, channel: 'SimGamerJen', viewers: 57, url: 'https://www.youtube.com/@SimGamerJen/live' };
    const stream = { live: true, channel: 'StreamGamerJen', viewers: 31, url: 'https://www.youtube.com/@StreamGamerJen/live' };

    if (mode === 'youtube-sgj') return { ...base, platforms: { twitch: { live: false }, youtube: sgj } };
    if (mode === 'youtube-stream') return { ...base, platforms: { twitch: { live: false }, youtube: stream } };
    if (mode === 'both-sgj') return { ...base, platforms: { twitch, youtube: sgj } };
    if (mode === 'both-stream') return { ...base, platforms: { twitch, youtube: stream } };
    return { ...base, platforms: { twitch, youtube: { live: false } } };
  }

  function normalise(data) {
    if (data.platforms) return data;
    return {
      ...data,
      platforms: {
        twitch: {
          live: Boolean(data.live),
          viewers: Number.isFinite(data.viewers) ? data.viewers : undefined,
          url: data.twitchUrl || 'https://www.twitch.tv/simgamerjen',
        },
        youtube: {
          live: false,
          url: data.youtubeUrl || '',
        },
      },
    };
  }

  function renderOffline() {
    if (!lastLive) return;
    block.classList.remove('is-live');
    block.innerHTML = offlineMarkup;
    lastLive = false;
  }

  function renderLive(raw) {
    const data = normalise(raw);
    const twitch = data.platforms?.twitch || { live: false };
    const youtube = data.platforms?.youtube || { live: false };
    const livePlatforms = [];
    if (twitch.live) livePlatforms.push('Twitch');
    if (youtube.live) livePlatforms.push(youtube.channel || 'YouTube');

    const liveFor = duration(data.startedAt);
    const viewers = [];
    if (twitch.live && Number.isFinite(twitch.viewers)) viewers.push(`${twitch.viewers.toLocaleString()} Twitch`);
    if (youtube.live && Number.isFinite(youtube.viewers)) viewers.push(`${youtube.viewers.toLocaleString()} YouTube`);
    const meta = [data.game, liveFor ? `Live for ${liveFor}` : '', viewers.length ? `${viewers.join(' + ')} watching` : ''].filter(Boolean);
    const platformChips = livePlatforms.map(name => `<span class="live-platform-chip">${esc(name)}</span>`).join('');
    const art = data.thumbnail ? `<div class="live-now-art"><img src="${esc(data.thumbnail)}" alt="Current SimGamerJen livestream preview"></div>` : `<div class="live-now-art live-now-art-demo"><strong>LIVE</strong><span>SIM GAMER JEN</span></div>`;

    const actions = [];
    if (twitch.live) actions.push(`<a class="button primary" href="${esc(twitch.url || 'https://www.twitch.tv/simgamerjen')}">Watch on Twitch ↗</a>`);
    if (youtube.live) actions.push(`<a class="button ${twitch.live ? 'secondary' : 'primary'}" href="${esc(youtube.url || '#')}">Watch on ${esc(youtube.channel || 'YouTube')} ↗</a>`);

    const where = livePlatforms.length > 1
      ? `SGJ is live right now on ${esc(livePlatforms.join(' and '))}.`
      : `SGJ is live right now on ${esc(livePlatforms[0] || 'stream')}.`;

    block.classList.add('is-live');
    block.innerHTML = `
      ${art}
      <div class="live-now-copy">
        <p class="eyebrow"><span class="live-pulse" aria-hidden="true"></span> Live now</p>
        <div class="live-platforms" aria-label="Live platforms">${platformChips}</div>
        <h2>${esc(data.title || 'SimGamerJen is live')}</h2>
        <p class="live-now-meta">${meta.map(esc).join(' · ')}</p>
        <p>${where} Jump into the stream on the platform you prefer.</p>
        <div class="live-now-actions">${actions.join('')}</div>
      </div>`;
    lastLive = true;
  }

  async function refresh() {
    try {
      const params = new URLSearchParams(window.location.search);
      const demo = params.get('liveDemo');
      if (demo) {
        renderLive(demoStatus(demo === '1' ? 'twitch' : demo));
        return;
      }
      const response = await fetch('/api/live-status', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      if (data.live) renderLive(data); else renderOffline();
    } catch (_) {
      // Keep the static offline presentation if the live service is temporarily unavailable.
    }
  }

  refresh();
  window.setInterval(refresh, 60000);
})();
