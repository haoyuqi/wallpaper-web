# Repository development guide

## Reading order

- [README.md](README.md): setup, development, configuration, verification and font generation.
- [docs/architecture.md](docs/architecture.md): repository layout, module responsibilities and data flow.
- [docs/code-standards.md](docs/code-standards.md): coding conventions.

Read the relevant documentation, then verify it against the source. This guide
covers this repository without requiring sibling checkouts or private documents.
When behavior, interfaces or module responsibilities change, update the owning
documentation in the same change. Avoid maintaining the same facts in multiple places.

## Current implementation

- Vue 3, TypeScript, Vue Router and native CSS, using the project-local Vite+ toolchain.
- A static SPA with a wallpaper archive, date filtering, cover carousel, gallery and shared detail dialog.
- Components handle presentation and events; composables own lifecycle and state; services handle network I/O and data validation.
- Current styles and fonts are defined by `src/styles/`, the components and `public/fonts/`.
- API requests and response validation live in `src/services/wallpapers.ts`. Do not assume backend capabilities that the source does not use.
- Interface translations and locale preferences live in `src/i18n/`; see [docs/i18n.md](docs/i18n.md) before changing language behavior or adding interface text.
- Authentication, favorites, search and server-side pagination are not implemented. Gallery batches are a frontend display behavior.

## Change boundaries

- Inspect the worktree first, preserve unrelated changes and keep edits scoped to the task.
- Render metadata through Vue text interpolation. Preserve boundary validation, request cancellation and resource cleanup.
- Display appropriate error or empty states when API requests fail or return no data; do not substitute demo data.
- Preserve keyboard access, focus restoration, reduced-motion preferences and responsive layouts.
- Never expose `.env` contents or credentials. `VITE_*` values enter the public build and must not contain secrets.
- Do not install global toolchains, switch runtimes, commit, push or deploy without user authorization.

## Verification

Use the project commands in `package.json`: `npm test`, `npm run check` and
`npm run build` (`npm run test:unit`, `npm run test:coverage` and `npm run test:e2e`
can also be run individually). For interaction or layout changes, perform focused
browser checks using the guidance in README.
Report the checks actually performed, their results and any unverified scope.
A successful build is not evidence of successful browser verification.

## CI gates

`.github/workflows/ci.yml` is the source of truth for triggers, jobs and report
paths. Three rules are not visible in the source:

- `CI result` is the only required branch-protection check. Any failed, cancelled
  or skipped job fails it, so a re-run must be green before merging.
- The dependency audit fails only on high or critical advisories, and an audit
  service error also fails it. Never run `npm audit fix --force`; deferring an
  advisory needs a documented reason and review date.
- Dependabot auto-merge applies only to a non-draft pull request from this
  repository targeting `main` with an npm patch update that changes only
  `package.json` and `package-lock.json`. Everything else needs manual review.

## Git workflow

- Use `main` as the default base and pull request target unless the user specifies otherwise. Make changes on a topic branch and merge through a pull request.
- Branch names use `<type>/<issue-number>-<kebab-case-description>`, with lowercase English descriptions. Use the related issue number. Supported types are `feat`, `fix`, `docs`, `chore`, `refactor`, `perf`, `style` and `test`. Examples: `feat/2-wallpaper-frontend`, `fix/12-download-retry`. If no issue is associated, use `<type>/<kebab-case-description>` without inventing an issue number.
- Commit messages and pull request titles use `type(scope): summary`. Supported types are `feat`, `fix`, `docs`, `chore`, `refactor`, `perf`, `style` and `test`. The scope is optional; use the affected area when useful, such as `archive`, `viewer`, `fonts` or `deps`.
- Write the summary in English using the imperative mood, start with a lowercase letter and omit the trailing period. Keep the full subject within 72 characters. Example: `feat(archive): add wallpaper browsing and date filtering`.
- Keep commits focused. Use the body to explain non-obvious rationale, link related issues and record verification results for substantial changes.
- Before committing code changes, run `npm test`, `npm run check` and `npm run build`. Perform relevant browser checks for interaction or layout changes. For documentation-only changes, check formatting, links and factual accuracy.
- Review the files being staged, including untracked files. Never stage credentials, local environment files, dependency directories or generated build outputs.
- Commit, push and merge only when authorized by the user.
