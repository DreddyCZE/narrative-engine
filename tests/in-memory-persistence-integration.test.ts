import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { canonicalizeJson } from "../packages/core/src/index.js";
import {
  ENGINE_STATE_CONTRACT_VERSION,
  type ContentLoaderInput,
  type EngineStateSnapshot,
  type PersistenceSnapshotRecord,
  type RuntimeHostInput,
  type RuntimeHostResult,
  type ValidatedContentGraph
} from "../packages/engine-contracts/src/index.js";
import {
  appendRuntimeResultToInMemoryEventStore,
  buildContentIdIndex,
  buildValidatedContentGraphValue,
  createInMemoryEventStore,
  createInMemorySaveSnapshotStore,
  executeInMemoryCommand,
  listEventRecords,
  listSnapshots,
  loadSnapshot,
  saveSnapshot,
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

function makeSnapshot(runtimeResult: RuntimeHostResult): PersistenceSnapshotRecord {
  if (runtimeResult.status !== "committed" || runtimeResult.nextState === undefined || runtimeResult.transaction?.previousRevision === undefined || runtimeResult.transaction.nextRevision === undefined) {
    throw new Error("Expected committed runtime result with nextState and revision summary.");
  }

  return {
    snapshotId: `snapshot.demo-inspect.${String(runtimeResult.transaction.nextRevision)}`,
    stateId: runtimeResult.nextState.stateId,
    revision: runtimeResult.nextState.revision,
    contentPackageId: fixture.manifest.id,
    sourceEventRange: {
      fromRevision: runtimeResult.transaction.previousRevision,
      toRevision: runtimeResult.transaction.nextRevision
    },
    checksum: `sha256:runtime-inspect-${String(runtimeResult.transaction.nextRevision)}`,
    state: JSON.parse(canonicalizeJson(runtimeResult.nextState)) as EngineStateSnapshot,
    metadata: {
      deterministic: true,
      persistence: "memory",
      source: "save-snapshot-store",
      runtimeVersion: runtimeResult.metadata.runtimeHostVersion ?? "runtime-host@0.1.0",
      contentPackageVersion: `${fixture.manifest.id}@1.0.0`
    }
  };
}

describe("in-memory persistence integration", () => {
  it("covers the committed runtime to event-store to snapshot path deterministically and immutably", () => {
    const graph = buildGraph(fixture);
    const state = makeState();
    const input = makeInput("command.demo.inspect", graph, state);
    const beforeInput = canonicalizeJson(input);
    const beforeGraph = canonicalizeJson(graph);
    const beforeState = canonicalizeJson(state);

    const runtimeResult = executeInMemoryCommand(input, { runtimeHostVersion: "runtime-host@1.0.0" });

    expect(runtimeResult.status).toBe("committed");
    expect(runtimeResult.runtimeDomainEventValues).toEqual([
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

    const beforeRuntimeResult = canonicalizeJson(runtimeResult);
    const eventStore = createInMemoryEventStore();
    const firstAppend = appendRuntimeResultToInMemoryEventStore({ runtimeResult, eventStore });
    const secondAppend = appendRuntimeResultToInMemoryEventStore({ runtimeResult, eventStore });
    const storedRecords = listEventRecords(eventStore);

    expect(firstAppend.persistenceResult.status).toBe("appended");
    expect(firstAppend.persistenceResult.metadata.recordCount).toBe(1);
    expect(secondAppend.persistenceResult.status).toBe("appended");
    expect(secondAppend.persistenceResult.metadata.idempotent).toBe(true);
    expect(storedRecords).toEqual(firstAppend.eventRecords);
    expect(storedRecords).toEqual([
      {
        eventId: "runtime-event.command.demo.inspect.01",
        eventType: "demo.inspected",
        sourceCommandId: "command.demo.inspect",
        revision: 8,
        schemaVersion: 1,
        payload: {
          eventMappingId: "event-mapping.demo.inspect",
          packageId: "content.demo.minimal",
          transactionStatus: "committed",
          revision: 8
        },
        metadata: {
          deterministic: true,
          persistence: "memory",
          source: "runtime-host",
          createdAtPolicy: "logical",
          runtimeVersion: "runtime-host@1.0.0",
          idempotencyKey: "command.demo.inspect:runtime-event.command.demo.inspect.01"
        }
      }
    ]);

    const snapshotStore = createInMemorySaveSnapshotStore();
    const snapshot = makeSnapshot(runtimeResult);
    const beforeSnapshot = canonicalizeJson(snapshot);
    const saved = saveSnapshot(snapshotStore, { snapshot });
    const loaded = loadSnapshot(snapshotStore, { snapshotId: snapshot.snapshotId });

    expect(saved.status).toBe("saved");

    expect(saved.metadata.source).toBe("save-snapshot-store");
    expect(saved.snapshotEnvelope?.snapshots).toEqual([snapshot]);
    expect(loaded.status).toBe("loaded");
    expect(loaded.snapshot).toEqual(snapshot);
    expect(listSnapshots(snapshotStore)).toEqual([snapshot]);
    expect(loaded.snapshot?.metadata).toEqual({
      deterministic: true,
      persistence: "memory",
      source: "save-snapshot-store",
      runtimeVersion: "runtime-host@1.0.0",
      contentPackageVersion: "content.demo.minimal@1.0.0"
    });

    expect(canonicalizeJson(input)).toBe(beforeInput);
    expect(canonicalizeJson(graph)).toBe(beforeGraph);
    expect(canonicalizeJson(state)).toBe(beforeState);
    expect(canonicalizeJson(runtimeResult)).toBe(beforeRuntimeResult);
    expect(canonicalizeJson(snapshot)).toBe(beforeSnapshot);

    (firstAppend.eventRecords as PersistenceSnapshotRecord[] as Array<{ payload?: { mutated?: boolean } }>)[0].payload = { mutated: true };
    if (loaded.snapshot !== undefined) {
      (loaded.snapshot.state.run.domains as unknown as Array<unknown>).push({ broken: true });
    }

    expect(listEventRecords(eventStore)).toEqual(storedRecords);
    expect(listSnapshots(snapshotStore)).toEqual([snapshot]);
  });

  it("does not append records or save snapshots for blocked runtime results", () => {
    const graph = buildGraph(fixture);
    const eventStore = createInMemoryEventStore();
    const snapshotStore = createInMemorySaveSnapshotStore();

    const unknown = executeInMemoryCommand(makeInput("command.demo.missing", graph));
    const invalid = executeInMemoryCommand(makeInput("", graph));
    const unknownAppend = appendRuntimeResultToInMemoryEventStore({ runtimeResult: unknown, eventStore });
    const invalidAppend = appendRuntimeResultToInMemoryEventStore({ runtimeResult: invalid, eventStore });

    expect(unknown.status).toBe("blocked");
    expect(invalid.status).toBe("blocked");
    expect(unknownAppend.persistenceResult.status).toBe("blocked");
    expect(invalidAppend.persistenceResult.status).toBe("blocked");
    expect(unknownAppend.persistenceResult.diagnostics[0]?.code).toBe("RUNTIME_RESULT_NOT_COMMITTED");
    expect(invalidAppend.persistenceResult.diagnostics[0]?.code).toBe("RUNTIME_RESULT_NOT_COMMITTED");
    expect(listEventRecords(eventStore)).toEqual([]);
    expect(listSnapshots(snapshotStore)).toEqual([]);
  });

  it("produces deterministic persistence outputs for repeated identical runtime inputs", () => {
    const graph = buildGraph(fixture);
    const input = makeInput("command.demo.inspect", graph);

    const firstRuntime = executeInMemoryCommand(input, { runtimeHostVersion: "runtime-host@1.0.0" });
    const secondRuntime = executeInMemoryCommand(
      JSON.parse(canonicalizeJson(input)) as RuntimeHostInput,
      { runtimeHostVersion: "runtime-host@1.0.0" }
    );

    const firstStore = createInMemoryEventStore();
    const secondStore = createInMemoryEventStore();
    const firstAppend = appendRuntimeResultToInMemoryEventStore({ runtimeResult: firstRuntime, eventStore: firstStore });
    const secondAppend = appendRuntimeResultToInMemoryEventStore({ runtimeResult: secondRuntime, eventStore: secondStore });
    const firstSnapshot = makeSnapshot(firstRuntime);
    const secondSnapshot = makeSnapshot(secondRuntime);

    expect(canonicalizeJson(firstRuntime)).toBe(canonicalizeJson(secondRuntime));
    expect(canonicalizeJson(firstAppend)).toBe(canonicalizeJson(secondAppend));
    expect(canonicalizeJson(firstSnapshot)).toBe(canonicalizeJson(secondSnapshot));
  });

  it("keeps the runtime and persistence production sources free of file IO, DB, storage adapter, replay, UI, and plugin behavior", () => {
    const sourceBundle = [
      "packages/engine-kernel/src/runtime-host/in-memory-command-execution-pipeline.ts",
      "packages/engine-kernel/src/persistence/runtime-result-event-store-adapter.ts",
      "packages/engine-kernel/src/persistence/in-memory-event-store.ts",
      "packages/engine-kernel/src/persistence/in-memory-save-snapshot-store.ts"
    ]
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");

    expect(sourceBundle).not.toMatch(/node:(fs|path)|readFileSync|writeFileSync|appendFileSync|fetch\(/u);
    expect(sourceBundle).not.toMatch(/sqlite|postgres|mongodb|localStorage|indexedDB/u);
    expect(sourceBundle).not.toContain("storage adapter");
    expect(sourceBundle).not.toContain("replay runtime behavior");
    expect(sourceBundle).not.toContain("plugin runtime");
    expect(sourceBundle).not.toContain("UI/editor");
  });
});





