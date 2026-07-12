import { canonicalizeJson } from "../packages/core/src/index.js";
import { describe, expect, it } from "vitest";

import {
  assertContentReadModelInput,
  createContentReadModel,
  formatContentReadModelValidationMessage,
  inspectContentReadModelInput,
  loadContentPackageFromObject,
  type ContentLoaderInput,
  type ContentPackage,
  type ValidatedContentGraph
} from "../packages/engine-contracts/src/index.js";

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
      inventoryItemIds: [],
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

describe("content read model boundary", () => {
  it("creates a read model from a valid loaded graph", () => {
    const graph = createValidGraph();
    const readModel = createContentReadModel({ graph });

    expect(readModel.getPackageId()).toBe("content.sample.micro-prototype");
    expect(readModel.getManifest()).toEqual(graph.manifest);
    expect(readModel.getInitialPlayerState()).toEqual(createValidPackage().initialPlayerState);
    expect(readModel.getStartLocation()).toEqual(createValidPackage().locations[0]);
    expect(readModel.getLocation("location.start")).toEqual(createValidPackage().locations[0]);
    expect(readModel.getLocations()).toEqual(createValidPackage().locations);
    expect(readModel.getExits("location.start")).toEqual(createValidPackage().locations[0]?.exits ?? []);
    expect(readModel.getItem("item.sample")).toEqual(createValidPackage().items?.[0]);
    expect(readModel.getItemsInLocation("location.start")).toEqual(createValidPackage().items ?? []);
    expect(readModel.getNpc("npc.sample")).toEqual(createValidPackage().npcs?.[0]);
    expect(readModel.getNpcsInLocation("location.corridor")).toEqual(createValidPackage().npcs ?? []);
    expect(readModel.getDialogue("dialogue.sample")).toEqual(createValidPackage().dialogues?.[0]);
    expect(readModel.hasActionAffordance("look")).toBe(true);
    expect(readModel.hasActionAffordance("use")).toBe(false);
    expect(readModel.getProgressFlags()).toEqual(["intro.ready"]);
  });

  it("returns deterministic empty or undefined results for missing ids", () => {
    const readModel = createContentReadModel({ graph: createValidGraph() });

    expect(readModel.getLocation("location.missing")).toBeUndefined();
    expect(readModel.getItem("item.missing")).toBeUndefined();
    expect(readModel.getNpc("npc.missing")).toBeUndefined();
    expect(readModel.getDialogue("dialogue.missing")).toBeUndefined();
    expect(readModel.getItemsInLocation("location.missing")).toEqual([]);
    expect(readModel.getNpcsInLocation("location.missing")).toEqual([]);
    expect(readModel.getExits("location.missing")).toEqual([]);
  });

  it("rejects invalid read model input with diagnostics", () => {
    const invalidInputs: readonly unknown[] = [
      {},
      { graph: { sections: {}, manifest: {}, referenceIndex: {} } },
      { graph: { packageId: "content.sample.micro-prototype", manifest: {}, referenceIndex: {} } },
      { graph: { packageId: "content.sample.micro-prototype", manifest: {}, sections: { locations: [] }, referenceIndex: {} } },
      {
        graph: {
          ...createValidGraph(),
          sections: {
            ...createValidGraph().sections,
            initialPlayerState: {
              startLocationId: "location.missing"
            }
          }
        }
      },
      {
        graph: {
          ...createValidGraph(),
          sections: {
            ...createValidGraph().sections,
            actionAffordances: ["look", "attack"]
          }
        }
      }
    ];

    const diagnostics = invalidInputs.map((input) => inspectContentReadModelInput(input));

    expect(diagnostics[0]?.[0]?.code).toBe("CONTENT_READ_MODEL_INPUT_INVALID");
    expect(diagnostics[1]?.some((diagnostic) => JSON.stringify(diagnostic.path) === JSON.stringify(["graph", "packageId"]))).toBe(true);
    expect(diagnostics[2]?.some((diagnostic) => JSON.stringify(diagnostic.path) === JSON.stringify(["graph", "sections"]))).toBe(true);
    expect(diagnostics[3]?.some((diagnostic) => JSON.stringify(diagnostic.path) === JSON.stringify(["graph", "sections", "initialPlayerState"]))).toBe(true);
    expect(diagnostics[4]).toEqual([
      {
        contractVersion: "validation-diagnostic@0.1.0",
        schemaId: "validation-diagnostic",
        schemaVersion: 1,
        ownerContract: "content-read-model@0.1.0",
        code: "CONTENT_READ_MODEL_REFERENCE_INVALID",
        severity: "error",
        category: "reference",
        phase: "reference-validation",
        path: ["graph", "sections", "initialPlayerState", "startLocationId"],
        message: "start location does not exist in locations.",
        source: {
          kind: "content-read-model",
          id: "graph-input",
          path: ["graph", "sections", "initialPlayerState", "startLocationId"]
        }
      }
    ]);
    expect(diagnostics[5]).toEqual([
      {
        contractVersion: "validation-diagnostic@0.1.0",
        schemaId: "validation-diagnostic",
        schemaVersion: 1,
        ownerContract: "content-read-model@0.1.0",
        code: "CONTENT_READ_MODEL_ACTION_INVALID",
        severity: "error",
        category: "validation",
        phase: "content-read-model-validation",
        path: ["graph", "sections", "actionAffordances", 1],
        message: "action affordance is invalid.",
        source: {
          kind: "content-read-model",
          id: "graph-input",
          path: ["graph", "sections", "actionAffordances", 1]
        }
      }
    ]);

    expect(() => { assertContentReadModelInput(invalidInputs[5]); }).toThrow();
    expect(formatContentReadModelValidationMessage(diagnostics[5] ?? [])).toBe(
      "CONTENT_READ_MODEL_ACTION_INVALID @ /graph/sections/actionAffordances/1: action affordance is invalid."
    );
  });

  it("keeps the read model deterministic", () => {
    const graph = createValidGraph();
    const firstReadModel = createContentReadModel({ graph });
    const secondReadModel = createContentReadModel({ graph });

    const firstSnapshot = {
      packageId: firstReadModel.getPackageId(),
      manifest: firstReadModel.getManifest(),
      startLocation: firstReadModel.getStartLocation(),
      locations: firstReadModel.getLocations(),
      exits: firstReadModel.getExits("location.start"),
      item: firstReadModel.getItem("item.sample"),
      npcsInLocation: firstReadModel.getNpcsInLocation("location.corridor"),
      progressFlags: firstReadModel.getProgressFlags(),
      hasLook: firstReadModel.hasActionAffordance("look")
    };
    const secondSnapshot = {
      packageId: secondReadModel.getPackageId(),
      manifest: secondReadModel.getManifest(),
      startLocation: secondReadModel.getStartLocation(),
      locations: secondReadModel.getLocations(),
      exits: secondReadModel.getExits("location.start"),
      item: secondReadModel.getItem("item.sample"),
      npcsInLocation: secondReadModel.getNpcsInLocation("location.corridor"),
      progressFlags: secondReadModel.getProgressFlags(),
      hasLook: secondReadModel.hasActionAffordance("look")
    };

    expect(canonicalizeJson(firstSnapshot)).toBe(canonicalizeJson(secondSnapshot));
  });

  it("does not imply command execution or mutation APIs", () => {
    const readModel = createContentReadModel({ graph: createValidGraph() });

    expect(Object.keys(readModel).sort()).toEqual([
      "getDialogue",
      "getExits",
      "getInitialPlayerState",
      "getItem",
      "getItemsInLocation",
      "getLocation",
      "getLocations",
      "getManifest",
      "getNpc",
      "getNpcsInLocation",
      "getPackageId",
      "getProgressFlags",
      "getStartLocation",
      "hasActionAffordance"
    ]);
    expect("executeCommand" in readModel).toBe(false);
    expect("moveTo" in readModel).toBe(false);
    expect("setInventory" in readModel).toBe(false);
  });
});
