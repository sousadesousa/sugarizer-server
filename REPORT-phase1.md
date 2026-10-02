# Phase 1 report: Playwright baseline of the dashboard (Bootstrap 3 -> 5)

**Status: DONE (phase 1 and phase 1.5, see the last section).** `npm run test:e2e` is green (101 passed), the baseline
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

- `npm run test:e2e`: 101 passed (89 page tests + 12 form flows), about 4.1 minutes, one worker.
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

## Phase 1.5 (the Tester's findings of `TEST-REPORT-phase1.md`)

### What changed

1. **The baseline is read-only during a run.** Run screenshots go to `test-results/screenshots/` (git-ignored,
   emptied at the start of each run; `E2E_SCREENSHOT_DIR` changes it). `test/e2e/baseline/` is only written by
   `npm run test:e2e:baseline` (`E2E_BASELINE=1`; run the whole suite, it deletes the old PNGs first; the script uses
   the `VAR=value cmd` shell syntax, so Linux/macOS). A normal run was checked to leave the baseline byte-identical.
   Playwright's own output moved to `test-results/playwright/`.
2. **Stable screenshots** (see the proof below). What makes the pages repeat:
   - the server runs with `test/e2e/server-preload.js` (`node --require`): its clock starts at 2035-03-15 10:00 and then
     runs normally, so every "Today at 10:00 AM" is the same (the seed takes a few seconds, well inside the minute), and
     `Math.random` is seeded, so the colors that the dashboard picks "at random" (new classroom, new user) repeat;
   - the browser clock starts at the same time (`context.clock.install`, it keeps running, so timers and jQuery
     animations work) and `Math.random` is seeded there too (`support.js`);
   - the seed gives a color to the users it signs up (the server picks a random one otherwise), and makes all the
     activities favorites in a fixed order: the server reads the activities folder with asynchronous calls, so the
     order of the activities that are not favorites changes at each start (seen as a different list order);
   - screenshots hide the notifications (timed, they move) and, on the enable-2FA page, the QR code and the secret
     (a new one at each visit; the secret is removed, not only hidden, as its width moves the text around it);
   - `settle()` waits until the canvases (animated Chart.js charts) stop changing.
3. **Compare**: `npm run test:e2e:compare` (`test/e2e/compare.js`, pixelmatch + pngjs) writes, in
   `test-results/compare/`, `index.html` (pages sorted by difference, with the side by side image of each: baseline |
   current | diff), one PNG per page that differs, and `summary.json`. It prints the same table and exits 0 whatever the
   differences (2 only when a folder is missing). Options: `--baseline`, `--current`, `--out`, `--threshold`.
4. **Form and confirm flows**, `test/e2e/flows.spec.js` (12 tests, desktop), see the list below.
5. **404**: the assertion is now `200` with a comment, and the text "Page Not Found" is checked: the dashboard renders
   its 404 view with `res.render()` and no `res.status()`, so a wrong dashboard URL answers 200.
6. **"Invalid Date"** in both Due Date fields of the assignment edit page: it was the seed. The seed sent `dueDate` as
   a string (`"1790924035125"`), the way the API documentation example shows it; the dashboard stores a number, and its
   form does `new Date(assignment.dueDate)`, which is an Invalid Date for a numeric string. Same kind of typo: the seed
   sent `lateTurnIn: 'false'` (a string, true for the checkbox, which was shown ticked). Both are fixed in the seed
   (number and boolean); the regenerated edit screenshot shows `3/22/2035` and `10:00`, the checkbox unticked, and a
   flow test checks the date of an assignment created through the dashboard. Not a dashboard bug as such; the API does
   accept a string date that the dashboard then cannot display (worth a look when the API is revisited, not now).

### Stability proof

Two full runs one after the other, each in its own folder, compared with `compare.js` (`test-results/run-a`, `run-b`),
then a normal run against the committed baseline:

| Compared | Screenshots | Byte-identical | Pixel-identical (threshold 0.1) | Different |
|---|---|---|---|---|
| run A / run B | 82 | 66 | 16 | **0** |
| fresh run / committed baseline | 82 | 70 | 12 | **0** |

Run A / run B at threshold 0 (every pixel): 14 pages differ by at most 19 pixels of 1,024,000 (0.0019 %), always in the
language pill of the navbar (rounded border). Chromium gives the same bytes for a page taken several times from fresh
browsers (checked: 0 pixels differ), so this is rendering noise inside a long run, below the 0.1 color distance that
pixelmatch ignores. For reference: the Tester saw a run rewrite 45 tracked screenshots; and with the clock and random
fixes alone, two runs still differed on 12 pages by up to 4 % (the activities order and the 2FA secret, fixed above). The compare tool itself was checked with a copy of a run where one block of a page was painted red and one
screenshot deleted: it reports `admin-desktop-home` as different (4.44 %) and the other as missing.

### New coverage (`flows.spec.js`, as admin and as teacher)

Each flow asserts the notification, the row that appears or disappears, and that the confirm dialog was asked.
- admin: create a user (name, language, role, password), edit it (values kept, renamed), delete it (confirm);
  create a classroom (name, student found with the select2 search, an activity checkbox), edit it (student and activity
  kept), delete it (confirm); create a chart (type card, chart choice), delete it (confirm);
  the data endpoints `users/search`, `users/export`, `stats/graph` and `graph` answer.
- teacher: create an assignment (name, select2 work, instructions, date from the calendar of the datetimepicker, time
  from its list, classroom with the two-lists widget), edit it, launch it, open its deliveries (one per student),
  add a comment to one, return a delivery (the student hands it in through the API first, as that is done in the
  Sugarizer client).
- log out from the user menu, then a dashboard page sends back to the login.
- no uncaught page error during the flows.

Skipped, with the reason (also written at the top of `flows.spec.js`): `POST users/import` (needs a CSV upload),
`GET activities/launch` and `launch/:jid` (open an activity of the Sugarizer client), the 2FA enable/disable POSTs and
`POST verify2FA` (need the one-time code of an authenticator for a user outside the seed; the pages are in
`dashboard.spec.js`), `POST journal/:jid/delete/:oid` and `POST assignments/delete/:id` (same delete mechanism as above),
`POST profile`.

### Things the flows showed (existing behavior, not changed)

- The success message after adding a comment is the key itself, `CommentAdded`: the locales have no such string.
- The launch link of the assignments list has no `?name=`, so the message says "Assignment assignment has been
  successfully launched!" (the same for return) instead of the name.
- The order of the activities after a server start is not deterministic until the favorites list is saved (race in
  `api/controller/activities.js` `load`, which pushes in the order of the asynchronous `stat` calls).

### Results

- `npm run test:e2e`: 101 passed (4.1 min). `npm run lint`: 0 errors (1 old warning). `npm test`: 168 passing.
- Baseline regenerated once and committed: 82 PNG, 3 MB.

### Open questions

- The baseline depends on the fonts and the Chromium of the machine that made it (here the preinstalled
  `/opt/pw-browsers/chromium`). On another machine a compare will show text antialiasing noise on every page: the
  baseline should be regenerated, once, in the environment where the comparisons are reviewed (CI image or the same
  container image).
- The e2e suite is still not in `.github/workflows/test.yml` (not changed, as asked).
- The two runs of the proof took 4.1 minutes each; `settle()` waits for the charts to stop moving, which is most of
  the increase from 2.9 minutes.
- Mobile flows are not covered (the flows run at desktop size; the mobile layout is in the screenshots only).
