import {
  CalendarDays,
  ChevronRight,
  Filter,
  ImagePlus,
  Languages,
  LogIn,
  LogOut,
  MapPinned,
  Plane,
  Save,
  Search,
  Upload,
  User,
} from "lucide-react";
import L from "leaflet";
import markerIcon2xUrl from "leaflet/dist/images/marker-icon-2x.png";
import markerIconUrl from "leaflet/dist/images/marker-icon.png";
import markerShadowUrl from "leaflet/dist/images/marker-shadow.png";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { filterAircraft, getCollectionStats, type AircraftFilters } from "../application/aircraftSearch";
import type { AircraftCollectionItem, AircraftStatus, Locale, Photo, Sighting } from "../domain/aircraft";
import { AircraftSilhouette } from "./components/AircraftSilhouette";
import { Metric } from "./components/Metric";
import { getCurrentUser, login, logout, type AuthUser } from "./auth";
import type { TranslationKey } from "./i18n/translations";
import { useI18n } from "./i18n/useI18n";

const routes = ["/collection", "/map", "/timeline", "/reference"] as const;
const appRoutes = [...routes, "/login"] as const;
type Route = (typeof appRoutes)[number];

const emptyFilters: AircraftFilters = { query: "", country: "", category: "", status: "" };
const eventTypes = ["registration", "operator", "squadron", "status", "livery", "sighting"];
const referenceTypes = [
  "manufacturers",
  "models",
  "variants",
  "operators",
  "squadrons",
  "countries",
  "locations",
  "airBases",
] as const;

const aircraftMarkerIcon = L.icon({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIcon2xUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

type ReferenceType = (typeof referenceTypes)[number];
type ReferenceData = Record<ReferenceType, Record<string, unknown>[]>;

interface MapMarker {
  id: string;
  aircraftId: string;
  registration: string;
  locationName: string;
  sightingDate: string;
  latitude: number;
  longitude: number;
  photoCount: number;
}

interface TimelineEvent {
  id: string;
  aircraftId: string;
  registration: string;
  date: string;
  type: string;
  label: string;
  detail: string;
}

export function App() {
  const [locale, setLocale] = useState<Locale>("en");
  const [route, setRoute] = useState<Route>(getRoute());
  const [collection, setCollection] = useState<AircraftCollectionItem[]>([]);
  const [reference, setReference] = useState<ReferenceData | null>(null);
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [timelineFilters, setTimelineFilters] = useState({ aircraftId: "", eventType: "", from: "", to: "" });
  const [filters, setFilters] = useState<AircraftFilters>(emptyFilters);
  const [selectedId, setSelectedId] = useState<string>("");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n(locale);

  useEffect(() => {
    const onPopState = () => setRoute(getRoute());
    window.addEventListener("popstate", onPopState);
    if (!appRoutes.includes(getRoute())) {
      navigate("/collection", true);
    }
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      getCurrentUser().catch(() => null),
      api<{ aircraft: AircraftCollectionItem[] }>("/api/v1/collection"),
      api<{ reference: ReferenceData }>("/api/v1/reference"),
      api<{ markers: MapMarker[] }>("/api/v1/map"),
    ])
      .then(([user, collectionPayload, referencePayload, mapPayload]) => {
        if (!active) return;
        setAuthUser(user);
        setCollection(collectionPayload.aircraft);
        setReference(referencePayload.reference);
        setMarkers(mapPayload.markers);
        setSelectedId((current) => current || collectionPayload.aircraft[0]?.id || "");
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : t("loadError"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(timelineFilters)) {
      if (value) search.set(key, value);
    }
    api<{ events: TimelineEvent[] }>(`/api/v1/timeline?${search}`)
      .then((payload) => setTimeline(payload.events))
      .catch((timelineError) => setError(timelineError instanceof Error ? timelineError.message : t("loadError")));
  }, [timelineFilters, t]);

  const filteredAircraft = useMemo(() => filterAircraft(collection, filters), [collection, filters]);
  const selectedAircraft =
    filteredAircraft.find((aircraft) => aircraft.id === selectedId) ??
    filteredAircraft[0] ??
    collection[0];
  const stats = useMemo(() => getCollectionStats(collection), [collection]);

  useEffect(() => {
    if (authUser && route === "/login") {
      navigate("/collection", true);
    }
  }, [authUser, route]);

  function navigate(nextRoute: Route, replace = false) {
    window.history[replace ? "replaceState" : "pushState"](null, "", nextRoute);
    setRoute(nextRoute);
  }

  async function refreshCollection() {
    const payload = await api<{ aircraft: AircraftCollectionItem[] }>("/api/v1/collection");
    setCollection(payload.aircraft);
  }

  async function refreshReference() {
    const payload = await api<{ reference: ReferenceData }>("/api/v1/reference");
    setReference(payload.reference);
  }

  async function handleLogin(email: string, password: string) {
    setAuthError(null);
    const user = await login(email, password);
    setAuthUser(user);
    navigate("/collection", true);
  }

  async function handleLogout() {
    await logout();
    setAuthUser(null);
    if (route === "/login") navigate("/collection", true);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label={t("primaryNavigation")}>
        <div className="brand">
          <span className="brand-mark"><Plane size={22} strokeWidth={2.4} /></span>
          <span>{t("appName")}</span>
        </div>
        <nav>
          {routes.map((item) => (
            <button
              className={route === item ? "active" : ""}
              key={item}
              type="button"
              onClick={() => navigate(item)}
            >
              <ChevronRight size={16} />
              {routeLabel(item, t)}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span>API</span>
          <strong>/api/v1</strong>
          <p>{t("apiNote")}</p>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>{routeLabel(route, t)}</h1>
            <p>{t("appSubtitle")}</p>
          </div>
          <div className="topbar-actions">
            {authUser && (
              <div className="session-chip">
                <User size={16} />
                <span>{authUser.displayName}</span>
              </div>
            )}
            {authUser ? (
              <button className="icon-action" type="button" onClick={handleLogout} aria-label={t("signOut")} title={t("signOut")}>
                <LogOut size={17} />
              </button>
            ) : (
              <button className="topbar-button" type="button" onClick={() => navigate("/login")}>
                <LogIn size={17} />
                {t("signIn")}
              </button>
            )}
            <button className="language-toggle" type="button" onClick={() => setLocale(locale === "en" ? "fr" : "en")}>
              <Languages size={17} />
              {locale.toUpperCase()}
            </button>
          </div>
        </header>

        {route === "/login" && (
          <LoginPage
            error={authError}
            t={t}
            onLogin={handleLogin}
          />
        )}
        {route !== "/login" && loading && <StatePanel message={t("loading")} />}
        {route !== "/login" && error && <StatePanel message={error} tone="error" />}
        {route !== "/login" && !loading && !error && route === "/collection" && (
          <CollectionPage
            aircraft={filteredAircraft}
            allAircraft={collection}
            filters={filters}
            selectedAircraft={selectedAircraft}
            reference={reference}
            user={authUser}
            stats={stats}
            t={t}
            onFilter={setFilters}
            onSelect={setSelectedId}
            onUploaded={refreshCollection}
            onChanged={refreshCollection}
          />
        )}
        {route !== "/login" && !loading && !error && route === "/map" && <MapPage markers={markers} t={t} />}
        {route !== "/login" && !loading && !error && route === "/timeline" && (
          <TimelinePage
            aircraft={collection}
            events={timeline}
            filters={timelineFilters}
            t={t}
            onFilters={setTimelineFilters}
          />
        )}
        {route !== "/login" && !loading && !error && route === "/reference" && (
          <ReferencePage
            data={reference}
            t={t}
            user={authUser}
            onSaved={refreshReference}
          />
        )}
      </section>
    </main>
  );
}

function CollectionPage({
  aircraft,
  allAircraft,
  filters,
  selectedAircraft,
  reference,
  user,
  stats,
  t,
  onFilter,
  onSelect,
  onUploaded,
  onChanged,
}: {
  aircraft: AircraftCollectionItem[];
  allAircraft: AircraftCollectionItem[];
  filters: AircraftFilters;
  selectedAircraft?: AircraftCollectionItem;
  reference: ReferenceData | null;
  user: AuthUser | null;
  stats: ReturnType<typeof getCollectionStats>;
  t: (key: TranslationKey) => string;
  onFilter: (filters: AircraftFilters) => void;
  onSelect: (id: string) => void;
  onUploaded: () => Promise<void>;
  onChanged: () => Promise<void>;
}) {
  function updateFilter(name: keyof AircraftFilters, value: string) {
    onFilter({ ...filters, [name]: value });
  }

  return (
    <>
      <section className="metrics" aria-label={t("collectionStatistics")}>
        <Metric label={t("airframes")} value={stats.airframes} />
        <Metric label={t("variants")} value={stats.variants} />
        <Metric label={t("countries")} value={stats.countries} />
        <Metric label={t("photos")} value={stats.photos} />
      </section>
      <section className="control-strip" aria-label={t("aircraftFilters")}>
        <label className="search-field">
          <Search size={18} />
          <input value={filters.query} onChange={(event) => updateFilter("query", event.target.value)} placeholder={t("searchPlaceholder")} />
        </label>
        <SelectFilter icon={<Filter size={16} />} label={t("country")} value={filters.country} onChange={(value) => updateFilter("country", value)} options={countryOptions(allAircraft, t)} />
        <SelectFilter label={t("category")} value={filters.category} onChange={(value) => updateFilter("category", value)} options={categoryOptions(t)} />
        <SelectFilter label={t("status")} value={filters.status} onChange={(value) => updateFilter("status", value)} options={statusOptions(t)} />
      </section>
      {aircraft.length === 0 || !selectedAircraft ? (
        <StatePanel message={t("noResults")} />
      ) : (
        <>
          <div className="content-grid">
            <AircraftList aircraft={aircraft} selectedId={selectedAircraft.id} onSelect={onSelect} />
            <AircraftProfile aircraft={selectedAircraft} t={t} />
            <ReferencePanel aircraft={selectedAircraft} t={t} />
          </div>
          <section className="lower-grid">
            <SightingsPanel aircraft={selectedAircraft} title={t("sightingEvidence")} t={t} />
            <PhotoUploadPanel aircraft={selectedAircraft} user={user} t={t} onUploaded={onUploaded} />
            <AdminCollectionPanel aircraft={selectedAircraft} reference={reference} user={user} t={t} onChanged={onChanged} />
          </section>
        </>
      )}
    </>
  );
}

function MapPage({ markers, t }: { markers: MapMarker[]; t: (key: TranslationKey) => string }) {
  if (!markers.length) return <StatePanel message={t("mapEmpty")} />;
  const center = mapCenter(markers);

  return (
    <section className="panel map-page-panel">
      <div className="section-title">
        <span>{t("locationMap")}</span>
        <strong>{markers.length} {t("markers")}</strong>
      </div>
      <MapContainer className="map-viewport" center={center} zoom={markers.length === 1 ? 8 : 4} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitMapToMarkers markers={markers} />
        {markers.map((marker) => (
          <Marker icon={aircraftMarkerIcon} key={marker.id} position={[marker.latitude, marker.longitude]}>
            <Popup>
              <div className="map-popup-content">
                <span><MapPinned size={16} /> {marker.registration}</span>
                <strong>{marker.locationName}</strong>
                <small>{formatDate(marker.sightingDate)} · {marker.photoCount} {t("photos")}</small>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </section>
  );
}

function FitMapToMarkers({ markers }: { markers: MapMarker[] }) {
  const map = useMap();

  useEffect(() => {
    if (!markers.length) return;
    const bounds = L.latLngBounds(markers.map((marker) => [marker.latitude, marker.longitude] as [number, number]));
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [42, 42], maxZoom: 11 });
    }
  }, [map, markers]);

  return null;
}

function TimelinePage({
  aircraft,
  events,
  filters,
  t,
  onFilters,
}: {
  aircraft: AircraftCollectionItem[];
  events: TimelineEvent[];
  filters: { aircraftId: string; eventType: string; from: string; to: string };
  t: (key: TranslationKey) => string;
  onFilters: (filters: { aircraftId: string; eventType: string; from: string; to: string }) => void;
}) {
  return (
    <section className="panel">
      <div className="section-title">
        <span>{t("timeline")}</span>
        <strong>{events.length} {t("entries")}</strong>
      </div>
      <div className="control-strip compact">
        <SelectFilter label={t("aircraft")} value={filters.aircraftId} onChange={(aircraftId) => onFilters({ ...filters, aircraftId })} options={[["", t("allAircraft")], ...aircraft.map((item) => [item.id, item.currentRegistration] as [string, string])]} />
        <SelectFilter label={t("eventType")} value={filters.eventType} onChange={(eventType) => onFilters({ ...filters, eventType })} options={[["", t("allEventTypes")], ...eventTypes.map((type) => [type, type] as [string, string])]} />
        <label className="select-field"><span>{t("from")}</span><input type="date" value={filters.from} onChange={(event) => onFilters({ ...filters, from: event.target.value })} /></label>
        <label className="select-field"><span>{t("to")}</span><input type="date" value={filters.to} onChange={(event) => onFilters({ ...filters, to: event.target.value })} /></label>
      </div>
      {events.length === 0 ? (
        <p className="empty-state">{t("timelineEmpty")}</p>
      ) : (
        <ol className="timeline-list global">
          {events.map((event) => (
            <li key={`${event.type}-${event.id}`}>
              <time>{formatDate(event.date)}</time>
              <span>
                <strong>{event.registration} · {event.label}</strong>
                <small>{event.type} · {event.detail || t("noDetail")}</small>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function ReferencePage({
  data,
  user,
  t,
  onSaved,
}: {
  data: ReferenceData | null;
  user: AuthUser | null;
  t: (key: TranslationKey) => string;
  onSaved: () => Promise<void>;
}) {
  const [active, setActive] = useState<ReferenceType>("manufacturers");
  const rows = data?.[active] ?? [];
  const columns = rows[0] ? Object.keys(rows[0]) : defaultReferenceColumns(active);

  return (
    <section className="panel reference-page">
      <div className="reference-tabs">
        {referenceTypes.map((type) => (
          <button className={active === type ? "active" : ""} key={type} type="button" onClick={() => setActive(type)}>
            {referenceLabel(type, t)}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="empty-state">{t("referenceEmpty")}</p>
      ) : (
        <div className="data-table" role="table">
          <div className="data-row header" role="row">
            {columns.map((column) => <strong key={column}>{column}</strong>)}
          </div>
          {rows.map((row) => (
            <div className="data-row" role="row" key={String(row[columns[0]])}>
              {columns.map((column) => <span key={column}>{formatCell(row[column])}</span>)}
            </div>
          ))}
        </div>
      )}
      {user?.role === "admin" ? (
        <ReferenceForm type={active} columns={columns} t={t} onSaved={onSaved} />
      ) : (
        <p className="empty-state subtle">{t("readOnlyReference")}</p>
      )}
    </section>
  );
}

function ReferenceForm({ type, columns, t, onSaved }: { type: ReferenceType; columns: string[]; t: (key: TranslationKey) => string; onSaved: () => Promise<void> }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setStatus(null);
    setError(null);
    try {
      await api(
        editingId ? `/api/v1/reference/${type}/${encodeURIComponent(editingId)}` : `/api/v1/reference/${type}`,
        {
          method: editingId ? "PUT" : "POST",
          body: JSON.stringify(values),
          headers: { "Content-Type": "application/json" },
        },
      );
      setValues({});
      setEditingId("");
      setStatus(t("saved"));
      await onSaved();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("loadError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <div className="section-title">
        <span>{editingId ? t("adminEdit") : t("adminCreate")}</span>
        <strong>{referenceLabel(type, t)}</strong>
      </div>
      <div className="form-grid">
        <label>
          <span>{t("editId")}</span>
          <input value={editingId} onChange={(event) => setEditingId(event.target.value)} />
        </label>
        {columns.map((column) => (
          <label key={column}>
            <span>{column}</span>
            <input value={values[column] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [column]: event.target.value }))} required={!nullableReferenceColumns.has(column)} />
          </label>
        ))}
      </div>
      <button className="auth-button" type="submit" disabled={submitting}><Save size={16} />{submitting ? t("saving") : t("save")}</button>
      {status && <p className="auth-status">{status}</p>}
      {error && <p className="auth-error">{error}</p>}
    </form>
  );
}

function AdminCollectionPanel({
  aircraft,
  reference,
  user,
  t,
  onChanged,
}: {
  aircraft: AircraftCollectionItem;
  reference: ReferenceData | null;
  user: AuthUser | null;
  t: (key: TranslationKey) => string;
  onChanged: () => Promise<void>;
}) {
  if (user?.role !== "admin") {
    return <section className="panel"><p className="empty-state subtle">{t("adminOnlyManagement")}</p></section>;
  }

  return (
    <section className="panel">
      <div className="section-title">
        <span>{t("adminManagement")}</span>
        <strong>{aircraft.currentRegistration}</strong>
      </div>
      <AircraftAdminForm aircraft={aircraft} reference={reference} t={t} onChanged={onChanged} />
      <SightingAdminForm aircraft={aircraft} t={t} onChanged={onChanged} />
    </section>
  );
}

function AircraftAdminForm({
  aircraft,
  reference,
  t,
  onChanged,
}: {
  aircraft: AircraftCollectionItem;
  reference: ReferenceData | null;
  t: (key: TranslationKey) => string;
  onChanged: () => Promise<void>;
}) {
  const [values, setValues] = useState(() => aircraftFormValues(aircraft));
  const [mode, setMode] = useState<"edit" | "create">("edit");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const variants = reference?.variants ?? [];
  const countries = reference?.countries ?? [];

  useEffect(() => setValues(aircraftFormValues(aircraft)), [aircraft]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setStatus(null);
    setError(null);
    try {
      await api(mode === "edit" ? `/api/v1/collection/${aircraft.id}` : "/api/v1/collection", {
        method: mode === "edit" ? "PUT" : "POST",
        body: JSON.stringify(values),
        headers: { "Content-Type": "application/json" },
      });
      setStatus(t("saved"));
      await onChanged();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("loadError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <div className="form-grid">
        <SelectFilter label={t("mode")} value={mode} onChange={(value) => setMode(value as "edit" | "create")} options={[["edit", t("editSelected")], ["create", t("createNew")]]} />
        <SelectFilter label={t("variant")} value={values.variantId} onChange={(value) => setValues((current) => ({ ...current, variantId: value }))} options={variants.map((variant) => [String(variant.id), String(variant.name)])} />
        <label><span>{t("registration")}</span><input value={values.currentRegistration} onChange={(event) => setValues((current) => ({ ...current, currentRegistration: event.target.value }))} required /></label>
        <label><span>{t("serial")}</span><input value={values.serialNumber} onChange={(event) => setValues((current) => ({ ...current, serialNumber: event.target.value }))} required /></label>
        <label><span>{t("operator")}</span><input value={values.currentOperator} onChange={(event) => setValues((current) => ({ ...current, currentOperator: event.target.value }))} required /></label>
        <label><span>{t("squadron")}</span><input value={values.currentSquadron} onChange={(event) => setValues((current) => ({ ...current, currentSquadron: event.target.value }))} /></label>
        <SelectFilter label={t("country")} value={values.currentCountryIso2} onChange={(value) => setValues((current) => ({ ...current, currentCountryIso2: value }))} options={countries.map((country) => [String(country.iso2), String(country.default_name)])} />
        <SelectFilter label={t("status")} value={values.currentStatus} onChange={(value) => setValues((current) => ({ ...current, currentStatus: value as AircraftStatus }))} options={statusOptions(t).filter(([value]) => value)} />
        <label><span>{t("livery")}</span><input value={values.livery} onChange={(event) => setValues((current) => ({ ...current, livery: event.target.value }))} required /></label>
        <label><span>{t("built")}</span><input value={values.builtYear} onChange={(event) => setValues((current) => ({ ...current, builtYear: event.target.value }))} /></label>
        <label><span>{t("notes")}</span><input value={values.notes} onChange={(event) => setValues((current) => ({ ...current, notes: event.target.value }))} /></label>
      </div>
      <button className="auth-button" type="submit" disabled={submitting}><Save size={16} />{submitting ? t("saving") : t("saveAircraft")}</button>
      {status && <p className="auth-status">{status}</p>}
      {error && <p className="auth-error">{error}</p>}
    </form>
  );
}

function SightingAdminForm({ aircraft, t, onChanged }: { aircraft: AircraftCollectionItem; t: (key: TranslationKey) => string; onChanged: () => Promise<void> }) {
  const [values, setValues] = useState({
    date: "",
    locationName: "",
    countryIso2: aircraft.currentCountryIso2,
    latitude: "",
    longitude: "",
    eventName: "",
    photographer: "",
    notes: "",
  });
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setStatus(null);
    setError(null);
    try {
      await api("/api/v1/sightings", {
        method: "POST",
        body: JSON.stringify({ ...values, aircraftId: aircraft.id }),
        headers: { "Content-Type": "application/json" },
      });
      setValues({ date: "", locationName: "", countryIso2: aircraft.currentCountryIso2, latitude: "", longitude: "", eventName: "", photographer: "", notes: "" });
      setStatus(t("saved"));
      await onChanged();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("loadError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <div className="section-title"><span>{t("createSighting")}</span><strong>{aircraft.currentRegistration}</strong></div>
      <div className="form-grid">
        <label><span>{t("date")}</span><input type="date" value={values.date} onChange={(event) => setValues((current) => ({ ...current, date: event.target.value }))} required /></label>
        <label><span>{t("location")}</span><input value={values.locationName} onChange={(event) => setValues((current) => ({ ...current, locationName: event.target.value }))} required /></label>
        <label><span>{t("country")}</span><input value={values.countryIso2} onChange={(event) => setValues((current) => ({ ...current, countryIso2: event.target.value.toUpperCase() }))} maxLength={2} /></label>
        <label><span>Latitude</span><input value={values.latitude} onChange={(event) => setValues((current) => ({ ...current, latitude: event.target.value }))} /></label>
        <label><span>Longitude</span><input value={values.longitude} onChange={(event) => setValues((current) => ({ ...current, longitude: event.target.value }))} /></label>
        <label><span>{t("event")}</span><input value={values.eventName} onChange={(event) => setValues((current) => ({ ...current, eventName: event.target.value }))} /></label>
        <label><span>{t("photographer")}</span><input value={values.photographer} onChange={(event) => setValues((current) => ({ ...current, photographer: event.target.value }))} /></label>
        <label><span>{t("notes")}</span><input value={values.notes} onChange={(event) => setValues((current) => ({ ...current, notes: event.target.value }))} /></label>
      </div>
      <button className="auth-button" type="submit" disabled={submitting}><Save size={16} />{submitting ? t("saving") : t("saveSighting")}</button>
      {status && <p className="auth-status">{status}</p>}
      {error && <p className="auth-error">{error}</p>}
    </form>
  );
}

function PhotoUploadPanel({ aircraft, user, t, onUploaded }: { aircraft: AircraftCollectionItem; user: AuthUser | null; t: (key: TranslationKey) => string; onUploaded: () => Promise<void> }) {
  const [sightingId, setSightingId] = useState(aircraft.sightings[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [takenAt, setTakenAt] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [files, setFiles] = useState<FileList | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => setSightingId(aircraft.sightings[0]?.id ?? ""), [aircraft.id, aircraft.sightings]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!files?.length) return;
    setSubmitting(true);
    setStatus(null);
    setError(null);
    const body = new FormData();
    body.set("sightingId", sightingId);
    body.set("title", title);
    body.set("caption", caption);
    body.set("takenAt", takenAt);
    body.set("visibility", visibility);
    for (const file of Array.from(files)) body.append("photos", file);
    try {
      await api("/api/v1/photos", { method: "POST", body });
      setStatus(t("uploaded"));
      setTitle("");
      setCaption("");
      setTakenAt("");
      setFiles(null);
      await onUploaded();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("loadError"));
    } finally {
      setSubmitting(false);
    }
  }

  const photos = aircraft.sightings.flatMap((sighting) => sighting.photos ?? []);
  return (
    <section className="panel">
      <div className="section-title">
        <span>{t("photos")}</span>
        <strong>{photos.length}</strong>
      </div>
      {photos.length === 0 ? (
        <p className="empty-state">{t("photoEmpty")}</p>
      ) : (
        <div className="photo-grid">
          {photos.map((photo: Photo) => (
            <figure key={photo.id}>
              <img src={photo.thumbnailUrl} alt={photo.title} />
              <figcaption>{photo.title}</figcaption>
            </figure>
          ))}
        </div>
      )}
      {user?.role === "admin" ? (
        <form className="admin-form upload-form" onSubmit={submit}>
          <SelectFilter label={t("sighting")} value={sightingId} onChange={setSightingId} options={aircraft.sightings.map((sighting) => [sighting.id, `${sighting.date} · ${sighting.location}`])} />
          <label><span>{t("title")}</span><input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label><span>{t("caption")}</span><input value={caption} onChange={(event) => setCaption(event.target.value)} /></label>
          <label><span>{t("takenAt")}</span><input type="datetime-local" value={takenAt} onChange={(event) => setTakenAt(event.target.value)} /></label>
          <SelectFilter label={t("visibility")} value={visibility} onChange={setVisibility} options={[["private", "private"], ["public", "public"]]} />
          <label><span>{t("files")}</span><input type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple onChange={(event) => setFiles(event.target.files)} /></label>
          <button className="auth-button" type="submit" disabled={submitting || !sightingId || !files?.length}><Upload size={16} />{submitting ? t("uploading") : t("uploadPhotos")}</button>
          {status && <p className="auth-status">{status}</p>}
          {error && <p className="auth-error">{error}</p>}
        </form>
      ) : (
        <p className="empty-state subtle"><ImagePlus size={16} /> {t("loginToUpload")}</p>
      )}
    </section>
  );
}

function LoginPage({ error, t, onLogin }: { error: string | null; t: (key: TranslationKey) => string; onLogin: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await onLogin(email, password);
      setPassword("");
    } catch (loginError) {
      setFormError(loginError instanceof Error ? loginError.message : t("loginFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="login-page" aria-label={t("authentication")}>
      <div className="login-card">
        <div className="login-heading">
          <span className="login-icon"><LogIn size={22} /></span>
          <div>
            <h2>{t("signInTitle")}</h2>
            <p>{t("signInSubtitle")}</p>
          </div>
        </div>
        <form className="login-page-form" onSubmit={submitLogin}>
          <label>
            <span>{t("email")}</span>
            <input autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            <span>{t("password")}</span>
            <input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          <button className="auth-button" type="submit" disabled={submitting}><LogIn size={16} />{submitting ? t("signingIn") : t("signIn")}</button>
        </form>
        {(formError || error) && <p className="auth-error login-error">{formError ?? error}</p>}
      </div>
    </section>
  );
}

function AircraftList({ aircraft, selectedId, onSelect }: { aircraft: AircraftCollectionItem[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <section className="panel aircraft-list" aria-label="Aircraft list">
      {aircraft.map((item) => (
        <button className={item.id === selectedId ? "aircraft-row selected" : "aircraft-row"} key={item.id} type="button" onClick={() => onSelect(item.id)}>
          <span><strong>{item.currentRegistration}</strong><small>{item.variant.name} · {item.serialNumber}</small></span>
          <em>{item.currentCountryIso2}</em>
        </button>
      ))}
    </section>
  );
}

function AircraftProfile({ aircraft, t }: { aircraft: AircraftCollectionItem; t: (key: TranslationKey) => string }) {
  return (
    <section className="panel profile-panel">
      <div className="section-title"><span>{t("selectedAirframe")}</span><strong>{aircraft.currentStatus.toUpperCase()}</strong></div>
      <div className="aircraft-visual"><AircraftSilhouette /></div>
      <div className="profile-heading"><p>{aircraft.manufacturer.name} · {aircraft.model.name}</p><h2>{aircraft.currentRegistration}</h2><span>{aircraft.variant.name}</span></div>
      <dl className="facts-grid">
        <Fact label={t("serial")} value={aircraft.serialNumber} />
        <Fact label={t("operator")} value={aircraft.currentOperator} />
        <Fact label={t("squadron")} value={aircraft.currentSquadron ?? "Unassigned"} />
        <Fact label={t("livery")} value={aircraft.livery} />
        <Fact label={t("built")} value={aircraft.builtYear?.toString() ?? "Unknown"} />
        <Fact label={t("country")} value={aircraft.country.defaultName} />
      </dl>
      <p className="notes">{aircraft.notes}</p>
    </section>
  );
}

function ReferencePanel({ aircraft, t }: { aircraft: AircraftCollectionItem; t: (key: TranslationKey) => string }) {
  const specs = aircraft.variant.specs;
  return (
    <section className="panel reference-panel">
      <div className="section-title"><span>{t("technicalReference")}</span><strong>{aircraft.variant.name}</strong></div>
      <Fact label={t("role")} value={aircraft.variant.role} />
      <div className="spec-stack">
        <Spec label={t("speed")} value={`${specs.maxSpeedKmh?.toLocaleString() ?? "-"} km/h`} />
        <Spec label={t("range")} value={`${specs.rangeKm?.toLocaleString() ?? "-"} km`} />
        <Spec label={t("ceiling")} value={`${specs.serviceCeilingM?.toLocaleString() ?? "-"} m`} />
      </div>
      <Fact label={t("engines")} value={specs.engineSummary} />
      <Fact label={t("radar")} value={specs.radarSummary ?? "Not recorded"} />
      <Fact label={t("armament")} value={specs.armamentSummary ?? "Not recorded"} />
    </section>
  );
}

function SightingsPanel({ aircraft, title, t }: { aircraft: AircraftCollectionItem; title: string; t: (key: TranslationKey) => string }) {
  return (
    <section className="panel sightings-panel">
      <div className="section-title"><span>{title}</span><strong>{aircraft.sightings.length} {t("sightings")}</strong></div>
      {aircraft.sightings.length === 0 ? <p className="empty-state">{t("sightingsEmpty")}</p> : aircraft.sightings.map((sighting: Sighting) => (
        <article className="sighting-row" key={sighting.id}>
          <div className="photo-strip" aria-hidden="true"><span /><span /><span /></div>
          <div>
            <strong>{sighting.location}</strong>
            <small><CalendarDays size={14} /> {formatDate(sighting.date)} · {sighting.photoCount} {t("photos")}</small>
          </div>
        </article>
      ))}
    </section>
  );
}

function SelectFilter({ icon, label, value, onChange, options }: { icon?: ReactNode; label: string; value: string; onChange: (value: string) => void; options: [string, string][] }) {
  return (
    <label className="select-field">
      {icon}<span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );
}

function StatePanel({ message, tone }: { message: string; tone?: "error" }) {
  return <section className={tone === "error" ? "panel state-panel error" : "panel state-panel"}>{message}</section>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="fact"><dt>{label}</dt><dd>{value}</dd></div>;
}

function Spec({ label, value }: { label: string; value: string }) {
  return <div className="spec"><span>{label}</span><strong>{value}</strong></div>;
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", ...options });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { message?: string } | string } | null;
    const message = typeof payload?.error === "string" ? payload.error : payload?.error?.message;
    throw new Error(message ?? "Request failed.");
  }
  return response.json() as Promise<T>;
}

function getRoute(): Route {
  return appRoutes.includes(window.location.pathname as Route) ? (window.location.pathname as Route) : "/collection";
}

function routeLabel(route: Route, t: (key: TranslationKey) => string) {
  if (route === "/map") return t("map");
  if (route === "/timeline") return t("timeline");
  if (route === "/reference") return t("reference");
  if (route === "/login") return t("signIn");
  return t("collection");
}

function countryOptions(aircraft: AircraftCollectionItem[], t: (key: TranslationKey) => string): [string, string][] {
  const countries = new Map(aircraft.map((item) => [item.currentCountryIso2, item.country.defaultName]));
  return [["", t("allCountries")], ...Array.from(countries.entries())];
}

function categoryOptions(t: (key: TranslationKey) => string): [string, string][] {
  return [["", t("allCategories")], ["fighter", "Fighter"], ["transport", "Transport"], ["helicopter", "Helicopter"], ["trainer", "Trainer"], ["airliner", "Airliner"], ["uav", "UAV"], ["other", "Other"]];
}

function statusOptions(t: (key: TranslationKey) => string): [string, string][] {
  return [["", t("allStatuses")], ["active", t("active")], ["stored", t("stored")], ["retired", t("retired")], ["preserved", t("preserved")], ["scrapped", t("scrapped")]];
}

function mapCenter(markers: MapMarker[]): [number, number] {
  const latitude = markers.reduce((sum, marker) => sum + marker.latitude, 0) / markers.length;
  const longitude = markers.reduce((sum, marker) => sum + marker.longitude, 0) / markers.length;
  return [latitude, longitude];
}

function referenceLabel(type: ReferenceType, t: (key: TranslationKey) => string) {
  const key = `ref_${type}` as TranslationKey;
  return t(key);
}

function defaultReferenceColumns(type: ReferenceType) {
  if (type === "countries") return ["iso2", "iso3", "default_name"];
  if (type === "models") return ["id", "manufacturer_id", "name", "category", "introduced_year"];
  if (type === "variants") return ["id", "model_id", "name", "role", "first_flight_year", "introduced_year", "specs"];
  if (type === "squadrons") return ["id", "name", "operator_id", "country_iso2"];
  if (type === "locations") return ["id", "name", "country_iso2", "latitude", "longitude"];
  if (type === "airBases") return ["id", "location_id", "name", "icao_code", "country_iso2"];
  return ["id", "name", "country_iso2"];
}

const nullableReferenceColumns = new Set(["introduced_year", "first_flight_year", "latitude", "longitude", "icao_code", "operator_id", "location_id", "country_iso2"]);

function aircraftFormValues(aircraft: AircraftCollectionItem) {
  return {
    variantId: aircraft.variantId,
    serialNumber: aircraft.serialNumber,
    currentRegistration: aircraft.currentRegistration,
    currentOperator: aircraft.currentOperator,
    currentSquadron: aircraft.currentSquadron ?? "",
    currentCountryIso2: aircraft.currentCountryIso2,
    currentStatus: aircraft.currentStatus,
    livery: aircraft.livery,
    builtYear: aircraft.builtYear?.toString() ?? "",
    notes: aircraft.notes,
  };
}

function formatCell(value: unknown) {
  if (value == null || value === "") return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
