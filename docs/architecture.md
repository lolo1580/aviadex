# Aviadex Architecture Proposal

## 1. System Architecture

Aviadex should use a modular monolith first, with clean architecture boundaries strong enough to split services later if scale requires it. This keeps early development simple while preserving long-term maintainability.

### Architectural Layers

1. **Presentation layer**
   - Web frontend.
   - API controllers.
   - Request validation.
   - Response serialization.
   - Authentication session handling.

2. **Application layer**
   - Use cases and workflows.
   - Permission checks.
   - Transaction orchestration.
   - Import/export coordination.
   - Photo upload orchestration.

3. **Domain layer**
   - Aircraft lifecycle rules.
   - Sighting rules.
   - Collection rules.
   - Historical integrity rules.
   - Domain entities and value objects.

4. **Data access layer**
   - PostgreSQL repositories.
   - Query builders.
   - Read models for search and map views.
   - Migration ownership.

5. **Infrastructure layer**
   - Object storage for photographs.
   - Authentication providers.
   - Email or notification services.
   - EXIF extraction workers.
   - Background jobs.
   - Observability.

### Recommended Runtime Components

- **Web application**: TypeScript frontend and backend.
- **API**: REST API under `/api/v1`, documented with OpenAPI.
- **Database**: PostgreSQL with UUID primary keys and foreign keys.
- **File storage**: S3-compatible object storage for original photos and derivatives.
- **Background worker**: Async processing for thumbnails, EXIF extraction, imports, and export jobs.
- **Search**: PostgreSQL full-text search initially; optional external search engine later.
- **Cache**: Optional Redis later for sessions, rate limits, and expensive read models.

### High-Level Data Flow

1. User creates or updates reference data such as manufacturer, model, variant, operator, squadron, air base, or event.
2. User creates a physical aircraft record tied to a variant.
3. Aircraft lifecycle changes are appended to dedicated history tables.
4. User records a sighting for an aircraft at a location, event, or air base.
5. User uploads photographs and links them to the sighting.
6. Background jobs extract EXIF metadata, create thumbnails, and update photo metadata.
7. Map, aircraft profile, collection, and search pages read from normalized tables plus optimized read queries.

### Core Design Decisions

- **Physical aircraft is the central aggregate** because registration, operator, country, squadron, livery, and status change over time.
- **Variant owns technical specifications** because specs are shared by all aircraft of the same variant.
- **History tables are append-only by default** to preserve lifecycle integrity.
- **Translations use separate translation tables** so English remains canonical while French and future languages can be added without schema rewrites.
- **Photos belong to sightings, not directly only to aircraft**, because a photo is evidence of a specific observation at a specific time and place.

## 2. Database Schema

All tables should use:

- `id uuid primary key`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- `deleted_at timestamptz null` for user-generated content where soft delete is appropriate

History tables should not use destructive updates for factual changes. Corrections should be auditable.

### Identity And Access

#### users

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| email | citext | Unique |
| display_name | text | Public display name |
| preferred_locale | text | Default `en` |
| role | user_role | `admin`, `curator`, `contributor`, `viewer` |
| created_at | timestamptz |  |
| updated_at | timestamptz |  |
| deleted_at | timestamptz | Soft delete |

#### auth_accounts

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| user_id | uuid | FK to `users.id` |
| provider | text | Password, OAuth provider, SSO provider |
| provider_account_id | text | Provider-side identifier |
| created_at | timestamptz |  |
| updated_at | timestamptz |  |

### Reference Geography

#### countries

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| iso2 | char(2) | Unique |
| iso3 | char(3) | Unique |
| default_name | text | English name |
| created_at | timestamptz |  |
| updated_at | timestamptz |  |

#### country_translations

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| country_id | uuid | FK to `countries.id` |
| locale | text | `fr`, future locales |
| name | text | Translated name |

Unique constraint: `(country_id, locale)`.

#### locations

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| name | text | English/default display name |
| country_id | uuid | FK to `countries.id` |
| latitude | numeric(9,6) | Nullable for approximate locations |
| longitude | numeric(9,6) | Nullable for approximate locations |
| location_type | location_type | Airport, air base, museum, city, coordinates, other |
| created_at | timestamptz |  |
| updated_at | timestamptz |  |

#### location_translations

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| location_id | uuid | FK to `locations.id` |
| locale | text |  |
| name | text |  |

### Aircraft Taxonomy

#### manufacturers

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| name | text | Canonical manufacturer name |
| country_id | uuid | FK to `countries.id`, nullable |
| founded_year | integer | Nullable |
| dissolved_year | integer | Nullable |
| created_at | timestamptz |  |
| updated_at | timestamptz |  |

#### manufacturer_translations

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| manufacturer_id | uuid | FK to `manufacturers.id` |
| locale | text |  |
| description | text | Optional translated description |

#### aircraft_models

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| manufacturer_id | uuid | FK to `manufacturers.id` |
| name | text | Example: `F/A-18 Hornet` |
| aircraft_category | aircraft_category | Fighter, transport, helicopter, trainer, airliner, UAV, other |
| introduced_year | integer | Nullable |
| created_at | timestamptz |  |
| updated_at | timestamptz |  |

Unique constraint: `(manufacturer_id, name)`.

#### aircraft_model_translations

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| model_id | uuid | FK to `aircraft_models.id` |
| locale | text |  |
| description | text | Optional translated description |

#### aircraft_variants

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| model_id | uuid | FK to `aircraft_models.id` |
| name | text | Example: `F/A-18C` |
| nato_name | text | Nullable |
| role | text | Default English role |
| first_flight_year | integer | Nullable |
| introduced_year | integer | Nullable |
| retired_year | integer | Nullable |
| created_at | timestamptz |  |
| updated_at | timestamptz |  |

Unique constraint: `(model_id, name)`.

#### aircraft_variant_translations

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| variant_id | uuid | FK to `aircraft_variants.id` |
| locale | text |  |
| role | text | Nullable |
| description | text | Nullable |

#### variant_technical_specs

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| variant_id | uuid | FK to `aircraft_variants.id`, unique |
| crew | integer | Nullable |
| length_m | numeric(8,2) | Nullable |
| wingspan_m | numeric(8,2) | Nullable |
| height_m | numeric(8,2) | Nullable |
| empty_weight_kg | integer | Nullable |
| max_takeoff_weight_kg | integer | Nullable |
| max_speed_kmh | integer | Nullable |
| range_km | integer | Nullable |
| service_ceiling_m | integer | Nullable |
| engine_summary | text | Default English |
| radar_summary | text | Default English |
| armament_summary | text | Default English |
| created_at | timestamptz |  |
| updated_at | timestamptz |  |

#### variant_technical_spec_translations

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| technical_spec_id | uuid | FK to `variant_technical_specs.id` |
| locale | text |  |
| engine_summary | text | Nullable |
| radar_summary | text | Nullable |
| armament_summary | text | Nullable |

### Physical Aircraft

#### aircraft

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| variant_id | uuid | FK to `aircraft_variants.id` |
| serial_number | text | Manufacturer or construction number |
| line_number | text | Nullable |
| production_block | text | Nullable |
| first_flight_date | date | Nullable |
| delivery_date | date | Nullable |
| notes | text | Default English curator notes |
| created_by_user_id | uuid | FK to `users.id`, nullable for imports |
| created_at | timestamptz |  |
| updated_at | timestamptz |  |
| deleted_at | timestamptz | Soft delete only for invalid duplicate records |

Recommended indexes:

- `(variant_id)`
- `(serial_number)`
- Full-text search on `serial_number`, `line_number`, and current registration read model.

#### aircraft_translations

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| aircraft_id | uuid | FK to `aircraft.id` |
| locale | text |  |
| notes | text | Nullable |

### Organizations

#### operators

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| name | text | Canonical English/default name |
| operator_type | operator_type | Air force, navy, airline, private, museum, manufacturer, other |
| country_id | uuid | FK to `countries.id`, nullable |
| created_at | timestamptz |  |
| updated_at | timestamptz |  |

#### operator_translations

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| operator_id | uuid | FK to `operators.id` |
| locale | text |  |
| name | text |  |
| description | text | Nullable |

#### squadrons

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| operator_id | uuid | FK to `operators.id`, nullable |
| name | text | Example: `Fliegerstaffel 17` |
| code | text | Nullable |
| country_id | uuid | FK to `countries.id`, nullable |
| home_base_id | uuid | FK to `air_bases.id`, nullable |
| active_from | date | Nullable |
| active_to | date | Nullable |
| created_at | timestamptz |  |
| updated_at | timestamptz |  |

#### squadron_translations

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| squadron_id | uuid | FK to `squadrons.id` |
| locale | text |  |
| name | text | Nullable |
| description | text | Nullable |

#### air_bases

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| location_id | uuid | FK to `locations.id` |
| icao_code | char(4) | Nullable |
| iata_code | char(3) | Nullable |
| name | text | Default English/common name |
| status | base_status | Active, closed, museum, unknown |
| created_at | timestamptz |  |
| updated_at | timestamptz |  |

### Aircraft Lifecycle History

History records use validity ranges. Open-ended current records have `valid_to null`.

#### aircraft_registration_history

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| aircraft_id | uuid | FK to `aircraft.id` |
| registration | text | Example: `J-5017` |
| country_id | uuid | FK to `countries.id`, nullable |
| valid_from | date | Nullable if unknown |
| valid_to | date | Nullable for current |
| source | text | Optional citation/source |
| confidence | confidence_level | Confirmed, likely, uncertain |
| created_by_user_id | uuid | FK to `users.id` |
| created_at | timestamptz |  |
| updated_at | timestamptz |  |

#### aircraft_operator_history

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| aircraft_id | uuid | FK to `aircraft.id` |
| operator_id | uuid | FK to `operators.id` |
| valid_from | date | Nullable |
| valid_to | date | Nullable |
| source | text | Optional |
| confidence | confidence_level |  |
| created_by_user_id | uuid | FK to `users.id` |
| created_at | timestamptz |  |
| updated_at | timestamptz |  |

#### aircraft_squadron_history

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| aircraft_id | uuid | FK to `aircraft.id` |
| squadron_id | uuid | FK to `squadrons.id` |
| valid_from | date | Nullable |
| valid_to | date | Nullable |
| source | text | Optional |
| confidence | confidence_level |  |
| created_by_user_id | uuid | FK to `users.id` |
| created_at | timestamptz |  |
| updated_at | timestamptz |  |

#### aircraft_status_history

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| aircraft_id | uuid | FK to `aircraft.id` |
| status | aircraft_status | Active, stored, retired, preserved, museum, written_off, scrapped, unknown |
| valid_from | date | Nullable |
| valid_to | date | Nullable |
| location_id | uuid | FK to `locations.id`, nullable |
| source | text | Optional |
| confidence | confidence_level |  |
| created_by_user_id | uuid | FK to `users.id` |
| created_at | timestamptz |  |
| updated_at | timestamptz |  |

#### aircraft_livery_history

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| aircraft_id | uuid | FK to `aircraft.id` |
| name | text | Default English livery name |
| description | text | Nullable |
| valid_from | date | Nullable |
| valid_to | date | Nullable |
| source | text | Optional |
| confidence | confidence_level |  |
| created_by_user_id | uuid | FK to `users.id` |
| created_at | timestamptz |  |
| updated_at | timestamptz |  |

#### aircraft_livery_history_translations

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| livery_history_id | uuid | FK to `aircraft_livery_history.id` |
| locale | text |  |
| name | text | Nullable |
| description | text | Nullable |

#### aircraft_timeline_events

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| aircraft_id | uuid | FK to `aircraft.id` |
| event_type | aircraft_timeline_event_type | Delivery, sale, transfer, crash, restoration, preservation, note, other |
| event_date | date | Nullable |
| title | text | Default English |
| description | text | Default English |
| location_id | uuid | FK to `locations.id`, nullable |
| source | text | Optional |
| confidence | confidence_level |  |
| created_by_user_id | uuid | FK to `users.id` |
| created_at | timestamptz |  |
| updated_at | timestamptz |  |

#### aircraft_timeline_event_translations

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| timeline_event_id | uuid | FK to `aircraft_timeline_events.id` |
| locale | text |  |
| title | text | Nullable |
| description | text | Nullable |

### Events, Sightings, And Photos

#### aviation_events

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| name | text | Default English/common name |
| description | text | Nullable |
| location_id | uuid | FK to `locations.id` |
| starts_on | date | Nullable |
| ends_on | date | Nullable |
| event_type | aviation_event_type | Airshow, exercise, museum visit, base visit, other |
| created_by_user_id | uuid | FK to `users.id` |
| created_at | timestamptz |  |
| updated_at | timestamptz |  |
| deleted_at | timestamptz | Soft delete |

#### aviation_event_translations

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| event_id | uuid | FK to `aviation_events.id` |
| locale | text |  |
| name | text | Nullable |
| description | text | Nullable |

#### sightings

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| aircraft_id | uuid | FK to `aircraft.id` |
| sighted_at | timestamptz | Nullable when only date is known |
| sighted_on | date | Required fallback date |
| location_id | uuid | FK to `locations.id`, nullable |
| air_base_id | uuid | FK to `air_bases.id`, nullable |
| event_id | uuid | FK to `aviation_events.id`, nullable |
| observer_user_id | uuid | FK to `users.id` |
| notes | text | Default English |
| visibility | visibility | Private, unlisted, public |
| created_at | timestamptz |  |
| updated_at | timestamptz |  |
| deleted_at | timestamptz | Soft delete |

Recommended indexes:

- `(aircraft_id, sighted_on desc)`
- `(observer_user_id, sighted_on desc)`
- `(location_id)`
- `(event_id)`

#### sighting_translations

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| sighting_id | uuid | FK to `sightings.id` |
| locale | text |  |
| notes | text | Nullable |

#### photos

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| sighting_id | uuid | FK to `sightings.id` |
| aircraft_id | uuid | FK to `aircraft.id`, denormalized only if enforced from sighting for query speed |
| owner_user_id | uuid | FK to `users.id` |
| storage_key_original | text | Object storage key |
| storage_key_large | text | Nullable derivative |
| storage_key_thumbnail | text | Nullable derivative |
| title | text | Default English |
| caption | text | Default English |
| taken_at | timestamptz | Nullable |
| camera_make | text | Nullable |
| camera_model | text | Nullable |
| lens | text | Nullable |
| focal_length_mm | numeric(8,2) | Nullable |
| exposure | text | Nullable |
| aperture | text | Nullable |
| iso | integer | Nullable |
| width_px | integer | Nullable |
| height_px | integer | Nullable |
| license | photo_license | Private, all_rights_reserved, cc_by, cc_by_sa, other |
| visibility | visibility | Private, unlisted, public |
| moderation_status | moderation_status | Pending, approved, rejected |
| created_at | timestamptz |  |
| updated_at | timestamptz |  |
| deleted_at | timestamptz | Soft delete |

The `aircraft_id` field is acceptable only as a maintained query optimization. The source of truth remains `sightings.aircraft_id`.

#### photo_translations

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| photo_id | uuid | FK to `photos.id` |
| locale | text |  |
| title | text | Nullable |
| caption | text | Nullable |

#### photo_exif

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| photo_id | uuid | FK to `photos.id`, unique |
| raw_exif | jsonb | Original extracted metadata |
| gps_latitude | numeric(9,6) | Nullable |
| gps_longitude | numeric(9,6) | Nullable |
| extracted_at | timestamptz |  |

### Collections And Future Statistics

#### user_aircraft_collection

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| user_id | uuid | FK to `users.id` |
| aircraft_id | uuid | FK to `aircraft.id` |
| collection_status | collection_status | Seen, photographed, wanted, missing |
| first_seen_sighting_id | uuid | FK to `sightings.id`, nullable |
| first_photo_id | uuid | FK to `photos.id`, nullable |
| created_at | timestamptz |  |
| updated_at | timestamptz |  |

Unique constraint: `(user_id, aircraft_id)`.

#### saved_searches

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| user_id | uuid | FK to `users.id` |
| name | text |  |
| filters | jsonb | Structured search filters |
| created_at | timestamptz |  |
| updated_at | timestamptz |  |

### Audit And Import

#### audit_log

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| actor_user_id | uuid | FK to `users.id`, nullable |
| entity_type | text |  |
| entity_id | uuid |  |
| action | audit_action | Create, update, soft_delete, restore, merge, import |
| before_data | jsonb | Nullable |
| after_data | jsonb | Nullable |
| created_at | timestamptz |  |

#### import_jobs

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid | Primary key |
| created_by_user_id | uuid | FK to `users.id` |
| source_name | text |  |
| status | job_status | Pending, processing, completed, failed |
| summary | jsonb | Counts and validation details |
| created_at | timestamptz |  |
| updated_at | timestamptz |  |

### Important Constraints

- Current lifecycle records should be queryable through partial indexes where `valid_to is null`.
- Exclusion constraints should prevent overlapping known validity ranges per aircraft for registration, operator, squadron, status, and livery when both range boundaries are known.
- Soft-deleted user content should be excluded from public queries by default.
- Reference records should usually not be deleted once used; prefer merge/deactivate workflows.
- Translation tables should enforce one row per entity per locale.

## 3. Main Entities

### Manufacturer

Represents the company or organization that designed or produced aircraft models. It owns many models.

### Aircraft Model

Represents a broad aircraft family such as `F/A-18 Hornet`. It belongs to one manufacturer and owns many variants.

### Aircraft Variant

Represents a technical version such as `F/A-18C`. It owns technical specifications and is inherited by physical aircraft.

### Physical Aircraft

The central entity. Represents one unique airframe identified by serial number, construction number, or historically known identity. It owns lifecycle history, sightings, photos through sightings, and collection status.

### Registration

Stored as aircraft registration history, not as a single mutable aircraft field. This supports changes across countries, operators, and time.

### Operator

Represents an airline, air force, navy, museum, private owner, manufacturer, or other organization that operates or owns aircraft.

### Squadron

Represents a military unit or operational sub-organization. Squadron assignment is historical and may change over an aircraft lifecycle.

### Air Base

Represents an aviation base or airport-like military facility. It is linked to a normalized location for map support.

### Event

Represents airshows, exercises, museum visits, and similar aviation events. Sightings can be associated with events.

### Sighting

Represents an observation of one aircraft by one user at a date/time and location. It is the key bridge between aircraft, map, event, and photographs.

### Photograph

Represents uploaded media evidence tied to a sighting. It stores file references, visibility, moderation status, and extracted metadata.

### Location

Represents mappable geography used by sightings, air bases, events, timeline events, and preserved aircraft.

### Country

Represents normalized country data used by operators, registrations, manufacturers, and map/statistics features.

### User Collection

Represents each user’s relationship to an aircraft, including seen, photographed, wanted, or missing status.

## 4. API Structure

The API should be RESTful, versioned from day one, and described by OpenAPI.

Base path:

`/api/v1`

### API Modules

#### Authentication And Users

- `GET /api/v1/me`
- `PATCH /api/v1/me`
- `GET /api/v1/users/{userId}`
- `GET /api/v1/users/{userId}/collection`

#### Manufacturers

- `GET /api/v1/manufacturers`
- `POST /api/v1/manufacturers`
- `GET /api/v1/manufacturers/{manufacturerId}`
- `PATCH /api/v1/manufacturers/{manufacturerId}`
- `GET /api/v1/manufacturers/{manufacturerId}/models`

#### Aircraft Models

- `GET /api/v1/models`
- `POST /api/v1/models`
- `GET /api/v1/models/{modelId}`
- `PATCH /api/v1/models/{modelId}`
- `GET /api/v1/models/{modelId}/variants`

#### Aircraft Variants

- `GET /api/v1/variants`
- `POST /api/v1/variants`
- `GET /api/v1/variants/{variantId}`
- `PATCH /api/v1/variants/{variantId}`
- `GET /api/v1/variants/{variantId}/technical-specs`
- `PUT /api/v1/variants/{variantId}/technical-specs`

#### Aircraft

- `GET /api/v1/aircraft`
- `POST /api/v1/aircraft`
- `GET /api/v1/aircraft/{aircraftId}`
- `PATCH /api/v1/aircraft/{aircraftId}`
- `DELETE /api/v1/aircraft/{aircraftId}`
- `GET /api/v1/aircraft/{aircraftId}/timeline`
- `GET /api/v1/aircraft/{aircraftId}/history`
- `GET /api/v1/aircraft/{aircraftId}/sightings`
- `GET /api/v1/aircraft/{aircraftId}/photos`

Aircraft search query parameters:

- `registration`
- `serialNumber`
- `manufacturerId`
- `modelId`
- `variantId`
- `operatorId`
- `squadronId`
- `countryId`
- `status`
- `hasPhotos`
- `seenByUserId`

#### Aircraft History

- `POST /api/v1/aircraft/{aircraftId}/registration-history`
- `PATCH /api/v1/aircraft/{aircraftId}/registration-history/{historyId}`
- `POST /api/v1/aircraft/{aircraftId}/operator-history`
- `PATCH /api/v1/aircraft/{aircraftId}/operator-history/{historyId}`
- `POST /api/v1/aircraft/{aircraftId}/squadron-history`
- `PATCH /api/v1/aircraft/{aircraftId}/squadron-history/{historyId}`
- `POST /api/v1/aircraft/{aircraftId}/status-history`
- `PATCH /api/v1/aircraft/{aircraftId}/status-history/{historyId}`
- `POST /api/v1/aircraft/{aircraftId}/livery-history`
- `PATCH /api/v1/aircraft/{aircraftId}/livery-history/{historyId}`
- `POST /api/v1/aircraft/{aircraftId}/timeline-events`
- `PATCH /api/v1/aircraft/{aircraftId}/timeline-events/{eventId}`

PATCH endpoints here should be limited to correcting metadata. They should not silently rewrite lifecycle facts without audit records.

#### Operators And Squadrons

- `GET /api/v1/operators`
- `POST /api/v1/operators`
- `GET /api/v1/operators/{operatorId}`
- `PATCH /api/v1/operators/{operatorId}`
- `GET /api/v1/operators/{operatorId}/aircraft`
- `GET /api/v1/squadrons`
- `POST /api/v1/squadrons`
- `GET /api/v1/squadrons/{squadronId}`
- `PATCH /api/v1/squadrons/{squadronId}`
- `GET /api/v1/squadrons/{squadronId}/aircraft`

#### Locations, Air Bases, Countries

- `GET /api/v1/countries`
- `GET /api/v1/locations`
- `POST /api/v1/locations`
- `GET /api/v1/locations/{locationId}`
- `PATCH /api/v1/locations/{locationId}`
- `GET /api/v1/air-bases`
- `POST /api/v1/air-bases`
- `GET /api/v1/air-bases/{airBaseId}`
- `PATCH /api/v1/air-bases/{airBaseId}`

#### Events

- `GET /api/v1/events`
- `POST /api/v1/events`
- `GET /api/v1/events/{eventId}`
- `PATCH /api/v1/events/{eventId}`
- `DELETE /api/v1/events/{eventId}`
- `GET /api/v1/events/{eventId}/sightings`
- `GET /api/v1/events/{eventId}/photos`

#### Sightings

- `GET /api/v1/sightings`
- `POST /api/v1/sightings`
- `GET /api/v1/sightings/{sightingId}`
- `PATCH /api/v1/sightings/{sightingId}`
- `DELETE /api/v1/sightings/{sightingId}`
- `GET /api/v1/sightings/{sightingId}/photos`

Sighting filters:

- `aircraftId`
- `userId`
- `countryId`
- `locationId`
- `airBaseId`
- `eventId`
- `from`
- `to`
- `visibility`

#### Photos

- `GET /api/v1/photos`
- `POST /api/v1/photos/upload-intent`
- `POST /api/v1/photos`
- `GET /api/v1/photos/{photoId}`
- `PATCH /api/v1/photos/{photoId}`
- `DELETE /api/v1/photos/{photoId}`
- `POST /api/v1/photos/{photoId}/process`

Upload should use a two-step flow:

1. Request upload intent.
2. Upload file to object storage.
3. Create photo record linked to sighting and storage key.

#### Map

- `GET /api/v1/map/sightings`
- `GET /api/v1/map/air-bases`
- `GET /api/v1/map/events`
- `GET /api/v1/map/countries`

Map endpoints should return compact marker payloads and support bounding-box filters.

#### Collection And Statistics

- `GET /api/v1/collection`
- `PUT /api/v1/collection/aircraft/{aircraftId}`
- `DELETE /api/v1/collection/aircraft/{aircraftId}`
- `GET /api/v1/statistics/collection`
- `GET /api/v1/statistics/aircraft`

#### Imports And Exports

- `POST /api/v1/import-jobs`
- `GET /api/v1/import-jobs/{jobId}`
- `POST /api/v1/export-jobs`
- `GET /api/v1/export-jobs/{jobId}`

### API Conventions

- Use plural resource names.
- Use cursor pagination for large lists.
- Use ISO 8601 dates and timestamps.
- Use locale negotiation through `Accept-Language` and explicit `?locale=fr`.
- Return English fallback content when translation is missing.
- Use consistent error envelopes with machine-readable codes.
- Enforce role-based permissions in the application layer.

## 5. Frontend Architecture

The frontend should be organized around features while sharing reusable UI primitives and domain-aware data access.

### Frontend Layers

1. **Routes and pages**
   - Aircraft search.
   - Aircraft profile.
   - Manufacturer/model/variant pages.
   - Sighting detail.
   - Photo gallery.
   - World map.
   - Event pages.
   - Collection dashboard.
   - Admin/curation pages.

2. **Feature modules**
   - `aircraft`
   - `taxonomy`
   - `history`
   - `sightings`
   - `photos`
   - `map`
   - `events`
   - `collection`
   - `admin`
   - `auth`
   - `i18n`

3. **Shared UI**
   - Buttons, inputs, selects, dialogs, tables.
   - Timeline component.
   - Photo grid component.
   - Map marker components.
   - Empty/loading/error states.

4. **Data access**
   - Typed API client generated or validated from OpenAPI.
   - Query hooks per feature.
   - Cache invalidation rules after mutations.

5. **Domain view models**
   - Aircraft profile view model.
   - Timeline view model.
   - Map marker view model.
   - Search result view model.
   - Collection stats view model.

### Primary Screens

#### Aircraft Search

- Search by registration, serial number, manufacturer, model, variant, country, operator, squadron, and status.
- Results should show current registration, variant, current operator, current status, and latest photo thumbnail when available.

#### Aircraft Profile

- Header with current registration, variant, manufacturer, model, status, and representative photo.
- Tabs or sections for overview, timeline, sightings, photos, technical specs, and history.
- History should clearly distinguish current facts from past facts.

#### Timeline

- Unified chronological display combining registration, operator, squadron, status, livery, sighting, photo, and custom timeline events.
- Filterable by event type.

#### Photo Gallery

- Responsive grid.
- Filters by aircraft, event, location, date, photographer, and visibility.
- Photo detail page with EXIF and linked sighting.

#### World Map

- Marker layers for sightings, air bases, and events.
- Filters by date range, user collection, aircraft type, country, event, and operator.
- Marker clustering for performance.

#### Collection Dashboard

- Personal collection counts.
- Seen vs photographed aircraft.
- Missing or wanted aircraft.
- Breakdown by manufacturer, model, country, operator, and squadron.

#### Admin And Curation

- Reference data management.
- Duplicate detection and merge workflows.
- Moderation queue for public photos and user-generated content.
- Import job review.

### Internationalization

- English is the default locale.
- French is the first secondary locale.
- UI strings must live in translation files, not components.
- Entity content should resolve as:
  1. Requested locale translation.
  2. English/default entity fields.
  3. Empty fallback only when content is genuinely missing.

### Frontend State

- Server state should be managed by a query/cache library.
- Local UI state should remain local to components unless shared navigation state is needed.
- Search filters should be reflected in the URL for shareability.
- Authentication and current user state should be available globally.

### Responsive UX

- Desktop: dense tables, split panes, side filters, full map controls.
- Tablet: collapsible filters and adaptive grids.
- Mobile: list-first navigation, compact timelines, full-screen map mode, simplified table alternatives.

## 6. Development Roadmap

### Phase 0: Foundations

- Choose the TypeScript web framework and API runtime.
- Configure strict TypeScript.
- Set up PostgreSQL migrations.
- Define OpenAPI conventions.
- Set up linting, formatting, unit tests, and integration test structure.
- Add i18n infrastructure for English and French.
- Establish clean architecture folder boundaries.

### Phase 1: Core Reference Data

- Implement countries and locations.
- Implement manufacturers, models, and variants.
- Implement variant technical specifications.
- Implement operators, squadrons, and air bases.
- Add translation storage and retrieval for reference entities.
- Add admin CRUD for reference data.

### Phase 2: Physical Aircraft And Lifecycle

- Implement physical aircraft records.
- Implement registration history.
- Implement operator history.
- Implement squadron history.
- Implement status history.
- Implement livery history.
- Add aircraft timeline aggregation.
- Add aircraft search by serial number, registration, operator, country, model, variant, and squadron.

### Phase 3: Sightings And Collection

- Implement sightings.
- Implement user aircraft collection status.
- Add aircraft profile pages.
- Add personal collection views.
- Add map markers for sightings and air bases.
- Add filtering by date, country, aircraft type, and user.

### Phase 4: Photo Management

- Add object storage integration.
- Add upload-intent flow.
- Store photo metadata and link photos to sightings.
- Generate thumbnails and large derivatives.
- Add EXIF extraction worker.
- Add photo gallery and photo detail pages.
- Add moderation workflow for public photos.

### Phase 5: Events And Map Expansion

- Implement aviation events.
- Link sightings and photos to events.
- Add event pages.
- Add event and country layers to the world map.
- Add map clustering and bounding-box APIs.
- Add countries visited visualizations.

### Phase 6: Curation, Imports, And Data Quality

- Add duplicate aircraft detection.
- Add merge workflows for reference entities and aircraft records.
- Add audit log views.
- Add import jobs for structured datasets.
- Add export jobs for user data and collection data.
- Add source/citation quality improvements for history records.

### Phase 7: Public API And Advanced Features

- Publish stable public API documentation.
- Add API keys and rate limiting.
- Add public aircraft, sighting, event, and photo endpoints.
- Add interactive dashboards.
- Add missing aircraft tracking.
- Add squadron collection pages.
- Add museum aircraft workflows.
- Add advanced timeline visualization.

## 7. Key Risks And Mitigations

### Historical Data Ambiguity

Aircraft records often have incomplete dates or conflicting sources.

Mitigation:

- Allow nullable `valid_from` and `valid_to`.
- Store `source` and `confidence`.
- Avoid overwriting historical records.
- Support curator corrections with audit logging.

### Duplicate Aircraft Records

The same airframe may appear under different registrations or incomplete serial numbers.

Mitigation:

- Search across all registration history.
- Add duplicate candidate detection.
- Add curator merge workflows.
- Preserve old identifiers after merge.

### Photo Storage Growth

Photographs can become the largest storage and bandwidth cost.

Mitigation:

- Store originals separately from derivatives.
- Generate thumbnails asynchronously.
- Use object storage and CDN-compatible URLs.
- Apply visibility and moderation controls.

### Translation Coverage

French translations may be incomplete.

Mitigation:

- Keep English canonical fields on base entities.
- Use translation tables for localized fields.
- Always fall back to English.

### Search Performance

Historical search across registrations, operators, squadrons, and statuses can become expensive.

Mitigation:

- Add targeted indexes.
- Use read models or materialized views for current aircraft state.
- Start with PostgreSQL full-text search.
- Move to a dedicated search engine only when needed.

## 8. Suggested Initial Milestone Scope

The first useful release should include:

- Users and roles.
- Countries and locations.
- Manufacturers, models, variants, and technical specs.
- Physical aircraft.
- Registration, operator, squadron, status, and livery history.
- Aircraft search.
- Aircraft profile with timeline.
- Sightings.
- Basic photo records without advanced moderation.
- Basic world map for sightings and air bases.
- English/French UI infrastructure with English content fallback.
