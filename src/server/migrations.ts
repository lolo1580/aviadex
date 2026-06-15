import bcrypt from "bcryptjs";
import { collection } from "./seedData.js";
import type { ServerConfig } from "./config.js";
import type { DatabasePool } from "./db.js";
import { quoteIdentifier, tableName } from "./schema.js";

export async function migrateDatabase(pool: DatabasePool, config: ServerConfig) {
  const schema = quoteIdentifier(config.databaseSchema);
  const usersTable = tableName(config.databaseSchema, "users");
  const sessionsTable = tableName(config.databaseSchema, "auth_sessions");
  const countriesTable = tableName(config.databaseSchema, "countries");
  const manufacturersTable = tableName(config.databaseSchema, "manufacturers");
  const modelsTable = tableName(config.databaseSchema, "aircraft_models");
  const variantsTable = tableName(config.databaseSchema, "aircraft_variants");
  const operatorsTable = tableName(config.databaseSchema, "operators");
  const squadronsTable = tableName(config.databaseSchema, "squadrons");
  const locationsTable = tableName(config.databaseSchema, "locations");
  const airBasesTable = tableName(config.databaseSchema, "air_bases");
  const aircraftTable = tableName(config.databaseSchema, "physical_aircraft");
  const eventsTable = tableName(config.databaseSchema, "aircraft_lifecycle_events");
  const sightingsTable = tableName(config.databaseSchema, "sightings");
  const photosTable = tableName(config.databaseSchema, "photos");

  await ensureSchema(pool, config.databaseSchema, schema);

  await pool.query(`
    create extension if not exists pgcrypto;

    create table if not exists ${usersTable} (
      id uuid primary key default gen_random_uuid(),
      email text not null unique,
      display_name text not null,
      password_hash text not null,
      role text not null default 'viewer',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      deleted_at timestamptz null
    );

    create table if not exists ${sessionsTable} (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references ${usersTable}(id) on delete cascade,
      token_hash text not null unique,
      expires_at timestamptz not null,
      created_at timestamptz not null default now()
    );

    create index if not exists auth_sessions_user_id_idx on ${sessionsTable}(user_id);
    create index if not exists auth_sessions_expires_at_idx on ${sessionsTable}(expires_at);

    create table if not exists ${countriesTable} (
      iso2 text primary key,
      iso3 text not null,
      default_name text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists ${manufacturersTable} (
      id text primary key,
      name text not null,
      country_iso2 text references ${countriesTable}(iso2),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists ${modelsTable} (
      id text primary key,
      manufacturer_id text not null references ${manufacturersTable}(id),
      name text not null,
      category text not null,
      introduced_year integer null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists ${variantsTable} (
      id text primary key,
      model_id text not null references ${modelsTable}(id),
      name text not null,
      role text not null,
      first_flight_year integer null,
      introduced_year integer null,
      specs jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists ${operatorsTable} (
      id text primary key,
      name text not null,
      country_iso2 text references ${countriesTable}(iso2),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists ${squadronsTable} (
      id text primary key,
      name text not null,
      operator_id text references ${operatorsTable}(id),
      country_iso2 text references ${countriesTable}(iso2),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists ${locationsTable} (
      id text primary key,
      name text not null,
      country_iso2 text references ${countriesTable}(iso2),
      latitude numeric(9,6) null,
      longitude numeric(9,6) null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists ${airBasesTable} (
      id text primary key,
      location_id text references ${locationsTable}(id),
      name text not null,
      icao_code text null,
      country_iso2 text references ${countriesTable}(iso2),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists ${aircraftTable} (
      id text primary key,
      variant_id text not null references ${variantsTable}(id),
      serial_number text not null,
      current_registration text not null,
      current_operator text not null,
      current_squadron text null,
      current_country_iso2 text references ${countriesTable}(iso2),
      current_status text not null,
      livery text not null,
      built_year integer null,
      notes text not null default '',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists ${eventsTable} (
      id text primary key,
      aircraft_id text not null references ${aircraftTable}(id) on delete cascade,
      event_date date not null,
      event_type text not null,
      label text not null,
      detail text not null default '',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists ${sightingsTable} (
      id text primary key,
      aircraft_id text not null references ${aircraftTable}(id) on delete cascade,
      sighting_date date not null,
      location_id text references ${locationsTable}(id),
      location_name text not null,
      country_iso2 text references ${countriesTable}(iso2),
      latitude numeric(9,6) null,
      longitude numeric(9,6) null,
      event_name text null,
      photographer text not null default '',
      notes text not null default '',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists ${photosTable} (
      id text primary key,
      sighting_id text not null references ${sightingsTable}(id) on delete cascade,
      aircraft_id text not null references ${aircraftTable}(id) on delete cascade,
      title text not null,
      caption text not null default '',
      taken_at timestamptz null,
      location_id text references ${locationsTable}(id),
      visibility text not null default 'private',
      file_path text not null,
      thumbnail_path text null,
      original_filename text not null,
      content_type text not null,
      file_size integer not null,
      camera_make text null,
      camera_model text null,
      lens_model text null,
      focal_length text null,
      exposure_time text null,
      aperture text null,
      iso integer null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists physical_aircraft_variant_id_idx on ${aircraftTable}(variant_id);
    create index if not exists lifecycle_aircraft_date_idx on ${eventsTable}(aircraft_id, event_date);
    create index if not exists sightings_aircraft_date_idx on ${sightingsTable}(aircraft_id, sighting_date);
    create index if not exists photos_sighting_id_idx on ${photosTable}(sighting_id);
    create index if not exists photos_aircraft_id_idx on ${photosTable}(aircraft_id);
  `);

  await pool.query(`
    do $$
    begin
      if not exists (select 1 from pg_constraint where conname = 'physical_aircraft_status_check') then
        alter table ${aircraftTable}
          add constraint physical_aircraft_status_check
          check (current_status in ('active', 'stored', 'retired', 'preserved', 'scrapped'));
      end if;

      if not exists (select 1 from pg_constraint where conname = 'lifecycle_event_type_check') then
        alter table ${eventsTable}
          add constraint lifecycle_event_type_check
          check (event_type in ('registration', 'operator', 'squadron', 'status', 'livery'));
      end if;

      if not exists (select 1 from pg_constraint where conname = 'sightings_latitude_check') then
        alter table ${sightingsTable}
          add constraint sightings_latitude_check
          check (latitude is null or (latitude >= -90 and latitude <= 90));
      end if;

      if not exists (select 1 from pg_constraint where conname = 'sightings_longitude_check') then
        alter table ${sightingsTable}
          add constraint sightings_longitude_check
          check (longitude is null or (longitude >= -180 and longitude <= 180));
      end if;

      if not exists (select 1 from pg_constraint where conname = 'locations_latitude_check') then
        alter table ${locationsTable}
          add constraint locations_latitude_check
          check (latitude is null or (latitude >= -90 and latitude <= 90));
      end if;

      if not exists (select 1 from pg_constraint where conname = 'locations_longitude_check') then
        alter table ${locationsTable}
          add constraint locations_longitude_check
          check (longitude is null or (longitude >= -180 and longitude <= 180));
      end if;

      if not exists (select 1 from pg_constraint where conname = 'photos_visibility_check') then
        alter table ${photosTable}
          add constraint photos_visibility_check
          check (visibility in ('private', 'public'));
      end if;

      if not exists (select 1 from pg_constraint where conname = 'sightings_id_aircraft_unique') then
        alter table ${sightingsTable}
          add constraint sightings_id_aircraft_unique unique (id, aircraft_id);
      end if;

      if not exists (select 1 from pg_constraint where conname = 'photos_sighting_aircraft_match_fkey') then
        alter table ${photosTable}
          add constraint photos_sighting_aircraft_match_fkey
          foreign key (sighting_id, aircraft_id)
          references ${sightingsTable}(id, aircraft_id)
          on delete cascade;
      end if;
    end
    $$;
  `);

  await seedAdmin(pool, config);
  await seedSampleData(pool, config);
}

async function ensureSchema(
  pool: DatabasePool,
  schemaName: string,
  quotedSchemaName: string,
) {
  const result = await pool.query<{ exists: boolean }>(
    "select exists (select 1 from information_schema.schemata where schema_name = $1)",
    [schemaName],
  );

  if (!result.rows[0]?.exists) {
    await pool.query(`create schema ${quotedSchemaName}`);
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

const countryFallbacks = {
  CH: { iso2: "CH", iso3: "CHE", defaultName: "Switzerland" },
  FI: { iso2: "FI", iso3: "FIN", defaultName: "Finland" },
  FR: { iso2: "FR", iso3: "FRA", defaultName: "France" },
  US: { iso2: "US", iso3: "USA", defaultName: "United States" },
} as const;

function ensureCountry(
  countries: Map<string, { iso2: string; iso3: string; defaultName: string }>,
  iso2: string | null | undefined,
) {
  if (!iso2 || countries.has(iso2)) {
    return;
  }

  countries.set(
    iso2,
    countryFallbacks[iso2 as keyof typeof countryFallbacks] ?? {
      iso2,
      iso3: iso2,
      defaultName: iso2,
    },
  );
}

async function seedSampleData(pool: DatabasePool, config: ServerConfig) {
  const countries = new Map<string, { iso2: string; iso3: string; defaultName: string }>();
  const manufacturers = new Map<string, { id: string; name: string; countryIso2: string }>();
  const models = new Map<string, unknown>();
  const variants = new Map<string, unknown>();
  const operators = new Map<string, { id: string; name: string; countryIso2: string }>();
  const squadrons = new Map<string, { id: string; name: string; operatorId: string; countryIso2: string }>();

  for (const aircraft of collection) {
    countries.set(aircraft.country.iso2, aircraft.country);
    ensureCountry(countries, aircraft.manufacturer.countryIso2);
    ensureCountry(countries, aircraft.currentCountryIso2);
    manufacturers.set(aircraft.manufacturer.id, aircraft.manufacturer);
    models.set(aircraft.model.id, aircraft.model);
    variants.set(aircraft.variant.id, aircraft.variant);
    operators.set(slugify(aircraft.currentOperator), {
      id: slugify(aircraft.currentOperator),
      name: aircraft.currentOperator,
      countryIso2: aircraft.currentCountryIso2,
    });
    for (const sighting of aircraft.sightings) {
      ensureCountry(countries, sighting.countryIso2);
    }
    if (aircraft.currentSquadron) {
      squadrons.set(slugify(aircraft.currentSquadron), {
        id: slugify(aircraft.currentSquadron),
        name: aircraft.currentSquadron,
        operatorId: slugify(aircraft.currentOperator),
        countryIso2: aircraft.currentCountryIso2,
      });
    }
  }

  for (const country of countries.values()) {
    await pool.query(
      `insert into ${tableName(config.databaseSchema, "countries")} (iso2, iso3, default_name)
       values ($1, $2, $3)
       on conflict (iso2) do nothing`,
      [country.iso2, country.iso3, country.defaultName],
    );
  }

  for (const manufacturer of manufacturers.values()) {
    await pool.query(
      `insert into ${tableName(config.databaseSchema, "manufacturers")} (id, name, country_iso2)
       values ($1, $2, $3)
       on conflict (id) do nothing`,
      [manufacturer.id, manufacturer.name, manufacturer.countryIso2],
    );
  }

  for (const model of models.values() as Iterable<{
    id: string;
    manufacturerId: string;
    name: string;
    category: string;
    introducedYear?: number;
  }>) {
    await pool.query(
      `insert into ${tableName(config.databaseSchema, "aircraft_models")} (id, manufacturer_id, name, category, introduced_year)
       values ($1, $2, $3, $4, $5)
       on conflict (id) do nothing`,
      [model.id, model.manufacturerId, model.name, model.category, model.introducedYear ?? null],
    );
  }

  for (const variant of variants.values() as Iterable<{
    id: string;
    modelId: string;
    name: string;
    role: string;
    firstFlightYear?: number;
    introducedYear?: number;
    specs: unknown;
  }>) {
    await pool.query(
      `insert into ${tableName(config.databaseSchema, "aircraft_variants")} (id, model_id, name, role, first_flight_year, introduced_year, specs)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (id) do nothing`,
      [
        variant.id,
        variant.modelId,
        variant.name,
        variant.role,
        variant.firstFlightYear ?? null,
        variant.introducedYear ?? null,
        JSON.stringify(variant.specs),
      ],
    );
  }

  for (const operator of operators.values()) {
    await pool.query(
      `insert into ${tableName(config.databaseSchema, "operators")} (id, name, country_iso2)
       values ($1, $2, $3)
       on conflict (id) do nothing`,
      [operator.id, operator.name, operator.countryIso2],
    );
  }

  for (const squadron of squadrons.values()) {
    await pool.query(
      `insert into ${tableName(config.databaseSchema, "squadrons")} (id, name, operator_id, country_iso2)
       values ($1, $2, $3, $4)
       on conflict (id) do nothing`,
      [squadron.id, squadron.name, squadron.operatorId, squadron.countryIso2],
    );
  }

  for (const aircraft of collection) {
    await pool.query(
      `insert into ${tableName(config.databaseSchema, "physical_aircraft")}
       (id, variant_id, serial_number, current_registration, current_operator, current_squadron, current_country_iso2, current_status, livery, built_year, notes)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       on conflict (id) do nothing`,
      [
        aircraft.id,
        aircraft.variantId,
        aircraft.serialNumber,
        aircraft.currentRegistration,
        aircraft.currentOperator,
        aircraft.currentSquadron ?? null,
        aircraft.currentCountryIso2,
        aircraft.currentStatus,
        aircraft.livery,
        aircraft.builtYear ?? null,
        aircraft.notes,
      ],
    );

    for (const event of aircraft.history) {
      await pool.query(
        `insert into ${tableName(config.databaseSchema, "aircraft_lifecycle_events")}
         (id, aircraft_id, event_date, event_type, label, detail)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (id) do nothing`,
        [event.id, aircraft.id, event.date, event.type, event.label, event.detail],
      );
    }

    for (const sighting of aircraft.sightings) {
      const locationId = slugify(sighting.location);
      await pool.query(
        `insert into ${tableName(config.databaseSchema, "locations")}
         (id, name, country_iso2, latitude, longitude)
         values ($1, $2, $3, $4, $5)
         on conflict (id) do nothing`,
        [locationId, sighting.location, sighting.countryIso2, sighting.latitude, sighting.longitude],
      );
      if (/air base/i.test(sighting.location)) {
        await pool.query(
          `insert into ${tableName(config.databaseSchema, "air_bases")} (id, location_id, name, country_iso2)
           values ($1, $2, $3, $4)
           on conflict (id) do nothing`,
          [locationId, locationId, sighting.location, sighting.countryIso2],
        );
      }
      await pool.query(
        `insert into ${tableName(config.databaseSchema, "sightings")}
         (id, aircraft_id, sighting_date, location_id, location_name, country_iso2, latitude, longitude, event_name, photographer)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         on conflict (id) do nothing`,
        [
          sighting.id,
          aircraft.id,
          sighting.date,
          locationId,
          sighting.location,
          sighting.countryIso2,
          sighting.latitude,
          sighting.longitude,
          sighting.event ?? null,
          sighting.photographer,
        ],
      );
    }
  }
}

async function seedAdmin(pool: DatabasePool, config: ServerConfig) {
  if (!config.adminEmail || !config.adminPassword) {
    return;
  }

  const passwordHash = await bcrypt.hash(config.adminPassword, 12);
  const usersTable = tableName(config.databaseSchema, "users");

  await pool.query(
    `
      insert into ${usersTable} (email, display_name, password_hash, role)
      values ($1, $2, $3, 'admin')
      on conflict (email) do update
      set display_name = excluded.display_name,
          role = 'admin',
          updated_at = now(),
          deleted_at = null
    `,
    [config.adminEmail.toLowerCase(), config.adminDisplayName, passwordHash],
  );
}
