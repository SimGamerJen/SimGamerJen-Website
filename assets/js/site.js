(() => {
  const head = document.head;
  const ensureLink = (rel, href, extra = {}) => {
    let node = head.querySelector(`link[rel="${rel}"]`);
    if (!node) {
      node = document.createElement('link');
      node.rel = rel;
      head.appendChild(node);
    }
    node.href = href;
    Object.entries(extra).forEach(([key, value]) => node.setAttribute(key, value));
  };
  const ensureMeta = (selector, attrs) => {
    let node = head.querySelector(selector);
    if (!node) {
      node = document.createElement('meta');
      head.appendChild(node);
    }
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  };

  const canonicalPath = window.location.pathname.endsWith('/') || window.location.pathname.includes('.')
    ? window.location.pathname
    : `${window.location.pathname}/`;
  const canonicalUrl = `https://simgamerjen.com${canonicalPath}`;
  const description = head.querySelector('meta[name="description"]')?.content || 'Simulation gaming, livestreams, Farming Simulator mods and creator projects. Fun first, skills later.';

  ensureLink('icon', '/assets/images/sgj-logo-square.png', { type: 'image/png' });
  ensureLink('manifest', '/site.webmanifest');
  ensureLink('canonical', canonicalUrl);
  ensureMeta('meta[property="og:title"]', { property: 'og:title', content: document.title });
  ensureMeta('meta[property="og:description"]', { property: 'og:description', content: description });
  ensureMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
  ensureMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalUrl });
  ensureMeta('meta[property="og:image"]', { property: 'og:image', content: 'https://simgamerjen.com/assets/images/sgj-logo-square.png' });
  ensureMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
  ensureMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: document.title });
  ensureMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
  ensureMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: 'https://simgamerjen.com/assets/images/sgj-logo-square.png' });

  document.querySelectorAll('a[href^="http://"], a[href^="https://"]').forEach((link) => {
    try {
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
    } catch (_) {
      // Leave malformed or non-standard links untouched.
    }
  });

  if (window.location.pathname === '/mods/' || window.location.pathname.startsWith('/mods/')) {
    if (!head.querySelector('link[data-sgj-dds-icons]')) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = '/assets/css/dds-icons.css';
      css.dataset.sgjDdsIcons = 'true';
      head.appendChild(css);
    }
    if (!document.querySelector('script[data-sgj-dds-icons]')) {
      const script = document.createElement('script');
      script.src = '/assets/js/dds-icons.js';
      script.defer = true;
      script.dataset.sgjDdsIcons = 'true';
      head.appendChild(script);
    }
  }
})();
