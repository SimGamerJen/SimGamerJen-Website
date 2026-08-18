const JSON_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Robots-Tag': 'noindex, nofollow',
};

const HTML_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'text/html; charset=utf-8',
  'X-Robots-Tag': 'noindex, nofollow',
};

function wantsJson(request) {
  const url = new URL(request.url);
  return url.searchParams.get('format') === 'json' || request.headers.get('Accept')?.includes('application/json');
}

function number(value) {
  return Number(value || 0);
}

function londonDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function daysAgoDate(days) {
  const [year, month, day] = londonDate().split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function loadStats(db) {
  const last7Start = daysAgoDate(6);
  const last30Start = daysAgoDate(29);

  const [totalsResult, packageResult, periodResult, versionResult, dailyResult] = await db.batch([
    db.prepare(`
      SELECT COALESCE(SUM(downloads), 0) AS total
      FROM download_counts
      WHERE product = 'farm-sim-manager'
    `),
    db.prepare(`
      SELECT package_type, COALESCE(SUM(downloads), 0) AS downloads
      FROM download_counts
      WHERE product = 'farm-sim-manager'
      GROUP BY package_type
    `),
    db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN download_date >= ? THEN downloads ELSE 0 END), 0) AS last_7_days,
        COALESCE(SUM(CASE WHEN download_date >= ? THEN downloads ELSE 0 END), 0) AS last_30_days
      FROM download_counts
      WHERE product = 'farm-sim-manager'
    `).bind(last7Start, last30Start),
    db.prepare(`
      SELECT version, package_type, SUM(downloads) AS downloads
      FROM download_counts
      WHERE product = 'farm-sim-manager'
      GROUP BY version, package_type
      ORDER BY MAX(download_date) DESC, version DESC, package_type ASC
    `),
    db.prepare(`
      SELECT download_date, package_type, SUM(downloads) AS downloads
      FROM download_counts
      WHERE product = 'farm-sim-manager'
        AND download_date >= ?
      GROUP BY download_date, package_type
      ORDER BY download_date DESC, package_type ASC
    `).bind(last30Start),
  ]);

  const packages = { installer: 0, portable: 0 };
  for (const row of packageResult.results || []) {
    if (row.package_type in packages) {
      packages[row.package_type] = number(row.downloads);
    }
  }

  return {
    configured: true,
    generatedAt: new Date().toISOString(),
    total: number(totalsResult.results?.[0]?.total),
    installer: packages.installer,
    portable: packages.portable,
    last7Days: number(periodResult.results?.[0]?.last_7_days),
    last30Days: number(periodResult.results?.[0]?.last_30_days),
    byVersion: (versionResult.results || []).map((row) => ({
      version: row.version,
      package: row.package_type,
      downloads: number(row.downloads),
    })),
    daily: (dailyResult.results || []).map((row) => ({
      date: row.download_date,
      package: row.package_type,
      downloads: number(row.downloads),
    })),
  };
}

function statsHtml(stats) {
  const versionRows = stats.byVersion.length
    ? stats.byVersion.map((row) => `<tr><td>${escapeHtml(row.version)}</td><td>${escapeHtml(row.package)}</td><td>${row.downloads.toLocaleString('en-GB')}</td></tr>`).join('')
    : '<tr><td colspan="3">No downloads recorded yet.</td></tr>';

  const dailyRows = stats.daily.length
    ? stats.daily.map((row) => `<tr><td>${escapeHtml(row.date)}</td><td>${escapeHtml(row.package)}</td><td>${row.downloads.toLocaleString('en-GB')}</td></tr>`).join('')
    : '<tr><td colspan="3">No downloads recorded in the last 30 days.</td></tr>';

  return `<!doctype html>
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Farm Sim Manager Download Stats | SimGamerJen</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, system-ui, sans-serif; background: #171515; color: #f4f1ee; }
    body { margin: 0; padding: 32px 20px 56px; }
    main { width: min(1040px, 100%); margin: 0 auto; }
    h1 { margin: 0 0 8px; font-size: clamp(2rem, 5vw, 3.4rem); }
    p { color: #bdb7b2; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin: 28px 0; }
    .card, section { background: #211e1e; border: 1px solid #393333; border-radius: 16px; }
    .card { padding: 18px; }
    .label { display: block; color: #bdb7b2; font-size: .85rem; text-transform: uppercase; letter-spacing: .08em; }
    .value { display: block; margin-top: 8px; font-size: 2rem; font-weight: 800; }
    section { margin-top: 20px; padding: 18px; overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px 8px; border-bottom: 1px solid #393333; text-align: left; }
    th:last-child, td:last-child { text-align: right; }
    a { color: #f3c45a; }
    .small { font-size: .88rem; }
  </style>
</head>
<body>
<main>
  <p><a href="/farm-sim-manager/">← Farm Sim Manager</a></p>
  <h1>Download statistics</h1>
  <p>Server-side download requests recorded for Farm Sim Manager. HEAD requests are excluded. No IP addresses or personal identifiers are stored.</p>
  <div class="grid">
    <div class="card"><span class="label">Total</span><span class="value">${stats.total.toLocaleString('en-GB')}</span></div>
    <div class="card"><span class="label">Installer</span><span class="value">${stats.installer.toLocaleString('en-GB')}</span></div>
    <div class="card"><span class="label">Portable</span><span class="value">${stats.portable.toLocaleString('en-GB')}</span></div>
    <div class="card"><span class="label">Last 7 days</span><span class="value">${stats.last7Days.toLocaleString('en-GB')}</span></div>
    <div class="card"><span class="label">Last 30 days</span><span class="value">${stats.last30Days.toLocaleString('en-GB')}</span></div>
  </div>
  <section>
    <h2>By version</h2>
    <table><thead><tr><th>Version</th><th>Package</th><th>Downloads</th></tr></thead><tbody>${versionRows}</tbody></table>
  </section>
  <section>
    <h2>Last 30 days</h2>
    <table><thead><tr><th>Date</th><th>Package</th><th>Downloads</th></tr></thead><tbody>${dailyRows}</tbody></table>
  </section>
  <p class="small">Generated ${escapeHtml(stats.generatedAt)} · JSON: <a href="?format=json">?format=json</a></p>
</main>
</body>
</html>`;
}

function unconfiguredHtml() {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Download Stats Setup | SimGamerJen</title></head><body><main><h1>Download tracking is not configured yet</h1><p>The website code is ready, but the Cloudflare Pages project still needs a D1 binding named <code>DOWNLOAD_STATS</code>.</p></main></body></html>`;
}

export async function onRequest(context) {
  if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }

  if (!context.env.DOWNLOAD_STATS) {
    if (wantsJson(context.request)) {
      return new Response(JSON.stringify({ configured: false, error: 'DOWNLOAD_STATS D1 binding is not configured' }), {
        status: 503,
        headers: JSON_HEADERS,
      });
    }
    return new Response(context.request.method === 'HEAD' ? null : unconfiguredHtml(), { status: 503, headers: HTML_HEADERS });
  }

  try {
    const stats = await loadStats(context.env.DOWNLOAD_STATS);
    if (wantsJson(context.request)) {
      return new Response(context.request.method === 'HEAD' ? null : JSON.stringify(stats, null, 2), { headers: JSON_HEADERS });
    }
    return new Response(context.request.method === 'HEAD' ? null : statsHtml(stats), { headers: HTML_HEADERS });
  } catch (error) {
    console.error('[SGJ] Download stats query failed', error);
    const message = { configured: true, error: 'Download statistics are temporarily unavailable' };
    if (wantsJson(context.request)) {
      return new Response(context.request.method === 'HEAD' ? null : JSON.stringify(message), { status: 503, headers: JSON_HEADERS });
    }
    return new Response(context.request.method === 'HEAD' ? null : '<!doctype html><title>Download Stats</title><h1>Download statistics are temporarily unavailable</h1>', { status: 503, headers: HTML_HEADERS });
  }
}
