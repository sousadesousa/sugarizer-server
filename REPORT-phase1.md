# Phase 1 report: Playwright baseline of the dashboard (Bootstrap 3 -> 5)

**Status: BLOCKED, the tests are written but have never been run.** No baseline screenshots were produced.

## Blocker

The environment's network policy denies `api.anaconda.org` (`curl: (56) CONNECT tunnel failed, response 403`),
so `mongod` could not be fetched from conda-forge as the brief describes. `fastdl.mongodb.org` is blocked too.
There is no `mongod` on the machine and nothing listens on 127.0.0.1:27017. Without MongoDB the server cannot
start, so I could not run `npm run test:e2e`, `npm test`, or take screenshots.

To unblock, either:
- allow `api.anaconda.org` and `conda.anaconda.org` (or broaden Network access) in the environment settings, or
- provide a MongoDB on 127.0.0.1:27017, or a `mongod` binary through `MONGOD_BIN`.

Then run `npm run test:e2e` and commit `test/e2e/baseline/`.

## What exists

- `@playwright/test` added as a dev dependency (`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`, no `playwright install`).
- `playwright.config.js`: one worker, `CHROMIUM_PATH` for the browser (`/opt/pw-browsers/chromium` here), global setup.
- `test/e2e/harness.js`: starts `MONGOD_BIN` on a free port in a temp dir, otherwise uses MongoDB on 127.0.0.1:27017
  (CI service). Writes `env/e2e-<port>.ini` (a copy of `env/test.ini`, throwaway database, free web and presence
  ports; git-ignored; `env/test.ini` is untouched), starts `sugarizer.js`, seeds data through the API, and cleans up
  (server, mongod, temp dir, ini, and the database when MongoDB is shared).
- Seed: admin, teacher, two students, a classroom, a journal entry, an assignment (launched, so it has deliveries),
  a chart, and an admin with 2FA enabled (same secret as the API tests) to reach the verify page.
- `test/e2e/dashboard.spec.js`: for admin and teacher, at 1280x800 and 390x844, visits home, users, add/edit user,
  classrooms, add/edit classroom (admin), activities, journal (+ entries), assignments, add/edit assignment,
  deliveries, add comment, charts list, add/edit chart (admin), stats (admin), profile, enable 2FA, 404; and, logged
  out, login and 2FA verify. Each page asserts HTTP 200, no uncaught page error, sidebar present (visible on
  desktop), select2 initialised where used, and saves a full-page screenshot to `test/e2e/baseline/`.
  Extra tests (desktop): datetimepicker opens on the assignment form, QR modal opens from the sidebar, the tutorial
  shows its first step from the help button, and a Chart.js canvas has drawn pixels on stats (admin).
  Failed same-origin requests (status >= 400) are attached to each test as an annotation, not asserted.
- Tutorials auto-start on first visit and would cover the screenshots, so an init script marks them as finished
  (`<name>_end = yes` in localStorage); the help button restarts them.
- `npm run test:e2e` script; `.eslintrc.json` has an override (ES2022) for `playwright.config.js` and `test/e2e/`;
  `.gitignore` ignores `env/e2e-*.ini` and `test-results/`.
- No dashboard code, styling or CI workflow was changed.

## Checked

- `npm run lint`: 0 errors (1 existing warning: an unused eslint-disable directive).
- Not run: `npm run test:e2e`, `npm test`.

## Pages that error today

Unknown, since nothing could run.

## Open questions / things to verify on the first run

- The Chart.js assertion assumes the stats canvases draw something even with no statistics data; if the pies are
  empty on a fresh database, the seed needs a stats entry (or the assertion should check the Chart instance).
- Selectors for select2 (`#user-form [name="role"]`, `#select-students-select2`, `#select2-activity`) and the
  tour popover (`.popover.tour`) come from reading the views, not from a run.
- Teacher routes that the admin-only pages reject (`checkRole` renders the 404 view) are skipped for the teacher.
- The branch for this phase is `dashboard/bootstrap5` as the brief says; this session's default branch was
  `claude/beautiful-fermi-cstc2x`.
