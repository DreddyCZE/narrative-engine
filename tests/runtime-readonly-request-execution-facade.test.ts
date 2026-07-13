import { canonicalizeJson, inspectJsonSafety } from "../packages/core/src/index.js";
import { describe, expect, it } from "vitest";

import * as engineContracts from "../packages/engine-contracts/src/index.js";

const {
  assertRuntimeReadonlyRequestExecutionInput,
  createContentReadModel,
  createInitialRuntimePlayerStateFromContent,
  createReadonlyRuntimeSmokeScenarioPackage,
  executeRuntimeReadonlyRequest,
  formatRuntimeReadonlyRequestExecutionValidationMessage,
  inspectRuntimeReadonlyRequestExecutionInput,
  loadContentPackageFromObject,
  RUNTIME_READONLY_REQUEST_EXECUTION_STATUSES
} = engineContracts;

type RuntimePlayerState = engineContracts.RuntimePlayerState;
type RuntimeReadonlyRequestExecutionInput = engineContracts.RuntimeReadonlyRequestExecutionInput;
type ValidatedContentGraph = engineContracts.ValidatedContentGraph;

function createValidGraph(
  actionAffordances: readonly engineContracts.ContentActionAffordance[] = ["look", "inventory"]
): ValidatedContentGraph {
  const basePackage = createReadonlyRuntimeSmokeScenarioPackage();
  const loadResult = loadContentPackageFromObject({
    rawPackage: {
      ...basePackage,
      actionAffordances
    },
    source: {
      sourceId: "fixture:content.runtime-smoke.readonly",
      sourceKind: "provided-object",
      packageId: "content.runtime-smoke.readonly",
      description: "public readonly runtime smoke scenario fixture"
    }
  });
  if (loadResult.status !== "valid" || loadResult.graph === undefined) {
    throw new Error("Expected valid graph fixture.");
  }
  return loadResult.graph;
}

function createReadModel(
  actionAffordances: readonly engineContracts.ContentActionAffordance[] = ["look", "inventory"]
) {
  return createContentReadModel({ graph: createValidGraph(actionAffordances) });
}

function createPlayerState(
  actionAffordances: readonly engineContracts.ContentActionAffordance[] = ["look", "inventory"]
): RuntimePlayerState {
  return createInitialRuntimePlayerStateFromContent({
    content: { graph: createValidGraph(actionAffordances) },
    metadata: {
      createdAtRevision: 0,
      updatedAtRevision: 0
    }
  });
}

function createReadonlyRequestInput(
  request: engineContracts.RuntimeCommandRequest,
  actionAffordances: readonly engineContracts.ContentActionAffordance[] = ["look", "inventory"]
): RuntimeReadonlyRequestExecutionInput {
  return {
    request,
    content: createReadModel(actionAffordances),
    playerState: createPlayerState(actionAffordances),
    metadata: {
      requestId: "req.task-090.sample",
      correlationId: "corr.task-090.sample",
      deterministic: true
    }
  };
}

function expectJsonSafe(value: unknown): void {
  expect(inspectJsonSafety(value)).toEqual([]);
}

describe("runtime readonly request execution facade", () => {
  it("executes look requests end-to-end", () => {
    expect(RUNTIME_READONLY_REQUEST_EXECUTION_STATUSES).toEqual(["executed", "rejected", "blocked"]);

    const input = createReadonlyRequestInput({ commandId: "look" });
    const beforeRequest = canonicalizeJson(input.request);
    const beforeState = canonicalizeJson(input.playerState);

    const result = executeRuntimeReadonlyRequest(input);

    expect(result.status).toBe("executed");
    expect(result.commandId).toBe("look");
    expect(result.plan?.status).toBe("planned");
    expect(result.diagnostics).toEqual([]);
    expect(result.view).toEqual({
      kind: "look",
      look: {
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
        items: [],
        npcs: [
          {
            npcId: "npc.smoke.observer",
            name: "Smoke Observer",
            dialogueId: "dialogue.smoke.observer"
          }
        ],
        availableActions: ["look", "inventory"]
      }
    });
    expect(canonicalizeJson(result.initialPlayerState)).toBe(canonicalizeJson(result.finalPlayerState));
    expect(canonicalizeJson(input.request)).toBe(beforeRequest);
    expect(canonicalizeJson(input.playerState)).toBe(beforeState);
    expectJsonSafe(result);
  });

  it("executes inventory requests end-to-end", () => {
    const input = createReadonlyRequestInput({ commandId: "inventory" });
    const beforeRequest = canonicalizeJson(input.request);
    const beforeState = canonicalizeJson(input.playerState);

    const result = executeRuntimeReadonlyRequest(input);

    expect(result.status).toBe("executed");
    expect(result.commandId).toBe("inventory");
    expect(result.plan?.status).toBe("planned");
    expect(result.diagnostics).toEqual([]);
    expect(result.view).toEqual({
      kind: "inventory",
      inventory: {
        itemCount: 1,
        items: [
          {
            itemId: "item.smoke.keycard",
            title: "Smoke Test Keycard",
            description: "A neutral portable item used to verify read-only inventory rendering.",
            portable: true
          }
        ],
        unresolvedItemIds: []
      }
    });
    expect(canonicalizeJson(result.initialPlayerState)).toBe(canonicalizeJson(result.finalPlayerState));
    expect(canonicalizeJson(input.request)).toBe(beforeRequest);
    expect(canonicalizeJson(input.playerState)).toBe(beforeState);
    expectJsonSafe(result);
  });

  it("rejects unsupported mutable requests", () => {
    const input = createReadonlyRequestInput({ commandId: "go", targetId: "location.smoke.corridor" }, ["look", "go", "inventory"]);
    const beforeRequest = canonicalizeJson(input.request);
    const beforeState = canonicalizeJson(input.playerState);

    const result = executeRuntimeReadonlyRequest(input);

    expect(result.status).toBe("rejected");
    expect(result.plan?.status).toBe("planned");
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
    expect(canonicalizeJson(result.initialPlayerState)).toBe(canonicalizeJson(result.finalPlayerState));
    expect(canonicalizeJson(input.request)).toBe(beforeRequest);
    expect(canonicalizeJson(input.playerState)).toBe(beforeState);
  });

  it("blocks unavailable supported commands", () => {
    const result = executeRuntimeReadonlyRequest(
      createReadonlyRequestInput({ commandId: "inventory" }, ["look"])
    );

    expect(result.status).toBe("blocked");
    expect(result.plan?.status).toBe("blocked");
    expect(result.view).toBeUndefined();
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain("RUNTIME_COMMAND_REQUEST_COMMAND_UNAVAILABLE");
  });

  it("preserves delegated diagnostics", () => {
    const input = createReadonlyRequestInput({ commandId: "inventory" });
    const invalidState = {
      ...input.playerState,
      inventoryItemIds: ["item.smoke.keycard", "item.missing"]
    };
    const beforeState = canonicalizeJson(invalidState);

    const result = executeRuntimeReadonlyRequest({
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
    const invalidInput = {
      request: { commandId: "attack" },
      content: createReadModel(),
      playerState: {
        ...createPlayerState(),
        currentLocationId: "BadLocationId"
      },
      metadata: {
        deterministic: false
      }
    };

    const diagnostics = inspectRuntimeReadonlyRequestExecutionInput(invalidInput);

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("RUNTIME_READONLY_REQUEST_EXECUTION_METADATA_INVALID");
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("RUNTIME_PLAYER_STATE_LOCATION_INVALID");
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("RUNTIME_COMMAND_REQUEST_COMMAND_ID_UNSUPPORTED");
    expect(() => { assertRuntimeReadonlyRequestExecutionInput(invalidInput); }).toThrow();
    expect(formatRuntimeReadonlyRequestExecutionValidationMessage([])).toBe("Runtime readonly request execution input is valid.");
  });

  it("keeps request execution deterministic and free of next-state outputs", () => {
    const input = createReadonlyRequestInput({ commandId: "look" });

    const first = executeRuntimeReadonlyRequest(input);
    const second = executeRuntimeReadonlyRequest(input);

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
