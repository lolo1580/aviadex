# Changelog

All notable changes to Aviadex will be documented in this file.

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
