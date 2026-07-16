import { canonicalizeJson, inspectJsonSafety } from "../packages/core/src/index.js";
import { describe, expect, it } from "vitest";

import * as engineContracts from "../packages/engine-contracts/src/index.js";

const {
  createContentReadModel,
  createInitialRuntimePlayerStateFromContent,
  createRuntimeCommandPlan,
  executeRuntimeMovementCommand,
  formatRuntimeMovementCommandExecutionValidationMessage,
  inspectRuntimeMovementCommandExecutionInput,
  loadContentPackageFromObject
} = engineContracts;

type ContentActionAffordance = engineContracts.ContentActionAffordance;
type ContentLoaderInput = engineContracts.ContentLoaderInput;
type ContentPackage = engineContracts.ContentPackage;
type RuntimeCommandPlan = engineContracts.RuntimeCommandPlan;
type RuntimeMovementCommandExecutorInput = engineContracts.RuntimeMovementCommandExecutorInput;
type RuntimePlayerState = engineContracts.RuntimePlayerState;
type ValidatedContentGraph = engineContracts.ValidatedContentGraph;

function createValidPackage(
  actionAffordances: readonly ContentActionAffordance[] = ["look", "go", "talk", "take", "inventory", "save", "load"]
): ContentPackage {
  return {
    packageId: "content.sample.micro-prototype",
    schemaVersion: {
      schemaId: "content-package",
      version: 1
    },
    title: "Sample Micro Prototype Package",
    theme: "neutral-sci-fi",
    description: "Minimal sample package for controlled movement boundary tests.",
    locations: [
      {
        locationId: "location.start",
        title: "Start Chamber",
        description: "A compact chamber used as a starting point.",
        exits: [
          {
            exitId: "exit.to-corridor",
            label: "Open corridor hatch",
            targetLocationId: "location.corridor"
          },
          {
            exitId: "exit.to-locked-annex",
            label: "Open locked annex door",
            targetLocationId: "location.locked",
            locked: true
          },
          {
            exitId: "exit.to-flagged-annex",
            label: "Cycle flagged annex hatch",
            targetLocationId: "location.flagged",
            conditionFlag: "access.flagged-annex"
          }
        ],
        tags: ["start", "indoors"]
      },
      {
        locationId: "location.corridor",
        title: "Service Corridor",
        description: "A plain corridor that connects the sample spaces.",
        exits: []
      },
      {
        locationId: "location.locked",
        title: "Locked Annex",
        description: "A valid location that remains blocked behind a locked exit.",
        exits: []
      },
      {
        locationId: "location.flagged",
        title: "Flagged Annex",
        description: "A valid location that opens only when the matching progress flag is present.",
        exits: []
      },
      {
        locationId: "location.unreachable",
        title: "Unreachable Annex",
        description: "A valid location that is intentionally not reachable from the start.",
        exits: []
      }
    ],
    items: [
      {
        itemId: "item.sample",
        title: "Sample Keycard",
        description: "A generic portable item.",
        locationId: "location.start",
        portable: true
      }
    ],
    npcs: [],
    dialogues: [],
    initialPlayerState: {
      startLocationId: "location.start",
      inventoryItemIds: ["item.sample"],
      progressFlags: ["intro.ready"]
    },
    actionAffordances
  };
}

function createValidInput(overrides: Partial<ContentLoaderInput> = {}): ContentLoaderInput {
  return {
    rawPackage: createValidPackage(),
    source: {
      sourceId: "fixture:content.sample.micro-prototype",
      sourceKind: "provided-object",
      packageId: "content.sample.micro-prototype",
      description: "public contract test fixture"
    },
    ...overrides
  };
}

function createValidGraph(actionAffordances?: readonly ContentActionAffordance[]): ValidatedContentGraph {
  const result = loadContentPackageFromObject({
    ...createValidInput(),
    rawPackage: createValidPackage(actionAffordances)
  });
  if (result.status !== "valid" || result.graph === undefined) {
    throw new Error("Expected valid graph fixture.");
  }
  return result.graph;
}

function createReadModel(actionAffordances?: readonly ContentActionAffordance[]) {
  return createContentReadModel({ graph: createValidGraph(actionAffordances) });
}

function createPlayerState(
  actionAffordances?: readonly ContentActionAffordance[],
  overrides: Partial<RuntimePlayerState> = {}
): RuntimePlayerState {
  const baseState = createInitialRuntimePlayerStateFromContent({
    content: { graph: createValidGraph(actionAffordances) },
    metadata: {
      createdAtRevision: 0,
      updatedAtRevision: 0
    }
  });

  return {
    ...baseState,
    ...overrides,
    inventoryItemIds: overrides.inventoryItemIds === undefined ? baseState.inventoryItemIds : [...overrides.inventoryItemIds],
    progressFlags: overrides.progressFlags === undefined ? baseState.progressFlags : [...overrides.progressFlags],
    metadata: {
      ...baseState.metadata,
      ...overrides.metadata
    }
  };
}

function createPlan(request: engineContracts.RuntimeCommandRequest, actionAffordances?: readonly ContentActionAffordance[]): RuntimeCommandPlan {
  return createRuntimeCommandPlan({
    request,
    content: createReadModel(actionAffordances),
    playerState: createPlayerState(actionAffordances),
    metadata: {
      requestId: "req.task-102.sample",
      correlationId: "corr.task-102.sample",
      deterministic: true
    }
  });
}

function createInput(
  plan: RuntimeCommandPlan,
  actionAffordances?: readonly ContentActionAffordance[],
  playerStateOverrides: Partial<RuntimePlayerState> = {}
): RuntimeMovementCommandExecutorInput {
  return {
    plan,
    content: createReadModel(actionAffordances),
    playerState: createPlayerState(actionAffordances, playerStateOverrides),
    metadata: {
      requestId: "req.task-102.sample",
      correlationId: "corr.task-102.sample",
      deterministic: true
    }
  };
}

function expectJsonSafe(value: unknown): void {
  expect(inspectJsonSafety(value)).toEqual([]);
}

describe("runtime movement command executor boundary", () => {
  it("executes a planned go command from the start location to the target location", () => {
    const plan = createPlan({ commandId: "go", targetId: "location.corridor" });
    const input = createInput(plan);
    const beforePlan = canonicalizeJson(plan);
    const beforeState = canonicalizeJson(input.playerState);

    const result = executeRuntimeMovementCommand(input);

    expect(result.status).toBe("executed");
    expect(result.commandId).toBe("go");
    expect(result.fromLocationId).toBe("location.start");
    expect(result.toLocationId).toBe("location.corridor");
    expect(result.exitId).toBe("exit.to-corridor");
    expect(result.diagnostics).toEqual([]);
    expect(canonicalizeJson(plan)).toBe(beforePlan);
    expect(canonicalizeJson(input.playerState)).toBe(beforeState);
    expectJsonSafe(result);
  });

  it("updates only current location and allowed revision metadata", () => {
    const result = executeRuntimeMovementCommand(createInput(createPlan({ commandId: "go", targetId: "location.corridor" })));

    expect(result.initialPlayerState?.currentLocationId).toBe("location.start");
    expect(result.finalPlayerState?.currentLocationId).toBe("location.corridor");
    expect(result.initialPlayerState?.revision).toBe(0);
    expect(result.finalPlayerState?.revision).toBe(1);
    expect(result.initialPlayerState?.metadata.createdAtRevision).toBe(0);
    expect(result.finalPlayerState?.metadata.createdAtRevision).toBe(0);
    expect(result.initialPlayerState?.metadata.updatedAtRevision).toBe(0);
    expect(result.finalPlayerState?.metadata.updatedAtRevision).toBe(1);
  });

  it("preserves inventory and progress flags", () => {
    const result = executeRuntimeMovementCommand(createInput(createPlan({ commandId: "go", targetId: "location.corridor" })));

    expect(result.initialPlayerState?.inventoryItemIds).toEqual(["item.sample"]);
    expect(result.finalPlayerState?.inventoryItemIds).toEqual(["item.sample"]);
    expect(result.initialPlayerState?.progressFlags).toEqual(["intro.ready"]);
    expect(result.finalPlayerState?.progressFlags).toEqual(["intro.ready"]);
    expect(result.initialPlayerState?.metadata.contentPackageId).toBe("content.sample.micro-prototype");
    expect(result.finalPlayerState?.metadata.contentPackageId).toBe("content.sample.micro-prototype");
  });

  it("rejects non-go plans", () => {
    const result = executeRuntimeMovementCommand(createInput(createPlan({ commandId: "look" })));

    expect(result.status).toBe("rejected");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain("RUNTIME_MOVEMENT_COMMAND_EXECUTION_COMMAND_UNSUPPORTED");
  });

  it("blocks missing target", () => {
    const result = executeRuntimeMovementCommand(createInput(createPlan({ commandId: "go" })));

    expect(result.status).toBe("blocked");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain("RUNTIME_MOVEMENT_COMMAND_EXECUTION_PLAN_NOT_PLANNED");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain("RUNTIME_COMMAND_PLAN_TARGET_REQUIRED");
  });

  it("blocks locked exits with explicit diagnostics", () => {
    const result = executeRuntimeMovementCommand(createInput(createPlan({ commandId: "go", targetId: "location.locked" })));

    expect(result.status).toBe("blocked");
    expect(result.exitId).toBe("exit.to-locked-annex");
    expect(result.diagnostics).toEqual([
      {
        contractVersion: "validation-diagnostic@0.1.0",
        schemaId: "validation-diagnostic",
        schemaVersion: 1,
        ownerContract: "runtime-movement-command-executor@0.1.0",
        code: "RUNTIME_MOVEMENT_COMMAND_EXIT_LOCKED",
        severity: "error",
        category: "command",
        phase: "command-execution",
        path: ["plan", "request", "targetId"],
        message: "the selected exit is locked and cannot be used yet.",
        source: {
          kind: "runtime-movement-command-executor",
          id: "movement-execution-input",
          path: ["plan", "request", "targetId"]
        },
        details: {
          currentLocationId: "location.start",
          targetLocationId: "location.locked",
          exitId: "exit.to-locked-annex",
          locked: true
        }
      }
    ]);
    expect(canonicalizeJson(result.initialPlayerState)).toBe(canonicalizeJson(result.finalPlayerState));
  });

  it("blocks exits with missing condition flags", () => {
    const result = executeRuntimeMovementCommand(createInput(createPlan({ commandId: "go", targetId: "location.flagged" })));

    expect(result.status).toBe("blocked");
    expect(result.exitId).toBe("exit.to-flagged-annex");
    expect(result.diagnostics).toEqual([
      {
        contractVersion: "validation-diagnostic@0.1.0",
        schemaId: "validation-diagnostic",
        schemaVersion: 1,
        ownerContract: "runtime-movement-command-executor@0.1.0",
        code: "RUNTIME_MOVEMENT_COMMAND_EXIT_CONDITION_UNMET",
        severity: "error",
        category: "command",
        phase: "command-execution",
        path: ["plan", "request", "targetId"],
        message: "the selected exit requires a progress flag that is not present on the player state.",
        source: {
          kind: "runtime-movement-command-executor",
          id: "movement-execution-input",
          path: ["plan", "request", "targetId"]
        },
        details: {
          currentLocationId: "location.start",
          targetLocationId: "location.flagged",
          exitId: "exit.to-flagged-annex",
          conditionFlag: "access.flagged-annex"
        }
      }
    ]);
    expect(canonicalizeJson(result.initialPlayerState)).toBe(canonicalizeJson(result.finalPlayerState));
  });

  it("allows condition-gated exits when the progress flag is present", () => {
    const plan = createPlan({ commandId: "go", targetId: "location.flagged" });
    const result = executeRuntimeMovementCommand(createInput(plan, undefined, {
      progressFlags: ["intro.ready", "access.flagged-annex"]
    }));

    expect(result.status).toBe("executed");
    expect(result.toLocationId).toBe("location.flagged");
    expect(result.exitId).toBe("exit.to-flagged-annex");
    expect(result.finalPlayerState?.currentLocationId).toBe("location.flagged");
    expect(result.finalPlayerState?.progressFlags).toEqual(["intro.ready", "access.flagged-annex"]);
  });

  it("blocks unreachable target", () => {
    const result = executeRuntimeMovementCommand(createInput(createPlan({ commandId: "go", targetId: "location.unreachable" })));

    expect(result.status).toBe("blocked");
    expect(result.diagnostics).toEqual([
      {
        contractVersion: "validation-diagnostic@0.1.0",
        schemaId: "validation-diagnostic",
        schemaVersion: 1,
        ownerContract: "runtime-movement-command-executor@0.1.0",
        code: "RUNTIME_MOVEMENT_COMMAND_TARGET_UNREACHABLE",
        severity: "error",
        category: "reference",
        phase: "command-execution",
        path: ["plan", "request", "targetId"],
        message: "target movement location is not reachable from the current location exits.",
        source: {
          kind: "runtime-movement-command-executor",
          id: "movement-execution-input",
          path: ["plan", "request", "targetId"]
        },
        details: {
          currentLocationId: "location.start",
          targetLocationId: "location.unreachable"
        }
      }
    ]);
  });

  it("blocks unresolved target location", () => {
    const result = executeRuntimeMovementCommand(createInput(createPlan({ commandId: "go", targetId: "location.missing" })));

    expect(result.status).toBe("blocked");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain("RUNTIME_COMMAND_PLAN_TARGET_UNRESOLVED");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain("RUNTIME_MOVEMENT_COMMAND_EXECUTION_PLAN_NOT_PLANNED");
  });

  it("returns deterministic JSON-safe results", () => {
    const first = executeRuntimeMovementCommand(createInput(createPlan({ commandId: "go", targetId: "location.corridor" })));
    const second = executeRuntimeMovementCommand(createInput(createPlan({ commandId: "go", targetId: "location.corridor" })));

    expect(canonicalizeJson(first)).toBe(canonicalizeJson(second));
    expectJsonSafe(first);
  });

  it("does not expose save load replay storage or event outputs", () => {
    const result = executeRuntimeMovementCommand(createInput(createPlan({ commandId: "go", targetId: "location.corridor" })));

    expect("nextState" in result).toBe(false);
    expect("statePatch" in result).toBe(false);
    expect("events" in result).toBe(false);
    expect("runtimeDomainEventValues" in result).toBe(false);
    expect("transaction" in result).toBe(false);
    expect("saveResult" in result).toBe(false);
    expect("loadResult" in result).toBe(false);
  });

  it("keeps the public surface free of generic mutable command apis", () => {
    const diagnostics = inspectRuntimeMovementCommandExecutionInput({
      plan: createPlan({ commandId: "go", targetId: "location.corridor" }),
      content: createReadModel(),
      playerState: createPlayerState(),
      metadata: {
        deterministic: false
      }
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("RUNTIME_MOVEMENT_COMMAND_EXECUTION_METADATA_INVALID");
    expect(formatRuntimeMovementCommandExecutionValidationMessage([])).toBe("Runtime movement command execution input is valid.");
    expect("executeCommand" in engineContracts).toBe(false);
    expect("executeRuntimeCommand" in engineContracts).toBe(false);
    expect("applyCommand" in engineContracts).toBe(false);
    expect("takeItem" in engineContracts).toBe(false);
    expect("talkToNpc" in engineContracts).toBe(false);
    expect("applyEffectToRuntimePlayerState" in engineContracts).toBe(false);
  });
});
