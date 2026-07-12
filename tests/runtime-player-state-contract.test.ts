import { canonicalizeJson } from "../packages/core/src/index.js";
import { describe, expect, it } from "vitest";

import * as engineContracts from "../packages/engine-contracts/src/index.js";

const {
  assertRuntimePlayerState,
  createContentReadModel,
  createInitialRuntimePlayerStateFromContent,
  formatRuntimePlayerStateValidationMessage,
  inspectRuntimePlayerState,
  loadContentPackageFromObject
} = engineContracts;

type ContentLoaderInput = engineContracts.ContentLoaderInput;
type ContentPackage = engineContracts.ContentPackage;
type RuntimePlayerState = engineContracts.RuntimePlayerState;
type ValidatedContentGraph = engineContracts.ValidatedContentGraph;

function createValidPackage(): ContentPackage {
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
    actionAffordances: ["look", "go", "talk", "take", "inventory", "save", "load"]
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

function createValidGraph(): ValidatedContentGraph {
  const result = loadContentPackageFromObject(createValidInput());
  if (result.status !== "valid" || result.graph === undefined) {
    throw new Error("Expected valid graph fixture.");
  }
  return result.graph;
}

function createValidRuntimePlayerState(): RuntimePlayerState {
  return {
    stateId: "state.player.content.sample.micro-prototype",
    revision: 0,
    currentLocationId: "location.start",
    inventoryItemIds: ["item.sample"],
    progressFlags: ["intro.ready"],
    metadata: {
      contentPackageId: "content.sample.micro-prototype",
      createdAtRevision: 0,
      updatedAtRevision: 0
    }
  };
}

describe("runtime player state contract", () => {
  it("accepts a valid runtime player state", () => {
    const state = createValidRuntimePlayerState();

    expect(inspectRuntimePlayerState(state)).toEqual([]);
    expect(() => { assertRuntimePlayerState(state); }).not.toThrow();
    expect(formatRuntimePlayerStateValidationMessage([])).toBe("Runtime player state is valid.");
  });

  it("creates initial runtime player state from a valid content read model", () => {
    const readModel = createContentReadModel({ graph: createValidGraph() });
    const runtimeState = createInitialRuntimePlayerStateFromContent({ content: readModel });

    expect(runtimeState).toEqual({
      stateId: "state.player.content.sample.micro-prototype",
      revision: 0,
      currentLocationId: "location.start",
      inventoryItemIds: ["item.sample"],
      progressFlags: ["intro.ready"],
      metadata: {
        contentPackageId: "content.sample.micro-prototype"
      }
    });
  });

  it("rejects invalid runtime player state shapes", () => {
    const nonJsonSafeState = createValidRuntimePlayerState() as unknown as Record<string, unknown>;
    nonJsonSafeState.progressFlags = undefined;

    const forbiddenKeyState = JSON.parse(
      `${canonicalizeJson(createValidRuntimePlayerState()).slice(0, -1)},"__proto__":"forbidden"}`
    ) as unknown;

    const invalidStates = [
      { state: { ...createValidRuntimePlayerState(), stateId: "BadStateId" }, code: "RUNTIME_PLAYER_STATE_ID_INVALID", path: ["stateId"] },
      { state: { ...createValidRuntimePlayerState(), currentLocationId: "BadLocationId" }, code: "RUNTIME_PLAYER_STATE_LOCATION_INVALID", path: ["currentLocationId"] },
      { state: { ...createValidRuntimePlayerState(), revision: -1 }, code: "RUNTIME_PLAYER_STATE_REVISION_INVALID", path: ["revision"] },
      {
        state: { ...createValidRuntimePlayerState(), inventoryItemIds: ["item.sample", "item.sample"] },
        code: "RUNTIME_PLAYER_STATE_INVENTORY_DUPLICATE",
        path: ["inventoryItemIds", 1]
      },
      {
        state: { ...createValidRuntimePlayerState(), inventoryItemIds: ["BadItemId"] },
        code: "RUNTIME_PLAYER_STATE_INVENTORY_ITEM_INVALID",
        path: ["inventoryItemIds", 0]
      },
      {
        state: { ...createValidRuntimePlayerState(), progressFlags: ["intro.ready", "intro.ready"] },
        code: "RUNTIME_PLAYER_STATE_PROGRESS_DUPLICATE",
        path: ["progressFlags", 1]
      },
      {
        state: { ...createValidRuntimePlayerState(), progressFlags: ["BadFlagId"] },
        code: "RUNTIME_PLAYER_STATE_PROGRESS_FLAG_INVALID",
        path: ["progressFlags", 0]
      },
      {
        state: { ...createValidRuntimePlayerState(), metadata: undefined },
        code: "RUNTIME_PLAYER_STATE_METADATA_INVALID",
        path: ["metadata"]
      },
      {
        state: {
          ...createValidRuntimePlayerState(),
          metadata: { contentPackageId: "BadPackageId" }
        },
        code: "RUNTIME_PLAYER_STATE_PACKAGE_ID_INVALID",
        path: ["metadata", "contentPackageId"]
      },
      { state: nonJsonSafeState, code: "RUNTIME_PLAYER_STATE_NON_JSON_VALUE", path: ["progressFlags"] },
      { state: forbiddenKeyState, code: "RUNTIME_PLAYER_STATE_FORBIDDEN_KEY", path: ["__proto__"] }
    ] as const;

    for (const invalid of invalidStates) {
      const diagnostics = inspectRuntimePlayerState(invalid.state);
      expect(diagnostics.some((diagnostic) =>
        diagnostic.code === invalid.code && canonicalizeJson(diagnostic.path) === canonicalizeJson(invalid.path)
      )).toBe(true);
    }
  });

  it("keeps initial runtime state creation deterministic", () => {
    const readModel = createContentReadModel({ graph: createValidGraph() });

    const firstState = createInitialRuntimePlayerStateFromContent({
      content: readModel,
      metadata: {
        createdAtRevision: 0,
        updatedAtRevision: 0
      }
    });
    const secondState = createInitialRuntimePlayerStateFromContent({
      content: readModel,
      metadata: {
        createdAtRevision: 0,
        updatedAtRevision: 0
      }
    });

    expect(canonicalizeJson(firstState)).toBe(canonicalizeJson(secondState));
  });

  it("does not introduce command execution or mutation APIs", () => {
    const state = createInitialRuntimePlayerStateFromContent({ content: { graph: createValidGraph() } });

    expect(Object.keys(state).sort()).toEqual([
      "currentLocationId",
      "inventoryItemIds",
      "metadata",
      "progressFlags",
      "revision",
      "stateId"
    ]);
    expect("executeCommand" in state).toBe(false);
    expect("moveTo" in state).toBe(false);
    expect("takeItem" in state).toBe(false);
    expect("mutateState" in state).toBe(false);

    expect("executeCommand" in engineContracts).toBe(false);
    expect("moveTo" in engineContracts).toBe(false);
    expect("takeItem" in engineContracts).toBe(false);
    expect("applyEffect" in engineContracts).toBe(true);
  });
});
