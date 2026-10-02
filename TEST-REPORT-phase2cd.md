# Test report: dashboard Bootstrap 5, phases 2c and 2d (219559f)

**Verdict: NOT ready to merge as is, but close: two small regressions found in the final pass (N6, N7), each a few lines.** Every finding of the 2a and 2b reports is fixed and verified in a real browser, suites are green, the regression sweep is clean. After N6 (JS error and lost `?lang=` on every sidebar click, a one-line quoting mistake introduced in 2c) and N7 (white icon turned grey-on-grey in the "multiple" round buttons) are fixed, I see nothing that blocks the merge into master. N8 is minor and optional. No product code was changed.

Setup: mongod 8.0.23 (conda-forge), `npm ci`, Chromium from `/opt/pw-browsers`, `../sugarizer` cloned. Interactive checks: throwaway Playwright scripts outside the repo, de-CH / Europe/Zurich browser, harness server on a throwaway database (clock 2035-03-15); `origin/master` (150317e, Bootstrap 3) ran the same scripts for comparison where noted.

| # | Check | Result |
|---|---|---|
| 1 | Suites | PASS |
| 2a | 2a findings re-tested | PASS (all 8) |
| 2b | 2b findings re-tested | PASS (N1 with a residual, N8; N2-N5 PASS) |
| 3 | layout.spec.js catches overflows | PASS |
| 4 | Regression sweep, flows, tutorial | PASS with N6 (found during the sweep) |
| 5 | BS3 vs BS5 baseline comparison | PASS with N7 |

## 1. Suites: PASS
- `npm ci` ok. `npm run test:e2e`: **159 passed (6.0 min)**. `git status` clean afterwards (nothing under `test/e2e/baseline/` changed).
- `npm run lint`: 0 errors, the 1 old warning (`api/route.js` unused eslint-disable).
- `npm test` (own mongod on 27017): **168 passing**.

## 2a. Findings of the 2a report
| Finding | Evidence | Result |
|---|---|---|
| D1 titles of the home tables | Home, admin, 1280x800, `.main-area` scrolled to 0/150/300/600/max: both `.dashboard-table-title` are `position: static` and always end 20 px above their table (bottom 670 / table 690 at scroll 0; 537 / 557 at max scroll). | PASS |
| Sidebar with the keyboard | Tab from the language select: Sugarizer Server, Home, Users, Activities, Journals, Classrooms, Assignments, Statistics, then the select. Enter on "Users" -> `/dashboard/users`. | PASS (but see N6: Enter works through the plain `href`, the `onclick` is broken) |
| `<html lang>` | `en` on load; after choosing `fr` in the selector `fr`; back to `en` -> `en`. | PASS |
| Contrast, white text, computed from the rendered colours | toasts: success `#2e7d32` 5.13, danger `#d32f2f` 4.98, warning `#b45f00` 4.59, info `#00838f` 4.52; card header `#6f6f6f` 5.02; active sidebar item (white on `#6f6f6f`) 5.02. All >= 4.5. | PASS |
| Phone login language pill | 390x844: white (`rgb(255,255,255)`), 0 px border, 200x34, as in the baseline. | PASS |
| select2 "Select Classroom" at 1280 px | Rendered text "Select Classroom", `scrollWidth` 210 = `clientWidth` 210, not cut. | PASS |
| Tablet 820x1180 home | The four counters and the lower cards are one column (x=30, width 760), no horizontal scroll. | PASS |

## 2b. Findings of the 2b report
- **N1, drag to the first/last place (desktop, real mouse): PASS, with a residual (N8).** 6 activities. Moves to the FIRST place from every start position (1, 2, 3, 5), pointer 60 px above the first card, 10 px above, 4 px and 20 px inside it: all exact (checked against the expected order after each move), and the way back down too (see below for the exact "down" results). The 4th card to the first place, then reload: kept; the first card to the last place, then reload: kept. A full matrix of moves with the pointer at the centre of the target card (all 30 from-to pairs): 29 exact; the one that fails is N8. No console error.
  - Master (Bootstrap 3), same matrix: all moves to the LAST place land one place short (so the last place is reached only by the new CSS), all others exact.
  - Down moves with the pointer at the very bottom edge of the target card (3 px above it) go one place too far in the new CSS (e.g. 0->1 lands at 2); master was exact there. A user dragging by the middle of the card (the usual way) is not affected; I report it as an observation, not a defect.
- **N2, assignment add/edit on a phone: PASS.** Teacher, 390x844, add page and edit page: no label, field, `.ms-container` or button outside the card content box (65..325); screenshots checked: classrooms widget inside the card, Cancel/Save inside the card.
- **N3, "Hidden" check box on a phone: PASS.** stats add and edit: check box x=65 = left of the card content = left of the text field.
- **N4, profile on a phone: PASS.** Admin and teacher: Save (235..324, y 599..640) and Cancel (128..233) side by side, "Enable 2 Factor Authentication" below them (y 662..703, full width); trial clicks on Save and Cancel succeed; changing the language to `fr` and pressing Save works, the profile still shows `fr` after reload (put back to `en` afterwards).
- **N5, Intro.js leftovers: PASS.** `grep -rni "intro\.js\|introjs" dashboard/` finds nothing; `grep material-input dashboard/views` finds nothing.

## 3. The layout check (test/e2e/layout.spec.js): PASS
I read it: 15 tests (11 form pages, admin and teacher where the page exists, 390x844); every visible control (input, select, textarea, button, `a.btn`, label, `.form-check`, `.ms-container`, `.select2-container`) must lie inside the content box of the card body (1 px slack), and every button of the card gets a trial click. The soft assertion on the first part and the hard one on the click make one run report everything.
- Throwaway CSS, as asked: `@media (max-width: 575px){ .content .card input[type="text"]:first-of-type { width: calc(100% + 50px) !important; } }` appended to `main.css`: `admin users-add` FAILS with `input.form-control x=65..375 (card content 65..325)`, `#password x=65..375`, `input.form-control x=208..375`. Reverted with `git checkout -- .` (status clean).
- Also run against the product code of 3cb53e5 (`git checkout 3cb53e5 -- dashboard`, then back): 6 of 15 fail (charts-add/edit `#scales x=44..58`, both profiles with `"SAVE" cannot be clicked`, teacher assignments-add/edit `x=45..345` widget), exactly as the report says.

## 4. Regression sweep: PASS (one new defect, N6)
- 23 URLs (home, users + add + edit, classrooms + add + edit, activities, journal + entries, assignments + add + edit + deliveries + comment, stats + list + add + edit, profile, enable 2FA, a 404 URL, a teacher-without-classroom journal) x admin and teacher x desktop 1280x800 / tablet 820x1180 / phone 390x844 (pages that do not exist for the role redirect): 138 page loads, **0 uncaught/console errors, 0 HTTP responses >= 400 (apart from the intended 404 page), no horizontal scroll** (elements wider than the viewport outside tables/sidebar: none).
- Flows, in a de-CH / Europe/Zurich browser, on desktop AND phone (a throwaway copy of `flows.spec.js`, deleted afterwards): create/edit/delete user, create/edit/delete classroom, create/delete chart, create assignment (field shows `dd.mm.yyyy`), edit, launch, deliveries (2 cards), comment ("Well done"), hand-in through the API, return: all pass on both viewports, 0 page errors. (The "log out" test of that file clicks the desktop user menu and does not apply to a phone; the phone logout goes through the sidebar item and was verified in the 2a/2b reports; I did not repeat it.) The date order is also asserted by `dates.spec.js` (de-CH `22.03.2035`, etc.), which passed in the suite.
- Journal (teacher, desktop): the shared check box toggles and enables the user select, back to private works; deleting the private entry shows "E2E work entry successfully deleted!" and the entry is gone after reload.
- Tutorial (admin, desktop, tours enabled, fresh context): starts by itself on the first visit of the home page (10 steps), Next up to the end closes it and stores `home_end=yes`, no restart after a reload or after leaving and coming back, the help button restarts it, Escape closes it. 0 errors.
- **N6, new defect (medium-low, regression of 2c): clicking a sidebar item throws "Uncaught SyntaxError: Invalid or unexpected token".** `dashboard/views/includes/sidebar.ejs` lines 24, 34, 44, 54, 64, 74, 85, 96 have `onclick="return jumpTo(\'/dashboard\', event)"`; the backslashes are literal in the HTML, so the handler does not compile. The click then follows the plain `href`: it navigates, but `jumpTo` never runs, so the `?lang=` argument is not added (the language still persists: it is kept anyway, so the visible effect is small) and the browser console shows a page error on every sidebar navigation. Reproduce: admin, `/dashboard`, click "Users" in the sidebar, watch the console (Playwright `pageerror`: `Invalid or unexpected token`; URL `/dashboard/users` instead of `/dashboard/users?lang=en`; on master `/dashboard/users?lang=fr` after choosing French). The navbar "Profile" item (`navbar.ejs:33`) is written correctly. Why nothing saw it: the e2e test presses Enter on a link (works through `href`) and the sweep does not click the sidebar. Fix: remove the eight backslashes; add a `pageerror` assertion to the sidebar test, with a click.

## 5. Bootstrap 3 baseline (7906ccf) against the final baseline
`node test/e2e/compare.js` : 89 screenshots: 80 different, 7 new (the tablet ones), 2 missing (admin assignments-add desktop/mobile, dropped on purpose). I opened the side-by-side images of all 21 admin desktop pages, all 12 admin mobile pages plus teacher assignments-add, public login/verify2FA on a phone, and the tablet images (the teacher twins are the same templates and have the same percentages as the admin pages, I did not open them one by one). Nothing is cut, overlapping, missing or unreadable, except:
- **N7 (minor-medium, visual and accessibility, regression against master and the Bootstrap 3 baseline): the icon of the round "Upload journal", "Download multiple" and "Delete multiple" buttons is grey on grey.** The buttons are `.btn.btn-round` (`#999`) with `<i class="material-icons text-muted">`; Bootstrap 5's `.text-muted` (`#777`) now wins, so the glyph is `#777` on `#999` = **1.57:1**; on master it is white (`rgb(255,255,255)`, measured). Visible in every screenshot of journal-entries, users, classrooms and assignments (desktop and phone), where the buttons look faded. Pages: journal (3 buttons), users, classrooms, assignments (delete multiple), admin and teacher. The search icon buttons are white on `#999` (2.85:1, the same as before). Reproduce: admin, `/dashboard/users`, inspect `a[title="Delete Multiple"] i`. Fix: one rule, e.g. `.btn .material-icons.text-muted { color: inherit; }` (or remove `text-muted` from these icons), then regenerate the baseline.
- Known and accepted as before: select arrows added, form labels above the fields, the users toolbar wraps on two lines on a phone with a different button order, tables scroll inside the card on a phone.

## Other defects
- **N8 (minor, activities sortable list): the second-to-last card cannot be dragged one place down to the last place.** 6 activities, press the handle of the 5th card and move it onto the 6th (pointer at the centre or 60 px below the 6th card), release: nothing moves (tried 8 times with different cards and pointer positions). The same card moves to the last place from the 1st to 4th position, and the last card can be dragged up to any place, so every order is still reachable (drag the last card up instead); on master no move to the last place worked, so this is not a regression. The e2e drags the 1st card to the last place, which works.

## Questions for the manager
- None blocking. I would fix N6 and N7 (and add a clicked-sidebar check to `dashboard.spec.js`) before merging; N8 can wait or be left.
