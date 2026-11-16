# REST API Reference — `/api/v1`

Base URL: `https://<app-domain>/api/v1` (local: `http://localhost:3000/api/v1`). All bodies are JSON and every input is validated with Zod (`src/schemas/`).

## Conventions

| Topic       | Rule                                                                                                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Auth        | Session cookie `gk_session` (httpOnly). Endpoints marked 🔒 need a signed-in user; the role is shown in brackets.                                                                                      |
| CSRF        | Non-GET requests must come from the app's own origin (checked against the `Origin` header / `Sec-Fetch-Site`).                                                                                         |
| Errors      | `{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details": { "fields": [{ "path": "rentNpr", "message": "…" }] } } }`                                                                        |
| Error codes | `BAD_REQUEST` 400 · `UNAUTHENTICATED` 401 · `FORBIDDEN` 403 · `NOT_FOUND` 404 · `CONFLICT` / `INVALID_STATE` 409 · `VALIDATION_ERROR` 422 · `RATE_LIMITED` 429 · `INTERNAL` 500 (includes `requestId`) |
| Tracing     | Every response has `x-request-id`; it is also in the server logs.                                                                                                                                      |
| Pagination  | `?page=&limit=` → `{ items, total, page, pageSize, pages, nextCursor }`                                                                                                                                |
| Idempotency | `POST /tours` accepts an `Idempotency-Key` header; retries return the original request (`200`) instead of creating a duplicate (`201`).                                                                |
| Time        | Timestamps are ISO-8601 UTC. Tour slots are UTC instants; the UI displays them in Nepal time (UTC+05:45).                                                                                              |

## Health

| Method | Path          | Description                                                                          |
| ------ | ------------- | ------------------------------------------------------------------------------------ |
| GET    | `/api/health` | `{ status, db, version }`; `503` if the DB is down (used by ALB, ECS, CD smoke test) |

## Listings — public

| Method | Path                                                | Description                                                                                                                                                                                                                                                                                                                                            |
| ------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/listings`                                         | Search. Query: `q, city, neighborhood, type (csv), minPrice, maxPrice, beds, baths, furnishing (csv), amenities (csv, ALL must match), tenant (csv, ANY), pets, parking, availableBy, minArea, maxArea, bbox=south,west,north,east, lat, lng, radiusKm, sort=newest\|price_asc\|price_desc\|relevance\|nearest, page, limit≤50`. Cached `s-maxage=60`. |
| GET    | `/listings/map`                                     | Same filters → up to 500 lightweight pins `{ id, slug, title, rentNpr, bedrooms, location, image }`                                                                                                                                                                                                                                                    |
| GET    | `/listings/:slug`                                   | Listing detail. Unpublished listings are visible only to the owner and admins. Approximate locations are offset by the server.                                                                                                                                                                                                                         |
| GET    | `/listings/:id/slots`                               | Bookable tour slots for 14 days: `{ days: [{ date, slots: [iso…] }] }`                                                                                                                                                                                                                                                                                 |
| GET    | `/listings/:id/availability`                        | Weekly windows + blocked dates                                                                                                                                                                                                                                                                                                                         |
| GET    | `/cities` · `/neighborhoods?cityId=` · `/amenities` | Lookup data (cached 5 min browser / 1 h CDN)                                                                                                                                                                                                                                                                                                           |
| GET    | `/geocode?q=&lat=&lng=`                             | Nepal-only address/landmark search (proxied Nominatim; 20 req/min per IP)                                                                                                                                                                                                                                                                              |

## Listings — landlord 🔒 [landlord, admin]

| Method | Path                         | Body / notes                                                                                                                                                                                                                                          |
| ------ | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/listings`                  | Create draft. Body = `createListingSchema` (title, description, propertyType, rentNpr, depositNpr, availableFrom, bedrooms, bathrooms, cityId, neighborhoodId, latitude, longitude, amenityCodes[], utilities, policies…). `201 { id, slug, status }` |
| PATCH  | `/listings/:id`              | Partial update (owner/admin). Title or description changes on a published listing return `status: pending_review`.                                                                                                                                    |
| DELETE | `/listings/:id`              | Permanently delete (cascades; S3 objects cleaned up). `204`                                                                                                                                                                                           |
| POST   | `/listings/:id/submit`       | Submit for review. `409 INVALID_STATE { problems: [...] }` if not ready (no photo / no map pin).                                                                                                                                                      |
| POST   | `/listings/:id/status`       | `{ action: pause \| resume \| mark_rented \| archive \| relist }`                                                                                                                                                                                     |
| POST   | `/listings/:id/duplicate`    | Copy into a new draft (without photos)                                                                                                                                                                                                                |
| GET    | `/landlord/listings`         | My listings with counts (favourites, pending tours)                                                                                                                                                                                                   |
| GET    | `/landlord/stats`            | Dashboard numbers                                                                                                                                                                                                                                     |
| PUT    | `/listings/:id/availability` | `{ windows: [{ dayOfWeek 0–6, startTime "HH:mm", endTime }], exceptions: [{ date "YYYY-MM-DD", note? }] }`                                                                                                                                            |

### Media

| Method | Path                                     | Notes                                                                                                                                                                                                  |
| ------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| POST   | `/uploads/presign`                       | `{ kind: photo\|floor_plan\|verification_doc, listingId?, contentType, size }` → `{ url, fields, key }` (presigned POST, 5 min). Limits: photos JPG/PNG/WebP ≤ 10 MB; floor plans JPG/PNG/PDF ≤ 15 MB. |
| POST   | `/listings/:id/photos`                   | Register an uploaded photo `{ key, caption?, roomLabel? }` → photo with `urls { sm, md, lg }` when ready                                                                                               |
| PATCH  | `/listings/:id/photos`                   | Reorder/caption/cover `{ photos: [{ id, caption?, roomLabel? }] (new order), coverId? }`                                                                                                               |
| DELETE | `/listings/:id/photos/:photoId`          | Remove (next photo becomes cover if needed)                                                                                                                                                            |
| POST   | `/listings/:id/floor-plans`              | Register `{ key, label? }`                                                                                                                                                                             |
| DELETE | `/listings/:id/floor-plans/:floorPlanId` | Remove                                                                                                                                                                                                 |
| POST   | `/landlord/verification`                 | Submit an uploaded verification document `{ key }` (must be under `private/verification/<myId>/`)                                                                                                      |

## Accounts 🔒

| Method               | Path                                                          | Notes                                                                                |
| -------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| GET                  | `/api/v1/auth/login?returnTo=&role=renter\|landlord&signup=1` | Starts the Cognito Hosted UI flow (redirect)                                         |
| GET                  | `/api/v1/auth/callback`                                       | OAuth callback (Cognito → app)                                                       |
| POST                 | `/auth/logout`                                                | Clears the session → `{ redirect }` (Cognito logout URL in production)               |
| POST                 | `/auth/dev-login`                                             | **Local development only** (`AUTH_MODE=dev`): `{ email, fullName?, role? }`          |
| GET / PATCH / DELETE | `/me`                                                         | Profile; update `{ fullName, phone?, businessName?, bio? }`; delete account and data |
| POST                 | `/me/become-landlord`                                         | Switch renter → landlord                                                             |
| GET                  | `/favorites` · `/favorites/ids`                               | Favourite cards / ids only                                                           |
| POST / DELETE        | `/favorites/:listingId`                                       | Add / remove (idempotent)                                                            |
| GET / POST           | `/saved-searches`                                             | List / create `{ name, filters, alertFrequency: none\|daily\|weekly }` (max 20)      |
| DELETE               | `/saved-searches/:id`                                         | Remove                                                                               |

## Tours 🔒

| Method | Path                      | Notes                                                                                                                                                                           |
| ------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/tours`                  | Renter request `{ listingId, slots: [iso] (1–3), message?, contactPhone }` + `Idempotency-Key` header. 10/hour per IP.                                                          |
| PATCH  | `/tours/:id`              | `{ action: confirm (slot) \| decline (note?) \| reschedule (slot, note?) \| cancel \| complete \| no_show }`. Permissions depend on whether you are the renter or the landlord. |
| GET    | `/tours/mine`             | Renter's tours (landlord phone and address included only once confirmed)                                                                                                        |
| GET    | `/landlord/tours?status=` | Landlord inbox (actionable first)                                                                                                                                               |
| GET    | `/tours/:id/ics`          | Calendar file for a confirmed tour (participants only)                                                                                                                          |

## Reports

| Method | Path       | Notes                                                                                                                               |
| ------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/reports` | `{ listingId, reason: scam\|inaccurate\|already_rented\|offensive\|duplicate\|other, details? }`. Anonymous allowed; 5/hour per IP. |

## Admin 🔒 [admin]

| Method | Path                                              | Notes                                                        |
| ------ | ------------------------------------------------- | ------------------------------------------------------------ |
| GET    | `/admin/review-queue`                             | Pending listings (FIFO) with trust flags                     |
| POST   | `/admin/listings/:id/approve`                     | Publish + email landlord                                     |
| POST   | `/admin/listings/:id/reject`                      | `{ reason }` (≥ 5 chars) + email                             |
| POST   | `/admin/listings/:id/takedown`                    | `{ reason }` — remove a live listing                         |
| GET    | `/admin/reports?status=open\|resolved\|dismissed` | Reports                                                      |
| POST   | `/admin/reports/:id/resolve`                      | `{ status: resolved\|dismissed, resolution?, pauseListing }` |
| GET    | `/admin/verifications`                            | Pending landlord verifications                               |
| GET    | `/admin/verifications/:userId/document`           | 302 to a 5-minute signed URL (audit-logged)                  |
| POST   | `/admin/verifications/:userId`                    | `{ decision: verified\|rejected, note? }`                    |
| GET    | `/admin/users?q=&role=`                           | Search users                                                 |
| POST   | `/admin/users/:id/ban` · `/admin/users/:id/role`  | `{ banned }` · `{ role }`                                    |
| POST   | `/admin/cities` · PATCH `/admin/cities/:id`       | Create city · `{ isActive }`                                 |
| POST   | `/admin/neighborhoods` · `/admin/amenities`       | Lookup data                                                  |
| GET    | `/admin/metrics` · `/admin/audit`                 | Platform metrics · latest audit entries                      |

## Internal (Lambda → app)

Authenticated with the `x-internal-secret` header (shared secret in Secrets Manager, compared in constant time). These endpoints are exempt from the browser CSRF check.

| Method | Path                        | Caller                                                                                            |
| ------ | --------------------------- | ------------------------------------------------------------------------------------------------- |
| POST   | `/internal/media-processed` | image-processor Lambda: `{ s3Key, status: ready\|rejected, mediaKey?, width?, height?, labels? }` |
| POST   | `/internal/tour-reminders`  | tour-reminders Lambda (every 15 min) → `{ sent }`                                                 |

## Example

```bash
curl "http://localhost:3000/api/v1/listings?city=lalitpur&type=apartment&maxPrice=40000&beds=2&sort=price_asc&limit=5"
```

```json
{
  "items": [
    {
      "id": "…",
      "slug": "2bhk-apartment-with-parking-jhamsikhel-000f",
      "title": "2BHK apartment with parking, Jhamsikhel",
      "rentNpr": 32000,
      "bedrooms": 2,
      "city": { "name": "Lalitpur", "slug": "lalitpur" },
      "location": { "lat": 27.6791, "lng": 85.3049, "approximate": true },
      "image": { "sm": "…/w320.webp", "md": "…/w640.webp" },
      "landlordVerified": true
    }
  ],
  "total": 3,
  "page": 1,
  "pageSize": 5,
  "pages": 1,
  "nextCursor": null
}
```
