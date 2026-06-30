import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { canonicalizeJson } from "../packages/core/src/index.js";
import { type ContentLoaderInput } from "../packages/engine-contracts/src/index.js";
import { validateContentM2PrimitiveBindings } from "../packages/engine-kernel/src/index.js";

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

describe("content loader M2 primitive binding validation", () => {
  it("returns no errors for valid minimal fixture bindings", () => {
    const before = canonicalizeJson(fixture);

    const result = validateContentM2PrimitiveBindings(makeInput(fixture));

    expect(result.diagnostics).toEqual([]);
    expect(canonicalizeJson(fixture)).toBe(before);
  });

  it("returns deterministic diagnostic for invalid condition binding", () => {
    const brokenFixture = JSON.parse(canonicalizeJson(fixture)) as FixtureShape;
    const conditions = brokenFixture.sections.conditions as Array<Record<string, unknown>>;
    conditions[0].value = "true";

    const result = validateContentM2PrimitiveBindings(makeInput(brokenFixture));

    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "CONTENT_BINDING_INVALID_CONDITION"
    ]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.path)).toEqual([
      ["sections", "conditions", 0, "value"]
    ]);
  });

  it("returns deterministic diagnostic for invalid effect binding", () => {
    const brokenFixture = JSON.parse(canonicalizeJson(fixture)) as FixtureShape;
    const effects = brokenFixture.sections.effects as Array<Record<string, unknown>>;
    effects[0].target = { path: "facts/location.demo.start/inspected" };

    const result = validateContentM2PrimitiveBindings(makeInput(brokenFixture));

    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "CONTENT_BINDING_INVALID_EFFECT"
    ]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.path)).toEqual([
      ["sections", "effects", 0, "target", "path"]
    ]);
  });

  it("returns deterministic diagnostic for invalid command binding", () => {
    const brokenFixture = JSON.parse(canonicalizeJson(fixture)) as FixtureShape;
    const commands = brokenFixture.sections.commands as Array<Record<string, unknown>>;
    commands[0].commandType = "Demo Inspect";

    const result = validateContentM2PrimitiveBindings(makeInput(brokenFixture));

    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "CONTENT_BINDING_INVALID_COMMAND"
    ]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.path)).toEqual([
      ["sections", "commands", 0, "commandType"]
    ]);
  });

  it("returns deterministic diagnostic for invalid event mapping binding", () => {
    const brokenFixture = JSON.parse(canonicalizeJson(fixture)) as FixtureShape;
    const eventMappings = brokenFixture.sections.eventMappings as Array<Record<string, unknown>>;
    delete eventMappings[0].commandId;

    const result = validateContentM2PrimitiveBindings(makeInput(brokenFixture));

    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "CONTENT_BINDING_REQUIRED_FIELD_MISSING"
    ]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.path)).toEqual([
      ["sections", "eventMappings", 0, "commandId"]
    ]);
  });

  it("supports optional unsupported-kind suppression", () => {
    const brokenFixture = JSON.parse(canonicalizeJson(fixture)) as FixtureShape;
    const effects = brokenFixture.sections.effects as Array<Record<string, unknown>>;
    effects[0].type = "custom-effect";

    const strictResult = validateContentM2PrimitiveBindings(makeInput(brokenFixture));
    const permissiveResult = validateContentM2PrimitiveBindings(makeInput(brokenFixture), {
      allowUnsupportedBindingKinds: true
    });

    expect(strictResult.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "CONTENT_BINDING_UNSUPPORTED_KIND"
    ]);
    expect(permissiveResult.diagnostics).toEqual([]);
  });

  it("keeps diagnostics stable, inputs immutable, and runtime-clean", () => {
    const brokenFixture = JSON.parse(canonicalizeJson(fixture)) as FixtureShape;
    const commands = brokenFixture.sections.commands as Array<Record<string, unknown>>;
    const conditions = brokenFixture.sections.conditions as Array<Record<string, unknown>>;
    commands[0].effectRefs = [123];
    conditions[0].type = "custom-condition";

    const beforeFixture = canonicalizeJson(brokenFixture);
    const result = validateContentM2PrimitiveBindings(makeInput(brokenFixture));
    const source = readFileSync(
      "packages/engine-kernel/src/content-loader/m2-primitive-binding-validation.ts",
      "utf8"
    );

    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "CONTENT_BINDING_INVALID_COMMAND",
      "CONTENT_BINDING_UNSUPPORTED_KIND"
    ]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.path)).toEqual([
      ["sections", "commands", 0, "effectRefs", 0],
      ["sections", "conditions", 0, "type"]
    ]);
    expect(canonicalizeJson(brokenFixture)).toBe(beforeFixture);
    expect(source).not.toMatch(/node:(fs|path)|readFileSync|writeFileSync|fetch\(/u);
    expect(source).not.toContain("evaluateCondition");
    expect(source).not.toContain("applyEffect");
    expect(source).not.toContain("planCommand");
    expect(source).not.toContain("runTransaction");
    expect(source).not.toContain("materializeDomainEvents");
  });
});
