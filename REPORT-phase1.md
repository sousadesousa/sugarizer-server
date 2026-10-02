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

## Dates fix (branch `fix/dashboard-dates`, merged here)

The three date bugs of the assignment form are fixed on `fix/dashboard-dates` (see its report in the history of that
branch) and merged into this branch. `test/e2e/dates.spec.js` (25 tests) covers them with the real pickers in browser
contexts of five regions and time zones (de-CH Zurich, de-CH Zurich in summer, en-US New York, fr-FR Paris, ja-JP Tokyo),
the edit page of an assignment made by the API, and the wrong values (no time, no date, an unreadable number, a past
time). The four `*-assignments-edit.png` baseline screenshots were regenerated on purpose (the date now reads
`03/22/2035`, with the zero, in the order of the browser region); the other 78 are unchanged. Full run: 126 passed.


## Phase 2a: the shared layer and six pages on Bootstrap 5

Status: done. `npm run test:e2e` 126 passed, `npm run lint` 0 errors (the old warning), `npm test` 168 passing.

### What changed

1. **Test fix first** (own commit, on the Bootstrap 3 code): the e2e server now uses a small fixed client
   (`test/e2e/fixtures/client`, 6 activities) instead of the `../sugarizer` checkout, so the activities counter of the
   home page, the activities list and the activity checkboxes of the classroom form no longer depend on the checkout.
   12 baseline files regenerated, the others untouched.
2. **Libraries** (vendored in `dashboard/public`, no CDN): Bootstrap 5.3.8 (css + bundle), jQuery 3.7.1, select2
   4.1.0-rc.0, intro.js 5.1.0 + css (copied from the client). Removed: Material Dashboard (css, js, `material.min.js`),
   bootstrap-tour, bootstrap-notify, Bootstrap 3, jQuery 3.1, animate.css. No `$.material.init()` / `md.*` left.
3. **Theme layer** in `main.css` (about 600 lines at the end of the file): body font and colors, headings, the sidebar and
   main panel, the transparent navbar, cards (with `data-background-color`), grey uppercase buttons, underlined fields,
   tables, dropdown, modal, toasts, the intro.js tooltip, and the small screen sidebar. Bootstrap 3 behaviors that the
   old markup relied on are restated where Bootstrap 5 differs: `.main-content` and `.content` are `display: flow-root`
   (the old clearfix stopped the margin of the first row or heading from collapsing), `.sidebar .nav` is a block (item
   margins collapse as before), headings keep their Bootstrap 3 top margins, gutters are 30 px.
4. **Migrated markup**: `includes/` (header, navbar, sidebar with the QR modal, footer, flash-errors), `login`,
   `verify2FA`, `twoFactor`, `404`, `dashboard` (home). Class changes follow the plan table (`col-xs-*` removed,
   `pull-*` to `float-*`, `card-content` to `card-body`, `form-group`/`control-label` to `mb-3`/`form-label`,
   `data-toggle` to `data-bs-toggle`, `close` to `btn-close`, `navbar-toggle` to `navbar-toggler`, `sr-only` to
   `visually-hidden`). Forms use a plain `form-label` above the field. The language selector is a `form-select`.
5. **Shared JS** (`main.js`, `tutorial.js`):
   - `notify(message, type)` shows a Bootstrap toast at the top right (5 s, close button; `success`, `danger`, `warning`, `info`).
     The message is set as text. The 35 calls of `$.notify` (29 in `main.js`, 4 in `users.ejs`, 2 in `flash-errors.ejs`)
     use it with the same message and type; flash messages now pass through `jsonForScript` instead of being pasted
     into a JS string. The toasts keep the `data-notify="container"` / `data-notify="message"` attributes, so the e2e
     selectors did not change.
   - The QR code opens with `bootstrap.Modal`.
   - On screens of 992 px and less the language selector and the user menu of the navbar are copied into the sidebar,
     which slides in from the right with the toggler (this is what `md.initRightMenu` did); pages without sidebar
     (login, verify) use the Bootstrap collapse.
   - `sugarizerTour(view, role, mode)` keeps its interface, steps, `Tuto*` strings and stored state (`<name>_end`,
     `<name>_current_step`), but runs on intro.js: steps whose element is missing or hidden are skipped, as before; the
     scroll helpers of the home and user pages still use the same step numbers.
6. **E2E**: one selector changed (`.popover.tour` is now `.introjs-tooltip`). Everything else, including the notification
   checks of the flows and the date tests, passes unchanged.

### Comparison with the baseline (migrated pages)

`npm run test:e2e:compare`, threshold 0.1, 82 screenshots: all 82 differ (every page has the new sidebar and navbar), 16 of
them are migrated pages:

| Page | Different pixels | Judgment |
|---|---|---|
| admin-desktop-home | 2.72 % | intended / minor: same layout; text and cards 1-2 px off (Bootstrap 5 line boxes), the language pill is a little wider |
| teacher-desktop-home | 2.67 % | intended / minor: same layout; text and cards 1-2 px off (Bootstrap 5 line boxes), the language pill is a little wider |
| admin-mobile-home | 4.40 % | minor: same stacked cards; each card is 2 px shorter, which adds up over four cards |
| teacher-mobile-home | 4.40 % | minor: same stacked cards; each card is 2 px shorter, which adds up over four cards |
| admin-desktop-two-factor-enable | 4.39 % | intended: labels sit above the field (form-label, as decided), so the card is shorter; the rest is the same |
| teacher-desktop-two-factor-enable | 4.34 % | intended: labels sit above the field (form-label, as decided), so the card is shorter; the rest is the same |
| admin-mobile-two-factor-enable | 5.62 % | intended: labels sit above the field (form-label, as decided), so the card is shorter; the rest is the same |
| teacher-mobile-two-factor-enable | 5.62 % | intended: labels sit above the field (form-label, as decided), so the card is shorter; the rest is the same |
| public-desktop-login | 1.00 % | intended: label above the field instead of the floating label; the card and the pill are where they were |
| public-mobile-login | 3.39 % | intended / minor: same as desktop; the language pill keeps its border and is not full width, the sticky top bar is the same |
| public-desktop-verify2FA | 0.83 % | intended: same as login |
| public-mobile-verify2FA | 3.43 % | intended: same as login |
| admin-desktop-404 | 0.39 % | minor: text 1-2 px off |
| teacher-desktop-404 | 0.39 % | minor: text 1-2 px off |
| admin-mobile-404 | 1.19 % | minor: text 1-2 px off |
| teacher-mobile-404 | 1.19 % | minor: text 1-2 px off |

None of the 16 is a regression to fix: layout, colors, icons, charts and tables are where they were. The other 66 pages
differ by 1.6 % to 18.1 % (see below); they are not migrated.

### Known breakage left for phase 2b (pages not migrated)

All 66 other screenshots were looked at through the compare index; the pages still load without error and every flow and
date test passes, but their own markup still uses Bootstrap 3 / Material Dashboard classes:
- list pages (users, classrooms, activities, assignments, deliveries, journal, charts list): the search card stacks its
  fields vertically (the `col-xs-*` and `col-md-*` columns, `form-group label-floating` and `material-input` markup), the
  placeholder-label sits at the top left of the card, buttons wrap under the fields, the list header ("Showing results")
  and the table headers lose a few px of padding;
- form pages (add/edit user, classroom, assignment, chart, comment, profile): `form-group`, `control-label`,
  `label-floating`, `is-empty` have no styling now, so labels are plain small text above the field with less spacing,
  the Material check boxes and radios are the browser ones, select elements have no arrow (`form-control` on a `select`);
- `pull-right`, `pull-left` are kept by a short compatibility block at the end of `main.css` (to remove with 2b), and
  `card-content` still gets its padding from the theme;
- these pages still carry `$.material`-free but Bootstrap 3 attributes in places (`data-toggle`, `col-xs`, `hidden-*`):
  `grep -rn "col-xs\|pull-\|form-group\|control-label\|label-floating\|data-toggle\|hidden-" dashboard/views` lists them.
Their baseline screenshots will be regenerated page by page in 2b, when each is migrated.

### Open questions

- **intro.js license**: intro.js is AGPL-3.0 (commercial license for closed use). The Sugarizer client already ships it
  (`lib/intro.js`), and the dashboard now ships the same file; please confirm that this is acceptable for the server.
- select2 4.1.0 is only published as a release candidate (`4.1.0-rc.0`), the version asked for ("4.1.x") that exists.
- jQuery UI 1.11.4 (sortable) and the multi-select plugin are old and run on jQuery 3.7.1 without console errors in the
  tests, but only the pages that use them were exercised by the e2e tests; the sortable activity list is not covered.
- The mobile sidebar copies the language selector, so the `languageSelection` id exists twice on small screens (as it did
  with Material Dashboard); `jumpTo` reads the first one.
- The tutorial still starts only above 992 px (unchanged); `disableInteraction` keeps the highlighted element from being
  clicked during a step, like the backdrop of bootstrap-tour did.
- Toasts last 5 s (bootstrap-notify used its default of 5 s as well, plus the animation); tell me if another delay is wanted.
- The sidebar and navbar are now Bootstrap 5; nothing was done for dark mode or right-to-left languages.
