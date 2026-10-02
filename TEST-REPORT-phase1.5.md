# Test report: dashboard Bootstrap 5, phase 1.5 (81980f4)

**Verdict: READY to start the migration on this baseline, on one condition: the `../sugarizer` client checkout used by the e2e run must be the same as the one that made the baseline (59 activities).** With 59 activities the baseline is portable to a different container (0 differences, no regeneration needed). With a different client checkout the home pages differ (see check 2). No code changed; temporary mutations were reverted (`git status` clean).

Setup: mongod 8.0.23 (conda-forge), `npm ci`, Chromium from `/opt/pw-browsers`.

| # | Check | Result |
|---|---|---|
| 1 | Baseline untouched by a normal run | PASS |
| 2 | Portability of the baseline | PASS with a caveat (client checkout) |
| 3 | Repeatability (two runs, separate folders) | PASS |
| 4 | Compare tool catches a real change | PASS (with notes) |
| 5 | flows.spec.js assertions are real | PASS |
| 6 | Runtime | PASS (3.9 to 4.2 min) |

## 1. Baseline untouched: PASS
`npm run test:e2e` -> 101 passed (4.1 m); `git status --short` empty afterwards (also no `env/e2e-*.ini`). Repeated after the later runs below: still clean.

## 2. Portability: PASS, with a caveat
First run in this container, then `npm run test:e2e:compare`: 82 screenshots, 63 identical, 15 same pixels, **4 different**, 0 new, 0 missing:
`admin-mobile-home` 0.03 %, `teacher-mobile-home` 0.03 %, `admin-desktop-home` 0.01 %, `teacher-desktop-home` 0.01 %.
These are NOT text antialiasing. The side by side image (`test-results/compare/admin-desktop-home.png`) shows the **Activities counter: 59 in the baseline, 61 here**. The server counts the activities in the sibling `../sugarizer/activities` folder, and the sibling checkout in my container (a branch with 2 extra activities) had 61. After checking the sibling out on `master` (59 activities) and running again: **0 different** against the committed baseline (66 identical, 16 same pixels). So Chromium/fonts differ nothing across containers; only the client checkout matters.
Consequences: CI must check out the client at the same version as the baseline (or the home pages will differ whenever activities are added); consider masking the counter or seeding a fixed activities folder. The Playwright output of a mismatching home page is small (0.01 to 0.03 %), so it would be flagged as "different" and not drowned in noise.

## 3. Repeatability: PASS
Two full runs, `E2E_SCREENSHOT_DIR` run-a / run-b (101 passed each, 3.9 m), compared with `test/e2e/compare.js`: **82 screenshots, 69 identical, 13 same pixels, 0 different**. Run A against the committed baseline: 66 identical, 16 same pixels, 0 different.

## 4. Compare catches a real change: PASS (notes)
Throwaway change: `#sugarizer-sidebar { display: none !important; }` appended to `dashboard/public/css/main.css`, full suite, compare, then `git checkout -- .`.
- Suite: 38 failed, 63 passed (12.7 min: the failures wait for timeouts). Every desktop page test failed on its own "sidebar visible" assertion, before taking the screenshot, so the compare tool reported them as **36 missing** (and 4 different). The mobile pages (sidebar off-canvas, nothing to hide) stayed identical, which is correct.
- The compare tool reported `teacher-no-classroom-desktop-journal` and `...-journal-entries` as **different, 19.90 %**: the sidebar is 260 of 1280 px = 20.3 % of the page width, so the percentage is sensible. (Two mobile profile pages also showed 0.03 % and 0.01 %, i.e. the tool's own noise.)
- Note: for a change that does not break an assertion, the desktop pages would be listed by percentage; here the assertion fires first. After a migration, "missing" screenshots mean "the test failed before the screenshot", so read the Playwright failures first.

## 5. flows.spec.js: PASS
The suite is serial, so I blocked one action at a time (`context.route` on the POST, answered with a redirect to `/dashboard`, as if the action did nothing; throwaway edit of `loggedIn()`, reverted):
- create a user (block POST `/dashboard/users/add`): "create, edit and delete a user" FAILED at `expectFlash`: `User E2E Flow User has been successfully created!` notification element(s) not found; the 11 following tests did not run.
- create an assignment with the date/time pickers (block POST `/dashboard/assignments/add`): "create an assignment" FAILED at `expectFlash`: `Assignment E2E Flow Assignment has been successfully created!` not found (after the pickers had been filled and the values asserted).
- return a delivery (block POST `/dashboard/assignments/deliveries/return/`): "return a delivery..." FAILED at `expectFlash`: `has been successfully returned!` not found; the 9 earlier tests passed.
Delete flows also assert the confirm dialog count and that the row is gone (read in the spec). Also noticed: create/delete assertions rely on the notification plus the list, which is what the migration will change (notify plugin), so these tests are good migration sentinels.

## 6. Runtime: PASS
`npm run test:e2e`: 101 tests, 4.1 m (250 s wall) first run; 237 s and 236 s (3.9 m) for the two later runs. Matches the report (4.1 min). The same suite with a broken sidebar took 12.7 m because of timeouts.
