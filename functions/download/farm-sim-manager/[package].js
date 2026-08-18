const PRODUCT = 'farm-sim-manager';
const PRODUCT_NAME = 'Farm Sim Manager';
const ALLOWED_PACKAGES = new Set(['installer', 'portable']);
const DOWNLOAD_HOST = 'downloads.simgamerjen.com';

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

async function loadReleaseManifest(request) {
  const manifestUrl = new URL('/assets/data/farm-sim-manager-release.json', request.url);
  const response = await fetch(manifestUrl, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Release manifest returned ${response.status}`);
  }

  return response.json();
}

function packageFromManifest(manifest, packageType) {
  const item = packageType === 'installer' ? manifest.installer : manifest.portable;

  if (!manifest.downloadsEnabled || !manifest.version || !item?.url) {
    throw new Error('Requested package is not available for download');
  }

  const destination = new URL(item.url);
  if (destination.protocol !== 'https:' || destination.hostname !== DOWNLOAD_HOST) {
    throw new Error('Release manifest contains an unapproved download destination');
  }

  return {
    version: String(manifest.version),
    destination: destination.toString(),
  };
}

async function recordDownload(env, packageType, version) {
  if (!env.DOWNLOAD_STATS) {
    console.warn('[SGJ] DOWNLOAD_STATS D1 binding is not configured; download will continue without counting');
    return;
  }

  await env.DOWNLOAD_STATS.prepare(`
    INSERT INTO download_counts (
      download_date,
      product,
      version,
      package_type,
      downloads,
      updated_at
    ) VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(download_date, product, version, package_type)
    DO UPDATE SET
      downloads = downloads + 1,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    londonDate(),
    PRODUCT,
    version,
    packageType,
  ).run();
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

export async function onRequest(context) {
  const packageType = String(context.params.package || '').toLowerCase();

  if (!ALLOWED_PACKAGES.has(packageType)) {
    return new Response('Download package not found', { status: 404 });
  }

  if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { Allow: 'GET, HEAD' },
    });
  }

  let release;
  try {
    const manifest = await loadReleaseManifest(context.request);
    release = packageFromManifest(manifest, packageType);
  } catch (error) {
    console.error(`[SGJ] ${PRODUCT_NAME} download resolution failed`, error);
    return new Response('Download is temporarily unavailable', {
      status: 503,
      headers: {
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }

  if (context.request.method === 'GET') {
    try {
      await recordDownload(context.env, packageType, release.version);
    } catch (error) {
      console.error('[SGJ] Download counter write failed; allowing download to continue', error);
    }
  }

  return redirectResponse(release.destination);
}
