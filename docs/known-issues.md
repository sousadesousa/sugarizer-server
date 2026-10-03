# Known issues and follow-ups

Open items found while testing the 2026 cleanup rounds. None of them block the
branches that were tested. Remove an item once it is fixed.

## Dashboard

- **Drag to reorder (N8).** In the activities list, dragging a card onto the
  last card does not move it, because `containment: 'parent'` in
  `dashboard/public/js/main.js` keeps the dragged card inside the list.
  `containment: 'document'` fixes that move but breaks drags further down a long
  list when the page is not scrolled, so it was reverted. A fix should contain
  the drag to the scroll container instead. The charts list probably has the
  same problem.
- **Only favorites are saved when reordering (N3).** `updateActivities()` posts
  only the checked favorites, so a reorder of non-favorite cards is lost.
- **Time format (N2).** With the de-CH locale, times show `0:30` instead of
  `00:30`.
- **Language from the URL (N1).** `?lang=es` alone only switches the server
  messages. The page labels follow the navbar selector
  (`localStorage.languageSelection`).
- **Missing ñ (N4).** `spanish-nav` and `spanish` in `locales.ini` read
  "Espanol" instead of "Español".
- **Paging past the end (N5).** `?limit=2&offset=500` gives a `prev_page` link
  with `offset=498`, which is beyond the end. This affects the users,
  classrooms, assignments and deliveries lists.
- **Edit link of a launched assignment (N6).** A scripted click on it did not
  open the form. Not investigated.

## Raspberry Pi / Docker

- **Not tested on real hardware.** Run the checklist in
  [raspberry-pi.md](raspberry-pi.md) on a Pi 5 and record the results.
- **Standalone image on ARM.** `docker/Dockerfile-standalone` builds the client
  in the image. Its `canvas` dependency may not build on arm64. That build runs
  only on manual dispatch (`multiarch-standalone` job in
  `.github/workflows/docker.yml`).
