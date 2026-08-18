# Farm Sim Manager download tracking

The public Farm Sim Manager download buttons use same-site tracking routes:

- `/download/farm-sim-manager/installer`
- `/download/farm-sim-manager/portable`

The Pages Function resolves the current release from `assets/data/farm-sim-manager-release.json`, records one GET request in D1, then redirects to the approved `downloads.simgamerjen.com` R2 object. HEAD requests are redirected but are not counted. A D1 write failure does not block the download.

## D1 database

Create a D1 database for the website download counters, for example `simgamerjen-download-stats`, then execute `cloudflare/download-stats-schema.sql` against it.

Bind that database to the Cloudflare Pages project using the variable name:

`DOWNLOAD_STATS`

The binding is required in Production. Add the same binding to Preview if preview deployments should be able to exercise the statistics functionality.

After adding or changing a Pages binding, redeploy the project so the Function receives it.

## Statistics view

Visit `/download-stats` for the human-readable dashboard. It is intentionally not linked in the public navigation and sends `noindex, nofollow`.

JSON is available at:

`/download-stats?format=json`

The database stores only daily aggregate counts by product, release version and package type. It does not store IP addresses, cookies, user agents, names or other personal identifiers.

## Releasing a new Farm Sim Manager version

Update `assets/data/farm-sim-manager-release.json` as normal. The tracking Function reads the current manifest at request time, so the stable tracking URLs do not need to change for each version.
