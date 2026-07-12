import { canonicalizeJson, inspectJsonSafety } from "../packages/core/src/index.js";
import { describe, expect, it } from "vitest";

import * as engineContracts from "../packages/engine-contracts/src/index.js";

const {
  assertRuntimeCommandPlanningInput,
  createContentReadModel,
  createInitialRuntimePlayerStateFromContent,
  createRuntimeCommandPlan,
  formatRuntimeCommandPlanningValidationMessage,
  inspectRuntimeCommandPlanningInput,
  loadContentPackageFromObject,
  RUNTIME_COMMAND_PLAN_STATUSES
} = engineContracts;

type ContentActionAffordance = engineContracts.ContentActionAffordance;
type ContentLoaderInput = engineContracts.ContentLoaderInput;
type ContentPackage = engineContracts.ContentPackage;
type RuntimeCommandPlanningInput = engineContracts.RuntimeCommandPlanningInput;
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
        locationId: "location.corridor",
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

function createValidRuntimePlayerState(actionAffordances?: readonly ContentActionAffordance[]): RuntimePlayerState {
  return createInitialRuntimePlayerStateFromContent({
    content: { graph: createValidGraph(actionAffordances) },
    metadata: {
      createdAtRevision: 0,
      updatedAtRevision: 0
    }
  });
}

function createPlanningInput(
  request: engineContracts.RuntimeCommandRequest,
  actionAffordances?: readonly ContentActionAffordance[]
): RuntimeCommandPlanningInput {
  return {
    request,
    content: createContentReadModel({ graph: createValidGraph(actionAffordances) }),
    playerState: createValidRuntimePlayerState(actionAffordances),
    metadata: {
      requestId: "req.task-085.sample",
      correlationId: "corr.task-085.sample",
      deterministic: true
    }
  };
}

function expectJsonSafe(value: unknown): void {
  expect(inspectJsonSafety(value)).toEqual([]);
}

describe("runtime command planning boundary", () => {
  it("plans valid requests", () => {
    expect(RUNTIME_COMMAND_PLAN_STATUSES).toEqual(["planned", "rejected", "blocked"]);

    const cases = [
      { request: { commandId: "look" }, kind: "read", stepId: "step.look.describe-current-location" },
      { request: { commandId: "go", targetId: "location.corridor" }, kind: "movement", stepId: "step.go.prepare-movement-target-validation" },
      { request: { commandId: "talk", targetId: "npc.sample" }, kind: "interaction", stepId: "step.talk.prepare-npc-interaction-target-validation" },
      { request: { commandId: "take", targetId: "item.sample" }, kind: "inventory", stepId: "step.take.prepare-item-pickup-target-validation" },
      { request: { commandId: "inventory" }, kind: "read", stepId: "step.inventory.describe-inventory-state" },
      { request: { commandId: "save" }, kind: "system", stepId: "step.save.prepare-save-request" },
      { request: { commandId: "load" }, kind: "system", stepId: "step.load.prepare-load-request" }
    ] as const;

    for (const testCase of cases) {
      const plan = createRuntimeCommandPlan(createPlanningInput(testCase.request));

      expect(plan.status).toBe("planned");
      expect(plan.commandKind).toBe(testCase.kind);
      expect(plan.diagnostics).toEqual([]);
      expect(plan.steps[0]?.stepId).toBe(testCase.stepId);
      expectJsonSafe(plan);
    }
  });

  it("rejects invalid requests", () => {
    const invalidCases = [
      { request: {}, code: "RUNTIME_COMMAND_REQUEST_COMMAND_ID_MISSING", path: ["request", "commandId"] },
      { request: { commandId: "attack" }, code: "RUNTIME_COMMAND_REQUEST_COMMAND_ID_UNSUPPORTED", path: ["request", "commandId"] },
      { request: { commandId: "go", targetId: "BadTargetId" }, code: "RUNTIME_COMMAND_REQUEST_TARGET_ID_INVALID", path: ["request", "targetId"] }
    ] as const;

    for (const testCase of invalidCases) {
      const plan = createRuntimeCommandPlan(createPlanningInput(testCase.request as engineContracts.RuntimeCommandRequest));

      expect(plan.status).toBe("rejected");
      expect(plan.steps).toEqual([]);
      expect(plan.diagnostics.some((diagnostic) =>
        diagnostic.code === testCase.code && canonicalizeJson(diagnostic.path) === canonicalizeJson(testCase.path)
      )).toBe(true);
      expect("nextState" in plan).toBe(false);
      expect("commandResult" in plan).toBe(false);
    }
  });

  it("blocks unavailable content affordances", () => {
    const input = createPlanningInput(
      { commandId: "use", targetId: "item.sample" },
      ["look", "go", "talk", "take", "inventory", "save", "load"]
    );
    const beforeState = canonicalizeJson(input.playerState);

    const plan = createRuntimeCommandPlan(input);

    expect(plan.status).toBe("blocked");
    expect(plan.diagnostics.map((diagnostic) => diagnostic.code)).toContain("RUNTIME_COMMAND_REQUEST_COMMAND_UNAVAILABLE");
    expect(plan.steps).toEqual([]);
    expect(canonicalizeJson(input.playerState)).toBe(beforeState);
  });

  it("blocks invalid player state", () => {
    const input = createPlanningInput({ commandId: "look" });
    const invalidState = {
      ...input.playerState,
      currentLocationId: "BadLocationId"
    };
    const beforeState = canonicalizeJson(invalidState);

    const plan = createRuntimeCommandPlan({
      ...input,
      playerState: invalidState
    });

    expect(plan.status).toBe("blocked");
    expect(plan.diagnostics.map((diagnostic) => diagnostic.code)).toContain("RUNTIME_PLAYER_STATE_LOCATION_INVALID");
    expect(canonicalizeJson(invalidState)).toBe(beforeState);
  });

  it("handles target requirement hints", () => {
    const blockedPlan = createRuntimeCommandPlan(createPlanningInput({ commandId: "go" }));
    expect(blockedPlan.status).toBe("blocked");
    expect(blockedPlan.diagnostics).toEqual([
      {
        contractVersion: "validation-diagnostic@0.1.0",
        schemaId: "validation-diagnostic",
        schemaVersion: 1,
        ownerContract: "runtime-command-planning@0.1.0",
        code: "RUNTIME_COMMAND_PLAN_TARGET_REQUIRED",
        severity: "error",
        category: "reference",
        phase: "command-planning",
        path: ["request", "targetId"],
        message: "targetId is required for this command.",
        source: {
          kind: "runtime-command-planning",
          id: "planning-input",
          path: ["request", "targetId"]
        }
      }
    ]);

    const plannedLook = createRuntimeCommandPlan(createPlanningInput({ commandId: "look" }));
    expect(plannedLook.status).toBe("planned");
  });

  it("keeps planning deterministic", () => {
    const input = createPlanningInput({ commandId: "talk", targetId: "npc.sample" });

    const first = createRuntimeCommandPlan(input);
    const second = createRuntimeCommandPlan(input);

    expect(canonicalizeJson(first)).toBe(canonicalizeJson(second));
  });

  it("validates planning input and keeps the public surface free of execution APIs", () => {
    const invalidInput = {
      request: { commandId: "look" },
      content: createContentReadModel({ graph: createValidGraph() }),
      playerState: createValidRuntimePlayerState(),
      metadata: {
        deterministic: false
      }
    };

    const diagnostics = inspectRuntimeCommandPlanningInput(invalidInput);
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("RUNTIME_COMMAND_PLANNING_METADATA_INVALID");
    expect(() => { assertRuntimeCommandPlanningInput(invalidInput); }).toThrow();
    expect(formatRuntimeCommandPlanningValidationMessage([])).toBe("Runtime command planning input is valid.");

    expect("executeCommand" in engineContracts).toBe(false);
    expect("executeRuntimeCommand" in engineContracts).toBe(false);
    expect("applyCommand" in engineContracts).toBe(false);
    expect("moveTo" in engineContracts).toBe(false);
    expect("takeItem" in engineContracts).toBe(false);
    expect("talkToNpc" in engineContracts).toBe(false);
    expect("applyEffectToRuntimePlayerState" in engineContracts).toBe(false);
  });
});
