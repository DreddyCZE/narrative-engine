import { canonicalizeJson, type JsonValue } from "@narrative-engine/core";

import {
  assertContentPackage,
  type ContentPackage
} from "../content/content-package-types.js";
import { loadContentPackageFromObject } from "../content-loader/content-package-loader.js";
import { createContentReadModel } from "../content-runtime/content-read-model.js";
import {
  createInitialRuntimePlayerStateFromContent,
  type RuntimePlayerState
} from "../content-runtime/runtime-player-state.js";
import {
  createRuntimeCommandPlan,
  type RuntimeCommandPlanStatus
} from "./runtime-command-planning.js";
import {
  executeRuntimeReadonlyCommand,
  type RuntimeReadonlyCommandExecutionStatus,
  type RuntimeReadonlyCommandExecutionView
} from "./runtime-readonly-command-execution-facade.js";

export const READONLY_RUNTIME_SMOKE_SCENARIO_CONTRACT_VERSION = "readonly-runtime-smoke-scenario@0.1.0" as const;

const READONLY_RUNTIME_SMOKE_SCENARIO_ID = "runtime-smoke.readonly" as const;
const READONLY_RUNTIME_SMOKE_PACKAGE_ID = "content.runtime-smoke.readonly" as const;

export type ReadonlyRuntimeSmokeScenarioPackage = ContentPackage;

export type ReadonlyRuntimeSmokeScenarioStep = {
  readonly stepId: string;
  readonly commandId: "look" | "inventory";
  readonly planStatus: RuntimeCommandPlanStatus;
  readonly executionStatus: RuntimeReadonlyCommandExecutionStatus;
  readonly diagnostics: readonly engineContractsValidationDiagnostic[];
  readonly view?: RuntimeReadonlyCommandExecutionView;
};

type engineContractsValidationDiagnostic = import("../validation-diagnostic/validation-diagnostic.js").ValidationDiagnostic;

export type ReadonlyRuntimeSmokeScenarioResult = {
  readonly scenarioId: typeof READONLY_RUNTIME_SMOKE_SCENARIO_ID;
  readonly packageId: string;
  readonly steps: readonly ReadonlyRuntimeSmokeScenarioStep[];
  readonly initialPlayerState: RuntimePlayerState;
  readonly finalPlayerState: RuntimePlayerState;
  readonly metadata: {
    readonly deterministic: true;
    readonly scenarioVersion: typeof READONLY_RUNTIME_SMOKE_SCENARIO_CONTRACT_VERSION;
    readonly stepsCount: number;
    readonly diagnosticsCount: number;
  };
};

function cloneJsonValue<T extends JsonValue>(value: T): T {
  return JSON.parse(canonicalizeJson(value)) as T;
}

function createStep(
  stepId: string,
  commandId: "look" | "inventory",
  playerState: RuntimePlayerState,
  content: ReturnType<typeof createContentReadModel>
): ReadonlyRuntimeSmokeScenarioStep {
  const plan = createRuntimeCommandPlan({
    request: { commandId },
    content,
    playerState,
    metadata: {
      deterministic: true,
      requestId: `${READONLY_RUNTIME_SMOKE_SCENARIO_ID}.${commandId}.request`,
      correlationId: READONLY_RUNTIME_SMOKE_SCENARIO_ID
    }
  });
  const execution = executeRuntimeReadonlyCommand({
    plan,
    content,
    playerState,
    metadata: {
      deterministic: true,
      requestId: `${READONLY_RUNTIME_SMOKE_SCENARIO_ID}.${commandId}.execution`,
      correlationId: READONLY_RUNTIME_SMOKE_SCENARIO_ID
    }
  });

  return {
    stepId,
    commandId,
    planStatus: plan.status,
    executionStatus: execution.status,
    diagnostics: execution.diagnostics,
    ...(execution.view === undefined ? {} : { view: execution.view })
  };
}

export function createReadonlyRuntimeSmokeScenarioPackage(): ReadonlyRuntimeSmokeScenarioPackage {
  const contentPackage: ReadonlyRuntimeSmokeScenarioPackage = {
    packageId: READONLY_RUNTIME_SMOKE_PACKAGE_ID,
    schemaVersion: {
      schemaId: "content-package",
      version: 1
    },
    title: "Readonly Runtime Smoke Scenario",
    theme: "neutral-sci-fi",
    description: "Neutral public smoke scenario for read-only runtime boundaries.",
    locations: [
      {
        locationId: "location.smoke.start",
        title: "Smoke Test Airlock",
        description: "A clean, pressurized airlock used for neutral runtime smoke checks.",
        exits: [
          {
            exitId: "exit.smoke.to-corridor",
            label: "Open corridor door",
            targetLocationId: "location.smoke.corridor"
          }
        ],
        tags: ["smoke", "start", "indoors"]
      },
      {
        locationId: "location.smoke.corridor",
        title: "Smoke Test Corridor",
        description: "A quiet corridor that exists only to prove read-only location graph access.",
        exits: []
      }
    ],
    items: [
      {
        itemId: "item.smoke.keycard",
        title: "Smoke Test Keycard",
        description: "A neutral portable item used to verify read-only inventory rendering.",
        portable: true
      }
    ],
    npcs: [
      {
        npcId: "npc.smoke.observer",
        name: "Smoke Observer",
        locationId: "location.smoke.start",
        dialogueId: "dialogue.smoke.observer"
      }
    ],
    dialogues: [
      {
        dialogueId: "dialogue.smoke.observer",
        title: "Smoke Observation",
        lines: ["Readonly runtime smoke scenario online."]
      }
    ],
    initialPlayerState: {
      startLocationId: "location.smoke.start",
      inventoryItemIds: ["item.smoke.keycard"],
      progressFlags: ["smoke.ready"]
    },
    actionAffordances: ["look", "inventory"]
  };

  assertContentPackage(contentPackage);
  return cloneJsonValue(contentPackage as JsonValue) as ReadonlyRuntimeSmokeScenarioPackage;
}

export function runReadonlyRuntimeSmokeScenario(): ReadonlyRuntimeSmokeScenarioResult {
  const contentPackage = createReadonlyRuntimeSmokeScenarioPackage();
  const loadResult = loadContentPackageFromObject({
    rawPackage: contentPackage,
    source: {
      sourceId: `fixture:${READONLY_RUNTIME_SMOKE_PACKAGE_ID}`,
      sourceKind: "provided-object",
      packageId: READONLY_RUNTIME_SMOKE_PACKAGE_ID,
      description: "public readonly runtime smoke scenario fixture"
    }
  });

  if (loadResult.status !== "valid" || loadResult.graph === undefined) {
    throw new TypeError("Readonly runtime smoke scenario package must load successfully.");
  }

  const content = createContentReadModel({ graph: loadResult.graph });
  const playerState = createInitialRuntimePlayerStateFromContent({
    content: { graph: loadResult.graph },
    metadata: {
      createdAtRevision: 0,
      updatedAtRevision: 0
    }
  });
  const initialPlayerState = cloneJsonValue(playerState as JsonValue) as RuntimePlayerState;

  const steps: readonly ReadonlyRuntimeSmokeScenarioStep[] = [
    createStep("step.runtime-smoke.look", "look", playerState, content),
    createStep("step.runtime-smoke.inventory", "inventory", playerState, content)
  ];

  const finalPlayerState = cloneJsonValue(playerState as JsonValue) as RuntimePlayerState;
  const diagnosticsCount = steps.reduce((count, step) => count + step.diagnostics.length, 0);
  const result: ReadonlyRuntimeSmokeScenarioResult = {
    scenarioId: READONLY_RUNTIME_SMOKE_SCENARIO_ID,
    packageId: contentPackage.packageId,
    steps,
    initialPlayerState,
    finalPlayerState,
    metadata: {
      deterministic: true,
      scenarioVersion: READONLY_RUNTIME_SMOKE_SCENARIO_CONTRACT_VERSION,
      stepsCount: steps.length,
      diagnosticsCount
    }
  };

  return cloneJsonValue(result as JsonValue) as ReadonlyRuntimeSmokeScenarioResult;
}
