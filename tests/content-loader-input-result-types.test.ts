import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { canonicalizeJson, type JsonValue } from "../packages/core/src/index.js";
import {
  CONTENT_LOAD_STATUSES,
  createValidationDiagnostic,
  isContentLoadStatus,
  type ContentLoaderInput,
  type ContentLoaderResult,
  type ValidatedContentGraph
} from "../packages/engine-contracts/src/index.js";

type FixtureShape = {
  manifest: {
    id: string;
    schemaVersion: number;
  } & Record<string, JsonValue>;
  sections: Record<string, JsonValue>;
};

const fixturePath = "tests/fixtures/content/minimal-neutral-content-package/content-package.json";
const fixtureSource = readFileSync(fixturePath, "utf8");
const fixture = JSON.parse(fixtureSource) as FixtureShape;

function isJsonSafe(value: unknown): boolean {
  try {
    const serialized = canonicalizeJson(value);
    return typeof serialized === "string" && serialized.length > 0;
  } catch {
    return false;
  }
}

describe("content loader input/result types", () => {
  it("exports the supported content load statuses and status guard", () => {
    expect(CONTENT_LOAD_STATUSES).toEqual(["valid", "invalid", "partial", "blocked"]);
    expect(isContentLoadStatus("valid")).toBe(true);
    expect(isContentLoadStatus("invalid")).toBe(true);
    expect(isContentLoadStatus("partial")).toBe(true);
    expect(isContentLoadStatus("blocked")).toBe(true);
    expect(isContentLoadStatus("ready")).toBe(false);
    expect(isContentLoadStatus(1)).toBe(false);
    expect(isContentLoadStatus(undefined)).toBe(false);
  });

  it("supports a JSON-safe data-only loader input built from the minimal fixture", () => {
    const beforeFixture = canonicalizeJson(fixture);
    const input: ContentLoaderInput = {
      rawPackage: fixture,
      source: {
        sourceId: "fixture.minimal-neutral",
        sourceKind: "test-fixture",
        packageId: fixture.manifest.id,
        description: "Minimal neutral content package fixture"
      },
      expectedSchemaVersion: fixture.manifest.schemaVersion,
      expectedContractVersion: "content-loader-boundary@0.1.0",
      dependencyPackages: []
    };

    expect(input.source?.sourceKind).toBe("test-fixture");
    expect(input.expectedSchemaVersion).toBe(1);
    expect(isJsonSafe(input)).toBe(true);
    expect(canonicalizeJson(fixture)).toBe(beforeFixture);
  });

  it("supports a valid loader result with a value-only graph skeleton", () => {
    const graph: ValidatedContentGraph = {
      packageId: fixture.manifest.id,
      manifest: fixture.manifest,
      sections: fixture.sections,
      referenceIndex: {
        "command.demo.inspect": [
          "demo.condition.has-key",
          "demo.effect.mark-inspected",
          "demo.location.start"
        ]
      },
      dependencySummary: [],
      primitiveBindingSummary: [
        {
          commandId: "command.demo.inspect",
          conditionRef: "demo.condition.has-key",
          effectRef: "demo.effect.mark-inspected"
        }
      ],
      localizationKeyIndex: ["demo.command.inspect.label"],
      assetReferenceIndex: ["demo.asset.icon.key"],
      diagnosticsSummary: {
        total: 0,
        blocking: 0
      }
    };

    const result: ContentLoaderResult = {
      status: "valid",
      graph,
      diagnostics: [],
      metadata: {
        deterministic: true,
        loaderVersion: "content-loader-boundary@0.1.0"
      }
    };

    expect(result.status).toBe("valid");
    expect(result.graph?.packageId).toBe("content.demo.minimal");
    expect(result.diagnostics).toEqual([]);
    expect(isJsonSafe(result)).toBe(true);
  });

  it("supports an invalid loader result with diagnostics and no graph", () => {
    const diagnostic = createValidationDiagnostic({
      ownerContract: "content-loader-boundary@0.1.0",
      code: "CONTENT_MANIFEST_MISSING",
      severity: "error",
      category: "shape",
      phase: "shape-validation",
      path: ["manifest"],
      message: "Content package is missing the required manifest.",
      source: {
        kind: "content-loader",
        id: "result-shape-test"
      }
    });

    const result: ContentLoaderResult = {
      status: "invalid",
      diagnostics: [diagnostic],
      metadata: {
        deterministic: true
      }
    };

    expect(result.graph).toBeUndefined();
    expect(result.diagnostics[0]?.code).toBe("CONTENT_MANIFEST_MISSING");
    expect(result.diagnostics[0]?.path).toEqual(["manifest"]);
    expect(isJsonSafe(result)).toBe(true);
  });

  it("keeps the type boundary free of loader execution or runtime side effects", () => {
    const source = readFileSync("packages/engine-contracts/src/content-loader/content-loader-types.ts", "utf8");

    expect(source).not.toMatch(/readFileSync|writeFileSync|node:fs|node:path|fetch\(/u);
    expect(source).not.toMatch(/function\s+load|function\s+validate/u);
    expect(source).not.toContain("EventStore");
    expect(source).not.toContain("Save system");
    expect(source).not.toContain("plugin runtime");
  });
});
