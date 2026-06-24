import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { canonicalizeJson } from "../packages/core/src/index.js";
import { type ContentLoaderInput } from "../packages/engine-contracts/src/index.js";
import { buildContentIdIndex } from "../packages/engine-kernel/src/index.js";

type FixtureShape = {
  manifest: {
    id: string;
  };
  sections: Record<string, unknown>;
};

const fixturePath = "tests/fixtures/content/minimal-neutral-content-package/content-package.json";
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as FixtureShape;

function makeInput(rawPackage: unknown): ContentLoaderInput {
  return {
    rawPackage,
    source: {
      sourceId: "fixture.minimal-neutral",
      sourceKind: "test-fixture",
      packageId: fixture.manifest.id
    }
  };
}

describe("content loader ID indexing", () => {
  it("creates a stable deterministic ID index for the minimal fixture", () => {
    const before = canonicalizeJson(fixture);
    const result = buildContentIdIndex(makeInput(fixture));

    expect(result.diagnostics).toEqual([]);
    expect(result.entries[0]).toEqual({
      id: "actor.demo.guide",
      section: "actors",
      path: "/sections/actors/0/id"
    });
    expect(result.entries.at(-1)).toEqual({
      id: "system.demo.access",
      section: "systems",
      path: "/sections/systems/0/id"
    });
    expect(canonicalizeJson(fixture)).toBe(before);
  });

  it("builds stable byId and bySection maps", () => {
    const result = buildContentIdIndex(makeInput(fixture));

    expect(result.byId["command.demo.inspect"]).toEqual([
      {
        id: "command.demo.inspect",
        section: "commands",
        path: "/sections/commands/0/id"
      }
    ]);
    expect(result.bySection.commands).toEqual([
      {
        id: "command.demo.inspect",
        section: "commands",
        path: "/sections/commands/0/id"
      }
    ]);
    expect(Object.keys(result.bySection)).toContain("entities");
    expect(Object.keys(result.bySection)).toContain("localization");
  });

  it("reports duplicate IDs in the same section deterministically", () => {
    const duplicateFixture = JSON.parse(canonicalizeJson(fixture)) as FixtureShape;
    const entities = duplicateFixture.sections.entities as Array<Record<string, unknown>>;
    entities.push({
      id: "entity.demo.guide",
      entityType: "entity",
      namespace: "demo",
      schemaVersion: 1
    });

    const result = buildContentIdIndex(makeInput(duplicateFixture));

    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "CONTENT_REFERENCE_DUPLICATE_ID",
        path: ["sections", "entities", 4, "id"]
      })
    ]);
  });

  it("supports configurable cross-section duplicate behavior", () => {
    const crossFixture = JSON.parse(canonicalizeJson(fixture)) as FixtureShape;
    const items = crossFixture.sections.items as Array<Record<string, unknown>>;
    items[0] = {
      ...items[0],
      id: "actor.demo.guide"
    };

    const strictResult = buildContentIdIndex(makeInput(crossFixture));
    const permissiveResult = buildContentIdIndex(makeInput(crossFixture), {
      allowCrossSectionDuplicateIds: true
    });

    expect(strictResult.diagnostics).toEqual([
      expect.objectContaining({
        code: "CONTENT_REFERENCE_CROSS_SECTION_DUPLICATE_ID",
        path: ["sections", "actors", 0, "id"]
      }),
      expect.objectContaining({
        code: "CONTENT_REFERENCE_CROSS_SECTION_DUPLICATE_ID",
        path: ["sections", "items", 0, "id"]
      })
    ]);
    expect(permissiveResult.diagnostics).toEqual([]);
  });

  it("reports missing and invalid item IDs deterministically", () => {
    const brokenFixture = JSON.parse(canonicalizeJson(fixture)) as FixtureShape;
    const documents = brokenFixture.sections.documents as Array<Record<string, unknown>>;
    delete documents[0].id;
    const localization = brokenFixture.sections.localization as Array<Record<string, unknown>>;
    localization[0] = {
      ...localization[0],
      key: "Bad Key"
    };

    const result = buildContentIdIndex(makeInput(brokenFixture));

    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "CONTENT_SECTION_ITEM_ID_MISSING",
      "CONTENT_SECTION_ITEM_ID_INVALID"
    ]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.path)).toEqual([
      ["sections", "documents", 0, "id"],
      ["sections", "localization", 0, "key"]
    ]);
  });

  it("keeps indexing pure and free of file IO or reference validation", () => {
    const before = canonicalizeJson(fixture);
    const result = buildContentIdIndex(makeInput(fixture));
    const source = readFileSync(
      "packages/engine-kernel/src/content-loader/content-id-indexing.ts",
      "utf8"
    );

    expect(result.entries.length).toBeGreaterThan(0);
    expect(canonicalizeJson(fixture)).toBe(before);
    expect(source).not.toMatch(/node:(fs|path)|readFileSync|writeFileSync|fetch\(/u);
    expect(source).not.toContain("EventStore");
    expect(source).not.toContain("reference-validation");
  });
});
