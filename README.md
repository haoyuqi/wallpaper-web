# Wallpaper Web

[![CI](https://github.com/haoyuqi/wallpaper-web/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/haoyuqi/wallpaper-web/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fhaoyuqi%2Fwallpaper-web%2Fcoverage-badge%2Fcoverage.json)](https://github.com/haoyuqi/wallpaper-web/actions/workflows/ci.yml?query=branch%3Amain)
[![Latest release](https://img.shields.io/github/v/release/haoyuqi/wallpaper-web)](https://github.com/haoyuqi/wallpaper-web/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Bing wallpaper archive frontend. Vue 3, TypeScript, Vue Router and native CSS,
built with project-local Vite+. The interface uses a cinema layout, warm linen palette and LXGW
WenKai font. The app uses real v1 API metadata; there is no production mock mode.

The interface supports English and Simplified Chinese. It initially matches the
browser's preferred languages and falls back to English. A saved manual selection
takes priority on subsequent visits; choose a language at the top right.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5174/. The dev server proxies `/api` to
`API_PROXY_TARGET`, defaulting to `http://wallpaper-api.test:8100`. That hostname
is a local development default, not a backend included with this repository.
To use your own API, copy `.env.example` to `.env.local` and set
`API_PROXY_TARGET` to its origin. Requests omit credentials.

```sh
npm test
npm run test:unit
npm run test:coverage
npm run test:e2e
npm run check
npm run build
npm run preview
```

For end-to-end tests in a fresh environment, install the Chromium browser binary once with `npx playwright install chromium`.

The production artifact is `dist/`, a static SPA. The development API proxy does
not ship with it: configure a public VITE_API_BASE_URL at build time or a
same-origin API reverse proxy and SPA history fallback on the static host.

The current API client and response validation are in `src/services/wallpapers.ts`.
It requests `GET /api/v1/wallpapers` with either `date` or `from`/`to` parameters.
Authentication and server-side pagination are not implemented by this frontend.

## Development guidelines

Keep changes scoped and preserve unrelated work. Use Node.js 26.12.1 or later and
the npm version declared in `package.json`; all build tools are project-local.
Never commit .env or credentials.

Validate changes with automated tests (`npm test`), format/lint and type checking
(`npm run check`), production builds (`npm run build`) and focused browser checks.
Unit/component tests run in `happy-dom` via `vp test`, and end-to-end tests run in
headless Chromium via Playwright against the production preview build with mocked
network boundaries (no local backend or live external service required). Review
actual files, including untracked source, for correctness, readability, architecture,
security and performance. Report verification commands and results; do not claim
CI or broad browser/accessibility compliance without evidence.

## Continuous integration

[GitHub Actions](.github/workflows/ci.yml) runs formatting, lint, type checks,
unit/component tests, production build, Chromium E2E tests and a dependency audit.

The coverage badge above updates after each successful default-branch CI run.
Vitest includes every `src/**/*.{ts,vue}` file in its coverage report, and CI fails
unless statements, branches, functions and lines stay at 100%.

## Browser checks

Use Chrome to verify real API loading, date query/reload/back/clear, six-card
append, all three modal entry points, no viewer switching, keyboard focus/escape,
scroll restoration, carousel pause/reduced motion, download or honest fallback.
Check 320/390/700/701/768/1120/1121/1440/1920 widths and 844x390 landscape,
zoom/reflow, long text, empty/error/rate-limit/image failure and console/resources.
The user-facing application must never fall back to fixtures.

## Font regeneration

The font asset license is `public/fonts/OFL.txt`. Font regeneration is optional
and uses Python 3 with FontTools and Brotli. The existing assets were generated
with fonttools 4.67.0 and brotli 1.2.0. Use a virtual environment for these
dependencies, then run:

```sh
python3 scripts/build-fonts.py /path/to/LXGWWenKai-Regular.ttf
```

Use the virtual environment's Python 3 interpreter.
Supply the original LXGW WenKai Regular v1.530 TTF separately; it is not
required to build or run the app with the included WOFF2 assets.
The script verifies full cmap equality. The TTF is a design source, not an asset
to add to the production bundle. Regenerate after changing fixed UI text when
optimizing its priority subset; all source characters remain covered regardless.
