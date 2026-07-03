import {
  formatJsonPath,
  inspectJsonSafety,
  type JsonPath,
  type JsonPathSegment,
  type JsonValue
} from "@narrative-engine/core";

import {
  formatEngineStateValidationMessage,
  inspectEngineStateSnapshot,
  type EngineStateSnapshot
} from "../engine-state/engine-state.js";

export const PERSISTENCE_STATUSES = ["saved", "appended", "loaded", "rejected", "blocked", "error"] as const;

export type PersistenceStatus = (typeof PERSISTENCE_STATUSES)[number];

export type PersistenceDiagnostic = {
  readonly code: string;
  readonly path: JsonPath;
  readonly message: string;
  readonly details?: JsonValue;
};

export type PersistenceResultMetadata = {
  readonly deterministic: true;
  readonly persistence: "memory" | "none";
  readonly source: "persistence-boundary" | "event-store" | "save-snapshot-store";
  readonly operation:
    | "append-events"
    | "list-events"
    | "get-event"
    | "save-snapshot"
    | "load-snapshot"
    | "list-snapshots";
  readonly idempotent?: true;
  readonly recordCount?: number;
  readonly snapshotId?: string;
};

export type PersistenceEventRecordMetadata = {
  readonly deterministic: true;
  readonly persistence: "memory" | "future-storage";
  readonly source: "runtime-host" | "event-store";
  readonly createdAtPolicy: "explicit" | "logical";
  readonly runtimeVersion?: string;
  readonly contentPackageId?: string;
  readonly idempotencyKey?: string;
};

export type PersistenceEventRecord = {
  readonly eventId: string;
  readonly eventType: string;
  readonly sourceCommandId: string;
  readonly transactionId?: string;
  readonly revision: number;
  readonly schemaVersion: number;
  readonly payload?: JsonValue;
  readonly metadata: PersistenceEventRecordMetadata;
};

export type PersistenceEventEnvelope = {
  readonly records: readonly PersistenceEventRecord[];
  readonly metadata: {
    readonly deterministic: true;
    readonly persistence: "memory" | "future-storage";
    readonly source: "event-store";
    readonly batchId?: string;
  };
};

export type PersistenceEventRange = {
  readonly fromRevision: number;
  readonly toRevision: number;
};

export type PersistenceSnapshotRecordMetadata = {
  readonly deterministic: true;
  readonly persistence: "memory" | "future-storage";
  readonly source: "save-snapshot-store";
  readonly runtimeVersion: string;
  readonly contentPackageVersion?: string;
};

export type PersistenceSnapshotRecord = {
  readonly snapshotId: string;
  readonly stateId: string;
  readonly revision: number;
  readonly contentPackageId: string;
  readonly sourceEventRange?: PersistenceEventRange;
  readonly checksum?: string;
  readonly state: EngineStateSnapshot;
  readonly metadata: PersistenceSnapshotRecordMetadata;
};

export type PersistenceSnapshotEnvelope = {
  readonly snapshots: readonly PersistenceSnapshotRecord[];
  readonly metadata: {
    readonly deterministic: true;
    readonly persistence: "memory" | "future-storage";
    readonly source: "save-snapshot-store";
  };
};

export type PersistenceAppendEventsInput = {
  readonly envelope: PersistenceEventEnvelope;
};

export type PersistenceSaveSnapshotInput = {
  readonly snapshot: PersistenceSnapshotRecord;
};

export type PersistenceLoadSnapshotInput = {
  readonly snapshotId: string;
};

export type PersistenceResult = {
  readonly status: PersistenceStatus;
  readonly diagnostics: readonly PersistenceDiagnostic[];
  readonly metadata: PersistenceResultMetadata;
  readonly eventEnvelope?: PersistenceEventEnvelope;
  readonly snapshotEnvelope?: PersistenceSnapshotEnvelope;
  readonly snapshot?: PersistenceSnapshotRecord;
};

export class PersistenceValidationError extends TypeError {
  public readonly diagnostics: readonly PersistenceDiagnostic[];

  public constructor(diagnostics: readonly PersistenceDiagnostic[]) {
    super(formatPersistenceValidationMessage(diagnostics));
    this.name = "PersistenceValidationError";
    this.diagnostics = diagnostics;
  }
}

const EVENT_ID_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+){2,}$/u;
const EVENT_TYPE_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+$/u;
const COMMAND_ID_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+){2,}$/u;
const TRANSACTION_ID_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+){2,}$/u;
const SNAPSHOT_ID_PATTERN = /^snapshot\.[a-z][a-z0-9-]{1,63}\.[a-z0-9][a-z0-9._-]{0,79}$/u;
const PACKAGE_ID_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+$/u;
const RUNTIME_VERSION_PATTERN = /^[a-z][a-z0-9-]*(?:@[0-9]+\.[0-9]+\.[0-9]+(?:-[a-z0-9.-]+)?)?$/u;
const CHECKSUM_PATTERN = /^[A-Za-z0-9:_-]{3,160}$/u;
const SIMPLE_TEXT_PATTERN = /^[A-Za-z0-9._:@/-]+$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function cloneJsonValue<T extends JsonValue>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createDiagnostic(
  code: string,
  path: readonly JsonPathSegment[],
  message: string,
  details?: JsonValue
): PersistenceDiagnostic {
  return {
    code,
    path: [...path],
    message,
    ...(details === undefined ? {} : { details: cloneJsonValue(details) })
  };
}

function comparePath(left: JsonPath, right: JsonPath): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftSegment = left[index];
    const rightSegment = right[index];
    if (leftSegment === rightSegment) {
      continue;
    }
    const leftType = typeof leftSegment;
    const rightType = typeof rightSegment;
    if (leftType !== rightType) {
      return leftType === "number" ? -1 : 1;
    }
    if (typeof leftSegment === "number" && typeof rightSegment === "number") {
      return leftSegment - rightSegment;
    }
    return String(leftSegment).localeCompare(String(rightSegment));
  }
  return left.length - right.length;
}

function sortDiagnostics(diagnostics: readonly PersistenceDiagnostic[]): readonly PersistenceDiagnostic[] {
  return diagnostics
    .map((diagnostic, index) => ({ diagnostic, index }))
    .sort((left, right) => {
      const pathComparison = comparePath(left.diagnostic.path, right.diagnostic.path);
      if (pathComparison !== 0) {
        return pathComparison;
      }
      const codeComparison = left.diagnostic.code.localeCompare(right.diagnostic.code);
      if (codeComparison !== 0) {
        return codeComparison;
      }
      const messageComparison = left.diagnostic.message.localeCompare(right.diagnostic.message);
      if (messageComparison !== 0) {
        return messageComparison;
      }
      return left.index - right.index;
    })
    .map(({ diagnostic }) => diagnostic);
}

function mapJsonSafetyDiagnostics(
  sourceIssues: ReturnType<typeof inspectJsonSafety>,
  prefix: readonly JsonPathSegment[] = []
): readonly PersistenceDiagnostic[] {
  return sourceIssues.map((issue) =>
    createDiagnostic(
      issue.code === "FORBIDDEN_KEY" ? "PERSISTENCE_FORBIDDEN_KEY" : "PERSISTENCE_NON_JSON_VALUE",
      [...prefix, ...issue.path],
      issue.message
    )
  );
}

function validateStringField(
  diagnostics: PersistenceDiagnostic[],
  value: unknown,
  path: readonly JsonPathSegment[],
  pattern: RegExp,
  code: string,
  message: string
): value is string {
  if (typeof value !== "string" || !pattern.test(value)) {
    diagnostics.push(createDiagnostic(code, path, message));
    return false;
  }
  return true;
}

function validateEventRecord(value: unknown, path: readonly JsonPathSegment[]): readonly PersistenceDiagnostic[] {
  const diagnostics: PersistenceDiagnostic[] = [];
  if (!isRecord(value)) {
    diagnostics.push(createDiagnostic("PERSISTENCE_EVENT_RECORD_INVALID", path, "event record must be an object."));
    return diagnostics;
  }

  diagnostics.push(...mapJsonSafetyDiagnostics(inspectJsonSafety(value), path));

  validateStringField(diagnostics, value.eventId, [...path, "eventId"], EVENT_ID_PATTERN, "PERSISTENCE_EVENT_RECORD_INVALID", "eventId is invalid.");
  validateStringField(diagnostics, value.eventType, [...path, "eventType"], EVENT_TYPE_PATTERN, "PERSISTENCE_EVENT_RECORD_INVALID", "eventType is invalid.");
  validateStringField(diagnostics, value.sourceCommandId, [...path, "sourceCommandId"], COMMAND_ID_PATTERN, "PERSISTENCE_EVENT_RECORD_INVALID", "sourceCommandId is invalid.");

  if (value.transactionId !== undefined) {
    validateStringField(diagnostics, value.transactionId, [...path, "transactionId"], TRANSACTION_ID_PATTERN, "PERSISTENCE_EVENT_RECORD_INVALID", "transactionId is invalid.");
  }
  if (!isPositiveInteger(value.revision)) {
    diagnostics.push(createDiagnostic("PERSISTENCE_EVENT_RECORD_INVALID", [...path, "revision"], "revision must be a positive integer."));
  }
  if (!isPositiveInteger(value.schemaVersion)) {
    diagnostics.push(createDiagnostic("PERSISTENCE_EVENT_RECORD_INVALID", [...path, "schemaVersion"], "schemaVersion must be a positive integer."));
  }
  diagnostics.push(...mapJsonSafetyDiagnostics(inspectJsonSafety(value.payload), [...path, "payload"]));

  if (!isRecord(value.metadata)) {
    diagnostics.push(createDiagnostic("PERSISTENCE_EVENT_RECORD_INVALID", [...path, "metadata"], "metadata must be an object."));
    return sortDiagnostics(diagnostics);
  }

  if (value.metadata.deterministic !== true) {
    diagnostics.push(createDiagnostic("PERSISTENCE_EVENT_RECORD_INVALID", [...path, "metadata", "deterministic"], "metadata.deterministic must be true."));
  }
  if (value.metadata.persistence !== "memory" && value.metadata.persistence !== "future-storage") {
    diagnostics.push(createDiagnostic("PERSISTENCE_EVENT_RECORD_INVALID", [...path, "metadata", "persistence"], 'metadata.persistence must be "memory" or "future-storage".'));
  }
  if (value.metadata.source !== "runtime-host" && value.metadata.source !== "event-store") {
    diagnostics.push(createDiagnostic("PERSISTENCE_EVENT_RECORD_INVALID", [...path, "metadata", "source"], 'metadata.source must be "runtime-host" or "event-store".'));
  }
  if (value.metadata.createdAtPolicy !== "explicit" && value.metadata.createdAtPolicy !== "logical") {
    diagnostics.push(createDiagnostic("PERSISTENCE_EVENT_RECORD_INVALID", [...path, "metadata", "createdAtPolicy"], 'metadata.createdAtPolicy must be "explicit" or "logical".'));
  }
  if (value.metadata.runtimeVersion !== undefined) {
    validateStringField(diagnostics, value.metadata.runtimeVersion, [...path, "metadata", "runtimeVersion"], RUNTIME_VERSION_PATTERN, "PERSISTENCE_EVENT_RECORD_INVALID", "metadata.runtimeVersion is invalid.");
  }
  if (value.metadata.contentPackageId !== undefined) {
    validateStringField(diagnostics, value.metadata.contentPackageId, [...path, "metadata", "contentPackageId"], PACKAGE_ID_PATTERN, "PERSISTENCE_EVENT_RECORD_INVALID", "metadata.contentPackageId is invalid.");
  }
  if (value.metadata.idempotencyKey !== undefined) {
    validateStringField(diagnostics, value.metadata.idempotencyKey, [...path, "metadata", "idempotencyKey"], SIMPLE_TEXT_PATTERN, "PERSISTENCE_EVENT_RECORD_INVALID", "metadata.idempotencyKey is invalid.");
  }

  return sortDiagnostics(diagnostics);
}

function validateSnapshotRecord(value: unknown, path: readonly JsonPathSegment[]): readonly PersistenceDiagnostic[] {
  const diagnostics: PersistenceDiagnostic[] = [];
  if (!isRecord(value)) {
    diagnostics.push(createDiagnostic("PERSISTENCE_SNAPSHOT_RECORD_INVALID", path, "snapshot record must be an object."));
    return diagnostics;
  }

  diagnostics.push(...mapJsonSafetyDiagnostics(inspectJsonSafety(value), path));

  validateStringField(diagnostics, value.snapshotId, [...path, "snapshotId"], SNAPSHOT_ID_PATTERN, "PERSISTENCE_SNAPSHOT_RECORD_INVALID", "snapshotId is invalid.");
  if (typeof value.stateId !== "string") {
    diagnostics.push(createDiagnostic("PERSISTENCE_SNAPSHOT_RECORD_INVALID", [...path, "stateId"], "stateId is invalid."));
  }
  if (!isPositiveInteger(value.revision)) {
    diagnostics.push(createDiagnostic("PERSISTENCE_SNAPSHOT_RECORD_INVALID", [...path, "revision"], "revision must be a positive integer."));
  }
  validateStringField(diagnostics, value.contentPackageId, [...path, "contentPackageId"], PACKAGE_ID_PATTERN, "PERSISTENCE_SNAPSHOT_RECORD_INVALID", "contentPackageId is invalid.");

  if (value.sourceEventRange !== undefined) {
    if (!isRecord(value.sourceEventRange)) {
      diagnostics.push(createDiagnostic("PERSISTENCE_SNAPSHOT_RECORD_INVALID", [...path, "sourceEventRange"], "sourceEventRange must be an object when present."));
    } else {
      if (!isNonNegativeInteger(value.sourceEventRange.fromRevision)) {
        diagnostics.push(createDiagnostic("PERSISTENCE_SNAPSHOT_RECORD_INVALID", [...path, "sourceEventRange", "fromRevision"], "fromRevision must be a non-negative integer."));
      }
      if (!isNonNegativeInteger(value.sourceEventRange.toRevision)) {
        diagnostics.push(createDiagnostic("PERSISTENCE_SNAPSHOT_RECORD_INVALID", [...path, "sourceEventRange", "toRevision"], "toRevision must be a non-negative integer."));
      }
      if (
        isNonNegativeInteger(value.sourceEventRange.fromRevision) &&
        isNonNegativeInteger(value.sourceEventRange.toRevision) &&
        value.sourceEventRange.fromRevision > value.sourceEventRange.toRevision
      ) {
        diagnostics.push(createDiagnostic("PERSISTENCE_SNAPSHOT_RECORD_INVALID", [...path, "sourceEventRange"], "sourceEventRange must be ordered fromRevision <= toRevision."));
      }
    }
  }

  if (value.checksum !== undefined) {
    validateStringField(diagnostics, value.checksum, [...path, "checksum"], CHECKSUM_PATTERN, "PERSISTENCE_SNAPSHOT_RECORD_INVALID", "checksum is invalid.");
  }

  const stateDiagnostics = inspectEngineStateSnapshot(value.state);
  diagnostics.push(
    ...stateDiagnostics.map((issue) =>
      createDiagnostic(
        "PERSISTENCE_SNAPSHOT_RECORD_INVALID",
        [...path, "state", ...issue.path],
        issue.message
      )
    )
  );

  if (isRecord(value.state)) {
    if (typeof value.state.stateId === "string" && typeof value.stateId === "string" && value.state.stateId !== value.stateId) {
      diagnostics.push(createDiagnostic("PERSISTENCE_SNAPSHOT_RECORD_INVALID", [...path, "stateId"], "stateId must match state.stateId."));
    }
    if (typeof value.state.revision === "number" && typeof value.revision === "number" && value.state.revision !== value.revision) {
      diagnostics.push(createDiagnostic("PERSISTENCE_SNAPSHOT_RECORD_INVALID", [...path, "revision"], "revision must match state.revision."));
    }
  }

  if (!isRecord(value.metadata)) {
    diagnostics.push(createDiagnostic("PERSISTENCE_SNAPSHOT_RECORD_INVALID", [...path, "metadata"], "metadata must be an object."));
    return sortDiagnostics(diagnostics);
  }

  if (value.metadata.deterministic !== true) {
    diagnostics.push(createDiagnostic("PERSISTENCE_SNAPSHOT_RECORD_INVALID", [...path, "metadata", "deterministic"], "metadata.deterministic must be true."));
  }
  if (value.metadata.persistence !== "memory" && value.metadata.persistence !== "future-storage") {
    diagnostics.push(createDiagnostic("PERSISTENCE_SNAPSHOT_RECORD_INVALID", [...path, "metadata", "persistence"], 'metadata.persistence must be "memory" or "future-storage".'));
  }
  if (value.metadata.source !== "save-snapshot-store") {
    diagnostics.push(createDiagnostic("PERSISTENCE_SNAPSHOT_RECORD_INVALID", [...path, "metadata", "source"], 'metadata.source must be "save-snapshot-store".'));
  }
  validateStringField(diagnostics, value.metadata.runtimeVersion, [...path, "metadata", "runtimeVersion"], RUNTIME_VERSION_PATTERN, "PERSISTENCE_SNAPSHOT_RECORD_INVALID", "metadata.runtimeVersion is invalid.");
  if (value.metadata.contentPackageVersion !== undefined) {
    validateStringField(diagnostics, value.metadata.contentPackageVersion, [...path, "metadata", "contentPackageVersion"], SIMPLE_TEXT_PATTERN, "PERSISTENCE_SNAPSHOT_RECORD_INVALID", "metadata.contentPackageVersion is invalid.");
  }

  return sortDiagnostics(diagnostics);
}

export function isPersistenceStatus(value: unknown): value is PersistenceStatus {
  return typeof value === "string" && PERSISTENCE_STATUSES.includes(value as PersistenceStatus);
}

export function inspectPersistenceEventRecord(value: unknown): readonly PersistenceDiagnostic[] {
  return validateEventRecord(value, []);
}

export function inspectPersistenceEventEnvelope(value: unknown): readonly PersistenceDiagnostic[] {
  const diagnostics: PersistenceDiagnostic[] = [];
  if (!isRecord(value)) {
    diagnostics.push(createDiagnostic("PERSISTENCE_EVENT_ENVELOPE_INVALID", [], "event envelope must be an object."));
    return diagnostics;
  }

  diagnostics.push(...mapJsonSafetyDiagnostics(inspectJsonSafety(value)));

  if (!Array.isArray(value.records)) {
    diagnostics.push(createDiagnostic("PERSISTENCE_EVENT_ENVELOPE_INVALID", ["records"], "records must be an array."));
  } else {
    const records = value.records as readonly unknown[];
    const seenEventIds = new Set<string>();
    for (let index = 0; index < records.length; index += 1) {
      const record = records[index];
      diagnostics.push(...validateEventRecord(record, ["records", index]));
      if (isRecord(record) && typeof record.eventId === "string") {
        if (seenEventIds.has(record.eventId)) {
          diagnostics.push(createDiagnostic("PERSISTENCE_EVENT_DUPLICATE_ID", ["records", index, "eventId"], "eventId must be unique within one envelope."));
        }
        seenEventIds.add(record.eventId);
      }
    }
  }

  if (!isRecord(value.metadata)) {
    diagnostics.push(createDiagnostic("PERSISTENCE_EVENT_ENVELOPE_INVALID", ["metadata"], "metadata must be an object."));
  } else {
    if (value.metadata.deterministic !== true) {
      diagnostics.push(createDiagnostic("PERSISTENCE_EVENT_ENVELOPE_INVALID", ["metadata", "deterministic"], "metadata.deterministic must be true."));
    }
    if (value.metadata.persistence !== "memory" && value.metadata.persistence !== "future-storage") {
      diagnostics.push(createDiagnostic("PERSISTENCE_EVENT_ENVELOPE_INVALID", ["metadata", "persistence"], 'metadata.persistence must be "memory" or "future-storage".'));
    }
    if (value.metadata.source !== "event-store") {
      diagnostics.push(createDiagnostic("PERSISTENCE_EVENT_ENVELOPE_INVALID", ["metadata", "source"], 'metadata.source must be "event-store".'));
    }
    if (value.metadata.batchId !== undefined) {
      validateStringField(diagnostics, value.metadata.batchId, ["metadata", "batchId"], SIMPLE_TEXT_PATTERN, "PERSISTENCE_EVENT_ENVELOPE_INVALID", "metadata.batchId is invalid.");
    }
  }

  return sortDiagnostics(diagnostics);
}

export function inspectPersistenceSnapshotRecord(value: unknown): readonly PersistenceDiagnostic[] {
  return validateSnapshotRecord(value, []);
}

export function inspectPersistenceSnapshotEnvelope(value: unknown): readonly PersistenceDiagnostic[] {
  const diagnostics: PersistenceDiagnostic[] = [];
  if (!isRecord(value)) {
    diagnostics.push(createDiagnostic("PERSISTENCE_SNAPSHOT_ENVELOPE_INVALID", [], "snapshot envelope must be an object."));
    return diagnostics;
  }

  diagnostics.push(...mapJsonSafetyDiagnostics(inspectJsonSafety(value)));

  if (!Array.isArray(value.snapshots)) {
    diagnostics.push(createDiagnostic("PERSISTENCE_SNAPSHOT_ENVELOPE_INVALID", ["snapshots"], "snapshots must be an array."));
  } else {
    const snapshots = value.snapshots as readonly unknown[];
    const seenSnapshotIds = new Set<string>();
    for (let index = 0; index < snapshots.length; index += 1) {
      const snapshot = snapshots[index];
      diagnostics.push(...validateSnapshotRecord(snapshot, ["snapshots", index]));
      if (isRecord(snapshot) && typeof snapshot.snapshotId === "string") {
        if (seenSnapshotIds.has(snapshot.snapshotId)) {
          diagnostics.push(createDiagnostic("PERSISTENCE_SNAPSHOT_DUPLICATE_ID", ["snapshots", index, "snapshotId"], "snapshotId must be unique within one envelope."));
        }
        seenSnapshotIds.add(snapshot.snapshotId);
      }
    }
  }

  if (!isRecord(value.metadata)) {
    diagnostics.push(createDiagnostic("PERSISTENCE_SNAPSHOT_ENVELOPE_INVALID", ["metadata"], "metadata must be an object."));
  } else {
    if (value.metadata.deterministic !== true) {
      diagnostics.push(createDiagnostic("PERSISTENCE_SNAPSHOT_ENVELOPE_INVALID", ["metadata", "deterministic"], "metadata.deterministic must be true."));
    }
    if (value.metadata.persistence !== "memory" && value.metadata.persistence !== "future-storage") {
      diagnostics.push(createDiagnostic("PERSISTENCE_SNAPSHOT_ENVELOPE_INVALID", ["metadata", "persistence"], 'metadata.persistence must be "memory" or "future-storage".'));
    }
    if (value.metadata.source !== "save-snapshot-store") {
      diagnostics.push(createDiagnostic("PERSISTENCE_SNAPSHOT_ENVELOPE_INVALID", ["metadata", "source"], 'metadata.source must be "save-snapshot-store".'));
    }
  }

  return sortDiagnostics(diagnostics);
}

export function assertPersistenceEventEnvelope(value: unknown): asserts value is PersistenceEventEnvelope {
  const diagnostics = inspectPersistenceEventEnvelope(value);
  if (diagnostics.length > 0) {
    throw new PersistenceValidationError(diagnostics);
  }
}

export function assertPersistenceSnapshotRecord(value: unknown): asserts value is PersistenceSnapshotRecord {
  const diagnostics = inspectPersistenceSnapshotRecord(value);
  if (diagnostics.length > 0) {
    throw new PersistenceValidationError(diagnostics);
  }
}

export function formatPersistenceValidationMessage(diagnostics: readonly PersistenceDiagnostic[]): string {
  const firstDiagnostic = diagnostics[0];
  if (firstDiagnostic === undefined) {
    return "Persistence value is valid.";
  }

  return `${firstDiagnostic.code} @ ${formatJsonPath(firstDiagnostic.path)}: ${firstDiagnostic.message}`;
}

export function createPersistenceResult(input: {
  readonly status: PersistenceStatus;
  readonly metadata: PersistenceResultMetadata;
  readonly diagnostics?: readonly PersistenceDiagnostic[];
  readonly eventEnvelope?: PersistenceEventEnvelope;
  readonly snapshotEnvelope?: PersistenceSnapshotEnvelope;
  readonly snapshot?: PersistenceSnapshotRecord;
}): PersistenceResult {
  const result: PersistenceResult = {
    status: input.status,
    metadata: cloneValue(input.metadata),
    diagnostics: sortDiagnostics((input.diagnostics ?? []).map((diagnostic) => cloneValue(diagnostic)))
  };

  if (input.eventEnvelope !== undefined) {
    return {
      ...result,
      eventEnvelope: cloneValue(input.eventEnvelope)
    };
  }

  if (input.snapshotEnvelope !== undefined || input.snapshot !== undefined) {
    return {
      ...result,
      ...(input.snapshotEnvelope === undefined ? {} : { snapshotEnvelope: cloneValue(input.snapshotEnvelope) }),
      ...(input.snapshot === undefined ? {} : { snapshot: cloneValue(input.snapshot) })
    };
  }

  return result;
}

export function validatePersistenceSnapshotState(value: unknown): readonly PersistenceDiagnostic[] {
  const issues = inspectEngineStateSnapshot(value);
  if (issues.length === 0) {
    return [];
  }
  return issues.map((issue) =>
    createDiagnostic("PERSISTENCE_SNAPSHOT_STATE_INVALID", ["state", ...issue.path], issue.message)
  );
}

export function formatPersistenceSnapshotStateMessage(value: unknown): string {
  const issues = inspectEngineStateSnapshot(value);
  return issues.length === 0 ? "Persistence snapshot state is valid." : formatEngineStateValidationMessage(issues);
}
