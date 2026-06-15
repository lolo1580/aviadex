export interface ServerConfig {
  port: number;
  databaseUrl: string;
  databaseSchema: string;
  uploadDir: string;
  maxUploadBytes: number;
  sessionCookieName: string;
  sessionTtlDays: number;
  secureCookies: boolean;
  adminEmail?: string;
  adminPassword?: string;
  adminDisplayName: string;
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function integerEnv(name: string, fallback: number, options: { min: number; max?: number }) {
  const raw = process.env[name];
  const value = raw == null || raw === "" ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < options.min || (options.max != null && value > options.max)) {
    const range = options.max == null ? `at least ${options.min}` : `between ${options.min} and ${options.max}`;
    throw new Error(`${name} must be an integer ${range}.`);
  }
  return value;
}

export function getConfig(): ServerConfig {
  return {
    port: integerEnv("PORT", 3000, { min: 1, max: 65535 }),
    databaseUrl: requireEnv("DATABASE_URL"),
    databaseSchema: process.env.DATABASE_SCHEMA ?? "aviadex",
    uploadDir: process.env.UPLOAD_DIR ?? "uploads",
    maxUploadBytes: integerEnv("MAX_UPLOAD_BYTES", 10 * 1024 * 1024, {
      min: 1024,
      max: 50 * 1024 * 1024,
    }),
    sessionCookieName: process.env.SESSION_COOKIE_NAME ?? "aviadex_session",
    sessionTtlDays: integerEnv("SESSION_TTL_DAYS", 14, { min: 1, max: 365 }),
    secureCookies: process.env.SECURE_COOKIES === "true",
    adminEmail: process.env.AVIADEX_ADMIN_EMAIL,
    adminPassword: process.env.AVIADEX_ADMIN_PASSWORD,
    adminDisplayName: process.env.AVIADEX_ADMIN_DISPLAY_NAME ?? "Aviadex Admin",
  };
}
