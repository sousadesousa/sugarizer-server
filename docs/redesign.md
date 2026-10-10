# Dashboard redesign

The dashboard has the new look of the Sugarizer redesign (light surfaces, dark ink, Lexend and Atkinson Hyperlegible, 44px targets, rounded corners). The legacy sheet `dashboard/public/css/main.css` is still loaded first; the redesign is a layer loaded after the CSS of the widgets, so each rule replaces the one of `main.css` or of the widget with the same selector. No id, class, `data-l10n-id`, form field name or script of the pages was changed.

## Files (`dashboard/public/css/redesign/`)

| File | What it is |
|---|---|
| `tokens.css`, `fonts/` | Colours, fonts, radii, shadows (same values as the client, `css/tokens.css`) and the bundled Lexend and Atkinson Hyperlegible fonts (open font licence, texts in `fonts/OFL-*.txt`). Nothing is loaded from the network. |
| `shell.css` | Page, light sidebar (248px), top bar, language selector, dropdown menus, the sidebar sliding in on small screens. |
| `components.css` | Cards (16px radius), buttons (secondary by default, primary for submit buttons and the add buttons), fields (46px), check boxes, tables, modal, toasts. |
| `widgets.css` | select2, multi-select, datetimepicker, the driver.js tutorial, the Pace loader. |
| `sidebar-icons.css` | The line icons of the sidebar, drawn as masks in the colour of the text. |
| `page-<group>.css` | Rules of one group of pages: home, users, classrooms, journals (also activities), assignments, stats, auth (login, second factor, page not found). |

The links are in `dashboard/views/includes/header.ejs`, after the CSS of the widgets.

## Rules to keep

- Colours and sizes come from the tokens. Colours set by script or by an inline `style` can only be replaced with `!important`: each use has a comment saying which one it beats.
- The sortable lists (`ol.simple_with_animation`, activities and charts) keep the padding and margins of `main.css`. Their items must stay lower than 74px (the rows are 56px for the activities and 50px for the charts): from 74px on, the dragged item cannot be dropped at the last place.
- Screenshots: `npm run test:e2e:baseline` writes the screenshots of `test/e2e/baseline`; `npm run test:e2e:compare` compares a run to them.
- The contrast test (`dashboard.spec.js`) measures toasts, the active menu item and the icons of the round buttons against their real background.

## Checked

167 end-to-end tests (desktop, tablet and phone, admin and teacher) and the 193 API tests pass. Not checked: a Docker image build (no Docker daemon in the work environment: the image copies the whole folder, so the new files are included), a student account, real touch devices.
