import { canonicalizeJson, inspectJsonSafety } from "../packages/core/src/index.js";
import { describe, expect, it } from "vitest";

import * as engineContracts from "../packages/engine-contracts/src/index.js";

const {
  assertRuntimeReadonlyCommandExecutionInput,
  createContentReadModel,
  createInitialRuntimePlayerStateFromContent,
  createRuntimeCommandPlan,
  executeRuntimeReadonlyCommand,
  formatRuntimeReadonlyCommandExecutionValidationMessage,
  inspectRuntimeReadonlyCommandExecutionInput,
  loadContentPackageFromObject,
  RUNTIME_READONLY_COMMAND_EXECUTION_STATUSES
} = engineContracts;

type ContentActionAffordance = engineContracts.ContentActionAffordance;
type ContentLoaderInput = engineContracts.ContentLoaderInput;
type ContentPackage = engineContracts.ContentPackage;
type RuntimeCommandPlan = engineContracts.RuntimeCommandPlan;
type RuntimePlayerState = engineContracts.RuntimePlayerState;
type RuntimeReadonlyCommandExecutionInput = engineContracts.RuntimeReadonlyCommandExecutionInput;
type ValidatedContentGraph = engineContracts.ValidatedContentGraph;

function createValidPackage(
  actionAffordances: readonly ContentActionAffordance[] = ["look", "go", "talk", "take", "inventory", "save", "load"],
  inventoryItemIds: readonly string[] = ["item.sample"]
): ContentPackage {
  return {
    packageId: "content.sample.micro-prototype",
    schemaVersion: {
      schemaId: "content-package",
      version: 1
    },
    title: "Sample Micro Prototype Package",
    theme: "neutral-sci-fi",
    description: "Minimal sample package for future prototype contracts.",
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
          }
        ],
        tags: ["start", "indoors"]
      },
      {
        locationId: "location.corridor",
        title: "Service Corridor",
        description: "A plain corridor that connects the sample spaces.",
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
    npcs: [
      {
        npcId: "npc.sample",
        name: "Sample Witness",
        locationId: "location.start",
        dialogueId: "dialogue.sample"
      }
    ],
    dialogues: [
      {
        dialogueId: "dialogue.sample",
        title: "Sample Exchange",
        lines: ["A short sample line."]
      }
    ],
    initialPlayerState: {
      startLocationId: "location.start",
      inventoryItemIds,
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

function createValidGraph(
  actionAffordances?: readonly ContentActionAffordance[],
  inventoryItemIds?: readonly string[]
): ValidatedContentGraph {
  const result = loadContentPackageFromObject({
    ...createValidInput(),
    rawPackage: createValidPackage(actionAffordances, inventoryItemIds)
  });
  if (result.status !== "valid" || result.graph === undefined) {
    throw new Error("Expected valid graph fixture.");
  }
  return result.graph;
}

function createReadModel(
  actionAffordances?: readonly ContentActionAffordance[],
  inventoryItemIds?: readonly string[]
) {
  return createContentReadModel({ graph: createValidGraph(actionAffordances, inventoryItemIds) });
}

function createPlayerState(
  actionAffordances?: readonly ContentActionAffordance[],
  inventoryItemIds?: readonly string[]
): RuntimePlayerState {
  return createInitialRuntimePlayerStateFromContent({
    content: { graph: createValidGraph(actionAffordances, inventoryItemIds) },
    metadata: {
      createdAtRevision: 0,
      updatedAtRevision: 0
    }
  });
}

function createReadonlyExecutionInput(
  plan: RuntimeCommandPlan,
  actionAffordances?: readonly ContentActionAffordance[],
  inventoryItemIds?: readonly string[]
): RuntimeReadonlyCommandExecutionInput {
  return {
    plan,
    content: createReadModel(actionAffordances, inventoryItemIds),
    playerState: createPlayerState(actionAffordances, inventoryItemIds),
    metadata: {
      requestId: "req.task-088.sample",
      correlationId: "corr.task-088.sample",
      deterministic: true
    }
  };
}

function expectJsonSafe(value: unknown): void {
  expect(inspectJsonSafety(value)).toEqual([]);
}

describe("runtime readonly command execution facade", () => {
  it("executes look through the facade", () => {
    expect(RUNTIME_READONLY_COMMAND_EXECUTION_STATUSES).toEqual(["executed", "rejected", "blocked"]);

    const plan = createRuntimeCommandPlan({
      request: { commandId: "look" },
      content: createReadModel(),
      playerState: createPlayerState()
    });
    const input = createReadonlyExecutionInput(plan);
    const beforePlan = canonicalizeJson(plan);
    const beforeState = canonicalizeJson(input.playerState);

    const result = executeRuntimeReadonlyCommand(input);

    expect(result.status).toBe("executed");
    expect(result.commandId).toBe("look");
    expect(result.diagnostics).toEqual([]);
    expect(result.view).toEqual({
      kind: "look",
      look: {
        locationId: "location.start",
        title: "Start Chamber",
        description: "A compact chamber used as a starting point.",
        exits: [
          {
            exitId: "exit.to-corridor",
            label: "Open corridor hatch",
            targetLocationId: "location.corridor"
          }
        ],
        items: [
          {
            itemId: "item.sample",
            title: "Sample Keycard",
            description: "A generic portable item.",
            portable: true
          }
        ],
        npcs: [
          {
            npcId: "npc.sample",
            name: "Sample Witness",
            dialogueId: "dialogue.sample"
          }
        ],
        availableActions: ["look", "go", "talk", "take", "inventory", "save", "load"]
      }
    });
    expect(canonicalizeJson(plan)).toBe(beforePlan);
    expect(canonicalizeJson(input.playerState)).toBe(beforeState);
    expectJsonSafe(result);
  });

  it("executes inventory through the facade", () => {
    const plan = createRuntimeCommandPlan({
      request: { commandId: "inventory" },
      content: createReadModel(),
      playerState: createPlayerState()
    });
    const input = createReadonlyExecutionInput(plan);
    const beforePlan = canonicalizeJson(plan);
    const beforeState = canonicalizeJson(input.playerState);

    const result = executeRuntimeReadonlyCommand(input);

    expect(result.status).toBe("executed");
    expect(result.commandId).toBe("inventory");
    expect(result.diagnostics).toEqual([]);
    expect(result.view).toEqual({
      kind: "inventory",
      inventory: {
        itemCount: 1,
        items: [
          {
            itemId: "item.sample",
            title: "Sample Keycard",
            description: "A generic portable item.",
            portable: true
          }
        ],
        unresolvedItemIds: []
      }
    });
    expect(canonicalizeJson(plan)).toBe(beforePlan);
    expect(canonicalizeJson(input.playerState)).toBe(beforeState);
    expectJsonSafe(result);
  });

  it("rejects unsupported planned commands", () => {
    const plan = createRuntimeCommandPlan({
      request: { commandId: "go", targetId: "location.corridor" },
      content: createReadModel(),
      playerState: createPlayerState()
    });
    const input = createReadonlyExecutionInput(plan);
    const beforePlan = canonicalizeJson(plan);
    const beforeState = canonicalizeJson(input.playerState);

    const result = executeRuntimeReadonlyCommand(input);

    expect(result.status).toBe("rejected");
    expect(result.view).toBeUndefined();
    expect(result.diagnostics).toEqual([
      {
        contractVersion: "validation-diagnostic@0.1.0",
        schemaId: "validation-diagnostic",
        schemaVersion: 1,
        ownerContract: "runtime-readonly-command-execution-facade@0.1.0",
        code: "RUNTIME_READONLY_COMMAND_EXECUTOR_COMMAND_UNSUPPORTED",
        severity: "error",
        category: "validation",
        phase: "command-execution",
        path: ["plan", "commandId"],
        message: "only look and inventory are supported by this read-only command facade.",
        source: {
          kind: "runtime-readonly-command-execution-facade",
          id: "readonly-execution-input",
          path: ["plan", "commandId"]
        },
        details: {
          commandId: "go"
        }
      }
    ]);
    expect(canonicalizeJson(plan)).toBe(beforePlan);
    expect(canonicalizeJson(input.playerState)).toBe(beforeState);
  });

  it("blocks non-planned supported commands", () => {
    const blockedPlan = createRuntimeCommandPlan({
      request: { commandId: "look" },
      content: createReadModel(["go", "talk", "take", "inventory", "save", "load"]),
      playerState: createPlayerState(["go", "talk", "take", "inventory", "save", "load"])
    });

    const result = executeRuntimeReadonlyCommand(
      createReadonlyExecutionInput(blockedPlan, ["go", "talk", "take", "inventory", "save", "load"])
    );

    expect(result.status).toBe("blocked");
    expect(result.view).toBeUndefined();
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain("RUNTIME_READONLY_COMMAND_EXECUTOR_PLAN_NOT_EXECUTABLE");
  });

  it("preserves delegated diagnostics", () => {
    const plan = createRuntimeCommandPlan({
      request: { commandId: "inventory" },
      content: createReadModel(),
      playerState: createPlayerState()
    });
    const input = createReadonlyExecutionInput(plan);
    const invalidState = {
      ...input.playerState,
      inventoryItemIds: ["item.sample", "item.missing"]
    };
    const beforeState = canonicalizeJson(invalidState);

    const result = executeRuntimeReadonlyCommand({
      ...input,
      playerState: invalidState
    });

    expect(result.status).toBe("blocked");
    expect(result.view).toBeUndefined();
    expect(result.diagnostics).toEqual([
      {
        contractVersion: "validation-diagnostic@0.1.0",
        schemaId: "validation-diagnostic",
        schemaVersion: 1,
        ownerContract: "runtime-inventory-command-executor@0.1.0",
        code: "RUNTIME_INVENTORY_COMMAND_ITEM_UNRESOLVED",
        severity: "error",
        category: "reference",
        phase: "command-execution",
        path: ["playerState", "inventoryItemIds", 1],
        message: "inventory item id does not resolve to a content item.",
        source: {
          kind: "runtime-inventory-command-executor",
          id: "inventory-execution-input",
          path: ["playerState", "inventoryItemIds", 1]
        },
        details: {
          itemId: "item.missing"
        }
      }
    ]);
    expect(canonicalizeJson(invalidState)).toBe(beforeState);
  });

  it("validates invalid input", () => {
    const validPlan = createRuntimeCommandPlan({
      request: { commandId: "look" },
      content: createReadModel(),
      playerState: createPlayerState()
    });
    const invalidInput = {
      plan: validPlan,
      content: createReadModel(),
      playerState: {
        ...createPlayerState(),
        currentLocationId: "BadLocationId"
      },
      metadata: {
        deterministic: false
      }
    };

    const diagnostics = inspectRuntimeReadonlyCommandExecutionInput(invalidInput);

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("RUNTIME_READONLY_COMMAND_EXECUTION_METADATA_INVALID");
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("RUNTIME_PLAYER_STATE_LOCATION_INVALID");
    expect(() => { assertRuntimeReadonlyCommandExecutionInput(invalidInput); }).toThrow();
    expect(formatRuntimeReadonlyCommandExecutionValidationMessage([])).toBe("Runtime readonly command execution input is valid.");
  });

  it("keeps facade execution deterministic and free of next-state outputs", () => {
    const plan = createRuntimeCommandPlan({
      request: { commandId: "look" },
      content: createReadModel(),
      playerState: createPlayerState()
    });
    const input = createReadonlyExecutionInput(plan);

    const first = executeRuntimeReadonlyCommand(input);
    const second = executeRuntimeReadonlyCommand(input);

    expect(canonicalizeJson(first)).toBe(canonicalizeJson(second));
    expect("nextState" in first).toBe(false);
    expect("statePatch" in first).toBe(false);
    expect("events" in first).toBe(false);
    expect("runtimeDomainEventValues" in first).toBe(false);
    expect("transaction" in first).toBe(false);
    expect("saveResult" in first).toBe(false);
    expect("loadResult" in first).toBe(false);
  });

  it("does not introduce generic execution APIs", () => {
    expect("executeCommand" in engineContracts).toBe(false);
    expect("executeRuntimeCommand" in engineContracts).toBe(false);
    expect("applyCommand" in engineContracts).toBe(false);
    expect("moveTo" in engineContracts).toBe(false);
    expect("takeItem" in engineContracts).toBe(false);
    expect("talkToNpc" in engineContracts).toBe(false);
    expect("applyEffectToRuntimePlayerState" in engineContracts).toBe(false);
  });
});
