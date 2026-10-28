# Architecture and feature map

This is a static Vue 3 + TypeScript SPA with Vue Router and native CSS. Vite+ is
project-local development/build tooling; production needs only a static server
and the separate Laravel API. No Node production server, Pinia or UI library is
required. There is no login, token storage, favorites or search in this version.

## Find the implementation

| Feature                                  | Owning source                                                                                           | Automated tests                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Startup and routing                      | `src/main.ts`, `src/router.ts`, `src/App.vue`                                                           | `tests/unit/components.test.ts`, `tests/e2e/archive.spec.ts`      |
| Interface languages and preference       | `src/i18n/`, `src/components/LanguageSelect.vue`, `src/App.vue`                                         | `tests/unit/i18n.test.ts`, `tests/e2e/archive.spec.ts`            |
| Archive, date URL and six-card batches   | `src/components/ArchivePage.vue`, `src/composables/useArchive.ts`                                       | `tests/unit/composables.test.ts`, `tests/e2e/archive.spec.ts`     |
| Request lifecycle and retry cancellation | `src/composables/useArchive.ts`, `src/services/wallpapers.ts`                                           | `tests/unit/composables.test.ts`, `tests/unit/services.test.ts`   |
| API boundary and nullable fields         | `src/services/wallpapers.ts`                                                                            | `tests/unit/services.test.ts`                                     |
| Calendar-only dates                      | `src/services/dates.ts`                                                                                 | `tests/unit/services.test.ts`                                     |
| Hero controls and pause reasons          | `src/components/CoverCarousel.vue`, `src/composables/useCarousel.ts`                                    | `tests/unit/composables.test.ts`, `tests/e2e/archive.spec.ts`     |
| Card and image feedback                  | `src/components/WallpaperCard.vue`, `src/components/WallpaperImage.vue`                                 | `tests/unit/components.test.ts`, `tests/e2e/archive.spec.ts`      |
| Single-object modal                      | `src/components/WallpaperViewer.vue`                                                                    | `tests/unit/components.test.ts`, `tests/e2e/archive.spec.ts`      |
| Download streaming limits                | `src/services/download.ts`                                                                              | `tests/unit/services.test.ts`, `tests/e2e/archive.spec.ts`        |
| Request/empty/rate-limit presentation    | `src/components/ArchiveStatus.vue`, `src/composables/useRetryAfter.ts`                                  | `tests/unit/components.test.ts`, `tests/unit/composables.test.ts` |
| Visual tokens and responsive layout      | `src/styles/tokens.css`, `src/styles/main.css`                                                          | `tests/e2e/archive.spec.ts`                                       |
| Original font conversion                 | `scripts/build-fonts.py`, `public/fonts/coverage.txt`                                                   | full source/output cmap equality in `scripts/build-fonts.py`      |
| Project tooling and quality gates        | `.editorconfig`, `.gitattributes`, `vite.config.ts`, `playwright.config.ts`, `.github/workflows/ci.yml` | `npm run check`, `npm run test:coverage`, `npm run test:e2e`      |

## Data and state

`ArchivePage` commits a date to `/?date=YYYY-MM-DD`. Vue Router supports reload,
back and forward. An absent date means the current inclusive 30 UTC calendar
days; an invalid date has an inline recovery state and is never sent to the API.
Unknown paths redirect to `/`. The static host must serve `index.html` for SPA
paths; configure this fallback in the deployment server.

`useArchive` calls the v1 service and cancels superseded requests for both the
gallery and the hero. Its sequence numbers also reject late responses from a
transport which ignores cancellation, so a stale retry cannot overwrite a newer
result. The hero advances every 5 seconds while autoplay is active.
Hero data is a separate, initial default-query snapshot (up to eight records),
independent of gallery filtering. Gallery stores returned metadata and renders
six records at a time; more reveals six additional keyed nodes. There are no
server page, cursor, total or latest parameters. The end message describes only
the current queried range. Empty data stays empty; the application never supplies fallback fixtures.
If the default window contains no records, the hero and its controls collapse;
a visually hidden page h1 remains and the collection shows one archive-empty
state. This intentionally avoids duplicate empty panels.

`WallpaperViewer` receives one immutable selected metadata object and the trigger
node. It does not receive a collection/index, mutate the router or implement
next/previous/swipe. Native modal dialog plus explicit focus cycling prevents
background interaction. Unmount cancels downloads, restores body styles, scroll
and trigger focus (or the gallery heading if the trigger disappeared).

## Network and security boundaries

The service owns Fetch, timeout/AbortController, HTTPS link validation, response
validation and error classification. Dynamic titles are rendered as Vue text;
there is no v-html. The API response query echo, count, source dates and nullable
fields are verified. Unknown optional fields are ignored. Duplicate IDs retain
the first record. Public requests omit credentials, and errors never display
server internals.

Downloads fetch the provided downloadUrl with a 30-second timeout, omit
credentials and accept only known raster image Content-Types. Streamed bytes
are limited to 25 MiB even if Content-Length is absent. Closing aborts pending
work; object URLs are revoked. CORS/network failures offer retry, original image
and an explicit native-link fallback. A browser save handoff is not proof of a
completed save. No image proxy or MIME/extension guesses are introduced.

The current client only reads wallpaper metadata and omits credentials. It has
no session state, token storage or authentication guards. Backend authentication
and CORS settings are external deployment concerns; they are not defined or
verified by this frontend repository.

## Interface languages

Vue I18n owns interface translations. `src/i18n/index.ts` resolves the initial
locale, handles saved preferences and provides date/title presentation helpers;
`LanguageSelect.vue` presents the native selector. `App.vue` owns reactive document
language and metadata. Source titles and copyright stay untranslated, and absent
titles are localized in components rather than baked into API results. See
[interface languages](i18n.md) for selection rules, dictionaries and verification.

## Styles and fonts

Shared colors, spacing and typography are defined in `src/styles/tokens.css`;
responsive layout and component styling are in `src/styles/main.css` and the
Vue components. The current interface uses a cinema layout, warm linen palette
and LXGW WenKai font. This repository contains the runtime UI and its assets.
Font chunks preserve the original v1.530 outlines and full Unicode cmap. A
small priority chunk serves fixed UI and Latin; other disjoint ranges are fetched
only for displayed characters. OFL attribution stays in `public/fonts/OFL.txt`.
The original TTF is not shipped. Images use API URLs without inventing variants.

## Maintenance

Keep this map aligned with source and test ownership. The implemented API request, types
and response validation live in `src/services/wallpapers.ts`. Development and
verification guidance belongs in README.md; coding rules in code-standards.md.

Automated verification combines unit/component tests (`tests/unit/`, run via `vp test`)
and Playwright Chromium end-to-end tests (`tests/e2e/`, run against the built preview
server with mocked network routes).

GitHub Actions runs these checks and the dependency audit through
[ci.yml](../.github/workflows/ci.yml). Triggers, reports and failure handling are
documented in [CI guide](ci.md).

## Repository layout

```text
wallpaper-web/
├── .editorconfig             # Shared editor defaults
├── .gitattributes            # Line endings and binary font assets
├── .github/workflows/ci.yml  # Automated checks, tests and dependency audit
├── README.md                 # Setup, development, verification and font tooling
├── AGENTS.md                 # AI instructions and reference entry point
├── docs/
│   ├── architecture.md       # Module ownership and data flow
│   ├── code-standards.md      # Coding conventions
│   └── ci.md                  # CI operation, reports and failure handling
├── src/
│   ├── main.ts               # Bootstrap
│   ├── App.vue
│   ├── router.ts             # History routing and date query
│   ├── components/           # Archive, carousel, cards, viewer and status UI
│   ├── composables/          # Lifecycle state and timing
│   ├── i18n/                 # Locale preferences, presentation and dictionaries
│   ├── services/             # API validation, dates and downloads
│   └── styles/               # Shared tokens and responsive styles
├── tests/
│   ├── unit/                 # Service, composable and component unit tests
│   └── e2e/                  # Playwright Chromium end-to-end tests and .results/
├── public/fonts/             # Font chunks, coverage and OFL license
├── scripts/build-fonts.py    # Font generation
├── .env.example              # Public configuration template
├── index.html
├── package.json
├── package-lock.json
├── playwright.config.ts      # Playwright E2E configuration
├── tsconfig.json
└── vite.config.ts
```

`node_modules/` and `dist/` are ignored dependency/build outputs. The backend
is a separately configured HTTP service; building and reading this repository
does not require a sibling checkout.
