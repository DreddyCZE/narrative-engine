import { canonicalizeJson } from "../packages/core/src/index.js";
import { describe, expect, it } from "vitest";

import * as engineContracts from "../packages/engine-contracts/src/index.js";

const {
  assertRuntimeCommandRequest,
  createContentReadModel,
  createInitialRuntimePlayerStateFromContent,
  formatRuntimeCommandRequestValidationMessage,
  inspectRuntimeCommandRequest,
  inspectRuntimeCommandRequestAgainstContent,
  loadContentPackageFromObject
} = engineContracts;

type ContentActionAffordance = engineContracts.ContentActionAffordance;
type ContentLoaderInput = engineContracts.ContentLoaderInput;
type ContentPackage = engineContracts.ContentPackage;
type RuntimeCommandRequest = engineContracts.RuntimeCommandRequest;
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

function createValidRuntimePlayerState(): RuntimePlayerState {
  return createInitialRuntimePlayerStateFromContent({
    content: { graph: createValidGraph() },
    metadata: {
      createdAtRevision: 0,
      updatedAtRevision: 0
    }
  });
}

describe("runtime command request boundary", () => {
  it("accepts valid runtime command requests", () => {
    const validRequests: readonly RuntimeCommandRequest[] = [
      { commandId: "look" },
      { commandId: "go", targetId: "location.corridor" },
      { commandId: "talk", targetId: "npc.sample" },
      { commandId: "take", targetId: "item.sample" },
      { commandId: "inventory" },
      { commandId: "save" },
      { commandId: "load" }
    ];

    for (const request of validRequests) {
      expect(inspectRuntimeCommandRequest(request)).toEqual([]);
      expect(() => { assertRuntimeCommandRequest(request); }).not.toThrow();
    }

    expect(formatRuntimeCommandRequestValidationMessage([])).toBe("Runtime command request is valid.");
  });

  it("rejects invalid runtime command request shapes", () => {
    const nonJsonSafeRequest = { commandId: "look", payload: undefined } as unknown;
    const forbiddenKeyRequest = JSON.parse('{"commandId":"look","__proto__":"forbidden"}') as unknown;

    const invalidRequests = [
      {
        request: "look",
        code: "RUNTIME_COMMAND_REQUEST_INVALID",
        path: []
      },
      {
        request: {},
        code: "RUNTIME_COMMAND_REQUEST_COMMAND_ID_MISSING",
        path: ["commandId"]
      },
      {
        request: { commandId: "Bad Command" },
        code: "RUNTIME_COMMAND_REQUEST_COMMAND_ID_INVALID",
        path: ["commandId"]
      },
      {
        request: { commandId: "attack" },
        code: "RUNTIME_COMMAND_REQUEST_COMMAND_ID_UNSUPPORTED",
        path: ["commandId"]
      },
      {
        request: { commandId: "look", actorId: "BadActorId" },
        code: "RUNTIME_COMMAND_REQUEST_ACTOR_ID_INVALID",
        path: ["actorId"]
      },
      {
        request: { commandId: "go", targetId: "BadTargetId" },
        code: "RUNTIME_COMMAND_REQUEST_TARGET_ID_INVALID",
        path: ["targetId"]
      },
      {
        request: nonJsonSafeRequest,
        code: "RUNTIME_COMMAND_REQUEST_NON_JSON_VALUE",
        path: ["payload"]
      },
      {
        request: forbiddenKeyRequest,
        code: "RUNTIME_COMMAND_REQUEST_FORBIDDEN_KEY",
        path: ["__proto__"]
      },
      {
        request: { commandId: "look", extra: true },
        code: "RUNTIME_COMMAND_REQUEST_UNKNOWN_FIELD",
        path: ["extra"]
      }
    ] as const;

    for (const invalid of invalidRequests) {
      const diagnostics = inspectRuntimeCommandRequest(invalid.request);
      expect(diagnostics.some((diagnostic) =>
        diagnostic.code === invalid.code && canonicalizeJson(diagnostic.path) === canonicalizeJson(invalid.path)
      )).toBe(true);
    }
  });

  it("checks command availability against content read model affordances", () => {
    const readModel = createContentReadModel({ graph: createValidGraph(["look", "go", "talk", "take", "inventory", "save", "load"]) });

    expect(
      inspectRuntimeCommandRequestAgainstContent({
        request: { commandId: "look" },
        content: readModel
      })
    ).toEqual([]);

    expect(
      inspectRuntimeCommandRequestAgainstContent({
        request: { commandId: "use" },
        content: readModel
      })
    ).toEqual([
      {
        contractVersion: "validation-diagnostic@0.1.0",
        schemaId: "validation-diagnostic",
        schemaVersion: 1,
        ownerContract: "runtime-command-request@0.1.0",
        code: "RUNTIME_COMMAND_REQUEST_COMMAND_UNAVAILABLE",
        severity: "error",
        category: "reference",
        phase: "content-affordance-validation",
        path: ["request", "commandId"],
        message: "commandId is not available in the current content action affordances.",
        source: {
          kind: "runtime-command-request",
          id: "request-input",
          path: ["request", "commandId"]
        },
        details: {
          commandId: "use",
          packageId: "content.sample.micro-prototype"
        }
      }
    ]);
  });

  it("validates with runtime player state without mutation", () => {
    const readModel = createContentReadModel({ graph: createValidGraph() });
    const playerState = createValidRuntimePlayerState();
    const beforeState = canonicalizeJson(playerState);

    const diagnostics = inspectRuntimeCommandRequestAgainstContent({
      request: { commandId: "look", actorId: "actor.player" },
      content: readModel,
      playerState
    });

    expect(diagnostics).toEqual([]);
    expect(canonicalizeJson(playerState)).toBe(beforeState);
    expect("nextState" in diagnostics).toBe(false);
    expect("commandResult" in diagnostics).toBe(false);
  });

  it("keeps command request validation deterministic", () => {
    const request = { commandId: "attack", targetId: "BadTargetId" };

    const first = inspectRuntimeCommandRequest(request);
    const second = inspectRuntimeCommandRequest(JSON.parse(canonicalizeJson(request)));

    expect(canonicalizeJson(first)).toBe(canonicalizeJson(second));
  });

  it("does not introduce command execution APIs", () => {
    expect("executeCommand" in engineContracts).toBe(false);
    expect("executeRuntimeCommand" in engineContracts).toBe(false);
    expect("applyCommand" in engineContracts).toBe(false);
    expect("moveTo" in engineContracts).toBe(false);
    expect("takeItem" in engineContracts).toBe(false);
    expect("talkToNpc" in engineContracts).toBe(false);
    expect("applyEffectToRuntimePlayerState" in engineContracts).toBe(false);
  });
});
