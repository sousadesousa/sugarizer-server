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

I looked in detail at three of the 66 other pages (users, assignments list, add classroom) and at the compare numbers of
the rest (1.6 % to 18.1 %); I did not go through every one. The pages still load without error and every flow and date
test passes, but their own markup still uses Bootstrap 3 / Material Dashboard classes, so expect the following (to be
confirmed page by page in 2b):
- list pages (users, classrooms, activities, assignments, deliveries, journal, charts list): the search card stacks its
  fields vertically (the `col-xs-*` and `col-md-*` columns, `form-group label-floating` and `material-input` markup), the
  placeholder-label sits at the top left of the card, buttons wrap under the fields, the list header ("Showing results")
  and the table headers lose a few px of padding;
- form pages (add/edit user, classroom, assignment, chart, comment, profile): `form-group`, `control-label`,
  `label-floating`, `is-empty` have no styling now, so labels are plain small text above the field with less spacing,
  the Material check boxes and radios are the browser ones, select elements have no arrow (`form-control` on a `select`);
- `pull-right`, `pull-left` are kept by a short compatibility block at the end of `main.css` (to remove with 2b), and
  `card-content` still gets its padding from the theme;
- other Bootstrap 3 names are still in these views (`data-toggle`, `col-xs-*`, `hidden-*`...):
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


## Phase 2b: every page on Bootstrap 5

Status: done. `npm run test:e2e` 130 passed (5.0 min), `npm run lint` 0 errors (the old warning), `npm test` 168 passing
(needs a mongod on 27017 and the `../sugarizer` checkout, as before), baseline regenerated (82 PNG).

### Commits (one per group, `test:e2e` and `test:e2e:compare` after each)

1. **driver.js instead of intro.js** (MIT, 1.8.0 from npm: `dist/driver.js.iife.js` and `driver.css` in
   `dashboard/public`, banner with the license kept, `driver.LICENSE` next to it, listed in `NOTICE`). No intro.js file or
   reference is left. `sugarizerTour(view, role, mode)`, the steps, the `Tuto*` strings, `<name>_end` /
   `<name>_current_step`, the skipping of missing or hidden elements, the 992 px rule and `disableActiveInteraction` are
   kept. The popover is restyled in `main.css` (`.driver-popover.sugarizer-tour`: grey title bar, pill buttons). The e2e
   selector is `.driver-popover`; a new test walks the home tour to its last step and checks `home_end`.
   Two driver.js behaviors worth knowing: `onDestroyed` is not called when the last step is closed from my own
   `destroy()`, so the end state is written from `onDestroyStarted` and from the last "next"; and the close button (x)
   replaces the "skip" button of intro.js (it stores the tour as finished, like skip did).
   Also in this commit: the copy of the language selector in the mobile sidebar has its own id
   (`languageSelectionMobile`), `onLocalized` binds both, `jumpTo` reads the visible one.
2. **List pages**: users, classrooms, activities, assignments, deliveries, journal (+ entries), charts list, stats.
3. **Form pages**: user (add/edit/profile), classroom, assignment (the date code is untouched, only classes changed;
   `dates.spec.js` 25 tests pass), comment, chart.
4. **Compatibility block removed** (`pull-*`, `card-content`), and `main-panel` renamed `main-area` (views, `main.js`,
   `tutorial.js`, `main.css`), because `\bpanel\b` matches `main-panel` and the required grep must be empty.
5. **Check boxes / radios / selects**: check boxes are `form-check-input` (table check boxes standalone, 2FA, late turn-in,
   hidden chart, shared journal, classroom activities with `form-check-inline`), selects are `form-select` (the
   underlined theme is restated for it; the select2 default width is `100%`). The star and eye toggles
   (`favoriteBox`, `hideshowBox`) and the chart type cards are custom widgets and stay as they were.
6. **E2E for the widgets** (`test/e2e/widgets.spec.js`, 2 tests, runs last and puts the data back): the sortable activity
   list (real mouse drag, the POST to `api/v1/activities`, the order after a reload, put back) and the two lists widget
   of the user form (search box filter, remove a classroom, save, reopen, add it again, save, reopen).
   (4 and 5 are in one commit: the same files and the same compare run.)

`grep -rn "col-xs\|pull-\|form-group\|control-label\|label-floating\|is-empty\|material-input\|data-toggle\|data-dismiss\|hidden-xs\|hidden-sm\|visible-xs\|\bpanel\b" dashboard/views` returns nothing. The Material Icons font is still used for the icons
(`material-icons`); no Material Dashboard CSS, JS or markup (`btn-round`, `data-background-color`, `card-header` colors
are now defined in `main.css` itself).

### Decisions I took (tell me if you want them otherwise)

- Search cards: a `row mx-0 search-row` inside the card, fields in `col-lg-*`. They are in one row on desktop as in
  the baseline; the buttons still wrap in two rows (the baseline did too, `Show results` under the others), on desktop the
  order of the first row is the one of the baseline.
- Breakpoints: the names are shifted so that the thresholds stay (Bootstrap 3 `sm`/`md`/`lg` = 768/992/1200 px are now
  `md`/`lg`/`xl`). The pages of 2a (home) kept `col-md-3` / `col-lg-6`: between 768 and 991 px they show the columns
  side by side, where Bootstrap 3 stacked them; I did not change a 2a page. No screenshot is taken at that width.
- Labels of the forms are above the field (as decided in 2a). The "Chart not found" / "Activity not found" message of the
  search boxes is a red `.search-notfound` line with `is-invalid` on the field (it was the Material `has-error` label).
- The sortable cards (activities, charts): in Bootstrap 3 the floated columns overflowed a card that was 46 px high;
  they are now 46 px high by construction (`ol.simple_with_animation .card`).
- The journal search card is now inside a column like the other cards (it stuck out 15 px on each side).
- `.pull-right-mobinterrupt` (CSS only, no view uses it) was left.

### Comparison with the Bootstrap 3 baseline (82 screenshots, threshold 0.1, before the baseline was regenerated)

All 82 differ (the sidebar and navbar of 2a are in every page). None is a regression I left: layout, colors, icons,
charts and tables are where they were; the judgments of 2a are kept for the six pages of 2a. Regressions found and fixed
during the work: collapsed layout of the activity rows (cards 120 px apart), the search button of the activity list
(grey instead of white), the wrapped "Favorite" header, a delivered search card that wrapped its button, the hidden 2FA
check box (`btn-check`), the enable-2FA button wrapping on mobile, lost small-screen CSS (my own deletion, restored).

| Page (admin / teacher, desktop / mobile) | Different pixels | Judgment |
|---|---|---|
| `users` (4) | admin-mobile 14.90 %; teacher-mobile 14.90 %; admin-desktop 3.81 %; teacher-desktop 3.76 % | intended / minor: search fields in one row as before, buttons wrap in the same two rows (on mobile the Add / Import / Show order differs because the floats wrap otherwise); select2 widths 130 px instead of 146 px; text and sort headers 1-3 px off. Mobile: the table is a little narrower, a name wraps in two lines (the table scrolls sideways as before) |
| `profile` (4) | teacher-mobile 9.79 %; admin-mobile 9.01 %; admin-desktop 3.82 %; teacher-desktop 3.57 % | intended: as users-edit; the language select has the Bootstrap 5 arrow (Bootstrap 3 showed none); on mobile the 2FA button stays on one line and 4 px wider than the card text, like before |
| `journal-entries` (4) | admin-mobile 8.98 %; teacher-mobile 8.98 %; admin-desktop 2.51 %; teacher-desktop 2.47 % | minor: header and rows 1-3 px off; check boxes form-check (grey when checked) |
| `activities` (4) | admin-mobile 8.01 %; teacher-mobile 8.01 %; admin-desktop 5.38 %; teacher-desktop 5.33 % | minor: the sortable cards are 46 px high with 14 px between, as before (the Bootstrap 3 cards let the floated columns overflow); the search field and round search button are 1-3 px off; header "Favorite" no longer wraps (nowrap) |
| `classrooms-edit` (2) | admin-mobile 7.36 %; admin-desktop 4.15 % | intended: as classrooms-add |
| `assignments` (4) | teacher-mobile 6.91 %; admin-mobile 6.59 %; teacher-desktop 1.89 %; admin-desktop 1.88 % | intended / minor: as classrooms |
| `classrooms-add` (2) | admin-mobile 6.61 %; admin-desktop 3.13 % | intended: label above the field; the activity check boxes are form-check (grey when checked instead of the Material green-less box); same grid of 220 px items |
| `classrooms` (4) | admin-mobile 6.44 %; teacher-mobile 6.11 %; admin-desktop 1.75 %; teacher-desktop 1.62 % | intended / minor: search row and table as before, 1-2 px line boxes |
| `deliveries` (4) | admin-desktop 5.90 %; teacher-desktop 5.85 %; admin-mobile 5.50 %; teacher-mobile 5.50 % | minor: the card-header and rows are 3-6 px shorter (Bootstrap 5 line boxes in the icon and action cells); search card 6 px higher |
| `users-add` (4) | teacher-mobile 5.66 %; admin-mobile 5.62 %; admin-desktop 1.96 %; teacher-desktop 1.91 % | intended: label above the field (form-label), spacing of the fields 4-8 px different, selects with the Bootstrap 5 arrow; same fields, same order |
| `two-factor-enable` (4) | admin-mobile 5.62 %; teacher-mobile 5.62 %; admin-desktop 4.39 %; teacher-desktop 4.34 % | 2a, accepted: labels above the fields, card shorter |
| `charts-edit` (2) | admin-mobile 5.05 %; admin-desktop 3.76 % | intended: as charts-add |
| `assignments-add` (4) | admin-mobile 4.60 %; teacher-mobile 3.48 %; teacher-desktop 2.42 %; admin-desktop 1.67 % | intended: label above the field; date, time and classroom widgets unchanged (dates.spec passes); late turn-in is a form-check |
| `journal` (4) | admin-mobile 4.60 %; teacher-mobile 4.60 %; admin-desktop 1.67 %; teacher-desktop 1.62 % | intended / minor: the search card is now in a column like the other cards (it stuck out 15 px on each side before); the check box is a form-check |
| `home` (4) | teacher-mobile 4.40 %; admin-mobile 4.40 %; admin-desktop 2.72 %; teacher-desktop 2.67 % | 2a, accepted: same layout, 1-2 px line boxes |
| `charts-add` (2) | admin-mobile 4.27 %; admin-desktop 2.79 % | intended: label above the field; the type cards and the chart choice are unchanged |
| `users-edit` (4) | admin-mobile 4.08 %; teacher-mobile 4.08 %; admin-desktop 1.99 %; teacher-desktop 1.94 % | intended: as users-add; the 2 factor check box is a visible disabled form-check, as in Bootstrap 3 (it was hidden by btn-check in the first 2b step) |
| `assignments-edit` (4) | admin-mobile 4.03 %; teacher-mobile 4.03 %; admin-desktop 2.53 %; teacher-desktop 2.49 % | intended: as assignments-add; the date reads 03/22/2035 as in the 2a baseline |
| `verify2FA` (2) | public-mobile-verify2FA 3.43 %; public-desktop-verify2FA 0.83 % | 2a, accepted: same as login |
| `login` (2) | public-mobile-login 3.39 %; public-desktop-login 1.00 % | 2a, accepted: label above the field |
| `deliveries-comment` (4) | admin-mobile 2.80 %; teacher-mobile 2.80 %; admin-desktop 0.75 %; teacher-desktop 0.71 % | intended: label above the field |
| `stats` (2) | admin-mobile 2.71 %; admin-desktop 1.73 % | minor: add / list buttons and cards where they were, content 3-8 px higher (chart card shorter) |
| `charts-list` (2) | admin-mobile 2.45 %; admin-desktop 2.00 % | minor: one compact card per chart as before; search field and round button 1-3 px off |
| `no-classroom-journal-entries` (1) | tnc-desktop-journal-entries 1.81 % | minor: as journal-entries |
| `no-classroom-journal` (1) | tnc-desktop-journal 1.62 % | intended / minor: as journal |
| `404` (4) | admin-mobile 1.19 %; teacher-mobile 1.19 %; admin-desktop 0.39 %; teacher-desktop 0.39 % | 2a, accepted: text 1-2 px off |

### Things the work showed / open

- **Upward drag of the sortable list**: with a scripted mouse, dragging an item up lands one place short (down moves are
  exact, and the order is saved and kept after a reload). I did not check whether the Bootstrap 3 version behaves the same
  with this exact mouse path, so the widget test uses down moves only. Worth a manual try.
- The e2e suite needs `MONGOD_BIN` in every shell (an unset variable gives "Timeout waiting for MongoDB"); `npm test`
  needs a running mongod on 27017 and the `../sugarizer` checkout (I cloned `sousadesousa/sugarizer`, depth 1).
- select2 widths on the users page are 130 px instead of 146 px (the baseline columns were slightly wider than 1/6 of
  the card); text of "Select Classroom" is cut with an ellipsis at that width. Judged minor; say if you want it widened.
- Tablet widths (768-991 px), dark mode and right-to-left: not covered by any screenshot.
- Baseline fonts and Chromium: the baseline was regenerated here, as in phase 1.

## Phase 2c (follow-ups)

Follow-up of the Tester's report of phase 2a and the manager's decisions on the open points of phase 2b.

1. **D1, titles of the home tables**: `.dashboard-table-title` is now `position: static` (it was `fixed`), so "Recent Students" / "Recent Entries" scroll with their card. e2e: the home page is scrolled and each title must end above its table and not be `fixed`.
2. **Keyboard**: the sidebar items (and the Profile item of the user menu) are real links with an `href`; `jumpTo(url, event)` keeps adding `?lang=` and returns `false`, except for ctrl/cmd/shift/middle clicks, which follow the plain `href`. Logout keeps its POST (`href="#"`, `postTo`, `return false`). e2e: Tab from the language selector reaches the sidebar, and Enter on "Users" navigates.
3. **`<html lang>`**: the server renders the language of the request (`res.locals.htmlLang`, `en` by default) and `main.js` sets it to the value of the language selector when the page is localized. e2e: `en`, then `fr` and `en` again after changing the selector.
4. **Contrast** (checked in an e2e test, minimum 4.5:1 with white text): card headers, active sidebar item, tutorial titles `#808080` to `#6f6f6f`; toasts `#4caf50` to `#2e7d32`, danger `#d32f2f`, warning `#b45f00`, info `#00838f`.
5. **Mobile login / verify2FA selector**: back to a white pill without border, 200 px wide, 34 px high, with the 95 px high top bar of the baseline (rule limited to the navbar placed directly in `body`, i.e. the pages without sidebar). Note: in the screenshots of verify2FA on a phone the page shows the menu button and no selector (as in the baseline), so only the login page shows the pill.
6. **Cleanup**: no empty `<span class="material-input">` was left in `dashboard/views` (the 2b work had removed them; grep is empty); `dashboard/public/js/noty.js` deleted.
7. **select2 on the users page**: the classroom column is `col-lg-3` (was 2) and the button column `col-lg-5` (was 6): "Select Classroom" is shown in full at 1280 px.
8. **Tablet**: new viewport 820x1180 for home, users, assignments-add and journal (admin and teacher, 8 new screenshots). On home the four counters now use `col-lg-3`, so they stack between 768 and 991 px as in Bootstrap 3 (the two cards of each lower row already did).
9. Upward drag of the sortable list: not changed. 10. Dark mode and RTL: out of scope.

### Comparison before the baseline was regenerated (compare against the 2b baseline)

| Page | Different pixels |
|---|---|
| `public-mobile-login` | 3.25 % (bar and selector back to the old look; the label above the field remains) |
| `public-mobile-verify2FA` | 3.51 % (top bar taller as before) |
| `admin-desktop-home`, `teacher-desktop-home` | 0.94 % (contrast of the icon squares, header and sidebar item) |
| `admin-desktop-users`, `teacher-desktop-users` | 0.90 % (wider classroom select, buttons column, grey of the header) |
| `teacher-mobile-profile` | 0.01 % (rendering noise) |
| 8 tablet pages | new |

All other 75 screenshots are identical or have the same pixels. Suites: `test:e2e` 146 tests, `npm test` 168 passing, lint 0 errors (the 1 old warning). The baseline was regenerated once: only the 7 files above were updated and the 8 tablet files added.

## Phase 2d: defects of the Tester's phase 2b report

Branch `dashboard/bootstrap5`, on top of 3cb53e5. Source: `TEST-REPORT-phase2b.md` (branch `reports/dashboard-phase2b-test`).

1. **N1, sortable list cannot go to the first place** (`dashboard/public/css/main.css`). Cause (found by dumping the DOM during a drag): the 7 px margin of each `.card` collapsed through the `li` and the `ol`, so the box the plugin keeps the dragged item in (`containment: 'parent'`) started exactly at the top of the first card. The dragged item could never cover the first item by more than half (the `intersect` tolerance) and the placeholder stayed at index 1. The spacing is now padding of the `ol` and of the `li` (3.5 px each) plus a 3.5 px card margin, and the `ol` margins compensate, so the desktop screenshots of activities and charts-list are pixel-identical to before. jQuery UI options unchanged (a `tolerance: 'pointer'` was tried and dropped: it changes how far every drag moves). `widgets.spec.js`: new test dragging the 4th card to the first place, the first card to the last place, and back (order checked in the page and after a reload).
2. **N2, classrooms widget wider than the card padding** (`addEditAssignment.ejs`). Cause: a stray `</div>` that I left after the time input in phase 2a closed the due-date row, then the `form`'s own parents, so "Allow Late Turn In", the classrooms row and the Cancel/Save buttons ended up outside the form and the `.card-body` (directly in `.card`, without padding). Removed it. Side effect, visible on all sizes: "Allow Late Turn In" is back in the date row, as on master, and the buttons are inside the card.
3. **N3, "Hidden" check box on the card border** (`main.css`): on a phone `.display-check` had `padding-left: 0`, but the check box sits 1.5em to the left of the padding of a `.form-check`; now `1.5em`.
4. **N4, 2FA button covers Cancel and Save on a phone** (`addEditUser.ejs`, `main.css`): the inline `margin-top: -63px / -68px` moved to a `.btn-align` rule; below 576 px the button is no longer floated, has no negative margin and is centered under Cancel/Save. Desktop is pixel-identical. The generic check (item 7) covers every other form page: no other page has this pattern.
5. **N5**: comment in `includes/header.ejs` is now `<!-- driver.js CSS (tutorials) -->`; a case-insensitive grep of `intro.js` in `dashboard/` finds nothing else.
6. **Admin `assignments-add` screenshots dropped** (3 files: desktop, mobile, tablet): they were the Journals page (an admin is redirected). `dashboard.spec.js` has a `teacher: true` flag for pages that exist for teachers only, with a comment saying why. The page list went from 90 to 87 screenshots.
7. **Generic layout test** `test/e2e/layout.spec.js` (15 tests: 11 form pages, admin and teacher where the page exists, at 390x844): every visible input, select, textarea, button, `a.btn`, label, `.form-check`, `.ms-container` and `.select2-container` of the card lies horizontally inside the content box of the card body (1 px of slack; the hidden originals of select2 and multi-select are ignored), and every button of the card passes a Playwright trial click (nothing intercepts the pointer events). Both checks run on every page (soft assertion on the first), so one run reports everything.

   Run on 3cb53e5 (same spec, nothing else changed): **6 of 15 fail**, 9 pass.
   - charts-add, charts-edit (admin): `#scales x=44..58 (card content 65..325)` = N3.
   - profile (admin, teacher): `a.btn.btn-align... x=66..328 (card content 65..325)` and `"SAVE" cannot be clicked` (trial click times out: the 2FA link intercepts the pointer) = N4.
   - assignments-add, assignments-edit (teacher): `label.form-label x=45..104`, `#ms-searchable-select-classrooms x=45..345`, both search boxes `x=45..180` / `x=210..345`, `button.btn.float-end x=255..344` against a card content of `65..325` = N2.

   After the fixes all 15 pass.

### Comparison before the baseline was regenerated (against the phase 2c baseline)

| Page | Different pixels |
|---|---|
| `admin-mobile-profile`, `teacher-mobile-profile` | 4.34 % (2FA button below Cancel/Save) |
| `admin-desktop-assignments-edit`, `teacher-desktop-assignments-edit` | 1.53 % (late turn-in in the date row, buttons in the card) |
| `teacher-tablet-assignments-add` | 1.39 % (same) |
| `teacher-desktop-assignments-add` | 1.29 % (same) |
| `admin-mobile-assignments-edit`, `teacher-mobile-assignments-edit` | 1.16 % (widget inset, buttons in the card) |
| `teacher-mobile-assignments-add` | 1.04 % (same) |
| `admin-mobile-charts-add`, `admin-mobile-charts-edit` | 0.10 % (check box inside the padding) |
| `admin-{desktop,mobile,tablet}-assignments-add` | missing on purpose (item 6), deleted from the baseline |

All other screenshots are identical or have the same pixels (activities, charts-list and the desktop profile included). I looked at the desktop assignments-add and profile images side by side: the changes are the intended ones. Suites: `test:e2e` 159 tests passed, `npm test` 168 passing, lint 0 errors (the 1 old warning). The baseline was regenerated once (the 56 changed or deleted files include re-encoded PNGs with the same pixels).

## Phase 2e (defects N6 and N7 of the phase 2c/2d test)

1. **N6, sidebar click threw "Invalid or unexpected token"** (`dashboard/views/includes/sidebar.ejs`, 8 lines): `jumpTo(\'/dashboard\', event)` had literal backslashes in the `onclick`; removed (as in `navbar.ejs`). Every sidebar click now works and adds `?lang=`. `dashboard.spec.js`: new tests click (mouse) the Users item and check the URL carries `lang=` with no page error, and click every sidebar item once with no page error. Both fail without the fix (6 of 10 tests failed on the old sidebar).
2. **N7, grey glyph on the round buttons** (`main.css`): `.btn .material-icons.text-muted { color: inherit !important; }` makes the icon white again (white on #999 = 2.85:1, as on master; the grey glyph was 1.57:1). The contrast test builds a `.btn.btn-round` with a `text-muted` icon and asserts the glyph is `rgb(255, 255, 255)` with a ratio of at least 2.8.
3. **N8 (optional): not fixed.** I could not reproduce the Tester's matrix with my own pointer-driven harness, so I could not check that a CSS/option change leaves the other moves intact (a `tolerance: 'pointer'` was already rejected in 2b). The last card can still be dragged up to any place, so every order stays reachable.

Comparison before the baseline was regenerated (pages with round buttons only, plus the mobile profile): journal-entries mobile 0.16 %, desktop/no-classroom 0.05 %; assignments, classrooms, users mobile 0.04 %, desktop/tablet 0.01 %; admin/teacher mobile profile 0.01 % (the 2FA round button). The other 38 are identical or have the same pixels. Suites: `test:e2e` 163 passed, `npm test` 168 passing, lint 0 errors (the 1 old warning). Baseline regenerated once.
