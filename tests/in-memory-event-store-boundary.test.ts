import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { canonicalizeJson } from "../packages/core/src/index.js";
import { type PersistenceAppendEventsInput } from "../packages/engine-contracts/src/index.js";
import {
  appendEventRecords,
  createInMemoryEventStore,
  getEventRecordById,
  listEventRecords
} from "../packages/engine-kernel/src/index.js";

function makeAppendInput(): PersistenceAppendEventsInput {
  return {
    envelope: {
      records: [
        {
          eventId: "runtime-event.command.demo.inspect.01",
          eventType: "demo.inspected",
          sourceCommandId: "command.demo.inspect",
          transactionId: "transaction.runtime.inspect-demo",
          revision: 8,
          schemaVersion: 1,
          payload: {
            eventMappingId: "event-mapping.demo.inspect"
          },
          metadata: {
            deterministic: true,
            persistence: "memory",
            source: "runtime-host",
            createdAtPolicy: "logical",
            runtimeVersion: "runtime-host@0.1.0",
            contentPackageId: "content.demo.minimal",
            idempotencyKey: "append.demo.inspect.01"
          }
        }
      ],
      metadata: {
        deterministic: true,
        persistence: "memory",
        source: "event-store",
        batchId: "batch.demo.inspect.01"
      }
    }
  };
}

describe("in-memory event store boundary", () => {
  it("appends valid records in deterministic order and preserves input immutability", () => {
    const store = createInMemoryEventStore();
    const input = makeAppendInput();
    const beforeInput = canonicalizeJson(input);

    const result = appendEventRecords(store, input);

    expect(result.status).toBe("appended");
    expect(result.metadata.recordCount).toBe(1);
    expect(listEventRecords(store)).toEqual(input.envelope.records);
    expect(getEventRecordById(store, "runtime-event.command.demo.inspect.01")).toEqual(input.envelope.records[0]);
    expect(canonicalizeJson(input)).toBe(beforeInput);
  });

  it("returns idempotent appended result for identical duplicate records", () => {
    const store = createInMemoryEventStore();
    const input = makeAppendInput();

    appendEventRecords(store, input);
    const result = appendEventRecords(store, input);

    expect(result.status).toBe("appended");
    expect(result.metadata.idempotent).toBe(true);
    expect(result.metadata.recordCount).toBe(0);
    expect(listEventRecords(store)).toHaveLength(1);
  });

  it("rejects conflicting duplicate event ids without mutating store state", () => {
    const store = createInMemoryEventStore();
    const input = makeAppendInput();
    appendEventRecords(store, input);

    const conflicting: PersistenceAppendEventsInput = {
      envelope: {
        ...input.envelope,
        records: [
          {
            ...input.envelope.records[0],
            payload: {
              eventMappingId: "event-mapping.demo.changed"
            }
          }
        ]
      }
    };
    const beforeState = canonicalizeJson(listEventRecords(store));

    const result = appendEventRecords(store, conflicting);

    expect(result.status).toBe("rejected");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain("PERSISTENCE_EVENT_DUPLICATE_CONFLICT");
    expect(canonicalizeJson(listEventRecords(store))).toBe(beforeState);
  });

  it("rejects invalid event envelopes", () => {
    const store = createInMemoryEventStore();
    const input = makeAppendInput();
    const invalid: PersistenceAppendEventsInput = {
      envelope: {
        ...input.envelope,
        records: [
          {
            ...input.envelope.records[0],
            eventId: "bad"
          }
        ]
      }
    };

    const result = appendEventRecords(store, invalid);

    expect(result.status).toBe("rejected");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain("PERSISTENCE_EVENT_RECORD_INVALID");
    expect(listEventRecords(store)).toEqual([]);
  });

  it("keeps the production event store boundary free of file IO, DB, and external storage", () => {
    const source = readFileSync("packages/engine-kernel/src/persistence/in-memory-event-store.ts", "utf8");

    expect(source).not.toMatch(/readFileSync|writeFileSync|appendFileSync|node:fs|fetch\(/u);
    expect(source).not.toContain("database adapter");
    expect(source).not.toContain("external storage");
    expect(source).not.toContain("replay runtime behavior");
  });
});
