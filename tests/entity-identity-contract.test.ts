import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const fixtureRoot = "tests/fixtures/contracts/entity-identity";
const contractVersion = "entity-identity@0.1.0";
const idPattern =
  /^[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,31}\.[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,47}\.[a-z0-9](?:[a-z0-9]|[_-](?=[a-z0-9])){0,79}$/u;
const segmentPattern = /^[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,47}$/u;
const tagPattern = /^[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,31}$/u;
const commitPattern = /^[0-9a-f]{7,40}$/u;
const taskPattern = /^[A-Z]+-[0-9]{3,5}$/u;
const stableTextPattern = /^[A-Za-z0-9._/@:-]+$/u;
const sourceFilePattern =
  /^(?!\/)(?![A-Za-z]:)(?!.*(^|\/)\.\.?($|\/))[A-Za-z0-9._/-]+$/u;
const approvalStates = new Set(["draft", "ai-draft", "human-edited", "approved", "canonical"]);
const aliasReasons = new Set(["renamed", "split", "merged", "legacy-import", "migration"]);
const identityKeys = new Set([
  "contractVersion",
  "id",
  "entityType",
  "namespace",
  "schemaVersion",
  "tags",
  "aliases",
  "provenance",
  "change"
]);
const aliasKeys = new Set(["id", "reason", "sinceSchemaVersion", "removeAfterSchemaVersion"]);
const provenanceKeys = new Set([
  "sourceFile",
  "sourceEntityId",
  "sourceRevision",
  "sourceLine",
  "generatedBy",
  "taskId",
  "commit",
  "approvalState"
]);
const changeKeys = new Set(["revision", "createdBy", "updatedBy"]);
const keyOrder = [
  "contractVersion",
  "id",
  "entityType",
  "namespace",
  "schemaVersion",
  "tags",
  "aliases",
  "provenance",
  "change"
];
const nestedKeyOrder = [
  "id",
  "reason",
  "sinceSchemaVersion",
  "removeAfterSchemaVersion",
  "sourceFile",
  "sourceEntityId",
  "sourceRevision",
  "sourceLine",
  "generatedBy",
  "taskId",
  "commit",
  "approvalState",
  "revision",
  "createdBy",
  "updatedBy"
];

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8")) as unknown;

const fixtureFiles = (kind: "valid" | "invalid"): string[] =>
  readdirSync(join(fixtureRoot, kind))
    .filter((name) => name.endsWith(".json"))
    .sort();

const duplicateValues = (values: string[]): string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }
  return [...duplicates].sort();
};

const isSorted = (values: string[]): boolean =>
  values.every((value, index) => index === 0 || values[index - 1] <= value);

const splitId = (id: string): [string, string, string] | null => {
  const parts = id.split(".");
  if (parts.length !== 3) {
    return null;
  }
  return [parts[0], parts[1], parts[2]];
};

const validateIdentity = (value: unknown): string[] => {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return ["identity.object"];
  }

  for (const key of Object.keys(value)) {
    if (!identityKeys.has(key)) {
      errors.push("entity-identity.unknown-field");
    }
  }

  const id = value.id;
  const entityType = value.entityType;
  const namespace = value.namespace;
  const schemaVersion = value.schemaVersion;

  if (value.contractVersion !== contractVersion) {
    errors.push("entity-identity.contract-version.invalid");
  }

  if (typeof id !== "string" || !idPattern.test(id)) {
    errors.push("entity-identity.id.pattern");
  }

  if (typeof entityType !== "string" || !segmentPattern.test(entityType)) {
    errors.push("entity-identity.entity-type.invalid");
  }

  if (typeof namespace !== "string" || !segmentPattern.test(namespace)) {
    errors.push("entity-identity.namespace.invalid");
  }

  if (!Number.isInteger(schemaVersion) || typeof schemaVersion !== "number" || schemaVersion < 1) {
    errors.push("entity-identity.schema-version.invalid");
  }

  if (typeof id === "string" && typeof entityType === "string" && idPattern.test(id)) {
    const parts = splitId(id);
    if (parts !== null && parts[0] !== entityType) {
      errors.push("entity-identity.entity-type.prefix-mismatch");
    }
  }

  if (typeof id === "string" && typeof namespace === "string" && idPattern.test(id)) {
    const parts = splitId(id);
    if (parts !== null && parts[1] !== namespace) {
      errors.push("entity-identity.namespace.prefix-mismatch");
    }
  }

  validateTags(value.tags, errors);
  validateAliases(value.aliases, typeof id === "string" ? id : "", errors);
  validateProvenance(value.provenance, errors);
  validateChange(value.change, errors);

  return errors;
};

const validateTags = (value: unknown, errors: string[]): void => {
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value)) {
    errors.push("entity-identity.tag.invalid");
    return;
  }
  const tags: string[] = [];
  for (const tag of value) {
    if (typeof tag !== "string" || !tagPattern.test(tag)) {
      errors.push("entity-identity.tag.invalid");
      continue;
    }
    tags.push(tag);
  }
  if (duplicateValues(tags).length > 0) {
    errors.push("entity-identity.tag.duplicate");
  }
  if (!isSorted(tags)) {
    errors.push("entity-identity.tag.order");
  }
};

const validateAliases = (value: unknown, canonicalId: string, errors: string[]): void => {
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value)) {
    errors.push("entity-identity.alias.invalid");
    return;
  }
  const aliasIds: string[] = [];
  for (const alias of value) {
    if (!isRecord(alias)) {
      errors.push("entity-identity.alias.invalid");
      continue;
    }
    for (const key of Object.keys(alias)) {
      if (!aliasKeys.has(key)) {
        errors.push("entity-identity.alias.invalid");
      }
    }
    if (typeof alias.id !== "string" || !idPattern.test(alias.id)) {
      errors.push("entity-identity.alias.invalid");
    } else {
      aliasIds.push(alias.id);
      if (alias.id === canonicalId) {
        errors.push("entity-identity.alias.self");
      }
    }
    if (typeof alias.reason !== "string" || !aliasReasons.has(alias.reason)) {
      errors.push("entity-identity.alias.invalid");
    }
    if (
      !Number.isInteger(alias.sinceSchemaVersion) ||
      typeof alias.sinceSchemaVersion !== "number" ||
      alias.sinceSchemaVersion < 1
    ) {
      errors.push("entity-identity.alias.invalid");
    }
  }
  if (duplicateValues(aliasIds).length > 0) {
    errors.push("entity-identity.alias.duplicate");
  }
  if (!isSorted(aliasIds)) {
    errors.push("entity-identity.alias.order");
  }
};

const validateProvenance = (value: unknown, errors: string[]): void => {
  if (value === undefined) {
    return;
  }
  if (!isRecord(value)) {
    errors.push("entity-identity.provenance.invalid");
    return;
  }
  for (const key of Object.keys(value)) {
    if (!provenanceKeys.has(key)) {
      errors.push("entity-identity.provenance.invalid");
    }
  }
  if (typeof value.sourceFile === "string" && !sourceFilePattern.test(value.sourceFile)) {
    errors.push("entity-identity.provenance.invalid");
  }
  if (typeof value.sourceEntityId === "string" && !idPattern.test(value.sourceEntityId)) {
    errors.push("entity-identity.provenance.invalid");
  }
  if (typeof value.sourceRevision === "string" && !stableTextPattern.test(value.sourceRevision)) {
    errors.push("entity-identity.provenance.invalid");
  }
  if (
    value.sourceLine !== undefined &&
    (!Number.isInteger(value.sourceLine) || typeof value.sourceLine !== "number" || value.sourceLine < 1)
  ) {
    errors.push("entity-identity.provenance.invalid");
  }
  if (typeof value.generatedBy === "string" && !stableTextPattern.test(value.generatedBy)) {
    errors.push("entity-identity.provenance.invalid");
  }
  if (typeof value.taskId === "string" && !taskPattern.test(value.taskId)) {
    errors.push("entity-identity.provenance.invalid");
  }
  if (typeof value.commit === "string" && !commitPattern.test(value.commit)) {
    errors.push("entity-identity.provenance.invalid");
  }
  if (typeof value.approvalState === "string" && !approvalStates.has(value.approvalState)) {
    errors.push("entity-identity.provenance.invalid");
  }
};

const validateChange = (value: unknown, errors: string[]): void => {
  if (value === undefined) {
    return;
  }
  if (!isRecord(value)) {
    errors.push("entity-identity.change.invalid");
    return;
  }
  for (const key of Object.keys(value)) {
    if (!changeKeys.has(key)) {
      errors.push("entity-identity.change.invalid");
    }
  }
  if (
    value.revision !== undefined &&
    (!Number.isInteger(value.revision) || typeof value.revision !== "number" || value.revision < 1)
  ) {
    errors.push("entity-identity.change.invalid");
  }
};

const sortedRecordEntries = (record: JsonRecord): [string, unknown][] => {
  const orderedKeys = [...keyOrder, ...nestedKeyOrder];
  return Object.entries(record).sort(([left], [right]) => {
    const leftIndex = orderedKeys.indexOf(left);
    const rightIndex = orderedKeys.indexOf(right);
    if (leftIndex !== -1 || rightIndex !== -1) {
      return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
    }
    return left.localeCompare(right);
  });
};

const stableNormalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    const strings = value.filter((item): item is string => typeof item === "string");
    if (strings.length === value.length) {
      return strings.sort();
    }
    const recordsWithIds = value.filter(
      (item): item is JsonRecord => isRecord(item) && typeof item.id === "string"
    );
    if (recordsWithIds.length === value.length) {
      return recordsWithIds
        .sort((left, right) => {
          const leftId = typeof left.id === "string" ? left.id : "";
          const rightId = typeof right.id === "string" ? right.id : "";
          return leftId.localeCompare(rightId);
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

const semanticAliasCycleErrors = (entities: unknown): string[] => {
  if (!Array.isArray(entities)) {
    return ["entity-identity.alias.cycle-fixture.invalid"];
  }
  const aliasToCanonical = new Map<string, string>();
  for (const entity of entities) {
    if (!isRecord(entity) || typeof entity.id !== "string" || !Array.isArray(entity.aliases)) {
      continue;
    }
    for (const alias of entity.aliases) {
      if (isRecord(alias) && typeof alias.id === "string") {
        aliasToCanonical.set(alias.id, entity.id);
      }
    }
  }

  for (const alias of aliasToCanonical.keys()) {
    const seen = new Set<string>();
    let current: string | undefined = alias;
    while (current !== undefined) {
      if (seen.has(current)) {
        return ["entity-identity.alias.cycle"];
      }
      seen.add(current);
      current = aliasToCanonical.get(current);
    }
  }

  return [];
};

const semanticAliasChainErrors = (entities: unknown): string[] => {
  if (!Array.isArray(entities)) {
    return ["entity-identity.alias.chain-fixture.invalid"];
  }
  const canonicalIds = new Set<string>();
  const aliasIds = new Set<string>();
  for (const entity of entities) {
    if (!isRecord(entity) || typeof entity.id !== "string") {
      continue;
    }
    canonicalIds.add(entity.id);
    if (!Array.isArray(entity.aliases)) {
      continue;
    }
    for (const alias of entity.aliases) {
      if (isRecord(alias) && typeof alias.id === "string") {
        aliasIds.add(alias.id);
      }
    }
  }

  for (const aliasId of aliasIds) {
    if (canonicalIds.has(aliasId)) {
      return ["entity-identity.alias.chain"];
    }
  }

  return [];
};

describe("Entity Identity Contract", () => {
  it("accepts all valid fixtures", () => {
    for (const file of fixtureFiles("valid")) {
      const value = readJson(join(fixtureRoot, "valid", file));
      expect(validateIdentity(value), file).toEqual([]);
    }
  });

  it("rejects invalid fixtures with the expected rule", () => {
    const expectedRules = new Map([
      ["alias-self.json", "entity-identity.alias.self"],
      ["decimal-schema-version.json", "entity-identity.schema-version.invalid"],
      ["double-hyphen-namespace.json", "entity-identity.id.pattern"],
      ["duplicate-alias.json", "entity-identity.alias.duplicate"],
      ["duplicate-tag.json", "entity-identity.tag.duplicate"],
      ["empty-id.json", "entity-identity.id.pattern"],
      ["invalid-entity-type.json", "entity-identity.entity-type.invalid"],
      ["invalid-schema-version.json", "entity-identity.schema-version.invalid"],
      ["invalid-provenance.json", "entity-identity.provenance.invalid"],
      ["negative-schema-version.json", "entity-identity.schema-version.invalid"],
      ["noncanonical-alias-order.json", "entity-identity.alias.order"],
      ["noncanonical-tag-order.json", "entity-identity.tag.order"],
      ["one-character-entity-type.json", "entity-identity.id.pattern"],
      ["similar-prefix-type-mismatch.json", "entity-identity.entity-type.prefix-mismatch"],
      ["source-file-absolute.json", "entity-identity.provenance.invalid"],
      ["source-file-dot-segment.json", "entity-identity.provenance.invalid"],
      ["source-file-nested-parent.json", "entity-identity.provenance.invalid"],
      ["source-file-windows-drive.json", "entity-identity.provenance.invalid"],
      ["string-schema-version.json", "entity-identity.schema-version.invalid"],
      ["trailing-hyphen-type.json", "entity-identity.id.pattern"],
      ["trailing-underscore-local-name.json", "entity-identity.id.pattern"],
      ["type-prefix-mismatch.json", "entity-identity.entity-type.prefix-mismatch"],
      ["unknown-field.json", "entity-identity.unknown-field"],
      ["uppercase-id.json", "entity-identity.id.pattern"],
      ["whitespace-id.json", "entity-identity.id.pattern"]
    ]);

    for (const file of fixtureFiles("invalid")) {
      const value = readJson(join(fixtureRoot, "invalid", file));
      const expectedRule = expectedRules.get(file);
      expect(expectedRule, file).toBeDefined();
      expect(validateIdentity(value), file).toContain(expectedRule);
    }
  });

  it("compares canonical IDs deterministically as exact strings", () => {
    const minimal = readJson(join(fixtureRoot, "valid", "minimal.json"));
    expect(isRecord(minimal)).toBe(true);
    if (!isRecord(minimal) || typeof minimal.id !== "string") {
      return;
    }
    const first = minimal.id;
    const second = "room.demo.start";
    const nonCanonicalCase = "room.demo.Start";

    expect(first === second).toBe(true);
    expect(first === nonCanonicalCase).toBe(false);
    expect(idPattern.test(first)).toBe(true);
    expect(idPattern.test(nonCanonicalCase)).toBe(false);
  });

  it("requires tags and aliases to be lexicographically ordered in canonical data", () => {
    const withTags = readJson(join(fixtureRoot, "valid", "with-tags.json"));
    const withAlias = readJson(join(fixtureRoot, "valid", "with-alias.json"));

    expect(validateIdentity(withTags)).not.toContain("entity-identity.tag.order");
    expect(validateIdentity(withAlias)).not.toContain("entity-identity.alias.order");
  });

  it("rejects unknown fields in the identity envelope", () => {
    const value = readJson(join(fixtureRoot, "invalid", "unknown-field.json"));

    expect(validateIdentity(value)).toContain("entity-identity.unknown-field");
  });

  it("requires ID prefix and namespace to match explicit fields", () => {
    const value = readJson(join(fixtureRoot, "invalid", "type-prefix-mismatch.json"));
    const similarPrefix = readJson(join(fixtureRoot, "invalid", "similar-prefix-type-mismatch.json"));

    expect(validateIdentity(value)).toContain("entity-identity.entity-type.prefix-mismatch");
    expect(validateIdentity(similarPrefix)).toContain("entity-identity.entity-type.prefix-mismatch");
  });

  it("rejects alias equal to canonical ID", () => {
    const value = readJson(join(fixtureRoot, "invalid", "alias-self.json"));

    expect(validateIdentity(value)).toContain("entity-identity.alias.self");
  });

  it("detects duplicate tag and alias values", () => {
    const duplicateTag = readJson(join(fixtureRoot, "invalid", "duplicate-tag.json"));
    const duplicateAlias = readJson(join(fixtureRoot, "invalid", "duplicate-alias.json"));

    expect(validateIdentity(duplicateTag)).toContain("entity-identity.tag.duplicate");
    expect(validateIdentity(duplicateAlias)).toContain("entity-identity.alias.duplicate");
  });

  it("keeps canonical JSON serialization stable", () => {
    const filePath = join(fixtureRoot, "valid", "with-provenance.json");
    const raw = readFileSync(filePath, "utf8");
    const value = readJson(filePath);

    expect(stableStringify(value)).toBe(raw);
  });

  it("canonicalizes equivalent unordered data to the same bytes and is idempotent", () => {
    const canonical = readJson(join(fixtureRoot, "valid", "with-provenance.json"));
    const unordered = {
      change: {
        updatedBy: "author.content",
        createdBy: "author.content",
        revision: 1
      },
      provenance: {
        approvalState: "approved",
        commit: "6e874df",
        taskId: "TASK-004",
        generatedBy: "manual",
        sourceLine: 12,
        sourceRevision: "content-v1",
        sourceEntityId: "dialogue.demo.greeting",
        sourceFile: "games/demo/dialogues/greeting.json"
      },
      schemaVersion: 1,
      namespace: "demo",
      entityType: "dialogue",
      id: "dialogue.demo.greeting",
      contractVersion
    };

    const canonicalBytes = stableStringify(canonical);
    const unorderedBytes = stableStringify(unordered);

    expect(unorderedBytes).toBe(canonicalBytes);
    expect(stableStringify(JSON.parse(unorderedBytes) as unknown)).toBe(canonicalBytes);
  });

  it("documents alias cycles as semantic validation", () => {
    const entities = readJson(join(fixtureRoot, "semantic-invalid", "alias-cycle.json"));

    expect(semanticAliasCycleErrors(entities)).toContain("entity-identity.alias.cycle");
  });

  it("documents alias chains as semantic validation for distribution builds", () => {
    const entities = readJson(join(fixtureRoot, "semantic-invalid", "alias-chain.json"));

    expect(semanticAliasChainErrors(entities)).toContain("entity-identity.alias.chain");
  });

  it("keeps the JSON Schema aligned with the chosen local shape", () => {
    const schema = readJson("schemas/entity-identity.schema.json");
    expect(isRecord(schema)).toBe(true);
    if (!isRecord(schema)) {
      return;
    }
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(["contractVersion", "id", "entityType", "namespace", "schemaVersion"]);
  });
});
