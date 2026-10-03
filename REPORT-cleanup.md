# Cleanup round (branch `fix/cleanup-round`, from `master`)

One commit per item, each with a test that fails before and passes after (checked by stashing the fix). No pull request.
Environment: MongoDB 8.0.23 from conda-forge (outside the repo), Chromium from `/opt/pw-browsers`.

## 1. Translations (`a02105c`)

- **Cause.** The dashboard reads `[*]` (defaults) and `[en]` (the same strings, with `TokenInvalid`; `[*]` also has
  `verify`, `2FA-message`, `ErrorCodeNetwork`), so the real reference is `[*]` + `[en]` (536 keys). `[es]` was not only missing
  116 of them: 415 of its 420 keys were English copies, which is why the sidebar stayed English.
- **Fix.** The whole `[es]` section is translated to Spanish (formal "usted" as the one existing Spanish string
  `MissingDueDate`; classroom = "clase", assignment = "tarea", delivery = "entrega"; brand names and units kept).
  `[fr]` was missing 4 keys (`TokenInvalid`, `NoSharedJournal`, `homeTitle10`, `ErrorCodeNetwork`), translated.
  `[hi]` was missing the same 116 keys as `[es]`: **added with the English text** (as agreed). Leftover keys in `[fr]`
  (`homeTitle10A`) are untouched.
- **Test.** `api/test/unit/l10n.js`: every key of `[*]`+`[en]` exists in `[fr]` and `[es]`, `{{placeholders}}` are the
  same, `[es]` is not a copy of English. Before: 3 of 5 failing.
  (`npm test` runs `api/test/` without the `unit/` folder, `npm run test:unit` and the CI step "Unit tests" run it.)

## 2. `CommentAdded` (`ab3ac8a`)

Added to `[*]`, `[en]`, `[fr]`, `[es]`, `[hi]` (hi in Hindi). Same commit: the same kind of hole,
`AssignmentInstructionsInvalid` (used by the edit controller, no string) added in all languages (hi in English).
Test: unit test in `l10n.js` that every `l10n.get('Key')` written in `dashboard/controller` and `dashboard/helper`
exists (fails before on `CommentAdded` and `AssignmentInstructionsInvalid`); `flows.spec.js` now expects
"Comment has been successfully added!" instead of the key.

## 3. Launch and return messages (`f644ad7`)

- **Cause.** The links carry no `?name=`.
- **Fix.** `launchAssignment.js` and `returnAssignment.js` read the name with `GET /api/v1/assignments/:id`
  (new helper `assignmentName.js`; `?name=` stays as a fallback, then `assignment`). No template change.
- **Test.** `flows.spec.js` expects `Assignment <name> has been successfully launched!` / `returned!` (before: the launch
  step failed with "Assignment assignment ...").

## 4. `GET /api/v1/assignments/deliveries/:id` (`5b678e3`)

- **Causes.** `addQuery('buddy_name')` wrote a top-level field (the name is `content[].metadata.buddy_name`), the aggregate
  always sorted by name ascending whatever `sort` said (only echoed), `limit=0` / negative values went through `getOptions`
  unchecked.
- **What the other list endpoints do (so there is no convention to match).** I probed users, classrooms, assignments with
  `limit=0, -1, abc, offset=-1, abc`: all answer 200 with `limit: 0` and a bogus `prev_page` link for `limit=0`,
  `limit: -1` and `next_page=...offset=-1` links for a negative limit, `null` for non numbers; `GET /assignments` even
  answers **500** for a negative limit or offset. So I **clamped**: limit under 1 or not a number -> 10, offset under 0 or
  not a number -> 0 (status stays 200, as everywhere), in the `getOptions` of `assignments.js` (shared by the list and the
  deliveries, so the list stops answering 500). **`users.js` and `classrooms.js` have the same bug and are not
  changed** (outside the item; the same four lines would do it, say if you want it).
- **Fix.** `buddy_name`: partial, case insensitive, regex escaped (a value like `([` no longer throws). `sort`: `+x`, `-x`, `x`
  (a `+` in a URL is decoded as a space, handled), applied in the aggregate before the pagination, case insensitive for
  names, tie broken by `_id`; allowed fields `buddy_name`, `title`, `timestamp`, `isSubmitted`, anything else uses
  `buddy_name` and the echoed `sort` shows what was applied. (The old `getOptions` also dropped the first letter of an
  unsigned sort.)
- **Test.** 5 new tests in `api/test/assignments.js` (filter, bad regex, sort asc/desc/before the limit, unknown field,
  six invalid limit/offset queries). Before: the run died on the first new assertion.

## 5. `lateTurnIn` and `dueDate` (`b465325`)

- **Cause.** The edit form sent `"on"` when ticked and nothing when unticked, so unticking never saved (`$set` kept the
  old value): this was a second bug. The API stored any value.
- **Fix.** API add and update normalise `lateTurnIn` (true, "true", "on" -> true; false, "false", "off" -> false; else 400,
  code 43) and a numeric `dueDate` string -> number (non numeric, empty, null, object, boolean -> 400, code 44). Codes 43
  and 44 because 42 is used by the login limiter; strings added in all languages. Absent fields are left alone.
  `editAssignment.js` sends a boolean (the add form already did). The existing API test that expected the string
  `'false'` now expects `false`.
- **Test.** 21 new API tests (all accepted forms on create, update, rejected values, a failed update leaves the old
  date) and an e2e flow that ticks and unticks the box and reads the stored value through the API (before: `Received: "on"`).

## 6. Dates in the browser (`7ca5766`)

- **Cause.** `moment(...).calendar()` and the delivery `moment(...).format(...)` ran on the server (server time zone,
  dashboard language).
- **Fix.** The views (users, classrooms, assignments, journal entries, deliveries, the read only dates of the user,
  classroom and assignment forms) keep the server text as a fallback and carry the timestamp in `data-local-time`;
  `main.js` `localizeDates()` rewrites it with the date order of `regionDateFormat()`, the browser time zone, and the
  time in the region format: `15.03.2035 11:00` (de-CH), `03/15/2035 6:00 AM` (en-US), `2035/03/15 19:00` (ja-JP).
  **Behaviour change:** "Today at 10:00 AM" / "Yesterday" is gone, it is always date and time (relative words would be in
  the browser language, not the dashboard language, mixing the two). The harness now starts the server with `TZ=UTC`.
- **Test.** `dates.spec.js`: three browser contexts (Europe/Zurich de-CH, America/New_York en-US, Asia/Tokyo ja-JP) check
  the assignments, classrooms and users lists, the delivery date (a student submits through the API) and the two read
  only fields of the user form. Before: no `time[data-local-time]` found.
- The journal `data-timestamp` attribute of the user select (not read anywhere) is untouched.

## 7. Order of the activities (`d538c64`)

- **Cause.** `index = favoritesLength++` ran in the callback of each asynchronous `stat`/stream.
- **Fix.** `files.sort()`, remember the position of each directory, and number the non favorites after all are read, in
  that order (favorites keep the order of the settings; activities already in the database keep their saved order, new ones
  are appended in directory order). I sorted by directory name, not by `activities.json` (the server has no such file).
- **Test.** `api/test/unit/activitiesOrder.js`: 40 activities in a temp client folder plus 2 favorites, `load()` six
  times against a fake database, same list each time and equal to favorites then directory order. Before: fails each
  time (3 of 3 runs).
- This commit also contains `api/test/unit/workflow.js` (item 8's test) by mistake of `git add api`.

## 8. CI (`c144ff4`)

- New job `e2e` in `.github/workflows/test.yml`: the same MongoDB service, checkout of the client, `npm ci`,
  `npx playwright install --with-deps chromium` (CI only; `CHROMIUM_PATH` is not set so Playwright uses its own), `npm run
  test:e2e`, then `npm run test:e2e:compare` with `continue-on-error` and `if: always()`, then
  `actions/upload-artifact@v4` of `test-results/` with `if: always()`.
- **Pixel differences do not fail the job**: checked, no spec calls `toHaveScreenshot`/`toMatchSnapshot`; the screenshots are saved
  with `page.screenshot` and only `compare.js` reads them (it exits 0 whatever the differences). The unit test also
  asserts that.
- **Test.** `api/test/unit/workflow.js` parses the YAML (`yaml` added as a devDependency, it was only transitive) and checks the
  job, the order Chromium install -> suite, the non blocking compare and the artifact. Before: 5 of 5 failing. The file also
  parses with PyYAML. Actions cannot be run here, so the job itself is **untested**; one thing to watch: the baseline PNGs
  come from this container, so on the runner the compare report will show font differences (a report only).

## 9. N8 (optional) (see the last commit)

Reproduced with a new widgets test (5th card onto the 6th, `waitForResponse` times out). Cause: `containment: 'parent'`
keeps the dragged card inside the list, so it never overlaps the last card enough. `containment: 'document'` fixes
it (axis stays `y`); `tolerance: 'pointer'` was tried again and breaks the first sortable test, as in 2b. The
move matrix: the 30 moves of 6 cards with the edge-drag helper (`dragTo`) give the same result before and after except
`4->5`, which now works (the failures of that helper for downward moves are the same before and after, an artefact of
dragging to the bottom edge). The Tester's own matrix (pointer at the centre of the target) is not in the repo, so that
exact matrix was not run. Only the activities list is changed, not the charts list (same options, same symptom likely).

## Results

Final state of the branch (before the baseline commit): `npm run lint` 0 errors (the 1 old warning), `npm test` 191 passing
(168 at the start), `npm run test:unit` 66 passing, `npm run test:e2e` 168 passed (167 + the N8 test; the 163 of the
migration report grew with the flows, dates and N8 tests), in `E2E_BASELINE=1` mode, 7.6 minutes. Each item was also run
before its fix as described above. The full e2e run before item 7-9 was 167 passed.

The baseline PNGs were regenerated once (`test:e2e:baseline`): the date cells changed (item 6), which moved `test/e2e/baseline/`
files (the git status shows which); the folder now holds 87 files.

## Open points

- Baseline screenshots regenerated (item 6 changes every date cell): see the last commit; compare against the old
  baseline would show the date text.
- `users.js` / `classrooms.js` `getOptions` have the limit/offset bug of item 4.
- Item 6 drops the "Today at" wording (see above).
