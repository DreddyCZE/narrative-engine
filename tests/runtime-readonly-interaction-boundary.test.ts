import { canonicalizeJson, inspectJsonSafety } from "../packages/core/src/index.js";
import { describe, expect, it } from "vitest";

import * as engineContracts from "../packages/engine-contracts/src/index.js";

const {
  RUNTIME_READONLY_INTERACTION_STATUSES,
  assertRuntimeReadonlyInteractionInput,
  createContentReadModel,
  createInitialRuntimePlayerStateFromContent,
  createReadonlyRuntimeSmokeScenarioPackage,
  executeRuntimeReadonlyInteraction,
  formatRuntimeReadonlyInteractionValidationMessage,
  inspectRuntimeReadonlyInteractionInput,
  loadContentPackageFromObject
} = engineContracts;

type RuntimePlayerState = engineContracts.RuntimePlayerState;
type RuntimeReadonlyInteractionInput = engineContracts.RuntimeReadonlyInteractionInput;
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

function createInteractionInput(
  input: engineContracts.RuntimeReadonlyInputRequest,
  actionAffordances: readonly engineContracts.ContentActionAffordance[] = ["look", "inventory"]
): RuntimeReadonlyInteractionInput {
  return {
    input,
    content: createReadModel(actionAffordances),
    playerState: createPlayerState(actionAffordances),
    metadata: {
      requestId: "req.task-095.sample",
      correlationId: "corr.task-095.sample",
      deterministic: true
    }
  };
}

function expectJsonSafe(value: unknown): void {
  expect(inspectJsonSafety(value)).toEqual([]);
}

describe("runtime readonly interaction boundary", () => {
  it("executes valid look interactions", () => {
    expect(RUNTIME_READONLY_INTERACTION_STATUSES).toEqual(["executed", "rejected", "blocked"]);

    const input = createInteractionInput({ commandId: "look" });
    const beforeInput = canonicalizeJson(input.input);
    const beforeState = canonicalizeJson(input.playerState);

    const result = executeRuntimeReadonlyInteraction(input);

    expect(result.status).toBe("executed");
    expect(result.request).toEqual({ commandId: "look" });
    expect(result.execution?.status).toBe("executed");
    expect(result.execution?.view?.kind).toBe("look");
    expect(result.diagnostics).toEqual([]);
    expect(canonicalizeJson(result.initialPlayerState)).toBe(canonicalizeJson(result.finalPlayerState));
    expect(canonicalizeJson(input.input)).toBe(beforeInput);
    expect(canonicalizeJson(input.playerState)).toBe(beforeState);
    expectJsonSafe(result);
  });

  it("executes valid inventory interactions", () => {
    const input = createInteractionInput({ commandId: "inventory" });
    const result = executeRuntimeReadonlyInteraction(input);

    expect(result.status).toBe("executed");
    expect(result.request).toEqual({ commandId: "inventory" });
    expect(result.execution?.status).toBe("executed");
    expect(result.execution?.view?.kind).toBe("inventory");
    expect(result.diagnostics).toEqual([]);
    expect(canonicalizeJson(result.initialPlayerState)).toBe(canonicalizeJson(result.finalPlayerState));
    expectJsonSafe(result);
  });

  it("rejects invalid ui input before execution", () => {
    const input = createInteractionInput({ commandId: "go" } as unknown as engineContracts.RuntimeReadonlyInputRequest);
    const beforeInput = canonicalizeJson(input.input);
    const beforeState = canonicalizeJson(input.playerState);

    const result = executeRuntimeReadonlyInteraction(input);

    expect(result.status).toBe("rejected");
    expect(result.request).toBeUndefined();
    expect(result.execution).toBeUndefined();
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "RUNTIME_READONLY_INPUT_REQUEST_COMMAND_ID_UNSUPPORTED"
    );
    expect(canonicalizeJson(input.input)).toBe(beforeInput);
    expect(canonicalizeJson(input.playerState)).toBe(beforeState);
  });

  it("rejects malformed interaction roots", () => {
    const validState = createPlayerState();
    const invalidInput = {
      content: createReadModel(),
      playerState: {
        ...validState,
        currentLocationId: "BadLocationId"
      },
      metadata: {
        deterministic: false
      }
    };

    const diagnostics = inspectRuntimeReadonlyInteractionInput(invalidInput);

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("RUNTIME_READONLY_INTERACTION_INPUT_INVALID");
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("RUNTIME_READONLY_INTERACTION_METADATA_INVALID");
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("RUNTIME_PLAYER_STATE_LOCATION_INVALID");
    expect(() => { assertRuntimeReadonlyInteractionInput(invalidInput); }).toThrow();
    expect(formatRuntimeReadonlyInteractionValidationMessage([])).toBe("Runtime readonly interaction input is valid.");
  });

  it("preserves execution diagnostics deterministically", () => {
    const result = executeRuntimeReadonlyInteraction(
      createInteractionInput({ commandId: "inventory" }, ["look"])
    );

    expect(result.status).toBe("blocked");
    expect(result.execution?.status).toBe("blocked");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "RUNTIME_COMMAND_REQUEST_COMMAND_UNAVAILABLE"
    );
    expect(result.diagnostics.every((diagnostic) => diagnostic.path[0] === "execution")).toBe(true);
  });

  it("is deterministic and does not mutate input or state", () => {
    const input = createInteractionInput({ commandId: "look" });
    const beforeInput = canonicalizeJson(input.input);
    const beforeState = canonicalizeJson(input.playerState);

    const first = executeRuntimeReadonlyInteraction(input);
    const second = executeRuntimeReadonlyInteraction(input);

    expect(canonicalizeJson(first)).toBe(canonicalizeJson(second));
    expect(canonicalizeJson(input.input)).toBe(beforeInput);
    expect(canonicalizeJson(input.playerState)).toBe(beforeState);
  });

  it("does not include next-state, event, or storage outputs", () => {
    const result = executeRuntimeReadonlyInteraction(createInteractionInput({ commandId: "look" }));

    expect("nextState" in result).toBe(false);
    expect("statePatch" in result).toBe(false);
    expect("events" in result).toBe(false);
    expect("runtimeDomainEventValues" in result).toBe(false);
    expect("transaction" in result).toBe(false);
    expect("saveResult" in result).toBe(false);
    expect("loadResult" in result).toBe(false);
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
