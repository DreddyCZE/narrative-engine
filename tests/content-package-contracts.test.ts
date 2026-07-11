
import { canonicalizeJson } from "../packages/core/src/index.js";
import { describe, expect, it } from "vitest";

import {
  assertContentPackage,
  CONTENT_ACTION_AFFORDANCES,
  formatContentPackageValidationMessage,
  inspectContentPackage,
  isContentActionAffordance,
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

function expectDiagnostic(value: unknown, code: string, path: readonly (string | number)[]): void {
  const diagnostics = inspectContentPackage(value);
  expect(diagnostics.some((diagnostic) => diagnostic.code === code && JSON.stringify(diagnostic.path) === JSON.stringify(path))).toBe(true);
}

describe("content package contracts", () => {
  it("exports supported action affordances and accepts a valid minimal package", () => {
    expect(CONTENT_ACTION_AFFORDANCES).toEqual(["look", "go", "talk", "take", "use", "inventory", "save", "load"]);
    for (const affordance of CONTENT_ACTION_AFFORDANCES) {
      expect(isContentActionAffordance(affordance)).toBe(true);
    }
    expect(isContentActionAffordance("attack")).toBe(false);

    const contentPackage = JSON.parse(canonicalizeJson(createValidPackage())) as ContentPackage;
    expect(inspectContentPackage(contentPackage)).toEqual([]);
    expect(() => {
      assertContentPackage(contentPackage);
    }).not.toThrow();
  });

  it("can represent future P0-like needs without hardcoding full story content", () => {
    const contentPackage: ContentPackage = {
      ...createValidPackage(),
      title: "Prototype Analogue Package",
      locations: [
        {
          locationId: "location.start",
          title: "Komora 7",
          description: "An analogue start chamber for future prototype planning.",
          exits: [
            {
              exitId: "exit.to-corridor",
              label: "Block D corridor door",
              targetLocationId: "location.corridor"
            }
          ]
        },
        {
          locationId: "location.corridor",
          title: "Block D Corridor",
          description: "A corridor analogue for future micro prototype flow.",
          exits: [
            {
              exitId: "exit.to-locked-path",
              label: "Section 99-ALFA hatch",
              targetLocationId: "location.locked-approach",
              conditionFlag: "section.locked",
              locked: true
            }
          ]
        },
        {
          locationId: "location.locked-approach",
          title: "Locked Approach",
          description: "A placeholder locked path reference for future prototype work.",
          exits: []
        }
      ],
      items: [
        {
          itemId: "item.sample",
          title: "Access Token",
          description: "A simple future-prototype analogue item.",
          locationId: "location.start",
          portable: true
        }
      ],
      npcs: [
        {
          npcId: "npc.sample",
          name: "First Contact",
          locationId: "location.corridor",
          dialogueId: "dialogue.sample"
        }
      ]
    };

    expect(inspectContentPackage(contentPackage)).toEqual([]);
  });
  it("rejects invalid references", () => {
    const basePackage = createValidPackage();
    const [sampleItem] = basePackage.items ?? [];
    const [sampleNpc] = basePackage.npcs ?? [];
    if (sampleItem === undefined || sampleNpc === undefined) {
      throw new Error("Expected sample item and NPC in valid package fixture.");
    }

    const missingStart = {
      ...basePackage,
      initialPlayerState: {
        ...basePackage.initialPlayerState,
        startLocationId: "location.missing"
      }
    };
    expectDiagnostic(missingStart, "CONTENT_PACKAGE_REFERENCE_INVALID", ["initialPlayerState", "startLocationId"]);

    const missingExitTarget = {
      ...basePackage,
      locations: [
        {
          ...basePackage.locations[0],
          exits: [
            {
              exitId: "exit.broken",
              label: "Broken route",
              targetLocationId: "location.void"
            }
          ]
        },
        basePackage.locations[1]
      ]
    };
    expectDiagnostic(missingExitTarget, "CONTENT_PACKAGE_REFERENCE_INVALID", ["locations", 0, "exits", 0, "targetLocationId"]);

    const missingItemLocation = {
      ...basePackage,
      items: [
        {
          ...sampleItem,
          locationId: "location.void"
        }
      ]
    };
    expectDiagnostic(missingItemLocation, "CONTENT_PACKAGE_REFERENCE_INVALID", ["items", 0, "locationId"]);

    const missingNpcLocation = {
      ...basePackage,
      npcs: [
        {
          ...sampleNpc,
          locationId: "location.void"
        }
      ]
    };
    expectDiagnostic(missingNpcLocation, "CONTENT_PACKAGE_REFERENCE_INVALID", ["npcs", 0, "locationId"]);

    const missingNpcDialogue = {
      ...basePackage,
      npcs: [
        {
          ...sampleNpc,
          dialogueId: "dialogue.void"
        }
      ]
    };
    expectDiagnostic(missingNpcDialogue, "CONTENT_PACKAGE_REFERENCE_INVALID", ["npcs", 0, "dialogueId"]);

    const missingInventoryItem = {
      ...basePackage,
      initialPlayerState: {
        ...basePackage.initialPlayerState,
        inventoryItemIds: ["item.void"]
      }
    };
    expectDiagnostic(missingInventoryItem, "CONTENT_PACKAGE_REFERENCE_INVALID", ["initialPlayerState", "inventoryItemIds", 0]);
  });

  it("rejects invalid metadata, duplicate ids, invalid flags, and unsupported affordances", () => {
    const basePackage = createValidPackage();
    const [sampleItem] = basePackage.items ?? [];
    const [sampleNpc] = basePackage.npcs ?? [];
    const [sampleDialogue] = basePackage.dialogues ?? [];
    if (sampleItem === undefined || sampleNpc === undefined || sampleDialogue === undefined) {
      throw new Error("Expected sample item, NPC, and dialogue in valid package fixture.");
    }
    const invalidPackage = {
      ...basePackage,
      packageId: "BadPackage",
      locations: [
        basePackage.locations[0],
        {
          ...basePackage.locations[1],
          locationId: "location.start"
        }
      ],
      items: [
        sampleItem,
        {
          ...sampleItem,
          title: "Duplicate Item"
        }
      ],
      npcs: [
        sampleNpc,
        {
          ...sampleNpc,
          name: "Duplicate NPC"
        }
      ],
      dialogues: [
        sampleDialogue,
        {
          ...sampleDialogue,
          title: "Duplicate Dialogue"
        }
      ],
      initialPlayerState: {
        ...basePackage.initialPlayerState,
        progressFlags: ["Bad Flag"]
      },
      actionAffordances: ["look", "attack"]
    };

    expectDiagnostic(invalidPackage, "CONTENT_PACKAGE_ID_INVALID", ["packageId"]);
    expectDiagnostic(invalidPackage, "CONTENT_PACKAGE_DUPLICATE_ID", ["locations", 1, "locationId"]);
    expectDiagnostic(invalidPackage, "CONTENT_PACKAGE_DUPLICATE_ID", ["items", 1, "itemId"]);
    expectDiagnostic(invalidPackage, "CONTENT_PACKAGE_DUPLICATE_ID", ["npcs", 1, "npcId"]);
    expectDiagnostic(invalidPackage, "CONTENT_PACKAGE_DUPLICATE_ID", ["dialogues", 1, "dialogueId"]);
    expectDiagnostic(invalidPackage, "CONTENT_PACKAGE_INVALID", ["initialPlayerState", "progressFlags", 0]);
    expectDiagnostic(invalidPackage, "CONTENT_PACKAGE_ACTION_INVALID", ["actionAffordances", 1]);
  });

  it("rejects non-json-safe values and forbidden keys", () => {
    const withNonJsonValue = createValidPackage() as unknown as Record<string, unknown>;
    withNonJsonValue.theme = undefined;
    expectDiagnostic(withNonJsonValue, "CONTENT_PACKAGE_NON_JSON_VALUE", ["theme"]);

    const withForbiddenKey: unknown = JSON.parse(`${canonicalizeJson(createValidPackage()).slice(0, -1)},"__proto__":"forbidden"}`);
    expectDiagnostic(withForbiddenKey, "CONTENT_PACKAGE_FORBIDDEN_KEY", ["__proto__"]);
  });

  it("returns deterministic diagnostics and developer-facing validation messages", () => {
    const invalidPackage = {
      ...createValidPackage(),
      actionAffordances: ["attack"]
    };

    const diagnostics = inspectContentPackage(invalidPackage);
    expect(diagnostics).toEqual([
      {
        code: "CONTENT_PACKAGE_ACTION_INVALID",
        path: ["actionAffordances", 0],
        message: "action affordance is invalid."
      }
    ]);
    expect(formatContentPackageValidationMessage(diagnostics)).toBe(
      "CONTENT_PACKAGE_ACTION_INVALID @ /actionAffordances/0: action affordance is invalid."
    );
    expect(formatContentPackageValidationMessage(diagnostics)).not.toMatch(/button|screen|menu|click/ui);
  });
});
