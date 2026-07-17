import { canonicalizeJson, inspectJsonSafety } from "../packages/core/src/index.js";
import { describe, expect, it } from "vitest";

import * as engineContracts from "../packages/engine-contracts/src/index.js";

const {
  createContentReadModel,
  createInitialRuntimePlayerStateFromContent,
  createRuntimeCommandPlan,
  executeRuntimeItemPickupCommand,
  formatRuntimeItemPickupCommandExecutionValidationMessage,
  inspectRuntimeItemPickupCommandExecutionInput,
  loadContentPackageFromObject
} = engineContracts;

type ContentActionAffordance = engineContracts.ContentActionAffordance;
type ContentLoaderInput = engineContracts.ContentLoaderInput;
type ContentPackage = engineContracts.ContentPackage;
type RuntimeCommandPlan = engineContracts.RuntimeCommandPlan;
type RuntimeItemPickupCommandExecutorInput = engineContracts.RuntimeItemPickupCommandExecutorInput;
type RuntimePlayerState = engineContracts.RuntimePlayerState;
type ValidatedContentGraph = engineContracts.ValidatedContentGraph;

function createValidPackage(
  actionAffordances: readonly ContentActionAffordance[] = ["look", "go", "talk", "take", "inventory", "save", "load"]
): ContentPackage {
  return {
    packageId: "content.sample.item-pickup",
    schemaVersion: {
      schemaId: "content-package",
      version: 1
    },
    title: "Sample Item Pickup Package",
    theme: "neutral-sci-fi",
    description: "Minimal sample package for controlled item pickup boundary tests.",
    locations: [
      {
        locationId: "location.start",
        title: "Start Chamber",
        description: "A compact chamber used as a starting point.",
        exits: [],
        tags: ["start", "indoors"]
      },
      {
        locationId: "location.storage",
        title: "Storage Locker",
        description: "A separate room used to prove elsewhere items stay blocked.",
        exits: []
      }
    ],
    items: [
      {
        itemId: "item.visible-portable",
        title: "Visible Portable Item",
        description: "A portable item in the current room.",
        locationId: "location.start",
        portable: true
      },
      {
        itemId: "item.inventory-owned",
        title: "Inventory-Owned Item",
        description: "An item already in the player inventory.",
        locationId: "location.start",
        portable: true
      },
      {
        itemId: "item.elsewhere-portable",
        title: "Elsewhere Portable Item",
        description: "A portable item stored in another location.",
        locationId: "location.storage",
        portable: true
      },
      {
        itemId: "item.visible-fixed",
        title: "Visible Fixed Item",
        description: "A visible item that is not portable.",
        locationId: "location.start",
        portable: false
      }
    ],
    npcs: [],
    dialogues: [],
    initialPlayerState: {
      startLocationId: "location.start",
      inventoryItemIds: ["item.inventory-owned"],
      progressFlags: ["intro.ready", "pickup.review"]
    },
    actionAffordances
  };
}

function createValidInput(overrides: Partial<ContentLoaderInput> = {}): ContentLoaderInput {
  return {
    rawPackage: createValidPackage(),
    source: {
      sourceId: "fixture:content.sample.item-pickup",
      sourceKind: "provided-object",
      packageId: "content.sample.item-pickup",
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
    revision: 4,
    metadata: {
      createdAtRevision: 2,
      updatedAtRevision: 4
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

function createPlan(
  request: engineContracts.RuntimeCommandRequest,
  actionAffordances?: readonly ContentActionAffordance[],
  playerStateOverrides: Partial<RuntimePlayerState> = {}
): RuntimeCommandPlan {
  return createRuntimeCommandPlan({
    request,
    content: createReadModel(actionAffordances),
    playerState: createPlayerState(actionAffordances, playerStateOverrides),
    metadata: {
      requestId: "req.task-106.sample",
      correlationId: "corr.task-106.sample",
      deterministic: true
    }
  });
}

function createInput(
  plan: RuntimeCommandPlan,
  actionAffordances?: readonly ContentActionAffordance[],
  playerStateOverrides: Partial<RuntimePlayerState> = {}
): RuntimeItemPickupCommandExecutorInput {
  return {
    plan,
    content: createReadModel(actionAffordances),
    playerState: createPlayerState(actionAffordances, playerStateOverrides),
    metadata: {
      requestId: "req.task-106.sample",
      correlationId: "corr.task-106.sample",
      deterministic: true
    }
  };
}

function expectJsonSafe(value: unknown): void {
  expect(inspectJsonSafety(value)).toEqual([]);
}

describe("runtime item pickup command executor boundary", () => {
  it("executes planned take for a current-location portable item", () => {
    const plan = createPlan({ commandId: "take", targetId: "item.visible-portable" });
    const content = createReadModel();
    const input: RuntimeItemPickupCommandExecutorInput = {
      plan,
      content,
      playerState: createPlayerState(),
      metadata: {
        requestId: "req.task-106.sample",
        correlationId: "corr.task-106.sample",
        deterministic: true
      }
    };
    const beforePlan = canonicalizeJson(plan);
    const beforeState = canonicalizeJson(input.playerState);
    const beforeContentItem = content.getItem("item.visible-portable");

    const result = executeRuntimeItemPickupCommand(input);

    expect(result.status).toBe("executed");
    expect(result.commandId).toBe("take");
    expect(result.itemId).toBe("item.visible-portable");
    expect(result.fromLocationId).toBe("location.start");
    expect(result.diagnostics).toEqual([]);
    expect(canonicalizeJson(plan)).toBe(beforePlan);
    expect(canonicalizeJson(input.playerState)).toBe(beforeState);
    expect(content.getItem("item.visible-portable")).toEqual(beforeContentItem);
    expectJsonSafe(result);
  });

  it("adds item id to inventory exactly once", () => {
    const result = executeRuntimeItemPickupCommand(createInput(createPlan({ commandId: "take", targetId: "item.visible-portable" })));

    expect(result.initialPlayerState?.inventoryItemIds).toEqual(["item.inventory-owned"]);
    expect(result.finalPlayerState?.inventoryItemIds).toEqual(["item.inventory-owned", "item.visible-portable"]);
    expect(result.finalPlayerState?.inventoryItemIds.filter((itemId) => itemId === "item.visible-portable")).toHaveLength(1);
  });

  it("increments revision and updates updatedAtRevision according to convention", () => {
    const result = executeRuntimeItemPickupCommand(createInput(createPlan({ commandId: "take", targetId: "item.visible-portable" })));

    expect(result.initialPlayerState?.revision).toBe(4);
    expect(result.finalPlayerState?.revision).toBe(5);
    expect(result.initialPlayerState?.metadata.createdAtRevision).toBe(2);
    expect(result.finalPlayerState?.metadata.createdAtRevision).toBe(2);
    expect(result.initialPlayerState?.metadata.updatedAtRevision).toBe(4);
    expect(result.finalPlayerState?.metadata.updatedAtRevision).toBe(5);
  });

  it("preserves current location and progress flags", () => {
    const result = executeRuntimeItemPickupCommand(createInput(createPlan({ commandId: "take", targetId: "item.visible-portable" })));

    expect(result.initialPlayerState?.currentLocationId).toBe("location.start");
    expect(result.finalPlayerState?.currentLocationId).toBe("location.start");
    expect(result.initialPlayerState?.progressFlags).toEqual(["intro.ready", "pickup.review"]);
    expect(result.finalPlayerState?.progressFlags).toEqual(["intro.ready", "pickup.review"]);
    expect(result.initialPlayerState?.metadata.contentPackageId).toBe("content.sample.item-pickup");
    expect(result.finalPlayerState?.metadata.contentPackageId).toBe("content.sample.item-pickup");
  });

  it("rejects non-take plan", () => {
    const result = executeRuntimeItemPickupCommand(createInput(createPlan({ commandId: "look" })));

    expect(result.status).toBe("rejected");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain("RUNTIME_ITEM_PICKUP_COMMAND_NOT_TAKE");
  });

  it("blocks missing target", () => {
    const result = executeRuntimeItemPickupCommand(createInput(createPlan({ commandId: "take" })));

    expect(result.status).toBe("blocked");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain("RUNTIME_ITEM_PICKUP_COMMAND_TARGET_REQUIRED");
  });

  it("blocks unresolved item", () => {
    const result = executeRuntimeItemPickupCommand(createInput(createPlan({ commandId: "take", targetId: "item.missing" })));

    expect(result.status).toBe("blocked");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain("RUNTIME_ITEM_PICKUP_COMMAND_ITEM_NOT_FOUND");
  });

  it("blocks item not in current location", () => {
    const result = executeRuntimeItemPickupCommand(createInput(createPlan({ commandId: "take", targetId: "item.elsewhere-portable" })));

    expect(result.status).toBe("blocked");
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "RUNTIME_ITEM_PICKUP_COMMAND_ITEM_NOT_VISIBLE_HERE",
        details: {
          currentLocationId: "location.start",
          itemId: "item.elsewhere-portable",
          itemLocationId: "location.storage",
          inventoryItemIds: ["item.inventory-owned"]
        }
      })
    ]);
  });

  it("blocks item already in inventory", () => {
    const result = executeRuntimeItemPickupCommand(createInput(createPlan({ commandId: "take", targetId: "item.inventory-owned" })));

    expect(result.status).toBe("blocked");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain("RUNTIME_ITEM_PICKUP_COMMAND_ITEM_ALREADY_IN_INVENTORY");
  });

  it("blocks non-portable item", () => {
    const result = executeRuntimeItemPickupCommand(createInput(createPlan({ commandId: "take", targetId: "item.visible-fixed" })));

    expect(result.status).toBe("blocked");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain("RUNTIME_ITEM_PICKUP_COMMAND_ITEM_NOT_PORTABLE");
  });

  it("blocked paths preserve player state", () => {
    const blockedResults = [
      executeRuntimeItemPickupCommand(createInput(createPlan({ commandId: "take", targetId: "item.inventory-owned" }))),
      executeRuntimeItemPickupCommand(createInput(createPlan({ commandId: "take", targetId: "item.elsewhere-portable" }))),
      executeRuntimeItemPickupCommand(createInput(createPlan({ commandId: "take", targetId: "item.visible-fixed" })))
    ];

    for (const result of blockedResults) {
      expect(canonicalizeJson(result.initialPlayerState)).toBe(canonicalizeJson(result.finalPlayerState));
    }
  });

  it("returns deterministic JSON-safe results", () => {
    const first = executeRuntimeItemPickupCommand(createInput(createPlan({ commandId: "take", targetId: "item.visible-portable" })));
    const second = executeRuntimeItemPickupCommand(createInput(createPlan({ commandId: "take", targetId: "item.visible-portable" })));

    expect(canonicalizeJson(first)).toBe(canonicalizeJson(second));
    expectJsonSafe(first);
  });

  it("does not expose storage replay db or event output fields", () => {
    const result = executeRuntimeItemPickupCommand(createInput(createPlan({ commandId: "take", targetId: "item.visible-portable" })));

    expect("nextState" in result).toBe(false);
    expect("statePatch" in result).toBe(false);
    expect("events" in result).toBe(false);
    expect("runtimeDomainEventValues" in result).toBe(false);
    expect("transaction" in result).toBe(false);
    expect("saveResult" in result).toBe(false);
    expect("loadResult" in result).toBe(false);
  });

  it("keeps the public surface free of generic mutable command apis", () => {
    const diagnostics = inspectRuntimeItemPickupCommandExecutionInput({
      plan: createPlan({ commandId: "take", targetId: "item.visible-portable" }),
      content: createReadModel(),
      playerState: createPlayerState(),
      metadata: {
        deterministic: false
      }
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("RUNTIME_ITEM_PICKUP_COMMAND_EXECUTION_METADATA_INVALID");
    expect(formatRuntimeItemPickupCommandExecutionValidationMessage([])).toBe("Runtime item pickup command execution input is valid.");
    expect("executeCommand" in engineContracts).toBe(false);
    expect("executeRuntimeCommand" in engineContracts).toBe(false);
    expect("applyCommand" in engineContracts).toBe(false);
    expect("takeItem" in engineContracts).toBe(false);
    expect("useItem" in engineContracts).toBe(false);
    expect("talkToNpc" in engineContracts).toBe(false);
    expect("applyEffectToRuntimePlayerState" in engineContracts).toBe(false);
  });
});
