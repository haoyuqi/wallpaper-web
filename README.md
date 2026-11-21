<h1 align="center">Wallpaper Web</h1>

<p align="center">
  <a href="https://github.com/haoyuqi/wallpaper-web/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/haoyuqi/wallpaper-web/actions/workflows/ci.yml/badge.svg?branch=main"></a>
  <a href="https://github.com/haoyuqi/wallpaper-web/actions/workflows/ci.yml?query=branch%3Amain"><img alt="Coverage" src="https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fhaoyuqi%2Fwallpaper-web%2Fcoverage-badge%2Fcoverage.json"></a>
  <a href="https://github.com/haoyuqi/wallpaper-web/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/release/haoyuqi/wallpaper-web.svg"></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
</p>

<p align="center">
  English | <a href="README.zh-CN.md">简体中文</a>
</p>

A static frontend for browsing a Bing wallpaper archive. It is built with Vue 3, TypeScript, Vue Router and native CSS on a project-local Vite+ toolchain, and renders a cinema layout with a warm linen palette and the LXGW WenKai font. Metadata comes from a v1 API; there is no production mock mode.

## Features

- Browse the archive by date through the URL, for example `/?date=2026-10-18`. Without a date the app shows the last 30 UTC calendar days.
- Hero carousel with play, previous and next controls, plus a gallery that appends six cards at a time.
- One shared detail dialog for the hero and every card, with keyboard focus trapping, scroll restoration and a size-limited download.
- English and Simplified Chinese interface. The first visit follows the browser preference; a manual choice is saved and reused.
- Honest empty, error, rate-limit and image-failure states. The application never falls back to fixture data.

## Requirements

- Node.js 26.12.1 or later, and the npm version declared in `package.json`.
- A v1 API that serves `GET /api/v1/wallpapers` with either a `date` or a `from`/`to` range. This repository contains no backend.

## Getting started

```sh
npm ci
npm run dev
```

The development server listens on `http://127.0.0.1:5174/`. It proxies `/api` to `API_PROXY_TARGET`, which defaults to `http://wallpaper-api.test:8100`; that hostname is only a local default and is not a backend included here. To use another API, copy `.env.example` to `.env.local` and set `API_PROXY_TARGET` to its origin. Requests omit credentials.

## Environment variables

| Variable            | Scope                   | Purpose                                                                                                                         |
| ------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `API_PROXY_TARGET`  | Development server only | Upstream origin for the `/api` proxy. Never enters the browser bundle.                                                          |
| `VITE_API_BASE_URL` | Build time              | Public API origin used by the browser. Leave empty to call `/api` on the same origin. Never put secrets in a `VITE_*` variable. |

## Scripts

| Command                 | Purpose                                                                 |
| ----------------------- | ----------------------------------------------------------------------- |
| `npm run dev`           | Start the Vite development server.                                      |
| `npm run build`         | Type-check with `vue-tsc` and build the static bundle into `dist/`.     |
| `npm run preview`       | Serve the built bundle locally.                                         |
| `npm test`              | Run unit/component and end-to-end tests.                                |
| `npm run test:unit`     | Run unit and component tests.                                           |
| `npm run test:coverage` | Run unit tests with coverage and enforce the thresholds.                |
| `npm run test:e2e`      | Build and run the Playwright Chromium suite against the preview server. |
| `npm run check`         | Check formatting and lint, then type-check.                             |
| `npm run typecheck`     | Run `vue-tsc` only.                                                     |
| `npm run format`        | Format the repository.                                                  |

Install the browser binary once in a fresh environment before the end-to-end suite:

```sh
npx playwright install chromium
```

## Testing and quality gates

Unit and component tests run in `happy-dom` through `vp test`; Playwright drives headless Chromium against the production preview build with the API and image requests mocked, so no backend or live external service is required.

Coverage covers every `src/**/*.{ts,vue}` module and must stay at 100% for statements, branches, functions and lines. CI checks formatting, lint and types, builds the bundle, runs an OSV-Scanner dependency audit that fails on any advisory not exempted in `osv-scanner.toml`, and builds and smoke-tests the container on amd64 and arm64.

Playwright writes its HTML report and failure attachments under `tests/e2e/.results/`.

## Deployment

The production artifact is `dist/`, a static single-page application. The development API proxy does not ship with `dist/`. For a custom static host, configure the public `VITE_API_BASE_URL` at build time or add your own same-origin API proxy, and serve `index.html` for unknown paths.

The [production image](Dockerfile) bundles the static build with an Nginx server on port 8080. It serves the SPA and forwards `/api/` to the origin in `API_UPSTREAM` (default `http://wallpaper-api:8080`). Change this variable when starting a container to connect the **same image** to a different API; no Node.js installation or rebuild is needed on the host. The browser stays on the frontend origin and does not receive this variable. Use an HTTP(S) origin without a trailing slash or path; the API must be reachable from the container's Docker network. For example:

```sh
docker run --rm --name wallpaper-web --network wallpaper \
  -p 8080:8080 \
  -e API_UPSTREAM=http://wallpaper-api:8080 \
  ghcr.io/haoyuqi/wallpaper-web:latest
```

`GET /healthz` checks the static web server. Check a real `GET /api/v1/wallpapers?date=YYYY-MM-DD` to verify the upstream; `/healthz` does not check API availability. Keep the API port private behind the web proxy, and place TLS at the public ingress. Version tags such as `vX.Y.Z` can replace `latest` for controlled upgrades and rollback. Release images are published only after quality and both architecture smoke checks pass; already published version tags are not overwritten. A newly created GHCR package may need its visibility set to public before anonymous users can pull it. The separate Wallpaper API repository owns the combined Wallpaper Web/API Compose setup.

## Manual browser checks

Before releasing a change that touches layout or interaction, verify in Chrome: real API loading, date query, reload, back and clear, six-card append, all three dialog entry points, no previous/next switching inside the viewer, keyboard focus and Escape, scroll restoration, carousel pause and reduced motion, and download or its explicit fallback. Check the 320, 390, 700, 701, 768, 1120, 1121, 1440 and 1920 pixel widths plus 844x390 landscape, zoom and reflow, long text, and the empty, error, rate-limit and image-failure states.

## Font regeneration

The font assets are licensed under `public/fonts/OFL.txt`. Regeneration is optional and uses Python 3 with FontTools and Brotli; the committed assets were generated with fonttools 4.67.0 and brotli 1.2.0. Use a virtual environment for those dependencies, then run:

```sh
python3 scripts/build-fonts.py /path/to/LXGWWenKai-Regular.ttf
```

The original LXGW WenKai Regular v1.530 TTF is a design source and must be supplied separately; the included WOFF2 chunks are enough to build and run the app. The script verifies the full character map against the source, collapses contiguous `unicode-range` spans and stamps each chunk URL with an 8-character content hash for cache busting. Run `npm run format` after regeneration so `public/fonts/wenkai.css` matches repository formatting. Regenerate the priority subset after changing fixed interface text; every source character stays covered either way.

## License

Released under the [MIT license](LICENSE).
