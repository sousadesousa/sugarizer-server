# Test report: dashboard Bootstrap 5, phase 2e (8bc30da)

**Verdict: READY to merge dashboard/bootstrap5 into master.** N6 and N7 are fixed and verified in a real browser; suites are green; the sweep is clean; N8 is unchanged and non-blocking. No product code was changed.

Setup: mongod 8.0.23 (conda-forge), `npm ci`, Chromium from `/opt/pw-browsers`, `../sugarizer` cloned. Browser checks used a throwaway Playwright spec (inside `test/e2e/`, deleted afterwards; not committed) on the e2e harness server and seed.

| # | Check | Result |
|---|---|---|
| 1 | Suites | PASS |
| 2 | N6 sidebar clicks | PASS |
| 3 | N7 white icon in round buttons | PASS |
| 4 | Regression sweep | PASS |
| 5 | N8 unchanged | PASS (unchanged, not a blocker) |

## 1. Suites: PASS
- `npm run test:e2e`: **163 passed (6.7 min)**.
- `npm run lint`: 0 errors, the 1 old warning (`api/route.js` unused eslint-disable).
- `npm test` (own mongod on 27017): **168 passing**.
- `git status` clean after the suites (nothing under `test/e2e/baseline/` changed).

## 2. N6: PASS
Real mouse click on **every visible sidebar item**, as admin and teacher, desktop 1280x800 and phone 390x844 (phone: sidebar opened with `#navbar-toggle` before each click). Each item was clicked once in English and once after switching to French with the language select (on the phone the cloned `#languageSelectionMobile`), reloading and clicking again.

| Role / viewport | Items clicked | Page errors | URL after click |
|---|---|---|---|
| admin desktop | 7 (home, users, activities, journal, classrooms, assignments, stats) | 0 | all `?lang=en`; after French all `?lang=fr` |
| admin phone | 8 (same + profile) | 0 | same |
| teacher desktop | 6 | 0 | same |
| teacher phone | 7 (+ profile) | 0 | same |

Example: `fr /dashboard/users -> /dashboard/users?lang=fr`. The French click keeps `fr` on every item. `jumpTo` now runs (the `?lang=` is added), where on 219559f it threw "Invalid or unexpected token".

## 3. N7: PASS
Computed `color` of the icon (`getComputedStyle(i).color`) of every visible `.btn-round .material-icons`, admin and teacher, desktop and phone:
- journal entries page: Upload journal, Download multiple, Delete multiple: all `rgb(255, 255, 255)`;
- users, classrooms, assignments: Delete multiple: `rgb(255, 255, 255)`.
Same values at both viewports and both roles. Side observation (not N7): the search button of the Activities page is `btn-white` (white button, icon `rgb(153, 153, 153)`), that of the chart list is white on grey; neither uses `text-muted`, neither changed in this commit.

## 4. Regression sweep: PASS
21 URLs (home, users + add + edit, classrooms + add + edit, activities, journal + entries, assignments + add + edit + deliveries, stats + list + add + edit, profile, enable 2FA, a 404 URL) x admin/teacher x desktop/phone (pages that do not exist for a role redirect): **0 uncaught page errors, 0 console errors, 0 HTTP responses >= 400** for local assets and pages (favicon excluded; the intended 404 page's own 404 console line excluded).

## 5. N8: PASS (unchanged, deferred)
`git diff 219559f 8bc30da` touches only `REPORT-phase1.md`, `main.css` (+5 lines), `sidebar.ejs`, `dashboard.spec.js` and the baseline images: no JS, no activities view, so the sortable behavior is identical to what I reported (second-to-last card cannot be dragged one place down to the last place; the last card can be dragged up to any place, so every order is still reachable). The e2e "dragged up to the first place and down to the last place" and "activities list is sortable" pass. Not a regression (master could not reach the last place at all).

## Questions for the manager
None.
