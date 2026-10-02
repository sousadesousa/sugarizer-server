# Test report: dashboard Bootstrap 5, phase 2a (7906ccf)

**Verdict: OK to continue with 2b, after one small fix (defect D1: on the home page the "Recent Students" / "Recent Entries" titles are `position: fixed` and, once the page is scrolled, float over the table rows; master did not do that).** Everything else works; the other findings are minor or already present before the migration. No code was changed.

Setup: mongod 8.0.23 (conda-forge), `npm ci`, Chromium from `/opt/pw-browsers`. Interactive checks: a throwaway Playwright script outside the repo, desktop 1280x800 and phone 390x844 (screenshots stay in my session, they are not in this branch; the compare images are in `test-results/compare/` of the run).

| # | Check | Result |
|---|---|---|
| 1 | e2e, lint, unit tests | PASS |
| 2 | Visual review of the 16 migrated pages | PASS with notes (agree with the Worker; 3 extra observations) |
| 3 | Interactive checks | PASS (D1 found here) |
| 4 | Console errors / asset 404s on all pages | PASS |
| 5 | Accessibility quick check | PASS with minor findings |
| 6 | Leftover references to removed libraries | PASS |

## 1. Suites: PASS
`npm run test:e2e`: **126 passed** (4.7 min); `git status` clean afterwards (nothing changed under `test/e2e/baseline/`); `test:e2e:compare`: 82 screenshots, 82 different (expected, every page has the new sidebar/navbar). `npm run lint`: 0 errors, the 1 old warning. `npm test`: **168 passing**.

## 2. Visual review of the 16 migrated pages
The percentages are exactly the report's (admin/teacher desktop home 2.72/2.67 %, mobile home 4.40 %, 2FA enable 4.39/4.34 % desktop and 5.62 % mobile, login 1.00 % / 3.39 %, verify2FA 0.83 % / 3.43 %, 404 0.39 % / 1.19 %). I opened the side-by-side images (baseline | current | diff) for admin desktop home, public desktop login, admin desktop 2FA enable, admin desktop 404, admin mobile home, public mobile login, teacher mobile 2FA enable and public mobile verify2FA; the admin/teacher twins of the same page are pixel-equal in percentage and are the same template.
- Home (desktop and mobile): agree "minor". Same layout, cards, charts, icons, tables, sidebar items aligned, nothing cut or overlapping; cards 2 px shorter, so the mobile stack drifts (4.4 %).
- Login and verify2FA: agree "intended" (label above the field instead of floating label). Desktop: card and language pill where they were.
- 404: agree "minor" (text 1-2 px).
- 2FA enable: agree "intended" (shorter card). Observation: the card title "2 Factor Authentication" is now white on the grey header (it was dark grey text); see contrast in 5. The QR and key are hidden by the test, so they are not judged.
- Observation (mobile login and verify2FA): in the baseline the language selector is a white filled pill (about 200 px wide, no border) in the top bar; now it is a smaller outlined pill, and the top bar is shorter. The report says the pill "keeps its border": in the baseline it had none visible. Minor, but not identical.
- Not visible in any compare image: D1 below (the compare screenshots are of the unscrolled page).

## 3. Interactive checks
Login/logout and navigation
- Login with the keyboard: Tab order on login is language select -> username -> password -> LOGIN; typing and pressing Enter logs in (`/dashboard?lang=en`). PASS.
- Sidebar navigation (desktop, admin): Home, Users, Activities, Journals, Classrooms, Assignments, Statistics each open the right page and show the right active item. Profile and Logout items are hidden on desktop (the user menu is in the navbar). PASS.
- Phone (teacher): the toggler opens the sidebar (260 px wide, slides in from the right); it contains the language list and the Logout/Profile items; the toggler or a tap on the grey layer closes it (sidebar x back to 390); Home...Assignments navigate; Logout from the sidebar returns to `/dashboard/login`. PASS.
- Language: fr (translated sidebar: Accueil, Utilisateurs, Activités, ...) and back to en work on desktop; fr and en work from the phone sidebar. es changes the select but the sidebar stays English: the `[es]` section of `locales.ini` has no translation for these keys (same on master; not caused by the migration).

QR modal: opens (QR canvas/img present), closes with the X button, with a click on the backdrop, and with Escape (Escape needs the modal to have taken focus, ~0.3 s after opening; pressed within that delay it is ignored, standard Bootstrap behavior). PASS.

Toast: after creating a user the green toast "User ... has been successfully created!" appears at the top right (350x48 px, opacity 1) and disappears after 5.5 s. PASS.

Tutorial (intro.js), admin home: starts by itself on the first visit; step texts follow; Next, Prev (back to the previous step) and Done work; after Done the next visit does not start it; the help button restarts it; Escape closes it. PASS.

**D1 (defect, medium): "Recent Students" and "Recent Entries" titles overlap the tables when the home page is scrolled.** `.dashboard-table-title` has `position: fixed` (`main.css:345`, same rule on master). On master the title moves with its card (after scrolling 300 px: title top 429, table top 449, the same 20 px gap as before scrolling). On 7906ccf it stays on the screen: after `document.querySelector('.main-panel').scrollTo(0, 300)` the title is at top 649 while the table is at 557, i.e. the title text is drawn on top of the table rows. It is visible to any user scrolling to the bottom cards of the home page (they are below the first screen at 1280x800) and in the tutorial steps 5-6 (the tour scrolls the same way). Reproduce: log in as admin, open `/dashboard`, scroll down. Suggested fix: remove the `position: fixed` rule (or make it `position: static`).

## 4. Console errors and asset 404s: PASS
Swept 22 URLs (home, users + add/edit, classrooms + add/edit, activities, journal + entries, assignments + add/edit/deliveries/comment, stats + list/add/edit, profile, enable 2FA, a 404 URL) as admin (desktop), teacher (desktop) and admin (phone): **0 uncaught page errors, 0 console errors, 0 HTTP responses >= 400** (not-yet-migrated pages included). The only failed requests are `net::ERR_ABORTED` of images and `/dashboard/graph` calls that were still loading when the script navigated away.

## 5. Accessibility quick check
- Login: both fields have visible `<label>`s, the button has text, the language select has no label (placeholder text only, minor). Home: no icon-only button or link without an `aria-label` or `title` (checked all buttons and anchors). The toggler has `aria-label="Toggle navigation"`, the QR close has `aria-label="Close"`.
- Toast: `role="status"`, `aria-live="polite"`, `aria-atomic="true"` (errors use `role="alert"`/`assertive`), close button labelled. PASS.
- Contrast: sidebar text white on #282828 = 14.7:1 (active item 21:1). PASS.
- Minor findings: toast text white on green #4caf50 is about 2.8:1 (below AA 4.5:1); card headers use white on #808080 (about 3.95:1); `<html lang="">` is empty on the pages; the home page has no `<h1>`.
- Minor, existing before the migration: the sidebar items are `<a onclick="jumpTo(...)">` without `href`, so they do not take keyboard focus: Tab on the home page goes brand link -> language select -> QR link -> body and starts over; a keyboard user cannot reach the menu. Worth fixing in 2b while the sidebar is touched (give them `href`).

## 6. Leftover references to removed libraries: PASS
`grep -rn "\$\.notify\|bootstrap-tour\|bootstrap-notify\|material-dashboard\|material\.min\|\$\.material\|md\.init" dashboard/` (excluding minified libraries): **no match**. The word "material" remains only as `material-icons` (the icon font, kept on purpose; 33 uses in views plus `main.css`, `font.css`, `main.js`) and `material-input` (17 empty `<span class="material-input">` in the not-yet-migrated views; no longer styled, to remove in 2b). Also `dashboard/public/js/noty.js` is in the folder and referenced nowhere (dead file, not new).
