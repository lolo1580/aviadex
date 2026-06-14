import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import type { ServerConfig } from "./config.js";
import type { DatabasePool } from "./db.js";

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
}

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  role: string;
}

export function hashSessionToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createSessionToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function sessionExpiresAt(config: ServerConfig) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + config.sessionTtlDays);
  return expiresAt;
}

export function setSessionCookie(
  response: Response,
  config: ServerConfig,
  token: string,
  expiresAt: Date,
) {
  response.cookie(config.sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.secureCookies,
    expires: expiresAt,
    path: "/",
  });
}

export function clearSessionCookie(response: Response, config: ServerConfig) {
  response.clearCookie(config.sessionCookieName, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.secureCookies,
    path: "/",
  });
}

export async function verifyPasswordLogin(
  pool: DatabasePool,
  email: string,
  password: string,
): Promise<AuthenticatedUser | null> {
  const result = await pool.query<UserRow>(
    `
      select id, email, display_name, password_hash, role
      from users
      where email = $1 and deleted_at is null
      limit 1
    `,
    [email.toLowerCase()],
  );

  const user = result.rows[0];
  if (!user) {
    return null;
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    return null;
  }

  return toAuthenticatedUser(user);
}

export async function createSession(
  pool: DatabasePool,
  userId: string,
  config: ServerConfig,
) {
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = sessionExpiresAt(config);

  await pool.query(
    `
      insert into auth_sessions (user_id, token_hash, expires_at)
      values ($1, $2, $3)
    `,
    [userId, tokenHash, expiresAt],
  );

  return { token, expiresAt };
}

export async function getSessionUser(
  pool: DatabasePool,
  request: Request,
  config: ServerConfig,
): Promise<AuthenticatedUser | null> {
  const token = request.cookies?.[config.sessionCookieName];
  if (typeof token !== "string" || !token) {
    return null;
  }

  const result = await pool.query<UserRow>(
    `
      select users.id, users.email, users.display_name, users.role, users.password_hash
      from auth_sessions
      join users on users.id = auth_sessions.user_id
      where auth_sessions.token_hash = $1
        and auth_sessions.expires_at > now()
        and users.deleted_at is null
      limit 1
    `,
    [hashSessionToken(token)],
  );

  const user = result.rows[0];
  return user ? toAuthenticatedUser(user) : null;
}

export async function deleteSession(
  pool: DatabasePool,
  request: Request,
  config: ServerConfig,
) {
  const token = request.cookies?.[config.sessionCookieName];
  if (typeof token !== "string" || !token) {
    return;
  }

  await pool.query("delete from auth_sessions where token_hash = $1", [
    hashSessionToken(token),
  ]);
}

export function serializeUser(user: AuthenticatedUser) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  };
}

function toAuthenticatedUser(user: UserRow): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    role: user.role,
  };
}
