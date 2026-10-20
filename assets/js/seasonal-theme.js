(() => {
  const root = document.documentElement;
  const THEME_PARAM = 'theme';

  const themes = {
    halloween: {
      label: 'Halloween',
      stylesheet: '/assets/css/themes/halloween.css',
      badgeTitle: 'Halloween at SGJ',
      badgeTagline: 'Fun first. Frights later.',
      decorations: [
        'halloween-moon',
        'halloween-mist halloween-mist--one',
        'halloween-mist halloween-mist--two',
        'halloween-bat halloween-bat--one',
        'halloween-bat halloween-bat--two',
        'halloween-bat halloween-bat--three',
        'halloween-bat halloween-bat--four',
        'halloween-motes',
        'halloween-witch'
      ],
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
        'seasonal-firework seasonal-firework--four',
        'seasonal-firework seasonal-firework--five',
        'seasonal-firework seasonal-firework--six',
        'seasonal-rocket seasonal-rocket--one',
        'seasonal-rocket seasonal-rocket--two'
      ],
      isActive(date) {
        const month = date.getMonth() + 1;
        const day = date.getDate();
        return month === 11 && day >= 2 && day <= 9;
      }
    },
    christmas: {
      label: 'Christmas',
      stylesheet: '/assets/css/themes/christmas.css',
      badgeTitle: 'Christmas at SGJ',
      badgeTagline: 'Fun first. Festive later.',
      decorations: [
        'christmas-lights',
        'christmas-snow christmas-snow--near',
        'christmas-snow christmas-snow--far',
        'christmas-glow',
        'christmas-star'
      ],
      isActive(date) {
        const month = date.getMonth() + 1;
        const day = date.getDate();
        return month === 12 && day >= 1 && day <= 27;
      }
    },
    'new-year': {
      label: 'New Year',
      stylesheet: '/assets/css/themes/new-year.css',
      badgeTitle: 'New Year at SGJ',
      badgeTagline: 'Same chaos. New calendar.',
      decorations: [
        'christmas-lights',
        'christmas-snow christmas-snow--near',
        'christmas-snow christmas-snow--far',
        'christmas-glow',
        'christmas-star',
        'newyear-burst newyear-burst--one',
        'newyear-burst newyear-burst--two',
        'newyear-burst newyear-burst--three',
        'newyear-sparkles',
        'newyear-confetti'
      ],
      isActive(date) {
        const month = date.getMonth() + 1;
        const day = date.getDate();
        return (month === 12 && day >= 28) || (month === 1 && day <= 2);
      }
    },
    'st-davids-day': {
      label: "St David's Day",
      stylesheet: '/assets/css/themes/st-davids-day.css',
      badgeTitle: "St David's Day at SGJ",
      badgeTagline: 'Dydd Gŵyl Dewi Hapus.',
      decorations: [
        'stdavid-daffodil stdavid-daffodil--one',
        'stdavid-daffodil stdavid-daffodil--two',
        'stdavid-petals',
        'stdavid-ribbon'
      ],
      isActive(date) {
        const month = date.getMonth() + 1;
        const day = date.getDate();
        return (month === 2 && day >= 27) || (month === 3 && day <= 2);
      }
    },
    birthday: {
      label: 'Birthday',
      stylesheet: '/assets/css/themes/birthday.css',
      badgeTitle: 'Birthday at SGJ',
      badgeTagline: 'Fun first. Cake later.',
      decorations: [
        'birthday-confetti',
        'birthday-balloon birthday-balloon--one',
        'birthday-balloon birthday-balloon--two',
        'birthday-balloon birthday-balloon--three',
        'birthday-sparkles'
      ],
      // Preview-only until the birthday date is configured.
      isActive() {
        return false;
      }
    }
  };

  const themeAliases = {
    'guy-fawkes': 'bonfire-night',
    'guy-fawkes-night': 'bonfire-night',
    'bonfire': 'bonfire-night',
    'xmas': 'christmas',
    'newyear': 'new-year',
    'ny': 'new-year',
    'st-david': 'st-davids-day',
    'st-davids': 'st-davids-day',
    'stdavids': 'st-davids-day',
    'bday': 'birthday'
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