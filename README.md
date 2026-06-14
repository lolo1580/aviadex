# Aviadex

Aviadex is an aviation collection and aircraft tracking platform for building a structured record of real-world aircraft sightings, photographs, and lifecycle history.

Version: `v1.0.1`

## Features

- Aircraft collection dashboard with registration, serial, operator, country, category, and status filtering.
- Physical aircraft profile centered on the airframe as the primary record.
- Variant-level technical reference data.
- Append-only style lifecycle timeline for registration, squadron, operator, status, and livery changes.
- Sighting and photo evidence panels.
- Map-style sighting location preview.
- English and French UI scaffolding.
- Responsive layout for desktop and mobile.

## Tech Stack

- React 19
- TypeScript
- Vite
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

## Docker

Build the application image:

```bash
docker build -t aviadex:v1.0.1 .
```

Tag and push the development repository image:

```bash
docker tag aviadex:v1.0.1 harbor.kellerflix.org/aviadex/dev:v1.0.1
docker push harbor.kellerflix.org/aviadex/dev:v1.0.1
```

Tag and push the production repository image:

```bash
docker tag aviadex:v1.0.1 harbor.kellerflix.org/aviadex/prod:v1.0.1
docker push harbor.kellerflix.org/aviadex/prod:v1.0.1
```

## Project Structure

- `src/domain`: aircraft domain types and core concepts.
- `src/application`: application-level search and collection logic.
- `src/infrastructure`: sample data and future integration boundary.
- `src/ui`: React UI, components, i18n, and styles.
- `docs`: project rules, architecture notes, and product description.

## Architecture Notes

Aviadex starts as a modular monolith with clean boundaries between UI, business logic, data access, and infrastructure. Physical aircraft are treated as the central entity, while technical specifications belong to aircraft variants.
