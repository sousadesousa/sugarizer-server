# Hotfix report: deliveries crash and journal redirect loop

Branch `fix/deliveries-and-journal-loop`, from `origin/master` (bc406c7). Both bugs are live on master.

## 1. Deliveries crash (critical)

**Root cause.** `findAllDeliveries` in `api/controller/assignments.js` (served by `GET /api/v1/assignments/deliveries/:id`
and by the dashboard page `/dashboard/assignments/deliveries/:id`) called `deliveries.get(function(err, all) {...})`.
That was a cursor method of an old MongoDB driver; with driver 6 (`^6.20.0`) it does not exist, so the call throws
`TypeError: deliveries.get is not a function` inside an asynchronous callback. The server turns any uncaught exception
into `process.exit(-1)` (`sugarizer.js`), so one request to that page took the whole server down.

**Fix.** The aggregation is read once with `toArray()`, `total` is the length of the result, and `options.skip` /
`options.limit` are applied by slicing the array. A failure of `toArray()` now answers 500 (code 10) like the other
error paths. The response shape is unchanged (`deliveries`, `offset`, `limit`, `total`, `sort`, `links`). The sort of the
aggregation was already fixed in the pipeline and is untouched.

**Tests** (`api/test/assignments.js`, new `/GET/deliveries/:id assignment`, 6 tests): invalid id (401, code 35); the
list of the launched assignment (200, `total` 2, `offset` 0, `limit` 10, `sort`, one delivery per student, each with the
assignment id); `limit=1&offset=0` (1 item, `next_page`, no `prev_page`); `limit=1&offset=1` (the other item,
`prev_page`, no `next_page`); `offset=2` (empty, `total` still 2); and a request to `/api` afterwards to check the server
is still up. Run against the old controller 4 of them fail (the server dies); with the fix they pass.

## 2. Redirect loop for a teacher with no classroom

**Root cause.** A teacher only gets the shared journal of the students of the classrooms assigned to the teacher. With no
classroom, `GET /api/v1/journal?type=shared` returns an empty list, and `getSharedJournalId`
(`dashboard/controller/journal/util/index.js`) answered by redirecting to `/dashboard/journal`, which is the page that
calls `getSharedJournalId`: `ERR_TOO_MANY_REDIRECTS` on `/dashboard/journal` and `/dashboard/journal/:id`.

**Fix.** `getSharedJournalId` no longer redirects. When there is no shared journal it flashes a message and calls back with
an empty id, so the page renders (empty state, "Please select a user and click on show results!"):
- empty list: new string `NoSharedJournal` = "No shared journal found. It is available once a classroom with students is
  assigned to you" (added in `dashboard/public/l10n/locales.ini` to the `[*]`, `[en]`, `[hi]` and `[es]` sections in
  English; French and any missing language fall back to the default section, as the dashboard already does);
- API error answer: the existing `ErrorCode<n>` message, as before; no answer at all: `ErrorCodeNetwork` (it used to throw).

`dashboard/views/journal.ejs`: the script that ticks the "Shared Journal" box when the URL is the shared journal now
requires a non-empty shared id, otherwise the empty id would match `/dashboard/journal` and tick the box.

**Tests.** The e2e harness and spec live on `dashboard/bootstrap5` only (master has none), so the e2e tests are there
(`test/e2e/dashboard.spec.js`, `teacher without classroom`: `/dashboard/journal` and `/dashboard/journal/:id` as a seeded
teacher with no classroom; status 200, no redirect loop, the page and the message shown, the shared box unchecked, no
page errors, screenshots). Run against the old `util/index.js` they fail with `ERR_TOO_MANY_REDIRECTS`; with the fix they pass.

## Not changed (as asked)

Admin on `/dashboard/assignments/add` still redirects with "Invalid journal" (admins have no private journal): known
behaviour, kept in the list of pages in `REPORT-phase1.md` on `dashboard/bootstrap5`.

## Results

- `npm run lint`: 0 errors (1 warning that was already there).
- `npm test` (mongod 8.0.23 on 27017): 168 passing (162 before + 6 new).
- `npm run test:e2e` (on `dashboard/bootstrap5` with this branch merged, `MONGOD_BIN` as before): 89 passed.
- `dashboard/bootstrap5`: this branch merged (fa8c487), the four `test.fail()` marks removed, deliveries screenshots and
  the two no-classroom screenshots added to the baseline (82 files), pushed.

## Open points

- The notification of the new message is visible in the screenshots of the no-classroom journal pages (its timer is 2 s).
- `getJournalEntries` / `getActivities` in the same util file still redirect to `/dashboard/journal` on an API error; this no
  longer loops now that `/dashboard/journal` always renders.
