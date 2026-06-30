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

function buildValidResult(rawPackage: unknown) {
  const loaderInput = makeInput(rawPackage);
  const manifestSectionResult = validateContentManifestAndSections(loaderInput);
  const idIndexResult = buildContentIdIndex(loaderInput);
  const referenceValidationResult = validateContentReferences(loaderInput, idIndexResult);
  const m2BindingValidationResult = validateContentM2PrimitiveBindings(loaderInput);

  return buildValidatedContentGraphValue({
    loaderInput,
    manifestSectionResult,
    idIndexResult,
    referenceValidationResult,
    m2BindingValidationResult
  });
}

describe("validated content graph builder", () => {
  it('produces status "valid" for valid minimal fixture input', () => {
    const before = canonicalizeJson(fixture);

    const result = buildValidResult(fixture);

    expect(result.status).toBe("valid");
    expect(canonicalizeJson(fixture)).toBe(before);
  });

  it("includes package identity, sections, reference summary, and primitive binding summary", () => {
    const result = buildValidResult(fixture);

    expect(result.graph?.packageId).toBe("content.demo.minimal");
    expect(Array.isArray(result.graph?.sections.commands)).toBe(true);
    expect(result.graph?.referenceIndex["command.demo.inspect"]).toEqual([
      "condition.demo.has-key",
      "effect.demo.mark-inspected",
      "location.demo.start",
      "text.demo.command.inspect.label"
    ]);
    expect(result.graph?.primitiveBindingSummary).toEqual([
      { section: "conditions", id: "condition.demo.has-key", type: "constant" },
      { section: "effects", id: "effect.demo.mark-inspected", type: "set-field" },
      { section: "commands", id: "command.demo.inspect", type: "demo.inspect" },
      { section: "eventMappings", id: "event-mapping.demo.inspect", type: "demo.inspected" }
    ]);
  });

  it("includes localization and asset indexes", () => {
    const result = buildValidResult(fixture);

    expect(result.graph?.localizationKeyIndex).toContain("text.demo.command.inspect.label");
    expect(result.graph?.assetReferenceIndex).toEqual([
      "asset.demo.location.start.thumbnail"
    ]);
  });

  it("returns invalid when upstream diagnostics exist", () => {
    const brokenFixture = JSON.parse(canonicalizeJson(fixture)) as FixtureShape;
    const commands = brokenFixture.sections.commands as Array<Record<string, unknown>>;
    commands[0].commandType = "Demo Inspect";

    const loaderInput = makeInput(brokenFixture);
    const manifestSectionResult = validateContentManifestAndSections(loaderInput);
    const idIndexResult = buildContentIdIndex(loaderInput);
    const referenceValidationResult = validateContentReferences(loaderInput, idIndexResult);
    const m2BindingValidationResult = validateContentM2PrimitiveBindings(loaderInput);
    const result = buildValidatedContentGraphValue({
      loaderInput,
      manifestSectionResult,
      idIndexResult,
      referenceValidationResult,
      m2BindingValidationResult
    });

    expect(result.status).toBe("invalid");
    expect(result.graph).toBeUndefined();
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "CONTENT_BINDING_INVALID_COMMAND"
    ]);
  });

  it("returns blocked when manifest validation blocks progress", () => {
    const loaderInput = makeInput(null);
    const manifestSectionResult = validateContentManifestAndSections(loaderInput);
    const idIndexResult = buildContentIdIndex(loaderInput);
    const referenceValidationResult = validateContentReferences(loaderInput, idIndexResult);
    const m2BindingValidationResult = validateContentM2PrimitiveBindings(loaderInput);
    const result = buildValidatedContentGraphValue({
      loaderInput,
      manifestSectionResult,
      idIndexResult,
      referenceValidationResult,
      m2BindingValidationResult
    });

    expect(result.status).toBe("blocked");
    expect(result.graph).toBeUndefined();
  });

  it("stays deterministic, immutable, and runtime-clean", () => {
    const beforeFixture = canonicalizeJson(fixture);
    const first = buildValidResult(fixture);
    const second = buildValidResult(JSON.parse(canonicalizeJson(fixture)));
    const source = readFileSync(
      "packages/engine-kernel/src/content-loader/validated-content-graph-builder.ts",
      "utf8"
    );

    expect(canonicalizeJson(first)).toBe(canonicalizeJson(second));
    expect(canonicalizeJson(fixture)).toBe(beforeFixture);
    expect(source).not.toMatch(/node:(fs|path)|readFileSync|writeFileSync|fetch\(/u);
    expect(source).not.toContain("evaluateCondition");
    expect(source).not.toContain("applyEffect");
    expect(source).not.toContain("planCommand");
    expect(source).not.toContain("runTransaction");
    expect(source).not.toContain("materializeDomainEvents");
    expect(source).not.toContain("EventStore");
    expect(source).not.toContain("Save");
    expect(source).not.toContain("plugin runtime");
  });
});
