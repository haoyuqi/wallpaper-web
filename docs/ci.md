# Continuous integration

[CI](../.github/workflows/ci.yml) runs on pull requests targeting `main`, pushes to
`main`, manual dispatch and a daily schedule at 03:21 Beijing time (19:21 UTC on
the previous day). GitHub schedules run only on the default branch and may be
delayed. In public repositories, GitHub disables scheduled workflows after 60
days without repository activity; re-enable them from Actions if needed.

The workflow uses Ubuntu 24.04, Node.js 26 and the npm version declared in
`package.json`. Dependency installations use `npm ci`; only npm's download cache
is shared. Four jobs run independently:

| Job              | Local command                                                           | Purpose                                                                 |
| ---------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Check            | `npm run check`                                                         | Formatting, lint and TypeScript                                         |
| Unit tests       | `npm run test:coverage`                                                 | Unit/component tests and coverage                                       |
| Build and E2E    | `npm run test:e2e`                                                      | Production build, preview server and Chromium tests                     |
| Dependency audit | `npm audit --package-lock-only --include=dev --audit-level=high --json` | Known vulnerabilities in locked production and development dependencies |

`CI result` succeeds only when all four jobs succeed. Failed, cancelled or skipped
jobs fail the aggregate check. The `main` branch protection requires `CI result`
and an up-to-date branch before merging; the workflow itself does not configure
it. New runs cancel older runs for the same event and PR/ref; scheduled, manual
and push runs do not cancel each other.

E2E tests mock API and image requests and need no backend, private files or secrets.
On Linux CI, Chromium and its system dependencies are installed with
`npx --no-install playwright install --with-deps chromium`. Playwright builds the
application before starting the preview server, uses one worker and retries failed
tests once. Its five-minute test timeout leaves room within the 15-minute job
timeout for installation and report upload.

Coverage, Playwright reports/failure attachments and dependency audit JSON reports
are retained as Actions artifacts for seven days, including after test/audit
failures when reports were generated. Open the failed job's logs first, download
the relevant artifact and reproduce with the command above. Playwright writes its
HTML report and failure attachments under `tests/e2e/.results/`. For HTML reports,
extract the artifact and run
`npx --no-install playwright show-report /path/to/tests/e2e/.results/playwright-report`.

The coverage job includes every `src/**/*.{ts,vue}` file, including files not
imported by a test. It enforces 100% statements, branches, functions and lines
across that full source scope, so no executable line or branch may go uncovered.
Dictionary keys and interpolation parameters are checked by unit tests. HTML and
JSON coverage reports are included in the coverage artifact. See
[interface languages](i18n.md) for the locale-specific test scenarios.

High and critical dependency advisories fail the audit; lower severities remain
in the report. Audit service or network errors also fail the job. The audit reads
the committed lockfile without installing project dependencies or changing it.
Review affected dependency paths and available fixes, update dependencies in a
focused pull request and run CI. Do not automatically run `npm audit fix --force`.
Any deferred vulnerability needs a documented rationale and review date; this
workflow has no automatic advisory exclusions. Passing this audit does not prove
that application code or dependencies are free from other security problems.

Dependabot alerts under **Security > Dependabot alerts** provide ongoing advisory
notifications alongside CI. Check your personal GitHub notification settings for
Dependabot and Actions email delivery; a failed scheduled run alone does not
guarantee that you receive an email. CI does not change those settings or post
automatic comments. Daily scans preserve the lockfile; they do not upgrade
dependencies or test the latest versions.

## Dependabot patch auto-merge

[Dependabot auto-merge](../.github/workflows/dependabot-auto-merge.yml) enables
squash auto-merge for a Dependabot pull request only when all of these hold:

- The pull request is not a draft, comes from this repository and targets `main`.
- Dependabot reports an npm update of type `semver-patch`.
- Only `package.json` and `package-lock.json` are modified.

GitHub then merges it after `CI result` passes and the branch is up to date.
Minor, major, pre-release and unrecognized updates stay open for manual review.
If a pull request later stops matching, for example after a new commit changes
other files, the workflow disables its auto-merge. Merging only changes the code:
it does not tag, publish or deploy.

The workflow runs on `pull_request_target` with write permissions, so it must not
check out or execute pull request code. It uses the built-in `GITHUB_TOKEN`, and
`dependabot/fetch-metadata` rejects commits that Dependabot did not author and
verify. Auto-merge also requires **Allow auto-merge** in the repository settings;
turn that setting off to stop all automatic merging.
