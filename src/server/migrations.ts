import bcrypt from "bcryptjs";
import type { ServerConfig } from "./config.js";
import type { DatabasePool } from "./db.js";
import { quoteIdentifier, tableName } from "./schema.js";

export async function migrateDatabase(pool: DatabasePool, config: ServerConfig) {
  const schema = quoteIdentifier(config.databaseSchema);
  const usersTable = tableName(config.databaseSchema, "users");
  const sessionsTable = tableName(config.databaseSchema, "auth_sessions");

  await ensureSchema(pool, config.databaseSchema, schema);

  await pool.query(`
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
  `);

  await seedAdmin(pool, config);
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
          password_hash = excluded.password_hash,
          role = 'admin',
          updated_at = now(),
          deleted_at = null
    `,
    [config.adminEmail.toLowerCase(), config.adminDisplayName, passwordHash],
  );
}
