import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { canonicalizeJson } from "../packages/core/src/index.js";
import { materializeDomainEvents } from "../packages/engine-kernel/src/index.js";
import { runtimeInvalidCases } from "./fixtures/contracts/domain-event/runtime-invalid/runtime-invalid";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type TransactionInput = {
  status: "committed" | "no-op" | "rolled-back" | "rejected" | "error";
  transactionId: string;
  baseRevision: number;
  newRevision: number;
  source: { kind: "command-plan"; commandId?: string } | { kind: "system"; systemId?: string };
};

const fixtureRoot = resolve("tests/fixtures/contracts/domain-event");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readFixture(name: string): unknown {
  return JSON.parse(readFileSync(resolve(fixtureRoot, name), "utf8")) as unknown;
}

function createCommittedInput(candidate: unknown): { readonly transaction: TransactionInput; readonly candidate: unknown } {
  if (!isRecord(candidate)) {
    throw new Error("Candidate fixture must be an object");
  }
  const transactionId = typeof candidate.transactionId === "string" ? candidate.transactionId : "transaction.runtime.open-main-door";
  const revision = typeof candidate.revision === "number" && Number.isInteger(candidate.revision) ? candidate.revision : 43;
  const commandId = typeof candidate.commandId === "string" ? candidate.commandId : undefined;
  return {
    transaction: {
      status: "committed",
      transactionId,
      baseRevision: typeof candidate.previousRevision === "number" && Number.isInteger(candidate.previousRevision) ? candidate.previousRevision : revision - 1,
      newRevision: revision,
      source: commandId !== undefined ? { kind: "command-plan", commandId } : { kind: "system", systemId: "scheduler.core.tick" }
    },
    candidate
  };
}

function createTransaction(
  status: TransactionInput["status"],
  overrides: Partial<Omit<TransactionInput, "status">> = {}
): TransactionInput {
  return {
    status,
    transactionId: overrides.transactionId ?? "transaction.runtime.open-main-door",
    baseRevision: overrides.baseRevision ?? 42,
    newRevision: overrides.newRevision ?? 43,
    source: overrides.source ?? { kind: "command-plan", commandId: "command.runtime.open-main-door" }
  };
}

describe("Domain Event Materializer", () => {
  it("materializes a committed single confirmed event", () => {
    const candidate = readFixture("valid/with-command-binding.json");
    const result = materializeDomainEvents(createCommittedInput(candidate));

    expect(result.status).toBe("materialized");
    if (result.status === "materialized") {
      expect(result.batch.transactionId).toBe("transaction.runtime.open-main-door");
      expect(result.batch.revision).toBe(43);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].sequence).toBe(0);
    }
  });

  it("materializes a committed event batch without reordering the batch", () => {
    const candidate = readFixture("valid/with-batch-ordering.json");
    const result = materializeDomainEvents(createCommittedInput(candidate));

    expect(result.status).toBe("materialized");
    if (result.status === "materialized") {
      expect(result.events.map((event) => event.sequence)).toEqual([0, 1]);
      expect(result.events.map((event) => event.eventType)).toEqual(["core.zeta-opened", "core.alpha-opened"]);
    }
  });

  it("materializes an empty confirmed batch for a committed transaction with no public event", () => {
    const candidate = readFixture("valid/empty-confirmed-batch.json");
    const result = materializeDomainEvents(createCommittedInput(candidate));

    expect(result.status).toBe("empty");
    if (result.status === "empty") {
      expect(result.batch.events).toHaveLength(0);
      expect(result.events).toHaveLength(0);
    }
  });

  it("rejects no-op, rejected, rolled-back, and error transactions", () => {
    const candidate = readFixture("valid/minimal-confirmed-event.json");
    const statuses: TransactionInput["status"][] = ["no-op", "rejected", "rolled-back", "error"];

    for (const status of statuses) {
      const result = materializeDomainEvents({
        transaction: createTransaction(status),
        candidate
      });

      expect(result.status, status).toBe("error");
      if (result.status === "error") {
        expect(result.diagnostics[0]?.code).toBe("CONFIRMATION_BOUNDARY_VIOLATION");
      }
    }
  });

  it("rejects invalid wrapper shape", () => {
    const result = materializeDomainEvents(null);

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.diagnostics[0]?.code).toBe("INVALID_EVENT_SHAPE");
      expect(result.diagnostics[0]?.path).toBe("/");
    }
  });

  it("rejects invalid and non-JSON candidate inputs", () => {
    for (const { name, value } of runtimeInvalidCases as readonly { readonly name: string; readonly value: unknown }[]) {
      const result = materializeDomainEvents({
        transaction: createTransaction("committed"),
        candidate: value
      });

      expect(result.status, name).toBe("error");
      if (result.status === "error") {
        const firstPath = result.diagnostics[0]?.path;
        expect(typeof firstPath === "string" ? firstPath.startsWith("/candidate") : false).toBe(true);
      }
    }
  });

  it("rejects forbidden keys and cyclic candidate inputs", () => {
    const forbidden = { contractVersion: "domain-event@0.1.0", schemaId: "domain-event", schemaVersion: 1, candidate: { __proto__: { polluted: true } } };
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    const forbiddenResult = materializeDomainEvents({
      transaction: createTransaction("committed"),
      candidate: forbidden
    });
    const cyclicResult = materializeDomainEvents({
      transaction: createTransaction("committed"),
      candidate: cyclic
    });

    expect(forbiddenResult.status).toBe("error");
    expect(cyclicResult.status).toBe("error");
  });

  it("rejects invalid event type and payload", () => {
    const invalidType = readFixture("semantic-invalid/unknown-event-type.json");
    const invalidPayload = readFixture("semantic-invalid/payload-schema-mismatch.json");

    const invalidTypeResult = materializeDomainEvents(createCommittedInput(invalidType));
    const invalidPayloadResult = materializeDomainEvents(createCommittedInput(invalidPayload));

    expect(invalidTypeResult.status).toBe("error");
    if (invalidTypeResult.status === "error") {
      expect(invalidTypeResult.diagnostics[0]?.code).toBe("UNKNOWN_EVENT_TYPE");
      expect(invalidTypeResult.diagnostics[0]?.path).toBe("/candidate/eventType");
    }
    expect(invalidPayloadResult.status).toBe("error");
    if (invalidPayloadResult.status === "error") {
      expect(invalidPayloadResult.diagnostics[0]?.code).toBe("INVALID_EVENT_PAYLOAD");
    }
  });

  it("rejects duplicate event ids and duplicate sequences", () => {
    const duplicateEventIds = readFixture("semantic-invalid/duplicate-event-id.json");
    const duplicateSequences = readFixture("semantic-invalid/duplicate-sequence.json");

    const duplicateEventIdResult = materializeDomainEvents(createCommittedInput(duplicateEventIds));
    const duplicateSequenceResult = materializeDomainEvents(createCommittedInput(duplicateSequences));

    expect(duplicateEventIdResult.status).toBe("error");
    expect(duplicateSequenceResult.status).toBe("error");
    if (duplicateEventIdResult.status === "error") {
      expect(duplicateEventIdResult.diagnostics.some((issue) => issue.code === "DUPLICATE_EVENT_ID")).toBe(true);
    }
    if (duplicateSequenceResult.status === "error") {
      expect(duplicateSequenceResult.diagnostics.some((issue) => issue.code === "DUPLICATE_EVENT_SEQUENCE" || issue.code === "INVALID_SEQUENCE")).toBe(true);
    }
  });

  it("rejects sequence gaps", () => {
    const candidate = readFixture("semantic-invalid/sequence-gap.json");
    const result = materializeDomainEvents(createCommittedInput(candidate));

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.diagnostics.some((issue) => issue.code === "INVALID_SEQUENCE")).toBe(true);
    }
  });

  it("rejects event batches that do not match the committed transaction", () => {
    const candidate = readFixture("semantic-invalid/revision-mismatch.json");
    const input = createCommittedInput(candidate);
    input.transaction.newRevision = 43;
    const result = materializeDomainEvents(input);

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.diagnostics.some((issue) => issue.code === "INVALID_REVISION_BOUNDARY")).toBe(true);
    }
  });

  it("rejects command binding mismatches", () => {
    const candidate = readFixture("semantic-invalid/command-id-mismatch.json");
    const result = materializeDomainEvents(createCommittedInput(candidate));

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.diagnostics.some((issue) => issue.code === "INVALID_COMMAND_REFERENCE")).toBe(true);
    }
  });

  it("materializes deterministically and keeps diagnostics stable", () => {
    const candidate = readFixture("valid/minimal-confirmed-event.json");
    const reordered = cloneJson(candidate);
    if (isRecord(reordered)) {
      const normalized: Record<string, JsonValue> = {};
      for (const key of ["payload", "sequence", "revision", "previousRevision", "transactionId", "eventType", "eventId", "schemaVersion", "schemaId", "contractVersion"]) {
        normalized[key] = reordered[key] as JsonValue;
      }
      const first = materializeDomainEvents(createCommittedInput(candidate));
      const second = materializeDomainEvents(createCommittedInput(normalized));

      expect(first.status).toBe("materialized");
      expect(second.status).toBe("materialized");
      if (first.status === "materialized" && second.status === "materialized") {
        expect(canonicalizeJson(first.batch)).toBe(canonicalizeJson(second.batch));
      }
    } else {
      throw new Error("Fixture did not load as an object");
    }
  });

  it("keeps input objects immutable and detached from the result", () => {
    const candidate = readFixture("valid/with-command-binding.json");
    const input = createCommittedInput(candidate);
    const beforeTransaction = canonicalizeJson(input.transaction);
    const beforeCandidate = canonicalizeJson(candidate);
    const result = materializeDomainEvents(input);

    expect(result.status).toBe("materialized");
    if (result.status === "materialized") {
      (input.transaction as Record<string, unknown>).transactionId = "transaction.runtime.changed";
      if (isRecord(candidate)) {
        candidate.transactionId = "transaction.runtime.changed";
      }
      expect(canonicalizeJson(result.batch)).not.toContain("transaction.runtime.changed");
      expect(canonicalizeJson(input.transaction)).not.toBe(beforeTransaction);
      expect(canonicalizeJson(candidate)).not.toBe(beforeCandidate);
    }
  });

  it("keeps the public result surface limited to materialization data", () => {
    const candidate = readFixture("valid/minimal-confirmed-event.json");
    const success = materializeDomainEvents(createCommittedInput(candidate));
    const failure = materializeDomainEvents({
      transaction: createTransaction("rejected"),
      candidate
    });

    expect(Object.keys(success).sort()).toEqual(["batch", "events", "status"]);
    expect(Object.keys(failure).sort()).toEqual(["diagnostics", "status"]);
  });

  it("rejects duplicate transaction materialization attempts through history", () => {
    const history = new Map<string, string>();
    const candidate = readFixture("valid/minimal-confirmed-event.json");
    const first = materializeDomainEvents(createCommittedInput(candidate), { history });
    const second = materializeDomainEvents(createCommittedInput(candidate), { history });

    expect(first.status).toBe("materialized");
    expect(second.status).toBe("materialized");
    if (second.status === "materialized") {
      expect(canonicalizeJson(second.batch as unknown as JsonValue)).toBe(canonicalizeJson(first.batch as unknown as JsonValue));
    }
  });
});
