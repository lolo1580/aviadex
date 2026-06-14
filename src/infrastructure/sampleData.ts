import type {
  AircraftCollectionItem,
  AircraftModel,
  AircraftVariant,
  Country,
  Manufacturer,
  PhysicalAircraft,
} from "../domain/aircraft";

const countries: Country[] = [
  { iso2: "CH", iso3: "CHE", defaultName: "Switzerland" },
  { iso2: "FI", iso3: "FIN", defaultName: "Finland" },
  { iso2: "US", iso3: "USA", defaultName: "United States" },
  { iso2: "FR", iso3: "FRA", defaultName: "France" },
];

const manufacturers: Manufacturer[] = [
  { id: "mcdonnell-douglas", name: "McDonnell Douglas", countryIso2: "US" },
  { id: "airbus", name: "Airbus", countryIso2: "FR" },
];

const models: AircraftModel[] = [
  {
    id: "fa-18-hornet",
    manufacturerId: "mcdonnell-douglas",
    name: "F/A-18 Hornet",
    category: "fighter",
    introducedYear: 1983,
  },
  {
    id: "a400m-atlas",
    manufacturerId: "airbus",
    name: "A400M Atlas",
    category: "transport",
    introducedYear: 2013,
  },
];

const variants: AircraftVariant[] = [
  {
    id: "fa-18c",
    modelId: "fa-18-hornet",
    name: "F/A-18C",
    role: "Multirole fighter",
    firstFlightYear: 1987,
    introducedYear: 1989,
    specs: {
      crew: 1,
      lengthM: 17.1,
      wingspanM: 12.3,
      heightM: 4.7,
      emptyWeightKg: 10455,
      maxTakeoffWeightKg: 23400,
      maxSpeedKmh: 1915,
      rangeKm: 2000,
      serviceCeilingM: 15000,
      engineSummary: "2x General Electric F404-GE-402 turbofans",
      radarSummary: "AN/APG-73 multimode radar",
      armamentSummary: "20 mm cannon, air-to-air missiles, precision air-to-ground stores",
    },
  },
  {
    id: "a400m",
    modelId: "a400m-atlas",
    name: "A400M",
    role: "Tactical airlifter",
    firstFlightYear: 2009,
    introducedYear: 2013,
    specs: {
      crew: 3,
      lengthM: 45.1,
      wingspanM: 42.4,
      heightM: 14.7,
      maxTakeoffWeightKg: 141000,
      maxSpeedKmh: 780,
      rangeKm: 3300,
      serviceCeilingM: 11280,
      engineSummary: "4x Europrop TP400-D6 turboprops",
      radarSummary: "Weather and terrain awareness avionics suite",
      armamentSummary: "Unarmed transport platform",
    },
  },
];

const aircraft: PhysicalAircraft[] = [
  {
    id: "j-5017",
    variantId: "fa-18c",
    serialNumber: "1371/SFC017",
    currentRegistration: "J-5017",
    currentOperator: "Swiss Air Force",
    currentSquadron: "Fliegerstaffel 11",
    currentCountryIso2: "CH",
    currentStatus: "active",
    livery: "Standard low-visibility Swiss Air Force grey",
    builtYear: 1996,
    notes: "Physical airframe record with preserved lifecycle entries and sighting evidence.",
    history: [
      {
        id: "j5017-delivery",
        date: "1996-12-12",
        type: "registration",
        label: "Delivered as J-5017",
        detail: "Accepted into Swiss Air Force service.",
      },
      {
        id: "j5017-sqn11",
        date: "2005-04-01",
        type: "squadron",
        label: "Assigned to Fliegerstaffel 11",
        detail: "Operational assignment at Meiringen Air Base.",
      },
      {
        id: "j5017-upgrade",
        date: "2018-09-14",
        type: "status",
        label: "Upgrade package recorded",
        detail: "Lifecycle event retained without overwriting delivery data.",
      },
    ],
    sightings: [
      {
        id: "j5017-axalp",
        date: "2024-10-16",
        location: "Axalp-Ebenfluh range",
        countryIso2: "CH",
        latitude: 46.7168,
        longitude: 8.04,
        event: "Axalp demonstration",
        photographer: "Collection owner",
        photoCount: 18,
      },
      {
        id: "j5017-meiringen",
        date: "2025-06-04",
        location: "Meiringen Air Base",
        countryIso2: "CH",
        latitude: 46.7433,
        longitude: 8.1092,
        photographer: "Collection owner",
        photoCount: 9,
      },
    ],
  },
  {
    id: "hn-457",
    variantId: "fa-18c",
    serialNumber: "165190",
    currentRegistration: "HN-457",
    currentOperator: "Finnish Air Force",
    currentSquadron: "HavLLv 31",
    currentCountryIso2: "FI",
    currentStatus: "active",
    livery: "Finnish tactical grey",
    builtYear: 1998,
    notes: "Example airframe for cross-country collection search.",
    history: [
      {
        id: "hn457-delivery",
        date: "1998-08-21",
        type: "registration",
        label: "Delivered as HN-457",
        detail: "Entered Finnish Air Force inventory.",
      },
      {
        id: "hn457-status",
        date: "2022-03-02",
        type: "status",
        label: "Active service confirmed",
        detail: "Status entry appended after collection review.",
      },
    ],
    sightings: [
      {
        id: "hn457-kuopio",
        date: "2025-05-17",
        location: "Kuopio-Rissala",
        countryIso2: "FI",
        latitude: 63.0071,
        longitude: 27.7978,
        photographer: "Collection owner",
        photoCount: 6,
      },
    ],
  },
  {
    id: "f-rbal",
    variantId: "a400m",
    serialNumber: "MSN033",
    currentRegistration: "F-RBAL",
    currentOperator: "French Air and Space Force",
    currentCountryIso2: "FR",
    currentStatus: "active",
    livery: "French tactical transport grey",
    builtYear: 2015,
    notes: "Transport aircraft example sharing the same normalized lifecycle model.",
    history: [
      {
        id: "frbal-delivery",
        date: "2015-07-03",
        type: "registration",
        label: "Delivered as F-RBAL",
        detail: "Assigned to French transport fleet.",
      },
    ],
    sightings: [
      {
        id: "frbal-payerne",
        date: "2024-09-07",
        location: "Payerne Air Base",
        countryIso2: "CH",
        latitude: 46.8432,
        longitude: 6.9151,
        event: "Airshow static display",
        photographer: "Collection owner",
        photoCount: 12,
      },
    ],
  },
];

export const collection: AircraftCollectionItem[] = aircraft.map((airframe) => {
  const variant = variants.find((candidate) => candidate.id === airframe.variantId);
  if (!variant) {
    throw new Error(`Missing variant for ${airframe.id}`);
  }

  const model = models.find((candidate) => candidate.id === variant.modelId);
  if (!model) {
    throw new Error(`Missing model for ${variant.id}`);
  }

  const manufacturer = manufacturers.find(
    (candidate) => candidate.id === model.manufacturerId,
  );
  if (!manufacturer) {
    throw new Error(`Missing manufacturer for ${model.id}`);
  }

  const country = countries.find(
    (candidate) => candidate.iso2 === airframe.currentCountryIso2,
  );
  if (!country) {
    throw new Error(`Missing country for ${airframe.currentCountryIso2}`);
  }

  return {
    ...airframe,
    manufacturer,
    model,
    variant,
    country,
  };
});
