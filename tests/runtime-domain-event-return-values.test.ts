import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { canonicalizeJson } from "../packages/core/src/index.js";
import {
  type ContentLoaderInput,
  type RuntimeTransactionSummary,
  type ValidatedContentGraph
} from "../packages/engine-contracts/src/index.js";
import {
  buildContentIdIndex,
  buildRuntimeDomainEventReturnValues,
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

const transaction: RuntimeTransactionSummary = {
  status: "committed",
  previousRevision: 7,
  nextRevision: 8
};

function expectResolvedCommand(
  resolution: ReturnType<typeof resolveRuntimeCommandRequest>
): NonNullable<ReturnType<typeof resolveRuntimeCommandRequest>["resolved"]> {
  expect(resolution.resolved).toBeDefined();
  if (resolution.resolved === undefined) {
    throw new Error("Expected runtime command resolution to succeed in test fixture.");
  }

  return resolution.resolved;
}

describe("runtime domain event return values", () => {
  it("builds deterministic return-only event values from the minimal fixture command", () => {
    const graph = buildGraph(fixture);
    const input = {
      request: {
        commandId: "command.demo.inspect"
      },
      currentState: {
        contractVersion: "engine-state@0.1.0",
        schemaId: "engine-state",
        schemaVersion: 1,
        stateId: "state.runtime.current",
        revision: 7,
        run: {
          domains: []
        }
      },
      validatedContentGraph: graph,
      context: {
        deterministic: true,
        source: "test"
      }
    } as const;
    const resolution = resolveRuntimeCommandRequest(input);
    const resolved = expectResolvedCommand(resolution);

    const beforeInput = canonicalizeJson(input);
    const beforeGraph = canonicalizeJson(graph);
    const first = buildRuntimeDomainEventReturnValues(input, resolved, transaction);
    const second = buildRuntimeDomainEventReturnValues(
      JSON.parse(canonicalizeJson(input)) as typeof input,
      resolved,
      transaction
    );

    expect(first.diagnostics).toEqual([]);
    expect(first.summary).toEqual({
      count: 1,
      eventTypes: ["demo.inspected"]
    });
    expect(first.events).toEqual([
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
    expect(canonicalizeJson(first)).toBe(canonicalizeJson(second));
    expect(canonicalizeJson(input)).toBe(beforeInput);
    expect(canonicalizeJson(graph)).toBe(beforeGraph);
  });

  it("returns deterministic empty output when no event mappings are present", () => {
    const graph = buildGraph(fixture) as ValidatedContentGraph & {
      sections: Record<string, unknown>;
    };
    delete graph.sections.eventMappings;
    const resolution = resolveRuntimeCommandRequest({
      request: { commandId: "command.demo.inspect" },
      currentState: {
        contractVersion: "engine-state@0.1.0",
        schemaId: "engine-state",
        schemaVersion: 1,
        stateId: "state.runtime.current",
        revision: 7,
        run: { domains: [] }
      },
      validatedContentGraph: graph
    });
    const resolved = expectResolvedCommand(resolution);

    const result = buildRuntimeDomainEventReturnValues(
      {
        request: { commandId: "command.demo.inspect" },
        currentState: {
          contractVersion: "engine-state@0.1.0",
          schemaId: "engine-state",
          schemaVersion: 1,
          stateId: "state.runtime.current",
          revision: 7,
          run: { domains: [] }
        },
        validatedContentGraph: graph
      },
      resolved,
      transaction
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.summary).toEqual({ count: 0, eventTypes: [] });
    expect(result.events).toEqual([]);
  });

  it("reports graph diagnostics when eventMappings is not an array", () => {
    const graph = buildGraph(fixture) as ValidatedContentGraph & {
      sections: Record<string, unknown>;
    };
    graph.sections.eventMappings = { broken: true };
    const input = {
      request: { commandId: "command.demo.inspect" },
      currentState: {
        contractVersion: "engine-state@0.1.0",
        schemaId: "engine-state",
        schemaVersion: 1,
        stateId: "state.runtime.current",
        revision: 7,
        run: { domains: [] }
      },
      validatedContentGraph: graph
    };
    const resolution = resolveRuntimeCommandRequest(input);
    const resolved = expectResolvedCommand(resolution);

    const result = buildRuntimeDomainEventReturnValues(input, resolved, transaction);

    expect(result.events).toEqual([]);
    expect(result.summary).toEqual({ count: 0, eventTypes: [] });
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "RUNTIME_DOMAIN_EVENT_GRAPH_INVALID"
    ]);
  });

  it("keeps the production helper free of Event Store, persistence, file IO, and replay behavior", () => {
    const source = readFileSync(
      "packages/engine-kernel/src/runtime-host/runtime-domain-event-return-values.ts",
      "utf8"
    );

    expect(source).not.toMatch(/node:(fs|path)|readFileSync|writeFileSync|appendFileSync|fetch\(/u);
    expect(source).not.toContain("EventStore");
    expect(source).not.toContain("Save system");
    expect(source).not.toContain("replay");
    expect(source).not.toContain("plugin runtime");
  });
});
