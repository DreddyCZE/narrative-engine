import { canonicalizeJson, formatJsonPath, inspectJsonSafety, type JsonPath, type JsonValue } from "@narrative-engine/core";

import { type TransactionResult } from "../transaction/transaction.js";

export const DOMAIN_EVENT_CONTRACT_VERSION = "domain-event@0.1.0" as const;
export const DOMAIN_EVENT_SCHEMA_ID = "domain-event" as const;
export const DOMAIN_EVENT_SCHEMA_VERSION = 1 as const;

export type DomainEventMaterializationStatus = "materialized" | "empty" | "error";

export type DomainEventMaterializationIssueCode =
  | "INVALID_EVENT_SHAPE"
  | "UNKNOWN_EVENT_TYPE"
  | "SCHEMA_VERSION_UNSUPPORTED"
  | "INVALID_EVENT_ID"
  | "INVALID_TRANSACTION_REFERENCE"
  | "INVALID_COMMAND_REFERENCE"
  | "INVALID_REVISION_BOUNDARY"
  | "INVALID_SEQUENCE"
  | "DUPLICATE_EVENT_ID"
  | "DUPLICATE_EVENT_SEQUENCE"
  | "INVALID_EVENT_PAYLOAD"
  | "NON_SERIALIZABLE_VALUE"
  | "FORBIDDEN_OBJECT_KEY"
  | "EVENT_BUDGET_EXCEEDED"
  | "EVENT_MATERIALIZATION_FAILED"
  | "CONFIRMATION_BOUNDARY_VIOLATION";

export type DomainEventMaterializationIssue = {
  readonly code: DomainEventMaterializationIssueCode;
  readonly path: string;
  readonly message: string;
  readonly phase?: string | undefined;
};

export type DomainEventEnvelope = {
  readonly contractVersion: typeof DOMAIN_EVENT_CONTRACT_VERSION;
  readonly schemaId: typeof DOMAIN_EVENT_SCHEMA_ID;
  readonly schemaVersion: number;
  readonly eventId: string;
  readonly eventType: string;
  readonly transactionId: string;
  readonly previousRevision: number;
  readonly revision: number;
  readonly sequence: number;
  readonly commandId?: string | undefined;
  readonly correlationId?: string | undefined;
  readonly causationKind?: "command" | "event" | "transaction" | undefined;
  readonly causationId?: string | undefined;
  readonly payload: JsonValue;
};

export type DomainEventBatch = {
  readonly contractVersion: typeof DOMAIN_EVENT_CONTRACT_VERSION;
  readonly schemaId: typeof DOMAIN_EVENT_SCHEMA_ID;
  readonly schemaVersion: number;
  readonly transactionId: string;
  readonly previousRevision: number;
  readonly revision: number;
  readonly commandId?: string | undefined;
  readonly correlationId?: string | undefined;
  readonly causationKind?: "command" | "event" | "transaction" | undefined;
  readonly causationId?: string | undefined;
  readonly events: readonly DomainEventEnvelope[];
};

export type DomainEventMaterializationResult =
  | { readonly status: "materialized"; readonly batch: DomainEventBatch; readonly events: readonly DomainEventEnvelope[] }
  | { readonly status: "empty"; readonly batch: DomainEventBatch; readonly events: readonly [] }
  | { readonly status: "error"; readonly diagnostics: readonly DomainEventMaterializationIssue[] };

export type DomainEventMaterializationHistory = Map<string, string>;

export type DomainEventMaterializationOptions = {
  readonly history?: DomainEventMaterializationHistory;
  readonly maxEvents?: number;
  readonly maxDiagnostics?: number;
};

type DomainEventSource =
  | {
      readonly kind: "command-plan";
      readonly commandId?: string | undefined;
    }
  | {
      readonly kind: "system";
      readonly systemId?: string | undefined;
    };

type DomainEventTransaction = {
  readonly status: TransactionResult["status"];
  readonly transactionId?: string | undefined;
  readonly baseRevision?: number | undefined;
  readonly newRevision?: number | undefined;
  readonly resultingRevision?: number | undefined;
  readonly source?: DomainEventSource | undefined;
  readonly commandId?: string | undefined;
  readonly correlationId?: string | undefined;
  readonly causationKind?: "command" | "event" | "transaction" | undefined;
  readonly causationId?: string | undefined;
};

const MAX_INT = 2_147_483_647;
const MAX_EVENTS = 64;
const MAX_DIAGNOSTICS = 32;

const INPUT_KEYS = new Set(["transaction", "candidate"]);
const TRANSACTION_KEYS = new Set([
  "status",
  "transactionId",
  "baseRevision",
  "newRevision",
  "resultingRevision",
  "source",
  "commandId",
  "correlationId",
  "causationKind",
  "causationId"
]);
const TRANSACTION_SOURCE_KEYS = new Set(["kind", "commandId", "systemId"]);
const EVENT_KEYS = new Set([
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
const BATCH_KEYS = new Set([
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
const ENTITY_ID_PATTERN =
  /^[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,31}\.[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,47}\.[a-z0-9](?:[a-z0-9]|[_-](?=[a-z0-9])){0,79}$/u;
const EVENT_TYPE_PATTERN = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/u;
const OPAQUE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u;
const SUPPORTED_EVENT_TYPES = new Set(["core.alpha-opened", "core.zeta-opened", "core.door-opened", "core.door-closed"]);
const FORBIDDEN_METADATA_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_INT;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function canonicalText(value: unknown): string {
  return canonicalizeJson(value as JsonValue);
}

function addIssue(
  issues: DomainEventMaterializationIssue[],
  code: DomainEventMaterializationIssueCode,
  path: string,
  message: string,
  phase?: string
): void {
  issues.push({
    code,
    path,
    message,
    ...(phase !== undefined ? { phase } : {})
  });
}

function mapSafetyIssues(
  issues: DomainEventMaterializationIssue[],
  sourceIssues: readonly { readonly code: string; readonly path: JsonPath; readonly message: string }[],
  prefix = ""
): void {
  for (const issue of sourceIssues) {
    addIssue(
      issues,
      issue.code === "FORBIDDEN_KEY" ? "FORBIDDEN_OBJECT_KEY" : "NON_SERIALIZABLE_VALUE",
      `${prefix}${formatJsonPath(issue.path)}`,
      issue.message
    );
  }
}

function validateTypedReference(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.entityType) &&
    ENTITY_ID_PATTERN.test(value.id) &&
    /^[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,31}$/u.test(value.entityType) &&
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
  if (("id" in value || "entityType" in value) && !validateTypedReference(value)) {
    return false;
  }
  return Object.values(value).every((entry) => validateTypedReferenceTree(entry, seen));
}

function validateSupportedPayload(eventType: string, payload: JsonValue): boolean {
  if (eventType === "core.alpha-opened" || eventType === "core.zeta-opened" || eventType === "core.door-opened" || eventType === "core.door-closed") {
    if (!isRecord(payload)) {
      return false;
    }
    if (!validateTypedReference((payload as Record<string, unknown>).door)) {
      return false;
    }
    const state = (payload as Record<string, unknown>).state;
    if (state !== undefined && state !== "open" && state !== "closed") {
      return false;
    }
    return validateTypedReferenceTree(payload) && !containsForbiddenMetadataKey(payload);
  }
  return false;
}

function containsForbiddenMetadataKey(value: unknown, seen = new Set<unknown>()): boolean {
  if (value === null || typeof value !== "object") {
    return false;
  }
  if (seen.has(value)) {
    return false;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.some((entry) => containsForbiddenMetadataKey(entry, seen));
  }
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_METADATA_KEYS.has(key) || containsForbiddenMetadataKey(entry, seen)) {
      return true;
    }
  }
  return false;
}

function validateTransaction(value: unknown): { readonly transaction?: DomainEventTransaction; readonly issues: readonly DomainEventMaterializationIssue[] } {
  const issues: DomainEventMaterializationIssue[] = [];

  if (!isRecord(value)) {
    addIssue(issues, "INVALID_TRANSACTION_REFERENCE", "/transaction", "transaction must be an object.");
    mapSafetyIssues(issues, inspectJsonSafety(value), "/transaction");
    return { issues };
  }

  mapSafetyIssues(issues, inspectJsonSafety(value), "/transaction");

  for (const key of Object.keys(value)) {
    if (!TRANSACTION_KEYS.has(key)) {
      addIssue(issues, "INVALID_TRANSACTION_REFERENCE", `/transaction/${key}`, `unknown field "${key}" is not allowed.`);
    }
  }

  const statusValue = value.status;
  const transactionIdValue = value.transactionId;
  const baseRevisionValue = value.baseRevision;
  const newRevisionValue = value.newRevision;
  const resultingRevisionValue = value.resultingRevision;
  const sourceValue = value.source;
  const commandIdValue = value.commandId;
  const correlationIdValue = value.correlationId;
  const causationKindValue = value.causationKind;
  const causationIdValue = value.causationId;

  if (!isString(statusValue) || !["committed", "no-op", "rolled-back", "rejected", "error"].includes(statusValue)) {
    addIssue(issues, "INVALID_TRANSACTION_REFERENCE", "/transaction/status", "transaction status is invalid.");
  }

  if (transactionIdValue !== undefined) {
    if (!isString(transactionIdValue)) {
      addIssue(issues, "INVALID_TRANSACTION_REFERENCE", "/transaction/transactionId", "transactionId is invalid.");
    } else if (!ENTITY_ID_PATTERN.test(transactionIdValue)) {
      addIssue(issues, "INVALID_TRANSACTION_REFERENCE", "/transaction/transactionId", "transactionId is invalid.");
    }
  }

  if (!isNonNegativeInteger(baseRevisionValue)) {
    addIssue(issues, "INVALID_TRANSACTION_REFERENCE", "/transaction/baseRevision", "baseRevision is invalid.");
  }

  const newRevision = newRevisionValue ?? resultingRevisionValue;
  if (newRevision !== undefined && !isNonNegativeInteger(newRevision)) {
    addIssue(issues, "INVALID_TRANSACTION_REFERENCE", "/transaction/newRevision", "newRevision is invalid.");
  }
  if (newRevisionValue !== undefined && resultingRevisionValue !== undefined && newRevisionValue !== resultingRevisionValue) {
    addIssue(issues, "INVALID_TRANSACTION_REFERENCE", "/transaction/newRevision", "newRevision and resultingRevision do not match.");
  }

  let source: DomainEventSource | undefined;
  if (sourceValue !== undefined) {
    if (!isRecord(sourceValue)) {
      addIssue(issues, "INVALID_TRANSACTION_REFERENCE", "/transaction/source", "source is invalid.");
    } else {
      for (const key of Object.keys(sourceValue)) {
        if (!TRANSACTION_SOURCE_KEYS.has(key)) {
          addIssue(issues, "INVALID_TRANSACTION_REFERENCE", `/transaction/source/${key}`, `unknown field "${key}" is not allowed.`);
        }
      }
      const sourceKindValue = sourceValue.kind;
      const sourceCommandIdValue = sourceValue.commandId;
      const sourceSystemIdValue = sourceValue.systemId;
      if (!isString(sourceKindValue) || (sourceKindValue !== "command-plan" && sourceKindValue !== "system")) {
        addIssue(issues, "INVALID_TRANSACTION_REFERENCE", "/transaction/source/kind", "source.kind is invalid.");
      }
      if (sourceKindValue === "command-plan" && sourceCommandIdValue !== undefined) {
        if (!isString(sourceCommandIdValue)) {
          addIssue(issues, "INVALID_TRANSACTION_REFERENCE", "/transaction/source/commandId", "source.commandId is invalid.");
        } else if (!ENTITY_ID_PATTERN.test(sourceCommandIdValue)) {
          addIssue(issues, "INVALID_TRANSACTION_REFERENCE", "/transaction/source/commandId", "source.commandId is invalid.");
        }
      }
      if (sourceKindValue === "system" && sourceSystemIdValue !== undefined && !isString(sourceSystemIdValue)) {
        addIssue(issues, "INVALID_TRANSACTION_REFERENCE", "/transaction/source/systemId", "source.systemId is invalid.");
      }
      if (isString(sourceKindValue) && (sourceKindValue === "command-plan" || sourceKindValue === "system")) {
        source = {
          kind: sourceKindValue,
          ...(sourceCommandIdValue !== undefined && isString(sourceCommandIdValue) ? { commandId: sourceCommandIdValue } : {}),
          ...(sourceSystemIdValue !== undefined && isString(sourceSystemIdValue) ? { systemId: sourceSystemIdValue } : {})
        };
      }
    }
  } else {
    addIssue(issues, "INVALID_TRANSACTION_REFERENCE", "/transaction/source", "source is required.");
  }

  if (commandIdValue !== undefined && (!isString(commandIdValue) || !OPAQUE_ID_PATTERN.test(commandIdValue))) {
    addIssue(issues, "INVALID_TRANSACTION_REFERENCE", "/transaction/commandId", "commandId is invalid.");
  }
  if (correlationIdValue !== undefined && (!isString(correlationIdValue) || !OPAQUE_ID_PATTERN.test(correlationIdValue))) {
    addIssue(issues, "INVALID_TRANSACTION_REFERENCE", "/transaction/correlationId", "correlationId is invalid.");
  }
  if (causationKindValue !== undefined && (!isString(causationKindValue) || !["command", "event", "transaction"].includes(causationKindValue))) {
    addIssue(issues, "INVALID_TRANSACTION_REFERENCE", "/transaction/causationKind", "causationKind is invalid.");
  }
  if (causationIdValue !== undefined && (!isString(causationIdValue) || !OPAQUE_ID_PATTERN.test(causationIdValue))) {
    addIssue(issues, "INVALID_TRANSACTION_REFERENCE", "/transaction/causationId", "causationId is invalid.");
  }
  if ((causationIdValue !== undefined) !== (causationKindValue !== undefined)) {
    addIssue(issues, "INVALID_TRANSACTION_REFERENCE", "/transaction/causationId", "causation linkage must be complete.");
  }

  if (issues.length > 0) {
    return { issues };
  }

  return {
    transaction: {
      status: statusValue as TransactionResult["status"],
      ...(transactionIdValue !== undefined ? { transactionId: transactionIdValue as string } : {}),
      baseRevision: baseRevisionValue as number,
      ...(newRevision !== undefined ? { newRevision: newRevision as number } : {}),
      ...(resultingRevisionValue !== undefined ? { resultingRevision: resultingRevisionValue as number } : {}),
      ...(source !== undefined ? { source } : {}),
      ...(commandIdValue !== undefined ? { commandId: commandIdValue as string } : {}),
      ...(correlationIdValue !== undefined ? { correlationId: correlationIdValue as string } : {}),
      ...(causationKindValue !== undefined ? { causationKind: causationKindValue as "command" | "event" | "transaction" } : {}),
      ...(causationIdValue !== undefined ? { causationId: causationIdValue as string } : {})
    },
    issues: []
  };
}

function validateEventEnvelope(
  candidate: unknown,
  prefix = "/candidate"
): { readonly event?: DomainEventEnvelope; readonly issues: readonly DomainEventMaterializationIssue[] } {
  const issues: DomainEventMaterializationIssue[] = [];

  if (!isRecord(candidate)) {
    addIssue(issues, "INVALID_EVENT_SHAPE", prefix, "confirmed event must be an object.");
    mapSafetyIssues(issues, inspectJsonSafety(candidate), prefix);
    return { issues };
  }

  mapSafetyIssues(issues, inspectJsonSafety(candidate), prefix);

  for (const key of Object.keys(candidate)) {
    if (!EVENT_KEYS.has(key)) {
      addIssue(issues, "INVALID_EVENT_SHAPE", `${prefix}/${key}`, `unknown field "${key}" is not allowed.`);
    }
  }

  const contractVersionValue = candidate.contractVersion;
  const schemaIdValue = candidate.schemaId;
  const schemaVersionValue = candidate.schemaVersion;
  const eventIdValue = candidate.eventId;
  const eventTypeValue = candidate.eventType;
  const transactionIdValue = candidate.transactionId;
  const previousRevisionValue = candidate.previousRevision;
  const revisionValue = candidate.revision;
  const sequenceValue = candidate.sequence;
  const commandIdValue = candidate.commandId;
  const correlationIdValue = candidate.correlationId;
  const causationKindValue = candidate.causationKind;
  const causationIdValue = candidate.causationId;
  const payloadValue = candidate.payload;

  if (contractVersionValue !== DOMAIN_EVENT_CONTRACT_VERSION) {
    addIssue(issues, "INVALID_EVENT_SHAPE", `${prefix}/contractVersion`, "contractVersion is invalid.");
  }
  if (schemaIdValue !== DOMAIN_EVENT_SCHEMA_ID) {
    addIssue(issues, "INVALID_EVENT_SHAPE", `${prefix}/schemaId`, "schemaId is invalid.");
  }
  if (schemaVersionValue !== DOMAIN_EVENT_SCHEMA_VERSION) {
    addIssue(issues, "SCHEMA_VERSION_UNSUPPORTED", `${prefix}/schemaVersion`, "Unsupported domain event schema version.");
  }
  if (!isString(eventIdValue) || !ENTITY_ID_PATTERN.test(eventIdValue)) {
    addIssue(issues, "INVALID_EVENT_ID", `${prefix}/eventId`, "eventId is invalid.");
  }
  if (!isString(eventTypeValue) || !EVENT_TYPE_PATTERN.test(eventTypeValue) || !SUPPORTED_EVENT_TYPES.has(eventTypeValue)) {
    addIssue(issues, "UNKNOWN_EVENT_TYPE", `${prefix}/eventType`, "eventType is invalid or unsupported.");
  }
  if (!isString(transactionIdValue) || !ENTITY_ID_PATTERN.test(transactionIdValue)) {
    addIssue(issues, "INVALID_TRANSACTION_REFERENCE", `${prefix}/transactionId`, "transactionId is invalid.");
  }
  if (!isNonNegativeInteger(previousRevisionValue) || !isNonNegativeInteger(revisionValue)) {
    addIssue(issues, "INVALID_REVISION_BOUNDARY", `${prefix}/revision`, "revision boundary is invalid.");
  }
  if (!isNonNegativeInteger(sequenceValue)) {
    addIssue(issues, "INVALID_SEQUENCE", `${prefix}/sequence`, "sequence is invalid.");
  }
  if (commandIdValue !== undefined) {
    if (!isString(commandIdValue)) {
      addIssue(issues, "INVALID_COMMAND_REFERENCE", `${prefix}/commandId`, "commandId is invalid.");
    } else if (!ENTITY_ID_PATTERN.test(commandIdValue)) {
      addIssue(issues, "INVALID_COMMAND_REFERENCE", `${prefix}/commandId`, "commandId is invalid.");
    }
  }
  if (correlationIdValue !== undefined && (!isString(correlationIdValue) || !OPAQUE_ID_PATTERN.test(correlationIdValue))) {
    addIssue(issues, "INVALID_EVENT_SHAPE", `${prefix}/correlationId`, "correlationId is invalid.");
  }
  if (causationKindValue !== undefined && (!isString(causationKindValue) || !["command", "event", "transaction"].includes(causationKindValue))) {
    addIssue(issues, "INVALID_EVENT_SHAPE", `${prefix}/causationKind`, "causationKind is invalid.");
  }
  if (causationIdValue !== undefined && (!isString(causationIdValue) || !OPAQUE_ID_PATTERN.test(causationIdValue))) {
    addIssue(issues, "INVALID_EVENT_SHAPE", `${prefix}/causationId`, "causationId is invalid.");
  }
  if ((causationIdValue !== undefined) !== (causationKindValue !== undefined)) {
    addIssue(issues, "INVALID_EVENT_SHAPE", `${prefix}/causationId`, "causation linkage must be complete.");
  }
  if (payloadValue === undefined) {
    addIssue(issues, "INVALID_EVENT_PAYLOAD", `${prefix}/payload`, "payload is required.");
  } else {
    mapSafetyIssues(issues, inspectJsonSafety(payloadValue), `${prefix}/payload`);
    if (!isRecord(payloadValue) || !validateSupportedPayload(eventTypeValue as string, payloadValue as JsonValue)) {
      addIssue(issues, "INVALID_EVENT_PAYLOAD", `${prefix}/payload`, "payload is invalid.");
    }
  }

  if (issues.length > 0) {
    return { issues };
  }

  return {
    event: {
      contractVersion: DOMAIN_EVENT_CONTRACT_VERSION,
      schemaId: DOMAIN_EVENT_SCHEMA_ID,
      schemaVersion: DOMAIN_EVENT_SCHEMA_VERSION,
      eventId: eventIdValue as string,
      eventType: eventTypeValue as string,
      transactionId: transactionIdValue as string,
      previousRevision: previousRevisionValue as number,
      revision: revisionValue as number,
      sequence: sequenceValue as number,
      ...(commandIdValue !== undefined ? { commandId: commandIdValue as string } : {}),
      ...(correlationIdValue !== undefined ? { correlationId: correlationIdValue as string } : {}),
      ...(causationKindValue !== undefined ? { causationKind: causationKindValue as "command" | "event" | "transaction" } : {}),
      ...(causationIdValue !== undefined ? { causationId: causationIdValue as string } : {}),
      payload: cloneJson(payloadValue as JsonValue)
    },
    issues: []
  };
}

function validateEventBatch(
  candidate: unknown,
  prefix = "/candidate"
): { readonly batch?: DomainEventBatch; readonly issues: readonly DomainEventMaterializationIssue[] } {
  const issues: DomainEventMaterializationIssue[] = [];

  if (!isRecord(candidate)) {
    addIssue(issues, "INVALID_EVENT_SHAPE", prefix, "confirmed event batch must be an object.");
    mapSafetyIssues(issues, inspectJsonSafety(candidate), prefix);
    return { issues };
  }

  mapSafetyIssues(issues, inspectJsonSafety(candidate), prefix);

  for (const key of Object.keys(candidate)) {
    if (!BATCH_KEYS.has(key)) {
      addIssue(issues, "INVALID_EVENT_SHAPE", `${prefix}/${key}`, `unknown field "${key}" is not allowed.`);
    }
  }

  const contractVersionValue = candidate.contractVersion;
  const schemaIdValue = candidate.schemaId;
  const schemaVersionValue = candidate.schemaVersion;
  const transactionIdValue = candidate.transactionId;
  const previousRevisionValue = candidate.previousRevision;
  const revisionValue = candidate.revision;
  const commandIdValue = candidate.commandId;
  const correlationIdValue = candidate.correlationId;
  const causationKindValue = candidate.causationKind;
  const causationIdValue = candidate.causationId;
  const eventsValue = candidate.events as readonly unknown[] | undefined;

  if (contractVersionValue !== DOMAIN_EVENT_CONTRACT_VERSION) {
    addIssue(issues, "INVALID_EVENT_SHAPE", `${prefix}/contractVersion`, "contractVersion is invalid.");
  }
  if (schemaIdValue !== DOMAIN_EVENT_SCHEMA_ID) {
    addIssue(issues, "INVALID_EVENT_SHAPE", `${prefix}/schemaId`, "schemaId is invalid.");
  }
  if (schemaVersionValue !== DOMAIN_EVENT_SCHEMA_VERSION) {
    addIssue(issues, "SCHEMA_VERSION_UNSUPPORTED", `${prefix}/schemaVersion`, "Unsupported domain event schema version.");
  }
  if (!isString(transactionIdValue) || !ENTITY_ID_PATTERN.test(transactionIdValue)) {
    addIssue(issues, "INVALID_TRANSACTION_REFERENCE", `${prefix}/transactionId`, "transactionId is invalid.");
  }
  if (!isNonNegativeInteger(previousRevisionValue) || !isNonNegativeInteger(revisionValue)) {
    addIssue(issues, "INVALID_REVISION_BOUNDARY", `${prefix}/revision`, "revision boundary is invalid.");
  }
  if (!Array.isArray(eventsValue)) {
    addIssue(issues, "INVALID_EVENT_SHAPE", `${prefix}/events`, "events are invalid.");
    return { issues };
  }
  if (eventsValue.length > MAX_EVENTS) {
    addIssue(issues, "EVENT_BUDGET_EXCEEDED", `${prefix}/events`, "event budget exceeded.");
  }
  if (commandIdValue !== undefined && (!isString(commandIdValue) || !ENTITY_ID_PATTERN.test(commandIdValue))) {
    addIssue(issues, "INVALID_COMMAND_REFERENCE", `${prefix}/commandId`, "commandId is invalid.");
  }
  if (correlationIdValue !== undefined && (!isString(correlationIdValue) || !OPAQUE_ID_PATTERN.test(correlationIdValue))) {
    addIssue(issues, "INVALID_EVENT_SHAPE", `${prefix}/correlationId`, "correlationId is invalid.");
  }
  if (causationKindValue !== undefined && (!isString(causationKindValue) || !["command", "event", "transaction"].includes(causationKindValue))) {
    addIssue(issues, "INVALID_EVENT_SHAPE", `${prefix}/causationKind`, "causationKind is invalid.");
  }
  if (causationIdValue !== undefined && (!isString(causationIdValue) || !OPAQUE_ID_PATTERN.test(causationIdValue))) {
    addIssue(issues, "INVALID_EVENT_SHAPE", `${prefix}/causationId`, "causationId is invalid.");
  }
  if ((causationIdValue !== undefined) !== (causationKindValue !== undefined)) {
    addIssue(issues, "INVALID_EVENT_SHAPE", `${prefix}/causationId`, "causation linkage must be complete.");
  }

  const events: DomainEventEnvelope[] = [];
  const eventIds = new Set<string>();
  const sequences = new Set<number>();
  let previousSequence = -1;

  for (let index = 0; index < eventsValue.length; index += 1) {
    const eventResult = validateEventEnvelope(eventsValue[index], `${prefix}/events/${String(index)}`);
    if (eventResult.issues.length > 0) {
      issues.push(...eventResult.issues);
      continue;
    }
    const event = eventResult.event as DomainEventEnvelope;
    if (event.transactionId !== transactionIdValue) {
      addIssue(issues, "INVALID_TRANSACTION_REFERENCE", `${prefix}/events/${String(index)}/transactionId`, "event transactionId does not match batch transactionId.");
    }
    if (commandIdValue !== undefined && event.commandId !== undefined && event.commandId !== commandIdValue) {
      addIssue(issues, "INVALID_COMMAND_REFERENCE", `${prefix}/events/${String(index)}/commandId`, "event commandId does not match batch commandId.");
    }
    if (event.previousRevision !== previousRevisionValue || event.revision !== revisionValue) {
      addIssue(issues, "INVALID_REVISION_BOUNDARY", `${prefix}/events/${String(index)}/revision`, "event revision boundary does not match batch revision boundary.");
    }
    if (event.sequence < previousSequence) {
      addIssue(issues, "INVALID_SEQUENCE", `${prefix}/events/${String(index)}/sequence`, "event sequence is not in canonical order.");
    }
    if (eventIds.has(event.eventId)) {
      addIssue(issues, "DUPLICATE_EVENT_ID", `${prefix}/events/${String(index)}/eventId`, "eventId is duplicated.");
    }
    if (sequences.has(event.sequence)) {
      addIssue(issues, "DUPLICATE_EVENT_SEQUENCE", `${prefix}/events/${String(index)}/sequence`, "event sequence is duplicated.");
    }
    eventIds.add(event.eventId);
    sequences.add(event.sequence);
    previousSequence = event.sequence;
    events.push(event);
  }

  if (issues.length > 0) {
    return { issues };
  }

  return {
    batch: {
      contractVersion: DOMAIN_EVENT_CONTRACT_VERSION,
      schemaId: DOMAIN_EVENT_SCHEMA_ID,
      schemaVersion: DOMAIN_EVENT_SCHEMA_VERSION,
      transactionId: transactionIdValue as string,
      previousRevision: previousRevisionValue as number,
      revision: revisionValue as number,
      ...(commandIdValue !== undefined ? { commandId: commandIdValue as string } : {}),
      ...(correlationIdValue !== undefined ? { correlationId: correlationIdValue as string } : {}),
      ...(causationKindValue !== undefined ? { causationKind: causationKindValue as "command" | "event" | "transaction" } : {}),
      ...(causationIdValue !== undefined ? { causationId: causationIdValue as string } : {}),
      events: events.map((event) => cloneJson(event))
    },
    issues: []
  };
}

function createEmptyBatch(transactionId: string, previousRevision: number, revision: number, batch: DomainEventBatch): DomainEventBatch {
  return {
    contractVersion: DOMAIN_EVENT_CONTRACT_VERSION,
    schemaId: DOMAIN_EVENT_SCHEMA_ID,
    schemaVersion: DOMAIN_EVENT_SCHEMA_VERSION,
    transactionId,
    previousRevision,
    revision,
    ...(batch.commandId !== undefined ? { commandId: batch.commandId } : {}),
    ...(batch.correlationId !== undefined ? { correlationId: batch.correlationId } : {}),
    ...(batch.causationKind !== undefined ? { causationKind: batch.causationKind } : {}),
    ...(batch.causationId !== undefined ? { causationId: batch.causationId } : {}),
    events: []
  };
}

function canonicalBatchText(batch: DomainEventBatch): string {
  return canonicalText(batch);
}

function cloneResult(result: DomainEventMaterializationResult): DomainEventMaterializationResult {
  return cloneJson(result);
}

export function materializeDomainEvents(
  input: unknown,
  options: DomainEventMaterializationOptions = {}
): DomainEventMaterializationResult {
  const issues: DomainEventMaterializationIssue[] = [];
  const maxDiagnostics = options.maxDiagnostics ?? MAX_DIAGNOSTICS;

  if (!isRecord(input)) {
    addIssue(issues, "INVALID_EVENT_SHAPE", "/", "materialization input must be an object.");
    mapSafetyIssues(issues, inspectJsonSafety(input));
    return { status: "error", diagnostics: issues.slice(0, maxDiagnostics) };
  }

  mapSafetyIssues(issues, inspectJsonSafety(input));

  for (const key of Object.keys(input)) {
    if (!INPUT_KEYS.has(key)) {
      addIssue(issues, "INVALID_EVENT_SHAPE", `/${key}`, `unknown field "${key}" is not allowed.`);
    }
  }

  if (!("transaction" in input)) {
    addIssue(issues, "INVALID_EVENT_SHAPE", "/transaction", "transaction is required.");
  }
  if (!("candidate" in input)) {
    addIssue(issues, "INVALID_EVENT_SHAPE", "/candidate", "candidate is required.");
  }

  if (issues.length > 0) {
    return { status: "error", diagnostics: issues.slice(0, maxDiagnostics) };
  }

  const transactionResult = validateTransaction(input.transaction);
  if (transactionResult.issues.length > 0 || transactionResult.transaction === undefined) {
    const diagnostics = [...transactionResult.issues].slice(0, maxDiagnostics);
    return { status: "error", diagnostics };
  }
  const transaction = transactionResult.transaction;

  if (transaction.status !== "committed") {
    return {
      status: "error",
      diagnostics: [
        {
          code: "CONFIRMATION_BOUNDARY_VIOLATION",
          path: "/transaction/status",
          message: "Only committed transactions can materialize confirmed events."
        }
      ]
    };
  }

  const candidate = input.candidate;
  let batch: DomainEventBatch;
  if (isRecord(candidate) && "events" in candidate) {
    const batchResult = validateEventBatch(candidate);
    if (batchResult.issues.length > 0 || batchResult.batch === undefined) {
      return { status: "error", diagnostics: [...batchResult.issues].slice(0, maxDiagnostics) };
    }
    batch = batchResult.batch;
  } else {
    const eventResult = validateEventEnvelope(candidate);
    if (eventResult.issues.length > 0 || eventResult.event === undefined) {
      return { status: "error", diagnostics: [...eventResult.issues].slice(0, maxDiagnostics) };
    }
    batch = createSingleEventBatch(transaction, eventResult.event);
  }

  const committedTransactionId = batch.transactionId;
  if (transaction.transactionId !== undefined && transaction.transactionId !== committedTransactionId) {
    return {
      status: "error",
      diagnostics: [
        {
          code: "INVALID_TRANSACTION_REFERENCE",
          path: "/candidate/transactionId",
          message: "candidate transactionId does not match committed transaction."
        }
      ]
    };
  }

  const committedRevision = transaction.newRevision ?? transaction.resultingRevision;
  if (transaction.baseRevision === undefined || committedRevision === undefined) {
    return {
      status: "error",
      diagnostics: [
        {
          code: "INVALID_TRANSACTION_REFERENCE",
          path: "/transaction/baseRevision",
          message: "transaction revisions are required."
        }
      ]
    };
  }

  if (batch.previousRevision !== transaction.baseRevision || batch.revision !== committedRevision) {
    return {
      status: "error",
      diagnostics: [
        {
          code: "INVALID_REVISION_BOUNDARY",
          path: "/candidate/revision",
          message: "candidate revision boundary does not match committed transaction."
        }
      ]
    };
  }

  if (transaction.source?.kind === "system" && batch.commandId !== undefined) {
    return {
      status: "error",
      diagnostics: [
        {
          code: "INVALID_COMMAND_REFERENCE",
          path: "/candidate/commandId",
          message: "system transactions do not bind a command."
        }
      ]
    };
  }
  if (transaction.source?.kind === "command-plan") {
    const boundCommandId = transaction.commandId ?? transaction.source.commandId;
    if (boundCommandId !== undefined && batch.commandId !== undefined && batch.commandId !== boundCommandId) {
      return {
        status: "error",
        diagnostics: [
          {
            code: "INVALID_COMMAND_REFERENCE",
            path: "/candidate/commandId",
            message: "candidate commandId does not match committed transaction."
          }
        ]
      };
    }
  }

  if (batch.events.length === 0) {
    const emptyBatch = createEmptyBatch(committedTransactionId, transaction.baseRevision, batch.revision, batch);
    const result: DomainEventMaterializationResult = {
      status: "empty",
      batch: emptyBatch,
      events: []
    };
    const historyText = canonicalBatchText(emptyBatch);
    if (options.history !== undefined) {
      const existing = options.history.get(committedTransactionId);
      if (existing !== undefined && existing !== historyText) {
        return {
          status: "error",
          diagnostics: [
            {
              code: "EVENT_MATERIALIZATION_FAILED",
              path: "/transaction/transactionId",
              message: "duplicate transaction materialization conflicts with an existing batch."
            }
          ]
        };
      }
      options.history.set(committedTransactionId, historyText);
    }
    return result;
  }

  const result: DomainEventMaterializationResult = {
    status: "materialized",
    batch: {
      contractVersion: DOMAIN_EVENT_CONTRACT_VERSION,
      schemaId: DOMAIN_EVENT_SCHEMA_ID,
      schemaVersion: DOMAIN_EVENT_SCHEMA_VERSION,
      transactionId: committedTransactionId,
      previousRevision: transaction.baseRevision,
      revision: batch.revision,
      ...(batch.commandId !== undefined ? { commandId: batch.commandId } : {}),
      ...(batch.correlationId !== undefined ? { correlationId: batch.correlationId } : {}),
      ...(batch.causationKind !== undefined ? { causationKind: batch.causationKind } : {}),
      ...(batch.causationId !== undefined ? { causationId: batch.causationId } : {}),
      events: batch.events.map((event) => cloneJson(event))
    },
    events: batch.events.map((event) => cloneJson(event))
  };

  if (options.history !== undefined) {
    const historyText = canonicalBatchText(result.batch);
    const existing = options.history.get(committedTransactionId);
    if (existing !== undefined) {
      if (existing !== historyText) {
        return {
          status: "error",
          diagnostics: [
            {
              code: "EVENT_MATERIALIZATION_FAILED",
              path: "/transaction/transactionId",
              message: "duplicate transaction materialization conflicts with an existing batch."
            }
          ]
        };
      }
      return cloneResult(result);
    }
    options.history.set(committedTransactionId, historyText);
  }

  return result;
}

function createSingleEventBatch(transaction: DomainEventTransaction, event: DomainEventEnvelope): DomainEventBatch {
  return {
    contractVersion: DOMAIN_EVENT_CONTRACT_VERSION,
    schemaId: DOMAIN_EVENT_SCHEMA_ID,
    schemaVersion: DOMAIN_EVENT_SCHEMA_VERSION,
    transactionId: event.transactionId,
    previousRevision: transaction.baseRevision as number,
    revision: transaction.newRevision ?? transaction.resultingRevision ?? event.revision,
    ...(event.commandId !== undefined ? { commandId: event.commandId } : {}),
    ...(event.correlationId !== undefined ? { correlationId: event.correlationId } : {}),
    ...(event.causationKind !== undefined ? { causationKind: event.causationKind } : {}),
    ...(event.causationId !== undefined ? { causationId: event.causationId } : {}),
    events: [cloneJson(event)]
  };
}
