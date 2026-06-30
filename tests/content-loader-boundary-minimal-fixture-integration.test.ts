import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { canonicalizeJson } from "../packages/core/src/index.js";
import { type ContentLoaderInput } from "../packages/engine-contracts/src/index.js";
import {
  buildContentIdIndex,
  buildValidatedContentGraphValue,
  validateContentM2PrimitiveBindings,
  validateContentManifestAndSections,
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
const productionBoundarySources = [
  "packages/engine-kernel/src/content-loader/manifest-section-validation.ts",
  "packages/engine-kernel/src/content-loader/content-id-indexing.ts",
  "packages/engine-kernel/src/content-loader/reference-validation.ts",
  "packages/engine-kernel/src/content-loader/m2-primitive-binding-validation.ts",
  "packages/engine-kernel/src/content-loader/validated-content-graph-builder.ts"
] as const;

function makeInput(rawPackage: unknown): ContentLoaderInput {
  return {
    rawPackage,
    source: {
      sourceId: "fixture.minimal-neutral",
      sourceKind: "test-fixture",
      packageId: fixture.manifest.id
    },
    expectedSchemaVersion: 1
  };
}

function runBoundary(rawPackage: unknown) {
  const loaderInput = makeInput(rawPackage);
  const manifestSectionResult = validateContentManifestAndSections(loaderInput);
  const idIndexResult = buildContentIdIndex(loaderInput);
  const referenceValidationResult = validateContentReferences(loaderInput, idIndexResult);
  const m2BindingValidationResult = validateContentM2PrimitiveBindings(loaderInput);
  const finalResult = buildValidatedContentGraphValue({
    loaderInput,
    manifestSectionResult,
    idIndexResult,
    referenceValidationResult,
    m2BindingValidationResult
  });

  return {
    loaderInput,
    manifestSectionResult,
    idIndexResult,
    referenceValidationResult,
    m2BindingValidationResult,
    finalResult
  };
}

describe("content loader boundary minimal fixture integration", () => {
  it("orchestrates the pure boundary stages into a valid deterministic result", () => {
    const beforeFixture = canonicalizeJson(fixture);

    const first = runBoundary(fixture);
    const second = runBoundary(JSON.parse(canonicalizeJson(fixture)));

    expect(first.manifestSectionResult.status).toBe("valid");
    expect(first.idIndexResult.diagnostics).toEqual([]);
    expect(first.referenceValidationResult.diagnostics).toEqual([]);
    expect(first.m2BindingValidationResult.diagnostics).toEqual([]);
    expect(first.finalResult.status).toBe("valid");
    expect(first.finalResult.graph).toBeDefined();
    expect(first.finalResult.graph?.packageId).toBe("content.demo.minimal");
    expect(first.finalResult.graph?.manifest.id).toBe("content.demo.minimal");
    expect(Array.isArray(first.finalResult.graph?.sections.commands)).toBe(true);
    expect(first.idIndexResult.entries.map((entry) => entry.id)).toContain("command.demo.inspect");
    expect(first.finalResult.graph?.referenceIndex["command.demo.inspect"]).toEqual([
      "condition.demo.has-key",
      "effect.demo.mark-inspected",
      "location.demo.start",
      "text.demo.command.inspect.label"
    ]);
    expect(first.finalResult.graph?.primitiveBindingSummary).toEqual([
      { section: "conditions", id: "condition.demo.has-key", type: "constant" },
      { section: "effects", id: "effect.demo.mark-inspected", type: "set-field" },
      { section: "commands", id: "command.demo.inspect", type: "demo.inspect" },
      { section: "eventMappings", id: "event-mapping.demo.inspect", type: "demo.inspected" }
    ]);
    expect(first.finalResult.graph?.localizationKeyIndex).toContain(
      "text.demo.command.inspect.label"
    );
    expect(first.finalResult.graph?.assetReferenceIndex).toEqual([
      "asset.demo.location.start.thumbnail"
    ]);
    expect(first.finalResult.graph?.diagnosticsSummary).toEqual({
      total: 0,
      blocking: 0,
      status: "valid",
      indexSummary: {
        idEntryCount: 26,
        uniqueIdCount: 26,
        sectionCount: 14,
        referenceOwnerCount: 26
      }
    });
    expect(canonicalizeJson(first.finalResult)).toBe(canonicalizeJson(second.finalResult));
    expect(canonicalizeJson(fixture)).toBe(beforeFixture);
  });

  it("returns deterministic invalid output when upstream diagnostics are present", () => {
    const brokenFixture = JSON.parse(canonicalizeJson(fixture)) as FixtureShape;
    delete brokenFixture.sections.effects;
    const commands = brokenFixture.sections.commands as Array<Record<string, unknown>>;
    commands[0].commandType = "Demo Inspect";
    commands[0].targetLocationId = "location.demo.missing";

    const beforeBroken = canonicalizeJson(brokenFixture);
    const first = runBoundary(brokenFixture);
    const second = runBoundary(JSON.parse(canonicalizeJson(brokenFixture)));

    expect(first.manifestSectionResult.status).toBe("invalid");
    expect(first.referenceValidationResult.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "CONTENT_REFERENCE_MISSING_TARGET",
      "CONTENT_REFERENCE_MISSING_TARGET"
    ]);
    expect(first.referenceValidationResult.diagnostics.map((diagnostic) => diagnostic.path)).toEqual([
      ["sections", "commands", 0, "effectRefs", 0],
      ["sections", "commands", 0, "targetLocationId"]
    ]);
    expect(first.m2BindingValidationResult.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "CONTENT_BINDING_INVALID_COMMAND"
    ]);
    expect(first.finalResult.status).toBe("invalid");
    expect(first.finalResult.graph).toBeUndefined();
    expect(first.finalResult.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "CONTENT_BINDING_INVALID_COMMAND",
      "CONTENT_REFERENCE_MISSING_TARGET",
      "CONTENT_REFERENCE_MISSING_TARGET",
      "CONTENT_SECTION_MISSING_DECLARED_SECTION"
    ]);
    expect(first.finalResult.diagnostics.map((diagnostic) => diagnostic.path)).toEqual([
      ["sections", "commands", 0, "commandType"],
      ["sections", "commands", 0, "effectRefs", 0],
      ["sections", "commands", 0, "targetLocationId"],
      ["sections", "effects"]
    ]);
    expect(canonicalizeJson(first.finalResult)).toBe(canonicalizeJson(second.finalResult));
    expect(canonicalizeJson(brokenFixture)).toBe(beforeBroken);
  });

  it("keeps the production boundary runtime-clean and free of orchestration side effects", () => {
    const sourceBundle = productionBoundarySources
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");

    expect(sourceBundle).not.toMatch(/node:(fs|path)|readFileSync|writeFileSync|fetch\(/u);
    expect(sourceBundle).not.toContain("production file loader");
    expect(sourceBundle).not.toContain("runtime host");
    expect(sourceBundle).not.toContain("evaluateCondition");
    expect(sourceBundle).not.toContain("applyEffect");
    expect(sourceBundle).not.toContain("planCommand");
    expect(sourceBundle).not.toContain("runTransaction");
    expect(sourceBundle).not.toContain("materializeDomainEvents");
    expect(sourceBundle).not.toContain("EventStore");
    expect(sourceBundle).not.toContain("Save");
    expect(sourceBundle).not.toContain("plugin runtime");
  });
});