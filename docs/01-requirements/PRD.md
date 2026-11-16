# Product Requirements Document (PRD) — GharKhoj v1.0

|                  |                                         |
| ---------------- | --------------------------------------- |
| **Product**      | GharKhoj — rental marketplace for Nepal |
| **Version**      | 1.0 (MVP)                               |
| **Status**       | Built — ready for AWS deployment        |
| **Owner**        | Mohan Thapa                             |
| **Last updated** | 16 November 2026                        |

## 1. Problem

Finding a rental in Nepal mostly happens through Facebook groups, brokers (who charge a commission of up to one month's rent), handwritten "To-Let" signs and word of mouth. Renters can't compare prices, don't know about water supply or power backup until they visit, and are exposed to deposit scams. Landlords have no structured way to describe their property, show its location or manage visit requests.

## 2. Vision

> A trustworthy, mobile-first marketplace where anyone in Nepal can find a room, flat or house in minutes — with real photos, a map location, the details that matter locally (water, power backup, tenant preferences) — and book a visit without a broker.

## 3. Goals and success metrics

| Goal                                 | Metric (first 6 months after launch)                                                         |
| ------------------------------------ | -------------------------------------------------------------------------------------------- |
| Renters find relevant places quickly | Median time from landing to first listing view < 60 s; ≥ 30% of sessions use a filter        |
| Landlords list easily                | ≥ 70% of started listings get submitted; median creation time < 10 min                       |
| Visits happen through the platform   | ≥ 15% of listing views → tour request; ≥ 60% of requests get a landlord response within 24 h |
| Trust                                | < 1% of published listings removed for fraud; every report triaged within 48 h               |
| Works on Nepali mobile networks      | LCP < 2.5 s on mid-range Android over 3G/4G                                                  |

## 4. Personas

| Persona                                    | Description                                                           | Key needs                                                                                              |
| ------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Anisha — renter (student/professional)** | 24, moving to Kathmandu for work, mostly on a mid-range Android phone | Filter by budget, area, "students/bachelors allowed"; trust that listings are real; book visits easily |
| **Karki family — renter (family)**         | Looking for a 2–3BHK near a school, with parking                      | Water supply, power backup, family-friendly, map near school                                           |
| **Sita — landlord (owner)**                | Owns a 4-storey house, rents 2 flats, not very technical              | Simple form in plain language, photos from phone, control who visits and when                          |
| **Ram — property manager**                 | Manages 10+ rooms/flats in Pokhara & Chitwan                          | Dashboard of all listings, quick status changes, tour inbox                                            |
| **Admin — trust & safety**                 | GharKhoj staff                                                        | Review queue with scam signals, handle reports, verify landlords, audit trail                          |

## 5. Scope

### In scope (v1)

- Listings with Nepal-specific fields (utilities, tenant types, ward/tole/landmark), photos, floor plans, amenities, map pin with privacy option
- Moderation workflow (draft → review → published → paused/rented/archived)
- Search: filters, sort, pagination, URL-driven state, list + map view, radius/area search, SEO city/neighbourhood/type pages
- Listing detail with gallery, map, amenities, similar listings, share, report
- Accounts via Amazon Cognito; roles renter / landlord / admin
- Favourites, saved searches (storage), recently viewed
- Tour scheduling with landlord availability, email notifications, reminders, calendar file
- Admin console: moderation, reports, verification, users, lookup data, metrics, audit log
- AWS deployment with CI/CD, monitoring and cost guardrails

### Out of scope (v1) — see roadmap (Phase 10)

In-app messaging, saved-search email alerts (sending), multi-unit buildings, Nepali-language UI, offline/PWA, payments (featured listings via eSewa/Khalti), virtual tours, Bikram Sambat date display, PDF floor-plan thumbnails.

## 6. User stories & acceptance criteria

### Renter / visitor

| ID    | Story                                                                                                           | Acceptance criteria                                                                                                                |
| ----- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| US-01 | As a visitor I can search rentals by city, neighbourhood and keyword                                            | Results show only published listings; city + neighbourhood + keyword combine; URL reflects filters                                 |
| US-02 | I can filter by price, type, beds, baths, furnishing, amenities, tenant type, pets, parking, move-in date, area | Each filter narrows results; "Clear all" resets; refresh/share keeps filters                                                       |
| US-03 | I can sort by newest, price, relevance, nearest                                                                 | Order is correct; "nearest" available when a point is chosen                                                                       |
| US-04 | I can switch to a map, see clustered price pins and search the visible area                                     | Pins cluster; "Search this area" appears only after I move the map; results update                                                 |
| US-05 | I can search within 2–3 km of a point or "near me"                                                              | Results limited by distance and sorted nearest-first                                                                               |
| US-06 | I can view a listing with photos, facts, utilities, rules, amenities, floor plans, map                          | Approximate locations never reveal exact coordinates; JSON-LD present                                                              |
| US-07 | I can save a listing to favourites                                                                              | Requires sign-in; heart state persists; favourites page lists them                                                                 |
| US-08 | I can request a tour choosing up to 3 times                                                                     | Only bookable times offered (landlord windows, ≥2 h ahead, not taken); landlord gets an email; duplicate submissions are prevented |
| US-09 | I see the landlord's phone and exact address only after the tour is confirmed                                   | Verified by API and UI                                                                                                             |
| US-10 | I can cancel a tour or accept a new time the landlord proposed                                                  | State machine enforces allowed transitions                                                                                         |
| US-11 | I can add a confirmed tour to my calendar                                                                       | `.ics` downloads with correct Nepal-time event                                                                                     |
| US-12 | I can report a suspicious listing                                                                               | One open report per user per listing; rate limited                                                                                 |
| US-13 | I can delete my account                                                                                         | All my personal data and owned content are removed                                                                                 |

### Landlord

| ID    | Story                                                                                 | Acceptance criteria                                                     |
| ----- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| US-20 | I can create a listing with all property, utility, policy and address details         | Validation messages per field; saved as draft                           |
| US-21 | I can place a draggable map pin or search a landmark                                  | Pin stored as PostGIS point; "approximate" toggle respected publicly    |
| US-22 | I can upload, reorder, caption and choose a cover photo; upload floor plans           | Direct-to-S3 upload with progress; EXIF GPS stripped; 25-photo limit    |
| US-23 | I can submit for review and see why if rejected                                       | Submission needs ≥1 photo + map pin; rejection reason shown and emailed |
| US-24 | I can pause, resume, mark rented, archive, relist, duplicate or delete                | Only valid transitions offered; rented/paused listings leave search     |
| US-25 | I can set weekly tour availability and blocked dates                                  | Slots offered to renters follow these rules                             |
| US-26 | I can confirm, decline or propose another time for tour requests, and record outcomes | Emails sent; double-booking prevented                                   |
| US-27 | I see views, saves and pending tour requests                                          | Dashboard numbers match data                                            |
| US-28 | I can upload a citizenship/ownership document to get verified                         | Document stays private; admin decision emailed; badge shown             |

### Admin

| ID    | Story                                                     | Acceptance criteria                                                     |
| ----- | --------------------------------------------------------- | ----------------------------------------------------------------------- |
| US-40 | I can approve or reject pending listings with a reason    | Oldest first; scam signals and duplicates highlighted; landlord emailed |
| US-41 | I can resolve reports and take down listings              | Takedown removes from search; audit-logged                              |
| US-42 | I can verify landlords by viewing their document securely | 5-minute signed link; each view audit-logged                            |
| US-43 | I can search users, change roles and ban/unban            | Can't ban self/admins; banned landlord's listings paused                |
| US-44 | I can manage cities, neighbourhoods and amenities         | Changes appear in forms/filters (cache revalidated)                     |
| US-45 | I can see platform metrics and an audit log               | Counts by status/role; last 200 audit entries                           |

## 7. Non-functional requirements (summary)

Mobile-first; LCP < 2.5 s on mid-range Android; WCAG 2.1 AA; SEO (SSR, sitemap, canonical, structured data); OWASP Top 10 controls; encryption in transit and at rest; PII minimisation; structured logs, alarms on 5xx/latency; monthly cost guardrail. Details in [SRS](SRS.md#3-non-functional-requirements).

## 8. Release criteria (Definition of Done, CLAUDE.md §11)

A landlord can sign up, create a listing with map pin, photos, floor plan and amenities and submit it; an admin approves it; a visitor finds it via filters on list and map views; a renter signs in, favourites it and requests a tour; the landlord confirms and both receive email — all running on AWS with CI/CD, monitoring and documented architecture.

✅ Automated by `tests/e2e/mvp-flow.spec.ts` (passes locally against a production build). AWS deployment is prepared and verified with `cdk synth` + infrastructure tests; the live deploy is a one-command step (see [deployment guide](../05-operations/deployment-guide.md)).
