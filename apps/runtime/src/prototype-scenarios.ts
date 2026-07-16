import {
  createReadonlyRuntimeSmokeScenarioPackage,
  type ContentPackage
} from "@narrative-engine/engine-contracts";

import {
  OBSERVATION_DECK_SCENARIO_MAP_LAYOUT,
  SMOKE_SCENARIO_MAP_LAYOUT,
  type PrototypeMapPanel
} from "./prototype-map-layouts.js";

export const SMOKE_PROTOTYPE_SCENARIO_ID = "prototype.smoke" as const;
export const OBSERVATION_DECK_PROTOTYPE_SCENARIO_ID = "prototype.demo.observation-deck" as const;

export type PrototypeScenarioId =
  | typeof SMOKE_PROTOTYPE_SCENARIO_ID
  | typeof OBSERVATION_DECK_PROTOTYPE_SCENARIO_ID;

export type PrototypeScenarioOption = {
  readonly scenarioId: PrototypeScenarioId;
  readonly label: string;
  readonly description: string;
};

export type PrototypeScenarioDescriptor = {
  readonly scenarioId: PrototypeScenarioId;
  readonly label: string;
  readonly description: string;
  readonly packageFactory: () => ContentPackage;
  readonly initialMapLayout: PrototypeMapPanel;
};

export const DEFAULT_PROTOTYPE_SCENARIO_ID = SMOKE_PROTOTYPE_SCENARIO_ID;

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createSmokeMovementPrototypePackage(): ContentPackage {
  const basePackage = createReadonlyRuntimeSmokeScenarioPackage();
  return cloneJsonValue({
    ...basePackage,
    actionAffordances: ["look", "inventory", "go"]
  });
}

function createObservationDeckDemoPackage(): ContentPackage {
  return {
    packageId: "content.prototype.demo.observation-deck",
    schemaVersion: {
      schemaId: "content-package",
      version: 1
    },
    title: "Prototype Observation Deck Demo Package",
    theme: "neutral-sci-fi",
    description: "Prototype-only demo package for the runtime scenario selector and controlled movement vertical slice.",
    locations: [
      {
        locationId: "location.demo.observation-deck",
        title: "Prototype Observation Deck",
        description: "A bright observation deck with prototype navigation glass and a calm starfield beyond the hull.",
        exits: [
          {
            exitId: "exit.demo.to-sensor-gallery",
            label: "Slide sensor gallery door",
            targetLocationId: "location.demo.sensor-gallery"
          },
          {
            exitId: "exit.demo.locked-service-door",
            label: "Open service locker",
            targetLocationId: "location.demo.service-locker",
            locked: true
          },
          {
            exitId: "exit.demo.maintenance-hatch",
            label: "Cycle maintenance hatch",
            targetLocationId: "location.demo.maintenance-hatch",
            conditionFlag: "demo.maintenance-access"
          }
        ],
        tags: ["prototype", "deck", "indoors"]
      },
      {
        locationId: "location.demo.sensor-gallery",
        title: "Prototype Sensor Gallery",
        description: "A narrow gallery lined with diagnostic screens used only for controlled movement and read-only switching checks.",
        exits: []
      },
      {
        locationId: "location.demo.service-locker",
        title: "Prototype Service Locker",
        description: "A compact locker room visible in the prototype only to prove locked movement diagnostics.",
        exits: []
      },
      {
        locationId: "location.demo.maintenance-hatch",
        title: "Prototype Maintenance Hatch",
        description: "A maintenance crawlspace that becomes reachable only when a future progress flag is present.",
        exits: []
      }
    ],
    items: [
      {
        itemId: "item.demo.survey-tablet",
        title: "Prototype Survey Tablet",
        description: "A portable survey tablet carried only to prove that scenario inventory can switch cleanly.",
        portable: true
      }
    ],
    npcs: [
      {
        npcId: "npc.demo.analyst",
        name: "Prototype Analyst",
        locationId: "location.demo.observation-deck",
        dialogueId: "dialogue.demo.analyst"
      }
    ],
    dialogues: [
      {
        dialogueId: "dialogue.demo.analyst",
        title: "Prototype Advisory",
        lines: ["This observation deck package exists only for UI switching and controlled movement validation."]
      }
    ],
    initialPlayerState: {
      startLocationId: "location.demo.observation-deck",
      inventoryItemIds: ["item.demo.survey-tablet"],
      progressFlags: ["demo.ready"]
    },
    actionAffordances: ["look", "inventory", "go"]
  };
}

export const PROTOTYPE_SCENARIOS: readonly PrototypeScenarioDescriptor[] = [
  {
    scenarioId: SMOKE_PROTOTYPE_SCENARIO_ID,
    label: "Smoke Scenario",
    description: "Public readonly smoke scenario from engine contracts with the airlock, corridor, and keycard baseline.",
    packageFactory: createSmokeMovementPrototypePackage,
    initialMapLayout: SMOKE_SCENARIO_MAP_LAYOUT
  },
  {
    scenarioId: OBSERVATION_DECK_PROTOTYPE_SCENARIO_ID,
    label: "Observation Deck Demo",
    description: "Prototype-only app-layer demo scenario used to prove that UI can swap content packages without changing engine contracts.",
    packageFactory: createObservationDeckDemoPackage,
    initialMapLayout: OBSERVATION_DECK_SCENARIO_MAP_LAYOUT
  }
] as const;

export function isPrototypeScenarioId(value: string): value is PrototypeScenarioId {
  return PROTOTYPE_SCENARIOS.some((scenario) => scenario.scenarioId === value);
}

export function getPrototypeScenarioDescriptor(scenarioId: PrototypeScenarioId): PrototypeScenarioDescriptor {
  const scenario = PROTOTYPE_SCENARIOS.find((entry) => entry.scenarioId === scenarioId);
  if (scenario === undefined) {
    throw new Error(`Unknown prototype scenario id: ${scenarioId}`);
  }

  return scenario;
}

export function createPrototypeScenarioOptions(): readonly PrototypeScenarioOption[] {
  return PROTOTYPE_SCENARIOS.map((scenario) => ({
    scenarioId: scenario.scenarioId,
    label: scenario.label,
    description: scenario.description
  }));
}
