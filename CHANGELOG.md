# Changelog

All notable changes to Aviadex will be documented in this file.

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
