# Data Model — PostgreSQL 16 + PostGIS

Source of truth: [`prisma/schema.prisma`](../../prisma/schema.prisma) and [`prisma/migrations/`](../../prisma/migrations).

## Entity-relationship diagram

```mermaid
erDiagram
  USERS ||--o| LANDLORD_PROFILES : has
  USERS ||--o{ LISTINGS : owns
  USERS ||--o{ FAVORITES : saves
  USERS ||--o{ SAVED_SEARCHES : keeps
  USERS ||--o{ TOUR_REQUESTS : requests
  USERS ||--o{ REPORTS : files
  USERS ||--o{ AUDIT_LOG : acts
  CITIES ||--o{ NEIGHBORHOODS : contains
  CITIES ||--o{ LISTINGS : locates
  NEIGHBORHOODS ||--o{ LISTINGS : locates
  LISTINGS ||--o{ LISTING_PHOTOS : has
  LISTINGS ||--o{ FLOOR_PLANS : has
  LISTINGS ||--o{ LISTING_AMENITIES : has
  AMENITIES ||--o{ LISTING_AMENITIES : tags
  LISTINGS ||--o{ FAVORITES : saved_in
  LISTINGS ||--o{ TOUR_AVAILABILITY : offers
  LISTINGS ||--o{ TOUR_EXCEPTIONS : blocks
  LISTINGS ||--o{ TOUR_REQUESTS : receives
  LISTINGS ||--o{ REPORTS : reported_in
  CONVERSATIONS ||--o{ MESSAGES : contains

  USERS { uuid id PK; text cognito_sub UK; text email UK; text phone; text full_name; enum role; bool is_verified; bool is_banned }
  LANDLORD_PROFILES { uuid user_id PK,FK; text business_name; enum verification_status; text verification_doc_key; int response_rate }
  CITIES { int id PK; text name; text name_ne; text slug UK; text province; text district; geography centroid; bool is_active }
  NEIGHBORHOODS { int id PK; int city_id FK; text name; text slug; geography centroid }
  LISTINGS { uuid id PK; uuid landlord_id FK; text slug UK; enum status; int rent_npr; int bedrooms; geography location; bool location_is_approximate; tsvector search_vector; text_array tenant_types; text_array water_supply }
  LISTING_PHOTOS { uuid id PK; uuid listing_id FK; text s3_key; text media_key; int sort_order; bool is_cover; enum status }
  FLOOR_PLANS { uuid id PK; uuid listing_id FK; text s3_key; text media_key; enum file_type }
  AMENITIES { int id PK; text code UK; text label; text label_ne; enum category }
  LISTING_AMENITIES { uuid listing_id PK,FK; int amenity_id PK,FK }
  FAVORITES { uuid user_id PK,FK; uuid listing_id PK,FK }
  SAVED_SEARCHES { uuid id PK; uuid user_id FK; jsonb filters; enum alert_frequency }
  TOUR_AVAILABILITY { uuid id PK; uuid listing_id FK; int day_of_week; text start_time; text end_time }
  TOUR_EXCEPTIONS { uuid id PK; uuid listing_id FK; date date }
  TOUR_REQUESTS { uuid id PK; uuid listing_id FK; uuid renter_id FK; jsonb requested_slots; timestamptz confirmed_slot; enum status; text contact_phone; text idempotency_key }
  REPORTS { uuid id PK; uuid listing_id FK; uuid reporter_id FK; enum reason; enum status }
  AUDIT_LOG { uuid id PK; uuid actor_id FK; text action; text entity; text entity_id; jsonb metadata }
  CONVERSATIONS { uuid id PK; uuid listing_id; uuid renter_id; uuid landlord_id }
  MESSAGES { uuid id PK; uuid conversation_id FK; uuid sender_id; text body }
```

## Conventions

- **Money:** `INT` NPR (no floats). DB `CHECK` constraints enforce `rent_npr > 0`, `deposit_npr >= 0`.
- **Time:** `timestamptz` in UTC; displayed in Asia/Kathmandu (UTC+05:45). Calendar-only values (`available_from`, exception dates) are `date`.
- **IDs:** UUID v4 for user-generated entities; integer serials for lookup tables.
- **Deletion:** cascades from users → listings → photos/tours/favourites, so "delete my account" removes everything a user owns. Reports and audit entries keep the record with the actor set to `NULL`.

## Spatial & search columns

| Column                                                               | Type                                                                              | Index              | Used by                                                                          |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------- |
| `listings.location`                                                  | `geography(Point,4326)`                                                           | GiST               | bbox (`&&`), radius (`ST_DWithin`), nearest (`ST_Distance`), duplicate detection |
| `listings.search_vector`                                             | `tsvector GENERATED ALWAYS AS (title A, landmark+street B, description C) STORED` | GIN                | keyword search, relevance sort                                                   |
| `listings.title`, `neighborhoods.name`                               | text                                                                              | GIN `gin_trgm_ops` | fuzzy matching                                                                   |
| `listings.tenant_types`                                              | `text[]`                                                                          | GIN                | overlap filter (`&&`)                                                            |
| `(status, city_id, rent_npr)`, `(status, property_type)`, `bedrooms` | —                                                                                 | B-tree             | filter/sort                                                                      |
| `(city_id, rent_npr, published_at DESC) WHERE status='published'`    | —                                                                                 | partial B-tree     | hot public search path                                                           |

Prisma models these columns as `Unsupported(...)`; they are read and written with parameterised `$queryRaw` / `$executeRaw` tagged templates in `src/server/repositories/`.

## Migrations

| Migration                       | Purpose                                                                                        |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| `20261115000000_init`           | Extensions (postgis, pg_trgm), all tables, enums, indexes, generated column, check constraints |
| `20261116000000_reference_data` | Launch cities, neighbourhoods and amenities (idempotent `ON CONFLICT DO NOTHING`)              |

Workflow for schema changes: `pnpm db:migrate:new --name <change>`, then review the generated SQL (Prisma cannot model generated columns or partial indexes, so watch for unwanted `DROP`s), commit it, and apply with `pnpm db:migrate`. Production applies migrations on container start under Prisma's advisory lock.
