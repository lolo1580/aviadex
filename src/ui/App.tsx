import {
  CalendarDays,
  ChevronRight,
  Filter,
  Languages,
  LogIn,
  LogOut,
  MapPinned,
  Plane,
  Search,
  User,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { filterAircraft, getCollectionStats, type AircraftFilters } from "../application/aircraftSearch";
import type { AircraftCollectionItem, Locale } from "../domain/aircraft";
import { collection } from "../infrastructure/sampleData";
import { getCurrentUser, login, logout, type AuthUser } from "./auth";
import { AircraftSilhouette } from "./components/AircraftSilhouette";
import { Metric } from "./components/Metric";
import type { TranslationKey } from "./i18n/translations";
import { useI18n } from "./i18n/useI18n";

const emptyFilters: AircraftFilters = {
  query: "",
  country: "",
  category: "",
  status: "",
};

export function App() {
  const [locale, setLocale] = useState<Locale>("en");
  const [filters, setFilters] = useState<AircraftFilters>(emptyFilters);
  const [selectedId, setSelectedId] = useState(collection[0].id);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const { t } = useI18n(locale);

  const filteredAircraft = useMemo(
    () => filterAircraft(collection, filters),
    [filters],
  );
  const selectedAircraft =
    filteredAircraft.find((aircraft) => aircraft.id === selectedId) ??
    filteredAircraft[0] ??
    collection[0];
  const stats = getCollectionStats(collection);

  function updateFilter(name: keyof AircraftFilters, value: string) {
    setFilters((current) => ({ ...current, [name]: value }));
  }

  useEffect(() => {
    let isActive = true;

    getCurrentUser()
      .then((user) => {
        if (isActive) {
          setAuthUser(user);
        }
      })
      .catch(() => {
        if (isActive) {
          setAuthError("Authentication service is unavailable.");
        }
      })
      .finally(() => {
        if (isActive) {
          setAuthLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  async function handleLogin(email: string, password: string) {
    setAuthError(null);
    const user = await login(email, password);
    setAuthUser(user);
  }

  async function handleLogout() {
    await logout();
    setAuthUser(null);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand">
          <span className="brand-mark">
            <Plane size={22} strokeWidth={2.4} />
          </span>
          <span>{t("appName")}</span>
        </div>
        <nav>
          {[t("collection"), t("map"), t("timeline"), t("reference")].map((item, index) => (
            <a className={index === 0 ? "active" : ""} href={`#${item.toLowerCase()}`} key={item}>
              <ChevronRight size={16} />
              {item}
            </a>
          ))}
        </nav>
        <div className="sidebar-note">
          <span>API</span>
          <strong>/api/v1 ready model</strong>
          <p>Domain entities are normalized around physical airframes.</p>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>{t("collection")}</h1>
            <p>Track real aircraft sightings, photos, and historical lifecycle changes.</p>
          </div>
          <button
            className="language-toggle"
            type="button"
            onClick={() => setLocale(locale === "en" ? "fr" : "en")}
          >
            <Languages size={17} />
            {locale.toUpperCase()}
          </button>
        </header>

        <AuthPanel
          error={authError}
          loading={authLoading}
          user={authUser}
          onLogin={handleLogin}
          onLogout={handleLogout}
        />

        <section className="metrics" aria-label="Collection statistics">
          <Metric label={t("airframes")} value={stats.airframes} />
          <Metric label={t("variants")} value={stats.variants} />
          <Metric label={t("countries")} value={stats.countries} />
          <Metric label={t("photos")} value={stats.photos} />
        </section>

        <section className="control-strip" aria-label="Aircraft filters">
          <label className="search-field">
            <Search size={18} />
            <input
              value={filters.query}
              onChange={(event) => updateFilter("query", event.target.value)}
              placeholder={t("searchPlaceholder")}
            />
          </label>
          <SelectFilter
            icon={<Filter size={16} />}
            label={t("country")}
            value={filters.country}
            onChange={(value) => updateFilter("country", value)}
            options={[
              ["", t("allCountries")],
              ["CH", "Switzerland"],
              ["FI", "Finland"],
              ["FR", "France"],
            ]}
          />
          <SelectFilter
            label={t("category")}
            value={filters.category}
            onChange={(value) => updateFilter("category", value)}
            options={[
              ["", t("allCategories")],
              ["fighter", "Fighter"],
              ["transport", "Transport"],
            ]}
          />
          <SelectFilter
            label={t("status")}
            value={filters.status}
            onChange={(value) => updateFilter("status", value)}
            options={[
              ["", t("allStatuses")],
              ["active", t("active")],
              ["stored", t("stored")],
              ["retired", t("retired")],
              ["preserved", t("preserved")],
              ["scrapped", t("scrapped")],
            ]}
          />
        </section>

        <div className="content-grid">
          <AircraftList
            aircraft={filteredAircraft}
            selectedId={selectedAircraft.id}
            onSelect={setSelectedId}
            noResults={t("noResults")}
          />
          <AircraftProfile aircraft={selectedAircraft} t={t} />
          <ReferencePanel aircraft={selectedAircraft} t={t} />
        </div>

        <section className="lower-grid">
          <TimelinePanel aircraft={selectedAircraft} title={t("lifecycle")} />
          <SightingsPanel aircraft={selectedAircraft} title={t("sightingEvidence")} />
          <MapPanel aircraft={selectedAircraft} title={t("locationMap")} />
        </section>
      </section>
    </main>
  );
}

interface AuthPanelProps {
  error: string | null;
  loading: boolean;
  user: AuthUser | null;
  onLogin: (email: string, password: string) => Promise<void>;
  onLogout: () => Promise<void>;
}

function AuthPanel({ error, loading, user, onLogin, onLogout }: AuthPanelProps) {
  const [email, setEmail] = useState("admin@aviadex.local");
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
      setFormError(
        loginError instanceof Error ? loginError.message : "Login failed.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <section className="auth-panel" aria-label="Authentication">
        <span className="auth-status">Checking session...</span>
      </section>
    );
  }

  if (user) {
    return (
      <section className="auth-panel authenticated" aria-label="Authentication">
        <div className="auth-user">
          <User size={18} />
          <span>
            <strong>{user.displayName}</strong>
            <small>{user.email} · {user.role}</small>
          </span>
        </div>
        <button className="auth-button secondary" type="button" onClick={onLogout}>
          <LogOut size={16} />
          Sign out
        </button>
      </section>
    );
  }

  return (
    <section className="auth-panel" aria-label="Authentication">
      <form className="login-form" onSubmit={submitLogin}>
        <label>
          <span>Email</span>
          <input
            autoComplete="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label>
          <span>Password</span>
          <input
            autoComplete="current-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <button className="auth-button" type="submit" disabled={submitting}>
          <LogIn size={16} />
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
      {(formError || error) && <p className="auth-error">{formError ?? error}</p>}
    </section>
  );
}

interface SelectFilterProps {
  icon?: ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}

function SelectFilter({ icon, label, value, onChange, options }: SelectFilterProps) {
  return (
    <label className="select-field">
      {icon}
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

interface AircraftListProps {
  aircraft: AircraftCollectionItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  noResults: string;
}

function AircraftList({ aircraft, selectedId, onSelect, noResults }: AircraftListProps) {
  return (
    <section className="panel aircraft-list" aria-label="Aircraft list">
      {aircraft.length === 0 ? (
        <p className="empty-state">{noResults}</p>
      ) : (
        aircraft.map((item) => (
          <button
            className={item.id === selectedId ? "aircraft-row selected" : "aircraft-row"}
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
          >
            <span>
              <strong>{item.currentRegistration}</strong>
              <small>{item.variant.name} · {item.serialNumber}</small>
            </span>
            <em>{item.currentCountryIso2}</em>
          </button>
        ))
      )}
    </section>
  );
}

interface AircraftSectionProps {
  aircraft: AircraftCollectionItem;
  t: (key: TranslationKey) => string;
}

function AircraftProfile({ aircraft, t }: AircraftSectionProps) {
  return (
    <section className="panel profile-panel">
      <div className="section-title">
        <span>{t("selectedAirframe")}</span>
        <strong>{aircraft.currentStatus.toUpperCase()}</strong>
      </div>
      <div className="aircraft-visual">
        <AircraftSilhouette />
      </div>
      <div className="profile-heading">
        <p>{aircraft.manufacturer.name} · {aircraft.model.name}</p>
        <h2>{aircraft.currentRegistration}</h2>
        <span>{aircraft.variant.name}</span>
      </div>
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

function ReferencePanel({ aircraft, t }: AircraftSectionProps) {
  const specs = aircraft.variant.specs;

  return (
    <section className="panel reference-panel">
      <div className="section-title">
        <span>{t("technicalReference")}</span>
        <strong>{aircraft.variant.name}</strong>
      </div>
      <Fact label={t("role")} value={aircraft.variant.role} />
      <div className="spec-stack">
        <Spec label={t("speed")} value={`${specs.maxSpeedKmh?.toLocaleString()} km/h`} />
        <Spec label={t("range")} value={`${specs.rangeKm?.toLocaleString()} km`} />
        <Spec label={t("ceiling")} value={`${specs.serviceCeilingM?.toLocaleString()} m`} />
      </div>
      <Fact label={t("engines")} value={specs.engineSummary} />
      <Fact label={t("radar")} value={specs.radarSummary ?? "Not recorded"} />
      <Fact label={t("armament")} value={specs.armamentSummary ?? "Not recorded"} />
    </section>
  );
}

function TimelinePanel({ aircraft, title }: { aircraft: AircraftCollectionItem; title: string }) {
  return (
    <section className="panel timeline-panel">
      <div className="section-title">
        <span>{title}</span>
        <strong>{aircraft.history.length} entries</strong>
      </div>
      <ol className="timeline-list">
        {aircraft.history.map((event) => (
          <li key={event.id}>
            <time>{new Date(event.date).getFullYear()}</time>
            <span>
              <strong>{event.label}</strong>
              <small>{event.detail}</small>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function SightingsPanel({ aircraft, title }: { aircraft: AircraftCollectionItem; title: string }) {
  return (
    <section className="panel sightings-panel">
      <div className="section-title">
        <span>{title}</span>
        <strong>{aircraft.sightings.length} sightings</strong>
      </div>
      {aircraft.sightings.map((sighting) => (
        <article className="sighting-row" key={sighting.id}>
          <div className="photo-strip" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div>
            <strong>{sighting.location}</strong>
            <small>
              <CalendarDays size={14} /> {sighting.date} · {sighting.photoCount} photos
            </small>
          </div>
        </article>
      ))}
    </section>
  );
}

function MapPanel({ aircraft, title }: { aircraft: AircraftCollectionItem; title: string }) {
  return (
    <section className="panel map-panel">
      <div className="section-title">
        <span>{title}</span>
        <strong>{aircraft.sightings.length} pins</strong>
      </div>
      <div className="map-canvas" aria-label="Sighting map preview">
        {aircraft.sightings.map((sighting, index) => (
          <span
            className="map-pin"
            key={sighting.id}
            style={{
              left: `${28 + index * 34}%`,
              top: `${42 - index * 15}%`,
            }}
            title={sighting.location}
          >
            <MapPinned size={18} />
          </span>
        ))}
      </div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="spec">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
