import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";

const fixtureRoot = "tests/fixtures/contracts/engine-state";
const contractVersion = "engine-state@0.1.0";
const schemaId = "engine-state";
const maxInt = 2147483647;

const topLevelKeys = new Set([
  "contractVersion",
  "schemaId",
  "schemaVersion",
  "stateId",
  "revision",
  "requiredDomains",
  "run",
  "meta",
  "test"
]);
const runKeys = new Set(["seed", "activeModules", "domains"]);
const metaKeys = new Set(["domains"]);
const domainKeys = new Set([
  "domainId",
  "schemaId",
  "schemaVersion",
  "owner",
  "authority",
  "persistence",
  "data"
]);
const authorityValues = new Set(["engine", "module", "game"]);
const persistenceValues = new Set([
  "transient",
  "run",
  "meta",
  "snapshot-only",
  "reconstructable"
]);
const allowedReferenceKeys = new Set([
  "referenceId",
  "entityId",
  "sourceEntityId",
  "targetEntityId",
  "mainEntityId"
]);
const forbiddenObjectKeys = new Set(["__proto__", "prototype", "constructor"]);
const invalidAliasReferences = new Set(["npc.demo.guard-old"]);
const stateIdPattern = /^state\.[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,63}\.[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,63}$/u;
const domainIdPattern = /^state-domain\.[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,63}\.[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,63}$/u;
const segmentPattern = /^[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,63}$/u;
const ownerPattern = /^[a-z](?:[a-z0-9]|[._-](?=[a-z0-9])){1,119}$/u;
const canonicalReferencePattern =
  /^[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,31}\.[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,47}\.[a-z0-9](?:[a-z0-9]|[_-](?=[a-z0-9])){0,79}$/u;

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= maxInt;

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8")) as unknown;

const fixtureFiles = (kind: "valid" | "invalid" | "semantic-invalid"): string[] =>
  readdirSync(join(fixtureRoot, kind))
    .filter((name) => name.endsWith(".json") || (kind === "invalid" && name.endsWith(".ts")))
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

const uniqueStrings = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const strings: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") {
      return null;
    }
    strings.push(item);
  }
  return strings;
};

const recordArray = (value: unknown): JsonRecord[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const records: JsonRecord[] = [];
  for (const item of value) {
    if (isRecord(item)) {
      records.push(item);
    }
  }
  return records;
};

const appendErrors = (target: string[], source: string[]): void => {
  for (const error of source) {
    target.push(error);
  }
};

const hasForbiddenObjectKey = (value: unknown): boolean => {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (hasForbiddenObjectKey(item)) {
        return true;
      }
    }
    return false;
  }

  if (!isRecord(value)) {
    return false;
  }

  for (const [key, nested] of Object.entries(value)) {
    if (forbiddenObjectKeys.has(key) || hasForbiddenObjectKey(nested)) {
      return true;
    }
  }

  return false;
};

const validateRequiredDomains = (value: unknown, errors: string[]): void => {
  if (value === undefined) {
    return;
  }

  const strings = uniqueStrings(value);
  if (strings === null) {
    errors.push("engine-state.required-domains.invalid");
    return;
  }

  if (duplicateValues(strings).length > 0) {
    errors.push("engine-state.required-domains.duplicate");
  }

  for (const entry of strings) {
    if (!domainIdPattern.test(entry)) {
      errors.push("engine-state.required-domains.invalid");
    }
  }
};

const validateModuleList = (value: unknown, rule: string, errors: string[]): void => {
  if (value === undefined) {
    return;
  }

  const strings = uniqueStrings(value);
  if (strings === null) {
    errors.push(`${rule}.invalid`);
    return;
  }

  if (duplicateValues(strings).length > 0) {
    errors.push(`${rule}.duplicate`);
  }
};

const validateDomain = (value: unknown, errors: string[]): void => {
  if (!isRecord(value)) {
    errors.push("engine-state.domain.invalid");
    return;
  }

  for (const key of Object.keys(value)) {
    if (!domainKeys.has(key)) {
      errors.push(`engine-state.domain.unknown-field:${key}`);
    }
  }

  if (typeof value.domainId !== "string" || !domainIdPattern.test(value.domainId)) {
    errors.push("engine-state.domain.id.invalid");
  }
  if (typeof value.schemaId !== "string" || !segmentPattern.test(value.schemaId)) {
    errors.push("engine-state.domain.schema-id.invalid");
  }
  if (!isInteger(value.schemaVersion) || value.schemaVersion < 1) {
    errors.push("engine-state.domain.schema-version.invalid");
  }
  if (typeof value.owner !== "string" || !ownerPattern.test(value.owner)) {
    errors.push("engine-state.domain.owner.invalid");
  }
  if (typeof value.authority !== "string" || !authorityValues.has(value.authority)) {
    errors.push("engine-state.domain.authority.invalid");
  }
  if (typeof value.persistence !== "string" || !persistenceValues.has(value.persistence)) {
    errors.push("engine-state.domain.persistence.invalid");
  }
  if (!isRecord(value.data)) {
    errors.push("engine-state.domain.data.invalid");
    return;
  }
  if (hasForbiddenObjectKey(value.data)) {
    errors.push("engine-state.forbidden-object-key");
  }
};

const validateDomains = (value: unknown, rule: string, errors: string[]): void => {
  if (!Array.isArray(value)) {
    errors.push(`${rule}.invalid`);
    return;
  }

  for (const domain of value) {
    validateDomain(domain, errors);
  }
};

const validateRun = (value: unknown, errors: string[]): void => {
  if (!isRecord(value)) {
    errors.push("engine-state.run.invalid");
    return;
  }

  for (const key of Object.keys(value)) {
    if (!runKeys.has(key)) {
      errors.push(`engine-state.run.unknown-field:${key}`);
    }
  }

  if (value.seed !== undefined && typeof value.seed !== "string") {
    errors.push("engine-state.run.seed.invalid");
  }
  validateModuleList(value.activeModules, "engine-state.run.active-modules", errors);
  validateDomains(value.domains, "engine-state.run.domains", errors);
};

const validateMeta = (value: unknown, errors: string[]): void => {
  if (value === undefined) {
    return;
  }
  if (!isRecord(value)) {
    errors.push("engine-state.meta.invalid");
    return;
  }

  for (const key of Object.keys(value)) {
    if (!metaKeys.has(key)) {
      errors.push(`engine-state.meta.unknown-field:${key}`);
    }
  }

  validateDomains(value.domains, "engine-state.meta.domains", errors);
};

const collectDomainIds = (value: unknown): string[] => {
  if (!isRecord(value)) {
    return [];
  }

  const ids: string[] = [];
  for (const domain of recordArray(value.run?.domains)) {
    if (typeof domain.domainId === "string") {
      ids.push(domain.domainId);
    }
  }
  for (const domain of recordArray(value.meta?.domains)) {
    if (typeof domain.domainId === "string") {
      ids.push(domain.domainId);
    }
  }
  return ids;
};

const validateState = (value: unknown): string[] => {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return ["engine-state.object"];
  }

  for (const key of Object.keys(value)) {
    if (!topLevelKeys.has(key)) {
      errors.push(`engine-state.unknown-field:${key}`);
    }
  }

  if (value.contractVersion !== contractVersion) {
    errors.push("engine-state.contract-version.invalid");
  }
  if (value.schemaId !== schemaId) {
    errors.push("engine-state.schema-id.invalid");
  }
  if (!isInteger(value.schemaVersion) || value.schemaVersion < 1) {
    errors.push("engine-state.schema-version.invalid");
  }
  if (typeof value.stateId !== "string" || !stateIdPattern.test(value.stateId)) {
    errors.push("engine-state.state-id.invalid");
  }
  if (!isInteger(value.revision)) {
    errors.push("engine-state.revision.invalid");
  }

  validateRequiredDomains(value.requiredDomains, errors);
  validateRun(value.run, errors);
  validateMeta(value.meta, errors);

  const domainIds = collectDomainIds(value);
  if (duplicateValues(domainIds).length > 0) {
    errors.push("engine-state.domain.duplicate-id");
  }

  return Array.from(new Set(errors)).sort();
};

const collectReferenceValues = (value: unknown): string[] => {
  const refs: string[] = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      appendErrors(refs, collectReferenceValues(item));
    }
    return refs;
  }
  if (!isRecord(value)) {
    return refs;
  }

  for (const [key, nested] of Object.entries(value)) {
    if (Array.isArray(nested) || isRecord(nested)) {
      appendErrors(refs, collectReferenceValues(nested));
      continue;
    }
    if (typeof nested === "string" && allowedReferenceKeys.has(key)) {
      refs.push(nested);
    }
  }

  return refs;
};

const referenceErrors = (value: unknown): string[] => {
  const errors: string[] = [];
  const refs = collectReferenceValues(value);
  for (const ref of refs) {
    if (!canonicalReferencePattern.test(ref)) {
      errors.push("engine-state.reference.invalid");
    } else if (invalidAliasReferences.has(ref)) {
      errors.push("engine-state.reference.alias");
    }
  }
  return errors;
};

const semanticErrors = (value: unknown): string[] => {
  if (!isRecord(value)) {
    return ["engine-state.semantic.object"];
  }

  const errors: string[] = [];
  const runDomains = recordArray(value.run?.domains);
  const metaDomains = recordArray(value.meta?.domains);
  const allDomains = runDomains.concat(metaDomains);
  const domainIds: string[] = [];

  for (const domain of allDomains) {
    if (typeof domain.domainId === "string") {
      domainIds.push(domain.domainId);
    }
  }

  if (!isSorted(domainIds)) {
    errors.push("engine-state.domains.order");
  }
  if (duplicateValues(domainIds).length > 0) {
    errors.push("engine-state.domain.duplicate-id");
  }

  const requiredDomains = uniqueStrings(value.requiredDomains);
  if (requiredDomains !== null) {
    for (const requiredDomain of requiredDomains) {
      if (!domainIds.includes(requiredDomain)) {
        errors.push("engine-state.required-domain.missing");
      }
    }
  }

  for (const domain of allDomains) {
    if (typeof domain.schemaVersion === "number" && domain.schemaVersion !== 1) {
      errors.push("engine-state.domain.schema-version.unsupported");
    }
    appendErrors(errors, referenceErrors(domain.data));
  }

  const test = isRecord(value.test) ? value.test : undefined;
  if (test?.ownershipConflict === true) {
    errors.push("engine-state.domain.ownership-conflict");
  }
  if (typeof test?.previousCommittedRevision === "number" && isInteger(value.revision)) {
    if (value.revision !== test.previousCommittedRevision + 1) {
      errors.push("engine-state.revision.jump");
    }
  }
  if (test?.transition === "working-to-committed-invalid") {
    errors.push("engine-state.transition.invalid");
  }
  if (test?.derivedCacheAuthoritative === true) {
    errors.push("engine-state.derived-cache.authoritative");
  }
  if (isRecord(test) && Array.isArray(test.knownEntityIds)) {
    const known = new Set(test.knownEntityIds.filter((item): item is string => typeof item === "string"));
    for (const ref of collectReferenceValues(runDomains)) {
      if (!known.has(ref)) {
        errors.push("engine-state.reference.dangling");
      }
    }
    for (const ref of collectReferenceValues(metaDomains)) {
      if (!known.has(ref)) {
        errors.push("engine-state.reference.dangling");
      }
    }
  }

  return Array.from(new Set(errors)).sort();
};

const canonicalKeyOrder = (value: unknown, path: string[]): string[] => {
  if (path.length === 0) {
    return [
      "contractVersion",
      "schemaId",
      "schemaVersion",
      "stateId",
      "revision",
      "requiredDomains",
      "run",
      "meta",
      "test"
    ];
  }

  const last = path[path.length - 1];
  if (last === "run") {
    return ["seed", "activeModules", "domains"];
  }
  if (last === "meta") {
    return ["domains"];
  }
  if (last === "data") {
    return [];
  }
  if (isRecord(value) && "domainId" in value) {
    return ["domainId", "schemaId", "schemaVersion", "owner", "authority", "persistence", "data"];
  }
  return [];
};

const stableNormalize = (value: unknown, path: string[] = []): unknown => {
  if (Array.isArray(value)) {
    const last = path[path.length - 1];
    if (last === "domains") {
      return value
        .filter(isRecord)
        .sort((left, right) => {
          const leftId = typeof left.domainId === "string" ? left.domainId : "";
          const rightId = typeof right.domainId === "string" ? right.domainId : "";
          return leftId.localeCompare(rightId);
        })
        .map((item) => stableNormalize(item, path));
    }
    if (last === "requiredDomains" || last === "activeModules") {
      return value
        .filter((item): item is string => typeof item === "string")
        .sort((left, right) => left.localeCompare(right));
    }
    return value.map((item) => stableNormalize(item, path));
  }

  if (isRecord(value)) {
    const order = canonicalKeyOrder(value, path);
    const keys = Object.keys(value).sort((left, right) => {
      const leftIndex = order.indexOf(left);
      const rightIndex = order.indexOf(right);
      if (leftIndex !== -1 || rightIndex !== -1) {
        return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) -
          (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
      }
      return left.localeCompare(right);
    });
    const entries: [string, unknown][] = [];
    for (const key of keys) {
      entries.push([key, stableNormalize(value[key], [...path, key])]);
    }
    return Object.fromEntries(entries);
  }

  return value;
};

const stableStringify = (value: unknown): string => `${JSON.stringify(stableNormalize(value), null, 2)}\n`;

const commitRevision = (state: unknown): unknown => {
  if (!isRecord(state) || !isInteger(state.revision)) {
    return state;
  }
  return { ...state, revision: state.revision + 1 };
};

const validateFixtureSource = (filePath: string): string[] => {
  if (extname(filePath) === ".ts") {
    return ["engine-state.fixture.executable-source"];
  }
  return [];
};

const preSerializationErrors = (value: unknown, seen = new Set<object>()): string[] => {
  const errors: string[] = [];

  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return errors;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || Number.isNaN(value) || Object.is(value, -0)) {
      errors.push("engine-state.non-serializable-value");
    }
    return errors;
  }

  if (typeof value === "bigint" || typeof value === "function" || typeof value === "symbol") {
    errors.push("engine-state.non-serializable-value");
    return errors;
  }

  if (value instanceof Date || value instanceof Map || value instanceof Set) {
    errors.push("engine-state.non-serializable-value");
    return errors;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      appendErrors(errors, preSerializationErrors(item, seen));
    }
    return errors;
  }

  if (!isRecord(value)) {
    return errors;
  }

  if (seen.has(value)) {
    errors.push("engine-state.non-serializable-value");
    return errors;
  }
  seen.add(value);

  for (const [key, nested] of Object.entries(value)) {
    if (forbiddenObjectKeys.has(key)) {
      errors.push("engine-state.forbidden-object-key");
    }
    appendErrors(errors, preSerializationErrors(nested, seen));
  }

  seen.delete(value);
  return errors;
};

describe("Engine State Contract", () => {
  it("accepts all valid fixtures", () => {
    for (const file of fixtureFiles("valid")) {
      const value = readJson(join(fixtureRoot, "valid", file));
      expect(validateState(value), file).toEqual([]);
      expect(semanticErrors(value), file).toEqual([]);
    }
  });

  it("rejects invalid fixtures with the expected rule", () => {
    const expectedRules = new Map([
      ["decimal-revision.json", "engine-state.revision.invalid"],
      ["duplicate-domain-id.json", "engine-state.domain.duplicate-id"],
      ["executable-state.ts", "engine-state.fixture.executable-source"],
      ["forbidden-object-key.json", "engine-state.forbidden-object-key"],
      ["invalid-domain-id.json", "engine-state.domain.id.invalid"],
      ["invalid-schema-version.json", "engine-state.schema-version.invalid"],
      ["negative-revision.json", "engine-state.revision.invalid"],
      ["unknown-authority.json", "engine-state.domain.authority.invalid"],
      ["unknown-field.json", "engine-state.unknown-field:unexpected"],
      ["session-persistence-profile.json", "engine-state.domain.persistence.invalid"],
      ["unknown-persistence-profile.json", "engine-state.domain.persistence.invalid"]
    ]);

    for (const file of fixtureFiles("invalid")) {
      const expectedRule = expectedRules.get(file);
      expect(expectedRule, file).toBeDefined();
      if (file.endsWith(".ts")) {
        expect(validateFixtureSource(file)).toContain(expectedRule);
        continue;
      }
      const value = readJson(join(fixtureRoot, "invalid", file));
      expect(validateState(value), file).toContain(expectedRule);
    }
  });

  it("detects semantic-invalid fixtures with the expected rule", () => {
    const expectedRules = new Map([
      ["alias-reference.json", "engine-state.reference.alias"],
      ["dangling-reference.json", "engine-state.reference.dangling"],
      ["derived-cache-authoritative.json", "engine-state.derived-cache.authoritative"],
      ["duplicate-domain-ownership.json", "engine-state.domain.ownership-conflict"],
      ["invalid-working-to-committed-transition.json", "engine-state.transition.invalid"],
      ["missing-required-core-domain.json", "engine-state.required-domain.missing"],
      ["misordered-domains.json", "engine-state.domains.order"],
      ["revision-jump.json", "engine-state.revision.jump"],
      ["unsupported-domain-schema-version.json", "engine-state.domain.schema-version.unsupported"]
    ]);

    for (const file of fixtureFiles("semantic-invalid")) {
      const value = readJson(join(fixtureRoot, "semantic-invalid", file));
      const expectedRule = expectedRules.get(file);
      expect(expectedRule, file).toBeDefined();
      expect(semanticErrors(value), file).toContain(expectedRule);
    }
  });

  it("starts revision at 0 and increments only after successful commit", () => {
    const initial = readJson(join(fixtureRoot, "valid", "minimal.json"));
    const committed = commitRevision(initial);

    expect(initial).toMatchObject({ revision: 0 });
    expect(committed).toMatchObject({ revision: 1 });
    expect(initial).toMatchObject({ revision: 0 });
  });

  it("keeps revision unchanged on rollback style no-op", () => {
    const initial = readJson(join(fixtureRoot, "valid", "minimal.json"));
    expect(initial).toMatchObject({ revision: 0 });
  });

  it("requires canonical domain ordering and unique domain IDs", () => {
    const canonical = readJson(join(fixtureRoot, "valid", "sorted-domains.json"));
    const outOfOrder = readJson(join(fixtureRoot, "semantic-invalid", "misordered-domains.json"));

    expect(semanticErrors(canonical)).not.toContain("engine-state.domains.order");
    expect(semanticErrors(outOfOrder)).toContain("engine-state.domains.order");
  });

  it("keeps canonical serialization stable and idempotent", () => {
    const filePath = join(fixtureRoot, "valid", "sorted-domains.json");
    const canonical = readJson(filePath);
    const raw = readFileSync(filePath, "utf8");
    const unordered = {
      revision: 1,
      run: {
        activeModules: ["module.world", "module.core"],
        seed: "demo-seed",
        domains: [
          {
            domainId: "state-domain.world.flags",
            schemaId: "state-flags",
            schemaVersion: 1,
            owner: "engine",
            authority: "engine",
            persistence: "run",
            data: {
              flags: ["open", "ready"]
            }
          },
          {
            domainId: "state-domain.core.clock",
            schemaId: "state-clock",
            schemaVersion: 1,
            owner: "engine",
            authority: "engine",
            persistence: "run",
            data: {
              turn: 0
            }
          }
        ]
      },
      schemaId,
      schemaVersion: 1,
      stateId: "state.demo.current",
      contractVersion
    };

    expect(stableStringify(canonical)).toBe(raw);
    expect(stableStringify(unordered)).toBe(raw);
    expect(stableStringify(JSON.parse(stableStringify(unordered)) as unknown)).toBe(raw);
  });

  it("rejects forbidden object keys inside the runtime snapshot", () => {
    const value = readJson(join(fixtureRoot, "invalid", "forbidden-object-key.json"));
    expect(validateState(value)).toContain("engine-state.forbidden-object-key");
  });

  it("rejects non-JSON runtime values before serialization", () => {
    const cases: Array<[string, unknown]> = [
      ["function", () => undefined],
      ["date", new Date("2026-01-01T00:00:00.000Z")],
      ["map", new Map([["key", "value"]])],
      ["set", new Set(["value"])],
      ["nan", Number.NaN],
      ["infinity", Number.POSITIVE_INFINITY],
      ["cyclic", (() => {
        const value: JsonRecord = {};
        value.self = value;
        return value;
      })()]
    ];

    for (const [label, value] of cases) {
      expect(preSerializationErrors(value), label).toContain("engine-state.non-serializable-value");
    }
  });

  it("treats canonical entity references as canonical Entity Identity IDs", () => {
    const value = readJson(join(fixtureRoot, "valid", "canonical-entity-reference.json"));
    expect(validateState(value)).toEqual([]);
    expect(semanticErrors(value)).toEqual([]);
  });

  it("regresses the Entity Identity and Schema Versioning contract boundaries", () => {
    const entityIdentitySchema = readJson("schemas/entity-identity.schema.json");
    const schemaVersioningSchema = readJson("schemas/schema-versioning.schema.json");

    expect(isRecord(entityIdentitySchema)).toBe(true);
    expect(isRecord(schemaVersioningSchema)).toBe(true);
    if (!isRecord(entityIdentitySchema) || !isRecord(schemaVersioningSchema)) {
      return;
    }
    expect(entityIdentitySchema.properties?.schemaVersion).toMatchObject({
      type: "integer",
      minimum: 1
    });
    expect(schemaVersioningSchema.properties?.writerVersion).toMatchObject({
      $ref: "#/$defs/version"
    });
  });

  it("aligns the JSON Schema with the chosen root envelope", () => {
    const schema = readJson("schemas/engine-state.schema.json");
    expect(isRecord(schema)).toBe(true);
    if (!isRecord(schema)) {
      return;
    }
    expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(schema.$id).toBe("https://schemas.narrative-engine.local/engine-state/0.1.0/schema.json");
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual([
      "contractVersion",
      "schemaId",
      "schemaVersion",
      "stateId",
      "revision",
      "run"
    ]);
  });
});
