# Phase 1 report: Playwright baseline of the dashboard (Bootstrap 3 -> 5)

**Status: DONE.** `npm run test:e2e` is green (89 passed), the baseline
screenshots are committed in `test/e2e/baseline/` (82 files, 3 MB), `npm run lint` has 0 errors and `npm test` passes
(168 passing after the hotfix). No dashboard code, styling or CI workflow was changed.

## How MongoDB was obtained

`fastdl.mongodb.org` and `api.anaconda.org` are blocked, `conda.anaconda.org` is allowed (as the manager's brief says):
`mongodb-8.0.23-h8ca7601_0.conda` from conda-forge, unzipped, the `pkg-*.tar.zst` inside extracted with the Python
`zstandard` package. `mongod --version` gives v8.0.23; the system libraries are enough. Everything lives outside the
repo (session scratchpad), nothing is committed. Run with
`MONGOD_BIN=<path>/bin/mongod CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:e2e`.
Without `MONGOD_BIN` the harness uses a MongoDB on 127.0.0.1:27017 (the CI service): both ways were run and pass.
For `npm test` a mongod was started on 27017 (no change to `env/test.ini`) and stopped afterwards.

## What exists

- `playwright.config.js`, `test/e2e/global-setup.js`, `test/e2e/harness.js`, `test/e2e/dashboard.spec.js`,
  `npm run test:e2e`, `@playwright/test` as a dev dependency (no browser download; `CHROMIUM_PATH`).
- Harness: own `mongod` on a free port (or the existing MongoDB), throwaway `env/e2e-<port>.ini` (copy of
  `env/test.ini`, throwaway database, free web and presence ports; git-ignored; removed at the end; `env/test.ini`
  untouched), the server, seed through the API, cleanup. If the server crashes during the run, the harness starts it
  again on the same database (sessions are lost, so every describe group logs in again after a crash; no page crashes it
  any more since the hotfix, this stays as a safety net).
- Seed (fixed names, so screenshots are comparable between runs): 2 students, a classroom with them, a teacher
  with that classroom assigned, an admin, an admin with two-factor authentication enabled (TOTP through the API), a
  journal entry, a launched assignment and a chart.
- The spec visits, as admin and as teacher, at 1280x800 and 390x844: home, users, add/edit user, classrooms,
  add/edit classroom (admin), activities, journal, journal entries, assignments, add/edit assignment, add comment,
  charts list, add/edit chart (admin), stats (admin), profile, enable 2FA, 404 and (known failure) deliveries; logged
  out: login and 2FA verification. Each page asserts HTTP 200, no uncaught page error, sidebar attached (visible on
  desktop), select2 initialised where used, and saves a full-page screenshot.
  Extra desktop tests: datetimepicker opens (assignment edit form), QR modal opens from the sidebar, the tutorial shows
  its first step from the help button, a Chart.js canvas has drawn pixels on stats (admin).
- Tutorials start by themselves on the first visit of a page and would cover the screenshots: an init script marks
  them as finished (`<name>_end = yes` in localStorage); the help button restarts them.
- Failed same-origin requests (status >= 400) are attached to each test as an annotation: there are none today.

## Pages that error TODAY

Update after the hotfix (`fix/deliveries-and-journal-loop`, merged into this branch, see `REPORT-hotfix.md` there):

1. **Deliveries page crash**: FIXED by the hotfix. The four `test.fail()` marks are gone, the page is in the normal
   page list and has screenshots (`*-deliveries.png`).
2. **Admin, `/dashboard/assignments/add`**: redirects to `/dashboard/journal` with the error "Invalid journal" (an
   admin has no private journal, the journal id is `undefined`). Known behaviour, deliberately not changed. The
   screenshot records that state; the select2 check of this page is only done for the teacher.
3. **Teacher with no classroom, journal redirect loop**: FIXED by the hotfix. A seeded teacher without classroom is
   covered by two e2e tests (journal and journal entries: page shown, message "No shared journal found", no redirect
   loop) and screenshots (`teacher-no-classroom-desktop-*.png`; the notification is visible in them).

## Test summary

- `npm run test:e2e`: 89 passed, about 2.9 minutes, one worker.
- `npm run lint`: 0 errors, 1 warning that was already there (an unused eslint-disable directive).
- `npm test`: 168 passing (162 + the 6 deliveries tests of the hotfix).

## Open questions

- Screenshots contain text that changes with time ("Today at 6:53 AM" in tables) and generated ids are not shown but
  charts depend on the seed: a pixel diff after the migration needs those regions masked (or the clock frozen with
  Playwright's `page.clock`). Not done here since phase 1 only records the baseline.
- The e2e suite is not in `.github/workflows/test.yml` (not changed in this phase). To run there, the job needs a
  Chromium (`npx playwright install --with-deps chromium`, or `CHROMIUM_PATH`) and the existing mongo service.
- Mobile (390px) screenshots check the sidebar only as attached to the DOM: in Bootstrap 3 it is off-canvas there.
- Select2 on `#user-form [name="role"]` (users page) and the tutorial popover selector `.popover.tour` are the
  Bootstrap 3 / bootstrap-tour ones; they will need updating together with the migration.
- This branch is `dashboard/bootstrap5` as the briefs say (the session default was `claude/beautiful-fermi-cstc2x`).
