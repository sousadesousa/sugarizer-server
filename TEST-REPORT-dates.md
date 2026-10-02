# Test report: `fix/dashboard-dates` (code 50b98b1, to master)

**Verdict: READY FOR MASTER.** The three Swiss cases are reproduced on master (bc406c7) and fixed on the branch, in two server time zones, in six more regions and in French and Spanish. One minor edge case (the repeated hour on the night the clocks go back) is reported below; it is not a blocker. No code was changed.

Method: real servers started from checkouts of bc406c7 and 50b98b1 (own mongod 8.0.23, seeded teacher/classroom/work), driven by a throwaway Playwright script outside the repo (real calendar and time list, one browser context per `locale` + `timezoneId`, server started with the given `TZ`). Dates are in the future of the machine clock (today 2 Oct 2026): 9 October and the DST Sunday 25 October 2026. Assignment names have no punctuation (the form rejects "-" and ":").

| # | Check | Result |
|---|---|---|
| 1 | Reproduce on master (a)(b)(c) | PASS (all three reproduced) |
| 2 | Same on the branch, TZ=UTC and TZ=America/New_York | PASS |
| 3 | Daylight saving, 25 Oct 2026, Zurich | PASS (one ambiguous-hour edge) |
| 4 | fr-CH, it-CH, en-US, en-GB, pt-PT, ja-JP | PASS |
| 5 | Dashboard in French and Spanish | PASS |
| 6 | npm test, lint, e2e | PASS |
| 7 | Rest of the form (late turn-in, classrooms, name) | PASS |

## 1. master (bc406c7), browser de-CH / Europe/Zurich, dashboard English, server `TZ=UTC`
- (a) after picking 9 October the field shows `10-09-2026` (month first).
- (b) assignment due 10:00 Zurich (2026-10-09T08:00Z): the edit page shows time **08:00** (and date `10/9/2026`, a different format from the picker).
- (c) date picked, time empty: "Due date must be in the future !" (same message with date empty).

## 2. branch 50b98b1
| | server TZ=UTC | server TZ=America/New_York |
|---|---|---|
| (a) field after picking 9 Oct | `09.10.2026` | `09.10.2026` |
| create, 10:00 Zurich: stored | 2026-10-09T08:00Z (= 10:00 Zurich) | same |
| (b) edit page of that assignment | `09.10.2026` `10:00` | same |
| (b) edit page of an API-made assignment due 08:00Z | `09.10.2026` `10:00` | same |
| save edit unchanged: dueDate | identical (1791532800000 before and after) | identical |
| (c) empty time / empty date | "Please choose a due date and a time" (both) | same |
No page errors. The browser time zone wins whatever the server TZ.

## 3. Daylight saving (Europe/Zurich, Sunday 25 Oct 2026, clocks 03:00 -> 02:00)
- 10:00 (UI): stored 2026-10-25T09:00Z (= 10:00 CET, correct), edit page `25.10.2026 10:00`, saved unchanged -> identical. API-made 09:00Z: edit page 10:00.
- 02:30 (typed in the time field, the list only has whole hours): stored 2026-10-25T00:30Z (= 02:30 CEST, the first 02:30), edit page `02:30`, saved unchanged -> identical.
- Edge (minor): 02:30 occurs twice that night. An assignment stored at the second 02:30 (01:30Z, CET) shows `02:30` on the edit page, and saving it unchanged stores 00:30Z: **shifted by -60 min** (the first occurrence). Reproduce: API-create dueDate 2026-10-25T01:30:00Z, open its edit page in a Zurich browser, Save. Cause: the browser can only rebuild the local time from the wall clock `02:30`. Affects only that repeated hour once a year, and only for a second-occurrence time (the picker itself always produces the first). A note rather than a fix is reasonable.

## 4. Other regions (server TZ=UTC, pick 9 Oct 2026 10:00 with the pickers)
| locale / zone | field text | save | stored | edit page |
|---|---|---|---|---|
| fr-CH Zurich | 09.10.2026 | created | 08:00Z OK | 09.10.2026 10:00 |
| it-CH Zurich | 09.10.2026 | created | 08:00Z OK | 09.10.2026 10:00 |
| en-US New_York | 10/09/2026 | created | 14:00Z OK | 10/09/2026 10:00 |
| en-GB London | 09/10/2026 | created | 09:00Z OK | 09/10/2026 10:00 |
| pt-PT Lisbon | 09/10/2026 | created | 09:00Z OK | 09/10/2026 10:00 |
| ja-JP Tokyo | 2026/10/09 | created | 01:00Z OK | 2026/10/09 10:00 |

## 5. Dashboard language (browser de-CH / Zurich, `?lang=`)
- French: picker month `Octobre`, weekdays Lun..Dim, date `09.10.2026` (order from the region), missing time "Veuillez choisir une date de rendu et une heure", success "Le devoir ... a été créé !".
- Spanish: month `Octubre`, weekdays Lun,Mar,Mié,Jue,Vie,Sáb,Dom, date `09.10.2026`, missing time "Por favor, elija una fecha de entrega y una hora". The success message stays English ("Assignment ... has been successfully created!"): it is a message the branch did not touch (not translated in `es` before either).

## 6. Suites
- `npm test` on 50b98b1: **162 passing** (the report says 168; the 6 extra are the deliveries tests of the hotfix branch, which this branch, made from bc406c7, does not contain). `npm run lint`: 0 errors, 1 old warning.
- `npm run test:e2e` on `dashboard/bootstrap5` (520fccc, which has this fix): **126 passed** (4.7 min); `git status` clean afterwards; `test:e2e:compare`: 82 screenshots, 0 different.

## 7. Rest of the form (de-CH, Zurich)
Create with name, work, instructions, classroom, late turn-in unticked: stored name, instructions, classroom, `lateTurnIn: false`, dueDate 08:00Z. Edit page shows the same name, instructions, the classroom selected, late turn-in unticked, `09.10.2026 10:00`. Edit (rename, tick late turn-in, 12 Oct 14:00): stored name renamed, classroom kept, dueDate 2026-10-12T12:00Z (= 14:00 Zurich). Nothing broke. Note: after an edit with the box ticked, `lateTurnIn` is stored as the string `"on"`; master does the same (pre-existing, unrelated).
