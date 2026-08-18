const PRODUCT = 'farm-sim-manager';
const PRODUCT_NAME = 'Farm Sim Manager';
const DOWNLOAD_HOST = 'downloads.simgamerjen.com';
const ALLOWED_PACKAGES = new Set(['installer', 'portable']);
let schemaReadyPromise = null;

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

async function ensureSchema(db) {
  if (!db) return false;
  if (!schemaReadyPromise) {
    schemaReadyPromise = db.batch([
      db.prepare(`
        CREATE TABLE IF NOT EXISTS download_counts (
          download_date TEXT NOT NULL,
          product TEXT NOT NULL,
          version TEXT NOT NULL,
          package_type TEXT NOT NULL CHECK (package_type IN ('installer', 'portable')),
          downloads INTEGER NOT NULL DEFAULT 0 CHECK (downloads >= 0),
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (download_date, product, version, package_type)
        )
      `),
      db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_download_counts_product_date
        ON download_counts (product, download_date)
      `),
      db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_download_counts_product_version
        ON download_counts (product, version)
      `),
    ]).catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }
  await schemaReadyPromise;
  return true;
}

async function loadReleaseManifest(request, env) {
  const manifestUrl = new URL('/assets/data/farm-sim-manager-release.json', request.url);
  const response = await env.ASSETS.fetch(new Request(manifestUrl, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  }));
  if (!response.ok) throw new Error(`Release manifest returned ${response.status}`);
  return response.json();
}

function packageFromManifest(manifest, packageType) {
  const item = packageType === 'installer' ? manifest.installer : manifest.portable;
  if (!manifest.downloadsEnabled || !manifest.version || !item?.url) {
    throw new Error('Requested package is not available for download');
  }

  const filename = String(item.filename || '').trim();
  if (!filename || filename.includes('/') || filename.includes('\\')) {
    throw new Error('Release manifest contains an invalid filename');
  }

  const version = String(manifest.version).trim();
  if (!/^[0-9A-Za-z._-]+$/.test(version)) {
    throw new Error('Release manifest contains an invalid version');
  }

  const destination = new URL(`https://${DOWNLOAD_HOST}/farm-sim-manager/${encodeURIComponent(version)}/${encodeURIComponent(filename)}`);
  return { version, destination: destination.toString() };
}

async function recordDownload(env, packageType, version) {
  if (!env.DOWNLOAD_STATS) {
    console.warn('[SGJ] DOWNLOAD_STATS D1 binding is unavailable; download will continue without counting');
    return;
  }
  await ensureSchema(env.DOWNLOAD_STATS);
  await env.DOWNLOAD_STATS.prepare(`
    INSERT INTO download_counts (
      download_date, product, version, package_type, downloads, updated_at
    ) VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(download_date, product, version, package_type)
    DO UPDATE SET downloads = downloads + 1, updated_at = CURRENT_TIMESTAMP
  `).bind(londonDate(), PRODUCT, version, packageType).run();
}

function redirectResponse(destination) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: destination,
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

export async function handleDownload(request, env) {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/download\/farm-sim-manager\/(installer|portable)\/?$/);
  if (!match) return null;

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }

  const packageType = match[1];
  if (!ALLOWED_PACKAGES.has(packageType)) return new Response('Download package not found', { status: 404 });

  let release;
  try {
    release = packageFromManifest(await loadReleaseManifest(request, env), packageType);
  } catch (error) {
    console.error(`[SGJ] ${PRODUCT_NAME} download resolution failed`, error);
    return new Response('Download is temporarily unavailable', {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
    });
  }

  if (request.method === 'GET') {
    try {
      await recordDownload(env, packageType, release.version);
    } catch (error) {
      console.error('[SGJ] Download counter write failed; allowing download to continue', error);
    }
  }

  return redirectResponse(release.destination);
}

function number(value) {
  return Number(value || 0);
}

export async function handleDownloadStats(request, env) {
  const url = new URL(request.url);
  if (url.pathname !== '/api/download-stats') return null;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  if (!env.DOWNLOAD_STATS) {
    return Response.json({ configured: false, error: 'DOWNLOAD_STATS D1 binding is unavailable' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
    });
  }

  try {
    await ensureSchema(env.DOWNLOAD_STATS);
    const last7Start = daysAgoDate(6);
    const last30Start = daysAgoDate(29);
    const [totalResult, packageResult, periodResult, versionResult, dailyResult] = await env.DOWNLOAD_STATS.batch([
      env.DOWNLOAD_STATS.prepare(`SELECT COALESCE(SUM(downloads), 0) AS total FROM download_counts WHERE product = ?`).bind(PRODUCT),
      env.DOWNLOAD_STATS.prepare(`SELECT package_type, COALESCE(SUM(downloads), 0) AS downloads FROM download_counts WHERE product = ? GROUP BY package_type`).bind(PRODUCT),
      env.DOWNLOAD_STATS.prepare(`
        SELECT
          COALESCE(SUM(CASE WHEN download_date >= ? THEN downloads ELSE 0 END), 0) AS last_7_days,
          COALESCE(SUM(CASE WHEN download_date >= ? THEN downloads ELSE 0 END), 0) AS last_30_days
        FROM download_counts WHERE product = ?
      `).bind(last7Start, last30Start, PRODUCT),
      env.DOWNLOAD_STATS.prepare(`
        SELECT version, package_type, SUM(downloads) AS downloads
        FROM download_counts WHERE product = ?
        GROUP BY version, package_type
        ORDER BY MAX(download_date) DESC, version DESC, package_type ASC
      `).bind(PRODUCT),
      env.DOWNLOAD_STATS.prepare(`
        SELECT download_date, package_type, SUM(downloads) AS downloads
        FROM download_counts WHERE product = ? AND download_date >= ?
        GROUP BY download_date, package_type
        ORDER BY download_date DESC, package_type ASC
      `).bind(PRODUCT, last30Start),
    ]);

    const packages = { installer: 0, portable: 0 };
    for (const row of packageResult.results || []) {
      if (row.package_type in packages) packages[row.package_type] = number(row.downloads);
    }

    const payload = {
      configured: true,
      generatedAt: new Date().toISOString(),
      total: number(totalResult.results?.[0]?.total),
      installer: packages.installer,
      portable: packages.portable,
      last7Days: number(periodResult.results?.[0]?.last_7_days),
      last30Days: number(periodResult.results?.[0]?.last_30_days),
      byVersion: (versionResult.results || []).map((row) => ({ version: row.version, package: row.package_type, downloads: number(row.downloads) })),
      daily: (dailyResult.results || []).map((row) => ({ date: row.download_date, package: row.package_type, downloads: number(row.downloads) })),
    };

    return new Response(request.method === 'HEAD' ? null : JSON.stringify(payload), {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json; charset=utf-8',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  } catch (error) {
    console.error('[SGJ] Download stats query failed', error);
    return Response.json({ configured: true, error: 'Download statistics are temporarily unavailable' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
    });
  }
}
