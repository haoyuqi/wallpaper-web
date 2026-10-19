# Continuous integration

[CI](../.github/workflows/ci.yml) runs on pull requests targeting `main`, pushes to
`main`, manual dispatch and a daily schedule at 06:00 Beijing time (22:00 UTC on
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
jobs fail the aggregate check. This workflow does not configure branch protection;
enforcing the result before merging requires a repository rule. New runs cancel
older runs for the same event and PR/ref; scheduled, manual and push runs do not
cancel each other.

E2E tests mock API and image requests and need no backend, private files or secrets.
On Linux CI, Chromium and its system dependencies are installed with
`npx --no-install playwright install --with-deps chromium`. Playwright builds the
application before starting the preview server, uses one worker and retries failed
tests once. Its five-minute test timeout leaves room within the 15-minute job
timeout for installation and report upload.

Coverage, Playwright reports/failure attachments and dependency audit JSON reports
are retained as Actions artifacts for seven days, including after test/audit
failures when reports were generated. Open the failed job's logs first, download
the relevant artifact and reproduce with the command above. For Playwright HTML
reports, extract the artifact and run
`npx --no-install playwright show-report /path/to/playwright-report`.

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
