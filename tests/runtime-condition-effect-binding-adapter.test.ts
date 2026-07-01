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
  adaptRuntimeConditionEffectBindings,
  buildContentIdIndex,
  buildValidatedContentGraphValue,
  resolveRuntimeCommandRequest,
  validateContentM2PrimitiveBindings,
  validateContentManifestAndSections,
  validateContentReferences,
  type RuntimeResolvedCommand
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

function makeInput(commandId: string, graph: ValidatedContentGraph): RuntimeHostInput {
  return {
    request: {
      commandId
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

function resolveFixtureCommand(graph: ValidatedContentGraph): RuntimeResolvedCommand {
  const resolution = resolveRuntimeCommandRequest(makeInput("command.demo.inspect", graph));
  expect(resolution.diagnostics).toEqual([]);
  expect(resolution.resolved).toBeDefined();

  const resolvedCommand = resolution.resolved;
  if (resolvedCommand === undefined) {
    throw new Error("expected resolved fixture command");
  }

  return resolvedCommand;
}

describe("runtime condition/effect binding adapter", () => {
  it("adapts the minimal fixture resolved command to value-only condition and effect summaries", () => {
    const graph = buildGraph(fixture);
    const input = makeInput("command.demo.inspect", graph);
    const resolvedCommand = resolveFixtureCommand(graph);
    const beforeInput = canonicalizeJson(input);
    const beforeGraph = canonicalizeJson(graph);
    const beforeResolved = canonicalizeJson(resolvedCommand);

    const result = adaptRuntimeConditionEffectBindings(input, resolvedCommand);

    expect(result).toEqual({
      conditions: [
        {
          conditionId: "condition.demo.has-key",
          refPath: "/sections/commands/0/conditionRefs/0",
          path: "/sections/conditions/0",
          conditionDefinition: {
            contractVersion: "condition@0.1.0",
            schemaId: "condition",
            schemaVersion: 1,
            conditionId: "condition.demo.has-key",
            type: "constant",
            value: true
          }
        }
      ],
      effects: [
        {
          effectId: "effect.demo.mark-inspected",
          refPath: "/sections/commands/0/effectRefs/0",
          path: "/sections/effects/0",
          effectDefinition: {
            contractVersion: "effect@0.1.0",
            schemaId: "effect",
            schemaVersion: 1,
            effectId: "effect.demo.mark-inspected",
            type: "set-field",
            target: {
              path: "/facts/location.demo.start/inspected"
            },
            value: true
          }
        }
      ],
      diagnostics: []
    });
    expect(canonicalizeJson(input)).toBe(beforeInput);
    expect(canonicalizeJson(graph)).toBe(beforeGraph);
    expect(canonicalizeJson(resolvedCommand)).toBe(beforeResolved);
  });

  it("returns a deterministic diagnostic for a missing condition ref", () => {
    const graph = buildGraph(fixture);
    const input = makeInput("command.demo.inspect", graph);
    const resolvedCommand = {
      ...resolveFixtureCommand(graph),
      conditionRefs: [""]
    };

    const result = adaptRuntimeConditionEffectBindings(input, resolvedCommand);

    expect(result.conditions).toEqual([]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "RUNTIME_CONDITION_REF_MISSING"
    ]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.path)).toEqual([
      ["sections", "commands", 0, "conditionRefs", 0]
    ]);
  });

  it("returns a deterministic diagnostic for an invalid condition ref shape", () => {
    const graph = buildGraph(fixture);
    const input = makeInput("command.demo.inspect", graph);
    const resolvedCommand = {
      ...resolveFixtureCommand(graph),
      conditionRefs: ["Condition Demo Has Key"]
    };

    const result = adaptRuntimeConditionEffectBindings(input, resolvedCommand);

    expect(result.conditions).toEqual([]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "RUNTIME_CONDITION_REF_INVALID"
    ]);
  });

  it("returns a deterministic diagnostic for an unknown condition ref", () => {
    const graph = buildGraph(fixture);
    const input = makeInput("command.demo.inspect", graph);
    const resolvedCommand = {
      ...resolveFixtureCommand(graph),
      conditionRefs: ["condition.demo.missing"]
    };
    const first = adaptRuntimeConditionEffectBindings(input, resolvedCommand);
    const second = adaptRuntimeConditionEffectBindings(
      JSON.parse(canonicalizeJson(input)) as RuntimeHostInput,
      JSON.parse(canonicalizeJson(resolvedCommand)) as RuntimeResolvedCommand
    );

    expect(first.conditions).toEqual([]);
    expect(first.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "RUNTIME_CONDITION_NOT_FOUND"
    ]);
    expect(first.diagnostics.map((diagnostic) => diagnostic.path)).toEqual([
      ["sections", "commands", 0, "conditionRefs", 0]
    ]);
    expect(canonicalizeJson(first)).toBe(canonicalizeJson(second));
  });

  it("returns a deterministic diagnostic for an invalid condition section shape", () => {
    const graph = JSON.parse(canonicalizeJson(buildGraph(fixture))) as ValidatedContentGraph & {
      sections: Record<string, unknown>;
    };
    graph.sections.conditions = { invalid: true };
    const input = makeInput("command.demo.inspect", graph);
    const resolvedCommand = resolveFixtureCommand(graph);

    const result = adaptRuntimeConditionEffectBindings(input, resolvedCommand);

    expect(result.conditions).toEqual([]);
    expect(result.effects).toHaveLength(1);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "RUNTIME_CONDITION_GRAPH_INVALID"
    ]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.path)).toEqual([
      ["validatedContentGraph", "sections", "conditions"]
    ]);
  });

  it("returns a deterministic diagnostic for a missing effect ref", () => {
    const graph = buildGraph(fixture);
    const input = makeInput("command.demo.inspect", graph);
    const resolvedCommand = {
      ...resolveFixtureCommand(graph),
      effectRefs: [""]
    };

    const result = adaptRuntimeConditionEffectBindings(input, resolvedCommand);

    expect(result.effects).toEqual([]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "RUNTIME_EFFECT_REF_MISSING"
    ]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.path)).toEqual([
      ["sections", "commands", 0, "effectRefs", 0]
    ]);
  });

  it("returns a deterministic diagnostic for an invalid effect ref shape", () => {
    const graph = buildGraph(fixture);
    const input = makeInput("command.demo.inspect", graph);
    const resolvedCommand = {
      ...resolveFixtureCommand(graph),
      effectRefs: ["Effect Demo Mark Inspected"]
    };

    const result = adaptRuntimeConditionEffectBindings(input, resolvedCommand);

    expect(result.effects).toEqual([]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "RUNTIME_EFFECT_REF_INVALID"
    ]);
  });

  it("returns a deterministic diagnostic for an unknown effect ref", () => {
    const graph = buildGraph(fixture);
    const input = makeInput("command.demo.inspect", graph);
    const resolvedCommand = {
      ...resolveFixtureCommand(graph),
      effectRefs: ["effect.demo.missing"]
    };

    const result = adaptRuntimeConditionEffectBindings(input, resolvedCommand);

    expect(result.effects).toEqual([]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "RUNTIME_EFFECT_NOT_FOUND"
    ]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.path)).toEqual([
      ["sections", "commands", 0, "effectRefs", 0]
    ]);
  });

  it("returns a deterministic diagnostic for an invalid effect section shape", () => {
    const graph = JSON.parse(canonicalizeJson(buildGraph(fixture))) as ValidatedContentGraph & {
      sections: Record<string, unknown>;
    };
    graph.sections.effects = { invalid: true };
    const input = makeInput("command.demo.inspect", graph);
    const resolvedCommand = resolveFixtureCommand(graph);

    const result = adaptRuntimeConditionEffectBindings(input, resolvedCommand);

    expect(result.conditions).toHaveLength(1);
    expect(result.effects).toEqual([]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "RUNTIME_EFFECT_GRAPH_INVALID"
    ]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.path)).toEqual([
      ["validatedContentGraph", "sections", "effects"]
    ]);
  });

  it("returns stable diagnostics for ambiguous condition and effect refs", () => {
    const graph = JSON.parse(canonicalizeJson(buildGraph(fixture))) as ValidatedContentGraph & {
      sections: Record<string, unknown>;
    };
    const conditions = graph.sections.conditions as Array<Record<string, unknown>>;
    const effects = graph.sections.effects as Array<Record<string, unknown>>;
    conditions.push(JSON.parse(canonicalizeJson(conditions[0])) as Record<string, unknown>);
    effects.push(JSON.parse(canonicalizeJson(effects[0])) as Record<string, unknown>);
    const input = makeInput("command.demo.inspect", graph);
    const resolvedCommand = resolveFixtureCommand(graph);
    const first = adaptRuntimeConditionEffectBindings(input, resolvedCommand);
    const second = adaptRuntimeConditionEffectBindings(
      JSON.parse(canonicalizeJson(input)) as RuntimeHostInput,
      JSON.parse(canonicalizeJson(resolvedCommand)) as RuntimeResolvedCommand
    );

    expect(first.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "RUNTIME_CONDITION_AMBIGUOUS",
      "RUNTIME_EFFECT_AMBIGUOUS"
    ]);
    expect(first.diagnostics.map((diagnostic) => diagnostic.path)).toEqual([
      ["sections", "commands", 0, "conditionRefs", 0],
      ["sections", "commands", 0, "effectRefs", 0]
    ]);
    expect(first.diagnostics[0]?.details).toEqual({
      conditionId: "condition.demo.has-key",
      matches: ["/sections/conditions/0", "/sections/conditions/1"]
    });
    expect(first.diagnostics[1]?.details).toEqual({
      effectId: "effect.demo.mark-inspected",
      matches: ["/sections/effects/0", "/sections/effects/1"]
    });
    expect(canonicalizeJson(first)).toBe(canonicalizeJson(second));
  });

  it("keeps the adapter free of runtime execution and file IO", () => {
    const source = readFileSync(
      "packages/engine-kernel/src/runtime-host/runtime-condition-effect-binding-adapter.ts",
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
