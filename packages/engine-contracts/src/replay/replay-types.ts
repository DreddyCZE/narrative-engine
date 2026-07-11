import {
  formatJsonPath,
  inspectJsonSafety,
  type JsonPath,
  type JsonPathSegment,
  type JsonValue
} from "@narrative-engine/core";

import type { PersistenceEventRange } from "../persistence/persistence-types.js";
import type { SchemaVersion } from "../storage/serialization-schema-types.js";
import { isStorageAdapterKind, type StorageAdapterKind } from "../storage/storage-adapter-types.js";

export const REPLAY_STATUSES = ["planned", "replayed", "blocked", "rejected", "error"] as const;
export type ReplayStatus = (typeof REPLAY_STATUSES)[number];

export const REPLAY_SOURCE_KINDS = ["snapshot-only", "event-stream-only", "snapshot-and-events", "storage-adapter"] as const;
export type ReplaySourceKind = (typeof REPLAY_SOURCE_KINDS)[number];

export type ReplayEventRange = PersistenceEventRange;

export type ReplayStorageReference = {
  readonly adapterKind?: StorageAdapterKind;
  readonly snapshotRecordRef?: string;
  readonly eventOrderRef?: string;
  readonly eventRecordRefs?: readonly string[];
  readonly fileAdapterRootRef?: string;
};

export type ReplaySnapshotSource = {
  readonly kind: "snapshot-only";
  readonly snapshotId: string;
  readonly stateId?: string;
  readonly schemaVersion: SchemaVersion;
  readonly storage?: ReplayStorageReference;
};

export type ReplayEventStreamSource = {
  readonly kind: "event-stream-only";
  readonly eventRange?: ReplayEventRange;
  readonly eventIds?: readonly string[];
  readonly schemaVersion: SchemaVersion;
  readonly storage?: ReplayStorageReference;
};

export type ReplaySnapshotAndEventsSource = {
  readonly kind: "snapshot-and-events";
  readonly snapshotId: string;
  readonly stateId?: string;
  readonly subsequentEventRange: ReplayEventRange;
  readonly schemaVersion: SchemaVersion;
  readonly storage?: ReplayStorageReference;
};

export type ReplayStorageAdapterSource = {
  readonly kind: "storage-adapter";
  readonly adapterKind: StorageAdapterKind;
  readonly snapshotId?: string;
  readonly stateId?: string;
  readonly eventRange?: ReplayEventRange;
  readonly eventIds?: readonly string[];
  readonly schemaVersion: SchemaVersion;
  readonly storage?: ReplayStorageReference;
};

export type ReplaySourceDescriptor =
  | ReplaySnapshotSource
  | ReplayEventStreamSource
  | ReplaySnapshotAndEventsSource
  | ReplayStorageAdapterSource;

export type ReplayDeterminismPolicy = {
  readonly timestamps: "logical-only";
  readonly eventOrdering: "revision-ascending" | "revision-and-sequence-ascending";
  readonly schemaMismatch: "reject";
  readonly sourceMutation: "forbidden";
};

export type ReplayInput = {
  readonly source: ReplaySourceDescriptor;
  readonly expectedStateId?: string;
  readonly expectedRevision?: number;
  readonly determinismPolicy: ReplayDeterminismPolicy;
};

export type ReplayDiagnostic = {
  readonly code: string;
  readonly path: JsonPath;
  readonly message: string;
  readonly details?: JsonValue;
};

export type ReplayMetadata = {
  readonly deterministic: true;
  readonly planOnly: boolean;
  readonly sourceKind: ReplaySourceKind;
  readonly schemaVersion: number;
  readonly storageAdapterKind?: StorageAdapterKind;
  readonly stepCount?: number;
};

export type ReplayStepDescriptor = {
  readonly stepId: string;
  readonly phase:
    | "load-records"
    | "validate-envelopes"
    | "validate-schema-versions"
    | "order-events"
    | "rebuild-state"
    | "produce-diagnostics";
  readonly description: string;
  readonly required: true;
};

export type ReplayPlan = {
  readonly source: ReplaySourceDescriptor;
  readonly determinismPolicy: ReplayDeterminismPolicy;
  readonly steps: readonly ReplayStepDescriptor[];
};

export type ReplayResult = {
  readonly status: ReplayStatus;
  readonly diagnostics: readonly ReplayDiagnostic[];
  readonly metadata: ReplayMetadata;
  readonly plan?: ReplayPlan;
};

export class ReplayValidationError extends TypeError {
  public readonly diagnostics: readonly ReplayDiagnostic[];

  public constructor(diagnostics: readonly ReplayDiagnostic[]) {
    super(formatReplayValidationMessage(diagnostics));
    this.name = "ReplayValidationError";
    this.diagnostics = diagnostics;
  }
}

const SIMPLE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{1,159}$/u;
const SNAPSHOT_ID_PATTERN = /^snapshot\.[A-Za-z0-9][A-Za-z0-9._:@/-]{1,159}$/u;
const SCHEMA_ID_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const STEP_ID_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)+$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createDiagnostic(
  code: string,
  path: readonly JsonPathSegment[],
  message: string,
  details?: JsonValue
): ReplayDiagnostic {
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

function sortDiagnostics(diagnostics: readonly ReplayDiagnostic[]): readonly ReplayDiagnostic[] {
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
): readonly ReplayDiagnostic[] {
  return issues.map((issue) =>
    createDiagnostic(
      issue.code === "FORBIDDEN_KEY" ? "REPLAY_FORBIDDEN_KEY" : "REPLAY_NON_JSON_VALUE",
      [...prefix, ...issue.path],
      issue.message
    )
  );
}

function validateStringField(
  diagnostics: ReplayDiagnostic[],
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

function validateSchemaVersion(
  diagnostics: ReplayDiagnostic[],
  value: unknown,
  path: readonly JsonPathSegment[]
): value is SchemaVersion {
  if (!isRecord(value)) {
    diagnostics.push(createDiagnostic("REPLAY_SCHEMA_VERSION_INVALID", path, "schemaVersion must be an object."));
    return false;
  }
  if (typeof value.schemaId !== "string" || !SCHEMA_ID_PATTERN.test(value.schemaId)) {
    diagnostics.push(createDiagnostic("REPLAY_SCHEMA_VERSION_INVALID", [...path, "schemaId"], "schemaId is invalid."));
  }
  if (!isPositiveInteger(value.version)) {
    diagnostics.push(createDiagnostic("REPLAY_SCHEMA_VERSION_INVALID", [...path, "version"], "version must be a positive integer."));
  }
  return diagnostics.length === 0;
}

function validateEventRange(
  diagnostics: ReplayDiagnostic[],
  value: unknown,
  path: readonly JsonPathSegment[],
  code: string
): value is ReplayEventRange {
  if (!isRecord(value)) {
    diagnostics.push(createDiagnostic(code, path, "event range must be an object."));
    return false;
  }
  if (!isNonNegativeInteger(value.fromRevision)) {
    diagnostics.push(createDiagnostic(code, [...path, "fromRevision"], "fromRevision must be a non-negative integer."));
  }
  if (!isNonNegativeInteger(value.toRevision)) {
    diagnostics.push(createDiagnostic(code, [...path, "toRevision"], "toRevision must be a non-negative integer."));
  }
  if (
    isNonNegativeInteger(value.fromRevision) &&
    isNonNegativeInteger(value.toRevision) &&
    value.fromRevision > value.toRevision
  ) {
    diagnostics.push(createDiagnostic(code, path, "event range must satisfy fromRevision <= toRevision."));
  }
  return diagnostics.length === 0;
}

function validateStorageReference(
  diagnostics: ReplayDiagnostic[],
  value: unknown,
  path: readonly JsonPathSegment[]
): void {
  if (!isRecord(value)) {
    diagnostics.push(createDiagnostic("REPLAY_STORAGE_REFERENCE_INVALID", path, "storage reference must be an object."));
    return;
  }
  if (value.adapterKind !== undefined && !isStorageAdapterKind(value.adapterKind)) {
    diagnostics.push(createDiagnostic("REPLAY_STORAGE_REFERENCE_INVALID", [...path, "adapterKind"], "adapterKind is invalid."));
  }
  for (const field of ["snapshotRecordRef", "eventOrderRef", "fileAdapterRootRef"] as const) {
    if (value[field] !== undefined) {
      validateStringField(diagnostics, value[field], [...path, field], SIMPLE_ID_PATTERN, "REPLAY_STORAGE_REFERENCE_INVALID", `${field} is invalid.`);
    }
  }
  if (value.eventRecordRefs !== undefined) {
    if (!Array.isArray(value.eventRecordRefs)) {
      diagnostics.push(createDiagnostic("REPLAY_STORAGE_REFERENCE_INVALID", [...path, "eventRecordRefs"], "eventRecordRefs must be an array when present."));
    } else {
      for (let index = 0; index < value.eventRecordRefs.length; index += 1) {
        validateStringField(
          diagnostics,
          value.eventRecordRefs[index],
          [...path, "eventRecordRefs", index],
          SIMPLE_ID_PATTERN,
          "REPLAY_STORAGE_REFERENCE_INVALID",
          "eventRecordRefs entry is invalid."
        );
      }
    }
  }
}

export function isReplayStatus(value: unknown): value is ReplayStatus {
  return typeof value === "string" && REPLAY_STATUSES.includes(value as ReplayStatus);
}

export function isReplaySourceKind(value: unknown): value is ReplaySourceKind {
  return typeof value === "string" && REPLAY_SOURCE_KINDS.includes(value as ReplaySourceKind);
}

export function inspectReplayInput(value: unknown): readonly ReplayDiagnostic[] {
  const diagnostics: ReplayDiagnostic[] = [];
  if (!isRecord(value)) {
    diagnostics.push(createDiagnostic("REPLAY_INPUT_INVALID", [], "replay input must be an object."));
    return diagnostics;
  }

  diagnostics.push(...mapJsonSafetyDiagnostics(inspectJsonSafety(value)));

  if (!isRecord(value.source)) {
    diagnostics.push(createDiagnostic("REPLAY_SOURCE_INVALID", ["source"], "source must be an object."));
  } else {
    diagnostics.push(...mapJsonSafetyDiagnostics(inspectJsonSafety(value.source), ["source"]));

    if (!isReplaySourceKind(value.source.kind)) {
      diagnostics.push(createDiagnostic("REPLAY_SOURCE_INVALID", ["source", "kind"], "source.kind is invalid."));
    }

    validateSchemaVersion(diagnostics, value.source.schemaVersion, ["source", "schemaVersion"]);

    if (value.source.storage !== undefined) {
      validateStorageReference(diagnostics, value.source.storage, ["source", "storage"]);
    }

    switch (value.source.kind) {
      case "snapshot-only": {
        validateStringField(diagnostics, value.source.snapshotId, ["source", "snapshotId"], SNAPSHOT_ID_PATTERN, "REPLAY_SOURCE_INVALID", "snapshotId is invalid.");
        if (value.source.stateId !== undefined) {
          validateStringField(diagnostics, value.source.stateId, ["source", "stateId"], SIMPLE_ID_PATTERN, "REPLAY_SOURCE_INVALID", "stateId is invalid.");
        }
        break;
      }
      case "event-stream-only": {
        const hasStorageEventRecordRefs = isRecord(value.source.storage) && value.source.storage.eventRecordRefs !== undefined;
        if (value.source.eventRange === undefined && value.source.eventIds === undefined && !hasStorageEventRecordRefs) {
          diagnostics.push(createDiagnostic("REPLAY_SOURCE_INVALID", ["source"], "event-stream-only source requires eventRange, eventIds, or storage.eventRecordRefs."));
        }
        if (value.source.eventRange !== undefined) {
          validateEventRange(diagnostics, value.source.eventRange, ["source", "eventRange"], "REPLAY_SOURCE_INVALID");
        }
        if (value.source.eventIds !== undefined) {
          if (!Array.isArray(value.source.eventIds)) {
            diagnostics.push(createDiagnostic("REPLAY_SOURCE_INVALID", ["source", "eventIds"], "eventIds must be an array when present."));
          } else {
            for (let index = 0; index < value.source.eventIds.length; index += 1) {
              validateStringField(diagnostics, value.source.eventIds[index], ["source", "eventIds", index], SIMPLE_ID_PATTERN, "REPLAY_SOURCE_INVALID", "eventIds entry is invalid.");
            }
          }
        }
        break;
      }
      case "snapshot-and-events": {
        validateStringField(diagnostics, value.source.snapshotId, ["source", "snapshotId"], SNAPSHOT_ID_PATTERN, "REPLAY_SOURCE_INVALID", "snapshotId is invalid.");
        if (value.source.stateId !== undefined) {
          validateStringField(diagnostics, value.source.stateId, ["source", "stateId"], SIMPLE_ID_PATTERN, "REPLAY_SOURCE_INVALID", "stateId is invalid.");
        }
        validateEventRange(diagnostics, value.source.subsequentEventRange, ["source", "subsequentEventRange"], "REPLAY_SOURCE_INVALID");
        break;
      }
      case "storage-adapter": {
        if (!isStorageAdapterKind(value.source.adapterKind)) {
          diagnostics.push(createDiagnostic("REPLAY_SOURCE_INVALID", ["source", "adapterKind"], "adapterKind is invalid."));
        }
        if (value.source.snapshotId !== undefined) {
          validateStringField(diagnostics, value.source.snapshotId, ["source", "snapshotId"], SNAPSHOT_ID_PATTERN, "REPLAY_SOURCE_INVALID", "snapshotId is invalid.");
        }
        if (value.source.stateId !== undefined) {
          validateStringField(diagnostics, value.source.stateId, ["source", "stateId"], SIMPLE_ID_PATTERN, "REPLAY_SOURCE_INVALID", "stateId is invalid.");
        }
        if (value.source.eventRange !== undefined) {
          validateEventRange(diagnostics, value.source.eventRange, ["source", "eventRange"], "REPLAY_SOURCE_INVALID");
        }
        if (value.source.eventIds !== undefined) {
          if (!Array.isArray(value.source.eventIds)) {
            diagnostics.push(createDiagnostic("REPLAY_SOURCE_INVALID", ["source", "eventIds"], "eventIds must be an array when present."));
          } else {
            for (let index = 0; index < value.source.eventIds.length; index += 1) {
              validateStringField(diagnostics, value.source.eventIds[index], ["source", "eventIds", index], SIMPLE_ID_PATTERN, "REPLAY_SOURCE_INVALID", "eventIds entry is invalid.");
            }
          }
        }
        break;
      }
      default:
        break;
    }
  }

  if (!isRecord(value.determinismPolicy)) {
    diagnostics.push(createDiagnostic("REPLAY_POLICY_INVALID", ["determinismPolicy"], "determinismPolicy must be an object."));
  } else {
    if (value.determinismPolicy.timestamps !== "logical-only") {
      diagnostics.push(createDiagnostic("REPLAY_POLICY_INVALID", ["determinismPolicy", "timestamps"], 'timestamps must be "logical-only".'));
    }
    if (
      value.determinismPolicy.eventOrdering !== "revision-ascending" &&
      value.determinismPolicy.eventOrdering !== "revision-and-sequence-ascending"
    ) {
      diagnostics.push(createDiagnostic("REPLAY_POLICY_INVALID", ["determinismPolicy", "eventOrdering"], "eventOrdering is invalid."));
    }
    if (value.determinismPolicy.schemaMismatch !== "reject") {
      diagnostics.push(createDiagnostic("REPLAY_POLICY_INVALID", ["determinismPolicy", "schemaMismatch"], 'schemaMismatch must be "reject".'));
    }
    if (value.determinismPolicy.sourceMutation !== "forbidden") {
      diagnostics.push(createDiagnostic("REPLAY_POLICY_INVALID", ["determinismPolicy", "sourceMutation"], 'sourceMutation must be "forbidden".'));
    }
  }

  if (value.expectedStateId !== undefined) {
    validateStringField(diagnostics, value.expectedStateId, ["expectedStateId"], SIMPLE_ID_PATTERN, "REPLAY_INPUT_INVALID", "expectedStateId is invalid.");
  }
  if (value.expectedRevision !== undefined && !isNonNegativeInteger(value.expectedRevision)) {
    diagnostics.push(createDiagnostic("REPLAY_INPUT_INVALID", ["expectedRevision"], "expectedRevision must be a non-negative integer when present."));
  }

  return sortDiagnostics(diagnostics);
}

export function createReplayResult(input: ReplayResult): ReplayResult {
  return {
    status: input.status,
    diagnostics: sortDiagnostics(input.diagnostics.map((diagnostic) => cloneValue(diagnostic))),
    metadata: cloneValue(input.metadata),
    ...(input.plan === undefined ? {} : { plan: cloneValue(input.plan) })
  };
}

export function formatReplayValidationMessage(diagnostics: readonly ReplayDiagnostic[]): string {
  const firstDiagnostic = diagnostics[0];
  if (firstDiagnostic === undefined) {
    return "Replay value is valid.";
  }
  return `${firstDiagnostic.code} @ ${formatJsonPath(firstDiagnostic.path)}: ${firstDiagnostic.message}`;
}

export function createReplayPlan(input: ReplayPlan): ReplayPlan {
  return cloneValue(input);
}

export function assertReplayInput(value: unknown): asserts value is ReplayInput {
  const diagnostics = inspectReplayInput(value);
  if (diagnostics.length > 0) {
    throw new ReplayValidationError(diagnostics);
  }
}

export function inspectReplayPlan(value: unknown): readonly ReplayDiagnostic[] {
  const diagnostics: ReplayDiagnostic[] = [];
  if (!isRecord(value)) {
    diagnostics.push(createDiagnostic("REPLAY_PLAN_INVALID", [], "replay plan must be an object."));
    return diagnostics;
  }

  diagnostics.push(...inspectReplayInput({ source: value.source, determinismPolicy: value.determinismPolicy }));

  if (!Array.isArray(value.steps)) {
    diagnostics.push(createDiagnostic("REPLAY_PLAN_INVALID", ["steps"], "steps must be an array."));
    return sortDiagnostics(diagnostics);
  }
  const steps: readonly unknown[] = value.steps;
  if (steps.length === 0) {
    diagnostics.push(createDiagnostic("REPLAY_PLAN_INVALID", ["steps"], "steps must contain at least one step."));
    return sortDiagnostics(diagnostics);
  }
  const stepIds = new Set<string>();
  for (let index = 0; index < steps.length; index += 1) {
    const step: unknown = steps[index];
    const path = ["steps", index] as const;
    if (!isRecord(step)) {
      diagnostics.push(createDiagnostic("REPLAY_PLAN_INVALID", path, "step must be an object."));
      continue;
    }
    const stepId = step.stepId;
    const hasValidStepId = validateStringField(diagnostics, stepId, [...path, "stepId"], STEP_ID_PATTERN, "REPLAY_PLAN_INVALID", "stepId is invalid.");
    if (hasValidStepId) {
      if (stepIds.has(stepId)) {
        diagnostics.push(createDiagnostic("REPLAY_PLAN_INVALID", [...path, "stepId"], "stepId must be unique."));
      } else {
        stepIds.add(stepId);
      }
    }
    if (
      step.phase !== "load-records" &&
      step.phase !== "validate-envelopes" &&
      step.phase !== "validate-schema-versions" &&
      step.phase !== "order-events" &&
      step.phase !== "rebuild-state" &&
      step.phase !== "produce-diagnostics"
    ) {
      diagnostics.push(createDiagnostic("REPLAY_PLAN_INVALID", [...path, "phase"], "phase is invalid."));
    }
    if (typeof step.description !== "string" || step.description.trim().length === 0) {
      diagnostics.push(createDiagnostic("REPLAY_PLAN_INVALID", [...path, "description"], "description must be a non-empty string."));
    }
    if (step.required !== true) {
      diagnostics.push(createDiagnostic("REPLAY_PLAN_INVALID", [...path, "required"], "required must be true."));
    }
  }

  return sortDiagnostics(diagnostics);
}
