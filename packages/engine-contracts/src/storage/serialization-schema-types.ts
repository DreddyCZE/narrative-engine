import {
  formatJsonPath,
  inspectJsonSafety,
  type JsonPath,
  type JsonPathSegment,
  type JsonValue
} from "@narrative-engine/core";

export const SERIALIZATION_FORMATS = ["json", "json-lines"] as const;
export type SerializationFormat = (typeof SERIALIZATION_FORMATS)[number];

export type SchemaVersion = {
  readonly schemaId: string;
  readonly version: number;
};

export type ChecksumMetadata = {
  readonly algorithm: "none" | "sha256" | "sha512";
  readonly value?: string;
};

export type SerializationMetadata = {
  readonly deterministic: true;
  readonly format: SerializationFormat;
  readonly lineEndings: "lf";
  readonly indentation: "two-spaces" | "none";
  readonly contentType: "application/json" | "application/x-ndjson";
  readonly schemaVersion: SchemaVersion;
  readonly checksum?: ChecksumMetadata;
};

export type SerializationEnvelope = {
  readonly metadata: SerializationMetadata;
  readonly payload: JsonValue;
};

export type SerializedPayload = {
  readonly format: SerializationFormat;
  readonly content: string;
  readonly contentType: "application/json" | "application/x-ndjson";
  readonly schemaVersion: SchemaVersion;
  readonly checksum?: ChecksumMetadata;
};

export type SerializationDiagnostic = {
  readonly code: string;
  readonly path: JsonPath;
  readonly message: string;
  readonly details?: JsonValue;
};

export type SchemaMigrationDescriptor = {
  readonly migrationId: string;
  readonly schemaId: string;
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly deterministic: true;
  readonly lossy: boolean;
  readonly requiresContext: boolean;
  readonly description: string;
};

export type SchemaMigrationPlan = {
  readonly schemaId: string;
  readonly targetVersion: number;
  readonly steps: readonly SchemaMigrationDescriptor[];
};

export type SerializationResult = {
  readonly status: "serialized" | "rejected" | "error";
  readonly diagnostics: readonly SerializationDiagnostic[];
  readonly metadata: SerializationMetadata;
  readonly envelope?: SerializationEnvelope;
  readonly serializedPayload?: SerializedPayload;
};

export type DeserializationResult = {
  readonly status: "deserialized" | "rejected" | "error";
  readonly diagnostics: readonly SerializationDiagnostic[];
  readonly metadata: SerializationMetadata;
  readonly envelope?: SerializationEnvelope;
};

export class SerializationValidationError extends TypeError {
  public readonly diagnostics: readonly SerializationDiagnostic[];

  public constructor(diagnostics: readonly SerializationDiagnostic[]) {
    super(formatSerializationValidationMessage(diagnostics));
    this.name = "SerializationValidationError";
    this.diagnostics = diagnostics;
  }
}

const SCHEMA_ID_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const CHECKSUM_VALUE_PATTERN = /^[A-Za-z0-9:_-]{3,200}$/u;
const MIGRATION_ID_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+){1,}$/u;

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
): SerializationDiagnostic {
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

function sortDiagnostics(diagnostics: readonly SerializationDiagnostic[]): readonly SerializationDiagnostic[] {
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
): readonly SerializationDiagnostic[] {
  return issues.map((issue) =>
    createDiagnostic(
      issue.code === "FORBIDDEN_KEY" ? "SERIALIZATION_FORBIDDEN_KEY" : "SERIALIZATION_NON_JSON_VALUE",
      [...prefix, ...issue.path],
      issue.message
    )
  );
}

function validateSchemaVersion(
  diagnostics: SerializationDiagnostic[],
  value: unknown,
  path: readonly JsonPathSegment[]
): value is SchemaVersion {
  if (!isRecord(value)) {
    diagnostics.push(createDiagnostic("SERIALIZATION_SCHEMA_VERSION_INVALID", path, "schemaVersion must be an object."));
    return false;
  }
  if (typeof value.schemaId !== "string" || !SCHEMA_ID_PATTERN.test(value.schemaId)) {
    diagnostics.push(createDiagnostic("SERIALIZATION_SCHEMA_VERSION_INVALID", [...path, "schemaId"], "schemaId is invalid."));
  }
  if (!isPositiveInteger(value.version)) {
    diagnostics.push(createDiagnostic("SERIALIZATION_SCHEMA_VERSION_INVALID", [...path, "version"], "version must be a positive integer."));
  }
  return diagnostics.length === 0;
}

function validateChecksum(
  diagnostics: SerializationDiagnostic[],
  value: unknown,
  path: readonly JsonPathSegment[]
): void {
  if (!isRecord(value)) {
    diagnostics.push(createDiagnostic("SERIALIZATION_CHECKSUM_INVALID", path, "checksum must be an object."));
    return;
  }
  if (value.algorithm !== "none" && value.algorithm !== "sha256" && value.algorithm !== "sha512") {
    diagnostics.push(createDiagnostic("SERIALIZATION_CHECKSUM_INVALID", [...path, "algorithm"], "checksum.algorithm is invalid."));
  }
  if (value.value !== undefined && (typeof value.value !== "string" || !CHECKSUM_VALUE_PATTERN.test(value.value))) {
    diagnostics.push(createDiagnostic("SERIALIZATION_CHECKSUM_INVALID", [...path, "value"], "checksum.value is invalid."));
  }
}

export function isSerializationFormat(value: unknown): value is SerializationFormat {
  return typeof value === "string" && SERIALIZATION_FORMATS.includes(value as SerializationFormat);
}

export function inspectSerializationEnvelope(value: unknown): readonly SerializationDiagnostic[] {
  const diagnostics: SerializationDiagnostic[] = [];
  if (!isRecord(value)) {
    diagnostics.push(createDiagnostic("SERIALIZATION_ENVELOPE_INVALID", [], "serialization envelope must be an object."));
    return diagnostics;
  }

  diagnostics.push(...mapJsonSafetyDiagnostics(inspectJsonSafety(value)));

  if (!isRecord(value.metadata)) {
    diagnostics.push(createDiagnostic("SERIALIZATION_METADATA_INVALID", ["metadata"], "metadata must be an object."));
  } else {
    if (value.metadata.deterministic !== true) {
      diagnostics.push(createDiagnostic("SERIALIZATION_METADATA_INVALID", ["metadata", "deterministic"], "metadata.deterministic must be true."));
    }
    if (!isSerializationFormat(value.metadata.format)) {
      diagnostics.push(createDiagnostic("SERIALIZATION_METADATA_INVALID", ["metadata", "format"], "metadata.format is invalid."));
    }
    if (value.metadata.lineEndings !== "lf") {
      diagnostics.push(createDiagnostic("SERIALIZATION_METADATA_INVALID", ["metadata", "lineEndings"], 'metadata.lineEndings must be "lf".'));
    }
    if (value.metadata.indentation !== "two-spaces" && value.metadata.indentation !== "none") {
      diagnostics.push(createDiagnostic("SERIALIZATION_METADATA_INVALID", ["metadata", "indentation"], "metadata.indentation is invalid."));
    }
    if (value.metadata.contentType !== "application/json" && value.metadata.contentType !== "application/x-ndjson") {
      diagnostics.push(createDiagnostic("SERIALIZATION_METADATA_INVALID", ["metadata", "contentType"], "metadata.contentType is invalid."));
    }
    validateSchemaVersion(diagnostics, value.metadata.schemaVersion, ["metadata", "schemaVersion"]);
    if (value.metadata.checksum !== undefined) {
      validateChecksum(diagnostics, value.metadata.checksum, ["metadata", "checksum"]);
    }
  }

  diagnostics.push(...mapJsonSafetyDiagnostics(inspectJsonSafety(value.payload), ["payload"]));
  return sortDiagnostics(diagnostics);
}

export function inspectSchemaMigrationPlan(value: unknown): readonly SerializationDiagnostic[] {
  const diagnostics: SerializationDiagnostic[] = [];
  if (!isRecord(value)) {
    diagnostics.push(createDiagnostic("SERIALIZATION_MIGRATION_PLAN_INVALID", [], "schema migration plan must be an object."));
    return diagnostics;
  }

  diagnostics.push(...mapJsonSafetyDiagnostics(inspectJsonSafety(value)));
  if (typeof value.schemaId !== "string" || !SCHEMA_ID_PATTERN.test(value.schemaId)) {
    diagnostics.push(createDiagnostic("SERIALIZATION_MIGRATION_PLAN_INVALID", ["schemaId"], "schemaId is invalid."));
  }
  if (!isPositiveInteger(value.targetVersion)) {
    diagnostics.push(createDiagnostic("SERIALIZATION_MIGRATION_PLAN_INVALID", ["targetVersion"], "targetVersion must be a positive integer."));
  }
  if (!Array.isArray(value.steps)) {
    diagnostics.push(createDiagnostic("SERIALIZATION_MIGRATION_PLAN_INVALID", ["steps"], "steps must be an array."));
    return sortDiagnostics(diagnostics);
  }

  const steps: readonly unknown[] = value.steps;
  for (let index = 0; index < steps.length; index += 1) {
    const step: unknown = steps[index];
    const path = ["steps", index] as const;
    if (!isRecord(step)) {
      diagnostics.push(createDiagnostic("SERIALIZATION_MIGRATION_STEP_INVALID", path, "migration step must be an object."));
      continue;
    }
    if (typeof step.migrationId !== "string" || !MIGRATION_ID_PATTERN.test(step.migrationId)) {
      diagnostics.push(createDiagnostic("SERIALIZATION_MIGRATION_STEP_INVALID", [...path, "migrationId"], "migrationId is invalid."));
    }
    if (typeof step.schemaId !== "string" || !SCHEMA_ID_PATTERN.test(step.schemaId)) {
      diagnostics.push(createDiagnostic("SERIALIZATION_MIGRATION_STEP_INVALID", [...path, "schemaId"], "schemaId is invalid."));
    }
    if (!isPositiveInteger(step.fromVersion)) {
      diagnostics.push(createDiagnostic("SERIALIZATION_MIGRATION_STEP_INVALID", [...path, "fromVersion"], "fromVersion must be a positive integer."));
    }
    if (!isPositiveInteger(step.toVersion)) {
      diagnostics.push(createDiagnostic("SERIALIZATION_MIGRATION_STEP_INVALID", [...path, "toVersion"], "toVersion must be a positive integer."));
    }
    if (step.deterministic !== true) {
      diagnostics.push(createDiagnostic("SERIALIZATION_MIGRATION_STEP_INVALID", [...path, "deterministic"], "deterministic must be true."));
    }
    if (typeof step.lossy !== "boolean") {
      diagnostics.push(createDiagnostic("SERIALIZATION_MIGRATION_STEP_INVALID", [...path, "lossy"], "lossy must be a boolean."));
    }
    if (typeof step.requiresContext !== "boolean") {
      diagnostics.push(createDiagnostic("SERIALIZATION_MIGRATION_STEP_INVALID", [...path, "requiresContext"], "requiresContext must be a boolean."));
    }
    if (typeof step.description !== "string" || step.description.trim().length === 0) {
      diagnostics.push(createDiagnostic("SERIALIZATION_MIGRATION_STEP_INVALID", [...path, "description"], "description must be a non-empty string."));
    }
  }

  return sortDiagnostics(diagnostics);
}

export function createSerializationResult(input: SerializationResult): SerializationResult {
  return {
    status: input.status,
    diagnostics: sortDiagnostics(input.diagnostics.map((diagnostic) => cloneValue(diagnostic))),
    metadata: cloneValue(input.metadata),
    ...(input.envelope === undefined ? {} : { envelope: cloneValue(input.envelope) }),
    ...(input.serializedPayload === undefined ? {} : { serializedPayload: cloneValue(input.serializedPayload) })
  };
}

export function createDeserializationResult(input: DeserializationResult): DeserializationResult {
  return {
    status: input.status,
    diagnostics: sortDiagnostics(input.diagnostics.map((diagnostic) => cloneValue(diagnostic))),
    metadata: cloneValue(input.metadata),
    ...(input.envelope === undefined ? {} : { envelope: cloneValue(input.envelope) })
  };
}

export function formatSerializationValidationMessage(diagnostics: readonly SerializationDiagnostic[]): string {
  const firstDiagnostic = diagnostics[0];
  if (firstDiagnostic === undefined) {
    return "Serialization value is valid.";
  }
  return `${firstDiagnostic.code} @ ${formatJsonPath(firstDiagnostic.path)}: ${firstDiagnostic.message}`;
}
