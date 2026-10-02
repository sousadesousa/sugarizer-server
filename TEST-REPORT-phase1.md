# Test report: dashboard Bootstrap 5, phase 1 baseline (c4a0304)

**Verdict: baseline trustworthy for the migration, with one process defect to fix first** (the suite rewrites ~45 tracked baseline PNGs on every run, so pixel diffs against the committed baseline are not usable as-is; see check 2). No product code or tests were changed (temporary mutations were reverted with `git checkout -- .`).

Setup: mongod 8.0.23 from conda-forge as in the brief (`MONGOD_BIN=/tmp/mongo/bin/mongod`), `npm ci`, Chromium from `/opt/pw-browsers`.

| # | Check | Result |
|---|---|---|
| 1 | `npm run test:e2e` twice | PASS |
| 2 | Working tree clean after a run | **FAIL** |
| 3 | Route coverage vs `dashboard/route.js` | PARTIAL (gaps listed) |
| 4 | Assertions are real | PASS (select2 caveat) |
| 5 | Six screenshots show real pages | PASS (one cosmetic oddity) |
| 6 | `npm run lint`, `npm test` | PASS |

## 1. Two runs: PASS
Run 1: 87 passed (2.9 m). Run 2: 87 passed (2.7 m). No retries or flaky tests (no "flaky"/retry lines in either log). Matches the report (87 incl. 4 expected `test.fail()` deliveries tests).

## 2. Working tree after a run: FAIL
- No leftover `env/e2e-*.ini` (`ls env | grep e2e` empty).
- But `git status` is NOT clean: after run 1, 45 tracked files under `test/e2e/baseline/` were modified; after run 2, 46 (set differs slightly, e.g. `admin-desktop-assignments-edit.png` changed only in run 2, `*-mobile-deliveries-comment.png` only in run 1). The spec writes screenshots straight into `baseline/` (`dashboard.spec.js` `shots` dir), and pages contain time-dependent text ("Today at 7:00 AM") so bytes differ every run (the report's open questions mention this).
- Reproduce: `npm run test:e2e && git status --short` -> ~45 ` M test/e2e/baseline/*.png`.
- Impact: a post-migration run will overwrite the baseline, so comparing needs the baseline copied/checked out first, plus frozen clock/masking. Suggest writing to a separate output dir (or `toHaveScreenshot` with `page.clock`).

## 3. Route coverage: PARTIAL
Visited by the spec (GET, as admin and teacher, desktop and mobile where allowed): `/dashboard`, login, verify2FA, users, users/add, users/edit/:uid, classrooms (+add, edit/:id), activities, journal, journal/:jid, assignments, assignments/add, assignments/edit/:id, assignments/deliveries/comment/:id, assignments/deliveries/:id (known failure), stats, stats/list, stats/add, stats/edit/:id, profile, profile/enable2FA, the 404 catch-all.

Not visited and not listed as skipped anywhere (spec or REPORT-phase1.md):
- GET: `/dashboard/users/search`, `/dashboard/users/export`, `/dashboard/activities/launch`, `/dashboard/activities/launch/:jid`, `/dashboard/stats/graph`, `/dashboard/graph` (data endpoints/redirects, though `graph` ones are exercised indirectly by the Chart.js pages if the page calls them).
- All POST routes: login (used by harness only), logout, users add/edit/delete/import, journal delete, stats add/edit/delete, profile, enable2FA/disable2FA, classrooms add/edit/delete, assignments add/edit/delete/launch/return, deliveries comment/return. No form submission or modal-confirm flow is covered, so Bootstrap 5 changes to forms/modals/delete confirmations on submit are not guarded.
- The `/dashboard/profile` 2FA verify POST is exercised only via the verify2FA page screenshot.
Also: the 404 status assertion is `p.slug == '404' ? 200 : 200` (always 200; harmless but meaningless).

## 4. Assertions are real: PASS
Temporary local mutation in the spec: `context.route(/public\/js\/(select2.min|Chart.min|qrcodegen|jquery.datetimepicker.full).js/, r => r.abort())`, then `playwright test -g "admin desktop"`; reverted afterwards.
- Chart.js canvas: FAILED with `canvas has drawn pixels: Expected true, Received false` (spec line 206). Real.
- QR modal: FAILED with `locator('#qrpopup') Expected: visible, Received: hidden` (line 175). Real.
- datetimepicker: FAILED with `.xdsoft_datetimepicker ... element(s) not found` (line 166). Real.
- select2: pages using it (users, classrooms-add/edit, assignments-add/edit) failed, but in this mutation through the earlier `uncaught page errors` assertion (inline `.select2()` throws ReferenceError), so the `select2-hidden-accessible` class assertion itself was not shown to fail on its own. Not an issue now; after the migration a silent failure would still hit it.
- Collateral: 15 of 21 admin-desktop page tests failed in this mutation (pages with these scripts); the pages without them (classrooms, activities, assignments, deliveries-comment, charts-*, 2FA, 404) correctly stayed green.

## 5. Screenshots: PASS
Opened admin-desktop-home, admin-desktop-users, admin-desktop-assignments-edit, teacher-mobile-home, teacher-mobile-journal, public-desktop-login. All show the real page (sidebar, cards, Chart.js bar and donut charts, user table, forms, off-canvas mobile layout with hamburger). No error page, spinner or tutorial overlay.
Cosmetic oddities recorded in the baseline: assignments-edit shows "Invalid Date" in both Due Date fields (seed/server date formatting, not caused by the test); a teacher's Journals count is 2 on mobile vs 3 for admin (expected, different scope).

## 6. Lint and unit tests: PASS
`npm run lint`: 0 errors, 1 pre-existing warning (`api/route.js:15` unused eslint-disable). `npm test` (own mongod on 27017): 162 passing.
