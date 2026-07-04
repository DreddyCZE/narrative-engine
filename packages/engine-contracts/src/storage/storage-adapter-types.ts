import {
  formatJsonPath,
  inspectJsonSafety,
  type JsonPath,
  type JsonPathSegment,
  type JsonValue
} from "@narrative-engine/core";

import {
  inspectPersistenceEventEnvelope,
  inspectPersistenceSnapshotRecord,
  type PersistenceEventEnvelope,
  type PersistenceEventRange,
  type PersistenceSnapshotRecord
} from "../persistence/persistence-types.js";

export const STORAGE_ADAPTER_KINDS = ["memory", "file", "database"] as const;
export type StorageAdapterKind = (typeof STORAGE_ADAPTER_KINDS)[number];

export const STORAGE_OPERATION_STATUSES = ["completed", "rejected", "blocked", "error"] as const;
export type StorageOperationStatus = (typeof STORAGE_OPERATION_STATUSES)[number];

export const STORAGE_OPERATION_KINDS = [
  "append-events",
  "list-events",
  "read-events",
  "save-snapshot",
  "load-snapshot",
  "health-check"
] as const;
export type StorageOperationKind = (typeof STORAGE_OPERATION_KINDS)[number];

export type StorageAdapterCapability = {
  readonly operation: StorageOperationKind;
  readonly batch?: true;
  readonly idempotent?: true;
  readonly persistent?: true;
};

export type StorageAdapterDiagnostic = {
  readonly code: string;
  readonly path: JsonPath;
  readonly message: string;
  readonly details?: JsonValue;
};

export type StorageAdapterMetadata = {
  readonly deterministic: true;
  readonly adapterKind: StorageAdapterKind;
  readonly operation: StorageOperationKind;
  readonly persistent: boolean;
  readonly schemaVersion: number;
  readonly supportsIdempotency?: true;
  readonly recordCount?: number;
  readonly snapshotId?: string;
};

export type StorageOperationResult = {
  readonly status: StorageOperationStatus;
  readonly diagnostics: readonly StorageAdapterDiagnostic[];
  readonly metadata: StorageAdapterMetadata;
  readonly eventEnvelope?: PersistenceEventEnvelope;
  readonly snapshot?: PersistenceSnapshotRecord;
  readonly recordsRead?: readonly string[];
};

export type StorageAppendEventsInput = {
  readonly adapterKind: StorageAdapterKind;
  readonly expectedSchemaVersion: number;
  readonly envelope: PersistenceEventEnvelope;
};

export type StorageReadEventsInput = {
  readonly adapterKind: StorageAdapterKind;
  readonly eventIds?: readonly string[];
  readonly revisionRange?: PersistenceEventRange;
};

export type StorageSaveSnapshotInput = {
  readonly adapterKind: StorageAdapterKind;
  readonly expectedSchemaVersion: number;
  readonly snapshot: PersistenceSnapshotRecord;
};

export type StorageLoadSnapshotInput = {
  readonly adapterKind: StorageAdapterKind;
  readonly snapshotId: string;
  readonly stateId?: string;
};

export type StorageAdapterContract = {
  readonly kind: StorageAdapterKind;
  readonly capabilities: readonly StorageAdapterCapability[];
  readonly deterministic: true;
  readonly persistent: boolean;
  readonly schemaVersion: number;
};

export class StorageAdapterValidationError extends TypeError {
  public readonly diagnostics: readonly StorageAdapterDiagnostic[];

  public constructor(diagnostics: readonly StorageAdapterDiagnostic[]) {
    super(formatStorageAdapterValidationMessage(diagnostics));
    this.name = "StorageAdapterValidationError";
    this.diagnostics = diagnostics;
  }
}

const SIMPLE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{1,159}$/u;
const SNAPSHOT_ID_PATTERN = /^snapshot\.[A-Za-z0-9][A-Za-z0-9._:@/-]{1,159}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createDiagnostic(
  code: string,
  path: readonly JsonPathSegment[],
  message: string,
  details?: JsonValue
): StorageAdapterDiagnostic {
  return {
    code,
    path: [...path],
    message,
    ...(details === undefined ? {} : { details: cloneValue(details) })
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

function sortDiagnostics(diagnostics: readonly StorageAdapterDiagnostic[]): readonly StorageAdapterDiagnostic[] {
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
  issues: ReturnType<typeof inspectJsonSafety>,
  prefix: readonly JsonPathSegment[] = []
): readonly StorageAdapterDiagnostic[] {
  return issues.map((issue) =>
    createDiagnostic(
      issue.code === "FORBIDDEN_KEY" ? "STORAGE_FORBIDDEN_KEY" : "STORAGE_NON_JSON_VALUE",
      [...prefix, ...issue.path],
      issue.message
    )
  );
}

function validateAdapterKind(
  diagnostics: StorageAdapterDiagnostic[],
  value: unknown,
  path: readonly JsonPathSegment[]
): value is StorageAdapterKind {
  if (!isStorageAdapterKind(value)) {
    diagnostics.push(createDiagnostic("STORAGE_ADAPTER_KIND_INVALID", path, "adapterKind is invalid."));
    return false;
  }
  return true;
}

function validateSimpleId(
  diagnostics: StorageAdapterDiagnostic[],
  value: unknown,
  path: readonly JsonPathSegment[],
  code: string,
  fieldName: string
): value is string {
  if (typeof value !== "string" || !SIMPLE_ID_PATTERN.test(value)) {
    diagnostics.push(createDiagnostic(code, path, `${fieldName} is invalid.`));
    return false;
  }
  return true;
}

export function isStorageAdapterKind(value: unknown): value is StorageAdapterKind {
  return typeof value === "string" && STORAGE_ADAPTER_KINDS.includes(value as StorageAdapterKind);
}

export function isStorageOperationStatus(value: unknown): value is StorageOperationStatus {
  return typeof value === "string" && STORAGE_OPERATION_STATUSES.includes(value as StorageOperationStatus);
}

export function isStorageOperationKind(value: unknown): value is StorageOperationKind {
  return typeof value === "string" && STORAGE_OPERATION_KINDS.includes(value as StorageOperationKind);
}

export function inspectStorageAppendEventsInput(value: unknown): readonly StorageAdapterDiagnostic[] {
  const diagnostics: StorageAdapterDiagnostic[] = [];
  if (!isRecord(value)) {
    diagnostics.push(createDiagnostic("STORAGE_APPEND_INPUT_INVALID", [], "append-events input must be an object."));
    return diagnostics;
  }

  diagnostics.push(...mapJsonSafetyDiagnostics(inspectJsonSafety(value)));
  validateAdapterKind(diagnostics, value.adapterKind, ["adapterKind"]);
  if (!isPositiveInteger(value.expectedSchemaVersion)) {
    diagnostics.push(createDiagnostic("STORAGE_APPEND_INPUT_INVALID", ["expectedSchemaVersion"], "expectedSchemaVersion must be a positive integer."));
  }
  diagnostics.push(
    ...inspectPersistenceEventEnvelope(value.envelope).map((diagnostic) =>
      createDiagnostic(diagnostic.code, ["envelope", ...diagnostic.path], diagnostic.message, diagnostic.details)
    )
  );

  return sortDiagnostics(diagnostics);
}

export function inspectStorageReadEventsInput(value: unknown): readonly StorageAdapterDiagnostic[] {
  const diagnostics: StorageAdapterDiagnostic[] = [];
  if (!isRecord(value)) {
    diagnostics.push(createDiagnostic("STORAGE_READ_INPUT_INVALID", [], "read-events input must be an object."));
    return diagnostics;
  }

  diagnostics.push(...mapJsonSafetyDiagnostics(inspectJsonSafety(value)));
  validateAdapterKind(diagnostics, value.adapterKind, ["adapterKind"]);

  if (value.eventIds !== undefined) {
    if (!Array.isArray(value.eventIds)) {
      diagnostics.push(createDiagnostic("STORAGE_READ_INPUT_INVALID", ["eventIds"], "eventIds must be an array when present."));
    } else {
      for (let index = 0; index < value.eventIds.length; index += 1) {
        validateSimpleId(diagnostics, value.eventIds[index], ["eventIds", index], "STORAGE_READ_INPUT_INVALID", "eventIds entry");
      }
    }
  }

  if (value.revisionRange !== undefined) {
    if (!isRecord(value.revisionRange)) {
      diagnostics.push(createDiagnostic("STORAGE_READ_INPUT_INVALID", ["revisionRange"], "revisionRange must be an object when present."));
    } else {
      const fromRevision = value.revisionRange.fromRevision;
      const toRevision = value.revisionRange.toRevision;
      if (typeof fromRevision !== "number" || !Number.isInteger(fromRevision) || fromRevision < 0) {
        diagnostics.push(createDiagnostic("STORAGE_READ_INPUT_INVALID", ["revisionRange", "fromRevision"], "fromRevision must be a non-negative integer."));
      }
      if (typeof toRevision !== "number" || !Number.isInteger(toRevision) || toRevision < 0) {
        diagnostics.push(createDiagnostic("STORAGE_READ_INPUT_INVALID", ["revisionRange", "toRevision"], "toRevision must be a non-negative integer."));
      }
      if (
        typeof fromRevision === "number" &&
        Number.isInteger(fromRevision) &&
        fromRevision >= 0 &&
        typeof toRevision === "number" &&
        Number.isInteger(toRevision) &&
        toRevision >= 0 &&
        fromRevision > toRevision
      ) {
        diagnostics.push(createDiagnostic("STORAGE_READ_INPUT_INVALID", ["revisionRange"], "revisionRange must satisfy fromRevision <= toRevision."));
      }
    }
  }

  return sortDiagnostics(diagnostics);
}

export function inspectStorageSaveSnapshotInput(value: unknown): readonly StorageAdapterDiagnostic[] {
  const diagnostics: StorageAdapterDiagnostic[] = [];
  if (!isRecord(value)) {
    diagnostics.push(createDiagnostic("STORAGE_SAVE_INPUT_INVALID", [], "save-snapshot input must be an object."));
    return diagnostics;
  }

  diagnostics.push(...mapJsonSafetyDiagnostics(inspectJsonSafety(value)));
  validateAdapterKind(diagnostics, value.adapterKind, ["adapterKind"]);
  if (!isPositiveInteger(value.expectedSchemaVersion)) {
    diagnostics.push(createDiagnostic("STORAGE_SAVE_INPUT_INVALID", ["expectedSchemaVersion"], "expectedSchemaVersion must be a positive integer."));
  }
  diagnostics.push(
    ...inspectPersistenceSnapshotRecord(value.snapshot).map((diagnostic) =>
      createDiagnostic(diagnostic.code, ["snapshot", ...diagnostic.path], diagnostic.message, diagnostic.details)
    )
  );

  return sortDiagnostics(diagnostics);
}

export function inspectStorageLoadSnapshotInput(value: unknown): readonly StorageAdapterDiagnostic[] {
  const diagnostics: StorageAdapterDiagnostic[] = [];
  if (!isRecord(value)) {
    diagnostics.push(createDiagnostic("STORAGE_LOAD_INPUT_INVALID", [], "load-snapshot input must be an object."));
    return diagnostics;
  }

  diagnostics.push(...mapJsonSafetyDiagnostics(inspectJsonSafety(value)));
  validateAdapterKind(diagnostics, value.adapterKind, ["adapterKind"]);
  if (typeof value.snapshotId !== "string" || !SNAPSHOT_ID_PATTERN.test(value.snapshotId)) {
    diagnostics.push(createDiagnostic("STORAGE_LOAD_INPUT_INVALID", ["snapshotId"], "snapshotId is invalid."));
  }
  if (value.stateId !== undefined) {
    validateSimpleId(diagnostics, value.stateId, ["stateId"], "STORAGE_LOAD_INPUT_INVALID", "stateId");
  }

  return sortDiagnostics(diagnostics);
}

export function createStorageOperationResult(input: StorageOperationResult): StorageOperationResult {
  return {
    status: input.status,
    diagnostics: sortDiagnostics(input.diagnostics.map((diagnostic) => cloneValue(diagnostic))),
    metadata: cloneValue(input.metadata),
    ...(input.eventEnvelope === undefined ? {} : { eventEnvelope: cloneValue(input.eventEnvelope) }),
    ...(input.snapshot === undefined ? {} : { snapshot: cloneValue(input.snapshot) }),
    ...(input.recordsRead === undefined ? {} : { recordsRead: cloneValue(input.recordsRead) })
  };
}

export function formatStorageAdapterValidationMessage(diagnostics: readonly StorageAdapterDiagnostic[]): string {
  const firstDiagnostic = diagnostics[0];
  if (firstDiagnostic === undefined) {
    return "Storage adapter value is valid.";
  }
  return `${firstDiagnostic.code} @ ${formatJsonPath(firstDiagnostic.path)}: ${firstDiagnostic.message}`;
}
