import { canonicalizeJson, inspectJsonSafety } from "../packages/core/src/index.js";
import { describe, expect, it } from "vitest";

import * as engineContracts from "../packages/engine-contracts/src/index.js";

const {
  assertRuntimeLookCommandExecutionInput,
  createContentReadModel,
  createInitialRuntimePlayerStateFromContent,
  createRuntimeCommandPlan,
  executeRuntimeLookCommand,
  formatRuntimeLookCommandExecutionValidationMessage,
  inspectRuntimeLookCommandExecutionInput,
  loadContentPackageFromObject,
  RUNTIME_LOOK_COMMAND_EXECUTION_STATUSES
} = engineContracts;

type ContentActionAffordance = engineContracts.ContentActionAffordance;
type ContentLoaderInput = engineContracts.ContentLoaderInput;
type ContentPackage = engineContracts.ContentPackage;
type RuntimeCommandPlan = engineContracts.RuntimeCommandPlan;
type RuntimeLookCommandExecutionInput = engineContracts.RuntimeLookCommandExecutionInput;
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

function createPlayerState(actionAffordances?: readonly ContentActionAffordance[]): RuntimePlayerState {
  return createInitialRuntimePlayerStateFromContent({
    content: { graph: createValidGraph(actionAffordances) },
    metadata: {
      createdAtRevision: 0,
      updatedAtRevision: 0
    }
  });
}

function createLookExecutionInput(
  plan: RuntimeCommandPlan,
  actionAffordances?: readonly ContentActionAffordance[]
): RuntimeLookCommandExecutionInput {
  return {
    plan,
    content: createReadModel(actionAffordances),
    playerState: createPlayerState(actionAffordances),
    metadata: {
      requestId: "req.task-086.sample",
      correlationId: "corr.task-086.sample",
      deterministic: true
    }
  };
}

function expectJsonSafe(value: unknown): void {
  expect(inspectJsonSafety(value)).toEqual([]);
}

describe("runtime look command executor boundary", () => {
  it("executes planned look read-only", () => {
    expect(RUNTIME_LOOK_COMMAND_EXECUTION_STATUSES).toEqual(["executed", "rejected", "blocked"]);

    const plan = createRuntimeCommandPlan({
      request: { commandId: "look" },
      content: createReadModel(),
      playerState: createPlayerState()
    });
    const input = createLookExecutionInput(plan);
    const beforePlan = canonicalizeJson(plan);
    const beforeState = canonicalizeJson(input.playerState);

    const result = executeRuntimeLookCommand(input);

    expect(result.status).toBe("executed");
    expect(result.commandId).toBe("look");
    expect(result.diagnostics).toEqual([]);
    expect(result.view).toEqual({
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
    });
    expect(canonicalizeJson(plan)).toBe(beforePlan);
    expect(canonicalizeJson(input.playerState)).toBe(beforeState);
    expectJsonSafe(result);
  });

  it("rejects non-look planned commands", () => {
    const plan = createRuntimeCommandPlan({
      request: { commandId: "inventory" },
      content: createReadModel(),
      playerState: createPlayerState()
    });
    const input = createLookExecutionInput(plan);
    const beforePlan = canonicalizeJson(plan);
    const beforeState = canonicalizeJson(input.playerState);

    const result = executeRuntimeLookCommand(input);

    expect(result.status).toBe("rejected");
    expect(result.view).toBeUndefined();
    expect(result.diagnostics).toEqual([
      {
        contractVersion: "validation-diagnostic@0.1.0",
        schemaId: "validation-diagnostic",
        schemaVersion: 1,
        ownerContract: "runtime-look-command-executor@0.1.0",
        code: "RUNTIME_LOOK_COMMAND_EXECUTOR_COMMAND_UNSUPPORTED",
        severity: "error",
        category: "validation",
        phase: "command-execution",
        path: ["plan", "commandId"],
        message: "only the look command is supported by this executor.",
        source: {
          kind: "runtime-look-command-executor",
          id: "look-execution-input",
          path: ["plan", "commandId"]
        },
        details: {
          commandId: "inventory"
        }
      }
    ]);
    expect(canonicalizeJson(plan)).toBe(beforePlan);
    expect(canonicalizeJson(input.playerState)).toBe(beforeState);
  });

  it("blocks non-planned look plans", () => {
    const blockedPlan = createRuntimeCommandPlan({
      request: { commandId: "look" },
      content: createReadModel(["go", "talk", "take", "inventory", "save", "load"]),
      playerState: createPlayerState(["go", "talk", "take", "inventory", "save", "load"])
    });

    const result = executeRuntimeLookCommand(createLookExecutionInput(blockedPlan, ["go", "talk", "take", "inventory", "save", "load"]));

    expect(result.status).toBe("blocked");
    expect(result.view).toBeUndefined();
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain("RUNTIME_LOOK_COMMAND_EXECUTOR_PLAN_NOT_EXECUTABLE");
  });

  it("blocks missing current location", () => {
    const plan = createRuntimeCommandPlan({
      request: { commandId: "look" },
      content: createReadModel(),
      playerState: createPlayerState()
    });
    const input = createLookExecutionInput(plan);
    const invalidState = {
      ...input.playerState,
      currentLocationId: "location.missing"
    };
    const beforeState = canonicalizeJson(invalidState);

    const result = executeRuntimeLookCommand({
      ...input,
      playerState: invalidState
    });

    expect(result.status).toBe("blocked");
    expect(result.view).toBeUndefined();
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain("RUNTIME_LOOK_COMMAND_LOCATION_UNRESOLVED");
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

    const diagnostics = inspectRuntimeLookCommandExecutionInput(invalidInput);

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("RUNTIME_LOOK_COMMAND_EXECUTION_METADATA_INVALID");
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("RUNTIME_PLAYER_STATE_LOCATION_INVALID");
    expect(() => { assertRuntimeLookCommandExecutionInput(invalidInput); }).toThrow();
    expect(formatRuntimeLookCommandExecutionValidationMessage([])).toBe("Runtime look command execution input is valid.");
  });

  it("keeps execution deterministic and free of next-state outputs", () => {
    const plan = createRuntimeCommandPlan({
      request: { commandId: "look" },
      content: createReadModel(),
      playerState: createPlayerState()
    });
    const input = createLookExecutionInput(plan);

    const first = executeRuntimeLookCommand(input);
    const second = executeRuntimeLookCommand(input);

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
