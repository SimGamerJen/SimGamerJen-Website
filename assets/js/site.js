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
