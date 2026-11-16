# Roadmap

| Status   | Item                                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| ✅ v1.0  | Phases 0–9 of CLAUDE.md §10 (foundation → polish)                                                                                    |
| ⏭ Launch | First AWS deploy, custom domain + ACM (HTTPS to origin), SES production access, CloudWatch Synthetics canary, real-device Lighthouse |
| Phase 10 | In-app messaging (tables already exist) with email fallback                                                                          |
| Phase 10 | Saved-search email alerts (daily/weekly job via EventBridge, reuse search service)                                                   |
| Phase 10 | Nepali language (`ne.json`, locale switcher, Devanagari fonts) and Bikram Sambat date display                                        |
| Phase 10 | PWA: installable, offline shell, cached favourites                                                                                   |
| Phase 10 | Multi-unit buildings (parent property with several units)                                                                            |
| Phase 10 | Featured listings with eSewa / Khalti / Fonepay payments                                                                             |
| Phase 10 | Virtual tour link, PDF floor-plan previews, AVIF variants                                                                            |
| Scale    | RDS read replica, OpenSearch, Redis (shared rate limits, sessions), Multi-AZ                                                         |
