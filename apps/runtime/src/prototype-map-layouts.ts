export type PrototypeMapTile = {
  readonly locationId: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly kind: "location" | "corridor" | "airlock" | "unknown";
};

export type PrototypeMapConnection = {
  readonly fromLocationId: string;
  readonly toLocationId: string;
  readonly kind: "door" | "corridor";
};

export type PrototypeMapPanel = {
  readonly currentLocationId?: string;
  readonly tiles: readonly PrototypeMapTile[];
  readonly connections: readonly PrototypeMapConnection[];
  readonly legend: readonly string[];
};

const DEFAULT_PROTOTYPE_MAP_LEGEND = [
  "Current",
  "Known location",
  "Connection",
  "Disabled movement"
] as const;

export const SMOKE_SCENARIO_MAP_LAYOUT: PrototypeMapPanel = {
  tiles: [
    {
      locationId: "location.smoke.start",
      label: "Smoke Test Airlock",
      x: 1,
      y: 1,
      kind: "airlock"
    },
    {
      locationId: "location.smoke.corridor",
      label: "Smoke Test Corridor",
      x: 3,
      y: 1,
      kind: "corridor"
    }
  ],
  connections: [
    {
      fromLocationId: "location.smoke.start",
      toLocationId: "location.smoke.corridor",
      kind: "door"
    }
  ],
  legend: DEFAULT_PROTOTYPE_MAP_LEGEND
};

export const OBSERVATION_DECK_SCENARIO_MAP_LAYOUT: PrototypeMapPanel = {
  tiles: [
    {
      locationId: "location.demo.observation-deck",
      label: "Prototype Observation Deck",
      x: 1,
      y: 1,
      kind: "location"
    },
    {
      locationId: "location.demo.sensor-gallery",
      label: "Prototype Sensor Gallery",
      x: 3,
      y: 1,
      kind: "corridor"
    },
    {
      locationId: "location.demo.service-locker",
      label: "Prototype Service Locker",
      x: 1,
      y: 3,
      kind: "location"
    },
    {
      locationId: "location.demo.maintenance-hatch",
      label: "Prototype Maintenance Hatch",
      x: 3,
      y: 3,
      kind: "unknown"
    }
  ],
  connections: [
    {
      fromLocationId: "location.demo.observation-deck",
      toLocationId: "location.demo.sensor-gallery",
      kind: "corridor"
    },
    {
      fromLocationId: "location.demo.observation-deck",
      toLocationId: "location.demo.service-locker",
      kind: "door"
    },
    {
      fromLocationId: "location.demo.observation-deck",
      toLocationId: "location.demo.maintenance-hatch",
      kind: "door"
    }
  ],
  legend: DEFAULT_PROTOTYPE_MAP_LEGEND
};

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createPrototypeMapPanel(
  layout: PrototypeMapPanel,
  currentLocationId?: string
): PrototypeMapPanel {
  return {
    ...(currentLocationId === undefined ? {} : { currentLocationId }),
    tiles: cloneJsonValue(layout.tiles),
    connections: cloneJsonValue(layout.connections),
    legend: cloneJsonValue(layout.legend)
  };
}
