(() => {
  const block = document.querySelector('[data-live-block]');
  if (!block) return;

  const offlineMarkup = block.innerHTML;
  let lastState = 'offline';

  const esc = (value = '') => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const duration = startedAt => {
    const start = Date.parse(startedAt || '');
    if (!Number.isFinite(start)) return '';
    const minutes = Math.max(0, Math.floor((Date.now() - start) / 60000));
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60), mins = minutes % 60;
    return mins ? `${hours} hr ${mins} min` : `${hours} hr`;
  };

  const earliestStartedAt = (...values) => {
    const parsed = values
      .filter(Boolean)
      .map(value => ({ value, time: Date.parse(value) }))
      .filter(entry => Number.isFinite(entry.time))
      .sort((a, b) => a.time - b.time);
    return parsed[0]?.value || '';
  };

  const formatScheduled = value => {
    const when = new Date(value || '');
    if (!Number.isFinite(when.getTime())) return '';
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(when);
  };

  const startsIn = value => {
    const time = Date.parse(value || '');
    if (!Number.isFinite(time)) return '';
    const minutes = Math.ceil((time - Date.now()) / 60000);
    if (minutes <= 0) return 'Scheduled start time reached';
    if (minutes === 1) return 'Starts in 1 min';
    if (minutes < 60) return `Starts in ${minutes} min`;
    const hours = Math.floor(minutes / 60), mins = minutes % 60;
    if (hours < 24) return mins ? `Starts in ${hours} hr ${mins} min` : `Starts in ${hours} hr`;
    const days = Math.floor(hours / 24), remainingHours = hours % 24;
    return remainingHours ? `Starts in ${days} day${days === 1 ? '' : 's'} ${remainingHours} hr` : `Starts in ${days} day${days === 1 ? '' : 's'}`;
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

  function normaliseDemoMode(mode = 'twitch') {
    let value = String(mode || 'twitch').trim().toLowerCase();
    if (value === '1') return 'twitch';
    if (value.startsWith('youtube=')) value = value.slice('youtube='.length);
    if (value === 'sgj' || value === 'youtube-simgamerjen') return 'youtube-sgj';
    if (value === 'stream' || value === 'streamgamerjen' || value === 'youtube-streamgamerjen') return 'youtube-stream';
    return value;
  }

  function demoStatus(mode = 'twitch') {
    const base = demoBase();
    const twitch = { live: true, viewers: 42, startedAt: new Date(Date.now() - 42 * 60000).toISOString(), url: 'https://www.twitch.tv/simgamerjen' };
    const sgj = { live: true, channel: 'SimGamerJen', viewers: 57, startedAt: new Date(Date.now() - 47 * 60000).toISOString(), url: 'https://www.youtube.com/@SimGamerJen/live' };
    const stream = { live: true, channel: 'StreamGamerJen', viewers: 31, startedAt: new Date(Date.now() - 49 * 60000).toISOString(), url: 'https://www.youtube.com/@StreamGamerJen/live' };
    const resolved = normaliseDemoMode(mode);

    if (resolved === 'upcoming-sgj' || resolved === 'up-next-sgj') return {
      configured: true,
      live: false,
      state: 'upcoming',
      upcoming: {
        channel: 'SimGamerJen',
        title: 'Coffee Empire | The Roastery Goes Live | Farming Simulator 25',
        scheduledStartTime: new Date(Date.now() + 2 * 60 * 60000 + 14 * 60000).toISOString(),
        url: 'https://www.youtube.com/@SimGamerJen/live',
        thumbnail: '',
      },
    };
    if (resolved === 'upcoming-stream' || resolved === 'up-next-stream') return {
      configured: true,
      live: false,
      state: 'upcoming',
      upcoming: {
        channel: 'StreamGamerJen',
        title: 'Foundation | Back to Jensbury',
        scheduledStartTime: new Date(Date.now() + 19 * 60 * 60000).toISOString(),
        url: 'https://www.youtube.com/@StreamGamerJen/live',
        thumbnail: '',
      },
    };
    if (resolved === 'youtube-sgj') return { ...base, startedAt: sgj.startedAt, platforms: { twitch: { live: false }, youtube: sgj } };
    if (resolved === 'youtube-stream') return { ...base, startedAt: stream.startedAt, platforms: { twitch: { live: false }, youtube: stream } };
    if (resolved === 'both-sgj') return { ...base, platforms: { twitch, youtube: sgj } };
    if (resolved === 'both-stream') return { ...base, platforms: { twitch, youtube: stream } };
    return { ...base, startedAt: twitch.startedAt, platforms: { twitch, youtube: { live: false } } };
  }

  function normalise(data) {
    if (data.platforms) return data;
    return {
      ...data,
      platforms: {
        twitch: {
          live: Boolean(data.live),
          viewers: Number.isFinite(data.viewers) ? data.viewers : undefined,
          startedAt: data.startedAt || '',
          url: data.twitchUrl || 'https://www.twitch.tv/simgamerjen',
        },
        youtube: {
          live: false,
          url: data.youtubeUrl || '',
        },
      },
    };
  }

  function setState(state) {
    block.classList.toggle('is-live', state === 'live');
    block.classList.toggle('is-upcoming', state === 'upcoming');
    lastState = state;
  }

  function renderOffline() {
    if (lastState === 'offline') return;
    block.innerHTML = offlineMarkup;
    setState('offline');
  }

  function renderUpcoming(data) {
    const upcoming = data.upcoming;
    if (!upcoming) return renderOffline();
    const channel = upcoming.channel || 'YouTube';
    const scheduled = formatScheduled(upcoming.scheduledStartTime);
    const countdown = startsIn(upcoming.scheduledStartTime);
    const meta = [scheduled, countdown].filter(Boolean);
    const art = upcoming.thumbnail
      ? `<div class="live-now-art upcoming-art"><img src="${esc(upcoming.thumbnail)}" alt="Scheduled ${esc(channel)} livestream preview"></div>`
      : `<div class="live-now-art live-now-art-demo upcoming-art-demo"><strong>UP</strong><span>NEXT · SIMGAMERJEN</span></div>`;

    block.innerHTML = `
      ${art}
      <div class="live-now-copy upcoming-copy">
        <p class="eyebrow">Up next</p>
        <div class="live-platforms" aria-label="Scheduled platform"><span class="live-platform-chip upcoming-platform-chip">YouTube · ${esc(channel)}</span></div>
        <h2>${esc(upcoming.title || 'Next SimGamerJen livestream')}</h2>
        <p class="live-now-meta">${meta.map(esc).join(' · ')}</p>
        <p>The next SGJ livestream is scheduled on ${esc(channel)}. When it goes live, this panel will switch automatically to the active stream.</p>
        <div class="live-now-actions"><a class="button primary" href="${esc(upcoming.url || '#')}">View scheduled stream ↗</a></div>
      </div>`;
    setState('upcoming');
  }

  function renderLive(raw) {
    const data = normalise(raw);
    const twitch = data.platforms?.twitch || { live: false };
    const youtube = data.platforms?.youtube || { live: false };
    const livePlatforms = [];
    if (twitch.live) livePlatforms.push({ label: 'Twitch', prose: 'Twitch' });
    if (youtube.live) livePlatforms.push({ label: `YouTube · ${youtube.channel || 'YouTube'}`, prose: youtube.channel || 'YouTube' });

    const unifiedStartedAt = earliestStartedAt(
      twitch.live ? twitch.startedAt : '',
      youtube.live ? youtube.startedAt : '',
      data.startedAt
    );
    const liveFor = duration(unifiedStartedAt);
    const viewers = [];
    if (twitch.live && Number.isFinite(twitch.viewers)) viewers.push(`${twitch.viewers.toLocaleString()} Twitch`);
    if (youtube.live && Number.isFinite(youtube.viewers)) viewers.push(`${youtube.viewers.toLocaleString()} YouTube`);
    const meta = [data.game, liveFor ? `Live for ${liveFor}` : '', viewers.length ? `${viewers.join(' + ')} watching` : ''].filter(Boolean);
    const platformChips = livePlatforms.map(platform => `<span class="live-platform-chip">${esc(platform.label)}</span>`).join('');
    const art = data.thumbnail ? `<div class="live-now-art"><img src="${esc(data.thumbnail)}" alt="Current SimGamerJen livestream preview"></div>` : `<div class="live-now-art live-now-art-demo"><strong>LIVE</strong><span>SIM GAMER JEN</span></div>`;

    const actions = [];
    if (twitch.live) actions.push(`<a class="button primary" href="${esc(twitch.url || 'https://www.twitch.tv/simgamerjen')}">Watch on Twitch ↗</a>`);
    if (youtube.live) actions.push(`<a class="button ${twitch.live ? 'secondary' : 'primary'}" href="${esc(youtube.url || '#')}">Watch on ${esc(youtube.channel || 'YouTube')} ↗</a>`);

    const prosePlatforms = livePlatforms.map(platform => platform.prose);
    const where = prosePlatforms.length > 1
      ? `SGJ is live right now on ${esc(prosePlatforms.join(' and '))}.`
      : `SGJ is live right now on ${esc(prosePlatforms[0] || 'stream')}.`;

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
    setState('live');
  }

  async function refresh() {
    try {
      const params = new URLSearchParams(window.location.search);
      const demo = params.get('liveDemo');
      if (demo) {
        const data = demoStatus(demo);
        if (data.live) renderLive(data); else if (data.upcoming) renderUpcoming(data); else renderOffline();
        return;
      }
      const response = await fetch('/api/live-status', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      if (data.live) renderLive(data);
      else if (data.upcoming) renderUpcoming(data);
      else renderOffline();
    } catch (_) {
      // Keep the last successful presentation if the live service is temporarily unavailable.
    }
  }

  refresh();
  window.setInterval(refresh, 60000);
})();
