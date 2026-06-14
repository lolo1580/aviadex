import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import express from "express";
import {
  clearSessionCookie,
  createSession,
  deleteSession,
  getSessionUser,
  serializeUser,
  setSessionCookie,
  verifyPasswordLogin,
} from "./auth.js";
import { getConfig } from "./config.js";
import { createPool } from "./db.js";
import { migrateDatabase } from "./migrations.js";

const config = getConfig();
const pool = createPool(config);
const app = express();
const dirname = path.dirname(fileURLToPath(import.meta.url));
const staticRoot = path.resolve(dirname, "../dist");

app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));
app.use(cookieParser());

app.get("/api/v1/health", async (_request, response) => {
  try {
    await pool.query("select 1");
    response.json({ ok: true, database: "connected" });
  } catch {
    response.status(503).json({ ok: false, database: "unavailable" });
  }
});

app.post("/api/v1/auth/login", async (request, response) => {
  const { email, password } = request.body as {
    email?: unknown;
    password?: unknown;
  };

  if (typeof email !== "string" || typeof password !== "string") {
    response.status(400).json({ error: "Email and password are required." });
    return;
  }

  const user = await verifyPasswordLogin(pool, email, password);
  if (!user) {
    response.status(401).json({ error: "Invalid email or password." });
    return;
  }

  const session = await createSession(pool, user.id, config);
  setSessionCookie(response, config, session.token, session.expiresAt);
  response.json({ user: serializeUser(user) });
});

app.get("/api/v1/auth/me", async (request, response) => {
  const user = await getSessionUser(pool, request, config);
  if (!user) {
    response.status(401).json({ error: "Not authenticated." });
    return;
  }

  response.json({ user: serializeUser(user) });
});

app.post("/api/v1/auth/logout", async (request, response) => {
  await deleteSession(pool, request, config);
  clearSessionCookie(response, config);
  response.status(204).send();
});

app.use(express.static(staticRoot, { index: false }));

app.get(/^(?!\/api\/).*/, (_request, response) => {
  response.sendFile(path.join(staticRoot, "index.html"));
});

await migrateDatabase(pool, config);

app.listen(config.port, () => {
  console.log(`Aviadex listening on port ${config.port}`);
});
