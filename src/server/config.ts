export interface ServerConfig {
  port: number;
  databaseUrl: string;
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

export function getConfig(): ServerConfig {
  return {
    port: Number(process.env.PORT ?? 3000),
    databaseUrl: requireEnv("DATABASE_URL"),
    sessionCookieName: process.env.SESSION_COOKIE_NAME ?? "aviadex_session",
    sessionTtlDays: Number(process.env.SESSION_TTL_DAYS ?? 14),
    secureCookies: process.env.SECURE_COOKIES === "true",
    adminEmail: process.env.AVIADEX_ADMIN_EMAIL,
    adminPassword: process.env.AVIADEX_ADMIN_PASSWORD,
    adminDisplayName: process.env.AVIADEX_ADMIN_DISPLAY_NAME ?? "Aviadex Admin",
  };
}
