# Aviadex

Aviadex is an aviation collection and aircraft tracking platform for building a structured record of real-world aircraft sightings, photographs, and lifecycle history.

Version: `v1.1.0`

## Features

- Aircraft collection dashboard with registration, serial, operator, country, category, and status filtering.
- Physical aircraft profile centered on the airframe as the primary record.
- Variant-level technical reference data.
- Append-only style lifecycle timeline for registration, squadron, operator, status, and livery changes.
- Sighting and photo evidence panels.
- Map-style sighting location preview.
- English and French UI scaffolding.
- PostgreSQL-backed login with HttpOnly session cookies.
- Internal or external PostgreSQL deployment support.
- Responsive layout for desktop and mobile.

## Tech Stack

- React 19
- TypeScript
- Vite
- Node.js / Express
- PostgreSQL
- lucide-react icons

## Getting Started

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

Run the production server locally after a build:

```bash
DATABASE_URL=postgres://aviadex:change-me@localhost:5432/aviadex npm start
```

## Docker

Build the application image:

```bash
docker build -t aviadex:v1.1.0 .
```

Tag and push the development repository image:

```bash
docker tag aviadex:v1.1.0 harbor.kellerflix.org/aviadex/dev:v1.1.0
docker push harbor.kellerflix.org/aviadex/dev:v1.1.0
```

Tag and push the production repository image:

```bash
docker tag aviadex:v1.1.0 harbor.kellerflix.org/aviadex/prod:v1.1.0
docker push harbor.kellerflix.org/aviadex/prod:v1.1.0
```

Run with Docker Compose:

```bash
docker compose --env-file example.env -f exemple.compose.yml up -d
```

Stop the Compose deployment:

```bash
docker compose --env-file example.env -f exemple.compose.yml down
```

The example Compose file starts an internal `postgres:17-alpine` database. To use an external PostgreSQL server, change `DATABASE_URL` in `example.env` and remove or ignore the bundled `postgres` service.

## Project Structure

- `src/domain`: aircraft domain types and core concepts.
- `src/application`: application-level search and collection logic.
- `src/infrastructure`: sample data and future integration boundary.
- `src/server`: Express API, PostgreSQL migration, and session authentication.
- `src/ui`: React UI, components, i18n, and styles.
- `docs`: project rules, architecture notes, and product description.

## Architecture Notes

Aviadex starts as a modular monolith with clean boundaries between UI, business logic, data access, and infrastructure. Physical aircraft are treated as the central entity, while technical specifications belong to aircraft variants.
