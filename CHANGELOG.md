# Changelog

All notable changes to Aviadex will be documented in this file.

## Unreleased - 2026-06-15

### Added

- REST API coverage under `/api/v1` for collection, map, timeline, reference data, sightings, photos, and auth.
- Route-backed React pages for `/collection`, `/map`, `/timeline`, and `/reference`.
- Authenticated admin management for reference records, physical aircraft, sightings, and photo uploads.
- Filesystem-backed photo uploads with PostgreSQL metadata instead of storing binary image data in the database.
- Access-controlled media route for uploaded photos with private/public visibility handling.
- Global timeline filtering by aircraft, event type, and date range.
- Backend-ready sighting map marker data and marker rendering.
- Startup seed data for initial normalized reference, aircraft, lifecycle, and sighting records.
- `BUGS_AND_PROBLEMS.md` to track open issues, fixed issues, and remaining risks.

### Changed

- Upgraded Vite to `8.0.16` through audit remediation.
- Docker Compose now passes upload configuration and mounts a persistent upload volume.
- Admin bootstrap now preserves an existing admin password hash instead of overwriting it every startup.
- README now documents current Harbor production tags, upload storage, and functional app behavior.

### Fixed

- Fixed startup failure caused by seeding a manufacturer country before the referenced country existed.
- Added validation for numeric environment variables, date inputs, enum fields, coordinates, and variant `specs` JSON.
- Added database constraints for aircraft status, lifecycle event type, photo visibility, coordinate ranges, and photo/sighting aircraft consistency.
- Made photo upload all-or-nothing with a PostgreSQL transaction and cleanup for files written during failed uploads.
- Mapped common PostgreSQL constraint and cast errors to consistent `400` or `409` JSON responses.
- Added form-level errors and submitting states for admin reference, aircraft, sighting, and photo workflows.

### Verified

- `npm run build`
- `npm audit --audit-level=moderate`
- `docker build -t aviadex:five-points .`
- Harbor images pushed:
  - `harbor.kellerflix.org/aviadex/prod:v1.0.0`
  - `harbor.kellerflix.org/aviadex/prod:latest`
  - digest `sha256:afff0446d1eaa3400e9c230f6fb327fde3db173d4f83d32439ba1166d189d8f5`

## v1.1.1 - 2026-06-14

### Fixed

- Avoided startup failures on hardened PostgreSQL installs by using a configurable `DATABASE_SCHEMA` instead of relying on `public`.
- Removed application startup dependency on creating the `pgcrypto` extension.
- Qualified login and session queries with the configured schema.

### Changed

- Docker Compose and environment examples now default to `DATABASE_SCHEMA=aviadex`.
- README now documents one-time external PostgreSQL schema grants and the optional `pgcrypto` setup for manual password hashing.

## v1.1.0 - 2026-06-14

### Added

- PostgreSQL-backed login API under `/api/v1/auth`.
- HttpOnly cookie sessions stored as hashed tokens in PostgreSQL.
- Startup database migration for `users` and `auth_sessions`.
- Admin bootstrap from environment variables.
- Login/logout UI in the dashboard.
- Docker Compose example with internal `postgres:17-alpine` and support for external `DATABASE_URL`.
- README procedure for creating and resetting users in Docker Compose or external PostgreSQL.

### Changed

- Docker image now runs the Node/Express server instead of static Nginx-only hosting.

## v1.0.1 - 2026-06-14

### Security

- Updated Docker runtime image from `nginx:1.27-alpine` to current `nginx:alpine`.
- Added `apk upgrade --no-cache` in the runtime stage to install fixed Alpine packages during image builds.

## v1.0.0 - 2026-06-14

### Added

- Initial React/Vite TypeScript application scaffold.
- Docker image build setup for Nginx static hosting.
- Clean architecture-oriented source layout.
- Aircraft domain model for manufacturers, models, variants, physical aircraft, lifecycle events, and sightings.
- Seed collection data for F/A-18C and A400M examples.
- Collection search and filters.
- Aircraft profile, variant technical reference, lifecycle timeline, sighting evidence, and map preview panels.
- English and French UI translation scaffolding.
- Responsive desktop and mobile styling.
- Favicon and generated dashboard concept reference asset.

### Verified

- Production build passes with `npm run build`.
- Production dependency audit passes with `npm audit --omit=dev`.
