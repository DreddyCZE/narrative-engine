import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { canonicalizeJson } from "../packages/core/src/index.js";
import { createPersistenceResult, type RuntimeHostResult } from "../packages/engine-contracts/src/index.js";
import {
  adaptRuntimeResultToEventStoreRecords,
  appendRuntimeResultToInMemoryEventStore,
  createInMemoryEventStore,
  type InMemoryEventStore
} from "../packages/engine-kernel/src/index.js";

function createCommittedRuntimeResult(): RuntimeHostResult {
  return {
    status: "committed",
    diagnostics: Object.freeze([]),
    commandPlan: {
      commandId: "command.demo.inspect",
      status: "accepted",
      diagnosticsCount: 0
    },
    transaction: {
      status: "committed",
      previousRevision: 7,
      nextRevision: 8
    },
    domainEvents: {
      count: 1,
      eventTypes: Object.freeze(["core.door-opened"])
    },
    runtimeDomainEventValues: Object.freeze([
      {
        eventId: "runtime-event.command.demo.inspect.01",
        eventType: "core.door-opened",
        sourceCommandId: "command.demo.inspect",
        payload: {
          eventMappingId: "event-mapping.demo.inspect.complete",
          packageId: "demo.core.package",
          transactionStatus: "committed",
          revision: 8
        },
        metadata: {
          deterministic: true,
          persistence: "none",
          source: "runtime-host"
        }
      }
    ]),
    metadata: {
      deterministic: true,
      runtimeHostVersion: "runtime-host@0.1.0"
    }
  };
}

describe("runtime result event store adapter", () => {
  it("converts committed runtime result event values into persistence event records", () => {
    const runtimeResult = createCommittedRuntimeResult();
    const before = canonicalizeJson(runtimeResult);

    const adapted = adaptRuntimeResultToEventStoreRecords({ runtimeResult });

    expect(adapted.persistenceResult.status).toBe("appended");
    expect(adapted.persistenceResult.metadata.source).toBe("persistence-boundary");
    expect(adapted.persistenceResult.metadata.persistence).toBe("none");
    expect(adapted.eventRecords).toEqual([
      {
        eventId: "runtime-event.command.demo.inspect.01",
        eventType: "core.door-opened",
        sourceCommandId: "command.demo.inspect",
        revision: 8,
        schemaVersion: 1,
        payload: {
          eventMappingId: "event-mapping.demo.inspect.complete",
          packageId: "demo.core.package",
          transactionStatus: "committed",
          revision: 8
        },
        metadata: {
          deterministic: true,
          persistence: "memory",
          source: "runtime-host",
          createdAtPolicy: "logical",
          runtimeVersion: "runtime-host@0.1.0",
          idempotencyKey: "command.demo.inspect:runtime-event.command.demo.inspect.01"
        }
      }
    ]);
    expect(canonicalizeJson(runtimeResult)).toBe(before);
  });

  it("appends through the public in-memory event store boundary and stays idempotent", () => {
    const runtimeResult = createCommittedRuntimeResult();
    const store = createInMemoryEventStore();

    const first = appendRuntimeResultToInMemoryEventStore({ runtimeResult, eventStore: store });
    const second = appendRuntimeResultToInMemoryEventStore({ runtimeResult, eventStore: store });

    expect(first.persistenceResult.status).toBe("appended");
    expect(second.persistenceResult.status).toBe("appended");
    expect(second.persistenceResult.metadata.idempotent).toBe(true);
    expect(store.listEventRecords()).toHaveLength(1);
    expect(store.getEventRecordById("runtime-event.command.demo.inspect.01")?.eventType).toBe("core.door-opened");
  });

  it("rejects conflicting duplicates through the existing event store contract", () => {
    const store = createInMemoryEventStore();
    appendRuntimeResultToInMemoryEventStore({ runtimeResult: createCommittedRuntimeResult(), eventStore: store });

    const conflicting = createCommittedRuntimeResult();
    const eventValue = conflicting.runtimeDomainEventValues?.[0];
    if (eventValue === undefined) {
      throw new Error("expected runtimeDomainEventValues");
    }
    (eventValue as { payload: unknown }).payload = { changed: true };

    const result = appendRuntimeResultToInMemoryEventStore({ runtimeResult: conflicting, eventStore: store });

    expect(result.persistenceResult.status).toBe("rejected");
    expect(result.persistenceResult.diagnostics[0]?.code).toBe("PERSISTENCE_EVENT_DUPLICATE_CONFLICT");
  });

  it("does not append non-committed or missing-event-value runtime results", () => {
    const store = createInMemoryEventStore();
    const blockedResult: RuntimeHostResult = {
      ...createCommittedRuntimeResult(),
      status: "blocked",
      runtimeDomainEventValues: Object.freeze([])
    };
    const missingValues = createCommittedRuntimeResult();
    delete (missingValues as { runtimeDomainEventValues?: RuntimeHostResult["runtimeDomainEventValues"] }).runtimeDomainEventValues;

    const blocked = appendRuntimeResultToInMemoryEventStore({ runtimeResult: blockedResult, eventStore: store });
    const missing = appendRuntimeResultToInMemoryEventStore({ runtimeResult: missingValues, eventStore: store });

    expect(blocked.persistenceResult.status).toBe("blocked");
    expect(blocked.persistenceResult.diagnostics[0]?.code).toBe("RUNTIME_RESULT_NOT_COMMITTED");
    expect(missing.persistenceResult.status).toBe("blocked");
    expect(missing.persistenceResult.diagnostics[0]?.code).toBe("RUNTIME_RESULT_EVENT_VALUES_MISSING");
    expect(store.listEventRecords()).toEqual([]);
  });

  it("rejects invalid event value metadata deterministically", () => {
    const runtimeResult = createCommittedRuntimeResult();
    const before = canonicalizeJson(runtimeResult);
    const eventValue = runtimeResult.runtimeDomainEventValues?.[0];
    if (eventValue === undefined) {
      throw new Error("expected runtimeDomainEventValues");
    }
    (eventValue.metadata as { persistence: string }).persistence = "memory";

    const adapted = adaptRuntimeResultToEventStoreRecords({ runtimeResult });

    expect(adapted.persistenceResult.status).toBe("rejected");
    expect(adapted.persistenceResult.diagnostics[0]?.code).toBe("RUNTIME_EVENT_VALUE_INVALID");
    expect(canonicalizeJson(runtimeResult)).not.toBe(before);
  });

  it("uses the provided public event store boundary instead of mutating store internals", () => {
    const runtimeResult = createCommittedRuntimeResult();
    let appendCalls = 0;
    const eventStore: InMemoryEventStore = {
      appendEventRecords(input) {
        appendCalls += 1;
        return createPersistenceResult({
          status: "appended",
          diagnostics: [],
          metadata: {
            deterministic: true,
            persistence: "memory",
            source: "event-store",
            operation: "append-events",
            recordCount: input.envelope.records.length
          },
          eventEnvelope: input.envelope
        });
      },
      listEventRecords() {
        return [] as const;
      },
      getEventRecordById() {
        return undefined;
      }
    };

    const result = appendRuntimeResultToInMemoryEventStore({ runtimeResult, eventStore });

    expect(appendCalls).toBe(1);
    expect(result.persistenceResult.status).toBe("appended");
  });

  it("keeps the adapter boundary free from file IO, DB, network, and replay concerns", () => {
    const source = readFileSync("packages/engine-kernel/src/persistence/runtime-result-event-store-adapter.ts", "utf8");

    expect(source).not.toMatch(/readFileSync|writeFileSync|appendFileSync|node:fs|fetch\(/u);
    expect(source).not.toMatch(/sqlite|postgres|mongodb|replay|localStorage|indexedDB/u);
  });
});