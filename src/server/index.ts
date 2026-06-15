import crypto from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import express from "express";
import multer from "multer";
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
import { tableName } from "./schema.js";

const config = getConfig();
const pool = createPool(config);
const app = express();
const dirname = path.dirname(fileURLToPath(import.meta.url));
const staticRoot = path.resolve(dirname, "../dist");
const uploadRoot = path.resolve(process.cwd(), config.uploadDir);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes, files: 12 },
});

type AsyncHandler = (
  request: express.Request,
  response: express.Response,
  next: express.NextFunction,
) => Promise<void>;

class ApiInputError extends Error {}

interface DatabaseError extends Error {
  code?: string;
  constraint?: string;
  detail?: string;
}

const referenceTables = {
  countries: ["countries", "iso2", ["iso2", "iso3", "default_name"]],
  manufacturers: ["manufacturers", "id", ["id", "name", "country_iso2"]],
  models: ["aircraft_models", "id", ["id", "manufacturer_id", "name", "category", "introduced_year"]],
  variants: [
    "aircraft_variants",
    "id",
    ["id", "model_id", "name", "role", "first_flight_year", "introduced_year", "specs"],
  ],
  operators: ["operators", "id", ["id", "name", "country_iso2"]],
  squadrons: ["squadrons", "id", ["id", "name", "operator_id", "country_iso2"]],
  locations: ["locations", "id", ["id", "name", "country_iso2", "latitude", "longitude"]],
  airBases: ["air_bases", "id", ["id", "location_id", "name", "icao_code", "country_iso2"]],
} as const;

const aircraftStatuses = ["active", "stored", "retired", "preserved", "scrapped"] as const;
const photoVisibilities = ["private", "public"] as const;

app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));
app.use(cookieParser());
app.get("/uploads/:filename", asyncRoute(async (request, response) => {
  const filename = path.basename(String(request.params.filename));
  if (filename !== request.params.filename) {
    sendError(response, 400, "invalid_input", "Invalid file path.");
    return;
  }

  const filePath = `/uploads/${filename}`;
  const result = await pool.query(
    `select file_path, content_type, visibility from ${tn("photos")} where file_path = $1 limit 1`,
    [filePath],
  );
  const photo = result.rows[0];
  if (!photo) {
    sendError(response, 404, "not_found", "File not found.");
    return;
  }
  if (photo.visibility !== "public" && !(await getSessionUser(pool, request, config))) {
    sendError(response, 401, "not_authenticated", "Authentication is required.");
    return;
  }

  response.type(photo.content_type);
  response.sendFile(path.join(uploadRoot, filename));
}));

app.get("/api/v1/health", asyncRoute(async (_request, response) => {
  try {
    await pool.query("select 1");
    response.json({ ok: true, database: "connected" });
  } catch {
    response.status(503).json({ ok: false, database: "unavailable" });
  }
}));

app.post("/api/v1/auth/login", asyncRoute(async (request, response) => {
  const { email, password } = request.body as { email?: unknown; password?: unknown };
  if (typeof email !== "string" || typeof password !== "string") {
    sendError(response, 400, "invalid_input", "Email and password are required.");
    return;
  }

  const user = await verifyPasswordLogin(pool, config, email, password);
  if (!user) {
    sendError(response, 401, "invalid_credentials", "Invalid email or password.");
    return;
  }

  const session = await createSession(pool, user.id, config);
  setSessionCookie(response, config, session.token, session.expiresAt);
  response.json({ user: serializeUser(user) });
}));

app.get("/api/v1/auth/me", asyncRoute(async (request, response) => {
  const user = await getSessionUser(pool, request, config);
  if (!user) {
    sendError(response, 401, "not_authenticated", "Not authenticated.");
    return;
  }
  response.json({ user: serializeUser(user) });
}));

app.post("/api/v1/auth/logout", asyncRoute(async (request, response) => {
  await deleteSession(pool, request, config);
  clearSessionCookie(response, config);
  response.status(204).send();
}));

app.get("/api/v1/collection", asyncRoute(async (_request, response) => {
  response.json({ aircraft: await loadCollection() });
}));

app.get("/api/v1/map", asyncRoute(async (_request, response) => {
  const rows = await pool.query(`
    select s.id, s.sighting_date, s.location_name, s.latitude, s.longitude,
           a.id as aircraft_id, a.current_registration, count(p.id)::int as photo_count
    from ${tn("sightings")} s
    join ${tn("physical_aircraft")} a on a.id = s.aircraft_id
    left join ${tn("photos")} p on p.sighting_id = s.id
    where s.latitude is not null and s.longitude is not null
    group by s.id, a.id
    order by s.sighting_date desc
  `);
  response.json({
    markers: rows.rows.map((row) => ({
      id: row.id,
      aircraftId: row.aircraft_id,
      registration: row.current_registration,
      locationName: row.location_name,
      sightingDate: row.sighting_date,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      photoCount: row.photo_count,
    })),
  });
}));

app.get("/api/v1/timeline", asyncRoute(async (request, response) => {
  const params: string[] = [];
  const filters: string[] = [];
  const from = typeof request.query.from === "string" ? request.query.from : "";
  const to = typeof request.query.to === "string" ? request.query.to : "";
  const parsedFrom = from ? parseDateString(from, "from") : "";
  const parsedTo = to ? parseDateString(to, "to") : "";
  if (parsedFrom && parsedTo && parsedFrom > parsedTo) {
    sendError(response, 400, "invalid_input", "from must be before or equal to to.");
    return;
  }
  for (const [key, column] of [
    ["aircraftId", "aircraft_id"],
    ["eventType", "event_type"],
  ] as const) {
    const value = typeof request.query[key] === "string" ? request.query[key] : "";
    if (value) {
      params.push(value);
      filters.push(`${column} = $${params.length}`);
    }
  }
  for (const [value, operator] of [[parsedFrom, ">="], [parsedTo, "<="]] as const) {
    if (value) {
      params.push(value);
      filters.push(`event_date ${operator} $${params.length}`);
    }
  }

  const rows = await pool.query(
    `
      select * from (
        select e.id, e.aircraft_id, a.current_registration, e.event_date, e.event_type, e.label, e.detail
        from ${tn("aircraft_lifecycle_events")} e
        join ${tn("physical_aircraft")} a on a.id = e.aircraft_id
        union all
        select s.id, s.aircraft_id, a.current_registration, s.sighting_date, 'sighting',
               'Sighting at ' || s.location_name, coalesce(s.event_name, '')
        from ${tn("sightings")} s
        join ${tn("physical_aircraft")} a on a.id = s.aircraft_id
      ) timeline
      ${filters.length ? `where ${filters.join(" and ")}` : ""}
      order by event_date asc, current_registration asc
    `,
    params,
  );
  response.json({
    events: rows.rows.map((row) => ({
      id: row.id,
      aircraftId: row.aircraft_id,
      registration: row.current_registration,
      date: row.event_date,
      type: row.event_type,
      label: row.label,
      detail: row.detail,
    })),
  });
}));

app.get("/api/v1/reference", asyncRoute(async (_request, response) => {
  const reference: Record<string, unknown[]> = {};
  for (const key of Object.keys(referenceTables) as Array<keyof typeof referenceTables>) {
    const [table, , columns] = referenceTables[key];
    const rows = await pool.query(`select ${columns.join(", ")} from ${tn(table)} order by 1 asc`);
    reference[key] = rows.rows;
  }
  response.json({ reference });
}));

app.get("/api/v1/reference/:type", asyncRoute(async (request, response) => {
  const ref = referenceConfig(String(request.params.type));
  if (!ref) {
    sendError(response, 404, "not_found", "Unknown reference type.");
    return;
  }
  const [table, , columns] = ref;
  const rows = await pool.query(`select ${columns.join(", ")} from ${tn(table)} order by 1 asc`);
  response.json({ items: rows.rows });
}));

app.post("/api/v1/reference/:type", asyncRoute(async (request, response) => {
  if (!(await requireAdmin(request, response))) return;
  const ref = referenceConfig(String(request.params.type));
  if (!ref) {
    sendError(response, 404, "not_found", "Unknown reference type.");
    return;
  }
  const [table, , columns] = ref;
  const body = request.body as Record<string, unknown>;
  const values = columns.map((column) => coerceReferenceValue(body, column));
  const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
  const result = await pool.query(
    `insert into ${tn(table)} (${columns.join(", ")}) values (${placeholders}) returning ${columns.join(", ")}`,
    values,
  );
  response.status(201).json({ item: result.rows[0] });
}));

app.post("/api/v1/collection", asyncRoute(async (request, response) => {
  if (!(await requireAdmin(request, response))) return;
  const body = request.body as Record<string, unknown>;
  const id = optionalString(body, "id") ?? slugify(requireString(body, "currentRegistration", 40));
  const result = await pool.query(
    `
      insert into ${tn("physical_aircraft")}
      (id, variant_id, serial_number, current_registration, current_operator, current_squadron,
       current_country_iso2, current_status, livery, built_year, notes)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      returning *
    `,
    [
      id,
      requireString(body, "variantId"),
      requireString(body, "serialNumber"),
      requireString(body, "currentRegistration", 40),
      requireString(body, "currentOperator"),
      optionalString(body, "currentSquadron"),
      requireString(body, "currentCountryIso2", 2),
      requireEnum(body, "currentStatus", aircraftStatuses),
      requireString(body, "livery"),
      optionalInteger(body, "builtYear", 1900, 2100),
      optionalString(body, "notes", 4000) ?? "",
    ],
  );
  response.status(201).json({ aircraft: result.rows[0] });
}));

app.put("/api/v1/collection/:id", asyncRoute(async (request, response) => {
  if (!(await requireAdmin(request, response))) return;
  const body = request.body as Record<string, unknown>;
  const result = await pool.query(
    `
      update ${tn("physical_aircraft")}
      set variant_id = $1,
          serial_number = $2,
          current_registration = $3,
          current_operator = $4,
          current_squadron = $5,
          current_country_iso2 = $6,
          current_status = $7,
          livery = $8,
          built_year = $9,
          notes = $10,
          updated_at = now()
      where id = $11
      returning *
    `,
    [
      requireString(body, "variantId"),
      requireString(body, "serialNumber"),
      requireString(body, "currentRegistration", 40),
      requireString(body, "currentOperator"),
      optionalString(body, "currentSquadron"),
      requireString(body, "currentCountryIso2", 2),
      requireEnum(body, "currentStatus", aircraftStatuses),
      requireString(body, "livery"),
      optionalInteger(body, "builtYear", 1900, 2100),
      optionalString(body, "notes", 4000) ?? "",
      String(request.params.id),
    ],
  );
  if (!result.rows[0]) {
    sendError(response, 404, "not_found", "Aircraft not found.");
    return;
  }
  response.json({ aircraft: result.rows[0] });
}));

app.put("/api/v1/reference/:type/:id", asyncRoute(async (request, response) => {
  if (!(await requireAdmin(request, response))) return;
  const ref = referenceConfig(String(request.params.type));
  if (!ref) {
    sendError(response, 404, "not_found", "Unknown reference type.");
    return;
  }
  const [table, idColumn, columns] = ref;
  const editable = columns.filter((column) => column !== idColumn);
  const body = request.body as Record<string, unknown>;
  const values = editable.map((column) => coerceReferenceValue(body, column, true));
  values.push(String(request.params.id));
  const assignments = editable.map((column, index) => `${column} = $${index + 1}`).join(", ");
  const result = await pool.query(
    `update ${tn(table)} set ${assignments}, updated_at = now()
     where ${idColumn} = $${values.length} returning ${columns.join(", ")}`,
    values,
  );
  if (!result.rows[0]) {
    sendError(response, 404, "not_found", "Reference item not found.");
    return;
  }
  response.json({ item: result.rows[0] });
}));

app.get("/api/v1/sightings", asyncRoute(async (request, response) => {
  const aircraftId = typeof request.query.aircraftId === "string" ? request.query.aircraftId : "";
  const result = await pool.query(
    `
      select s.*, a.current_registration, count(p.id)::int as photo_count
      from ${tn("sightings")} s
      join ${tn("physical_aircraft")} a on a.id = s.aircraft_id
      left join ${tn("photos")} p on p.sighting_id = s.id
      ${aircraftId ? "where s.aircraft_id = $1" : ""}
      group by s.id, a.current_registration
      order by s.sighting_date desc
    `,
    aircraftId ? [aircraftId] : [],
  );
  response.json({ sightings: result.rows.map(toSighting) });
}));

app.post("/api/v1/sightings", asyncRoute(async (request, response) => {
  if (!(await requireAdmin(request, response))) return;
  const body = request.body as Record<string, unknown>;
  const aircraftId = requireString(body, "aircraftId");
  const date = requireDate(body, "date");
  const locationName = requireString(body, "locationName");
  const id = optionalString(body, "id") ?? `${aircraftId}-${slugify(locationName)}-${date}`;
  const result = await pool.query(
    `
      insert into ${tn("sightings")}
      (id, aircraft_id, sighting_date, location_id, location_name, country_iso2, latitude, longitude, event_name, photographer, notes)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      returning *
    `,
    [
      id,
      aircraftId,
      date,
      optionalString(body, "locationId"),
      locationName,
      optionalString(body, "countryIso2", 2),
      optionalNumber(body, "latitude", -90, 90),
      optionalNumber(body, "longitude", -180, 180),
      optionalString(body, "eventName"),
      optionalString(body, "photographer") ?? "",
      optionalString(body, "notes", 2000) ?? "",
    ],
  );
  response.status(201).json({ sighting: toSighting(result.rows[0]) });
}));

app.put("/api/v1/sightings/:id", asyncRoute(async (request, response) => {
  if (!(await requireAdmin(request, response))) return;
  const body = request.body as Record<string, unknown>;
  const result = await pool.query(
    `
      update ${tn("sightings")}
      set aircraft_id = $1,
          sighting_date = $2,
          location_id = $3,
          location_name = $4,
          country_iso2 = $5,
          latitude = $6,
          longitude = $7,
          event_name = $8,
          photographer = $9,
          notes = $10,
          updated_at = now()
      where id = $11
      returning *
    `,
    [
      requireString(body, "aircraftId"),
      requireDate(body, "date"),
      optionalString(body, "locationId"),
      requireString(body, "locationName"),
      optionalString(body, "countryIso2", 2),
      optionalNumber(body, "latitude", -90, 90),
      optionalNumber(body, "longitude", -180, 180),
      optionalString(body, "eventName"),
      optionalString(body, "photographer") ?? "",
      optionalString(body, "notes", 2000) ?? "",
      String(request.params.id),
    ],
  );
  if (!result.rows[0]) {
    sendError(response, 404, "not_found", "Sighting not found.");
    return;
  }
  response.json({ sighting: toSighting(result.rows[0]) });
}));

app.get("/api/v1/photos", asyncRoute(async (request, response) => {
  const params: string[] = [];
  const filters: string[] = [];
  for (const [key, column] of [["sightingId", "p.sighting_id"], ["aircraftId", "p.aircraft_id"]] as const) {
    const value = typeof request.query[key] === "string" ? request.query[key] : "";
    if (value) {
      params.push(value);
      filters.push(`${column} = $${params.length}`);
    }
  }
  const rows = await pool.query(
    `
      select p.*, s.location_name, s.sighting_date
      from ${tn("photos")} p
      join ${tn("sightings")} s on s.id = p.sighting_id
      ${filters.length ? `where ${filters.join(" and ")}` : ""}
      order by p.taken_at desc nulls last, p.created_at desc
    `,
    params,
  );
  response.json({ photos: rows.rows.map(toPhoto) });
}));

app.post("/api/v1/photos", upload.array("photos", 12), asyncRoute(async (request, response) => {
  if (!(await requireAdmin(request, response))) return;
  const files = (request.files ?? []) as Express.Multer.File[];
  if (!files.length) {
    sendError(response, 400, "invalid_input", "At least one photo is required.");
    return;
  }

  const body = request.body as Record<string, unknown>;
  const sightingId = requireString(body, "sightingId");
  const sighting = await pool.query(
    `select id, aircraft_id, location_id from ${tn("sightings")} where id = $1`,
    [sightingId],
  );
  if (!sighting.rows[0]) {
    sendError(response, 404, "not_found", "Sighting not found.");
    return;
  }

  const preparedFiles = files.map((file) => {
    const imageType = detectImageType(file.buffer);
    if (!imageType) {
      throw new ApiInputError("Only JPEG, PNG, GIF, and WebP images are supported.");
    }
    const id = crypto.randomUUID();
    const relativePath = `${id}.${imageType.extension}`;
    const absolutePath = path.join(uploadRoot, relativePath);
    if (!absolutePath.startsWith(uploadRoot + path.sep)) {
      throw new ApiInputError("Invalid upload path.");
    }
    return { file, imageType, id, relativePath, absolutePath };
  });

  await mkdir(uploadRoot, { recursive: true });
  const writtenPaths: string[] = [];
  const saved = [];
  const client = await pool.connect();

  try {
    await client.query("begin");
    for (const prepared of preparedFiles) {
      await writeFile(prepared.absolutePath, prepared.file.buffer, { flag: "wx" });
      writtenPaths.push(prepared.absolutePath);
      const title =
        optionalString(body, "title") ??
        (path.parse(prepared.file.originalname).name.slice(0, 120) || "Untitled photo");
      const result = await client.query(
        `
          insert into ${tn("photos")}
          (id, sighting_id, aircraft_id, title, caption, taken_at, location_id, visibility, file_path,
           thumbnail_path, original_filename, content_type, file_size, camera_make, camera_model,
           lens_model, focal_length, exposure_time, aperture, iso)
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, null, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
          returning *
        `,
        [
          prepared.id,
          sightingId,
          sighting.rows[0].aircraft_id,
          title,
          optionalString(body, "caption", 2000) ?? "",
          optionalDateTime(body, "takenAt"),
          optionalString(body, "locationId") ?? sighting.rows[0].location_id,
          optionalEnum(body, "visibility", photoVisibilities) ?? "private",
          `/uploads/${prepared.relativePath}`,
          prepared.file.originalname,
          prepared.imageType.contentType,
          prepared.file.size,
          optionalString(body, "cameraMake"),
          optionalString(body, "cameraModel"),
          optionalString(body, "lensModel"),
          optionalString(body, "focalLength"),
          optionalString(body, "exposureTime"),
          optionalString(body, "aperture"),
          optionalNumber(body, "iso"),
        ],
      );
      saved.push(toPhoto(result.rows[0]));
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    await Promise.all(writtenPaths.map((filePath) => rm(filePath, { force: true })));
    throw error;
  } finally {
    client.release();
  }

  response.status(201).json({ photos: saved });
}));

app.use("/api", (_request, response) => {
  sendError(response, 404, "not_found", "API route not found.");
});

app.use(express.static(staticRoot, { index: false }));

app.get(/^(?!\/api\/).*/, (_request, response) => {
  response.sendFile(path.join(staticRoot, "index.html"));
});

await migrateDatabase(pool, config);

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  if (error instanceof ApiInputError) {
    sendError(response, 400, "invalid_input", error.message);
    return;
  }
  if (error instanceof multer.MulterError) {
    sendError(response, 400, "invalid_upload", error.message);
    return;
  }
  const databaseError = toDatabaseError(error);
  if (databaseError) {
    if (databaseError.code === "23505") {
      sendError(response, 409, "conflict", "A record with this identifier already exists.");
      return;
    }
    if (["23502", "23503", "23514", "22P02", "22007", "22008"].includes(databaseError.code ?? "")) {
      sendError(response, 400, "invalid_input", "The submitted data violates database constraints.");
      return;
    }
  }
  console.error(error instanceof Error ? error.message : "Unhandled API error");
  sendError(response, 500, "internal_error", "An unexpected error occurred.");
});

app.listen(config.port, () => {
  console.log(`Aviadex listening on port ${config.port}`);
});

function asyncRoute(handler: AsyncHandler) {
  return (request: express.Request, response: express.Response, next: express.NextFunction) => {
    handler(request, response, next).catch(next);
  };
}

function sendError(response: express.Response, status: number, code: string, message: string) {
  response.status(status).json({ error: { code, message } });
}

function toDatabaseError(error: unknown): DatabaseError | null {
  if (
    error instanceof Error &&
    "code" in error &&
    typeof (error as DatabaseError).code === "string"
  ) {
    return error as DatabaseError;
  }
  return null;
}

function tn(table: string) {
  return tableName(config.databaseSchema, table);
}

async function requireAdmin(request: express.Request, response: express.Response) {
  const user = await getSessionUser(pool, request, config);
  if (!user) {
    sendError(response, 401, "not_authenticated", "Authentication is required.");
    return null;
  }
  if (user.role !== "admin") {
    sendError(response, 403, "forbidden", "Admin privileges are required.");
    return null;
  }
  return user;
}

async function loadCollection() {
  const [aircraftRows, eventRows, sightingRows, photoRows] = await Promise.all([
    pool.query(`
      select a.*, c.iso2 as country_iso2, c.iso3 as country_iso3, c.default_name as country_name,
             v.name as variant_name, v.role as variant_role, v.first_flight_year,
             v.introduced_year as variant_introduced_year, v.specs,
             m.id as model_id, m.name as model_name, m.category,
             m.introduced_year as model_introduced_year,
             mf.id as manufacturer_id, mf.name as manufacturer_name,
             mf.country_iso2 as manufacturer_country_iso2
      from ${tn("physical_aircraft")} a
      join ${tn("aircraft_variants")} v on v.id = a.variant_id
      join ${tn("aircraft_models")} m on m.id = v.model_id
      join ${tn("manufacturers")} mf on mf.id = m.manufacturer_id
      left join ${tn("countries")} c on c.iso2 = a.current_country_iso2
      order by a.current_registration asc
    `),
    pool.query(`select * from ${tn("aircraft_lifecycle_events")} order by event_date asc`),
    pool.query(`
      select s.*, count(p.id)::int as photo_count
      from ${tn("sightings")} s
      left join ${tn("photos")} p on p.sighting_id = s.id
      group by s.id
      order by s.sighting_date desc
    `),
    pool.query(`select * from ${tn("photos")} order by created_at desc`),
  ]);

  const eventsByAircraft = new Map<string, unknown[]>();
  for (const row of eventRows.rows) {
    const events = eventsByAircraft.get(row.aircraft_id) ?? [];
    events.push({ id: row.id, date: row.event_date, type: row.event_type, label: row.label, detail: row.detail });
    eventsByAircraft.set(row.aircraft_id, events);
  }

  const photosBySighting = new Map<string, unknown[]>();
  for (const row of photoRows.rows) {
    const photos = photosBySighting.get(row.sighting_id) ?? [];
    photos.push(toPhoto(row));
    photosBySighting.set(row.sighting_id, photos);
  }

  const sightingsByAircraft = new Map<string, unknown[]>();
  for (const row of sightingRows.rows) {
    const sightings = sightingsByAircraft.get(row.aircraft_id) ?? [];
    sightings.push({ ...toSighting(row), photos: photosBySighting.get(row.id) ?? [] });
    sightingsByAircraft.set(row.aircraft_id, sightings);
  }

  return aircraftRows.rows.map((row) => ({
    id: row.id,
    variantId: row.variant_id,
    serialNumber: row.serial_number,
    currentRegistration: row.current_registration,
    currentOperator: row.current_operator,
    currentSquadron: row.current_squadron,
    currentCountryIso2: row.current_country_iso2,
    currentStatus: row.current_status,
    livery: row.livery,
    builtYear: row.built_year,
    notes: row.notes,
    manufacturer: { id: row.manufacturer_id, name: row.manufacturer_name, countryIso2: row.manufacturer_country_iso2 },
    model: {
      id: row.model_id,
      manufacturerId: row.manufacturer_id,
      name: row.model_name,
      category: row.category,
      introducedYear: row.model_introduced_year,
    },
    variant: {
      id: row.variant_id,
      modelId: row.model_id,
      name: row.variant_name,
      role: row.variant_role,
      firstFlightYear: row.first_flight_year,
      introducedYear: row.variant_introduced_year,
      specs: row.specs ?? {},
    },
    country: { iso2: row.country_iso2, iso3: row.country_iso3, defaultName: row.country_name ?? row.current_country_iso2 },
    history: eventsByAircraft.get(row.id) ?? [],
    sightings: sightingsByAircraft.get(row.id) ?? [],
  }));
}

function referenceConfig(type: string): [string, string, readonly string[]] | undefined {
  const ref = referenceTables[type as keyof typeof referenceTables];
  return ref ? [ref[0], ref[1], ref[2]] : undefined;
}

function requireString(body: Record<string, unknown>, key: string, maxLength = 300) {
  const value = body[key];
  if (typeof value !== "string") throw new ApiInputError(`${key} is required.`);
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) throw new ApiInputError(`${key} is invalid.`);
  return trimmed;
}

function optionalString(body: Record<string, unknown>, key: string, maxLength = 300) {
  const value = body[key];
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new ApiInputError(`${key} is invalid.`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw new ApiInputError(`${key} is invalid.`);
  return trimmed || null;
}

function optionalNumber(body: Record<string, unknown>, key: string, min?: number, max?: number) {
  const value = body[key];
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new ApiInputError(`${key} is invalid.`);
  if ((min != null && parsed < min) || (max != null && parsed > max)) {
    throw new ApiInputError(`${key} is out of range.`);
  }
  return parsed;
}

function optionalInteger(body: Record<string, unknown>, key: string, min?: number, max?: number) {
  const value = optionalNumber(body, key, min, max);
  if (value == null) return null;
  if (!Number.isInteger(value)) throw new ApiInputError(`${key} must be an integer.`);
  return value;
}

function requireEnum<T extends readonly string[]>(
  body: Record<string, unknown>,
  key: string,
  allowed: T,
): T[number] {
  const value = requireString(body, key);
  if (!allowed.includes(value)) {
    throw new ApiInputError(`${key} is invalid.`);
  }
  return value;
}

function optionalEnum<T extends readonly string[]>(
  body: Record<string, unknown>,
  key: string,
  allowed: T,
): T[number] | null {
  const value = optionalString(body, key);
  if (value == null) return null;
  if (!allowed.includes(value)) {
    throw new ApiInputError(`${key} is invalid.`);
  }
  return value;
}

function parseDateString(value: string, key: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiInputError(`${key} must use YYYY-MM-DD.`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new ApiInputError(`${key} is invalid.`);
  }
  return value;
}

function requireDate(body: Record<string, unknown>, key: string) {
  return parseDateString(requireString(body, key, 10), key);
}

function optionalDateTime(body: Record<string, unknown>, key: string) {
  const value = optionalString(body, key, 40);
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApiInputError(`${key} is invalid.`);
  }
  return date.toISOString();
}

function coerceReferenceValue(body: Record<string, unknown>, column: string, allowNull = false) {
  if (["introduced_year", "first_flight_year", "latitude", "longitude"].includes(column)) {
    return optionalNumber(body, column);
  }
  if (column === "specs") {
    const raw = body[column];
    if (raw == null || raw === "") return {};
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("specs must be a JSON object.");
        }
        return parsed;
      } catch {
        throw new ApiInputError("specs must be valid JSON object.");
      }
    }
    if (typeof raw !== "object" || Array.isArray(raw)) {
      throw new ApiInputError("specs must be valid JSON object.");
    }
    return raw;
  }
  return allowNull ? optionalString(body, column) : requireString(body, column);
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || crypto.randomUUID()
  );
}

function toSighting(row: Record<string, unknown>) {
  return {
    id: row.id,
    aircraftId: row.aircraft_id,
    registration: row.current_registration,
    date: row.sighting_date,
    locationId: row.location_id,
    location: row.location_name,
    countryIso2: row.country_iso2,
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    event: row.event_name,
    photographer: row.photographer,
    notes: row.notes,
    photoCount: row.photo_count ?? 0,
  };
}

function toPhoto(row: Record<string, unknown>) {
  return {
    id: row.id,
    sightingId: row.sighting_id,
    aircraftId: row.aircraft_id,
    title: row.title,
    caption: row.caption,
    takenAt: row.taken_at,
    locationId: row.location_id,
    visibility: row.visibility,
    url: row.file_path,
    thumbnailUrl: row.thumbnail_path ?? row.file_path,
    originalFilename: row.original_filename,
    contentType: row.content_type,
    fileSize: row.file_size,
    camera: {
      make: row.camera_make,
      model: row.camera_model,
      lens: row.lens_model,
      focalLength: row.focal_length,
      exposureTime: row.exposure_time,
      aperture: row.aperture,
      iso: row.iso,
    },
    locationName: row.location_name,
    sightingDate: row.sighting_date,
  };
}

function detectImageType(buffer: Buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { extension: "jpg", contentType: "image/jpeg" };
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { extension: "png", contentType: "image/png" };
  }
  if (buffer.length >= 6 && ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii"))) {
    return { extension: "gif", contentType: "image/gif" };
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { extension: "webp", contentType: "image/webp" };
  }
  return null;
}
