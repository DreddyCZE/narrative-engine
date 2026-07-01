import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { canonicalizeJson } from "../packages/core/src/index.js";
import {
  ENGINE_STATE_CONTRACT_VERSION,
  type ContentLoaderInput,
  type RuntimeHostInput,
  type ValidatedContentGraph
} from "../packages/engine-contracts/src/index.js";
import {
  buildContentIdIndex,
  buildValidatedContentGraphValue,
  resolveRuntimeCommandRequest,
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

function makeLoaderInput(rawPackage: unknown): ContentLoaderInput {
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

function buildGraph(rawPackage: unknown): ValidatedContentGraph {
  const loaderInput = makeLoaderInput(rawPackage);
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

  expect(finalResult.status).toBe("valid");
  expect(finalResult.graph).toBeDefined();

  return finalResult.graph as ValidatedContentGraph;
}

function makeInput(commandId: unknown, graph: ValidatedContentGraph): RuntimeHostInput {
  return {
    request: {
      commandId: commandId as string
    },
    currentState: {
      contractVersion: ENGINE_STATE_CONTRACT_VERSION,
      schemaId: "engine-state",
      schemaVersion: 1,
      stateId: "state.runtime.current",
      revision: 0,
      run: {
        domains: []
      }
    },
    validatedContentGraph: graph,
    context: {
      deterministic: true,
      source: "test"
    },
    metadata: {
      deterministic: true,
      source: "test"
    }
  };
}

describe("runtime command request resolver", () => {
  it("resolves the minimal fixture command to a value-only summary", () => {
    const graph = buildGraph(fixture);
    const input = makeInput("command.demo.inspect", graph);
    const beforeInput = canonicalizeJson(input);
    const beforeGraph = canonicalizeJson(graph);

    const result = resolveRuntimeCommandRequest(input);

    expect(result.diagnostics).toEqual([]);
    expect(result.resolved).toEqual({
      commandId: "command.demo.inspect",
      section: "commands",
      path: "/sections/commands/0",
      commandType: "demo.inspect",
      commandDefinition: {
        id: "command.demo.inspect",
        commandType: "demo.inspect",
        conditionRefs: ["condition.demo.has-key"],
        effectRefs: ["effect.demo.mark-inspected"],
        targetLocationId: "location.demo.start",
        labelKey: "text.demo.command.inspect.label"
      },
      conditionRefs: ["condition.demo.has-key"],
      effectRefs: ["effect.demo.mark-inspected"],
      eventMappingRefs: ["event-mapping.demo.inspect"]
    });
    expect(canonicalizeJson(input)).toBe(beforeInput);
    expect(canonicalizeJson(graph)).toBe(beforeGraph);
  });

  it("returns a deterministic diagnostic for missing commandId", () => {
    const graph = buildGraph(fixture);
    const result = resolveRuntimeCommandRequest(makeInput("", graph));

    expect(result.resolved).toBeUndefined();
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "RUNTIME_COMMAND_ID_MISSING"
    ]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.path)).toEqual([
      ["request", "commandId"]
    ]);
  });

  it("returns a deterministic diagnostic for invalid commandId shape", () => {
    const graph = buildGraph(fixture);
    const result = resolveRuntimeCommandRequest(makeInput("Command Demo Inspect", graph));

    expect(result.resolved).toBeUndefined();
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "RUNTIME_COMMAND_ID_INVALID"
    ]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.path)).toEqual([
      ["request", "commandId"]
    ]);
  });

  it("returns a deterministic diagnostic for unknown commandId", () => {
    const graph = buildGraph(fixture);
    const input = makeInput("command.demo.missing", graph);
    const first = resolveRuntimeCommandRequest(input);
    const second = resolveRuntimeCommandRequest(JSON.parse(canonicalizeJson(input)) as RuntimeHostInput);

    expect(first.resolved).toBeUndefined();
    expect(first.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "RUNTIME_COMMAND_NOT_FOUND"
    ]);
    expect(first.diagnostics.map((diagnostic) => diagnostic.path)).toEqual([
      ["request", "commandId"]
    ]);
    expect(canonicalizeJson(first)).toBe(canonicalizeJson(second));
  });

  it("returns a deterministic diagnostic for ambiguous command matches", () => {
    const graph = JSON.parse(canonicalizeJson(buildGraph(fixture))) as ValidatedContentGraph & {
      sections: Record<string, unknown>;
    };
    const commands = graph.sections.commands as Array<Record<string, unknown>>;
    commands.push(JSON.parse(canonicalizeJson(commands[0])) as Record<string, unknown>);

    const result = resolveRuntimeCommandRequest(makeInput("command.demo.inspect", graph));

    expect(result.resolved).toBeUndefined();
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "RUNTIME_COMMAND_AMBIGUOUS"
    ]);
    expect(result.diagnostics[0]?.details).toEqual({
      commandId: "command.demo.inspect",
      matches: ["/sections/commands/0", "/sections/commands/1"]
    });
  });

  it("returns stable diagnostics for invalid command section shapes", () => {
    const invalidGraph = JSON.parse(canonicalizeJson(buildGraph(fixture))) as ValidatedContentGraph & {
      sections: Record<string, unknown>;
    };
    invalidGraph.sections.commands = { invalid: true };
    invalidGraph.sections.actions = { invalid: true };

    const first = resolveRuntimeCommandRequest(makeInput("command.demo.inspect", invalidGraph));
    const second = resolveRuntimeCommandRequest(
      JSON.parse(canonicalizeJson(makeInput("command.demo.inspect", invalidGraph))) as RuntimeHostInput
    );

    expect(first.resolved).toBeUndefined();
    expect(first.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "RUNTIME_COMMAND_GRAPH_INVALID",
      "RUNTIME_COMMAND_GRAPH_INVALID"
    ]);
    expect(first.diagnostics.map((diagnostic) => diagnostic.path)).toEqual([
      ["validatedContentGraph", "sections", "actions"],
      ["validatedContentGraph", "sections", "commands"]
    ]);
    expect(canonicalizeJson(first)).toBe(canonicalizeJson(second));
  });

  it("keeps the resolver free of runtime execution and file IO", () => {
    const source = readFileSync(
      "packages/engine-kernel/src/runtime-host/runtime-command-request-resolver.ts",
      "utf8"
    );

    expect(source).not.toMatch(/node:(fs|path)|readFileSync|writeFileSync|fetch\(/u);
    expect(source).not.toContain("evaluateCondition");
    expect(source).not.toContain("applyEffect");
    expect(source).not.toContain("planCommand");
    expect(source).not.toContain("runTransaction");
    expect(source).not.toContain("materializeDomainEvents");
    expect(source).not.toContain("EventStore");
    expect(source).not.toContain("Save system");
    expect(source).not.toContain("plugin runtime");
  });
});
