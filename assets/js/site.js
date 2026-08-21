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

  // Reduce repeated SGJ/tagline branding in the sticky header while preserving the hero and footer artwork.
  document.querySelectorAll('.site-header .brand').forEach(brand => {
    const logo = brand.querySelector('.brand-logo');
    if (logo && !brand.querySelector('.header-wordmark')) {
      logo.remove();
      const wordmark = document.createElement('span');
      wordmark.className = 'header-wordmark';
      wordmark.textContent = 'SIMGAMERJEN';
      wordmark.style.cssText = 'display:block;color:var(--rose-light);font-size:clamp(1.7rem,2.35vw,2.35rem);font-weight:950;font-style:italic;line-height:1;letter-spacing:-.055em;text-transform:uppercase;white-space:nowrap;text-shadow:0 0 24px rgba(213,160,143,.10);';
      brand.appendChild(wordmark);
    }
  });

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

  // Keep Partners available site-wide without editing every static page by hand.
  document.querySelectorAll('header nav').forEach(nav => {
    if (!nav.querySelector('a[href="/partners/"]')) {
      const partners = document.createElement('a');
      partners.href = '/partners/';
      partners.textContent = 'Partners';
      const about = nav.querySelector('a[href="/about/"]');
      if (about) nav.insertBefore(partners, about); else nav.appendChild(partners);
    }
  });

  // Mark the current navigation destination for assistive technology.
  document.querySelectorAll('nav a.active').forEach(link => link.setAttribute('aria-current', 'page'));

  // Add low-key shared footer links without duplicating markup on every page.
  const footerGrid = document.querySelector('.site-footer .footer-grid');
  if (footerGrid) {
    const copyright = footerGrid.querySelector('p');
    if (!footerGrid.querySelector('.footer-partners')) {
      const partners = document.createElement('a');
      partners.className = 'footer-partners';
      partners.href = '/partners/';
      partners.textContent = 'Partners';
      partners.style.cssText = 'color:var(--muted);font-weight:750;text-decoration:none;';
      if (copyright) footerGrid.insertBefore(partners, copyright); else footerGrid.appendChild(partners);
    }
    if (!footerGrid.querySelector('.footer-support')) {
      const support = document.createElement('a');
      support.className = 'footer-support';
      support.href = 'https://buymeacoffee.com/simgamerjen';
      support.textContent = 'Buy Me a Coffee ↗';
      support.style.cssText = 'color:var(--rose-light);font-weight:800;text-decoration:none;';
      if (copyright) footerGrid.insertBefore(support, copyright); else footerGrid.appendChild(support);
    }
  }

  // Homepage-only SGJ updates component. It owns its presentation and disappears cleanly if the upstream feed is unavailable.
  if (window.location.pathname === '/' && !document.querySelector('[data-sgj-updates]')) {
    const quickStrip = document.querySelector('.quick-strip');
    const watchSection = document.querySelector('.watch-section');
    if (quickStrip && watchSection) {
      const updates = document.createElement('section');
      updates.className = 'section shell sgj-updates';
      updates.hidden = true;
      updates.setAttribute('data-sgj-updates', '');
      updates.innerHTML = '<div class="section-head"><div><p class="eyebrow">Latest from SGJ</p><h2>Between the videos.</h2></div><p>Stream plans, behind-the-scenes updates, polls and whatever is currently being tinkered with across the SGJ YouTube channels.</p></div><div class="sgj-updates-grid" data-sgj-updates-grid></div><p class="sgj-updates-note">Latest public posts from SimGamerJen and StreamGamerJen on YouTube.</p>';
      watchSection.parentNode.insertBefore(updates, watchSection);

      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = '/assets/css/home-updates.css';
      head.appendChild(css);

      const script = document.createElement('script');
      script.src = '/assets/js/home-updates.js';
      script.defer = true;
      document.body.appendChild(script);
    }
  }

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
