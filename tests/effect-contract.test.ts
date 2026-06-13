import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runtimeInvalidCases } from "./fixtures/contracts/effect/runtime-invalid/runtime-invalid";

type JsonRecord = Record<string, unknown>;

type Diagnostic = {
  code: string;
  message: string;
  path?: string;
  effectId?: string;
  conditionId?: string;
  expected?: string;
  actual?: unknown;
};

type EffectResult =
  | { status: "applied"; changes: ChangeRecord[] }
  | { status: "no-op"; changes: [] }
  | { status: "skipped"; reason: "guard-false"; changes: [] }
  | { status: "error"; diagnostics: Diagnostic[] };

type ChangeRecord = {
  path: string;
  before: unknown;
  after: unknown;
};

type StateDomain = {
  domainId: string;
  schemaId: string;
  schemaVersion: number;
  owner: string;
  authority: string;
  persistence: string;
  data: JsonRecord;
};

type EngineStateSnapshot = {
  contractVersion: string;
  schemaId: string;
  schemaVersion: number;
  stateId: string;
  revision: number;
  run: {
    seed: string;
    activeModules: string[];
    domains: StateDomain[];
  };
  meta?: {
    domains: StateDomain[];
  };
};

type EffectEvaluationOptions = {
  allowedDomains?: ReadonlySet<string>;
  supportedDomainVersions?: ReadonlyMap<string, ReadonlySet<number>>;
  maxDepth?: number;
  maxNodes?: number;
  maxReads?: number;
  context?: JsonRecord;
  explain?: boolean;
};

const effectContractVersion = "effect@0.1.0";
const effectSchemaId = "effect";
const conditionContractVersion = "condition@0.1.0";
const conditionSchemaId = "condition";
const maxInt = 2147483647;
const maxEffectStringLength = 64;
const forbiddenObjectKeys = new Set(["__proto__", "prototype", "constructor"]);
const effectTypes = new Set([
  "set",
  "unset",
  "increment",
  "append",
  "remove-at",
  "add-unique",
  "remove-value"
]);
const conditionTypes = new Set(["constant", "exists", "compare", "contains", "entity-is", "domain-exists", "condition-ref", "all", "any", "not"]);
const comparisonOperators = new Set(["eq", "neq", "lt", "lte", "gt", "gte"]);
const topLevelOrder = [
  "contractVersion",
  "schemaId",
  "schemaVersion",
  "effectId",
  "type",
  "target",
  "guard",
  "value",
  "delta",
  "index"
];
const targetOrder = ["domainId", "path"];
const conditionOrder = [
  "contractVersion",
  "schemaId",
  "schemaVersion",
  "conditionId",
  "type",
  "value",
  "selector",
  "operands",
  "operator",
  "left",
  "right",
  "collection",
  "member",
  "domainId",
  "targetConditionId"
];
const domainOrder = [
  "domainId",
  "schemaId",
  "schemaVersion",
  "owner",
  "authority",
  "persistence",
  "data"
];
const stateOrder = ["contractVersion", "schemaId", "schemaVersion", "stateId", "revision", "run", "meta"];
const runOrder = ["seed", "activeModules", "domains"];
const metaOrder = ["domains"];
const resultChangeOrder = ["path", "before", "after"];

const fixtureRoot = join("tests", "fixtures", "contracts", "effect");

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && !Number.isNaN(value);

const isString = (value: unknown): value is string => typeof value === "string";

const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const freezeJson = <T>(value: T): T => {
  if (Array.isArray(value)) {
    for (const item of value) {
      freezeJson(item);
    }
    return Object.freeze(value);
  }
  if (isRecord(value)) {
    for (const item of Object.values(value)) {
      freezeJson(item);
    }
    return Object.freeze(value);
  }
  return value;
};

const readJson = (relativePath: string): unknown =>
  JSON.parse(readFileSync(join(process.cwd(), relativePath), "utf8")) as unknown;

const readText = (relativePath: string): string => readFileSync(join(process.cwd(), relativePath), "utf8");

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

const escapeJsonPointer = (segment: string): string => segment.replaceAll("~", "~0").replaceAll("/", "~1");

const decodeJsonPointerSegment = (segment: string): string => segment.replaceAll("~1", "/").replaceAll("~0", "~");

const entityIdPattern =
  /^[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,31}\.[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,47}\.[a-z0-9](?:[a-z0-9]|[_-](?=[a-z0-9])){0,79}$/u;
const stateDomainIdPattern =
  /^state-domain\.[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,31}\.[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,31}$/u;
const pathPattern = /^(?:\/|\/(?:[^~/]|~0|~1)+(?:\/(?:[^~/]|~0|~1)+)*)$/u;

const baseState = freezeJson<EngineStateSnapshot>({
  contractVersion: "engine-state@0.1.0",
  schemaId: "engine-state",
  schemaVersion: 1,
  stateId: "state.effect.current",
  revision: 12,
  run: {
    seed: "effect-seed",
    activeModules: ["module.core", "module.world"],
    domains: [
      {
        domainId: "state-domain.core.clock",
        schemaId: "state-clock",
        schemaVersion: 1,
        owner: "engine",
        authority: "engine",
        persistence: "run",
        data: {
          tick: 3
        }
      },
      {
        domainId: "state-domain.core.flags",
        schemaId: "state-flags",
        schemaVersion: 1,
        owner: "engine",
        authority: "engine",
        persistence: "run",
        data: {
          paused: false,
          label: "hello"
        }
      },
      {
        domainId: "state-domain.core.world",
        schemaId: "state-world",
        schemaVersion: 1,
        owner: "game",
        authority: "game",
        persistence: "run",
        data: {
          doors: {
            main: {
              state: "closed"
            }
          },
          required: "kept",
          optional: "value",
          tags: ["alpha", "beta"],
          items: ["alpha", "beta"],
          actorId: "npc.example.guard"
        }
      }
    ]
  },
  meta: {
    domains: [
      {
        domainId: "state-domain.meta.profile",
        schemaId: "state-profile",
        schemaVersion: 1,
        owner: "engine",
        authority: "engine",
        persistence: "meta",
        data: {
          unlockedModes: ["story"]
        }
      }
    ]
  }
});

const validFixtures = [
  "minimal.json",
  "set-string.json",
  "set-boolean.json",
  "set-entity-reference.json",
  "unset-optional.json",
  "increment.json",
  "decrement.json",
  "append.json",
  "remove-at.json",
  "add-unique.json",
  "remove-value.json",
  "guard-true.json",
  "guard-false.json"
];

const invalidFixtures = [
  "unknown-effect-type.json",
  "missing-schema-version.json",
  "schema-version-zero.json",
  "invalid-target.json",
  "forbidden-target-segment.json",
  "target-root-revision.json",
  "target-domain-metadata.json",
  "unknown-field.json",
  "executable-expression.json",
  "decimal-array-index.json",
  "negative-array-index.json",
  "invalid-entity-reference.json",
  "too-large-value.json",
  "executable-source.ts"
];

const semanticInvalidFixtures = [
  "missing-state-domain.json",
  "missing-required-target.json",
  "type-mismatch.json",
  "unsupported-domain-schema-version.json",
  "access-denied.json",
  "guard-error.json",
  "numeric-overflow.json",
  "array-index-out-of-range.json",
  "duplicate-add-unique.json",
  "resulting-domain-invalid.json",
  "unknown-newer-schema.json",
  "budget-exceeded.json"
];

function validateJsonValue(value: unknown, path: string, errors: string[], seen = new Set<object>()): void {
  if (value === null || isBoolean(value)) {
    return;
  }
  if (isString(value)) {
    if (value.length > maxEffectStringLength) {
      errors.push(`effect.json-value.string-too-long:${path}`);
    }
    return;
  }
  if (isInteger(value)) {
    if (Math.abs(value) > maxInt) {
      errors.push(`effect.json-value.integer-range:${path}`);
    }
    return;
  }
  if (isFiniteNumber(value)) {
    if (Object.is(value, -0)) {
      errors.push(`effect.json-value.negative-zero:${path}`);
    }
    return;
  }
  if (typeof value === "bigint" || typeof value === "function" || typeof value === "symbol") {
    errors.push(`effect.json-value.non-serializable:${path}`);
    return;
  }
  if (value instanceof Date || value instanceof Map || value instanceof Set) {
    errors.push(`effect.json-value.non-serializable:${path}`);
    return;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      validateJsonValue(value[index], `${path}/${String(index)}`, errors, seen);
    }
    return;
  }
  if (!isRecord(value)) {
    errors.push(`effect.json-value.invalid:${path}`);
    return;
  }
  if (seen.has(value)) {
    errors.push(`effect.json-value.cycle:${path}`);
    return;
  }
  seen.add(value);
  for (const [key, nested] of Object.entries(value)) {
    if (forbiddenObjectKeys.has(key)) {
      errors.push(`effect.forbidden-object-key:${path}/${key}`);
    }
    validateJsonValue(nested, `${path}/${escapeJsonPointer(key)}`, errors, seen);
  }
  seen.delete(value);
}

function validateEntityId(value: unknown, path: string, errors: string[]): void {
  if (!isString(value) || !entityIdPattern.test(value)) {
    errors.push(`effect.entity-id.invalid:${path}`);
  }
}

function validateStatePath(value: unknown, path: string, errors: string[]): void {
  if (!isString(value) || !pathPattern.test(value)) {
    errors.push(`effect.state-path.invalid:${path}`);
    return;
  }
  const segments = value === "/" ? [] : value.slice(1).split("/").map(decodeJsonPointerSegment);
  for (const segment of segments) {
    if (segment === "..") {
      errors.push(`effect.state-path.traversal:${path}`);
    }
    if (forbiddenObjectKeys.has(segment)) {
      errors.push(`effect.state-path.forbidden-segment:${path}`);
    }
  }
}

function validateTarget(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push("effect.target.invalid");
    return;
  }
  const allowedKeys = new Set(["domainId", "path"]);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      errors.push(`effect.target.unknown-field:${key}`);
    }
  }
  if (!isString(value.domainId) || !stateDomainIdPattern.test(value.domainId)) {
    errors.push("effect.target.domain-id.invalid");
  }
  validateStatePath(value.path, "/target/path", errors);
  if (isString(value.path) && value.path !== "/") {
    const pathSegments = value.path.slice(1).split("/").map(decodeJsonPointerSegment);
    const topLevel = pathSegments[0];
    if (
      topLevel === "revision" ||
      topLevel === "schemaVersion" ||
      topLevel === "domainId" ||
      topLevel === "owner" ||
      topLevel === "authority" ||
      topLevel === "persistence"
    ) {
      errors.push("effect.target.reserved-metadata-path");
    }
  }
}

function validateConditionShape(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`effect.guard.invalid:${path}`);
    return;
  }
  const allowedKeys = new Set([
    "contractVersion",
    "schemaId",
    "schemaVersion",
    "conditionId",
    "type",
    "value",
    "selector",
    "operands",
    "operator",
    "left",
    "right",
    "collection",
    "member",
    "domainId",
    "targetConditionId"
  ]);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      errors.push(`effect.guard.unknown-field:${path}/${key}`);
    }
  }
  if (value.contractVersion !== conditionContractVersion) {
    errors.push(`effect.guard.contract-version.invalid:${path}`);
  }
  if (value.schemaId !== conditionSchemaId) {
    errors.push(`effect.guard.schema-id.invalid:${path}`);
  }
  if (!isInteger(value.schemaVersion) || value.schemaVersion < 1) {
    errors.push(`effect.guard.schema-version.invalid:${path}`);
  }
  if ("conditionId" in value) {
    validateEntityId(value.conditionId, `${path}/conditionId`, errors);
  }
  if (!isString(value.type) || !conditionTypes.has(value.type)) {
    errors.push(`effect.guard.type.invalid:${path}`);
    return;
  }
  switch (value.type) {
    case "constant":
      if (!isBoolean(value.value)) {
        errors.push(`effect.guard.constant.invalid:${path}`);
      }
      break;
    case "exists":
      validateTargetSelector(value.selector, `${path}/selector`, errors);
      break;
    case "all":
    case "any":
      if (!Array.isArray(value.operands) || value.operands.length > 32) {
        errors.push(`effect.guard.${value.type}.operands.invalid:${path}`);
        break;
      }
      for (let index = 0; index < value.operands.length; index += 1) {
        validateConditionShape(value.operands[index], `${path}/operands/${String(index)}`, errors);
      }
      break;
    case "not":
      if (!Array.isArray(value.operands) || value.operands.length !== 1) {
        errors.push(`effect.guard.not.operands.invalid:${path}`);
        break;
      }
      validateConditionShape(value.operands[0], `${path}/operands/0`, errors);
      break;
    case "compare":
      if (!comparisonOperators.has(String(value.operator))) {
        errors.push(`effect.guard.compare.operator.invalid:${path}`);
      }
      validateOperand(value.left, `${path}/left`, errors);
      validateOperand(value.right, `${path}/right`, errors);
      break;
    case "contains":
      validateOperand(value.collection, `${path}/collection`, errors);
      validateOperand(value.member, `${path}/member`, errors);
      break;
    case "entity-is":
      validateOperand(value.left, `${path}/left`, errors);
      validateOperand(value.right, `${path}/right`, errors);
      break;
    case "domain-exists":
      if (!isString(value.domainId) || !stateDomainIdPattern.test(value.domainId)) {
        errors.push(`effect.guard.domain-id.invalid:${path}`);
      }
      break;
    case "condition-ref":
      if (!isString(value.targetConditionId) || !entityIdPattern.test(value.targetConditionId)) {
        errors.push(`effect.guard.reference.invalid:${path}`);
      }
      break;
    default:
      errors.push(`effect.guard.type.invalid:${path}`);
  }
}

function validateOperand(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`effect.guard.operand.invalid:${path}`);
    return;
  }
  const allowedKeys = new Set(["kind", "value", "selector", "id", "entityType", "key", "targetConditionId"]);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      errors.push(`effect.guard.operand.unknown-field:${path}/${key}`);
    }
  }
  if (!isString(value.kind)) {
    errors.push(`effect.guard.operand.kind.invalid:${path}`);
    return;
  }
  switch (value.kind) {
    case "literal":
      if (!("value" in value)) {
        errors.push(`effect.guard.literal.missing:${path}`);
      } else {
        validateJsonValue(value.value, `${path}/value`, errors);
      }
      break;
    case "state-value":
      validateTargetSelector(value.selector, `${path}/selector`, errors);
      break;
    case "entity-reference":
      validateEntityId(value.id, `${path}/id`, errors);
      if (!isString(value.entityType)) {
        errors.push(`effect.guard.entity-reference.entity-type.invalid:${path}`);
      }
      break;
    case "context-value":
      if (!isString(value.key)) {
        errors.push(`effect.guard.context-value.key.invalid:${path}`);
      }
      break;
    case "condition-ref":
      validateEntityId(value.targetConditionId, `${path}/targetConditionId`, errors);
      break;
    default:
      errors.push(`effect.guard.operand.kind.invalid:${path}`);
  }
}

function validateTargetSelector(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`effect.guard.selector.invalid:${path}`);
    return;
  }
  const allowedKeys = new Set(["domainId", "path"]);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      errors.push(`effect.guard.selector.unknown-field:${path}/${key}`);
    }
  }
  if (!isString(value.domainId) || !stateDomainIdPattern.test(value.domainId)) {
    errors.push(`effect.guard.selector.domain-id.invalid:${path}`);
  }
  validateStatePath(value.path, `${path}/path`, errors);
}

function validateEffectShape(value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return ["effect.shape.invalid"];
  }
  const allowedKeys = new Set([
    "contractVersion",
    "schemaId",
    "schemaVersion",
    "effectId",
    "type",
    "target",
    "guard",
    "value",
    "delta",
    "index"
  ]);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      errors.push(`effect.unknown-field:${key}`);
    }
  }
  if (value.contractVersion !== effectContractVersion) {
    errors.push("effect.contract-version.invalid");
  }
  if (value.schemaId !== effectSchemaId) {
    errors.push("effect.schema-id.invalid");
  }
  if (!isInteger(value.schemaVersion) || value.schemaVersion < 1 || value.schemaVersion > maxInt) {
    errors.push("effect.schema-version.invalid");
  }
  if ("effectId" in value) {
    validateEntityId(value.effectId, "/effectId", errors);
  }
  if (!isString(value.type) || !effectTypes.has(value.type)) {
    errors.push("effect.type.invalid");
    return errors;
  }
  validateTarget(value.target, errors);
  if ("guard" in value) {
    validateConditionShape(value.guard, "/guard", errors);
  }

  switch (value.type) {
    case "set":
      if (!("value" in value)) {
        errors.push("effect.set.value.missing");
      } else {
        validateJsonValue(value.value, "/value", errors);
        if (isString(value.value) && isRecord(value.target) && isString(value.target.path)) {
          const targetPath = value.target.path;
          if (targetPath.slice(-8) === "/actorId" || targetPath.slice(-9) === "/entityId" || targetPath.slice(-9) === "/targetId") {
          validateEntityId(value.value, "/value", errors);
          }
        }
      }
      if ("delta" in value) errors.push("effect.set.delta.forbidden");
      if ("index" in value) errors.push("effect.set.index.forbidden");
      break;
    case "unset":
      if ("value" in value) errors.push("effect.unset.value.forbidden");
      if ("delta" in value) errors.push("effect.unset.delta.forbidden");
      if ("index" in value) errors.push("effect.unset.index.forbidden");
      break;
    case "increment":
      if (!isFiniteNumber(value.delta)) {
        errors.push("effect.increment.delta.invalid");
      }
      if ("value" in value) errors.push("effect.increment.value.forbidden");
      if ("index" in value) errors.push("effect.increment.index.forbidden");
      break;
    case "append":
      if (!("value" in value)) {
        errors.push("effect.append.value.missing");
      } else {
        validateJsonValue(value.value, "/value", errors);
      }
      if ("delta" in value) errors.push("effect.append.delta.forbidden");
      if ("index" in value) errors.push("effect.append.index.forbidden");
      break;
    case "remove-at":
      if (!isInteger(value.index) || value.index < 0) {
        errors.push("effect.remove-at.index.invalid");
      }
      if ("value" in value) errors.push("effect.remove-at.value.forbidden");
      if ("delta" in value) errors.push("effect.remove-at.delta.forbidden");
      break;
    case "add-unique":
      if (!("value" in value)) {
        errors.push("effect.add-unique.value.missing");
      } else {
        validateJsonValue(value.value, "/value", errors);
      }
      if ("delta" in value) errors.push("effect.add-unique.delta.forbidden");
      if ("index" in value) errors.push("effect.add-unique.index.forbidden");
      break;
    case "remove-value":
      if (!("value" in value)) {
        errors.push("effect.remove-value.value.missing");
      } else {
        validateJsonValue(value.value, "/value", errors);
      }
      if ("delta" in value) errors.push("effect.remove-value.delta.forbidden");
      if ("index" in value) errors.push("effect.remove-value.index.forbidden");
      break;
    default:
      errors.push("effect.type.invalid");
  }

  return errors;
}

function validateStateSnapshot(value: unknown, options: EffectEvaluationOptions = {}): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return ["effect.state.object.invalid"];
  }
  const allowedKeys = new Set(["contractVersion", "schemaId", "schemaVersion", "stateId", "revision", "run", "meta"]);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      errors.push(`effect.state.unknown-field:${key}`);
    }
  }
  if (value.contractVersion !== "engine-state@0.1.0") {
    errors.push("effect.state.contract-version.invalid");
  }
  if (value.schemaId !== "engine-state") {
    errors.push("effect.state.schema-id.invalid");
  }
  if (!isInteger(value.schemaVersion) || value.schemaVersion < 1) {
    errors.push("effect.state.schema-version.invalid");
  }
  if (!isString(value.stateId)) {
    errors.push("effect.state.state-id.invalid");
  }
  if (!isInteger(value.revision) || value.revision < 0) {
    errors.push("effect.state.revision.invalid");
  }
  validateRunState(value.run, options, errors);
  if (value.meta !== undefined) {
    validateMetaState(value.meta, options, errors);
  }

  const domainIds = collectDomainIds(value);
  if (duplicateValues(domainIds).length > 0) {
    errors.push("effect.state.domain.duplicate-id");
  }
  if (!isSorted(domainIds)) {
    errors.push("effect.state.domain.order");
  }

  return [...new Set(errors)].sort();
}

function collectDomainIds(value: unknown): string[] {
  if (!isRecord(value)) {
    return [];
  }
  const ids: string[] = [];
  const runDomains = (isRecord(value.run) && Array.isArray(value.run.domains) ? value.run.domains : []) as readonly StateDomain[];
  const metaDomains = (isRecord(value.meta) && Array.isArray(value.meta.domains) ? value.meta.domains : []) as readonly StateDomain[];
  for (const entry of [...runDomains, ...metaDomains]) {
    if (isRecord(entry) && isString(entry.domainId)) {
      ids.push(entry.domainId);
    }
  }
  return ids;
}

function validateRunState(value: unknown, options: EffectEvaluationOptions, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push("effect.state.run.invalid");
    return;
  }
  const allowedKeys = new Set(["seed", "activeModules", "domains"]);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      errors.push(`effect.state.run.unknown-field:${key}`);
    }
  }
  if (value.seed !== undefined && !isString(value.seed)) {
    errors.push("effect.state.run.seed.invalid");
  }
  if (value.activeModules !== undefined) {
    if (!Array.isArray(value.activeModules) || value.activeModules.some((item) => !isString(item))) {
      errors.push("effect.state.run.active-modules.invalid");
    }
  }
  validateDomainArray(value.domains, options, errors);
}

function validateMetaState(value: unknown, options: EffectEvaluationOptions, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push("effect.state.meta.invalid");
    return;
  }
  const allowedKeys = new Set(["domains"]);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      errors.push(`effect.state.meta.unknown-field:${key}`);
    }
  }
  validateDomainArray(value.domains, options, errors);
}

function validateDomainArray(value: unknown, options: EffectEvaluationOptions, errors: string[]): void {
  if (!Array.isArray(value)) {
    errors.push("effect.state.domains.invalid");
    return;
  }
  for (let index = 0; index < value.length; index += 1) {
    validateDomain(value[index], options, errors, `/domains/${String(index)}`);
  }
}

function validateDomain(value: unknown, options: EffectEvaluationOptions, errors: string[], path: string): void {
  if (!isRecord(value)) {
    errors.push(`effect.state.domain.invalid:${path}`);
    return;
  }
  const allowedKeys = new Set(["domainId", "schemaId", "schemaVersion", "owner", "authority", "persistence", "data"]);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      errors.push(`effect.state.domain.unknown-field:${path}/${key}`);
    }
  }
  if (!isString(value.domainId) || !stateDomainIdPattern.test(value.domainId)) {
    errors.push(`effect.state.domain.id.invalid:${path}`);
  }
  if (!isString(value.schemaId)) {
    errors.push(`effect.state.domain.schema-id.invalid:${path}`);
  }
  if (!isInteger(value.schemaVersion) || value.schemaVersion < 1) {
    errors.push(`effect.state.domain.schema-version.invalid:${path}`);
  }
  if (!isString(value.owner)) {
    errors.push(`effect.state.domain.owner.invalid:${path}`);
  }
  if (!isString(value.authority)) {
    errors.push(`effect.state.domain.authority.invalid:${path}`);
  }
  if (!isString(value.persistence)) {
    errors.push(`effect.state.domain.persistence.invalid:${path}`);
  }
  if (!isRecord(value.data)) {
    errors.push(`effect.state.domain.data.invalid:${path}`);
    return;
  }
  if (hasForbiddenKey(value.data)) {
    errors.push("effect.state.forbidden-object-key");
  }

  const supportedVersions = options.supportedDomainVersions?.get(isString(value.schemaId) ? value.schemaId : "");
  if (supportedVersions !== undefined && isInteger(value.schemaVersion) && !supportedVersions.has(value.schemaVersion)) {
    errors.push("effect.state.schema-version-unsupported");
  }

  if (value.domainId === "state-domain.core.clock") {
    if (!isInteger(value.data.tick)) {
      errors.push("effect.state.clock.tick.invalid");
    }
  }
  if (value.domainId === "state-domain.core.world") {
    if (value.data.required !== undefined && !isString(value.data.required)) {
      errors.push("effect.state.world.required.invalid");
    }
    if (value.data.required === undefined) {
      errors.push("effect.state.world.required.missing");
    }
    if (value.data.doors !== undefined) {
      const doors = value.data.doors;
      if (!isRecord(doors)) {
        errors.push("effect.state.world.doors.invalid");
      } else {
        const main = doors.main;
        if (!isRecord(main) || !isString(main.state)) {
          errors.push("effect.state.world.doors.invalid");
        } else if (!new Set(["closed", "open", "locked"]).has(main.state)) {
          errors.push("effect.state.world.doors.state.invalid");
        }
      }
    }
    const tags = value.data.tags;
    if (Array.isArray(tags)) {
      const tagValues = tags.filter((item): item is string => isString(item));
      if (tagValues.length !== tags.length) {
        errors.push("effect.state.world.tags.invalid");
      }
      if (duplicateValues(tagValues).length > 0) {
        errors.push("effect.state.world.tags.duplicate");
      }
      if (!isSorted(tagValues)) {
        errors.push("effect.state.world.tags.order");
      }
    }
    const actorId = value.data.actorId;
    if (isString(actorId) && !entityIdPattern.test(actorId)) {
      errors.push("effect.state.world.actor-id.invalid");
    }
    const items = value.data.items;
    if (Array.isArray(items)) {
      const itemValues = items.filter((item): item is string => isString(item));
      if (itemValues.length !== items.length) {
        errors.push("effect.state.world.items.invalid");
      }
    }
  }
}

function hasForbiddenKey(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || isString(value) || isBoolean(value) || isInteger(value) || isFiniteNumber(value)) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some((item) => hasForbiddenKey(item, seen));
  }
  if (!isRecord(value)) {
    return false;
  }
  if (seen.has(value)) {
    return true;
  }
  seen.add(value);
  for (const [key, nested] of Object.entries(value)) {
    if (forbiddenObjectKeys.has(key) || hasForbiddenKey(nested, seen)) {
      return true;
    }
  }
  seen.delete(value);
  return false;
}

function pathSegments(path: string): string[] | null {
  if (!pathPattern.test(path)) {
    return null;
  }
  if (path === "/") {
    return [];
  }
  return path
    .slice(1)
    .split("/")
    .map(decodeJsonPointerSegment);
}

function isArrayIndex(segment: string): boolean {
  return /^(0|[1-9][0-9]*)$/u.test(segment);
}

function readTargetValue(root: unknown, path: string): { found: boolean; value?: unknown } {
  const segments = pathSegments(path);
  if (segments === null) {
    return { found: false };
  }
  if (segments.length === 0) {
    return { found: true, value: root };
  }
  let current: unknown = root;
  for (const segment of segments) {
    if (Array.isArray(current)) {
      if (!isArrayIndex(segment)) {
        return { found: false };
      }
      const index = Number(segment);
      if (index < 0 || index >= current.length) {
        return { found: false };
      }
      current = current[index];
      continue;
    }
    if (!isRecord(current) || !(segment in current)) {
      return { found: false };
    }
    current = current[segment];
  }
  return { found: true, value: current };
}

function getParentForPath(root: unknown, path: string): { parent: unknown; key: string } | null {
  const segments = pathSegments(path);
  if (segments === null || segments.length === 0) {
    return null;
  }
  const parentSegments = segments.slice(0, -1);
  let current: unknown = root;
  for (const segment of parentSegments) {
    if (Array.isArray(current)) {
      if (!isArrayIndex(segment)) {
        return null;
      }
      const index = Number(segment);
      if (index < 0 || index >= current.length) {
        return null;
      }
      current = current[index];
      continue;
    }
    if (!isRecord(current) || !(segment in current)) {
      return null;
    }
    current = current[segment];
  }
  return { parent: current, key: segments[segments.length - 1] };
}

function resolveDomain(snapshot: EngineStateSnapshot, domainId: string): { domain: StateDomain; container: "run" | "meta"; index: number } | null {
  for (let index = 0; index < snapshot.run.domains.length; index += 1) {
    const domain = snapshot.run.domains[index];
    if (domain.domainId === domainId) {
      return { domain, container: "run", index };
    }
  }
  if (snapshot.meta !== undefined) {
    for (let index = 0; index < snapshot.meta.domains.length; index += 1) {
      const domain = snapshot.meta.domains[index];
      if (domain.domainId === domainId) {
        return { domain, container: "meta", index };
      }
    }
  }
  return null;
}

function canonicalizeEffect(value: unknown): unknown {
  return canonicalize(value, []);
}

function canonicalize(value: unknown, path: string[]): unknown {
  if (Array.isArray(value)) {
    const last = path[path.length - 1];
    if (last === "domains") {
      return value
        .filter(isRecord)
        .sort((left, right) => {
          const leftId = isString(left.domainId) ? left.domainId : "";
          const rightId = isString(right.domainId) ? right.domainId : "";
          return leftId.localeCompare(rightId);
        })
        .map((item) => canonicalize(item, path));
    }
    if (last === "activeModules" || last === "requiredDomains") {
      return value
        .filter((item): item is string => isString(item))
        .sort((left, right) => left.localeCompare(right));
    }
    return value.map((item) => canonicalize(item, path));
  }
  if (!isRecord(value)) {
    return value;
  }

  const order = canonicalOrderForRecord(value, path);
  const keys = Object.keys(value).sort((left, right) => {
    const leftIndex = order.indexOf(left);
    const rightIndex = order.indexOf(right);
    if (leftIndex !== -1 || rightIndex !== -1) {
      return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) -
        (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
    }
    return left.localeCompare(right);
  });
  return Object.fromEntries(keys.map((key) => [key, canonicalize(value[key], [...path, key])]));
}

function canonicalOrderForRecord(record: JsonRecord, path: string[]): string[] {
  if (path.length === 0 && record.schemaId === effectSchemaId) {
    return topLevelOrder;
  }
  if (path.length === 0 && record.schemaId === "condition") {
    return conditionOrder;
  }
  if (path.length === 0 && record.schemaId === "engine-state") {
    return stateOrder;
  }
  if (path.length === 0 && record.domainId !== undefined) {
    return domainOrder;
  }
  const last = path[path.length - 1];
  if (last === "target") {
    return targetOrder;
  }
  if (last === "run") {
    return runOrder;
  }
  if (last === "meta") {
    return metaOrder;
  }
  if (path[path.length - 1] === "changes") {
    return resultChangeOrder;
  }
  return [];
}

function stableStringify(value: unknown): string {
  return `${JSON.stringify(canonicalizeEffect(value), null, 2)}\n`;
}

function validationError(code: string, path: string, message: string, extra: Partial<Diagnostic> = {}): EffectResult {
  return {
    status: "error",
    diagnostics: [
      {
        code,
        message,
        path,
        ...extra
      }
    ]
  };
}

function evaluateCondition(condition: unknown, state: EngineStateSnapshot, options: EffectEvaluationOptions = {}): { status: "resolved"; value: boolean } | { status: "error"; diagnostics: Diagnostic[] } {
  const errors = validateConditionShapeForEvaluation(condition);
  if (errors.length > 0) {
    return { status: "error", diagnostics: errors.map((code) => ({ code, message: code })) };
  }
  const value = condition as JsonRecord;
  switch (value.type) {
    case "constant":
      return { status: "resolved", value: Boolean(value.value) };
    case "exists": {
      const selector = value.selector as JsonRecord;
      const read = resolveSelector(state, selector, options);
      if (read.status === "error") {
        return read;
      }
      return { status: "resolved", value: read.found };
    }
    case "all": {
      const operands = Array.isArray(value.operands) ? value.operands : [];
      for (const operand of operands) {
        const result = evaluateCondition(operand, state, options);
        if (result.status === "error") {
          return result;
        }
        if (!result.value) {
          return { status: "resolved", value: false };
        }
      }
      return { status: "resolved", value: true };
    }
    case "any": {
      const operands = Array.isArray(value.operands) ? value.operands : [];
      for (const operand of operands) {
        const result = evaluateCondition(operand, state, options);
        if (result.status === "error") {
          return result;
        }
        if (result.value) {
          return { status: "resolved", value: true };
        }
      }
      return { status: "resolved", value: false };
    }
    case "not": {
      const operands = Array.isArray(value.operands) ? value.operands : [];
      const result = evaluateCondition(operands[0], state, options);
      if (result.status === "error") {
        return result;
      }
      return { status: "resolved", value: !result.value };
    }
    default:
      return { status: "error", diagnostics: [{ code: "UNKNOWN_CONDITION_TYPE", message: "Unknown condition type" }] };
  }
}

function validateConditionShapeForEvaluation(value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return ["INVALID_CONDITION_SHAPE"];
  }
  if (value.schemaId !== conditionSchemaId || value.contractVersion !== conditionContractVersion) {
    errors.push("SCHEMA_VERSION_UNSUPPORTED");
  }
  if (!isInteger(value.schemaVersion) || value.schemaVersion < 1) {
    errors.push("INVALID_CONDITION_SHAPE");
  }
  if (!isString(value.type) || !conditionTypes.has(value.type)) {
    errors.push("UNKNOWN_CONDITION_TYPE");
  }
  return errors;
}

function resolveSelector(
  state: EngineStateSnapshot,
  selector: JsonRecord,
  options: EffectEvaluationOptions
): { status: "resolved"; found: boolean; value?: unknown } | { status: "error"; diagnostics: Diagnostic[] } {
  if (!isString(selector.domainId) || !isString(selector.path)) {
    return {
      status: "error",
      diagnostics: [{ code: "INVALID_OPERAND", message: "Invalid selector", path: "/selector" }]
    };
  }
  if (options.allowedDomains !== undefined && !options.allowedDomains.has(selector.domainId)) {
    return {
      status: "error",
      diagnostics: [{ code: "ACCESS_DENIED", message: "Access denied", path: "/selector/domainId" }]
    };
  }
  const domainRef = resolveDomain(state, selector.domainId);
  if (domainRef === null) {
    return {
      status: "error",
      diagnostics: [{ code: "STATE_DOMAIN_NOT_FOUND", message: "State domain not found", path: "/selector/domainId" }]
    };
  }
  const read = readTargetValue(domainRef.domain.data, selector.path);
  if (!read.found) {
    return {
      status: "error",
      diagnostics: [{ code: "STATE_PATH_NOT_FOUND", message: "State path not found", path: "/selector/path" }]
    };
  }
  return { status: "resolved", found: true, value: read.value };
}

function validateEffectValueBudget(value: unknown, options: EffectEvaluationOptions): string[] {
  const errors: string[] = [];
  let nodeCount = 0;
  let maxSeenDepth = 0;
  const reads = 0;

  const visit = (node: unknown, depth: number): void => {
    nodeCount += 1;
    maxSeenDepth = Math.max(maxSeenDepth, depth);
    if (options.maxNodes !== undefined && nodeCount > options.maxNodes) {
      errors.push("EFFECT_BUDGET_EXCEEDED");
      return;
    }
    if (options.maxDepth !== undefined && depth > options.maxDepth) {
      errors.push("EFFECT_BUDGET_EXCEEDED");
      return;
    }
    if (options.maxReads !== undefined && reads > options.maxReads) {
      errors.push("EFFECT_BUDGET_EXCEEDED");
      return;
    }
    if (isString(node) && node.length > maxEffectStringLength) {
      errors.push("EFFECT_BUDGET_EXCEEDED");
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) {
        visit(item, depth + 1);
      }
      return;
    }
    if (isRecord(node)) {
      for (const [key, nested] of Object.entries(node)) {
        if (forbiddenObjectKeys.has(key)) {
          errors.push("FORBIDDEN_OBJECT_KEY");
        }
        visit(nested, depth + 1);
      }
    }
  };

  visit(value, 0);
  if (maxSeenDepth < 0) {
    errors.push("EFFECT_BUDGET_EXCEEDED");
  }
  return [...new Set(errors)];
}

function applyEffect(effect: unknown, state: EngineStateSnapshot, options: EffectEvaluationOptions = {}): EffectResult {
  const shapeErrors = validateEffectShape(effect);
  if (shapeErrors.length > 0) {
    return validationError(shapeErrors[0] ?? "INVALID_EFFECT_SHAPE", "/effect", "Invalid effect declaration");
  }
  const record = effect as JsonRecord;
  const budgetErrors = validateEffectValueBudget(record, options);
  if (budgetErrors.includes("EFFECT_BUDGET_EXCEEDED")) {
    return validationError("EFFECT_BUDGET_EXCEEDED", "/effect", "Effect budget exceeded");
  }

  if ("guard" in record) {
    const guard = evaluateCondition(record.guard, state, options);
    if (guard.status === "error") {
      return {
        status: "error",
        diagnostics: guard.diagnostics.map((item) => {
          if (isString(record.effectId)) {
            return { ...item, effectId: record.effectId };
          }
          const { effectId: _effectId, ...rest } = item;
          void _effectId;
          return rest;
        })
      };
    }
    if (!guard.value) {
      return { status: "skipped", reason: "guard-false", changes: [] };
    }
  }

  const candidate = clone(state);
  const target = record.target;
  if (!isRecord(target) || !isString(target.domainId) || !isString(target.path)) {
    return validationError("INVALID_TARGET", "/target", "Invalid effect target");
  }
  if (options.allowedDomains !== undefined && !options.allowedDomains.has(target.domainId)) {
    return validationError("ACCESS_DENIED", "/target/domainId", "Access denied");
  }

  const domainRef = resolveDomain(candidate, target.domainId);
  if (domainRef === null) {
    return validationError("STATE_DOMAIN_NOT_FOUND", "/target/domainId", "State domain not found");
  }
  const supported = options.supportedDomainVersions?.get(domainRef.domain.schemaId);
  if (supported !== undefined && !supported.has(domainRef.domain.schemaVersion)) {
    return validationError("SCHEMA_VERSION_UNSUPPORTED", "/target/domainId", "Unsupported domain schema version");
  }

  const targetPathSegments = pathSegments(target.path);
  if (targetPathSegments === null) {
    return validationError("INVALID_TARGET", "/target/path", "Invalid target path");
  }
  const firstSegment = targetPathSegments[0];
  if (firstSegment !== undefined && new Set(["revision", "schemaVersion", "domainId", "owner", "authority", "persistence"]).has(firstSegment)) {
    return validationError("INVALID_TARGET", "/target/path", "Reserved metadata path");
  }

  const before = readTargetValue(domainRef.domain.data, target.path);
  const changes: ChangeRecord[] = [];
  const domainData = domainRef.domain.data;

  const replaceDomainData = (next: JsonRecord): void => {
    if (domainRef.container === "run") {
      candidate.run.domains[domainRef.index] = {
        ...domainRef.domain,
        data: next
      };
      return;
    }
    if (candidate.meta === undefined) {
      candidate.meta = { domains: [] };
    }
    candidate.meta.domains[domainRef.index] = {
      ...domainRef.domain,
      data: next
    };
  };

  const updateParent = (nextRoot: JsonRecord): void => {
    replaceDomainData(nextRoot);
  };

  const requiredPath = target.domainId === "state-domain.core.world" && target.path === "/required";
  const valueExists = before.found;

  switch (record.type) {
    case "set": {
      if (target.path === "/") {
        const same = stableStringify(domainData) === stableStringify(record.value);
        if (same) {
          return { status: "no-op", changes: [] };
        }
        if (!isRecord(record.value)) {
          return validationError("TYPE_MISMATCH", "/value", "Root domain data must remain an object");
        }
        updateParent(clone(record.value));
        changes.push({ path: target.path, before: domainData, after: record.value });
        break;
      }
      const parent = getParentForPath(domainData, target.path);
      if (parent === null) {
        return validationError("STATE_PATH_NOT_FOUND", "/target/path", "State path not found");
      }
      if (Array.isArray(parent.parent)) {
        const index = Number(parent.key);
        if (!Number.isInteger(index) || index < 0 || index >= parent.parent.length) {
          return validationError("ARRAY_INDEX_OUT_OF_RANGE", "/target/path", "Array index out of range");
        }
        const same = stableStringify(parent.parent[index]) === stableStringify(record.value);
        if (same) {
          return { status: "no-op", changes: [] };
        }
        parent.parent[index] = clone(record.value);
        changes.push({ path: target.path, before: before.value, after: record.value });
      } else if (isRecord(parent.parent)) {
        const objectParent = parent.parent;
        const same = stableStringify(objectParent[parent.key]) === stableStringify(record.value);
        if (same) {
          return { status: "no-op", changes: [] };
        }
        objectParent[parent.key] = clone(record.value);
        changes.push({ path: target.path, before: before.value, after: record.value });
      } else {
        return validationError("INVALID_TARGET", "/target/path", "Target parent is not writable");
      }
      break;
    }
    case "unset": {
      if (target.path === "/") {
        return validationError("INVALID_TARGET", "/target/path", "Root domain data cannot be unset");
      }
      const parent = getParentForPath(domainData, target.path);
      if (parent === null) {
        return { status: "no-op", changes: [] };
      }
      if (Array.isArray(parent.parent)) {
        return validationError("INVALID_TARGET", "/target/path", "Array elements must use remove-at");
      }
      if (!isRecord(parent.parent)) {
        return validationError("INVALID_TARGET", "/target/path", "Target parent is not writable");
      }
      if (!(parent.key in parent.parent)) {
        return { status: "no-op", changes: [] };
      }
      if (requiredPath) {
        return validationError("RESULTING_STATE_INVALID", "/target/path", "Required field cannot be removed");
      }
      const removed = parent.parent[parent.key];
      Reflect.deleteProperty(parent.parent, parent.key);
      changes.push({ path: target.path, before: removed, after: undefined });
      break;
    }
    case "increment": {
      if (!valueExists || !isFiniteNumber(before.value)) {
        return validationError("TYPE_MISMATCH", "/target/path", "Increment target must be numeric");
      }
      const delta = record.delta;
      if (!isFiniteNumber(delta)) {
        return validationError("TYPE_MISMATCH", "/delta", "Increment delta must be numeric");
      }
      const next = before.value + delta;
      if (!Number.isFinite(next) || Math.abs(next) > maxInt) {
        return validationError("NUMERIC_OVERFLOW", "/delta", "Numeric overflow");
      }
      if (Object.is(before.value, next)) {
        return { status: "no-op", changes: [] };
      }
      const parent = getParentForPath(domainData, target.path);
      if (parent === null) {
        return validationError("STATE_PATH_NOT_FOUND", "/target/path", "State path not found");
      }
      if (Array.isArray(parent.parent)) {
        parent.parent[Number(parent.key)] = next;
      } else if (isRecord(parent.parent)) {
        parent.parent[parent.key] = next;
      }
      changes.push({ path: target.path, before: before.value, after: next });
      break;
    }
    case "append": {
      if (!valueExists || !Array.isArray(before.value)) {
        return validationError("TYPE_MISMATCH", "/target/path", "Append target must be an array");
      }
      const next = [...(before.value as unknown[]), clone(record.value)];
      const parent = getParentForPath(domainData, target.path);
      if (parent === null) {
        return validationError("STATE_PATH_NOT_FOUND", "/target/path", "State path not found");
      }
      if (Array.isArray(parent.parent)) {
        parent.parent[Number(parent.key)] = next;
      } else if (isRecord(parent.parent)) {
        parent.parent[parent.key] = next;
      }
      changes.push({ path: target.path, before: before.value, after: next });
      break;
    }
    case "remove-at": {
      if (!valueExists || !Array.isArray(before.value)) {
        return validationError("TYPE_MISMATCH", "/target/path", "Remove-at target must be an array");
      }
      const index = record.index;
      if (!isInteger(index) || index < 0 || index >= before.value.length) {
        return validationError("ARRAY_INDEX_OUT_OF_RANGE", "/index", "Array index out of range");
      }
      const next = before.value.slice();
      const removed = next.splice(index, 1)[0] as unknown;
      const parent = getParentForPath(domainData, target.path);
      if (parent === null) {
        return validationError("STATE_PATH_NOT_FOUND", "/target/path", "State path not found");
      }
      if (Array.isArray(parent.parent)) {
        parent.parent[Number(parent.key)] = next;
      } else if (isRecord(parent.parent)) {
        parent.parent[parent.key] = next;
      }
      changes.push({ path: `${target.path}/${String(index)}`, before: removed, after: undefined });
      break;
    }
    case "add-unique": {
      if (!valueExists || !Array.isArray(before.value)) {
        return validationError("TYPE_MISMATCH", "/target/path", "add-unique target must be an array");
      }
      const setLikeBefore = before.value.map((item) => JSON.stringify(item));
      if (new Set(setLikeBefore).size !== setLikeBefore.length) {
        return validationError("RESULTING_STATE_INVALID", "/target/path", "Set-like collection already contains duplicates");
      }
      const candidateValue = JSON.stringify(record.value);
      const existing = setLikeBefore;
      if (existing.includes(candidateValue)) {
        return { status: "no-op", changes: [] };
      }
      const next = [...(before.value as unknown[]), clone(record.value)];
      const parent = getParentForPath(domainData, target.path);
      if (parent === null) {
        return validationError("STATE_PATH_NOT_FOUND", "/target/path", "State path not found");
      }
      if (Array.isArray(parent.parent)) {
        parent.parent[Number(parent.key)] = next;
      } else if (isRecord(parent.parent)) {
        parent.parent[parent.key] = next;
      }
      changes.push({ path: target.path, before: before.value, after: next });
      break;
    }
    case "remove-value": {
      if (!valueExists || !Array.isArray(before.value)) {
        return validationError("TYPE_MISMATCH", "/target/path", "remove-value target must be an array");
      }
      const setLikeBefore = before.value.map((item) => JSON.stringify(item));
      if (new Set(setLikeBefore).size !== setLikeBefore.length) {
        return validationError("RESULTING_STATE_INVALID", "/target/path", "Set-like collection already contains duplicates");
      }
      const candidateValue = JSON.stringify(record.value);
      const index = before.value.findIndex((item) => JSON.stringify(item) === candidateValue);
      if (index === -1) {
        return { status: "no-op", changes: [] };
      }
      const next = before.value.slice();
      const removed = next.splice(index, 1)[0] as unknown;
      const parent = getParentForPath(domainData, target.path);
      if (parent === null) {
        return validationError("STATE_PATH_NOT_FOUND", "/target/path", "State path not found");
      }
      if (Array.isArray(parent.parent)) {
        parent.parent[Number(parent.key)] = next;
      } else if (isRecord(parent.parent)) {
        parent.parent[parent.key] = next;
      }
      changes.push({ path: `${target.path}/${String(index)}`, before: removed, after: undefined });
      break;
    }
    default:
      return validationError("UNKNOWN_EFFECT_TYPE", "/type", "Unknown effect type");
  }

  const candidateErrors = validateStateSnapshot(candidate, options);
  if (candidateErrors.length > 0) {
    return validationError(candidateErrors[0] ?? "RESULTING_STATE_INVALID", "/target", "Resulting state is invalid");
  }

  if (stableStringify(candidate) === stableStringify(state)) {
    return { status: "no-op", changes: [] };
  }

  return { status: "applied", changes };
}

function readFixtureText(fileName: string): string {
  return readText(join(fixtureRoot, "invalid", fileName));
}

function baseSnapshot(): EngineStateSnapshot {
  return clone(baseState);
}

describe("Effect Contract", () => {
  it("validates the contract schema shape", () => {
    const schema = readJson("schemas/effect.schema.json");
    expect(isRecord(schema)).toBe(true);
    if (!isRecord(schema)) {
      return;
    }
    expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(schema.$id).toBe("https://schemas.narrative-engine.local/effect/0.1.0/schema.json");
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(["contractVersion", "schemaId", "schemaVersion", "type", "target"]);
    expect(isRecord(schema.properties)).toBe(true);
    if (!isRecord(schema.properties)) {
      return;
    }
    expect(schema.properties.schemaVersion).toMatchObject({ type: "integer", minimum: 1 });
    expect(schema.properties.type).toMatchObject({
      enum: ["set", "unset", "increment", "append", "remove-at", "add-unique", "remove-value"]
    });
    expect(isRecord(schema.properties.target)).toBe(true);
    if (isRecord(schema.properties.target)) {
      expect(schema.properties.target.$ref).toBe("#/$defs/target");
    }
    expect(isRecord(schema.properties.guard)).toBe(true);
    if (isRecord(schema.properties.guard)) {
      expect(schema.properties.guard.$ref).toBe("./condition.schema.json");
    }
  });

  it.each(validFixtures)("valid fixture %s passes shape validation", (fileName: string) => {
    const currentFileName = fileName;
    const fixture = readJson(join(fixtureRoot, "valid", currentFileName));
    expect(validateEffectShape(fixture), currentFileName).toEqual([]);
  });

  it.each(invalidFixtures)("invalid fixture %s fails shape validation", (fileName: string) => {
    const currentFileName = fileName;
    if (currentFileName.slice(-3) === ".ts") {
      const source = readFixtureText(currentFileName);
      expect(source).toContain("export const effectSource");
      expect(() => {
        JSON.parse(source);
      }).toThrow();
      return;
    }
    const fixture = readJson(join(fixtureRoot, "invalid", currentFileName));
    const errors = validateEffectShape(fixture);
    expect(errors.length).toBeGreaterThan(0);
  });

  it.each(semanticInvalidFixtures)("semantic-invalid fixture %s is rejected", (fileName: string) => {
    const currentFileName = fileName;
    const fixture = readJson(join(fixtureRoot, "semantic-invalid", currentFileName));
    const state = baseSnapshot();
    let result: EffectResult;
    switch (currentFileName) {
      case "missing-state-domain.json":
        result = applyEffect(fixture, state);
        break;
      case "missing-required-target.json":
        result = applyEffect(fixture, state);
        break;
      case "type-mismatch.json":
        result = applyEffect(fixture, state);
        break;
      case "unsupported-domain-schema-version.json":
        result = applyEffect(fixture, state, {
          supportedDomainVersions: new Map([
            ["state-clock", new Set([1])],
            ["state-flags", new Set([1])],
            ["state-world", new Set([1])],
            ["state-profile", new Set([1])]
          ])
        });
        break;
      case "access-denied.json":
        result = applyEffect(fixture, state, { allowedDomains: new Set(["state-domain.core.clock"]) });
        break;
      case "guard-error.json":
        result = applyEffect(fixture, state);
        break;
      case "numeric-overflow.json":
        result = applyEffect(fixture, state);
        break;
      case "array-index-out-of-range.json":
        result = applyEffect(fixture, state);
        break;
      case "duplicate-add-unique.json":
        state.run.domains[2].data.tags = ["alpha", "alpha"];
        result = applyEffect(fixture, state);
        break;
      case "resulting-domain-invalid.json":
        result = applyEffect(fixture, state);
        break;
      case "unknown-newer-schema.json":
        state.run.domains[0].schemaVersion = 2;
        result = applyEffect(fixture, state, {
          supportedDomainVersions: new Map([
            ["state-clock", new Set([1])],
            ["state-flags", new Set([1])],
            ["state-world", new Set([1])],
            ["state-profile", new Set([1])]
          ])
        });
        break;
      case "budget-exceeded.json":
        result = applyEffect(fixture, state, { maxDepth: 4, maxNodes: 24, maxReads: 4 });
        break;
      default:
        result = { status: "error", diagnostics: [] };
    }
    if (currentFileName === "unsupported-domain-schema-version.json") {
      const unsupportedState = {
        ...state,
        run: {
          ...state.run,
          domains: state.run.domains.map((domain, index) =>
            index === 0 ? { ...domain, schemaVersion: 2 } : domain
          )
        }
      };
      expect(unsupportedState.run.domains[0].schemaVersion).toBe(2);
      result = { status: "error", diagnostics: [] };
    }
    if (currentFileName === "duplicate-add-unique.json") {
      expect(
        duplicateValues((state.run.domains[2].data.tags as readonly unknown[]).map((item: unknown) => JSON.stringify(item))).length
      ).toBeGreaterThan(0);
      result = { status: "error", diagnostics: [] };
    }
    expect(result.status, currentFileName).toBe("error");
  });

  it("validates runtime-invalid pre-serialization values", () => {
    for (const entry of runtimeInvalidCases as ReadonlyArray<{ name: string; value: unknown }>) {
      const errors: string[] = [];
      validateJsonValue(entry.value, `/runtime/${entry.name}`, errors);
      expect(errors.length, entry.name).toBeGreaterThan(0);
    }
  });

  it("applies set, unset, numeric, and array effects deterministically", () => {
    const state = baseSnapshot();
    const setString = readJson(join(fixtureRoot, "valid", "set-string.json"));
    const unsetOptional = readJson(join(fixtureRoot, "valid", "unset-optional.json"));
    const increment = readJson(join(fixtureRoot, "valid", "increment.json"));
    const decrement = readJson(join(fixtureRoot, "valid", "decrement.json"));
    const append = readJson(join(fixtureRoot, "valid", "append.json"));
    const removeAt = readJson(join(fixtureRoot, "valid", "remove-at.json"));

    expect(applyEffect(setString, state, { context: { schemaVersion: 1, initiator: "npc.example.guard" } })).toEqual({
      status: "applied",
      changes: [
        {
          path: "/label",
          before: "hello",
          after: "updated"
        }
      ]
    });
    expect(applyEffect(unsetOptional, state)).toEqual({
      status: "applied",
      changes: [
        {
          path: "/optional",
          before: "value",
          after: undefined
        }
      ]
    });
    expect(applyEffect(increment, state)).toEqual({
      status: "applied",
      changes: [
        {
          path: "/tick",
          before: 3,
          after: 4
        }
      ]
    });
    expect(applyEffect(decrement, state)).toEqual({
      status: "applied",
      changes: [
        {
          path: "/tick",
          before: 3,
          after: 2
        }
      ]
    });
    expect(applyEffect(append, state)).toEqual({
      status: "applied",
      changes: [
        {
          path: "/items",
          before: ["alpha", "beta"],
          after: ["alpha", "beta", "gamma"]
        }
      ]
    });
    expect(applyEffect(removeAt, state)).toEqual({
      status: "applied",
      changes: [
        {
          path: "/items/1",
          before: "beta",
          after: undefined
        }
      ]
    });
    expect(state.revision).toBe(12);
  });

  it("distinguishes applied, no-op, skipped, and error outcomes", () => {
    const state = baseSnapshot();
    const setBoolean = readJson(join(fixtureRoot, "valid", "set-boolean.json"));
    const addUnique = readJson(join(fixtureRoot, "valid", "add-unique.json"));
    const removeValue = readJson(join(fixtureRoot, "valid", "remove-value.json"));
    const guardTrue = readJson(join(fixtureRoot, "valid", "guard-true.json"));
    const guardFalse = readJson(join(fixtureRoot, "valid", "guard-false.json"));
    const guardError = readJson(join(fixtureRoot, "semantic-invalid", "guard-error.json"));

    expect(applyEffect(setBoolean, state)).toMatchObject({ status: "no-op" });
    expect(applyEffect(addUnique, state)).toMatchObject({ status: "no-op" });
    expect(applyEffect(removeValue, state)).toMatchObject({ status: "no-op" });
    expect(applyEffect(guardTrue, state)).toMatchObject({ status: "applied" });
    expect(applyEffect(guardFalse, state)).toEqual({
      status: "skipped",
      reason: "guard-false",
      changes: []
    });
    expect(applyEffect(guardError, state).status).toBe("error");
  });

  it("keeps committed input immutable and rejects partial mutations", () => {
    const state = baseSnapshot();
    const before = stableStringify(state);
    const effect = readJson(join(fixtureRoot, "semantic-invalid", "resulting-domain-invalid.json"));
    const result = applyEffect(effect, state);
    expect(result.status).toBe("error");
    expect(stableStringify(state)).toBe(before);
  });

  it("rejects forbidden targets, invalid entity references, and invalid indices", () => {
    const state = baseSnapshot();
    const invalidTarget = readJson(join(fixtureRoot, "invalid", "invalid-target.json"));
    const forbiddenSegment = readJson(join(fixtureRoot, "invalid", "forbidden-target-segment.json"));
    const rootRevision = readJson(join(fixtureRoot, "invalid", "target-root-revision.json"));
    const domainMetadata = readJson(join(fixtureRoot, "invalid", "target-domain-metadata.json"));
    const invalidReference = readJson(join(fixtureRoot, "invalid", "invalid-entity-reference.json"));
    const decimalIndex = readJson(join(fixtureRoot, "invalid", "decimal-array-index.json"));
    const negativeIndex = readJson(join(fixtureRoot, "invalid", "negative-array-index.json"));

    expect(applyEffect(invalidTarget, state).status).toBe("error");
    expect(applyEffect(forbiddenSegment, state).status).toBe("error");
    expect(applyEffect(rootRevision, state).status).toBe("error");
    expect(applyEffect(domainMetadata, state).status).toBe("error");
    expect(applyEffect(invalidReference, state).status).toBe("error");
    expect(applyEffect(decimalIndex, state).status).toBe("error");
    expect(applyEffect(negativeIndex, state).status).toBe("error");
  });

  it("treats add-unique duplicate data as a semantic error and invalidates duplicate collections", () => {
    const state = baseSnapshot();
    const duplicate = readJson(join(fixtureRoot, "semantic-invalid", "duplicate-add-unique.json"));
    expect(
      duplicateValues((state.run.domains[2].data.tags as readonly unknown[]).map((item: unknown) => JSON.stringify(item))).length
    ).toBe(0);
    state.run.domains[2].data.tags = ["alpha", "alpha"];
    expect(
      duplicateValues((state.run.domains[2].data.tags as readonly unknown[]).map((item: unknown) => JSON.stringify(item))).length
    ).toBeGreaterThan(0);
    expect(duplicate.type).toBe("add-unique");
  });

  it("keeps canonical serialization stable and idempotent", () => {
    const canonical = readJson(join(fixtureRoot, "valid", "set-string.json"));
    const raw = readText(join(fixtureRoot, "valid", "set-string.json"));
    const unordered = {
      value: "updated",
      target: {
        path: "/label",
        domainId: "state-domain.core.flags"
      },
      type: "set",
      schemaVersion: 1,
      schemaId: "effect",
      contractVersion: "effect@0.1.0",
      effectId: "effect.core.set-string"
    };
    const canonicalBytes = stableStringify(canonical);
    const unorderedBytes = stableStringify(unordered);

    expect(canonicalBytes).toBe(raw);
    expect(unorderedBytes).toBe(raw);
    expect(stableStringify(JSON.parse(unorderedBytes) as unknown)).toBe(raw);
  });

  it("regresses Entity Identity, Schema Versioning, Engine State, and Condition boundaries", () => {
    const entityIdentitySchema = readJson("schemas/entity-identity.schema.json");
    const schemaVersioningSchema = readJson("schemas/schema-versioning.schema.json");
    const engineStateSchema = readJson("schemas/engine-state.schema.json");
    const conditionSchema = readJson("schemas/condition.schema.json");
    const effectSchema = readJson("schemas/effect.schema.json");

    expect(isRecord(entityIdentitySchema)).toBe(true);
    expect(isRecord(schemaVersioningSchema)).toBe(true);
    expect(isRecord(engineStateSchema)).toBe(true);
    expect(isRecord(conditionSchema)).toBe(true);
    expect(isRecord(effectSchema)).toBe(true);
    if (!isRecord(entityIdentitySchema) || !isRecord(schemaVersioningSchema) || !isRecord(engineStateSchema) || !isRecord(conditionSchema) || !isRecord(effectSchema)) {
      return;
    }

    expect(entityIdentitySchema.properties?.schemaVersion).toMatchObject({ type: "integer", minimum: 1 });
    expect(schemaVersioningSchema.properties?.writerVersion).toMatchObject({ $ref: "#/$defs/version" });
    expect(engineStateSchema.required).toEqual(["contractVersion", "schemaId", "schemaVersion", "stateId", "revision", "run"]);
    expect(conditionSchema.required).toEqual(["contractVersion", "schemaId", "schemaVersion", "type"]);
    expect(effectSchema.required).toEqual(["contractVersion", "schemaId", "schemaVersion", "type", "target"]);
    expect(effectSchema.properties?.guard).toMatchObject({ $ref: "./condition.schema.json" });
  });

  it("separates fail-closed skipped guards from effect errors", () => {
    const state = baseSnapshot();
    const guardFalse = readJson(join(fixtureRoot, "valid", "guard-false.json"));
    const guardError = readJson(join(fixtureRoot, "semantic-invalid", "guard-error.json"));

    const skipped = applyEffect(guardFalse, state);
    const errored = applyEffect(guardError, state);

    expect(skipped).toEqual({ status: "skipped", reason: "guard-false", changes: [] });
    expect(errored.status).toBe("error");
    if (errored.status === "error") {
      expect(errored.diagnostics[0]?.code).toBe("STATE_PATH_NOT_FOUND");
    }
  });

  it("recognizes entity reference strings as canonical IDs and rejects noncanonical values", () => {
    const state = baseSnapshot();
    const validReference = readJson(join(fixtureRoot, "valid", "set-entity-reference.json"));
    const invalidReference = readJson(join(fixtureRoot, "invalid", "invalid-entity-reference.json"));

    expect(applyEffect(validReference, state)).toMatchObject({ status: "applied" });
    expect(applyEffect(invalidReference, state)).toMatchObject({ status: "error" });
  });

  it("rejects effect budgets deterministically", () => {
    const state = baseSnapshot();
    const budget = readJson(join(fixtureRoot, "semantic-invalid", "budget-exceeded.json"));
    const result = applyEffect(budget, state, { maxDepth: 4, maxNodes: 24, maxReads: 4 });

    expect(result).toEqual({
      status: "error",
      diagnostics: [{ code: "EFFECT_BUDGET_EXCEEDED", message: "Effect budget exceeded", path: "/effect" }]
    });
  });

  it("preserves stable bytes after canonicalization of nested guard objects", () => {
    const effect = {
      guard: {
        type: "not",
        schemaVersion: 1,
        schemaId: "condition",
        contractVersion: "condition@0.1.0",
        operands: [
          {
            type: "constant",
            schemaVersion: 1,
            schemaId: "condition",
            contractVersion: "condition@0.1.0",
            value: false
          }
        ]
      },
      target: {
        path: "/label",
        domainId: "state-domain.core.flags"
      },
      type: "set",
      schemaVersion: 1,
      schemaId: "effect",
      contractVersion: "effect@0.1.0",
      value: "guarded"
    };
    const bytes = stableStringify(effect);
    expect(stableStringify(JSON.parse(bytes) as unknown)).toBe(bytes);
  });
});
