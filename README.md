# Aviadex

Aviadex is an aviation collection and aircraft tracking platform for building a structured record of real-world aircraft sightings, photographs, and lifecycle history.

Version: `v1.0.0`

Current production image tags:

- `harbor.kellerflix.org/aviadex/prod:v1.0.0`
- `harbor.kellerflix.org/aviadex/prod:latest`

## Features

- Aircraft collection dashboard with registration, serial, operator, country, category, and status filtering.
- Route-backed pages for collection, Planepedia, map, timeline, and reference data.
- Planepedia model encyclopedia linking technical model/variant records to matching physical aircraft in the collection.
- Admin create/edit forms for Planepedia aircraft models and variants.
- Physical aircraft record layout centered on the airframe as the primary record.
- Aircraft detail view with identity hero, contextual metrics, and tabs for overview, photos, sightings, timeline, technical data, and admin workflows.
- Variant-level technical reference data.
- Global lifecycle timeline with aircraft, event type, and date range filters.
- Sighting and photo evidence views with upload support.
- Authenticated admin forms for reference records, Planepedia records, physical aircraft, and sightings, separated from read-only consultation views.
- OpenStreetMap-backed sighting map page with Leaflet markers and popups.
- English and French UI scaffolding.
- PostgreSQL-backed login with HttpOnly session cookies.
- Filesystem-backed photo storage with database metadata and private/public visibility handling.
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
DATABASE_URL=postgres://aviadex:change-me@localhost:5432/aviadex DATABASE_SCHEMA=aviadex npm start
```

## Docker

Build the application image:

```bash
docker build -t aviadex:v1.0.0 .
```

Tag and push the production repository image:

```bash
docker tag aviadex:v1.0.0 harbor.kellerflix.org/aviadex/prod:v1.0.0
docker tag aviadex:v1.0.0 harbor.kellerflix.org/aviadex/prod:latest
docker push harbor.kellerflix.org/aviadex/prod:v1.0.0
docker push harbor.kellerflix.org/aviadex/prod:latest
```

The latest pushed digest for both production tags is:

```text
sha256:a02fdb901b30c792cdb33a7fd25d9bc4ad9201ef6beee9484365bccf475c5be3
```

Run with Docker Compose:

```bash
docker compose --env-file example.env -f exemple.compose.yml up -d
```

Stop the Compose deployment:

```bash
docker compose --env-file example.env -f exemple.compose.yml down
```

The example Compose file starts an internal `postgres:17-alpine` database and mounts persistent volumes for PostgreSQL data and uploaded photos. To use an external PostgreSQL server, change `DATABASE_URL` in `example.env`, set `DATABASE_SCHEMA`, and remove or ignore the bundled `postgres` service.

## Photo Storage

Uploaded images are stored on disk under `UPLOAD_DIR`, which defaults to `uploads`. PostgreSQL stores file references and metadata only.

For container deployments, mount `UPLOAD_DIR` to persistent storage. The example Compose file mounts `aviadex-upload-data` to `/app/uploads`.

Useful environment variables:

```bash
UPLOAD_DIR=uploads
MAX_UPLOAD_BYTES=10485760
```

## Database Setup

Aviadex stores its tables in the schema named by `DATABASE_SCHEMA`, which defaults to `aviadex`. The internal Compose database works with the defaults.

For an external PostgreSQL database, run this once as a database owner or administrator before starting Aviadex:

```sql
create user aviadex with password 'change-me';
create database aviadex owner aviadex;
\connect aviadex
create schema if not exists aviadex authorization aviadex;
grant usage, create on schema aviadex to aviadex;
```

If you want to keep the app in `public` instead, set `DATABASE_SCHEMA=public` and grant schema creation rights to the app role:

```sql
grant usage, create on schema public to aviadex;
```

## User Management

Aviadex stores users in PostgreSQL. Passwords are stored as bcrypt hashes in the `users.password_hash` column.

On startup, Aviadex can create the first admin user from these environment variables:

```bash
AVIADEX_ADMIN_EMAIL=admin@aviadex.local
AVIADEX_ADMIN_PASSWORD=change-this-password
AVIADEX_ADMIN_DISPLAY_NAME=Aviadex Admin
```

If the admin already exists, Aviadex updates the display name, role, and deletion state, but it does not overwrite the existing password hash on every restart.

To create another user manually, run the SQL below against the Aviadex database. Install `pgcrypto` once as a database owner if you want PostgreSQL to generate a bcrypt-compatible hash with `crypt()`.

```sql
create extension if not exists pgcrypto;
```

### Docker Compose Postgres

Open `psql` in the internal Compose database:

```bash
docker compose --env-file example.env -f exemple.compose.yml exec postgres \
  psql -U aviadex -d aviadex
```

Create a user:

```sql
insert into aviadex.users (email, display_name, password_hash, role)
values (
  'spotter@example.com',
  'Spotter User',
  crypt('replace-with-a-strong-password', gen_salt('bf', 12)),
  'contributor'
);
```

Available roles are currently `admin`, `curator`, `contributor`, and `viewer`.

### External Or Non-Docker Postgres

Connect with your external `DATABASE_URL`:

```bash
psql "$DATABASE_URL"
```

Create the user with the same SQL:

```sql
insert into aviadex.users (email, display_name, password_hash, role)
values (
  'spotter@example.com',
  'Spotter User',
  crypt('replace-with-a-strong-password', gen_salt('bf', 12)),
  'contributor'
);
```

To reset an existing user's password:

```sql
update aviadex.users
set password_hash = crypt('new-strong-password', gen_salt('bf', 12)),
    updated_at = now()
where email = 'spotter@example.com';
```

## Project Structure

- `src/domain`: aircraft domain types and core concepts.
- `src/application`: application-level search and collection logic.
- `src/infrastructure`: sample data and future integration boundary.
- `src/server`: Express API, PostgreSQL migration, and session authentication.
- `src/ui`: React UI, components, i18n, and styles.
- `docs`: project rules, architecture notes, and product description.

## Architecture Notes

Aviadex starts as a modular monolith with clean boundaries between UI, business logic, data access, and infrastructure. Physical aircraft are treated as the central entity, while technical specifications belong to aircraft variants.
