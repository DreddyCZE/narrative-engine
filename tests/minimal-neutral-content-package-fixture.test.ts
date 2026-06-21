import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const fixturePath = "tests/fixtures/content/minimal-neutral-content-package/content-package.json";
const source = readFileSync(fixturePath, "utf8");
const fixture = JSON.parse(source) as {
  manifest: {
    id: string;
    name: string;
    version: string;
    schemaVersion: number;
    contentVersion: string;
    engineRange: string;
    declaredSections: string[];
    capabilities: string[];
    diagnosticsPolicy: { mode: string };
  };
  sections: Record<string, unknown>;
};

function isJsonSafe(value: unknown, seen: Set<unknown> = new Set()): boolean {
  if (value === null) {
    return true;
  }
  if (typeof value === "string" || typeof value === "boolean") {
    return true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (typeof value !== "object") {
    return false;
  }
  if (seen.has(value)) {
    return false;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.every((entry) => isJsonSafe(entry, seen));
  }
  return Object.entries(value as Record<string, unknown>).every(([key, entry]) =>
    typeof key === "string" &&
    key !== "__proto__" &&
    key !== "prototype" &&
    key !== "constructor" &&
    isJsonSafe(entry, seen)
  );
}

function getIds(sectionName: string): string[] {
  const section = fixture.sections[sectionName];
  if (!Array.isArray(section)) {
    return [];
  }
  return section
    .map((entry) => (entry && typeof entry === "object" && "id" in entry ? (entry as { id?: unknown }).id : undefined))
    .filter((id): id is string => typeof id === "string");
}

describe("minimal neutral content package fixture", () => {
  it("is JSON-safe data only", () => {
    expect(isJsonSafe(fixture)).toBe(true);
    expect(source).not.toMatch(/\bPurgatorium\b/u);
    expect(source).not.toMatch(/=>|function\s*\(|require\s*\(|import\s+/u);
  });

  it("contains the required manifest fields", () => {
    expect(fixture.manifest.id).toBe("content.demo.minimal");
    expect(fixture.manifest.name).toBe("Minimal Neutral Content Package");
    expect(fixture.manifest.version).toBe("0.1.0");
    expect(fixture.manifest.schemaVersion).toBe(1);
    expect(fixture.manifest.contentVersion).toBe("0.1.0");
    expect(fixture.manifest.engineRange).toBe("^0.1.0");
    expect(fixture.manifest.capabilities).toEqual(["content-package"]);
    expect(fixture.manifest.diagnosticsPolicy).toEqual({ mode: "strict" });
  });

  it("declares sections that all exist in the package", () => {
    expect(fixture.manifest.declaredSections).toEqual([
      "entities",
      "locations",
      "actors",
      "items",
      "documents",
      "dialogues",
      "quests",
      "systems",
      "commands",
      "conditions",
      "effects",
      "eventMappings",
      "localization",
      "assetReferences",
      "validationManifest"
    ]);

    for (const sectionName of fixture.manifest.declaredSections) {
      expect(sectionName in fixture.sections).toBe(true);
    }
  });

  it("preserves representative valid references", () => {
    const locations = fixture.sections.locations as Array<{ id: string; entityId: string; titleKey: string }>;
    const actors = fixture.sections.actors as Array<{ id: string; entityId: string; locationId: string; displayNameKey: string }>;
    const items = fixture.sections.items as Array<{ id: string; entityId: string; locationId: string; displayNameKey: string }>;
    const quests = fixture.sections.quests as Array<{ id: string; locationId: string; requiredItemIds: string[]; availableCommandIds: string[]; titleKey: string }>;
    const commands = fixture.sections.commands as Array<{ id: string; conditionRefs: string[]; effectRefs: string[]; targetLocationId: string; labelKey: string }>;
    const eventMappings = fixture.sections.eventMappings as Array<{ id: string; commandId: string; titleKey: string }>;
    const localization = fixture.sections.localization as Array<{ key: string; value: string }>;

    const entityIds = new Set(getIds("entities"));
    const locationIds = new Set(getIds("locations"));
    const itemIds = new Set(getIds("items"));
    const commandIds = new Set(getIds("commands"));
    const conditionIds = new Set((fixture.sections.conditions as Array<{ conditionId: string }>).map((entry) => entry.conditionId));
    const effectIds = new Set((fixture.sections.effects as Array<{ effectId: string }>).map((entry) => entry.effectId));
    const localizationKeys = new Set(localization.map((entry) => entry.key));
    const location = locations[0];
    const actor = actors[0];
    const item = items[0];
    const quest = quests[0];
    const command = commands[0];
    const eventMapping = eventMappings[0];

    expect(location).toBeDefined();
    expect(actor).toBeDefined();
    expect(item).toBeDefined();
    expect(quest).toBeDefined();
    expect(command).toBeDefined();
    expect(eventMapping).toBeDefined();

    if (!location || !actor || !item || !quest || !command || !eventMapping) {
      throw new Error("Fixture is missing representative records.");
    }

    expect(entityIds.has(location.entityId)).toBe(true);
    expect(locationIds.has(actor.locationId)).toBe(true);
    expect(locationIds.has(item.locationId)).toBe(true);
    expect(itemIds.has(quest.requiredItemIds[0] ?? "")).toBe(true);
    expect(commandIds.has(quest.availableCommandIds[0] ?? "")).toBe(true);
    expect(conditionIds.has(command.conditionRefs[0] ?? "")).toBe(true);
    expect(effectIds.has(command.effectRefs[0] ?? "")).toBe(true);
    expect(locationIds.has(command.targetLocationId)).toBe(true);
    expect(commandIds.has(eventMapping.commandId)).toBe(true);
    expect(localizationKeys.has(location.titleKey)).toBe(true);
    expect(localizationKeys.has(actor.displayNameKey)).toBe(true);
    expect(localizationKeys.has(item.displayNameKey)).toBe(true);
    expect(localizationKeys.has(quest.titleKey)).toBe(true);
    expect(localizationKeys.has(command.labelKey)).toBe(true);
    expect(localizationKeys.has(eventMapping.titleKey)).toBe(true);
  });

  it("uses deterministic ascending IDs inside representative sections", () => {
    for (const sectionName of ["entities", "locations", "actors", "items", "documents", "dialogues", "quests", "systems", "commands", "eventMappings", "assetReferences"]) {
      const ids = getIds(sectionName);
      expect(ids).toEqual([...ids].sort((left, right) => left.localeCompare(right)));
    }
  });
});
