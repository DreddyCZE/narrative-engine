/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { formatJsonPath, inspectJsonSafety, type JsonPath } from "@narrative-engine/core";

export const SCHEMA_VERSIONING_CONTRACT_VERSION = "schema-versioning@0.1.0" as const;

export type SchemaVersionStatus = "draft" | "accepted" | "deprecated" | "removed";

export type SchemaVersionEntry = {
  readonly schemaVersion: number;
  readonly status: SchemaVersionStatus;
  readonly jsonSchema: string;
  readonly schemaHash?: string;
  readonly meaningHash?: string;
  readonly deprecation?: {
    readonly replacementSchemaKey: string;
    readonly reason: string;
    readonly lastSupportedBy?: string;
  };
};

export type SchemaReaderSupport = {
  readonly minVersion: number;
  readonly maxVersion: number;
};

export type SchemaMigration = {
  readonly migrationId: string;
  readonly schemaId: string;
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly direction: "upgrade" | "downgrade";
  readonly deterministic: boolean;
  readonly lossy: boolean;
  readonly lossDescription?: string;
  readonly requiresContext: boolean;
};

export type SchemaDescriptor = {
  readonly contractVersion: typeof SCHEMA_VERSIONING_CONTRACT_VERSION;
  readonly schemaId: string;
  readonly owningPackage: string;
  readonly contract: {
    readonly id: string;
    readonly version: string;
  };
  readonly versions: readonly SchemaVersionEntry[];
  readonly readerSupport: SchemaReaderSupport;
  readonly writerVersion: number;
  readonly writerProfile?: "development" | "production";
  readonly migrations?: readonly SchemaMigration[];
};

export type SchemaVersionIssueCode =
  | "SCHEMA_VERSIONING_NOT_OBJECT"
  | "SCHEMA_VERSIONING_MISSING_CONTRACT_VERSION"
  | "SCHEMA_VERSIONING_INVALID_CONTRACT_VERSION"
  | "SCHEMA_VERSIONING_MISSING_SCHEMA_ID"
  | "SCHEMA_VERSIONING_INVALID_SCHEMA_ID"
  | "SCHEMA_VERSIONING_INVALID_OWNING_PACKAGE"
  | "SCHEMA_VERSIONING_INVALID_CONTRACT"
  | "SCHEMA_VERSIONING_INVALID_VERSION_ENTRY"
  | "SCHEMA_VERSIONING_INVALID_READER_SUPPORT"
  | "SCHEMA_VERSIONING_INVALID_WRITER_VERSION"
  | "SCHEMA_VERSIONING_INVALID_WRITER_PROFILE"
  | "SCHEMA_VERSIONING_INVALID_MIGRATION"
  | "SCHEMA_VERSIONING_UNKNOWN_FIELD"
  | "SCHEMA_VERSIONING_NON_JSON_VALUE"
  | "SCHEMA_VERSIONING_FORBIDDEN_KEY"
  | "SCHEMA_VERSIONING_UNSUPPORTED_NEWER"
  | "SCHEMA_VERSIONING_UNSUPPORTED_OLDER"
  | "SCHEMA_VERSIONING_MIGRATION_REQUIRED"
  | "SCHEMA_VERSIONING_INVALID_VERSION";

export type SchemaVersionIssue = {
  readonly code: SchemaVersionIssueCode;
  readonly path: JsonPath;
  readonly message: string;
};

export type SchemaCompatibilityStatus =
  | "EXACT"
  | "READABLE"
  | "MIGRATION_REQUIRED"
  | "UNSUPPORTED_NEWER"
  | "UNSUPPORTED_OLDER"
  | "INVALID_VERSION"
  | "MISSING_SCHEMA";

export type SchemaCompatibilityResult = {
  readonly status: SchemaCompatibilityStatus;
  readonly issues: readonly SchemaVersionIssue[];
};

export class SchemaVersioningValidationError extends TypeError {
  public readonly issues: readonly SchemaVersionIssue[];

  public constructor(issues: readonly SchemaVersionIssue[]) {
    super(formatSchemaVersioningValidationMessage(issues));
    this.name = "SchemaVersioningValidationError";
    this.issues = issues;
  }
}

const CONTRACT_VERSION = SCHEMA_VERSIONING_CONTRACT_VERSION;
const SCHEMA_ID_PATTERN = new RegExp("^[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,63}$", "u");
const PACKAGE_NAME_PATTERN = new RegExp("^(?:@[a-z0-9._-]+/[a-z0-9._-]+|[a-z0-9._-]+)$", "u");
const CONTRACT_REF_PATTERN = new RegExp(
  "^[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,63}@[0-9]+\\.[0-9]+\\.[0-9]+(?:-[a-z0-9.-]+)?$",
  "u"
);
const SCHEMA_KEY_PATTERN = new RegExp(
  "^[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,63}@[1-9][0-9]*$",
  "u"
);
const SCHEMA_PATH_PATTERN = new RegExp(
  "^(?!/)(?![A-Za-z]:)(?!.*(^|/)\\.\\.?(/|$))[A-Za-z0-9._/-]+\\.schema\\.json$",
  "u"
);
const VERSION_PATH_PATTERN = new RegExp("^(?!/)(?![A-Za-z]:)(?!.*(^|/)\\.\\.?(/|$))[A-Za-z0-9._/-]+$", "u");
const VERSION_ENTRY_STATUSES = new Set<SchemaVersionStatus>(["draft", "accepted", "deprecated", "removed"]);
const WRITER_PROFILES = new Set(["development", "production"]);
const TOP_LEVEL_KEYS = new Set([
  "contractVersion",
  "schemaId",
  "owningPackage",
  "contract",
  "versions",
  "readerSupport",
  "writerVersion",
  "writerProfile",
  "migrations"
]);
const CONTRACT_KEYS = new Set(["id", "version"]);
const READER_SUPPORT_KEYS = new Set(["minVersion", "maxVersion"]);
const VERSION_ENTRY_KEYS = new Set(["schemaVersion", "status", "jsonSchema", "schemaHash", "meaningHash", "deprecation"]);
const DEPRECATION_KEYS = new Set(["replacementSchemaKey", "reason", "lastSupportedBy"]);
const MIGRATION_KEYS = new Set([
  "migrationId",
  "schemaId",
  "fromVersion",
  "toVersion",
  "direction",
  "deterministic",
  "lossy",
  "lossDescription",
  "requiresContext"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 2147483647;
}

function addIssue(
  issues: SchemaVersionIssue[],
  code: SchemaVersionIssueCode,
  path: JsonPath,
  message: string
): void {
  issues.push({
    code,
    path: path.slice(),
    message
  });
}

function mapJsonSafetyIssues(issues: SchemaVersionIssue[], sourceIssues: ReturnType<typeof inspectJsonSafety>): void {
  for (const issue of sourceIssues) {
    addIssue(
      issues,
      issue.code === "FORBIDDEN_KEY"
        ? "SCHEMA_VERSIONING_FORBIDDEN_KEY"
        : "SCHEMA_VERSIONING_NON_JSON_VALUE",
      issue.path,
      issue.message
    );
  }
}

function isSchemaId(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  return SCHEMA_ID_PATTERN.test(value);
}

function isVersionRef(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  return CONTRACT_REF_PATTERN.test(value);
}

function isPackageName(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  return PACKAGE_NAME_PATTERN.test(value);
}

function isSchemaKey(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  return SCHEMA_KEY_PATTERN.test(value);
}

function validateSchemaVersionEntry(issues: SchemaVersionIssue[], entry: unknown, index: number): void {
  const path: JsonPath = ["versions", index];
  if (!isRecord(entry)) {
    addIssue(issues, "SCHEMA_VERSIONING_INVALID_VERSION_ENTRY", path, "version entry must be an object.");
    return;
  }

  for (const key of Object.keys(entry)) {
    if (!VERSION_ENTRY_KEYS.has(key)) {
      addIssue(
        issues,
        "SCHEMA_VERSIONING_INVALID_VERSION_ENTRY",
        [...path, key],
        "version entry contains an unknown field."
      );
    }
  }

  if (!isPositiveInteger(entry.schemaVersion)) {
    addIssue(
      issues,
      "SCHEMA_VERSIONING_INVALID_VERSION_ENTRY",
      [...path, "schemaVersion"],
      "schemaVersion must be a positive integer."
    );
  }

  if (!VERSION_ENTRY_STATUSES.has(entry.status as SchemaVersionStatus)) {
    addIssue(issues, "SCHEMA_VERSIONING_INVALID_VERSION_ENTRY", [...path, "status"], "status is invalid.");
  }

  const jsonSchema = entry.jsonSchema;
  if (typeof jsonSchema !== "string") {
    addIssue(
      issues,
      "SCHEMA_VERSIONING_INVALID_VERSION_ENTRY",
      [...path, "jsonSchema"],
      "jsonSchema is invalid."
    );
    return;
  }
  if (!SCHEMA_PATH_PATTERN.test(jsonSchema)) {
    addIssue(
      issues,
      "SCHEMA_VERSIONING_INVALID_VERSION_ENTRY",
      [...path, "jsonSchema"],
      "jsonSchema is invalid."
    );
    return;
  }

  const schemaHash = entry.schemaHash;
  if (schemaHash !== undefined) {
    if (typeof schemaHash !== "string") {
      addIssue(
        issues,
        "SCHEMA_VERSIONING_INVALID_VERSION_ENTRY",
        [...path, "schemaHash"],
        "schemaHash is invalid."
      );
      return;
    }
    if (!/^sha256:[0-9a-f]{64}$/u.test(schemaHash)) {
      addIssue(
        issues,
        "SCHEMA_VERSIONING_INVALID_VERSION_ENTRY",
        [...path, "schemaHash"],
        "schemaHash is invalid."
      );
      return;
    }
  }

  const meaningHash = entry.meaningHash;
  if (meaningHash !== undefined) {
    if (typeof meaningHash !== "string") {
      addIssue(
        issues,
        "SCHEMA_VERSIONING_INVALID_VERSION_ENTRY",
        [...path, "meaningHash"],
        "meaningHash is invalid."
      );
      return;
    }
    if (!/^sha256:[0-9a-f]{64}$/u.test(meaningHash)) {
      addIssue(
        issues,
        "SCHEMA_VERSIONING_INVALID_VERSION_ENTRY",
        [...path, "meaningHash"],
        "meaningHash is invalid."
      );
      return;
    }
  }

  if (entry.deprecation !== undefined) {
    const deprecation = entry.deprecation;
    if (!isRecord(deprecation)) {
      addIssue(
        issues,
        "SCHEMA_VERSIONING_INVALID_VERSION_ENTRY",
        [...path, "deprecation"],
        "deprecation must be an object."
      );
      return;
    }

    for (const key of Object.keys(deprecation)) {
      if (!DEPRECATION_KEYS.has(key)) {
        addIssue(
          issues,
          "SCHEMA_VERSIONING_INVALID_VERSION_ENTRY",
          [...path, "deprecation", key],
          "deprecation contains an unknown field."
        );
      }
    }

    const replacementSchemaKey = deprecation.replacementSchemaKey;
    if (typeof replacementSchemaKey !== "string") {
      addIssue(
        issues,
        "SCHEMA_VERSIONING_INVALID_VERSION_ENTRY",
        [...path, "deprecation", "replacementSchemaKey"],
        "replacementSchemaKey is invalid."
      );
    } else if (!isSchemaKey(replacementSchemaKey)) {
      addIssue(
        issues,
        "SCHEMA_VERSIONING_INVALID_VERSION_ENTRY",
        [...path, "deprecation", "replacementSchemaKey"],
        "replacementSchemaKey is invalid."
      );
    }

    const reason = deprecation.reason;
    if (typeof reason !== "string") {
      addIssue(
        issues,
        "SCHEMA_VERSIONING_INVALID_VERSION_ENTRY",
        [...path, "deprecation", "reason"],
        "reason is invalid."
      );
    } else if (reason.length === 0) {
      addIssue(
        issues,
        "SCHEMA_VERSIONING_INVALID_VERSION_ENTRY",
        [...path, "deprecation", "reason"],
        "reason is invalid."
      );
    }

    const lastSupportedBy = deprecation.lastSupportedBy;
    if (lastSupportedBy !== undefined) {
      if (typeof lastSupportedBy !== "string") {
        addIssue(
          issues,
          "SCHEMA_VERSIONING_INVALID_VERSION_ENTRY",
          [...path, "deprecation", "lastSupportedBy"],
          "lastSupportedBy is invalid."
        );
        return;
      }
      if (!VERSION_PATH_PATTERN.test(lastSupportedBy)) {
        addIssue(
          issues,
          "SCHEMA_VERSIONING_INVALID_VERSION_ENTRY",
          [...path, "deprecation", "lastSupportedBy"],
          "lastSupportedBy is invalid."
        );
        return;
      }
    }
  }
}

function validateMigration(issues: SchemaVersionIssue[], migration: unknown, index: number): void {
  const path: JsonPath = ["migrations", index];
  if (!isRecord(migration)) {
    addIssue(issues, "SCHEMA_VERSIONING_INVALID_MIGRATION", path, "migration must be an object.");
    return;
  }

  for (const key of Object.keys(migration)) {
    if (!MIGRATION_KEYS.has(key)) {
      addIssue(issues, "SCHEMA_VERSIONING_INVALID_MIGRATION", [...path, key], "migration contains an unknown field.");
    }
  }

  if (typeof migration.migrationId !== "string" || migration.migrationId.length === 0) {
    addIssue(issues, "SCHEMA_VERSIONING_INVALID_MIGRATION", [...path, "migrationId"], "migrationId is invalid.");
  }
  if (!isSchemaId(migration.schemaId)) {
    addIssue(issues, "SCHEMA_VERSIONING_INVALID_MIGRATION", [...path, "schemaId"], "schemaId is invalid.");
  }
  if (!isPositiveInteger(migration.fromVersion)) {
    addIssue(issues, "SCHEMA_VERSIONING_INVALID_MIGRATION", [...path, "fromVersion"], "fromVersion is invalid.");
  }
  if (!isPositiveInteger(migration.toVersion)) {
    addIssue(issues, "SCHEMA_VERSIONING_INVALID_MIGRATION", [...path, "toVersion"], "toVersion is invalid.");
  }
  if (migration.direction !== "upgrade" && migration.direction !== "downgrade") {
    addIssue(issues, "SCHEMA_VERSIONING_INVALID_MIGRATION", [...path, "direction"], "direction is invalid.");
  }
  if (typeof migration.deterministic !== "boolean") {
    addIssue(issues, "SCHEMA_VERSIONING_INVALID_MIGRATION", [...path, "deterministic"], "deterministic is invalid.");
  }
  if (typeof migration.lossy !== "boolean") {
    addIssue(issues, "SCHEMA_VERSIONING_INVALID_MIGRATION", [...path, "lossy"], "lossy is invalid.");
  }
  if (typeof migration.requiresContext !== "boolean") {
    addIssue(
      issues,
      "SCHEMA_VERSIONING_INVALID_MIGRATION",
      [...path, "requiresContext"],
      "requiresContext is invalid."
    );
  }
  if (migration.lossy === true && typeof migration.lossDescription !== "string") {
    addIssue(
      issues,
      "SCHEMA_VERSIONING_INVALID_MIGRATION",
      [...path, "lossDescription"],
      "lossDescription is required when lossy is true."
    );
  }
}

function isSchemaMigration(value: unknown): value is SchemaMigration {
  return (
    isRecord(value) &&
    isSchemaId(value.schemaId) &&
    isPositiveInteger(value.fromVersion) &&
    isPositiveInteger(value.toVersion) &&
    (value.direction === "upgrade" || value.direction === "downgrade") &&
    typeof value.deterministic === "boolean" &&
    typeof value.lossy === "boolean" &&
    typeof value.requiresContext === "boolean"
  );
}

function isSchemaVersionEntry(value: unknown): value is SchemaVersionEntry {
  return (
    isRecord(value) &&
    isPositiveInteger(value.schemaVersion) &&
    VERSION_ENTRY_STATUSES.has(value.status as SchemaVersionStatus) &&
    typeof value.jsonSchema === "string"
  );
}

function buildMigrationGraph(migrations: readonly SchemaMigration[] | undefined): Map<number, Set<number>> {
  const graph = new Map<number, Set<number>>();
  for (const migration of migrations ?? []) {
    let edges = graph.get(migration.fromVersion);
    if (edges === undefined) {
      edges = new Set<number>();
      graph.set(migration.fromVersion, edges);
    }
    edges.add(migration.toVersion);
  }
  return graph;
}

function hasPath(graph: Map<number, Set<number>>, from: number, to: number): boolean {
  if (from === to) {
    return true;
  }

  const seen = new Set<number>([from]);
  const queue: number[] = [from];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) {
      break;
    }
    const neighbors = graph.get(current);
    if (neighbors === undefined) {
      continue;
    }
    for (const next of neighbors) {
      if (next === to) {
        return true;
      }
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }

  return false;
}

function detectCycle(graph: Map<number, Set<number>>): boolean {
  const visiting = new Set<number>();
  const visited = new Set<number>();

  const visit = (node: number): boolean => {
    if (visited.has(node)) {
      return false;
    }
    if (visiting.has(node)) {
      return true;
    }

    visiting.add(node);
    for (const next of graph.get(node) ?? []) {
      if (visit(next)) {
        return true;
      }
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  };

  for (const node of graph.keys()) {
    if (visit(node)) {
      return true;
    }
  }

  return false;
}

export function inspectSchemaVersionDescriptor(value: unknown): readonly SchemaVersionIssue[] {
  const issues: SchemaVersionIssue[] = [];

  if (!isRecord(value)) {
    addIssue(issues, "SCHEMA_VERSIONING_NOT_OBJECT", [], "schema descriptor must be a JSON object.");
    mapJsonSafetyIssues(issues, inspectJsonSafety(value));
    return issues;
  }

  mapJsonSafetyIssues(issues, inspectJsonSafety(value));

  for (const key of Object.keys(value)) {
    if (!TOP_LEVEL_KEYS.has(key)) {
      addIssue(issues, "SCHEMA_VERSIONING_UNKNOWN_FIELD", [key], `unknown field "${key}" is not allowed.`);
    }
  }

  if (value.contractVersion === undefined) {
    addIssue(
      issues,
      "SCHEMA_VERSIONING_MISSING_CONTRACT_VERSION",
      ["contractVersion"],
      "contractVersion is required."
    );
  } else if (value.contractVersion !== CONTRACT_VERSION) {
    addIssue(
      issues,
      "SCHEMA_VERSIONING_INVALID_CONTRACT_VERSION",
      ["contractVersion"],
      `contractVersion must be ${CONTRACT_VERSION}.`
    );
  }

  const schemaId = value.schemaId;
  if (typeof schemaId !== "string") {
    addIssue(
      issues,
      "SCHEMA_VERSIONING_MISSING_SCHEMA_ID",
      ["schemaId"],
      "schemaId is required."
    );
  } else if (!isSchemaId(schemaId)) {
    addIssue(
      issues,
      "SCHEMA_VERSIONING_INVALID_SCHEMA_ID",
      ["schemaId"],
      "schemaId is invalid."
    );
  }

  const owningPackage = value.owningPackage;
  if (typeof owningPackage !== "string" || !isPackageName(owningPackage)) {
    addIssue(
      issues,
      "SCHEMA_VERSIONING_INVALID_OWNING_PACKAGE",
      ["owningPackage"],
      "owningPackage is invalid."
    );
  }

  if (!isRecord(value.contract)) {
    addIssue(issues, "SCHEMA_VERSIONING_INVALID_CONTRACT", ["contract"], "contract must be an object.");
  } else {
    for (const key of Object.keys(value.contract)) {
      if (!CONTRACT_KEYS.has(key)) {
        addIssue(
          issues,
          "SCHEMA_VERSIONING_INVALID_CONTRACT",
          ["contract", key],
          "contract contains an unknown field."
        );
      }
    }

    const contractId = value.contract.id;
    if (typeof contractId !== "string") {
      addIssue(
        issues,
        "SCHEMA_VERSIONING_INVALID_CONTRACT",
        ["contract", "id"],
        "contract.id is invalid."
      );
    } else if (!isSchemaId(contractId)) {
      addIssue(
        issues,
        "SCHEMA_VERSIONING_INVALID_CONTRACT",
        ["contract", "id"],
        "contract.id is invalid."
      );
    } else if (typeof schemaId === "string" && contractId !== schemaId) {
      addIssue(
        issues,
        "SCHEMA_VERSIONING_INVALID_CONTRACT",
        ["contract", "id"],
        "contract.id must match schemaId."
      );
    }

    const contractVersion = value.contract.version;
    if (typeof contractVersion !== "string") {
      addIssue(
        issues,
        "SCHEMA_VERSIONING_INVALID_CONTRACT",
        ["contract", "version"],
        "contract.version is invalid."
      );
    } else if (!isVersionRef(contractVersion)) {
      addIssue(
        issues,
        "SCHEMA_VERSIONING_INVALID_CONTRACT",
        ["contract", "version"],
        "contract.version is invalid."
      );
    }
  }

  if (!Array.isArray(value.versions) || value.versions.length === 0) {
    addIssue(
      issues,
      "SCHEMA_VERSIONING_INVALID_VERSION_ENTRY",
      ["versions"],
      "versions must be a non-empty array."
    );
  } else {
    const versions: number[] = [];
    const versionsValue = value.versions as readonly unknown[];
    for (let index = 0; index < versionsValue.length; index += 1) {
      const entry = versionsValue[index];
      validateSchemaVersionEntry(issues, entry, index);
      if (isSchemaVersionEntry(entry)) {
        versions.push(entry.schemaVersion);
      }
    }

    const sortedVersions = [...versions].sort((left, right) => left - right);
    if (versions.length !== sortedVersions.length || versions.some((version, index) => version !== sortedVersions[index])) {
      addIssue(
        issues,
        "SCHEMA_VERSIONING_INVALID_VERSION_ENTRY",
        ["versions"],
        "versions must be sorted by schemaVersion."
      );
    }

    if (new Set(versions).size !== versions.length) {
      addIssue(
        issues,
        "SCHEMA_VERSIONING_INVALID_VERSION_ENTRY",
        ["versions"],
        "versions must not contain duplicate schemaVersion values."
      );
    }
  }

  if (!isRecord(value.readerSupport)) {
    addIssue(
      issues,
      "SCHEMA_VERSIONING_INVALID_READER_SUPPORT",
      ["readerSupport"],
      "readerSupport must be an object."
    );
  } else {
    for (const key of Object.keys(value.readerSupport)) {
      if (!READER_SUPPORT_KEYS.has(key)) {
        addIssue(
          issues,
          "SCHEMA_VERSIONING_INVALID_READER_SUPPORT",
          ["readerSupport", key],
          "readerSupport contains an unknown field."
        );
      }
    }

    if (!isPositiveInteger(value.readerSupport.minVersion)) {
      addIssue(
        issues,
        "SCHEMA_VERSIONING_INVALID_READER_SUPPORT",
        ["readerSupport", "minVersion"],
        "minVersion is invalid."
      );
    }
    if (!isPositiveInteger(value.readerSupport.maxVersion)) {
      addIssue(
        issues,
        "SCHEMA_VERSIONING_INVALID_READER_SUPPORT",
        ["readerSupport", "maxVersion"],
        "maxVersion is invalid."
      );
    }
    if (
      isPositiveInteger(value.readerSupport.minVersion) &&
      isPositiveInteger(value.readerSupport.maxVersion) &&
      value.readerSupport.minVersion > value.readerSupport.maxVersion
    ) {
      addIssue(
        issues,
        "SCHEMA_VERSIONING_INVALID_READER_SUPPORT",
        ["readerSupport"],
        "minVersion must be less than or equal to maxVersion."
      );
    }
  }

  if (!isPositiveInteger(value.writerVersion)) {
    addIssue(
      issues,
      "SCHEMA_VERSIONING_INVALID_WRITER_VERSION",
      ["writerVersion"],
      "writerVersion is invalid."
    );
  }

  if (value.writerProfile !== undefined && !WRITER_PROFILES.has(value.writerProfile)) {
    addIssue(
      issues,
      "SCHEMA_VERSIONING_INVALID_WRITER_PROFILE",
      ["writerProfile"],
      "writerProfile is invalid."
    );
  }

  if (value.migrations !== undefined) {
    if (!Array.isArray(value.migrations)) {
      addIssue(
        issues,
        "SCHEMA_VERSIONING_INVALID_MIGRATION",
        ["migrations"],
        "migrations must be an array."
      );
    } else {
      const migrationsValue = value.migrations as readonly unknown[];
      for (let index = 0; index < migrationsValue.length; index += 1) {
        validateMigration(issues, migrationsValue[index], index);
      }

      const validMigrations: SchemaMigration[] = [];
      for (const migration of migrationsValue) {
        if (isSchemaMigration(migration)) {
          validMigrations.push(migration);
        }
      }

      const graph = buildMigrationGraph(validMigrations);
      if (detectCycle(graph)) {
        addIssue(
          issues,
          "SCHEMA_VERSIONING_INVALID_MIGRATION",
          ["migrations"],
          "migration graph must not contain cycles."
        );
      }
    }
  }

  if (isRecord(value.readerSupport) && Array.isArray(value.versions)) {
    const versionNumbers = new Set<number>();
    for (const entry of value.versions) {
      if (isSchemaVersionEntry(entry)) {
        versionNumbers.add(entry.schemaVersion);
      }
    }

    if (
      isPositiveInteger(value.readerSupport.minVersion) &&
      isPositiveInteger(value.readerSupport.maxVersion)
    ) {
      for (let version = value.readerSupport.minVersion; version <= value.readerSupport.maxVersion; version += 1) {
        if (!versionNumbers.has(version)) {
          addIssue(
            issues,
            "SCHEMA_VERSIONING_INVALID_READER_SUPPORT",
            ["readerSupport"],
            "readerSupport range must not skip schema versions."
          );
          break;
        }
      }
    }
  }

  if (Array.isArray(value.versions) && isPositiveInteger(value.writerVersion)) {
    let writerEntry: SchemaVersionEntry | undefined;
    for (const entry of value.versions) {
      if (isSchemaVersionEntry(entry) && entry.schemaVersion === value.writerVersion) {
        writerEntry = entry;
        break;
      }
    }
    if (writerEntry === undefined) {
      addIssue(
        issues,
        "SCHEMA_VERSIONING_INVALID_WRITER_VERSION",
        ["writerVersion"],
        "writerVersion must reference an existing version entry."
      );
    } else if ((value.writerProfile ?? "production") === "production" && writerEntry.status === "draft") {
      addIssue(
        issues,
        "SCHEMA_VERSIONING_INVALID_WRITER_VERSION",
        ["writerVersion"],
        "production writers must not target draft versions."
      );
    }
  }

  return issues;
}

export function isSchemaVersionDescriptor(value: unknown): value is SchemaDescriptor {
  return inspectSchemaVersionDescriptor(value).length === 0;
}

export function assertSchemaVersionDescriptor(value: unknown): asserts value is SchemaDescriptor {
  const issues = inspectSchemaVersionDescriptor(value);
  if (issues.length > 0) {
    throw new SchemaVersioningValidationError(issues);
  }
}

export function compareSchemaVersions(left: number, right: number): number {
  if (!isPositiveInteger(left) || !isPositiveInteger(right)) {
    throw new RangeError("schema versions must be positive integers.");
  }
  return left === right ? 0 : left < right ? -1 : 1;
}

export function checkSchemaCompatibility(
  descriptor: unknown,
  schemaVersion: unknown
): SchemaCompatibilityResult {
  if (!isSchemaVersionDescriptor(descriptor)) {
    return {
      status: "MISSING_SCHEMA",
      issues: inspectSchemaVersionDescriptor(descriptor)
    };
  }

  if (!isPositiveInteger(schemaVersion)) {
    return {
      status: "INVALID_VERSION",
      issues: [
        {
          code: "SCHEMA_VERSIONING_INVALID_VERSION",
          path: ["schemaVersion"],
          message: "schemaVersion must be a positive integer."
        }
      ]
    };
  }

  if (schemaVersion === descriptor.writerVersion) {
    return { status: "EXACT", issues: [] };
  }

  const { minVersion, maxVersion } = descriptor.readerSupport;
  if (schemaVersion >= minVersion && schemaVersion <= maxVersion) {
    return { status: "READABLE", issues: [] };
  }

  const graph = buildMigrationGraph(descriptor.migrations);
  if (hasPath(graph, schemaVersion, descriptor.writerVersion)) {
    return {
      status: "MIGRATION_REQUIRED",
      issues: [
        {
          code: "SCHEMA_VERSIONING_MIGRATION_REQUIRED",
          path: ["schemaVersion"],
          message: `Schema version ${String(schemaVersion)} requires migration to ${String(descriptor.writerVersion)}.`
        }
      ]
    };
  }

  if (schemaVersion > maxVersion) {
    return {
      status: "UNSUPPORTED_NEWER",
      issues: [
        {
          code: "SCHEMA_VERSIONING_UNSUPPORTED_NEWER",
          path: ["schemaVersion"],
          message: `Schema version ${String(schemaVersion)} is newer than supported range.`
        }
      ]
    };
  }

  return {
    status: "UNSUPPORTED_OLDER",
    issues: [
      {
        code: "SCHEMA_VERSIONING_UNSUPPORTED_OLDER",
        path: ["schemaVersion"],
        message: `Schema version ${String(schemaVersion)} is older than supported range.`
      }
    ]
  };
}

export function formatSchemaVersioningValidationMessage(issues: readonly SchemaVersionIssue[]): string {
  const firstIssue = issues[0];
  if (!firstIssue) {
    return "Schema versioning descriptor is valid.";
  }
  return `${firstIssue.code} @ ${formatJsonPath(firstIssue.path)}: ${firstIssue.message}`;
}
