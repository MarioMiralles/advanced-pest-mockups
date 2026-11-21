# Advanced Pest Solutions: homepage concepts

Four static homepage mockups for a redesign of [advancedpestsolutions.net](https://www.advancedpestsolutions.net/)
(South Florida pest control, family owned since 1993), plus a gallery page that links them. Each concept is a
single homepage with a demo free-inspection form and the SiteStaffr chat widget mock. Nothing is sent.

| Path | Concept |
| --- | --- |
| `index.html` | Gallery of all four concepts |
| `field-report/` | 1 · Field Report: the page as a pest inspection report, live pest checklist that fills the request form |
| `since-1993/` | 2 · Since 1993: warm and family first, Charlie and Natalie up front, full EN/ES switch |
| `field-guide/` | 3 · Field Guide: naturalist field guide, fine-line pest plates that open into entries |
| `swarm-season/` | 4 · Swarm Season: dark and bold, big tap-to-call, zip code checker, pest calendar |

## Notes

- Photos, logo, phone, services, the Inspect · Correct · Protect method and the three reviews come from the current site.
- Text in `[brackets]` (license number, hours, email) is for the owner to supply. Pest facts and the calendar are
  general South Florida guidance.
- `assets/chat.js` is the SiteStaffr widget mock, configured per page with `data-*` attributes.
  `assets/motion.*` is the shared scroll motion.
- Pages carry `noindex`. Fonts load from Google Fonts; everything else is inline.
- Built with the `site-mockups` skill; `python3 ~/.claude/skills/site-mockups/check.py .` checks every concept
  at 1440 and 390 wide and retakes the gallery shots.

## Viewing

Plain HTML, no build step. Open `index.html`, or `python3 -m http.server` from this folder.
Published with GitHub Pages from the `main` branch root.
