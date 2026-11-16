# Accessibility Report — WCAG 2.1 AA

## Automated (every CI run)

`tests/e2e/a11y.spec.ts` runs **axe-core** with the `wcag2a`, `wcag2aa`, `wcag21a` and `wcag21aa` rule sets on Home, Search (city page), Login, Help, Privacy and a Listing detail page. The build fails on any **serious** or **critical** violation.

**Result (16 Nov 2026): 0 serious/critical violations on all 6 pages.**
Issue found and fixed during the audit: invalid `<dl>` structure (icons/divs between `dt`/`dd`) on listing facts and dashboard tiles (`definition-list`, `dlitem`).

## Built-in practices

| Practice             | Implementation                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Skip link            | "Skip to content" as the first focusable element (`app/layout.tsx`)                                                                                          |
| Landmarks & headings | `header`, `nav[aria-label]`, `main#main`, `footer`; one `h1` per page, logical `h2`/`h3`                                                                     |
| Forms                | Every control has a `<label>`; errors use `role="alert"` and are linked through `aria-describedby`; `aria-invalid` on invalid fields; required fields marked |
| Native controls      | Native `<select>`, checkboxes and date inputs → screen-reader and mobile-keyboard friendly                                                                   |
| Toggles              | Filter chips, hearts and time slots expose `aria-pressed`                                                                                                    |
| Live regions         | Result counts, upload progress, gallery position use `aria-live="polite"`                                                                                    |
| Images               | Meaningful `alt` (caption → room label → title); decorative icons `aria-hidden`                                                                              |
| Keyboard             | All actions reachable by keyboard; photo reordering has up/down buttons (not drag-only); dialogs and sheets trap focus (Radix)                               |
| Focus                | Visible focus rings (`focus-visible:ring`)                                                                                                                   |
| Colour               | Brand crimson `oklch(0.5 0.19 25)` on white passes AA for text and buttons; status badges pair colour with text                                              |
| Motion               | No auto-playing carousels                                                                                                                                    |
| Language             | `<html lang="en">`; Nepali names marked `lang="ne"`                                                                                                          |
| Maps                 | Map content duplicated as accessible text (address, list view); "List" view is the default                                                                   |

## Manual checklist (run before each release)

- [ ] Keyboard-only: search → open listing → request tour → sign out
- [ ] VoiceOver (iOS Safari) and TalkBack (Android Chrome): listing page reading order, gallery, tour panel
- [ ] NVDA + Firefox: landlord listing form errors announced
- [ ] 200% zoom and 320 px width: no horizontal scroll or clipped controls
- [ ] Reduced-motion and high-contrast modes usable

## Known limitations

- The Leaflet map itself is excluded from axe scans; it is supplementary (the list view and address text carry the same information). Pins are keyboard-focusable markers with titles.
