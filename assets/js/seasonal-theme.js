(() => {
  const root = document.documentElement;
  const THEME_PARAM = 'theme';

  const themes = {
    halloween: {
      label: 'Halloween',
      stylesheet: '/assets/css/themes/halloween.css',
      badgeTitle: 'Halloween at SGJ',
      badgeTagline: 'Fun first. Frights later.',
      isActive(date) {
        const month = date.getMonth() + 1;
        const day = date.getDate();
        return (month === 10 && day >= 20) || (month === 11 && day <= 1);
      }
    },
    'bonfire-night': {
      label: 'Guy Fawkes Night',
      stylesheet: '/assets/css/themes/bonfire-night.css',
      badgeTitle: 'Bonfire Night at SGJ',
      badgeTagline: 'Fun first. Fireworks later.',
      decorations: [
        'seasonal-firework seasonal-firework--one',
        'seasonal-firework seasonal-firework--two',
        'seasonal-firework seasonal-firework--three',
        'seasonal-firework seasonal-firework--four'
      ],
      isActive(date) {
        const month = date.getMonth() + 1;
        const day = date.getDate();
        return month === 11 && day >= 2 && day <= 6;
      }
    }
  };

  const themeAliases = {
    'guy-fawkes': 'bonfire-night',
    'guy-fawkes-night': 'bonfire-night',
    'bonfire': 'bonfire-night'
  };

  const params = new URLSearchParams(window.location.search);
  const rawRequested = (params.get(THEME_PARAM) || '').trim().toLowerCase();
  const requested = themeAliases[rawRequested] || rawRequested;

  let activeTheme = null;
  if (requested === 'default' || requested === 'off' || requested === 'none') {
    activeTheme = null;
  } else if (requested && themes[requested]) {
    activeTheme = requested;
  } else {
    const now = new Date();
    activeTheme = Object.keys(themes).find(key => themes[key].isActive(now)) || null;
  }

  if (!activeTheme) return;

  const config = themes[activeTheme];
  root.dataset.seasonTheme = activeTheme;
  root.classList.add('seasonal-theme');

  const addStylesheet = href => {
    if (document.head.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.seasonalStylesheet = activeTheme;
    document.head.appendChild(link);
  };

  addStylesheet('/assets/css/seasonal.css');
  addStylesheet(config.stylesheet);

  if (!document.querySelector('[data-seasonal-decor]')) {
    const decor = document.createElement('div');
    decor.className = 'seasonal-decor';
    decor.setAttribute('data-seasonal-decor', '');
    decor.setAttribute('aria-hidden', 'true');
    (config.decorations || []).forEach(className => {
      const effect = document.createElement('span');
      effect.className = `seasonal-effect ${className}`;
      decor.appendChild(effect);
    });
    document.body.prepend(decor);
  }

  if (window.location.pathname === '/' && !document.querySelector('[data-seasonal-badge]')) {
    const heroCopy = document.querySelector('.hero-copy-wrap');
    const eyebrow = heroCopy?.querySelector('.eyebrow');
    if (heroCopy && eyebrow) {
      const badge = document.createElement('p');
      badge.className = 'seasonal-badge';
      badge.setAttribute('data-seasonal-badge', '');

      const mark = document.createElement('span');
      mark.className = 'seasonal-badge-mark';
      mark.setAttribute('aria-hidden', 'true');

      const title = document.createElement('strong');
      title.textContent = config.badgeTitle || config.label;

      const tagline = document.createElement('span');
      tagline.textContent = config.badgeTagline || '';

      badge.append(mark, title, tagline);
      eyebrow.insertAdjacentElement('afterend', badge);
    }
  }
})();