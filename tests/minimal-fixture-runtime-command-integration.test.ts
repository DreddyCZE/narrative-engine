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

function makeInput(commandId: unknown, graph: ValidatedContentGraph, currentState: EngineStateSnapshot = makeState()): RuntimeHostInput {
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

describe("minimal fixture runtime command integration", () => {
  it("runs the full minimal fixture runtime path with return-only domain events", () => {
    const graph = buildGraph(fixture);
    const state = makeState();
    const input = makeInput("command.demo.inspect", graph, state);
    const beforeInput = canonicalizeJson(input);
    const beforeGraph = canonicalizeJson(graph);
    const beforeState = canonicalizeJson(state);

    const result = executeInMemoryCommand(input, { runtimeHostVersion: "test-host@1.0.0" });

    expect(result.status).toBe("committed");
    expect(result.metadata).toEqual({ deterministic: true, runtimeHostVersion: "test-host@1.0.0" });
    expect(result.commandPlan?.status).toBe("accepted");
    expect(result.transaction).toEqual({
      status: "committed",
      previousRevision: 7,
      nextRevision: 8
    });
    expect(result.domainEvents).toEqual({
      count: 1,
      eventTypes: ["demo.inspected"]
    });
    expect(result.runtimeDomainEventValues).toEqual([
      {
        eventId: "runtime-event.command.demo.inspect.01",
        eventType: "demo.inspected",
        sourceCommandId: "command.demo.inspect",
        payload: {
          eventMappingId: "event-mapping.demo.inspect",
          packageId: "content.demo.minimal",
          transactionStatus: "committed",
          revision: 8
        },
        metadata: {
          deterministic: true,
          persistence: "none",
          source: "runtime-host"
        }
      }
    ]);
    expect(canonicalizeJson(input)).toBe(beforeInput);
    expect(canonicalizeJson(graph)).toBe(beforeGraph);
    expect(canonicalizeJson(state)).toBe(beforeState);
  });

  it("returns blocked for unknown and invalid command requests through the full runtime path", () => {
    const graph = buildGraph(fixture);

    const unknown = executeInMemoryCommand(makeInput("command.demo.missing", graph));
    const invalid = executeInMemoryCommand(makeInput("", graph));

    expect(unknown.status).toBe("blocked");
    expect(unknown.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(["RUNTIME_COMMAND_NOT_FOUND"]);
    expect(invalid.status).toBe("blocked");
    expect(invalid.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(["RUNTIME_COMMAND_ID_MISSING"]);
  });

  it("returns deterministic committed output for repeated identical runtime inputs", () => {
    const graph = buildGraph(fixture);
    const input = makeInput("command.demo.inspect", graph);

    const first = executeInMemoryCommand(input);
    const second = executeInMemoryCommand(JSON.parse(canonicalizeJson(input)) as RuntimeHostInput);

    expect(canonicalizeJson(first)).toBe(canonicalizeJson(second));
  });

  it("keeps production runtime sources free of Save, Event Store, file IO, UI, plugin, and replay behavior", () => {
    const sourceBundle = [
      "packages/engine-kernel/src/runtime-host/in-memory-command-execution-pipeline.ts",
      "packages/engine-kernel/src/runtime-host/runtime-domain-event-return-values.ts"
    ]
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");

    expect(sourceBundle).not.toMatch(/node:(fs|path)|readFileSync|writeFileSync|appendFileSync|fetch\(/u);
    expect(sourceBundle).not.toContain("EventStore");
    expect(sourceBundle).not.toContain("Save system");
    expect(sourceBundle).not.toContain("plugin runtime");
    expect(sourceBundle).not.toContain("replay");
    expect(sourceBundle).not.toContain("production file loader");
  });
});
