import pg from "pg";
import type { ServerConfig } from "./config.js";

const { Pool } = pg;

export function createPool(config: ServerConfig) {
  return new Pool({
    connectionString: config.databaseUrl,
  });
}

export type DatabasePool = pg.Pool;
