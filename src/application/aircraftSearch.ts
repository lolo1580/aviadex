import type { AircraftCollectionItem } from "../domain/aircraft";

export interface AircraftFilters {
  query: string;
  country: string;
  category: string;
  status: string;
}

export function filterAircraft(
  collection: AircraftCollectionItem[],
  filters: AircraftFilters,
): AircraftCollectionItem[] {
  const query = filters.query.trim().toLowerCase();

  return collection.filter((aircraft) => {
    const searchText = [
      aircraft.currentRegistration,
      aircraft.serialNumber,
      aircraft.currentOperator,
      aircraft.currentSquadron,
      aircraft.manufacturer.name,
      aircraft.model.name,
      aircraft.variant.name,
      aircraft.country.defaultName,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      (!query || searchText.includes(query)) &&
      (!filters.country || aircraft.currentCountryIso2 === filters.country) &&
      (!filters.category || aircraft.model.category === filters.category) &&
      (!filters.status || aircraft.currentStatus === filters.status)
    );
  });
}

export function getCollectionStats(collection: AircraftCollectionItem[]) {
  const countries = new Set(collection.map((aircraft) => aircraft.currentCountryIso2));
  const variants = new Set(collection.map((aircraft) => aircraft.variantId));
  const photos = collection.reduce(
    (total, aircraft) =>
      total +
      aircraft.sightings.reduce(
        (aircraftTotal, sighting) => aircraftTotal + sighting.photoCount,
        0,
      ),
    0,
  );

  return {
    airframes: collection.length,
    countries: countries.size,
    variants: variants.size,
    photos,
  };
}
