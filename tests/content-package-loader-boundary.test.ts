import { canonicalizeJson } from "../packages/core/src/index.js";
import { describe, expect, it } from "vitest";

import {
  CONTENT_PACKAGE_LOADER_VERSION,
  loadContentPackageFromObject,
  createValidatedContentGraphFromPackage,
  type ContentLoaderInput,
  type ContentPackage
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

describe("content package loader boundary", () => {
  it("loads a valid content package into a deterministic validated content graph", () => {
    const result = loadContentPackageFromObject(createValidInput());

    expect(result).toEqual({
      status: "valid",
      graph: {
        packageId: "content.sample.micro-prototype",
        manifest: {
          packageId: "content.sample.micro-prototype",
          title: "Sample Micro Prototype Package",
          theme: "neutral-sci-fi",
          schemaVersion: {
            schemaId: "content-package",
            version: 1
          },
          description: "Minimal sample package for future prototype contracts.",
          source: {
            sourceId: "fixture:content.sample.micro-prototype",
            sourceKind: "provided-object",
            packageId: "content.sample.micro-prototype",
            description: "public contract test fixture"
          }
        },
        sections: {
          locations: createValidPackage().locations,
          items: createValidPackage().items,
          npcs: createValidPackage().npcs,
          dialogues: createValidPackage().dialogues,
          initialPlayerState: createValidPackage().initialPlayerState,
          actionAffordances: ["go", "inventory", "load", "look", "save", "take", "talk"]
        },
        referenceIndex: {
          locationIds: ["location.corridor", "location.start"],
          itemIds: ["item.sample"],
          npcIds: ["npc.sample"],
          dialogueIds: ["dialogue.sample"],
          actionAffordances: ["go", "inventory", "load", "look", "save", "take", "talk"],
          progressFlags: ["intro.ready"],
          exitTargetLocationIds: ["location.corridor"]
        },
        dependencySummary: [],
        primitiveBindingSummary: [],
        localizationKeyIndex: [],
        assetReferenceIndex: [],
        diagnosticsSummary: {
          status: "valid",
          diagnosticCount: 0,
          diagnosticCodes: []
        }
      },
      diagnostics: [],
      metadata: {
        deterministic: true,
        loaderVersion: CONTENT_PACKAGE_LOADER_VERSION
      }
    });
  });

  it("returns mapped diagnostics and no graph for an invalid package", () => {
    const invalidPackage = {
      ...createValidPackage(),
      initialPlayerState: {
        ...createValidPackage().initialPlayerState,
        startLocationId: "location.missing"
      }
    };

    const result = loadContentPackageFromObject(createValidInput({ rawPackage: invalidPackage }));

    expect(result.status).toBe("invalid");
    expect(result.graph).toBeUndefined();
    expect(result.metadata).toEqual({
      deterministic: true,
      loaderVersion: CONTENT_PACKAGE_LOADER_VERSION
    });
    expect(result.diagnostics).toEqual([
      {
        contractVersion: "validation-diagnostic@0.1.0",
        schemaId: "validation-diagnostic",
        schemaVersion: 1,
        ownerContract: CONTENT_PACKAGE_LOADER_VERSION,
        code: "CONTENT_PACKAGE_REFERENCE_INVALID",
        severity: "error",
        category: "reference",
        phase: "reference-validation",
        path: ["initialPlayerState", "startLocationId"],
        message: "location reference does not exist.",
        source: {
          kind: "content-loader.provided-object",
          id: "fixture:content.sample.micro-prototype",
          path: ["initialPlayerState", "startLocationId"]
        }
      }
    ]);
  });

  it("returns a blocked result for expected schema mismatch without mutating package data", () => {
    const contentPackage = createValidPackage();
    const input = createValidInput({ rawPackage: contentPackage, expectedSchemaVersion: 2 });

    const result = loadContentPackageFromObject(input);

    expect(result.status).toBe("blocked");
    expect(result.graph).toBeUndefined();
    expect(result.diagnostics).toEqual([
      {
        contractVersion: "validation-diagnostic@0.1.0",
        schemaId: "validation-diagnostic",
        schemaVersion: 1,
        ownerContract: CONTENT_PACKAGE_LOADER_VERSION,
        code: "CONTENT_PACKAGE_SCHEMA_MISMATCH",
        severity: "error",
        category: "schema",
        phase: "schema-validation",
        path: ["schemaVersion", "version"],
        message: "content package schema version does not match the expected schema version.",
        source: {
          kind: "content-loader.provided-object",
          id: "fixture:content.sample.micro-prototype",
          path: ["schemaVersion", "version"]
        },
        details: {
          expectedSchemaVersion: 2,
          actualSchemaVersion: 1
        }
      }
    ]);
    expect(contentPackage).toEqual(createValidPackage());
  });

  it("keeps dependency packages deferred and summarized without resolving them", () => {
    const result = loadContentPackageFromObject(
      createValidInput({
        dependencyPackages: [
          { packageId: "dependency.alpha" },
          { anythingElse: true }
        ]
      })
    );

    expect(result.status).toBe("valid");
    expect(result.graph?.dependencySummary).toEqual([
      {
        index: 0,
        packageId: "dependency.alpha",
        resolution: "deferred"
      },
      {
        index: 1,
        packageId: "unknown",
        resolution: "deferred"
      }
    ]);
  });

  it("produces identical results for repeated loads of the same valid content package", () => {
    const firstResult = loadContentPackageFromObject(createValidInput());
    const secondResult = loadContentPackageFromObject(createValidInput());

    expect(canonicalizeJson(firstResult)).toBe(canonicalizeJson(secondResult));
  });

  it("exposes the graph builder through the public API", () => {
    const graph = createValidatedContentGraphFromPackage(createValidPackage(), {
      source: {
        sourceId: "fixture:content.sample.micro-prototype",
        sourceKind: "test-fixture"
      }
    });

    expect(graph.packageId).toBe("content.sample.micro-prototype");
    expect(graph.manifest.source).toEqual({
      sourceId: "fixture:content.sample.micro-prototype",
      sourceKind: "test-fixture"
    });
  });
});
