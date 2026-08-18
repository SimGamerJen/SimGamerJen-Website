# Farm Sim Manager download tracking

The public Farm Sim Manager download buttons use stable same-site tracking routes:

- `/download/farm-sim-manager/installer`
- `/download/farm-sim-manager/portable`

The Workers Static Assets entry point is `src/worker.js`. It passes the two download routes to `src/download-tracking.js`, which resolves the current release from `assets/data/farm-sim-manager-release.json`, records one GET request in D1, then redirects to the matching object on `downloads.simgamerjen.com`.

HEAD requests are redirected but are not counted. If the D1 database or counter write is unavailable, the download still continues so statistics cannot break public distribution.

## D1 database

The Worker binding is declared in `wrangler.jsonc` as `DOWNLOAD_STATS` without a fixed resource ID. Cloudflare/Wrangler automatic provisioning can create the D1 resource during deployment and attach it to the Worker.

The `download_counts` table and indexes are created automatically on the first tracked request or statistics query. `cloudflare/download-stats-schema.sql` is retained as a reference/recovery schema rather than a required normal deployment step.

If automatic provisioning is disabled or unavailable for the deployment environment, create a D1 database manually and configure the `DOWNLOAD_STATS` binding with that database's name and ID.

## Statistics view

Visit `/download-stats/` for the human-readable dashboard. It is deliberately omitted from public navigation and the sitemap and is marked `noindex, nofollow`.

Raw JSON is available at:

`/api/download-stats`

The database stores only daily aggregate counts by product, release version and package type. It does not store IP addresses, cookies, user agents, names or other personal identifiers.

## Releasing a new Farm Sim Manager version

Update `assets/data/farm-sim-manager-release.json` as normal. The tracker reads the current version and filenames from the manifest at request time, so the stable public tracking URLs do not change between releases.
