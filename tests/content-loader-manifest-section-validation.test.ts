import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { canonicalizeJson } from "../packages/core/src/index.js";
import { type ContentLoaderInput } from "../packages/engine-contracts/src/index.js";
import { validateContentManifestAndSections } from "../packages/engine-kernel/src/index.js";

type FixtureShape = {
  manifest: {
    id: string;
    version: string;
    schemaVersion: number;
    declaredSections: string[];
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
    },
    expectedSchemaVersion: 1
  };
}

describe("content loader manifest and section validation", () => {
  it("returns valid for the minimal neutral fixture", () => {
    const before = canonicalizeJson(fixture);
    const result = validateContentManifestAndSections(makeInput(fixture));

    expect(result.status).toBe("valid");
    expect(result.diagnostics).toEqual([]);
    expect(result.graph?.packageId).toBe("content.demo.minimal");
    expect(result.graph?.referenceIndex).toEqual({});
    expect(canonicalizeJson(fixture)).toBe(before);
  });

  it("returns a deterministic error when manifest is missing", () => {
    const result = validateContentManifestAndSections(makeInput({ sections: fixture.sections }));

    expect(result.status).toBe("invalid");
    expect(result.graph).toBeUndefined();
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "CONTENT_MANIFEST_MISSING",
        path: ["manifest"]
      })
    ]);
  });

  it("returns deterministic diagnostics for invalid manifest id and version", () => {
    const broken = JSON.parse(canonicalizeJson(fixture)) as FixtureShape;
    broken.manifest.id = "";
    broken.manifest.version = "invalid";

    const result = validateContentManifestAndSections(makeInput(broken));

    expect(result.status).toBe("invalid");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "CONTENT_MANIFEST_INVALID_ID",
      "CONTENT_MANIFEST_INVALID_VERSION"
    ]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.path)).toEqual([
      ["manifest", "id"],
      ["manifest", "version"]
    ]);
  });

  it("returns a deterministic diagnostic when a declared section is missing", () => {
    const broken = JSON.parse(canonicalizeJson(fixture)) as FixtureShape;
    delete broken.sections.effects;

    const result = validateContentManifestAndSections(makeInput(broken));

    expect(result.status).toBe("invalid");
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "CONTENT_SECTION_MISSING_DECLARED_SECTION",
        path: ["sections", "effects"]
      })
    ]);
  });

  it("supports strict or permissive undeclared section behavior", () => {
    const withExtra = JSON.parse(canonicalizeJson(fixture)) as FixtureShape;
    withExtra.sections.extra = [];

    const strictResult = validateContentManifestAndSections(makeInput(withExtra));
    const permissiveResult = validateContentManifestAndSections(makeInput(withExtra), {
      allowUndeclaredSections: true
    });

    expect(strictResult.status).toBe("invalid");
    expect(strictResult.diagnostics).toEqual([
      expect.objectContaining({
        code: "CONTENT_SECTION_UNDECLARED_SECTION",
        path: ["sections", "extra"]
      })
    ]);
    expect(permissiveResult.status).toBe("valid");
    expect(permissiveResult.diagnostics).toEqual([]);
  });

  it("blocks fundamentally invalid rawPackage input", () => {
    const result = validateContentManifestAndSections(makeInput(null));

    expect(result.status).toBe("blocked");
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "CONTENT_MANIFEST_INVALID_SHAPE",
        path: ["rawPackage"]
      })
    ]);
  });

  it("keeps the validator pure, immutable, and free of reference validation", () => {
    const altered = JSON.parse(canonicalizeJson(fixture)) as FixtureShape;
    const before = canonicalizeJson(altered);
    const commands = altered.sections.commands as Array<Record<string, unknown>>;
    commands[0] = {
      ...commands[0],
      conditionRefs: ["condition.demo.missing"],
      effectRefs: ["effect.demo.missing"]
    };
    const afterMutation = canonicalizeJson(altered);

    const result = validateContentManifestAndSections(makeInput(altered));
    const source = readFileSync(
      "packages/engine-kernel/src/content-loader/manifest-section-validation.ts",
      "utf8"
    );

    expect(result.status).toBe("valid");
    expect(result.diagnostics).toEqual([]);
    expect(canonicalizeJson(altered)).toBe(afterMutation);
    expect(afterMutation).not.toBe(before);
    expect(source).not.toMatch(/node:(fs|path)|readFileSync|writeFileSync|fetch\(/u);
    expect(source).not.toContain("EventStore");
    expect(source).not.toContain("Save system");
  });
});
