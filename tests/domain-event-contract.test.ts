import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { runtimeInvalidCases } from "./fixtures/contracts/domain-event/runtime-invalid/runtime-invalid";

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

type TypedReference = {
  id: string;
  entityType: string;
};

type DomainEvent = {
  contractVersion: string;
  schemaId: string;
  schemaVersion: number;
  eventId: string;
  eventType: string;
  transactionId: string;
  previousRevision: number;
  revision: number;
  sequence: number;
  commandId?: string;
  correlationId?: string;
  causationKind?: "command" | "event" | "transaction";
  causationId?: string;
  payload: JsonValue;
};

type DomainEventBatch = {
  contractVersion: string;
  schemaId: string;
  schemaVersion: number;
  transactionId: string;
  previousRevision: number;
  revision: number;
  commandId?: string;
  correlationId?: string;
  causationKind?: "command" | "event" | "transaction";
  causationId?: string;
  events: DomainEvent[];
};

type TransactionSource = { kind: "command-plan"; commandId: string } | { kind: "system"; systemId: string };

type TransactionOutcome =
  | {
      status: "committed";
      transactionId: string;
      baseRevision: number;
      resultingRevision: number;
      source: TransactionSource;
    }
  | {
      status: "no-op" | "rolled-back" | "rejected" | "error";
      transactionId?: string;
      baseRevision?: number;
      resultingRevision?: number;
      source?: TransactionSource;
    };

type Diagnostic = {
  code: string;
  message: string;
  path?: string;
};

type MaterializationResult =
  | { status: "materialized"; batch: DomainEventBatch }
  | { status: "empty"; batch: DomainEventBatch }
  | { status: "error"; diagnostics: Diagnostic[] };

const contractVersion = "domain-event@0.1.0";
const schemaId = "domain-event";
const entityIdentityPattern = /^[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,31}\.[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,47}\.[a-z0-9](?:[a-z0-9]|[_-](?=[a-z0-9])){0,79}$/;
const eventTypePattern = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/;
const opaqueIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const forbiddenObjectKeys = new Set(["__proto__", "prototype", "constructor"]);
const confirmedEventRootKeys = new Set([
  "contractVersion",
  "schemaId",
  "schemaVersion",
  "eventId",
  "eventType",
  "transactionId",
  "previousRevision",
  "revision",
  "sequence",
  "commandId",
  "correlationId",
  "causationKind",
  "causationId",
  "payload"
]);
const confirmedBatchRootKeys = new Set([
  "contractVersion",
  "schemaId",
  "schemaVersion",
  "transactionId",
  "previousRevision",
  "revision",
  "commandId",
  "correlationId",
  "causationKind",
  "causationId",
  "events"
]);
const fixtureRoot = resolve("tests/fixtures/contracts/domain-event");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneJson<T extends JsonValue>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function sortJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  const sorted: Record<string, JsonValue> = {};
  for (const key of Object.keys(value).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    sorted[key] = sortJson((value as Record<string, JsonValue>)[key]);
  }
  return sorted;
}

function canonicalStringify(value: unknown): string {
  return JSON.stringify(sortJson(value as JsonValue), null, 2) + "\n";
}

function hasForbiddenKey(value: unknown, seen = new Set<unknown>()): boolean {
  if (value === null || typeof value !== "object") {
    return false;
  }
  if (seen.has(value)) {
    return false;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.some((entry) => hasForbiddenKey(entry, seen));
  }
  for (const [key, entry] of Object.entries(value)) {
    if (forbiddenObjectKeys.has(key) || hasForbiddenKey(entry, seen)) {
      return true;
    }
  }
  return false;
}

function isJsonValue(value: unknown, depth = 0, seen = new Set<unknown>()): value is JsonValue {
  if (depth > 8) {
    return false;
  }
  if (value === null) {
    return true;
  }
  const kind = typeof value;
  if (kind === "boolean" || kind === "string") {
    return kind !== "string" || value.length <= 1024;
  }
  if (kind === "number") {
    return Number.isFinite(value);
  }
  if (kind !== "object") {
    return false;
  }
  if (seen.has(value)) {
    return false;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    if (value.length > 64) {
      return false;
    }
    return value.every((entry) => isJsonValue(entry, depth + 1, seen));
  }
  if (Object.keys(value).length > 16) {
    return false;
  }
  return Object.entries(value).every(([key, entry]) => {
    if (forbiddenObjectKeys.has(key)) {
      return false;
    }
    return isJsonValue(entry, depth + 1, seen);
  });
}

function isTypedReference(value: unknown): value is TypedReference {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.entityType === "string" &&
    value.id.length >= 6 &&
    value.id.length <= 160 &&
    value.entityType.length >= 2 &&
    value.entityType.length <= 32 &&
    entityIdentityPattern.test(value.id) &&
    /^[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,31}$/.test(value.entityType) &&
    value.entityType === value.id.split(".")[0]
  );
}

function validateTypedReferenceTree(value: unknown, seen = new Set<unknown>()): boolean {
  if (value === null || typeof value !== "object") {
    return true;
  }
  if (seen.has(value)) {
    return true;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.every((entry) => validateTypedReferenceTree(entry, seen));
  }
  if (("id" in value || "entityType" in value) && !isTypedReference(value)) {
    return false;
  }
  return Object.values(value).every((entry) => validateTypedReferenceTree(entry, seen));
}

function validateEventEnvelope(candidate: unknown): candidate is DomainEvent {
  if (!isRecord(candidate)) {
    return false;
  }
  if (candidate.contractVersion !== contractVersion || candidate.schemaId !== schemaId || candidate.schemaVersion !== 1) {
    return false;
  }
  if (typeof candidate.eventId !== "string" || !entityIdentityPattern.test(candidate.eventId)) {
    return false;
  }
  if (typeof candidate.eventType !== "string" || candidate.eventType.length < 3 || candidate.eventType.length > 128 || !eventTypePattern.test(candidate.eventType)) {
    return false;
  }
  if (typeof candidate.transactionId !== "string" || !entityIdentityPattern.test(candidate.transactionId)) {
    return false;
  }
  if (typeof candidate.previousRevision !== "number" || !Number.isInteger(candidate.previousRevision) || candidate.previousRevision < 0) {
    return false;
  }
  if (typeof candidate.revision !== "number" || !Number.isInteger(candidate.revision) || candidate.revision < 0) {
    return false;
  }
  if (typeof candidate.sequence !== "number" || !Number.isInteger(candidate.sequence) || candidate.sequence < 0) {
    return false;
  }
  if (candidate.commandId !== undefined && (typeof candidate.commandId !== "string" || !entityIdentityPattern.test(candidate.commandId))) {
    return false;
  }
  if (candidate.correlationId !== undefined && (typeof candidate.correlationId !== "string" || !opaqueIdPattern.test(candidate.correlationId))) {
    return false;
  }
  if (candidate.causationKind !== undefined && !["command", "event", "transaction"].includes(candidate.causationKind)) {
    return false;
  }
  if (candidate.causationId !== undefined && (typeof candidate.causationId !== "string" || !opaqueIdPattern.test(candidate.causationId))) {
    return false;
  }
  if ((candidate.causationId !== undefined) !== (candidate.causationKind !== undefined)) {
    return false;
  }
  return isJsonValue(candidate.payload) && !hasForbiddenKey(candidate.payload) && validateTypedReferenceTree(candidate.payload);
}

function validateEventBatch(candidate: unknown): candidate is DomainEventBatch {
  if (!isRecord(candidate)) {
    return false;
  }
  if (candidate.contractVersion !== contractVersion || candidate.schemaId !== schemaId || candidate.schemaVersion !== 1) {
    return false;
  }
  if (typeof candidate.transactionId !== "string" || !entityIdentityPattern.test(candidate.transactionId)) {
    return false;
  }
  if (typeof candidate.previousRevision !== "number" || !Number.isInteger(candidate.previousRevision) || candidate.previousRevision < 0) {
    return false;
  }
  if (typeof candidate.revision !== "number" || !Number.isInteger(candidate.revision) || candidate.revision < 0) {
    return false;
  }
  if (!Array.isArray(candidate.events) || candidate.events.length > 64) {
    return false;
  }
  if (candidate.commandId !== undefined && (typeof candidate.commandId !== "string" || !entityIdentityPattern.test(candidate.commandId))) {
    return false;
  }
  if (candidate.correlationId !== undefined && (typeof candidate.correlationId !== "string" || !opaqueIdPattern.test(candidate.correlationId))) {
    return false;
  }
  if (candidate.causationKind !== undefined && !["command", "event", "transaction"].includes(candidate.causationKind)) {
    return false;
  }
  if (candidate.causationId !== undefined && (typeof candidate.causationId !== "string" || !opaqueIdPattern.test(candidate.causationId))) {
    return false;
  }
  if ((candidate.causationId !== undefined) !== (candidate.causationKind !== undefined)) {
    return false;
  }
  return candidate.events.every((event) => validateEventEnvelope(event));
}

function validateDomainEventShape(candidate: unknown): boolean {
  if (!isRecord(candidate)) {
    return false;
  }
  if (candidate.events !== undefined) {
    if (!Object.keys(candidate).every((key) => confirmedBatchRootKeys.has(key))) {
      return false;
    }
    if (!validateEventBatch(candidate)) {
      return false;
    }
    return !("eventId" in candidate) && !("eventType" in candidate) && !("sequence" in candidate) && !("payload" in candidate);
  }
  if (!Object.keys(candidate).every((key) => confirmedEventRootKeys.has(key))) {
    return false;
  }
  return validateEventEnvelope(candidate);
}

function validateConfirmedBatchSemantic(batch: DomainEventBatch): { ok: boolean; code?: string } {
  if (batch.previousRevision + 1 !== batch.revision) {
    return { ok: false, code: "INVALID_REVISION_BOUNDARY" };
  }
  const eventIds = new Set<string>();
  const sequences = new Set<number>();
  for (let index = 0; index < batch.events.length; index += 1) {
    const event = batch.events[index];
    if (event.transactionId !== batch.transactionId) {
      return { ok: false, code: "INVALID_TRANSACTION_REFERENCE" };
    }
    if (event.previousRevision !== batch.previousRevision || event.revision !== batch.revision) {
      return { ok: false, code: "INVALID_REVISION_BOUNDARY" };
    }
    if (event.sequence !== index) {
      return { ok: false, code: "INVALID_SEQUENCE" };
    }
    if (eventIds.has(event.eventId)) {
      return { ok: false, code: "DUPLICATE_EVENT_ID" };
    }
    if (sequences.has(event.sequence)) {
      return { ok: false, code: "DUPLICATE_EVENT_SEQUENCE" };
    }
    eventIds.add(event.eventId);
    sequences.add(event.sequence);
    if (!validateSupportedPayload(event.eventType, event.schemaVersion, event.payload)) {
      return { ok: false, code: "INVALID_EVENT_PAYLOAD" };
    }
  }
  if (batch.commandId !== undefined && batch.commandId === "") {
    return { ok: false, code: "INVALID_COMMAND_REFERENCE" };
  }
  return { ok: true };
}

function validateSupportedPayload(eventType: string, schemaVersion: number, payload: JsonValue): boolean {
  if (schemaVersion !== 1) {
    return false;
  }
  if (!["core.alpha-opened", "core.zeta-opened", "core.door-opened", "core.door-closed"].includes(eventType)) {
    return false;
  }
  if (!isRecord(payload)) {
    return false;
  }
  if (!isTypedReference(payload.door)) {
    return false;
  }
  if (payload.state !== undefined && (payload.state !== "open" && payload.state !== "closed")) {
    return false;
  }
  return true;
}

function materializeConfirmedEventBatch(transaction: TransactionOutcome, candidate: unknown, history = new Map<string, string>()): MaterializationResult {
  if (transaction.status !== "committed") {
    return {
      status: "error",
      diagnostics: [{ code: "CONFIRMATION_BOUNDARY_VIOLATION", message: "Only committed transactions can materialize confirmed events", path: "/status" }]
    };
  }
  if (!validateDomainEventShape(candidate)) {
    return {
      status: "error",
      diagnostics: [{ code: "INVALID_EVENT_SHAPE", message: "Invalid event envelope", path: "/" }]
    };
  }

  const normalizedBatch: DomainEventBatch = candidate.events !== undefined
    ? cloneJson(candidate)
    : {
        contractVersion: candidate.contractVersion,
        schemaId: candidate.schemaId,
        schemaVersion: candidate.schemaVersion,
        transactionId: candidate.transactionId,
        previousRevision: candidate.previousRevision,
        revision: candidate.revision,
        commandId: candidate.commandId,
        correlationId: candidate.correlationId,
        causationKind: candidate.causationKind,
        causationId: candidate.causationId,
        events: [cloneJson(candidate)]
      };

  if (history.has(transaction.transactionId)) {
    if (history.get(transaction.transactionId) !== canonicalStringify(normalizedBatch)) {
      return {
        status: "error",
        diagnostics: [{ code: "DUPLICATE_EVENT_ID", message: "Duplicate transaction materialization conflicts with a prior batch", path: "/transactionId" }]
      };
    }
    return {
      status: "error",
      diagnostics: [{ code: "DUPLICATE_EVENT_ID", message: "Duplicate transaction materialization", path: "/transactionId" }]
    };
  }

  if (transaction.source.kind === "command-plan" && normalizedBatch.commandId !== undefined && normalizedBatch.commandId !== transaction.source.commandId) {
    return {
      status: "error",
      diagnostics: [{ code: "INVALID_COMMAND_REFERENCE", message: "Command binding does not match transaction source", path: "/commandId" }]
    };
  }
  if (transaction.source.kind === "system" && normalizedBatch.commandId !== undefined) {
    return {
      status: "error",
      diagnostics: [{ code: "INVALID_COMMAND_REFERENCE", message: "System transactions do not bind a command", path: "/commandId" }]
    };
  }
  if (normalizedBatch.transactionId !== transaction.transactionId) {
    return {
      status: "error",
      diagnostics: [{ code: "INVALID_TRANSACTION_REFERENCE", message: "Event transaction binding does not match committed transaction", path: "/transactionId" }]
    };
  }
  if (normalizedBatch.previousRevision !== transaction.baseRevision || normalizedBatch.revision !== transaction.resultingRevision) {
    return {
      status: "error",
      diagnostics: [{ code: "INVALID_REVISION_BOUNDARY", message: "Event revision boundary does not match committed transaction", path: "/revision" }]
    };
  }
  const semantic = validateConfirmedBatchSemantic(normalizedBatch);
  if (!semantic.ok) {
    return {
      status: "error",
      diagnostics: [{ code: semantic.code ?? "EVENT_MATERIALIZATION_FAILED", message: "Confirmed event batch failed semantic validation", path: "/events" }]
    };
  }
  if (normalizedBatch.events.length === 0) {
    const empty = cloneJson(normalizedBatch);
    history.set(transaction.transactionId, canonicalStringify(empty));
    return { status: "empty", batch: empty };
  }
  const result = cloneJson(normalizedBatch);
  history.set(transaction.transactionId, canonicalStringify(result));
  return { status: "materialized", batch: result };
}

function readFixture(name: string): unknown {
  return JSON.parse(readFileSync(resolve(fixtureRoot, name), "utf8")) as unknown;
}

function materializeConfirmedEvent(
  transaction: TransactionOutcome,
  candidate: unknown,
  history = new Map<string, string>()
): MaterializationResult {
  if (!validateEventEnvelope(candidate)) {
    return {
      status: "error",
      diagnostics: [{ code: "INVALID_EVENT_SHAPE", message: "Confirmed event shape is invalid", path: "/" }]
    };
  }
  if (transaction.status !== "committed") {
    return {
      status: "error",
      diagnostics: [{ code: "CONFIRMATION_BOUNDARY_VIOLATION", message: "Confirmed event requires a committed transaction", path: "/transactionId" }]
    };
  }

  const event = cloneJson(candidate);
  const batch = {
    contractVersion: event.contractVersion,
    schemaId: event.schemaId,
    schemaVersion: event.schemaVersion,
    transactionId: event.transactionId,
    previousRevision: event.previousRevision,
    revision: event.revision,
    commandId: event.commandId,
    correlationId: event.correlationId,
    causationKind: event.causationKind,
    causationId: event.causationId,
    events: [event]
  };
  return materializeConfirmedEventBatch(transaction, batch, history);
}

function createCommittedTransaction(resultingRevision: number): TransactionOutcome {
  const source = {
    kind: "command-plan",
    commandId: "command.runtime.open-main-door"
  } satisfies TransactionSource;
  return {
    status: "committed",
    transactionId: "transaction.runtime.open-main-door",
    baseRevision: 42,
    resultingRevision,
    source
  } satisfies TransactionOutcome;
}

function createRejectedTransaction(status: "no-op" | "rejected"): TransactionOutcome {
  const source = {
    kind: "command-plan",
    commandId: "command.runtime.open-main-door"
  } satisfies TransactionSource;
  return {
    status,
    transactionId: "transaction.runtime.open-main-door",
    baseRevision: 42,
    resultingRevision: 42,
    source
  } satisfies TransactionOutcome;
}

describe("Domain Event Contract", () => {
  it("validates valid event fixtures", () => {
    const fixtures = [
      "valid/minimal-confirmed-event.json",
      "valid/with-command-binding.json",
      "valid/with-batch-ordering.json",
      "valid/empty-confirmed-batch.json"
    ];

    for (const fixture of fixtures) {
      expect(validateDomainEventShape(readFixture(fixture)), fixture).toBe(true);
    }
  });

  it("rejects invalid event fixtures", () => {
    const fixtures = [
      "invalid/missing-schema-version.json",
      "invalid/schema-version-zero.json",
      "invalid/invalid-event-id.json",
      "invalid/invalid-event-type.json",
      "invalid/missing-transaction-reference.json",
      "invalid/negative-revision.json",
      "invalid/negative-sequence.json",
      "invalid/decimal-sequence.json",
      "invalid/invalid-typed-reference.json",
      "invalid/unknown-root-field.json",
      "invalid/executable-field.json",
      "invalid/forbidden-nested-payload-key.json",
      "invalid/payload-too-large.json"
    ];

    for (const fixture of fixtures) {
      expect(validateDomainEventShape(readFixture(fixture)), fixture).toBe(false);
    }
  });

  it("detects semantic-invalid fixtures", () => {
    const committed = createCommittedTransaction(43);
    const rejected = createRejectedTransaction("rejected");
    const noOp = createRejectedTransaction("no-op");
    const fixtures = [
      "semantic-invalid/transaction-not-committed.json",
      "semantic-invalid/no-op-transaction.json",
      "semantic-invalid/revision-mismatch.json",
      "semantic-invalid/duplicate-event-id.json",
      "semantic-invalid/duplicate-sequence.json",
      "semantic-invalid/sequence-gap.json",
      "semantic-invalid/command-id-mismatch.json",
      "semantic-invalid/unknown-event-type.json",
      "semantic-invalid/unsupported-schema-version.json",
      "semantic-invalid/payload-schema-mismatch.json",
      "semantic-invalid/event-before-commit.json",
      "semantic-invalid/duplicate-transaction-materializes-twice.json",
      "semantic-invalid/proposal-masked-as-confirmed-event.json"
    ] as const;

    const history = new Map<string, string>();

    for (const fixtureName of fixtures) {
      const fixture = readFixture(fixtureName);
      if (fixtureName === "semantic-invalid/transaction-not-committed.json" || fixtureName === "semantic-invalid/event-before-commit.json" || fixtureName === "semantic-invalid/proposal-masked-as-confirmed-event.json") {
        expect(materializeConfirmedEvent(rejected, fixture, history).status, fixtureName).toBe("error");
        continue;
      }
      if (fixtureName === "semantic-invalid/no-op-transaction.json") {
        expect(materializeConfirmedEventBatch(noOp, fixture, history).status, fixtureName).toBe("error");
        continue;
      }
      if (fixtureName === "semantic-invalid/duplicate-transaction-materializes-twice.json") {
        const first = materializeConfirmedEventBatch(committed, fixture, history);
        expect(first.status, `${fixtureName}: first materialization`).toBe("materialized");
        const second = materializeConfirmedEventBatch(committed, fixture, history);
        expect(second.status, `${fixtureName}: second materialization`).toBe("error");
        continue;
      }
      expect(materializeConfirmedEventBatch(committed, fixture, history).status, fixtureName).toBe("error");
    }
  });

  it("rejects runtime-invalid values", () => {
    for (const { name, value } of runtimeInvalidCases) {
      expect(validateDomainEventShape(value), name).toBe(false);
    }
  });

  it("materializes only committed transactions into confirmed events", () => {
    const committed: TransactionOutcome = {
      status: "committed",
      transactionId: "transaction.runtime.open-main-door",
      baseRevision: 42,
      resultingRevision: 43,
      source: { kind: "command-plan", commandId: "command.runtime.open-main-door" }
    };
    const batch = readFixture("valid/with-command-binding.json");
    const result = materializeConfirmedEventBatch(committed, batch);

    expect(result.status).toBe("materialized");
    if (result.status === "materialized") {
      expect(result.batch.transactionId).toBe("transaction.runtime.open-main-door");
      expect(result.batch.revision).toBe(43);
    }
  });

  it("does not materialize no-op, rejected, rolled-back, or error transactions", () => {
    const batch = readFixture("valid/minimal-confirmed-event.json");
    const outcomes: TransactionOutcome[] = [
      { status: "no-op", transactionId: "transaction.runtime.open-main-door", baseRevision: 42, resultingRevision: 42 },
      { status: "rejected", transactionId: "transaction.runtime.open-main-door", baseRevision: 42, resultingRevision: 42 },
      { status: "rolled-back", transactionId: "transaction.runtime.open-main-door", baseRevision: 42, resultingRevision: 42 },
      { status: "error", transactionId: "transaction.runtime.open-main-door", baseRevision: 42, resultingRevision: 42 }
    ];

    for (const outcome of outcomes) {
      const result = materializeConfirmedEventBatch(outcome, batch);
      expect(result.status).toBe("error");
    }
  });

  it("preserves revision boundary and sequence ordering without resorting by eventType", () => {
    const batch = readFixture("valid/with-batch-ordering.json");
    const materialized = materializeConfirmedEventBatch(
      {
        status: "committed",
        transactionId: "transaction.runtime.open-main-door",
        baseRevision: 42,
        resultingRevision: 43,
        source: { kind: "command-plan", commandId: "command.runtime.open-main-door" }
      },
      batch
    );

    expect(materialized.status).toBe("materialized");
    if (materialized.status === "materialized") {
      expect(materialized.batch.events.map((event) => event.sequence)).toEqual([0, 1]);
      expect(materialized.batch.events[0].eventType).toBe("core.zeta-opened");
      expect(materialized.batch.events[1].eventType).toBe("core.alpha-opened");
    }
  });

  it("rejects duplicate event ids and duplicate sequences", () => {
    const duplicateEventIds = readFixture("semantic-invalid/duplicate-event-id.json");
    const duplicateSequences = readFixture("semantic-invalid/duplicate-sequence.json");
    const transaction: TransactionOutcome = {
      status: "committed",
      transactionId: "transaction.runtime.open-main-door",
      baseRevision: 42,
      resultingRevision: 43,
      source: { kind: "command-plan", commandId: "command.runtime.open-main-door" }
    };

    expect(materializeConfirmedEventBatch(transaction, duplicateEventIds).status).toBe("error");
    expect(materializeConfirmedEventBatch(transaction, duplicateSequences).status).toBe("error");
  });

  it("rejects sequence gaps when a batch claims an ordered batch", () => {
    const batch = readFixture("semantic-invalid/sequence-gap.json");
    const transaction: TransactionOutcome = {
      status: "committed",
      transactionId: "transaction.runtime.open-main-door",
      baseRevision: 42,
      resultingRevision: 43,
      source: { kind: "command-plan", commandId: "command.runtime.open-main-door" }
    };

    expect(materializeConfirmedEventBatch(transaction, batch).status).toBe("error");
  });

  it("materializes an empty confirmed batch when a committed transaction has no public event", () => {
    const emptyBatch = readFixture("valid/empty-confirmed-batch.json");
    const transaction: TransactionOutcome = {
      status: "committed",
      transactionId: "transaction.runtime.open-main-door",
      baseRevision: 42,
      resultingRevision: 43,
      source: { kind: "command-plan", commandId: "command.runtime.open-main-door" }
    };

    const result = materializeConfirmedEventBatch(transaction, emptyBatch);

    expect(result.status).toBe("empty");
    if (result.status === "empty") {
      expect(result.batch.events).toHaveLength(0);
    }
  });

  it("keeps event materialization immutable and detached from the input object", () => {
    const source = readFixture("valid/minimal-confirmed-event.json");
    const transaction: TransactionOutcome = {
      status: "committed",
      transactionId: "transaction.runtime.open-main-door",
      baseRevision: 42,
      resultingRevision: 43,
      source: { kind: "command-plan", commandId: "command.runtime.open-main-door" }
    };
    const before = canonicalStringify(source);
    const result = materializeConfirmedEventBatch(transaction, source);

    expect(result.status).toBe("materialized");
    if (result.status === "materialized") {
      (source as Record<string, unknown>).revision = 999;
      expect(canonicalStringify(result.batch)).not.toContain('"revision": 999');
      expect(canonicalStringify(source)).not.toBe(before);
    }
  });

  it("canonicalizes identically shaped confirmed events deterministically", () => {
    const first = readFixture("valid/minimal-confirmed-event.json");
    const second = cloneJson(first as JsonValue);
    if (isRecord(second)) {
      const reordered: Record<string, JsonValue> = {};
      for (const key of ["payload", "sequence", "revision", "previousRevision", "transactionId", "eventType", "eventId", "schemaVersion", "schemaId", "contractVersion"]) {
        reordered[key] = second[key] as JsonValue;
      }
      const firstText = canonicalStringify(first);
      const secondText = canonicalStringify(reordered);
      expect(firstText).toBe(secondText);
    } else {
      throw new Error("Fixture did not load as an object");
    }
  });

  it("keeps payload typed references canonical", () => {
    const event = readFixture("valid/with-command-binding.json");
    expect(validateDomainEventShape(event)).toBe(true);
    if (validateDomainEventShape(event) && !("events" in event)) {
      if (isRecord(event.payload)) {
        expect(isTypedReference((event.payload as Record<string, unknown>).door)).toBe(true);
      } else {
        throw new Error("Confirmed event payload must be an object");
      }
    }
  });
});

/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
