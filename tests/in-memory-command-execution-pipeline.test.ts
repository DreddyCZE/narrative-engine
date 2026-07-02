import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { canonicalizeJson } from "../packages/core/src/index.js";
import {
  ENGINE_STATE_CONTRACT_VERSION,
  type ContentLoaderInput,
  type EngineStateSnapshot,
  type RuntimeHostInput,
  type ValidatedContentGraph
} from "../packages/engine-contracts/src/index.js";
import {
  buildContentIdIndex,
  buildValidatedContentGraphValue,
  executeInMemoryCommand,
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

function makeState(): EngineStateSnapshot {
  return {
    contractVersion: ENGINE_STATE_CONTRACT_VERSION,
    schemaId: "engine-state",
    schemaVersion: 1,
    stateId: "state.runtime.current",
    revision: 7,
    requiredDomains: ["state-domain.core.world"],
    run: {
      seed: "seed-35",
      activeModules: ["module.core"],
      domains: [
        {
          domainId: "state-domain.core.world",
          schemaId: "state-world",
          schemaVersion: 1,
          owner: "engine",
          authority: "engine",
          persistence: "run",
          data: {
            doors: {
              main: {
                state: "closed"
              }
            },
            facts: {
              "location.demo.start": {
                inspected: false
              }
            }
          }
        }
      ]
    }
  };
}

function makeInput(
  commandId: unknown,
  graph: ValidatedContentGraph,
  currentState: EngineStateSnapshot = makeState()
): RuntimeHostInput {
  return {
    request: {
      commandId: commandId as string
    },
    currentState,
    validatedContentGraph: graph,
    context: {
      deterministic: true,
      source: "test",
      requestId: "request.runtime.inspect",
      correlationId: "corr.runtime.inspect"
    },
    metadata: {
      deterministic: true,
      source: "test",
      requestId: "request.runtime.inspect"
    }
  };
}

function readInspectedFlag(state: EngineStateSnapshot): unknown {
  return state.run.domains[0]?.data.facts &&
    (state.run.domains[0].data.facts as Record<string, unknown>)["location.demo.start"]
    ? (((state.run.domains[0].data.facts as Record<string, unknown>)["location.demo.start"] as Record<string, unknown>).inspected)
    : undefined;
}

describe("in-memory command execution pipeline", () => {
  it("commits the minimal fixture command with deterministic summaries and immutable inputs", () => {
    const graph = buildGraph(fixture);
    const state = makeState();
    const input = makeInput("command.demo.inspect", graph, state);
    const beforeInput = canonicalizeJson(input);
    const beforeGraph = canonicalizeJson(graph);
    const beforeState = canonicalizeJson(state);

    const result = executeInMemoryCommand(input, { runtimeHostVersion: "test-host@1.0.0" });

    expect(result.status).toBe("committed");
    expect(result.metadata).toEqual({
      deterministic: true,
      runtimeHostVersion: "test-host@1.0.0"
    });
    expect(result.commandPlan).toEqual({
      commandId: "command.demo.inspect",
      status: "accepted",
      diagnosticsCount: 0
    });
    expect(result.transaction).toEqual({
      status: "committed",
      previousRevision: 7,
      nextRevision: 8
    });
    expect(result.domainEvents).toEqual({
      count: 1,
      eventTypes: ["demo.inspected"]
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.nextState).toBeDefined();
    expect(result.nextState?.revision).toBe(8);
    expect(readInspectedFlag(result.nextState as EngineStateSnapshot)).toBe(true);
    expect(readInspectedFlag(state)).toBe(false);
    expect(canonicalizeJson(input)).toBe(beforeInput);
    expect(canonicalizeJson(graph)).toBe(beforeGraph);
    expect(canonicalizeJson(state)).toBe(beforeState);
  });

  it("returns blocked for an unknown command", () => {
    const graph = buildGraph(fixture);

    const result = executeInMemoryCommand(makeInput("command.demo.missing", graph));

    expect(result.status).toBe("blocked");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "RUNTIME_COMMAND_NOT_FOUND"
    ]);
  });

  it("returns blocked for an invalid command request", () => {
    const graph = buildGraph(fixture);

    const result = executeInMemoryCommand(makeInput("", graph));

    expect(result.status).toBe("blocked");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "RUNTIME_COMMAND_ID_MISSING"
    ]);
  });

  it("returns rejected when an adapted condition evaluates to false", () => {
    const mutatedFixture = JSON.parse(canonicalizeJson(fixture)) as FixtureShape & {
      sections: {
        conditions: Array<Record<string, unknown>>;
      };
    };
    mutatedFixture.sections.conditions[0] = {
      ...mutatedFixture.sections.conditions[0],
      value: false
    };
    const graph = buildGraph(mutatedFixture);

    const result = executeInMemoryCommand(makeInput("command.demo.inspect", graph));

    expect(result.status).toBe("rejected");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "RUNTIME_CONDITION_REJECTED"
    ]);
  });

  it("returns error when an adapted effect cannot resolve a target domain", () => {
    const mutatedFixture = JSON.parse(canonicalizeJson(fixture)) as FixtureShape & {
      sections: {
        effects: Array<Record<string, unknown>>;
      };
    };
    mutatedFixture.sections.effects[0] = {
      ...mutatedFixture.sections.effects[0],
      target: {
        path: "/missing/location.demo.start/inspected"
      }
    };
    const graph = buildGraph(mutatedFixture);

    const result = executeInMemoryCommand(makeInput("command.demo.inspect", graph));

    expect(result.status).toBe("error");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "RUNTIME_EFFECT_TARGET_DOMAIN_UNRESOLVED"
    ]);
  });

  it("returns deterministic diagnostics ordering for repeated invalid executions", () => {
    const graph = JSON.parse(canonicalizeJson(buildGraph(fixture))) as ValidatedContentGraph & {
      sections: {
        commands: Array<Record<string, unknown>>;
      };
    };
    graph.sections.commands[0] = {
      ...graph.sections.commands[0],
      effectRefs: ["effect.demo.missing-a", "effect.demo.missing-b"]
    };
    const input = makeInput("command.demo.inspect", graph);

    const first = executeInMemoryCommand(input);
    const second = executeInMemoryCommand(JSON.parse(canonicalizeJson(input)) as RuntimeHostInput);

    expect(first.status).toBe("blocked");
    expect(first.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "RUNTIME_EFFECT_NOT_FOUND",
      "RUNTIME_EFFECT_NOT_FOUND"
    ]);
    expect(canonicalizeJson(first)).toBe(canonicalizeJson(second));
  });

  it("keeps the pipeline free of file IO, persistence, UI, plugin, and event-store writes", () => {
    const source = readFileSync(
      "packages/engine-kernel/src/runtime-host/in-memory-command-execution-pipeline.ts",
      "utf8"
    );

    expect(source).not.toMatch(/node:(fs|path)|readFileSync|writeFileSync|appendFileSync|fetch\(/u);
    expect(source).not.toContain("EventStore");
    expect(source).not.toContain("Save system");
    expect(source).not.toContain("plugin runtime");
    expect(source).not.toContain("materializeDomainEvents");
    expect(source).not.toContain("command.demo.inspect");
    expect(source).not.toContain("location.demo.start");
  });
});

