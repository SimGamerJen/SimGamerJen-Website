# SimGamerJen Website

Official website source for **SimGamerJen.com**.

> Fun first, skills later.

## Current status

Initial static foundation for the SimGamerJen brand website. The first deployment is intentionally framework-free so the site can be connected to Cloudflare Pages with minimal configuration while the final information architecture and visual design are developed.

## Structure

```text
/
├── index.html
├── robots.txt
├── assets/
│   └── css/
│       └── site.css
└── README.md
```

## Cloudflare Pages

For the initial deployment:

- **Production branch:** `main`
- **Framework preset:** None / Static HTML
- **Build command:** leave blank
- **Build output directory:** `/` (repository root)

Cloudflare will serve the repository root directly. A custom domain can be added later after the temporary `*.pages.dev` deployment has been tested.

## Planned site areas

- Home
- Watch / livestreams and videos
- Mods
- Projects / series
- About SimGamerJen
- Partners / contact

The architecture may evolve as the site is designed. The repository is intentionally kept simple at this stage rather than committing prematurely to a JavaScript framework or CMS.
