(() => {
  const head = document.head;
  const ensureLink = (rel, href, extra = {}) => {
    let node = head.querySelector(`link[rel="${rel}"]`);
    if (!node) { node = document.createElement('link'); node.rel = rel; head.appendChild(node); }
    node.href = href;
    Object.entries(extra).forEach(([key, value]) => node.setAttribute(key, value));
  };
  const ensureMeta = (selector, attrs) => {
    let node = head.querySelector(selector);
    if (!node) { node = document.createElement('meta'); head.appendChild(node); }
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  };

  const canonicalPath = window.location.pathname.endsWith('/') || window.location.pathname.includes('.') ? window.location.pathname : `${window.location.pathname}/`;
  const canonicalUrl = `https://simgamerjen.com${canonicalPath}`;
  const description = head.querySelector('meta[name="description"]')?.content || 'Simulation gaming, livestreams, Farming Simulator mods and creator projects. Fun first, skills later.';
  const pageImage = head.querySelector('meta[name="sgj-social-image"]')?.content || '/assets/images/sgj-logo-square.png';
  const socialImage = pageImage.startsWith('http') ? pageImage : `https://simgamerjen.com${pageImage}`;

  ensureLink('icon', '/assets/images/sgj-logo-square.png', { type: 'image/png' });
  ensureLink('manifest', '/site.webmanifest');
  ensureLink('canonical', canonicalUrl);
  ensureMeta('meta[property="og:title"]', { property: 'og:title', content: document.title });
  ensureMeta('meta[property="og:description"]', { property: 'og:description', content: description });
  ensureMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
  ensureMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalUrl });
  ensureMeta('meta[property="og:image"]', { property: 'og:image', content: socialImage });
  ensureMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
  ensureMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: document.title });
  ensureMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
  ensureMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: socialImage });

  // Give keyboard users a direct route past the repeated navigation.
  if (!document.querySelector('.skip-link') && document.querySelector('main')) {
    const main = document.querySelector('main');
    if (!main.id) main.id = 'main-content';
    const skip = document.createElement('a');
    skip.className = 'skip-link';
    skip.href = `#${main.id}`;
    skip.textContent = 'Skip to content';
    skip.style.cssText = 'position:fixed;left:1rem;top:1rem;z-index:1000;padding:.75rem 1rem;border-radius:8px;background:#f7f0ec;color:#171515;font-weight:850;text-decoration:none;transform:translateY(-200%);transition:transform .15s ease;';
    skip.addEventListener('focus', () => { skip.style.transform = 'translateY(0)'; });
    skip.addEventListener('blur', () => { skip.style.transform = 'translateY(-200%)'; });
    document.body.prepend(skip);
  }

  // Mark the current navigation destination for assistive technology.
  document.querySelectorAll('nav a.active').forEach(link => link.setAttribute('aria-current', 'page'));

  // External links consistently open separately, including links rendered after page load.
  const prepareExternalLinks = (scope = document) => {
    scope.querySelectorAll?.('a[href^="http://"], a[href^="https://"]').forEach((link) => {
      try {
        const url = new URL(link.href, window.location.href);
        if (url.origin !== window.location.origin) {
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
        }
      } catch (_) {}
    });
  };
  prepareExternalLinks();
  const observer = new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
    if (node.nodeType === 1) prepareExternalLinks(node);
  })));
  observer.observe(document.body, { childList: true, subtree: true });
})();
