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

  function demoStatus() {
    return {
      configured: true,
      live: true,
      title: 'Coffee Empire | The Roastery Goes Live | Farming Simulator 25',
      game: 'Farming Simulator 25',
      viewers: 42,
      startedAt: new Date(Date.now() - 47 * 60000).toISOString(),
      twitchUrl: 'https://www.twitch.tv/simgamerjen',
      youtubeUrl: 'https://www.youtube.com/@SimGamerJen/live',
      thumbnail: '',
      demo: true,
    };
  }

  function renderOffline() {
    if (!lastLive) return;
    block.classList.remove('is-live');
    block.innerHTML = offlineMarkup;
    lastLive = false;
  }

  function renderLive(data) {
    const liveFor = duration(data.startedAt);
    const meta = [data.game, liveFor ? `Live for ${liveFor}` : '', Number.isFinite(data.viewers) ? `${data.viewers.toLocaleString()} watching` : ''].filter(Boolean);
    const art = data.thumbnail ? `<div class="live-now-art"><img src="${esc(data.thumbnail)}" alt="Current SimGamerJen livestream preview"></div>` : `<div class="live-now-art live-now-art-demo"><strong>LIVE</strong><span>SIM GAMER JEN</span></div>`;
    block.classList.add('is-live');
    block.innerHTML = `
      ${art}
      <div class="live-now-copy">
        <p class="eyebrow"><span class="live-pulse" aria-hidden="true"></span> Live now</p>
        <h2>${esc(data.title || 'SimGamerJen is live')}</h2>
        <p class="live-now-meta">${meta.map(esc).join(' · ')}</p>
        <p>SGJ is live right now. Jump into the stream on Twitch${data.youtubeUrl ? ' or YouTube' : ''}.</p>
        <div class="live-now-actions">
          <a class="button primary" href="${esc(data.twitchUrl || 'https://www.twitch.tv/simgamerjen')}">Watch on Twitch ↗</a>
          ${data.youtubeUrl ? `<a class="button secondary" href="${esc(data.youtubeUrl)}">Watch on YouTube ↗</a>` : ''}
        </div>
      </div>`;
    lastLive = true;
  }

  async function refresh() {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('liveDemo') === '1') {
        renderLive(demoStatus());
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
