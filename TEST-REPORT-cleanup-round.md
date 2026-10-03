# Test report: `fix/cleanup-round`

- Tested commit: `d74d74869e352353680509c30d657b1d507a5b84` ("Clamp limit and offset on users and classrooms lists like assignments").
- Baseline for "before": `origin/master` (`ec1026d`), run as a second server in a separate worktree.
- Method: two servers (master and branch), each with its own database, `TZ=UTC`, real clock, the real `../sugarizer` client.
  Each bug was reproduced on master with my own steps (curl/node `fetch` against the API, Playwright + Chromium for the dashboard),
  then the same steps were run on the branch. I did not use the repo's own specs for the item checks; those ran only as part of `npm run test:e2e`.
- Tester only: no product code changed, no pull request.

## Verdict

**Ready to merge into master, with one Low-severity caveat on the optional item 9 (defect D1).**
Items 1-8 and the follow-up: PASS. Item 9: the requested checks pass (N8 reproduced on master and fixed; the 30-move matrix has no regression),
but a wider check on a long list found one regression in an unusual situation (D1). It is in the "optional" N8 change only, and does not affect the rest.
The manager decides whether to accept D1 or drop/adjust the `containment: 'document'` change.

| # | Item | Result |
|---|------|--------|
| 1 | Translations (es, fr, l10n test) | PASS |
| 2 | `CommentAdded` | PASS |
| 3 | Launch/return message with the assignment name | PASS |
| 4 | Deliveries filter/sort/limit/offset, users, classrooms, assignments | PASS |
| 5 | `lateTurnIn` / `dueDate` | PASS |
| 6 | Dates in the browser time zone | PASS (cosmetic note N2) |
| 7 | Order of the activities | PASS |
| 8 | CI workflow | PASS (static review; Actions cannot be run here) |
| 9 | N8 drag, 30-move matrix | PASS for the requested checks; D1 (Low) found on a long list |
| - | lint / `npm test` / `test:unit` / `test:e2e` / `git status` | PASS |

## Suites (on the tested commit)

| Command | Result |
|---------|--------|
| `npm run lint` | 0 errors, 1 warning (`api/route.js:15` unused eslint-disable, pre-existing) |
| `npm test` (mongod 8.0.23 on 27017) | 193 passing |
| `npm run test:unit` | 66 passing |
| `npm run test:e2e` | 168 passed (7.6 min), exit 0 |
| `npm run test:e2e:compare` after the e2e run | exit 0 (report written) |
| `git status` after everything | clean (main checkout; my test servers ran from separate worktrees, removed afterwards) |

## 1. Translations: PASS

- Counts from parsing `dashboard/public/l10n/locales.ini` (`[*]` + `[en]` = reference):

  | | master | branch |
  |---|---|---|
  | reference keys (`[*]`+`[en]`) | 536 | 540 (+4 keys added by items 2 and 5, among them `CommentAdded` and `AssignmentInstructionsInvalid`) |
  | `[es]` keys / missing | 420 / 116 | 540 / 0 |
  | `[es]` values identical to English | 415 | 9 (`buddy`, `color`, `ShortForBytes/Kilobytes/Megabytes`, `hindi-nav`, `igbo`, `yoruba`, `hindi`: names/units, acceptable) |
  | `[fr]` missing | 4 | 0 |
  | `[hi]` missing | 116 | 0 (English text, as agreed) |

- Browser (admin, language chosen with the navbar selector, which sets `localStorage.languageSelection` and reloads with `?lang=es`):
  - master: sidebar "Home / Users / Activities / Journals / Classrooms / Assignments / Statistics / Logout", table headers "Username / Language / Role / Last Seen / Action": all English.
  - branch: sidebar "Inicio / Usuarios / Actividades / Diarios / Clases / Tareas / Estadísticas / Cerrar sesión";
    home "Icono / Nombre de usuario / Fecha y hora / Actividad"; users "IMPORTAR USUARIOS / MOSTRAR RESULTADOS / Nombre de usuario / Idioma / Rol / Última conexión / Acción";
    assignments "Actividad / Nombre / Estado / Última actualización"; classrooms "Número de estudiantes".
  - Success message after creating a classroom: master "Classroom X has been successfully created!", branch "¡La clase X se ha creado correctamente!".
  - Screenshot checked (users page): layout fine with the longer Spanish texts.
- 20 random `[es]` strings spot-checked (seeded sample), all real, sensible Spanish, formal "usted", placeholders kept:
  `Añadir gráfico`, `Cancelar`, `Página siguiente >>`, `Esta es la lista de todas las entregas.`, `Seleccione el estudiante y el tipo de diario y haga clic en Mostrar resultados`,
  `Inglés`, `Alemán`, `No tiene permiso para realizar esta acción`, `Gráfico de barras`, `Esto abre la lista de estudiantes de esta entrega.`, `Vista del diario`,
  `¡El gráfico {{title}} se ha añadido correctamente!`, `Error del servidor`, `Rol`, `Este botón inicia la búsqueda.`, `No se pudieron eliminar los usuarios`, `Editar clase`,
  `Exportar usuarios`, `Descargar`, `Este botón inicia la actividad en otra pestaña exactamente como aparec…`.
- French, the 4 added keys: `TokenInvalid` "Le jeton saisi n'est pas valide", `NoSharedJournal` "Aucun journal partagé trouvé. Il sera disponible dès qu'une classe avec des étudiants vous sera assignée",
  `homeTitle10` "Aide", `ErrorCodeNetwork` "Le serveur n'est pas joignable. Veuillez réessayer": correct French.
- `npx mocha api/test/unit/l10n.js`: branch 6 passing. The same file copied into a master worktree: 2 passing, **4 failing** (fr keys, es keys, es not a copy, strings used by the code).

## 2. `CommentAdded`: PASS

Teacher, new assignment launched, "Comment" on a delivery, submit.
master: toast text is the raw key **`CommentAdded`**. branch: **`Comment has been successfully added!`** (and `Le commentaire…`, `¡El comentario…`, Hindi exist in the file).

## 3. Launch / return messages: PASS

Same flow, assignment named "Msg Test 8082 r16508" (master run: "Msg Test 8081 r80506"):

| | launch | return |
|---|---|---|
| master | `Assignment assignment has been successfully launched!` | `Assignment assignment has been successfully returned!` |
| branch | `Assignment Msg Test 8082 r16508 has been successfully launched!` | `Assignment Msg Test 8082 r16508 has been successfully returned!` |

## 4. `GET /api/v1/assignments/deliveries/:id` and list endpoints: PASS

Setup: a classroom with 6 students named `alice`, `ALICE B`, `Bob [x]`, `carl`, `zed ([`, `Mary.Ann`, assignment launched (6 deliveries), admin token.

| Query | master | branch |
|---|---|---|
| `buddy_name=ali` / `ALICE` | 0 results | 2 (`alice`, `ALICE B`): partial, case-insensitive |
| `buddy_name=[x` | **HTTP 500** (HTML error page) | 1 (`Bob [x]`) |
| `buddy_name=([` | **HTTP 500** | 1 (`zed ([`) |
| `buddy_name=.*` | 0 | 0 (the dot-star is a literal, not a regex) |
| `buddy_name=mary.ann` / `maryXann` | 0 / 0 | 1 / 0 (the dot is literal) |
| `sort=-buddy_name` | same order as ascending, `sort` echoed as `desc` | `zed ([, Mary.Ann, carl, Bob [x], ALICE B, alice` (real descending) |
| `sort=buddy_name` | order `ALICE B, Bob [x], Mary.Ann, alice, carl, zed ([` (case-sensitive), echo `uddy_name(asc)` (first letter dropped) | `alice, ALICE B, Bob [x], carl, Mary.Ann, zed ([` (case-insensitive), echo `buddy_name(asc)` |
| `sort=%2Bbuddy_name` | works | works (asc) |
| `sort=bogus` | echo `ogus(asc)` | falls back to `buddy_name(asc)` |
| `sort=-title` / `-timestamp` | echoed only | applied (all values equal here, so order by `_id`; I could not show a visible difference for these two) |
| `limit=0` | 200, `limit: 0`, prev/next links `?limit=0&offset=0` | 200, limit 10, no links |
| `limit=-1` | 200, `limit: -1`, 5 of 6 rows, links with `-1` | 200, limit 10, 6 rows |
| `limit=abc` | `limit: null` | limit 10 |
| `limit=2&offset=-1` | `offset: -1`, 1 row (`zed ([`!) | offset 0, rows 1-2 |
| `limit=2&offset=abc` | `offset: null` | offset 0 |
| `limit=2&offset=100` (beyond total) | 200, 0 rows | 200, 0 rows (unchanged, `prev_page` is `offset=98`, odd but same as before) |
| `limit=2&offset=4` | rows 5-6 | rows 5-6 |
| `limit=2&offset=2&sort=-buddy_name` | page of the unsorted list | `carl, Bob [x]` (correct page of the descending list), links keep `sort=-buddy_name` |

Same `limit`/`offset` values on the list endpoints (admin):

| Endpoint | master | branch |
|---|---|---|
| GET `/users` | `limit=0`: limit 0 + self-linking `prev_page`; `limit=-1`: 0 rows, negative links; `offset=-1`: 0 rows; `abc`: `null` | all of `0, -1, abc, offset=-1, offset=abc, limit=-3&offset=-1`: 200, `limit` 10, `offset` 0, all rows, no `prev_page`/negative link |
| GET `/classrooms` | same defects as users | same fixed result as users |
| GET `/assignments` | `limit=-1`, `offset=-1`, `limit=-3&offset=-1`: **HTTP 500**; `limit=0`: bogus links | 200 with defaults in all cases |
| valid `limit=2&offset=1`, `offset=500` | normal | unchanged and correct on all three endpoints |

## 5. `lateTurnIn` and `dueDate`: PASS

Dashboard edit form (teacher; a fresh assignment, stored value read back through the API after each save):

| Step | master | branch |
|---|---|---|
| initial | `false` | `false` |
| tick, save | `"on"` | `true` |
| untick, save | **`"on"`** (never saved) | `false` |
| tick, save / untick, save | `"on"` / `"on"` | `true` / `false` |

API (create and update both checked):

| Input | master | branch |
|---|---|---|
| `lateTurnIn` `true`, `"true"`, `"on"` | stored as given (`"true"`/`"on"` strings) | stored `true` (boolean) |
| `false`, `"false"`, `"off"` | stored as given | stored `false` |
| `"junk"`, `5`, `null` | 200, stored | **400** `{"error":"Invalid late turn in value","code":43}` |
| `dueDate` `"1800000000000"` | stored as string | stored as number `1800000000000` |
| `dueDate` `1800000000000` | number | number |
| `dueDate` `"abc"`, `""`, `null`, `{}`, `true` | 200, stored | **400** `{"error":"Invalid due date","code":44}` |

A failed update leaves the old values: after `PUT {"lateTurnIn":"junk","dueDate":1900000000000}` the stored values were still `true` / `1800000000000` (HTTP 400). Absent fields untouched (`PUT {"name":...}` keeps both). `{"lateTurnIn":"off"}` → `false`, `{"dueDate":"1700000000000"}` → number.

## 6. Dates: PASS

Server `TZ=UTC`, real clock. Chromium contexts with locale + `timezoneId`. "Expected" computed in the page with `Intl` from the `data-local-time` attribute (all matched). A journal entry with a fixed timestamp `2026-07-04T22:30:00Z` crosses midnight in Zurich:

| Page | master (any browser) | branch, de-CH / Europe/Zurich | branch, en-US / America/New_York |
|---|---|---|---|
| users / classrooms / assignments | `Today at 1:38 PM` (server UTC) | `03.10.2026 15:38` | `10/03/2026 9:38 AM` |
| journal entries (now) | `Today at 1:38 PM` | `03.10.2026 15:38` | `10/03/2026 9:38 AM` |
| journal, fixed 2026-07-04T22:30Z | `07/04/2026` (server format) | `05.07.2026 0:30` | `07/04/2026 6:30 PM` |
| deliveries (submitted by student `carl`) | `10/03/2026 13:45` (UTC, US order) | `03.10.2026 15:45` | `10/03/2026 9:45 AM` |

The master output is identical for both browsers, which is the bug. Dates are in dd.mm.yyyy for de-CH and mm/dd/yyyy for en-US. Not tested: the read-only date fields of the user/classroom/assignment edit forms (covered only by the repo's `dates.spec.js`, which passed).

## 7. Order of the activities: PASS

Real client (62 folders, 61 activities), server restarted 6 times per scenario, `GET /api/v1/activities` order hashed:

| Scenario | master | branch |
|---|---|---|
| fresh database each start (favorites from `env/test.ini`) | 6 different orders (hashes `b75bbf3e cd7e763a a6a99552 25704562 eb1b12dd 0a3e80e9`) | 1 hash `d8c54f3c` in all 6 runs |
| saved favorites (3 favorites saved through the API, DB kept) | identical in 6 runs (`c875972f`) | identical in 6 runs (`9dba0812`) |

On master the saved order was already stable (it is read from the database); the bug is only on a fresh database or for activities not yet saved. The branch is stable in both.

## 8. CI: PASS (static)

Parsed `.github/workflows/test.yml` with PyYAML (valid) and read it:
- Jobs `test` (unchanged) and `e2e`; `e2e` has the `mongo:8.0` service on 27017. The harness uses `127.0.0.1:27017` when `MONGOD_BIN` is unset (read `test/e2e/harness.js`), `CHROMIUM_PATH` unset gives Playwright's own browser.
- Step order: checkout, setup-node, clone client, `npm ci`, `npx playwright install --with-deps chromium`, `npm run test:e2e`, compare, upload.
- Compare step has `if: always()` **and** `continue-on-error: true`, so it can neither be skipped by a failed suite nor fail the job.
  I ran `node test/e2e/compare.js` both ways: with screenshots present exit 0; with the screenshots folder missing exit 2 (still harmless because of `continue-on-error`).
- Upload: `actions/upload-artifact@v4`, `if: always()`, path `test-results/` (screenshots, compare report), `if-no-files-found: ignore`.
- `timeout-minutes: 30` vs 7.6 min measured. `grep` finds no `toHaveScreenshot`/`toMatchSnapshot` in `test/e2e/*.js`, so pixel differences cannot fail the suite.
- Limits: I could not run Actions, so the runner itself (install with deps, service networking) is untested. Expect font differences in the compare report on the runner, as the report says.

## 9. N8 drag: PASS for the requested checks, D1 (Low) found

Fixture client (6 cards), all activities made favorites first (the dashboard only saves checked favorites, see N3), real mouse: press on the handle centre, move to the **centre of the target card**, release; each move then checked after a page reload.

- Second-to-last card one place down onto the last place: master **fails** (card does not move, no POST is sent); branch **works**. Last card one place up: works on both.
- 30-move matrix (all 6x5 pairs): master 29/30 (only `5->6` fails), **branch 30/30**. No other move regressed. Per-move results are identical except `5->6`.
- Long list (real client, 61 cards, normal 1280x800 viewport, the page scrolled so both cards are visible): moves `10<->11`, `30<->31`, `59<->60`, `60<->61`, `61->60`, `1<->2`: 10/10 on both master and branch.
- Drag of card 1 to the bottom edge with auto-scroll held 3 s: lands at place 10 on both.

### D1 (Low): `containment: 'document'` breaks drags lower in a long list when the viewport is tall and the page is not scrolled

- Reproduction (real client, 61 activities, all favorites): Chromium viewport 1280x2400 (or 4400, or 7000), open `/dashboard/activities` unscrolled, drag card 30 (handle at y≈1952) to the centre of card 31 (y≈2002) with the real mouse (press, 20 small moves, release).
- Master: the order changes and a POST `/api/v1/activities` is sent. Branch: **no change, no POST**. Same for 31→30 and 59→60, 60→59, 61→60; 1→61 on the branch ends at place 4 instead of 61. (In the same setup master only fails the known N8 move `60->61`.)
  Moves near the top (10→11, 1↔2, 61→1) still work on both.
  Viewport 1280x4400 (and 7000), set `10→11, 30→31, 31→30, 59→60, 60→61, 61→60`: master 5/6 (only `60→61` fails), branch 1/6 (only `10→11` works).
- Cause (measured on the branch): the page scrolls inside the layout, not the window, so `$(document).height()` equals the viewport height (800 in an 800 px window, 2400 in a 2400 px window) while the list is 3667 px tall. `containment: 'document'` therefore confines the dragged card to the viewport-sized box. With the normal scroll-into-view workflow this is not visible (see above), so impact is limited to very tall viewports (4K portrait, zoomed-out browser) with long lists.
- Suggestion, not done (tester): contain to the scroll container or the list's box with a bottom margin, or keep `containment: 'parent'` and fix N8 with a different option (e.g. `tolerance: 'pointer'` was said not to work).
- Not covered: the charts list (`containment: 'parent'` unchanged, same symptom likely, as the report says).

## Other observations (not defects of this branch, nothing blocking)

- N1: `?lang=es` alone only switches the server texts (toasts); the page labels follow the navbar selector / `localStorage.languageSelection`. Same on master.
- N2: de-CH time shows `0:30` (hour not zero-padded); the usual de-CH form is `00:30`. Cosmetic. The `Intl` reference output is `00:30`.
- N3: dragging reorders only checked favorites in the saved list (`updateActivities()` posts `favoriteActivities:checked` only): the reorder of non-favorite cards is not saved, on master too. I had to favorite all activities for the matrix, as the e2e harness does.
- N4: `spanish-nav=Español (Espanol)` and `spanish=Espanol` (missing ñ) in `locales.ini`, present on master.
- N5: `?limit=2&offset=500` gives `prev_page` `offset=498` (beyond the end), on master too; the same for the 3 lists and the deliveries.
- N6: The Edit link of an assignment that was already launched did not accept my click in a script (the form pages opened fine for a new assignment). Same on master, not investigated.

## Environment

MongoDB 8.0.23 from conda-forge (outside the repo); `MONGOD_BIN=<scratch>/mongo/pkg/bin/mongod`, `CHROMIUM_PATH=/opt/pw-browsers/chromium`; client cloned to `../sugarizer`. All scratch scripts and databases were kept outside the repository.
