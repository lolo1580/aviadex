export type Locale = "en" | "fr";

export type AircraftStatus =
  | "active"
  | "stored"
  | "retired"
  | "preserved"
  | "scrapped";

export type AircraftCategory =
  | "fighter"
  | "transport"
  | "helicopter"
  | "trainer"
  | "airliner"
  | "uav"
  | "other";

export interface Country {
  iso2: string;
  iso3: string;
  defaultName: string;
}

export interface Manufacturer {
  id: string;
  name: string;
  countryIso2: string;
}

export interface AircraftModel {
  id: string;
  manufacturerId: string;
  name: string;
  category: AircraftCategory;
  introducedYear?: number;
}

export interface AircraftVariant {
  id: string;
  modelId: string;
  name: string;
  role: string;
  firstFlightYear?: number;
  introducedYear?: number;
  specs: VariantTechnicalSpecs;
}

export interface VariantTechnicalSpecs {
  crew?: number;
  lengthM?: number;
  wingspanM?: number;
  heightM?: number;
  emptyWeightKg?: number;
  maxTakeoffWeightKg?: number;
  maxSpeedKmh?: number;
  rangeKm?: number;
  serviceCeilingM?: number;
  engineSummary: string;
  radarSummary?: string;
  armamentSummary?: string;
}

export interface AircraftHistoryEvent {
  id: string;
  date: string;
  type: "registration" | "operator" | "squadron" | "status" | "livery";
  label: string;
  detail: string;
}

export interface Sighting {
  id: string;
  date: string;
  location: string;
  countryIso2: string;
  latitude: number;
  longitude: number;
  event?: string;
  photographer: string;
  photoCount: number;
}

export interface PhysicalAircraft {
  id: string;
  variantId: string;
  serialNumber: string;
  currentRegistration: string;
  currentOperator: string;
  currentSquadron?: string;
  currentCountryIso2: string;
  currentStatus: AircraftStatus;
  livery: string;
  builtYear?: number;
  notes: string;
  history: AircraftHistoryEvent[];
  sightings: Sighting[];
}

export interface AircraftCollectionItem extends PhysicalAircraft {
  manufacturer: Manufacturer;
  model: AircraftModel;
  variant: AircraftVariant;
  country: Country;
}
