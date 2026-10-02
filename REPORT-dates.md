# Report: due date of the assignment form (branch `fix/dashboard-dates`, from master bc406c7)

Commit `50b98b1`. Files: `dashboard/views/addEditAssignment.ejs`, `dashboard/public/js/main.js`,
`dashboard/controller/assignments/addAssignment.js` and `editAssignment.js`, `dashboard/public/l10n/locales.ini`.

## Root causes and fixes

**1. The order of the date follows the dashboard language, not the region.** The format was chosen on the server with
`moment().creationData().locale._longDateFormat.L == "DD/MM/YYYY" ? "d-m-Y" : "m-d-Y"`. The dashboard only has `en`, `fr`,
`es`, `hi`: for any other language moment stays English and the date shows the month first (9 October = 10-09-2026), and
the text of the field was split on "-" to compute the timestamp.
Fix: the format is decided in the browser from its region (`regionDateFormat()` in `main.js`: `Intl.DateTimeFormat`
`formatToParts`, Gregorian calendar, Latin digits, first language of `navigator.languages` that gives day, month and year;
`m/d/Y` if none). de-CH and fr-CH give `d.m.Y`, en-US `m/d/Y`, pt-PT `d/m/Y`, ja `Y/m/d`. The day comes from the Date object that the
picker gives to `onChangeDateTime`, never from the text of the field. The first day of the week follows the region too
(`regionWeekStart()`). The time stays 24 hours (`H:i`). The language of the picker (month names) stays the one of the dashboard.

**2. The edit page filled date and time on the server.** `new Date(dueDate).toLocaleString(...)` and the two hidden fields
`dueDatestamp` / `dueTimestamp` were computed in the time zone of the server (a Docker server runs UTC): the date text did
not match the picker format ("Invalid Date" once picked), and the time was shown in server time (10:00 in Zurich in summer
showed 08:00), so saving without noticing moved the due time.
Fix: the page only renders the stored timestamp (`data-due` on the date field). The browser fills the date field, the time
field and both hidden numbers, in its time zone and region format. The two numbers are still what the server receives
(`dueDatestamp` = local midnight of the day, `dueTimestamp` = the rest up to the due time, so the sum is exact even on a day
when the clock changes), and they are empty while the date or the time is missing.

**3. A misleading message.** A missing date or time reported `InvalidDueDate` ("Due date must be in the future !").
Fix: new key `MissingDueDate` ("Please choose a due date and a time") in the `[*]`, `[en]`, `[fr]` (translated), `[es]`
(translated) and `[hi]` (English) sections. It is used when the date or the time is empty, or when the sum is not a number
(NaN is never sent to the API). `InvalidDueDate` is kept for a due date that is really in the past.

**Also: the "in the past" check only worked by accident.** It was written
`req.assert('dueDate', msg).equals(req.body.dueDate)`, which compares the value with itself. It still refused past dates
because express-validator reads the value when `validationErrors()` runs, by which time the code had replaced
`req.body.dueDate` with the computed number, while `equals()` kept the text of the field it was given at the call: the two
never matched, whatever the date (checked: with master's files a past date is refused, and `equals(self)` alone gives no
error). It is now written like the missing branch, `equals(null)`, so that it no longer depends on that order. No change of behavior.

## Tests

The e2e harness is not on master, so the tests are on `dashboard/bootstrap5` (`test/e2e/dates.spec.js`, 25 tests, in
browser contexts with their own `locale` and `timezoneId`, real calendar and time list, the time item is clicked with
`dispatchEvent` because the input overlaps the list):
- create with the pickers (day + 7 and 10:00, and a summer date in Zurich): the field text is in the order of the region
  (`22.03.2035` de-CH, `03/22/2035` en-US, `22/03/2035` fr-FR, `2035/03/22` ja-JP), the save succeeds, and the stored
  `dueDate` read through the API is that local date at 10:00 in that time zone (Europe/Zurich twice, America/New_York,
  Europe/Paris, Asia/Tokyo);
- edit page of that assignment: same local date and 10:00, no "Invalid Date", saved unchanged, `dueDate` unchanged;
- edit page of an assignment created through the API with a known due time: same;
- empty time, empty date, a hidden number that is NaN: `MissingDueDate`, nothing saved; a time already past today: `InvalidDueDate`.
Run against master's code, the date order and the missing-value tests fail (`03-22-2035` instead of `22.03.2035`; the wrong
message). The existing flows (en browser) still pass.

## Results

- `npm run lint`: 0 errors (1 old warning). `npm test`: 168 passing.
- `npm run test:e2e` on `dashboard/bootstrap5` with this branch merged: 126 passed (101 before + 25 new).
- Only 4 baseline screenshots changed, on purpose: the `*-assignments-edit.png` (the date reads `03/22/2035`, with the zero).

## Not changed, worth knowing

- Other dates that the dashboard renders on the server use the server time zone and the dashboard language: the "Last updated"
  columns (`moment(...).calendar()`) and the delivery date of the deliveries page (`moment(...).format(L + ' H:mm')`).
- Browsers without `Intl.DateTimeFormat.formatToParts` or the `calendar` / `numberingSystem` options fall back to `m/d/Y`.
  Checked in Chromium only, in five regions.
- The picker plugin rewrites the field when it loses focus (a text it cannot read becomes today's date) and then calls
  `onChangeDateTime` again: the hidden numbers follow the field, so they cannot be set by a script before a click on the
  submit button (the NaN test submits the form from the script for that reason).
