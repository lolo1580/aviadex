# Aviadex Bugs And Problems

## Open Issues

### Full Check Results

- `npm run build` passes.
- `npm audit --audit-level=moderate` passes with 0 vulnerabilities.
- Docker build passes.
- No automated unit, integration, API, or browser tests exist.
- Current findings are from build, audit, docs/config review, and static code inspection.

### Functionality Bugs

#### Collection Page Has No Sighting Detail View

- Sightings are displayed as summary rows only.
- There is no route or expanded detail view showing sighting metadata and all linked photos.
- This partially misses the requirement to show uploaded photos in the sighting detail.

#### Timeline Filters Have No Reset Action

- Timeline filters can be set by aircraft, event type, and date range.
- There is no one-click reset/clear action.
- Users must manually clear each control.

#### Map Markers Are Not Interactive Popups

- Marker information is always rendered as static cards on the CSS map.
- There is no click/hover popup behavior, selection state, or map navigation.
- This is backend-ready, but not equivalent to a real interactive map popup experience.

#### Read-Only Reference Tables Can Overflow With Large JSON

- Variant `specs` are rendered as raw JSON in reference tables.
- Long JSON values can make rows hard to scan even though wrapping is enabled.
- A formatted details view is needed for practical browsing.

#### Auth Session Check Failure Is Confusing

- If `/api/v1/auth/me` fails for reasons other than `401`, the app proceeds as unauthenticated during initial load.
- Users may not see a clear distinction between "not signed in" and "auth service unavailable".

#### Static Sample Data Still Exists In Frontend Source

- `src/infrastructure/sampleData.ts` remains in the project even though the UI now loads from the API.
- This can confuse future work and may lead to stale assumptions if imported again.

#### Collection Can Break If API Is Down

- The UI no longer falls back to `sampleData`.
- If `/api/v1/collection` fails, the app shows a global error and no usable read-only collection.
- This is correct for backend-backed behavior, but there is no degraded/offline mode.

#### File Input May Stay Visually Selected After Upload

- Photo upload sets React state `files` to `null` after upload.
- The native file input value is uncontrolled, so the selected filename may remain visible.

#### Language Choice Does Not Persist

- Locale is stored only in component state.
- Refreshing the page resets language to English.

### Version And Image Tag Mismatch

- `package.json` still declares version `1.1.1`.
- Harbor images were pushed as `v1.0.0` and `latest`.
- Decide whether the application package version should be changed to `1.0.0` or whether image tags should follow `1.1.1`.

### Database Migration Strategy

- Migrations are currently implemented as idempotent startup DDL in `src/server/migrations.ts`.
- There is no migration history table or versioned migration runner.
- Future schema changes may become harder to audit or roll back.

### Seed Data Coupling

- Startup seed data is compiled into `src/server/seedData.ts`.
- This is useful for a first usable deployment, but seed data changes are mixed with application releases.
- Consider making seed data optional or environment-controlled after initial production data exists.
- Seed inserts use `on conflict do nothing`, so corrected seed data will not update already inserted sample rows.

### Photo Thumbnail Generation

- Photo upload stores image files and records `thumbnail_path`, but real thumbnail generation is not implemented yet.
- The API currently uses the original image URL as the thumbnail URL when no thumbnail exists.

### Camera Metadata Extraction

- Photo metadata fields exist for camera details.
- EXIF extraction is not implemented yet.
- Metadata can currently be supplied by form fields only.

### Frontend Test Coverage

- There are no automated UI tests for routing, auth state, reference forms, timeline filtering, map markers, or photo upload.
- Current verification is limited to `npm run build`.

### API Test Coverage

- There are no automated API tests for validation, auth guards, upload limits, or database integrity.
- Add integration tests against a temporary PostgreSQL database.

### Sighting Management Is Partial

- Sighting list and create API exist.
- The current UI exposes a basic admin create form, but does not expose a full sighting edit/detail page yet.

### Map Is Leaflet-Ready But Not Leaflet

- The map page uses real backend marker data and is structured for future Leaflet/OpenStreetMap integration.
- It is still a custom CSS map surface, not an interactive Leaflet map.

### Authentication Scope

- Only the bootstrapped admin account is supported.
- There is no user management UI for creating, disabling, or changing roles for additional users.

### Session Management

- Sessions are stored in PostgreSQL and expire by timestamp.
- Expired sessions are not actively pruned.
- Add periodic cleanup or prune expired sessions during login/session checks.
- Logout deletes only the current session; there is no "log out all sessions" or admin session management.

### Localization Completeness

- New user-facing strings were added to English and French translation tables.
- Some dynamic values, event type names, and database-driven labels remain untranslated.
- Several fallback values in aircraft profile/reference panels remain hardcoded in English, such as `Unassigned`, `Unknown`, and `Not recorded`.

### Date Handling

- API accepts dates as generic strings and relies on PostgreSQL casts.
- Invalid dates can become database errors instead of `400 invalid_input`.
- Frontend date formatting uses the browser timezone, which can shift date-only values near timezone boundaries.

### Map Rendering Limitations

- The current map is a proportional CSS marker plot, not a geographic projection.
- Markers can overlap when sightings are close together.
- There is no pan, zoom, clustering, or accessible marker list yet.

### CSRF Protection

- Session cookies use `sameSite: "lax"` and HTTP-only cookies.
- There is no CSRF token or origin check for state-changing endpoints.
- SameSite Lax reduces risk, but explicit CSRF protection should be added for admin writes.

### Login Rate Limiting

- `/api/v1/auth/login` has no rate limiting or lockout.
- Online password guessing is not throttled at the application layer.

### Database Constraints Are Minimal

- Several domain columns still use plain `text` without check constraints, for example user `role` and free-form reference fields.
- Core constraints now exist for photo visibility, aircraft status, lifecycle event types, coordinates, and photo/sighting aircraft consistency.

### Server Error Logging Is Too Thin

- The API error middleware logs only the error message.
- Useful debugging context such as route, request ID, and database error code is not recorded.
- It correctly avoids logging secrets, but operational diagnosis is harder.

### Deployment Health Check Can Fail During Long Migrations

- The container starts migrations before listening.
- If migrations or seed work take longer than the health check start period, orchestration may mark the app unhealthy or restart it.

### Documentation And Architecture Mismatches

#### README Still Describes Old Version And Image Tags

- `README.md`, `example.env`, and `exemple.compose.yml` still default to `v1.1.1`.
- The latest pushed production tags are `v1.0.0` and `latest`.
- Deployment instructions can cause operators to pull an older or different image than intended.

#### Compose File Name Has A Typo

- The compose file is named `exemple.compose.yml`.
- This matches current README commands, but the spelling is easy to miss and differs from common `example.compose.yml`.

#### Architecture Docs Require UUID Primary Keys

- `docs/rules.md` says to use UUID primary keys.
- New domain/reference tables use text primary keys to preserve sample IDs.
- This is a deliberate shortcut, but it conflicts with documented project rules.

#### Architecture Docs Recommend Clean Layer Separation

- `docs/rules.md` requires separation of UI, business logic, data access, and infrastructure.
- `src/server/index.ts` currently contains route handlers, SQL, upload orchestration, validation, and serialization in one file.
- This will become difficult to maintain as API behavior grows.

#### OpenAPI Is Missing

- `docs/architecture.md` recommends documenting `/api/v1` with OpenAPI.
- No OpenAPI specification or generated API documentation exists.

#### Recommended Object Storage Is Not Implemented

- `docs/architecture.md` recommends S3-compatible object storage for photos.
- Current implementation uses local filesystem storage only.

#### Background Worker Is Not Implemented

- `docs/architecture.md` recommends background jobs for thumbnails, EXIF extraction, imports, and exports.
- Current implementation performs upload handling synchronously and does not process thumbnails or EXIF.

#### Translation Tables Are Not Implemented

- `docs/architecture.md` recommends database translation tables for reference data.
- Current implementation uses frontend translation dictionaries only.
- Database-backed reference names are not localized.

### API And Data Modeling Issues

#### API Error Shape Is Not Universal For Database Errors

- Explicit API errors use `{ error: { code, message } }`.
- Common database constraint violations are mapped to `400` or `409`.
- Unexpected database errors still return generic `internal_error`.
- More specific field-level validation messages are still missing.

#### Date Range Filters Are Not Validated

- Timeline `from` and `to` query params are validated.
- Other date fields still need broader field-specific validation and user-facing guidance.

#### Timeline Event Types Are Unconstrained

- Lifecycle event type is plain text in the database.
- API filtering allows arbitrary event type strings.
- There is no enum/check constraint for supported lifecycle types.

#### Denormalized Aircraft Fields Can Drift

- `physical_aircraft` stores `current_operator`, `current_squadron`, `current_country_iso2`, `current_status`, and `livery` as text/current-state fields.
- Lifecycle events also record changes.
- Without update workflows or constraints, current state can drift from history.

#### Location Duplication Is Possible

- Sightings store `location_id`, `location_name`, country, latitude, and longitude.
- This is useful for read performance, but it can drift from the referenced `locations` table.

#### Seed Slugs Can Collide

- Seed location/operator/squadron IDs are generated with simple slugification.
- Different names can produce the same slug.
- `on conflict do nothing` would silently skip the later seed row.

#### Existing Schemas Are Not Upgraded

- Startup DDL uses `create table if not exists`.
- If an existing table is missing a new column or constraint, the migration will not add it.
- This limits upgrades from earlier schema versions.

### UI And Accessibility Issues

#### Sidebar Buttons Do Not Expose Current Page Semantics

- The active route is styled visually.
- Navigation buttons do not set `aria-current="page"`.

#### Map Has No Keyboard Interaction

- Map marker cards are static articles.
- There is no keyboard focus, marker list, or popup control semantics.

#### Long Tables Have No Pagination

- Reference tables render all rows at once.
- Large reference datasets can degrade browser performance and usability.

#### Auth State Is Not Refreshed After Failed Writes

- If an admin session expires, write endpoints return `401`.
- Reference/photo forms do not catch these errors or refresh the global auth state.

### Operational Issues

#### App Requires Database At Startup

- `DATABASE_URL` is required and migrations run before listening.
- If PostgreSQL is unavailable, the app exits instead of serving a maintenance state.

#### No Graceful Shutdown

- The server does not trap shutdown signals to close the PostgreSQL pool.
- Containers can still stop, but in-flight requests and database connections are not drained cleanly.

#### No Structured Logs

- Logs are plain console messages.
- There is no request ID, latency, user ID, or structured JSON logging.

#### No Metrics

- The app exposes `/api/v1/health`, but no metrics endpoint or counters.
- Upload failures, login failures, and API latency are not observable.

#### No Database Connection Pool Configuration

- `pg.Pool` uses defaults.
- Pool size, idle timeout, connection timeout, and SSL options are not configurable from environment variables.

#### No HTTPS Proxy Awareness

- Express `trust proxy` is not configured.
- If deployed behind a reverse proxy, secure cookie behavior and client IP handling may need explicit configuration.

## Recently Fixed

### Five Requested Follow-Up Areas

- Added basic admin reference edit support through the existing reference form.
- Added basic admin physical aircraft create/edit support on the collection page.
- Added basic admin sighting creation on the collection page.
- Added inline submit errors and submitting states for reference, aircraft, sighting, and photo forms.
- Added authenticated media serving for private photos instead of unconditional static `/uploads` access.
- Added database constraints for aircraft status, lifecycle event type, photo visibility, coordinate ranges, and photo/sighting aircraft consistency.
- Added API validation for timeline date filters, sighting dates, photo timestamps, enum fields, numeric ranges, and variant `specs` JSON.
- Verified with `npm run build`, `npm audit --audit-level=moderate`, and `docker build -t aviadex:five-points .`.

### Critical Runtime And Deployment Fixes

- Added persistent upload volume and upload env passthrough to `exemple.compose.yml`.
- Added startup validation for `PORT`, `MAX_UPLOAD_BYTES`, and `SESSION_TTL_DAYS`.
- Changed admin bootstrap so an existing admin password hash is not overwritten on every startup.
- Validated reference `specs` JSON and return `400 invalid_input` for invalid JSON objects.
- Mapped common PostgreSQL constraint/cast errors to consistent `400` or `409` JSON responses.
- Made photo upload all-or-nothing with a dedicated PostgreSQL transaction client.
- Added cleanup for files written during failed photo uploads.
- Upgraded Vite through `npm audit fix --force`; `npm audit --audit-level=moderate` now reports 0 vulnerabilities.
- Verified with `npm run build`, `npm audit --audit-level=moderate`, and `docker build -t aviadex:critical-fixes .`.

### Manufacturer Country Foreign Key Crash

- Fixed startup crash where `manufacturers.country_iso2 = US` was inserted before `US` existed in `countries`.
- Corrected image digest pushed to Harbor:
  - `harbor.kellerflix.org/aviadex/prod:v1.0.0`
  - `harbor.kellerflix.org/aviadex/prod:latest`
  - digest `sha256:98e9964f5ada918d5d27c100029c78bc55c16861aeb309a2a4fca0917284f978`
