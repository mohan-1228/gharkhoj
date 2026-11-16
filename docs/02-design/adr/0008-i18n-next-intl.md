# ADR-0008: next-intl, English first, Nepali-ready

**Status:** Accepted · **Date:** 2026-11-15

## Decision

- UI strings live in `src/messages/en.json` via `next-intl`; `ne.json` exists as a placeholder copy awaiting translation.
- No locale prefix in URLs for v1. Adding Nepali means translating `ne.json` and resolving the locale from a cookie or `Accept-Language` in `src/i18n/request.ts`.
- Domain data already stores Nepali names (`name_ne`, `label_ne`) and renders them with `lang="ne"`.
- Formatting is Nepal-specific: lakh/crore digit grouping, `Rs.`, ropani-aana-paisa-daam, Asia/Kathmandu time, Nepali mobile validation.

## Consequences

- ⚠️ Some component strings are still inline English; moving them into message files is part of the Phase 10 "Nepali language" item.
