(() => {
  const section = document.querySelector('[data-sgj-updates]');
  const grid = document.querySelector('[data-sgj-updates-grid]');
  if (!section || !grid) return;

  const esc = (value = '') => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const truncate = (value = '', max = 360) => {
    const text = String(value || '').trim();
    return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
  };

  function demoPosts() {
    return [
      {
        id: 'demo1', channel: 'SimGamerJen', handle: '@SimGamerJen', type: 'image',
        text: 'A little progress update from behind the scenes. The plan looked perfectly sensible right up until I started testing it.',
        publishedText: '2 hours ago', image: '', url: 'https://www.youtube.com/@SimGamerJen/posts',
      },
      {
        id: 'demo2', channel: 'StreamGamerJen', handle: '@StreamGamerJen', type: 'text',
        text: 'Tonight’s stream is scheduled. New settlement, questionable planning decisions and absolutely no guarantee the bridge survives contact with reality.',
        publishedText: '1 day ago', image: '', url: 'https://www.youtube.com/@StreamGamerJen/posts',
      },
      {
        id: 'demo3', channel: 'SimGamerJen', handle: '@SimGamerJen', type: 'poll',
        text: 'What should get the next proper deep-dive?', publishedText: '3 days ago',
        poll: { choices: ['Farm Sim Manager', 'Crop Control Override', 'HelperProfiles'] },
        image: '', url: 'https://www.youtube.com/@SimGamerJen/posts',
      },
    ];
  }

  function render(posts) {
    if (!Array.isArray(posts) || !posts.length) {
      section.hidden = true;
      return;
    }
    section.hidden = false;
    grid.innerHTML = posts.slice(0, 3).map(post => {
      const image = post.image
        ? `<a class="sgj-update-art" href="${esc(post.url)}" target="_blank" rel="noopener"><img src="/api/update-image?id=${encodeURIComponent(post.id)}" alt="" loading="lazy"></a>`
        : '';
      const poll = post.poll?.choices?.length
        ? `<div class="sgj-update-poll">${post.poll.choices.slice(0, 4).map(choice => `<span>${esc(choice)}</span>`).join('')}</div>`
        : '';
      return `<article class="sgj-update-card ${image ? 'has-image' : ''}">
        ${image}
        <div class="sgj-update-copy">
          <div class="sgj-update-meta"><span>${esc(post.channel || 'SimGamerJen')}</span><span>${esc(post.publishedText || '')}</span></div>
          ${post.text ? `<p>${esc(truncate(post.text))}</p>` : ''}
          ${poll}
          <a class="sgj-update-link" href="${esc(post.url)}" target="_blank" rel="noopener">View on YouTube ↗</a>
        </div>
      </article>`;
    }).join('');
  }

  async function load() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('updatesDemo')) {
      render(demoPosts());
      return;
    }
    try {
      const response = await fetch('/api/updates', { cache: 'no-store' });
      if (!response.ok) throw new Error(`updates-${response.status}`);
      const data = await response.json();
      render(data.posts || []);
    } catch (_) {
      section.hidden = true;
    }
  }

  load();
})();
