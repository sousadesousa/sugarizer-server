# Test report: dashboard Bootstrap 5, phase 2b (85e3bbd)

**Verdict: NOT ready to merge as is. Ready to merge into master after the queued follow-ups AND the new defects N1 and N2 (real regressions) are fixed; N3 and N5 are small, N4 is a pre-existing usability blocker worth fixing now.** Suites, console, tutorial and the end-to-end flows are fine; what is left are layout/widget defects that no screenshot of the suite shows. No code was changed.

Setup: mongod 8.0.23 (conda-forge), `npm ci`, Chromium from `/opt/pw-browsers`. Interactive checks: throwaway Playwright scripts outside the repo, a de-CH / Europe/Zurich browser context (browser clock set to the server's 2035-03-15), desktop 1280x800 and phone 390x844, against a harness server on a throwaway database. Master (Bootstrap 3, `origin/master` = 150317e) ran as a second server on the same database for the comparisons.

| # | Check | Result |
|---|---|---|
| 1 | npm ci, e2e, lint, unit tests | PASS |
| 2 | Before/after visual review | PASS with notes (agree with the Worker's table; extra findings N2, N3) |
| 3 | Real-browser use, admin and teacher, desktop and phone | PASS with defects N1 (up-drag), N2 (phone widget), N4 (pre-existing, phone profile) |
| 4 | Tutorial (driver.js) | PASS (desktop; off below 992 px by design, same as master) |
| 5 | Console / asset 404 | PASS |
| 6 | Leftover grep, licence notice | PASS (one comment with a capital "Intro.js", N5) |

## 1. Suites: PASS
- `npm ci` ok. `npm run test:e2e`: **130 passed (4.8 min)**; `git status` clean afterwards (nothing changed in `test/e2e/baseline`).
- `npm run lint`: 0 errors, the 1 old warning (`api/route.js` unused eslint-disable).
- `npm test` (own mongod on 27017, `../sugarizer` = `sousadesousa/sugarizer` depth 1): **168 passing**.
- `node test/e2e/compare.js` bs3 (7906ccf) vs current: 82 screenshots, all different (expected); percentages as in the Worker's table.

## 2. Visual review (side by side: bs3 | bs5 | diff)
Opened: admin desktop users, users-add, classrooms-add, deliveries, activities, stats, charts-add, profile, "assignments-add" (see note) and teacher desktop assignments-add; mobile users, profile, teacher assignments-add, classrooms-add, deliveries, activities, charts-add. I agree with the Worker's judgments ("intended"/"minor") for all of them, with these additions:
- **Note:** `admin-*-assignments-add` is a screenshot of the Journals page in both baselines (an admin is redirected from `/dashboard/assignments/add` to `/dashboard/journal`; same on master). The real page is only in the teacher images. Not a regression.
- **N2 (new, regression), phone, assignments-add:** the "Classrooms" two-lists widget is 300 px wide and sticks out of the card padding on both sides: label, search boxes and both lists start at the card's left border (x=45) and the right list ends at the card's right border (x=345), while all other fields are inset by 20 px. In the bs3 baseline it lined up with the fields. (The same widget in users-add on a phone is fine.)
- **N3 (new, minor), phone, charts-add:** the "Hidden" check box is drawn on the card's left border instead of 20 px inside; bs3 was aligned with the fields.
- Minor, as the Worker said: users (mobile) a name wraps in two lines, button order Show/Add changed; deliveries (mobile) names wrap and the "Delivered at" header wraps; activities: Action icon about 1 px higher than the other cells; "Allow Late Turn In" is now on its own row under the date row in assignments-add; label "Due Date" larger than the other labels; "Shared Journal" check box 1-2 px below its label.
- No overlapping text, cut text (apart from the known select2 ellipsis), missing icon or unreadable state in the others.

## 3. Real-browser use (de-CH, Europe/Zurich), desktop AND phone
Every step passed on both viewports unless noted; the toasts appeared with the right text.
- **Admin, user:** create (name, language fr, role student, password, classroom E2E Class moved with the two lists widget) -> "successfully created"; edit: classroom kept, removed from the right list, rename -> "successfully updated"; delete (confirmation) -> "successfully deleted". PASS.
- **Admin, classroom:** create with the activity check boxes (6 boxes; Paint and Chat checked), reopen: Paint still checked, delete. PASS.
- **Admin, chart:** create (pie / how-users-are-active), listed, delete with confirmation, gone. PASS.
- **Teacher, assignment:** name, activity (select2), instructions, date picker, time picker 12:00, classroom; the field shows `15.04.2035` (dd.mm.yyyy) and the edit form shows `15.04.2035` and `12:00` again. Launch -> "successfully launched"; deliveries: 2 cards; comment "Well done" saved and shown on the card; after a student handed in (API), "Delivered" shows and Return gives "has been successfully returned!", card back to "Expected". PASS. (The "Delivered at" column shows `03/15/2035 10:20` even in de-CH; master shows the same, not caused by the migration.)
- **Journal (teacher):** private/shared check box toggles and enables the user select; on the private journal the row delete icon and "select all + Delete Multiple" delete the entries (2 -> 1 -> 0). PASS.
- **Profile (admin):** language en -> fr saved and kept after reload on desktop. PASS on desktop. **On a phone the Save button cannot be pressed: N4.**
- **Drag to reorder activities:** see below (N1).

### Reorder by drag, bs5 against master (real mouse, 6 activities, centre and edge target, 6 moves each)
| Move | master (Bootstrap 3) | 85e3bbd (Bootstrap 5) |
|---|---|---|
| down 0->3, 1->4, 2->4 | exact | exact |
| up 5->1, 4->2 | exact | exact |
| **up 3->0 (to the first place)** | lands at 0 | **lands at 1 ("one place short"), also with the pointer 80 px above the first card** |

So "one place short" is NOT general: it only happens when dragging to the first place, and it does not happen on master. During the drag the placeholder stays at index 1 and the dragged card remains a child of the list (on master the placeholder is the first child). The wrong order is what is saved and shown after reload. The widget e2e only drags down, so it cannot see this.

## 4. Tutorial (driver.js): PASS
Home (admin), Users (admin), Assignments (teacher), Journal (teacher), desktop, fresh browser context:
- starts by itself on the first visit (home "1 of 10", users "1 of 14", assignments "1 of 6", journal "1 of 2"); Next changes the step, Prev comes back; close (x) hides it and stores `<name>_end=yes`; no restart after a reload; the help button (`#navbar-help`) restarts it; Next up to Done finishes it and it does not restart after a reload; Escape closes it.
- While a step highlights an element, a mouse click on it (assignments, step 2: `#assignment-deleteMultiple`) and on the dimmed overlay does nothing: URL unchanged, popover still open.
- Console: 0 errors, 0 failed requests on all four.
- Phone: no tour starts below 992 px and the help button is hidden: identical on master (intro.js), by design.

## 5. Console / asset 404: PASS
21 URLs (home, users + add + edit, classrooms + add + edit, activities, journal + entries, assignments + add + edit + deliveries, stats + list + add + edit, profile, enable 2FA, a 404 URL) as admin and teacher, desktop and phone: **0 uncaught errors, 0 console errors, 0 HTTP >= 400**, no page with horizontal scroll. The flows and tutorial runs also stayed clean.

## 6. Leftovers: PASS
`grep -rn "intro\.js\|introjs\|bootstrap-tour\|bootstrap-notify\|material-dashboard\|\$\.material" dashboard/` -> nothing. Driver.js licence: `NOTICE` lines 16-17 name driver.js (MIT, Kamran Ahmed) and `dashboard/public/js/driver.LICENSE` exists; the banner of `dashboard/public/js/driver.js.iife.js` carries "MIT License, Copyright (c) Kamran Ahmed" and points to the licence file.
- **N5 (cosmetic):** a case-insensitive grep finds one comment `<!-- Intro.js CSS (tutorials) -->` in `dashboard/views/includes/header.ejs:21` (nothing is loaded there any more). Rename the comment.

## Defects (new)
**N1 (medium, regression vs master): the activities list cannot be dragged to the first place.** Reproduce: admin, `/dashboard/activities`, press the handle of the 4th card and move up to or beyond the first card, release: the card is 2nd (on master: 1st). Moves to any other place are exact. Suspect: with the Bootstrap 5 CSS the dragged item stays a child of the `ol` and the placeholder ends after it (look at `ol.simple_with_animation` / `.card` rules: position, margin, float). Add an up-drag to the first place to `widgets.spec.js`.

**N2 (medium, regression): phone (390 px), teacher, `/dashboard/assignments/add` (and the edit page, same template): the classrooms widget overflows the card padding on both sides** (300 px instead of 260 px; right list touches the card's right edge). Reproduce: login as teacher, phone viewport, scroll to "Classrooms". Not seen in users-add / user-edit, so look at the wrapper of the widget in the assignment form (row/col without padding around `.ms-container`).

**N3 (minor): phone, `/dashboard/stats/add` and edit: the "Hidden" check box sits on the card's border instead of 20 px inside.**

**N4 (medium usability; also in the bs3 baseline, so not caused by 2b, but the Worker described it as "like before" and it blocks saving): phone, `/dashboard/profile` (admin): the "Enable 2 Factor Authentication" button covers the Cancel and Save buttons** (floats; the three buttons are stacked on top of each other). Playwright: `click button[type=submit]` -> "`<a ... enable2FA ...>` subtree intercepts pointer events". A phone user cannot save a language or password change. Suggested fix: let the three buttons wrap/stack below 576 px (`d-flex flex-wrap` or a clearfix). I did not retest it as teacher; the template is the same.

## Already queued (not re-reported, not retested)
D1 floating titles, sidebar links not focusable, empty `lang`, toast/card header contrast, mobile login pill, select2 width on users, tablet widths.

## Questions for the manager
- Fix N4 in this branch or separately? I recommend now: the page is already migrated and the fix is one CSS rule.
- The admin "assignments-add" baseline screenshot is the Journals page (redirect). Should the spec skip admin there, so it does not look like coverage that is not there?
