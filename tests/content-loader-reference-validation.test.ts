import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { canonicalizeJson } from "../packages/core/src/index.js";
import { type ContentLoaderInput } from "../packages/engine-contracts/src/index.js";
import {
  buildContentIdIndex,
  validateContentReferences
} from "../packages/engine-kernel/src/index.js";

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

describe("content loader reference validation", () => {
  it("returns no diagnostics for valid minimal fixture references", () => {
    const before = canonicalizeJson(fixture);
    const idIndex = buildContentIdIndex(makeInput(fixture));

    const result = validateContentReferences(makeInput(fixture), idIndex);

    expect(result.diagnostics).toEqual([]);
    expect(canonicalizeJson(fixture)).toBe(before);
  });

  it("reports missing reference targets deterministically", () => {
    const brokenFixture = JSON.parse(canonicalizeJson(fixture)) as FixtureShape;
    const dialogues = brokenFixture.sections.dialogues as Array<Record<string, unknown>>;
    const quests = brokenFixture.sections.quests as Array<Record<string, unknown>>;
    const commands = brokenFixture.sections.commands as Array<Record<string, unknown>>;
    dialogues[0].locationId = "location.demo.missing";
    quests[0].requiredItemIds = ["item.demo.missing"];
    commands[0].conditionRefs = ["condition.demo.missing"];
    commands[0].effectRefs = ["effect.demo.missing"];

    const idIndex = buildContentIdIndex(makeInput(brokenFixture));
    const result = validateContentReferences(makeInput(brokenFixture), idIndex);

    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "CONTENT_REFERENCE_MISSING_TARGET",
      "CONTENT_REFERENCE_MISSING_TARGET",
      "CONTENT_REFERENCE_MISSING_TARGET",
      "CONTENT_REFERENCE_MISSING_TARGET"
    ]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.path)).toEqual([
      ["sections", "commands", 0, "conditionRefs", 0],
      ["sections", "commands", 0, "effectRefs", 0],
      ["sections", "dialogues", 0, "locationId"],
      ["sections", "quests", 0, "requiredItemIds", 0]
    ]);
  });

  it("reports wrong target sections deterministically", () => {
    const brokenFixture = JSON.parse(canonicalizeJson(fixture)) as FixtureShape;
    const dialogues = brokenFixture.sections.dialogues as Array<Record<string, unknown>>;
    const commands = brokenFixture.sections.commands as Array<Record<string, unknown>>;
    dialogues[0].speakerActorId = "item.demo.key";
    commands[0].targetLocationId = "entity.demo.start-room";

    const idIndex = buildContentIdIndex(makeInput(brokenFixture));
    const result = validateContentReferences(makeInput(brokenFixture), idIndex);

    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "CONTENT_REFERENCE_WRONG_SECTION",
      "CONTENT_REFERENCE_WRONG_SECTION"
    ]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.path)).toEqual([
      ["sections", "commands", 0, "targetLocationId"],
      ["sections", "dialogues", 0, "speakerActorId"]
    ]);
  });

  it("reports unsupported reference kinds unless explicitly allowed", () => {
    const brokenFixture = JSON.parse(canonicalizeJson(fixture)) as FixtureShape;
    const commands = brokenFixture.sections.commands as Array<Record<string, unknown>>;
    commands[0].conditionRefs = [{ id: "condition.demo.has-key" }];
    commands[0].targetLocationId = {
      section: "locations",
      id: "location.demo.start"
    };

    const idIndex = buildContentIdIndex(makeInput(brokenFixture));
    const strictResult = validateContentReferences(makeInput(brokenFixture), idIndex);
    const permissiveResult = validateContentReferences(makeInput(brokenFixture), idIndex, {
      allowUnsupportedReferenceKinds: true
    });

    expect(strictResult.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "CONTENT_REFERENCE_UNSUPPORTED_KIND",
      "CONTENT_REFERENCE_UNSUPPORTED_KIND"
    ]);
    expect(strictResult.diagnostics.map((diagnostic) => diagnostic.path)).toEqual([
      ["sections", "commands", 0, "conditionRefs", 0],
      ["sections", "commands", 0, "targetLocationId"]
    ]);
    expect(permissiveResult.diagnostics).toEqual([]);
  });

  it("keeps validation deterministic, immutable, and free of runtime side effects", () => {
    const beforeFixture = canonicalizeJson(fixture);
    const idIndex = buildContentIdIndex(makeInput(fixture));
    const beforeIndex = canonicalizeJson(idIndex);

    const result = validateContentReferences(makeInput(fixture), idIndex);
    const source = readFileSync(
      "packages/engine-kernel/src/content-loader/reference-validation.ts",
      "utf8"
    );

    expect(result.diagnostics).toEqual([]);
    expect(canonicalizeJson(fixture)).toBe(beforeFixture);
    expect(canonicalizeJson(idIndex)).toBe(beforeIndex);
    expect(source).not.toMatch(/node:(fs|path)|readFileSync|writeFileSync|fetch\(/u);
    expect(source).not.toContain("materializeDomainEvents");
    expect(source).not.toContain("runCommandTransaction");
  });
});
