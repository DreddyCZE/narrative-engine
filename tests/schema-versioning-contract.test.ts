import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const fixtureRoot = "tests/fixtures/contracts/schema-versioning";
const contractVersion = "schema-versioning@0.1.0";
const maxVersion = 2147483647;
const schemaIdPattern = /^[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,63}$/u;
const contractVersionPattern =
  /^[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,63}@[0-9]+\.[0-9]+\.[0-9]+(?:-[a-z0-9.-]+)?$/u;
const packagePattern = /^(?:@[a-z0-9._-]+\/[a-z0-9._-]+|[a-z0-9._-]+)$/u;
const schemaPathPattern =
  /^(?!\/)(?![A-Za-z]:)(?!.*(^|\/)\.\.?($|\/))[A-Za-z0-9._/-]+\.schema\.json$/u;
const migrationIdPattern = /^[a-z](?:[a-z0-9]|[._-](?=[a-z0-9])){1,119}$/u;
const hashPattern = /^sha256:[0-9a-f]{64}$/u;
const statuses = new Set(["draft", "accepted", "deprecated", "removed"]);
const directions = new Set(["upgrade", "downgrade"]);
const descriptorKeys = new Set([
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
const contractKeys = new Set(["id", "version"]);
const versionEntryKeys = new Set([
  "schemaVersion",
  "status",
  "jsonSchema",
  "schemaHash",
  "meaningHash",
  "deprecation"
]);
const readerKeys = new Set(["minVersion", "maxVersion"]);
const migrationKeys = new Set([
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
const deprecationKeys = new Set(["replacementSchemaKey", "reason", "lastSupportedBy"]);
const topLevelOrder = [
  "contractVersion",
  "schemaId",
  "owningPackage",
  "contract",
  "versions",
  "readerSupport",
  "writerVersion",
  "writerProfile",
  "migrations"
];
const versionEntryOrder = [
  "schemaVersion",
  "status",
  "jsonSchema",
  "schemaHash",
  "meaningHash",
  "deprecation"
];
const migrationOrder = [
  "migrationId",
  "schemaId",
  "fromVersion",
  "toVersion",
  "direction",
  "deterministic",
  "lossy",
  "lossDescription",
  "requiresContext"
];
const nestedOrder = [
  "id",
  "version",
  "minVersion",
  "maxVersion",
  "replacementSchemaKey",
  "reason",
  "lastSupportedBy"
];

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8")) as unknown;

const fixtureFiles = (kind: "valid" | "invalid" | "semantic-invalid"): string[] =>
  readdirSync(join(fixtureRoot, kind))
    .filter((name) => name.endsWith(".json"))
    .sort();

const isVersion = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= maxVersion;

const unknownKeys = (record: JsonRecord, allowed: Set<string>): string[] =>
  Object.keys(record)
    .filter((key) => !allowed.has(key))
    .sort();

const validateRequired = (
  record: JsonRecord,
  required: string[],
  rule: string,
  errors: string[]
): void => {
  for (const key of required) {
    if (!(key in record)) {
      errors.push(`${rule}:${key}`);
    }
  }
};

const versionEntries = (descriptor: JsonRecord): JsonRecord[] => {
  const versions = descriptor.versions;
  return Array.isArray(versions) ? versions.filter(isRecord) : [];
};

const migrationRecords = (descriptor: JsonRecord): JsonRecord[] => {
  const migrations = descriptor.migrations;
  return Array.isArray(migrations) ? migrations.filter(isRecord) : [];
};

const validateDescriptor = (value: unknown): string[] => {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return ["schema-versioning.descriptor.object"];
  }

  for (const key of unknownKeys(value, descriptorKeys)) {
    errors.push(`schema-versioning.unknown-field:${key}`);
  }
  validateRequired(
    value,
    ["contractVersion", "schemaId", "owningPackage", "contract", "versions", "readerSupport", "writerVersion"],
    "schema-versioning.descriptor.missing",
    errors
  );

  if (value.contractVersion !== contractVersion) {
    errors.push("schema-versioning.contract-version.invalid");
  }
  if (typeof value.schemaId !== "string" || !schemaIdPattern.test(value.schemaId)) {
    errors.push("schema-versioning.schema-id.invalid");
  }
  if (typeof value.owningPackage !== "string" || !packagePattern.test(value.owningPackage)) {
    errors.push("schema-versioning.owning-package.invalid");
  }
  if (value.writerProfile !== undefined && value.writerProfile !== "development" && value.writerProfile !== "production") {
    errors.push("schema-versioning.writer-profile.invalid");
  }
  validateContract(value.contract, errors);
  validateVersions(value.versions, errors);
  const readerRange = validateReaderSupport(value.readerSupport, errors);
  if (!isVersion(value.writerVersion)) {
    errors.push("schema-versioning.writer-version.invalid");
  } else if (readerRange !== null && (value.writerVersion < readerRange.minVersion || value.writerVersion > readerRange.maxVersion)) {
    errors.push("schema-versioning.writer.unsupported");
  }
  validateMigrations(value.migrations, typeof value.schemaId === "string" ? value.schemaId : "", errors);

  return errors;
};

const validateContract = (value: unknown, errors: string[]): void => {
  if (!isRecord(value)) {
    errors.push("schema-versioning.contract.invalid");
    return;
  }
  for (const key of unknownKeys(value, contractKeys)) {
    errors.push(`schema-versioning.contract.unknown-field:${key}`);
  }
  validateRequired(value, ["id", "version"], "schema-versioning.contract.missing", errors);
  if (typeof value.id !== "string" || !schemaIdPattern.test(value.id)) {
    errors.push("schema-versioning.contract.id.invalid");
  }
  if (typeof value.version !== "string" || !contractVersionPattern.test(value.version)) {
    errors.push("schema-versioning.contract.version.invalid");
  }
};

const validateVersions = (value: unknown, errors: string[]): void => {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push("schema-versioning.versions.invalid");
    return;
  }
  for (const entry of value) {
    validateVersionEntry(entry, errors);
  }
};

const validateVersionEntry = (value: unknown, errors: string[]): void => {
  if (!isRecord(value)) {
    errors.push("schema-versioning.version-entry.invalid");
    return;
  }
  for (const key of unknownKeys(value, versionEntryKeys)) {
    errors.push(`schema-versioning.version-entry.unknown-field:${key}`);
  }
  validateRequired(value, ["schemaVersion", "status", "jsonSchema"], "schema-versioning.version-entry.missing", errors);
  if (!isVersion(value.schemaVersion)) {
    errors.push("schema-versioning.schema-version.invalid");
  }
  if (typeof value.status !== "string" || !statuses.has(value.status)) {
    errors.push("schema-versioning.status.invalid");
  }
  if (typeof value.jsonSchema !== "string" || !schemaPathPattern.test(value.jsonSchema)) {
    errors.push("schema-versioning.json-schema.invalid");
  }
  if (typeof value.schemaHash === "string" && !hashPattern.test(value.schemaHash)) {
    errors.push("schema-versioning.schema-hash.invalid");
  }
  if (typeof value.meaningHash === "string" && !hashPattern.test(value.meaningHash)) {
    errors.push("schema-versioning.meaning-hash.invalid");
  }
  validateDeprecation(value, errors);
};

const validateReaderSupport = (
  value: unknown,
  errors: string[]
): { minVersion: number; maxVersion: number } | null => {
  if (!isRecord(value)) {
    errors.push("schema-versioning.reader.invalid");
    return null;
  }
  for (const key of unknownKeys(value, readerKeys)) {
    errors.push(`schema-versioning.reader.unknown-field:${key}`);
  }
  const minVersion = value.minVersion;
  const maxReaderVersion = value.maxVersion;
  if (!isVersion(minVersion)) {
    errors.push("schema-versioning.reader.min-version.invalid");
  }
  if (!isVersion(maxReaderVersion)) {
    errors.push("schema-versioning.reader.max-version.invalid");
  }
  if (!isVersion(minVersion) || !isVersion(maxReaderVersion)) {
    return null;
  }
  if (minVersion > maxReaderVersion) {
    errors.push("schema-versioning.reader.range.invalid");
  }
  return { minVersion, maxVersion: maxReaderVersion };
};

const validateMigrations = (value: unknown, schemaId: string, errors: string[]): void => {
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value)) {
    errors.push("schema-versioning.migrations.invalid");
    return;
  }
  for (const migration of value) {
    validateMigration(migration, schemaId, errors);
  }
};

const validateMigration = (value: unknown, schemaId: string, errors: string[]): void => {
  if (!isRecord(value)) {
    errors.push("schema-versioning.migration.invalid");
    return;
  }
  for (const key of unknownKeys(value, migrationKeys)) {
    errors.push(`schema-versioning.migration.unknown-field:${key}`);
  }
  validateRequired(
    value,
    ["migrationId", "schemaId", "fromVersion", "toVersion", "direction", "deterministic", "lossy", "requiresContext"],
    "schema-versioning.migration.missing",
    errors
  );
  if (typeof value.migrationId !== "string" || !migrationIdPattern.test(value.migrationId)) {
    errors.push("schema-versioning.migration-id.invalid");
  }
  if (value.schemaId !== schemaId) {
    errors.push("schema-versioning.migration.schema-id-mismatch");
  }
  if (!isVersion(value.fromVersion) || !isVersion(value.toVersion)) {
    errors.push("schema-versioning.migration.version.invalid");
  }
  if (isVersion(value.fromVersion) && isVersion(value.toVersion) && value.fromVersion === value.toVersion) {
    errors.push("schema-versioning.migration.same-version");
  }
  if (typeof value.direction !== "string" || !directions.has(value.direction)) {
    errors.push("schema-versioning.migration.direction.invalid");
  }
  if (typeof value.deterministic !== "boolean") {
    errors.push("schema-versioning.migration.deterministic.invalid");
  }
  if (typeof value.lossy !== "boolean") {
    errors.push("schema-versioning.migration.lossy.invalid");
  }
  if (typeof value.requiresContext !== "boolean") {
    errors.push("schema-versioning.migration.requires-context.invalid");
  }
  if (value.lossy === true && typeof value.lossDescription !== "string") {
    errors.push("schema-versioning.migration.loss-description.required");
  }
  if (value.lossy === false && value.lossDescription !== undefined) {
    errors.push("schema-versioning.migration.loss-description.forbidden");
  }
  if (isVersion(value.fromVersion) && isVersion(value.toVersion) && typeof value.direction === "string") {
    if (value.direction === "upgrade" && value.toVersion < value.fromVersion) {
      errors.push("schema-versioning.migration.direction.invalid");
    }
    if (value.direction === "downgrade" && value.toVersion > value.fromVersion) {
      errors.push("schema-versioning.migration.direction.invalid");
    }
  }
  if (value.direction === "upgrade" && value.deterministic !== true) {
    errors.push("schema-versioning.migration.deterministic.required");
  }
};

const validateDeprecation = (entry: JsonRecord, errors: string[]): void => {
  const value = entry.deprecation;
  if (entry.status === "deprecated" && value === undefined) {
    errors.push("schema-versioning.deprecation.required");
    return;
  }
  if (value === undefined) {
    return;
  }
  if (!isRecord(value)) {
    errors.push("schema-versioning.deprecation.invalid");
    return;
  }
  for (const key of unknownKeys(value, deprecationKeys)) {
    errors.push(`schema-versioning.deprecation.unknown-field:${key}`);
  }
  validateRequired(value, ["replacementSchemaKey", "reason"], "schema-versioning.deprecation.missing", errors);
  if (typeof value.replacementSchemaKey !== "string" || !/^[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,63}@[1-9][0-9]*$/u.test(value.replacementSchemaKey)) {
    errors.push("schema-versioning.deprecation.replacement.invalid");
  }
  if (typeof value.reason !== "string" || value.reason.length === 0) {
    errors.push("schema-versioning.deprecation.reason.invalid");
  }
};

const semanticErrors = (value: unknown): string[] => {
  if (!isRecord(value)) {
    return ["schema-versioning.semantic.descriptor.invalid"];
  }
  const errors: string[] = [];
  const entries = versionEntries(value);
  const entryVersions = new Map<number, JsonRecord>();
  const schemaId = typeof value.schemaId === "string" ? value.schemaId : "";

  for (const entry of entries) {
    const schemaVersion = entry.schemaVersion;
    if (!isVersion(schemaVersion)) {
      continue;
    }
    const existing = entryVersions.get(schemaVersion);
    if (existing !== undefined) {
      errors.push("schema-versioning.registry.duplicate-schema-key");
      if (
        existing.schemaHash !== entry.schemaHash ||
        existing.meaningHash !== entry.meaningHash ||
        existing.status === "removed" ||
        entry.status === "removed"
      ) {
        errors.push("schema-versioning.registry.version-reused");
      }
    }
    entryVersions.set(schemaVersion, entry);
  }

  const readerSupport = isRecord(value.readerSupport) ? value.readerSupport : {};
  if (isVersion(readerSupport.minVersion) && isVersion(readerSupport.maxVersion)) {
    for (let version = readerSupport.minVersion; version <= readerSupport.maxVersion; version += 1) {
      if (!entryVersions.has(version)) {
        errors.push("schema-versioning.reader.range.missing-version");
      }
    }
  }

  if (isVersion(value.writerVersion)) {
    const writerEntry = entryVersions.get(value.writerVersion);
    if (writerEntry === undefined) {
      errors.push("schema-versioning.writer.missing-schema-version");
    } else if ((value.writerProfile ?? "production") === "production" && writerEntry.status === "draft") {
      errors.push("schema-versioning.writer.draft-production");
    }
  }

  errors.push(...migrationGraphErrors(value, schemaId, entryVersions));
  return [...new Set(errors)].sort();
};

const migrationGraphErrors = (
  descriptor: JsonRecord,
  schemaId: string,
  entryVersions: Map<number, JsonRecord>
): string[] => {
  const errors: string[] = [];
  const migrations = migrationRecords(descriptor);
  const ids = new Set<string>();
  const edgeKeys = new Set<string>();
  const edges = new Map<number, number[]>();
  const canonicalEdges = new Map<number, number>();

  for (const migration of migrations) {
    if (typeof migration.migrationId === "string") {
      if (ids.has(migration.migrationId)) {
        errors.push("schema-versioning.migration.duplicate-id");
      }
      ids.add(migration.migrationId);
    }
    if (migration.schemaId !== schemaId) {
      errors.push("schema-versioning.migration.schema-id-mismatch");
    }
    if (!isVersion(migration.fromVersion) || !isVersion(migration.toVersion)) {
      continue;
    }
    if (!entryVersions.has(migration.fromVersion) || !entryVersions.has(migration.toVersion)) {
      errors.push("schema-versioning.migration.missing-schema-key");
    }
    const edgeKey = `${String(migration.fromVersion)}>${String(migration.toVersion)}`;
    if (edgeKeys.has(edgeKey)) {
      errors.push("schema-versioning.migration.duplicate-edge");
    }
    edgeKeys.add(edgeKey);
    const existing = edges.get(migration.fromVersion) ?? [];
    existing.push(migration.toVersion);
    edges.set(migration.fromVersion, existing);
    if (migration.direction === "upgrade" && migration.toVersion > migration.fromVersion) {
      const existingCanonical = canonicalEdges.get(migration.fromVersion);
      if (existingCanonical !== undefined && existingCanonical !== migration.toVersion) {
        errors.push("schema-versioning.migration.path.ambiguous");
      }
      canonicalEdges.set(migration.fromVersion, migration.toVersion);
    }
  }

  if (hasCycle(edges)) {
    errors.push("schema-versioning.migration.cycle");
  }

  const readerSupport = descriptor.readerSupport;
  if (isRecord(readerSupport) && isVersion(readerSupport.minVersion) && isVersion(readerSupport.maxVersion)) {
    for (let version = readerSupport.minVersion; version < readerSupport.maxVersion; version += 1) {
      if (!migrations.some((migration) => migration.fromVersion === version && migration.toVersion === version + 1 && migration.direction === "upgrade")) {
        errors.push("schema-versioning.migration.path.missing-step");
      }
    }
  }

  return errors;
};

const hasCycle = (edges: Map<number, number[]>): boolean => {
  const visiting = new Set<number>();
  const visited = new Set<number>();

  const visit = (node: number): boolean => {
    if (visiting.has(node)) {
      return true;
    }
    if (visited.has(node)) {
      return false;
    }
    visiting.add(node);
    for (const next of edges.get(node) ?? []) {
      if (visit(next)) {
        return true;
      }
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  };

  for (const node of edges.keys()) {
    if (visit(node)) {
      return true;
    }
  }
  return false;
};

const sortedRecordEntries = (record: JsonRecord): [string, unknown][] =>
  Object.entries(record).sort(([left], [right]) => {
    const order =
      typeof record.migrationId === "string"
        ? migrationOrder
        : typeof record.schemaVersion === "number"
          ? versionEntryOrder
          : topLevelOrder.concat(nestedOrder);
    const leftIndex = order.indexOf(left);
    const rightIndex = order.indexOf(right);
    if (leftIndex !== -1 || rightIndex !== -1) {
      return (
        (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) -
        (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex)
      );
    }
    return left.localeCompare(right);
  });

const stableNormalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    const entries = value.filter(
      (item): item is JsonRecord => isRecord(item) && isVersion(item.schemaVersion)
    );
    if (entries.length === value.length) {
      return entries
        .sort((left, right) => {
          const leftVersion = isVersion(left.schemaVersion) ? left.schemaVersion : 0;
          const rightVersion = isVersion(right.schemaVersion) ? right.schemaVersion : 0;
          return leftVersion - rightVersion;
        })
        .map(stableNormalize);
    }
    const migrations = value.filter(
      (item): item is JsonRecord => isRecord(item) && typeof item.migrationId === "string"
    );
    if (migrations.length === value.length) {
      return migrations
        .sort((left, right) => {
          const leftSchema = typeof left.schemaId === "string" ? left.schemaId : "";
          const rightSchema = typeof right.schemaId === "string" ? right.schemaId : "";
          if (leftSchema !== rightSchema) {
            return leftSchema.localeCompare(rightSchema);
          }
          const leftFrom = isVersion(left.fromVersion) ? left.fromVersion : 0;
          const rightFrom = isVersion(right.fromVersion) ? right.fromVersion : 0;
          if (leftFrom !== rightFrom) {
            return leftFrom - rightFrom;
          }
          const leftTo = isVersion(left.toVersion) ? left.toVersion : 0;
          const rightTo = isVersion(right.toVersion) ? right.toVersion : 0;
          if (leftTo !== rightTo) {
            return leftTo - rightTo;
          }
          return String(left.migrationId).localeCompare(String(right.migrationId));
        })
        .map(stableNormalize);
    }
    return value.map(stableNormalize);
  }
  if (isRecord(value)) {
    return Object.fromEntries(sortedRecordEntries(value).map(([key, item]) => [key, stableNormalize(item)]));
  }
  return value;
};

const stableStringify = (value: unknown): string => `${JSON.stringify(stableNormalize(value), null, 2)}\n`;

const compatibilityResult = (
  descriptor: unknown,
  schemaId: unknown,
  schemaVersion: unknown
): string => {
  if (!isRecord(descriptor) || typeof schemaId !== "string" || descriptor.schemaId !== schemaId) {
    return "MISSING_SCHEMA";
  }
  if (!isVersion(schemaVersion)) {
    return "INVALID_VERSION";
  }
  const readerSupport = descriptor.readerSupport;
  if (!isRecord(readerSupport) || !isVersion(readerSupport.minVersion) || !isVersion(readerSupport.maxVersion)) {
    return "MISSING_SCHEMA";
  }
  if (schemaVersion === descriptor.writerVersion) {
    return "EXACT";
  }
  if (schemaVersion >= readerSupport.minVersion && schemaVersion <= readerSupport.maxVersion) {
    return "READABLE";
  }
  if (hasMigrationPath(descriptor, schemaVersion, isVersion(descriptor.writerVersion) ? descriptor.writerVersion : readerSupport.maxVersion)) {
    return "MIGRATION_REQUIRED";
  }
  if (schemaVersion > readerSupport.maxVersion) {
    return "UNSUPPORTED_NEWER";
  }
  return "UNSUPPORTED_OLDER";
};

const hasMigrationPath = (descriptor: JsonRecord, fromVersion: number, toVersion: number): boolean => {
  const migrations = migrationRecords(descriptor);
  const visited = new Set<number>();
  const visit = (version: number): boolean => {
    if (version === toVersion) {
      return true;
    }
    if (visited.has(version)) {
      return false;
    }
    visited.add(version);
    for (const migration of migrations) {
      if (migration.fromVersion === version && migration.direction === "upgrade" && isVersion(migration.toVersion)) {
        if (visit(migration.toVersion)) {
          return true;
        }
      }
    }
    return false;
  };
  return visit(fromVersion);
};

describe("Schema Versioning Contract", () => {
  it("accepts all valid fixtures", () => {
    for (const file of fixtureFiles("valid")) {
      const value = readJson(join(fixtureRoot, "valid", file));
      expect(validateDescriptor(value), file).toEqual([]);
      expect(semanticErrors(value), file).toEqual([]);
    }
  });

  it("rejects invalid fixtures with expected rule IDs", () => {
    const expectedRules = new Map([
      ["downgrade-marked-downgrade-wrong-way.json", "schema-versioning.migration.direction.invalid"],
      ["downgrade-marked-upgrade.json", "schema-versioning.migration.direction.invalid"],
      ["invalid-status.json", "schema-versioning.status.invalid"],
      ["lossy-false-with-description.json", "schema-versioning.migration.loss-description.forbidden"],
      ["lossy-migration-without-description.json", "schema-versioning.migration.loss-description.required"],
      ["migration-same-from-to.json", "schema-versioning.migration.same-version"],
      ["migration-schema-id-mismatch.json", "schema-versioning.migration.schema-id-mismatch"],
      ["missing-schema-id.json", "schema-versioning.descriptor.missing:schemaId"],
      ["reader-min-greater-than-max.json", "schema-versioning.reader.range.invalid"],
      ["schema-version-decimal.json", "schema-versioning.schema-version.invalid"],
      ["schema-version-negative.json", "schema-versioning.schema-version.invalid"],
      ["schema-version-string.json", "schema-versioning.schema-version.invalid"],
      ["schema-version-zero.json", "schema-versioning.schema-version.invalid"],
      ["unknown-field.json", "schema-versioning.unknown-field:unexpected"],
      ["writer-outside-range.json", "schema-versioning.writer.unsupported"]
    ]);

    for (const file of fixtureFiles("invalid")) {
      const value = readJson(join(fixtureRoot, "invalid", file));
      const expectedRule = expectedRules.get(file);
      expect(expectedRule, file).toBeDefined();
      expect(validateDescriptor(value), file).toContain(expectedRule);
    }
  });

  it("detects semantic-invalid migration and registry fixtures", () => {
    const expectedRules = new Map([
      ["ambiguous-canonical-path.json", "schema-versioning.migration.path.ambiguous"],
      ["duplicate-schema-version.json", "schema-versioning.registry.duplicate-schema-key"],
      ["migration-cycle.json", "schema-versioning.migration.cycle"],
      ["missing-upgrade-step.json", "schema-versioning.migration.path.missing-step"],
      ["production-writer-draft-version.json", "schema-versioning.writer.draft-production"],
      ["reader-range-missing-inner-version.json", "schema-versioning.reader.range.missing-version"],
      ["removed-version-reused.json", "schema-versioning.registry.version-reused"],
      ["reused-version-different-hash.json", "schema-versioning.registry.version-reused"],
      ["writer-version-missing-entry.json", "schema-versioning.writer.missing-schema-version"]
    ]);

    for (const file of fixtureFiles("semantic-invalid")) {
      const value = readJson(join(fixtureRoot, "semantic-invalid", file));
      const expectedRule = expectedRules.get(file);
      expect(expectedRule, file).toBeDefined();
      expect(semanticErrors(value), file).toContain(expectedRule);
    }
  });

  it("requires versions to be positive bounded integers", () => {
    expect(isVersion(1)).toBe(true);
    expect(isVersion(maxVersion)).toBe(true);
    expect(isVersion(0)).toBe(false);
    expect(isVersion(-1)).toBe(false);
    expect(isVersion(1.5)).toBe(false);
    expect(isVersion("1")).toBe(false);
    expect(isVersion(maxVersion + 1)).toBe(false);
  });

  it("resolves compatibility statuses by documented priority", () => {
    const descriptor = readJson(join(fixtureRoot, "valid", "reader-range.json"));
    const migratable = {
      contractVersion,
      schemaId: "migratable-schema",
      owningPackage: "@narrative-engine/engine-contracts",
      contract: {
        id: "migratable-schema",
        version: "migratable-schema@0.1.0"
      },
      versions: [
        { schemaVersion: 1, status: "accepted", jsonSchema: "schemas/migratable-schema.v1.schema.json" },
        { schemaVersion: 2, status: "accepted", jsonSchema: "schemas/migratable-schema.v2.schema.json" },
        { schemaVersion: 3, status: "accepted", jsonSchema: "schemas/migratable-schema.schema.json" }
      ],
      readerSupport: {
        minVersion: 2,
        maxVersion: 3
      },
      writerVersion: 3,
      migrations: [
        {
          migrationId: "migratable-schema.1-to-2",
          schemaId: "migratable-schema",
          fromVersion: 1,
          toVersion: 2,
          direction: "upgrade",
          deterministic: true,
          lossy: false,
          requiresContext: false
        },
        {
          migrationId: "migratable-schema.2-to-3",
          schemaId: "migratable-schema",
          fromVersion: 2,
          toVersion: 3,
          direction: "upgrade",
          deterministic: true,
          lossy: false,
          requiresContext: false
        }
      ]
    };

    expect(compatibilityResult(undefined, "game-manifest", 1)).toBe("MISSING_SCHEMA");
    expect(compatibilityResult(descriptor, "missing-schema", 1)).toBe("MISSING_SCHEMA");
    expect(compatibilityResult(descriptor, "game-manifest", "1")).toBe("INVALID_VERSION");
    expect(compatibilityResult(descriptor, "game-manifest", 3)).toBe("EXACT");
    expect(compatibilityResult(descriptor, "game-manifest", 1)).toBe("READABLE");
    expect(compatibilityResult(migratable, "migratable-schema", 1)).toBe("MIGRATION_REQUIRED");
    expect(compatibilityResult(descriptor, "game-manifest", 4)).toBe("UNSUPPORTED_NEWER");
    expect(compatibilityResult(descriptor, "game-manifest", 0)).toBe("INVALID_VERSION");
  });

  it("requires reader range consistency, registered versions, and writer support", () => {
    const valid = readJson(join(fixtureRoot, "valid", "reader-range.json"));
    const invalidRange = readJson(join(fixtureRoot, "invalid", "reader-min-greater-than-max.json"));
    const invalidWriter = readJson(join(fixtureRoot, "invalid", "writer-outside-range.json"));
    const missingInnerVersion = readJson(join(fixtureRoot, "semantic-invalid", "reader-range-missing-inner-version.json"));
    const missingWriterEntry = readJson(join(fixtureRoot, "semantic-invalid", "writer-version-missing-entry.json"));

    expect(validateDescriptor(valid)).toEqual([]);
    expect(validateDescriptor(invalidRange)).toContain("schema-versioning.reader.range.invalid");
    expect(validateDescriptor(invalidWriter)).toContain("schema-versioning.writer.unsupported");
    expect(semanticErrors(missingInnerVersion)).toContain("schema-versioning.reader.range.missing-version");
    expect(semanticErrors(missingWriterEntry)).toContain("schema-versioning.writer.missing-schema-version");
  });

  it("requires migration direction to match version movement and schema ID", () => {
    const upgrade = readJson(join(fixtureRoot, "valid", "migration-upgrade.json"));
    const badDirection = readJson(join(fixtureRoot, "invalid", "downgrade-marked-upgrade.json"));
    const badDowngrade = readJson(join(fixtureRoot, "invalid", "downgrade-marked-downgrade-wrong-way.json"));
    const schemaMismatch = readJson(join(fixtureRoot, "invalid", "migration-schema-id-mismatch.json"));

    expect(validateDescriptor(upgrade)).toEqual([]);
    expect(validateDescriptor(badDirection)).toContain("schema-versioning.migration.direction.invalid");
    expect(validateDescriptor(badDowngrade)).toContain("schema-versioning.migration.direction.invalid");
    expect(validateDescriptor(schemaMismatch)).toContain("schema-versioning.migration.schema-id-mismatch");
  });

  it("detects graph cycles, missing steps, duplicate paths, and version reuse", () => {
    const valid = readJson(join(fixtureRoot, "valid", "reader-range.json"));
    const cycle = readJson(join(fixtureRoot, "semantic-invalid", "migration-cycle.json"));
    const missingStep = readJson(join(fixtureRoot, "semantic-invalid", "missing-upgrade-step.json"));
    const ambiguousPath = readJson(join(fixtureRoot, "semantic-invalid", "ambiguous-canonical-path.json"));
    const reusedVersion = readJson(join(fixtureRoot, "semantic-invalid", "reused-version-different-hash.json"));

    expect(semanticErrors(valid)).toEqual([]);
    expect(semanticErrors(cycle)).toContain("schema-versioning.migration.cycle");
    expect(semanticErrors(missingStep)).toContain("schema-versioning.migration.path.missing-step");
    expect(semanticErrors(ambiguousPath)).toContain("schema-versioning.migration.path.ambiguous");
    expect(semanticErrors(reusedVersion)).toContain("schema-versioning.registry.version-reused");
  });

  it("keeps canonical descriptor serialization stable and idempotent", () => {
    const filePath = join(fixtureRoot, "valid", "migration-upgrade.json");
    const canonical = readJson(filePath);
    const raw = readFileSync(filePath, "utf8");
    const unordered = {
      migrations: [
        {
          requiresContext: false,
          lossy: false,
          deterministic: true,
          direction: "upgrade",
          toVersion: 2,
          fromVersion: 1,
          schemaId: "condition-data",
          migrationId: "condition-data.1-to-2"
        }
      ],
      writerVersion: 2,
      readerSupport: {
        maxVersion: 2,
        minVersion: 1
      },
      versions: [
        {
          jsonSchema: "schemas/condition-data.schema.json",
          status: "accepted",
          schemaVersion: 2
        },
        {
          jsonSchema: "schemas/condition-data.v1.schema.json",
          status: "accepted",
          schemaVersion: 1
        }
      ],
      contract: {
        version: "condition-data@0.1.0",
        id: "condition-data"
      },
      owningPackage: "@narrative-engine/engine-contracts",
      schemaId: "condition-data",
      contractVersion
    };

    expect(stableStringify(canonical)).toBe(raw);
    expect(stableStringify(unordered)).toBe(raw);
    expect(stableStringify(JSON.parse(stableStringify(unordered)) as unknown)).toBe(raw);
  });

  it("sorts version entries numerically, not lexicographically", () => {
    const descriptor = {
      versions: [
        { schemaVersion: 10, status: "accepted", jsonSchema: "schemas/example.v10.schema.json" },
        { schemaVersion: 2, status: "accepted", jsonSchema: "schemas/example.v2.schema.json" },
        { schemaVersion: 1, status: "accepted", jsonSchema: "schemas/example.v1.schema.json" }
      ]
    };
    const normalized = stableNormalize(descriptor);

    expect(isRecord(normalized)).toBe(true);
    if (!isRecord(normalized) || !Array.isArray(normalized.versions)) {
      return;
    }
    expect(normalized.versions.map((entry) => (isRecord(entry) ? entry.schemaVersion : undefined))).toEqual([1, 2, 10]);
  });

  it("keeps Entity Identity schemaVersion compatible with this contract", () => {
    const entityIdentitySchema = readJson("schemas/entity-identity.schema.json");
    const entityIdentityFixture = readJson("tests/fixtures/contracts/entity-identity/valid/minimal.json");
    const entityIdentityDescriptor = readJson(join(fixtureRoot, "valid", "schema-version-1.json"));

    expect(isRecord(entityIdentitySchema)).toBe(true);
    expect(isRecord(entityIdentityFixture)).toBe(true);
    if (!isRecord(entityIdentitySchema) || !isRecord(entityIdentityFixture)) {
      return;
    }

    const properties = entityIdentitySchema.properties;
    expect(isRecord(properties)).toBe(true);
    if (!isRecord(properties)) {
      return;
    }
    const schemaVersionProperty = properties.schemaVersion;
    expect(isRecord(schemaVersionProperty)).toBe(true);
    if (!isRecord(schemaVersionProperty)) {
      return;
    }
    expect(schemaVersionProperty.type).toBe("integer");
    expect(schemaVersionProperty.minimum).toBe(1);
    expect(isVersion(entityIdentityFixture.schemaVersion)).toBe(true);
    expect(semanticErrors(entityIdentityDescriptor)).toEqual([]);
  });

  it("aligns the descriptor JSON Schema with the draft contract shape", () => {
    const schema = readJson("schemas/schema-versioning.schema.json");
    expect(isRecord(schema)).toBe(true);
    if (!isRecord(schema)) {
      return;
    }
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual([
      "contractVersion",
      "schemaId",
      "owningPackage",
      "contract",
      "versions",
      "readerSupport",
      "writerVersion"
    ]);
  });
});
