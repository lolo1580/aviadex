# Changelog

All notable changes to Aviadex will be documented in this file.

## v1.0.0 - 2026-06-15

### Added

- Functional REST API coverage under `/api/v1` for auth, collection, map, timeline, reference data, sightings, and photos.
- Route-backed React pages for `/collection`, `/map`, `/timeline`, and `/reference`.
- Planepedia page for model-level aircraft encyclopedia records with links to matching collection aircraft.
- Admin create/edit workflows for Planepedia aircraft models and variants from the Planepedia page.
- PostgreSQL-backed email/password login with HttpOnly session cookies.
- Admin bootstrap from `AVIADEX_ADMIN_EMAIL`, `AVIADEX_ADMIN_PASSWORD`, and `AVIADEX_ADMIN_DISPLAY_NAME`.
- Authenticated admin management for reference records, physical aircraft, sightings, and photo uploads.
- Filesystem-backed photo uploads with PostgreSQL metadata instead of storing binary image data in the database.
- Access-controlled media route for uploaded photos with private/public visibility handling.
- Global timeline filtering by aircraft, event type, and date range.
- Backend-ready sighting map marker data and marker rendering.
- OpenStreetMap-backed map rendering with Leaflet markers and sighting popups.
- Aircraft record layout with identity hero, contextual metrics, and tabs for overview, photos, sightings, timeline, technical data, and admin.
- Startup seed data for normalized reference, aircraft, lifecycle, and sighting records.
- Docker Compose example with internal `postgres:17-alpine`, persistent PostgreSQL data, and persistent upload storage.
- `BUGS_AND_PROBLEMS.md` to track open issues, fixed issues, and remaining risks.

### Changed

- Docker image now runs the Node/Express server for API and frontend delivery.
- Upgraded Vite to `8.0.16` through audit remediation.
- Admin bootstrap preserves an existing admin password hash instead of overwriting it every startup.
- README now documents current Harbor production tags, upload storage, database setup, and user management.
- Collection detail UI now separates read-only aircraft consultation from admin editing workflows.

### Fixed

- Fixed startup failure caused by seeding a manufacturer country before the referenced country existed.
- Added validation for numeric environment variables, date inputs, enum fields, coordinates, and variant `specs` JSON.
- Added database constraints for aircraft status, lifecycle event type, photo visibility, coordinate ranges, and photo/sighting aircraft consistency.
- Made photo upload all-or-nothing with a PostgreSQL transaction and cleanup for files written during failed uploads.
- Mapped common PostgreSQL constraint and cast errors to consistent `400` or `409` JSON responses.
- Added form-level errors and submitting states for admin reference, aircraft, sighting, and photo workflows.
- Removed stale application version references so project documentation and package metadata consistently identify this release as `v1.0.0`.

### Verified

- `npm run build`
- `npm audit --audit-level=moderate`
- `docker build -t aviadex:v1.0.0 .`
- Harbor images pushed:
  - `harbor.kellerflix.org/aviadex/prod:v1.0.0`
  - `harbor.kellerflix.org/aviadex/prod:latest`
  - digest `sha256:6c3666580e0d12c96e5707e97fb05a99f80c863414c0d0807be65f90c4212880`
