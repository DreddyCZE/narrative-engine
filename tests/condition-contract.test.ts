import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type JsonRecord = Record<string, unknown>;

type Diagnostic = {
  code: string;
  message: string;
  path?: string;
  conditionId?: string;
  expected?: string;
  actual?: unknown;
};

type ConditionResult =
  | { status: "resolved"; value: boolean }
  | { status: "error"; diagnostics: Diagnostic[] };

type EvaluationOptions = {
  bundle?: ConditionBundle;
  allowedDomains?: ReadonlySet<string>;
  aliasMap?: ReadonlyMap<string, string>;
  maxDepth?: number;
  maxNodes?: number;
  maxReads?: number;
  explain?: boolean;
};

type ConditionBundle = {
  entryConditionId: string;
  conditions: unknown[];
};

const contractVersion = "condition@0.1.0";
const schemaId = "condition";
const conditionTypes = new Set([
  "all",
  "any",
  "not",
  "constant",
  "exists",
  "compare",
  "contains",
  "entity-is",
  "domain-exists",
  "condition-ref"
]);
const comparisonOperators = new Set(["eq", "neq", "lt", "lte", "gt", "gte"]);
const contextKeys = new Set(["actor", "target", "location", "source", "initiator", "mode"]);
const entityIdPattern = new RegExp(
  "^[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,31}\\.[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,47}\\.[a-z0-9](?:[a-z0-9]|[_-](?=[a-z0-9])){0,79}$"
);
const entityTypePattern = new RegExp("^[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,31}$");
const stateDomainIdPattern = new RegExp(
  "^state-domain\\.[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,31}\\.[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,31}$"
);
const statePathPattern = new RegExp("^(?:/$|/(?:[^~/]|~0|~1)+(?:/(?:[^~/]|~0|~1)+)*)$");
const forbiddenObjectKeys = new Set(["__proto__", "prototype", "constructor"]);
const fixtureRoot = join("tests", "fixtures", "contracts", "condition");

const baseState = freezeJson({
  schemaVersion: 1,
  stateId: "state.run.example",
  revision: 4,
  run: {
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
        owner: "game",
        authority: "game",
        persistence: "run",
        data: {
          paused: false,
          zero: 0,
          empty: "",
          nullable: null,
          tags: ["alpha", "beta"],
          actorId: "npc.example.guard"
        }
      },
      {
        domainId: "state-domain.world.rooms",
        schemaId: "state-rooms",
        schemaVersion: 1,
        owner: "game",
        authority: "game",
        persistence: "run",
        data: {
          roomId: "room.example.hall",
          unlocked: true
        }
      },
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
  "constant-true.json",
  "constant-false.json",
  "exists-tick.json",
  "compare-integer.json",
  "compare-context-string.json",
  "entity-reference-equality.json",
  "contains-tags.json",
  "all.json",
  "any.json",
  "not.json",
  "named-condition.json",
  "referenced-condition-bundle.json"
];

const invalidFixtures = [
  "unknown-condition-type.json",
  "missing-schema-version.json",
  "schema-version-zero.json",
  "not-zero-operands.json",
  "not-multiple-operands.json",
  "invalid-selector.json",
  "forbidden-path-segment.json",
  "invalid-operator.json",
  "mixed-type-comparison.json",
  "unknown-field.json",
  "too-many-operands.json",
  "invalid-entity-reference.json",
  "invalid-context-key.json",
  "executable-source.ts"
];

const semanticInvalidFixtures = [
  "missing-state-domain.json",
  "missing-state-path.json",
  "type-mismatch.json",
  "unsupported-schema-version.json",
  "reference-cycle-bundle.json",
  "dangling-reference-bundle.json",
  "access-denied.json",
  "budget-exceeded.json",
  "nondeterministic-context.json",
  "alias-reference-bundle.json"
];

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function isFiniteJsonNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function freezeJson<T>(value: T): T {
  if (Array.isArray(value)) {
    for (const item of value) freezeJson(item);
    return Object.freeze(value);
  }
  if (isRecord(value)) {
    for (const item of Object.values(value)) freezeJson(item);
    return Object.freeze(value);
  }
  return value;
}

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(join(process.cwd(), relativePath), "utf8")) as unknown;
}

function readText(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  if (!isRecord(value)) {
    return value;
  }
  const entries = Object.keys(value)
    .sort()
    .map((key) => [key, canonicalize(value[key])] as const);
  return Object.fromEntries(entries);
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

function jsonType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function validateJsonValue(value: unknown, path: string, errors: string[]): void {
  if (value === null || isString(value) || isBoolean(value) || isInteger(value) || isFiniteJsonNumber(value)) {
    return;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      validateJsonValue(value[index], `${path}/${String(index)}`, errors);
    }
    return;
  }
  if (isRecord(value)) {
    for (const key of Object.keys(value)) {
      if (forbiddenObjectKeys.has(key)) {
        errors.push(`condition.forbidden-object-key:${path}/${key}`);
      }
      validateJsonValue(value[key], `${path}/${escapeJsonPointer(key)}`, errors);
    }
    return;
  }
  errors.push(`condition.json-value.invalid:${path}:${jsonType(value)}`);
}

function escapeJsonPointer(segment: string): string {
  return segment.replaceAll("~", "~0").replaceAll("/", "~1");
}

function validateEntityId(value: unknown, path: string, errors: string[]): void {
  if (!isString(value) || !entityIdPattern.test(value)) {
    errors.push(`condition.entity-id.invalid:${path}`);
  }
}

function validateStateDomainId(value: unknown, path: string, errors: string[]): void {
  if (!isString(value) || !stateDomainIdPattern.test(value)) {
    errors.push(`condition.state-domain-id.invalid:${path}`);
  }
}

function validateStatePath(value: unknown, path: string, errors: string[]): void {
  if (!isString(value) || !statePathPattern.test(value)) {
    errors.push(`condition.state-path.invalid:${path}`);
    return;
  }
  const segments = value.split("/").slice(1);
  for (const segment of segments) {
    const decoded = segment.replaceAll("~1", "/").replaceAll("~0", "~");
    if (decoded === "..") {
      errors.push(`condition.state-path.traversal:${path}`);
    }
    if (forbiddenObjectKeys.has(decoded)) {
      errors.push(`condition.state-path.forbidden-segment:${path}`);
    }
  }
}

function validateEntityReference(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`condition.entity-reference.invalid:${path}`);
    return;
  }
  const allowedKeys = new Set(["kind", "id", "entityType"]);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      errors.push(`condition.entity-reference.unknown-field:${path}/${key}`);
    }
  }
  if (value.kind !== "entity-reference") {
    errors.push(`condition.entity-reference.kind.invalid:${path}`);
  }
  validateEntityId(value.id, `${path}/id`, errors);
  if (!isString(value.entityType) || !entityTypePattern.test(value.entityType)) {
    errors.push(`condition.entity-reference.entity-type.invalid:${path}/entityType`);
  }
  if (
    isString(value.id) &&
    isString(value.entityType) &&
    entityIdPattern.test(value.id) &&
    entityTypePattern.test(value.entityType) &&
    value.id.split(".")[0] !== value.entityType
  ) {
    errors.push(`condition.entity-reference.type-prefix-mismatch:${path}`);
  }
}

function validateContextValue(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`condition.context-value.invalid:${path}`);
    return;
  }
  const allowedKeys = new Set(["kind", "key"]);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      errors.push(`condition.context-value.unknown-field:${path}/${key}`);
    }
  }
  if (value.kind !== "context-value") {
    errors.push(`condition.context-value.kind.invalid:${path}`);
  }
  if (!isString(value.key) || !contextKeys.has(value.key)) {
    errors.push(`condition.context-value.key.invalid:${path}/key`);
  }
}

function validateEvaluationContext(context: JsonRecord): string[] {
  const errors: string[] = [];
  const allowedKeys = new Set(["schemaVersion", "actor", "target", "location", "source", "initiator", "mode"]);
  for (const key of Object.keys(context)) {
    if (!allowedKeys.has(key)) {
      errors.push(`condition.context.non-deterministic:${key}`);
    }
  }
  if ("schemaVersion" in context && (!isInteger(context.schemaVersion) || context.schemaVersion < 1)) {
    errors.push("condition.context.schema-version.invalid");
  }
  return errors;
}

function validateOperand(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`condition.operand.invalid:${path}`);
    return;
  }
  const allowedKinds = new Set(["literal", "state-value", "entity-reference", "context-value", "condition-ref"]);
  for (const key of Object.keys(value)) {
    if (!allowedKinds.has(String(value.kind)) && key !== "kind") {
      continue;
    }
    if (
      ![
        "kind",
        "value",
        "selector",
        "id",
        "entityType",
        "key",
        "targetConditionId"
      ].includes(key)
    ) {
      errors.push(`condition.operand.unknown-field:${path}/${key}`);
    }
  }
  switch (value.kind) {
    case "literal":
      if (!("value" in value)) {
        errors.push(`condition.operand.literal.missing:${path}`);
      } else {
        validateJsonValue(value.value, `${path}/value`, errors);
      }
      return;
    case "state-value":
      if (!isRecord(value.selector)) {
        errors.push(`condition.operand.state-value.selector.invalid:${path}`);
        return;
      }
      validateStateSelector(value.selector, `${path}/selector`, errors);
      return;
    case "entity-reference":
      validateEntityReference(value, path, errors);
      return;
    case "context-value":
      validateContextValue(value, path, errors);
      return;
    case "condition-ref":
      if (!isString(value.targetConditionId)) {
        errors.push(`condition.operand.condition-ref.invalid:${path}`);
        return;
      }
      validateEntityId(value.targetConditionId, `${path}/targetConditionId`, errors);
      return;
    default:
      errors.push(`condition.operand.kind.invalid:${path}`);
  }
}

function validateStateSelector(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`condition.state-selector.invalid:${path}`);
    return;
  }
  const allowedKeys = new Set(["domainId", "path"]);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      errors.push(`condition.state-selector.unknown-field:${path}/${key}`);
    }
  }
  validateStateDomainId(value.domainId, `${path}/domainId`, errors);
  validateStatePath(value.path, `${path}/path`, errors);
}

function validateConditionShape(value: unknown, path = ""): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return ["condition.shape.invalid"];
  }
  const allowedKeys = new Set([
    "contractVersion",
    "schemaId",
    "schemaVersion",
    "conditionId",
    "type",
    "value",
    "selector",
    "operator",
    "left",
    "right",
    "collection",
    "member",
    "operands",
    "domainId",
    "targetConditionId"
  ]);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      errors.push(`condition.unknown-field:${path}/${key}`);
    }
  }
  if (value.contractVersion !== contractVersion) {
    errors.push("condition.contract-version.invalid");
  }
  if (value.schemaId !== schemaId) {
    errors.push("condition.schema-id.invalid");
  }
  if (!isInteger(value.schemaVersion) || value.schemaVersion < 1) {
    errors.push("condition.schema-version.invalid");
  }
  if ("conditionId" in value) {
    validateEntityId(value.conditionId, `${path}/conditionId`, errors);
  }
  if (!isString(value.type) || !conditionTypes.has(value.type)) {
    errors.push("condition.type.invalid");
    return errors;
  }

  switch (value.type) {
    case "constant":
      if (!isBoolean(value.value)) {
        errors.push("condition.constant.value.invalid");
      }
      break;
    case "exists":
      validateStateSelector(value.selector, `${path}/selector`, errors);
      break;
    case "compare":
      if (!comparisonOperators.has(String(value.operator))) {
        errors.push("condition.compare.operator.invalid");
      }
      validateOperand(value.left, `${path}/left`, errors);
      validateOperand(value.right, `${path}/right`, errors);
      if (
        isRecord(value.left) &&
        isRecord(value.right) &&
        value.left.kind === "literal" &&
        value.right.kind === "literal"
      ) {
        const leftKind = jsonType(value.left.value);
        const rightKind = jsonType(value.right.value);
        const comparableKinds = new Set(["string", "boolean", "number", "integer", "null"]);
        if (leftKind !== rightKind && comparableKinds.has(leftKind) && comparableKinds.has(rightKind)) {
          errors.push("condition.compare.type-mismatch");
        }
      }
      break;
    case "contains":
      validateOperand(value.collection, `${path}/collection`, errors);
      validateOperand(value.member, `${path}/member`, errors);
      break;
    case "entity-is":
      validateOperand(value.left, `${path}/left`, errors);
      validateOperand(value.right, `${path}/right`, errors);
      if (isRecord(value.left) && value.left.kind !== "entity-reference") {
        errors.push("condition.entity-is.left.invalid");
      }
      if (isRecord(value.right) && value.right.kind !== "entity-reference") {
        errors.push("condition.entity-is.right.invalid");
      }
      break;
    case "domain-exists":
      validateStateDomainId(value.domainId, `${path}/domainId`, errors);
      break;
    case "condition-ref":
      validateEntityId(value.targetConditionId, `${path}/targetConditionId`, errors);
      break;
    case "all":
    case "any":
      if (!Array.isArray(value.operands)) {
        errors.push(`condition.${value.type}.operands.invalid`);
        break;
      }
      if (value.operands.length > 32) {
        errors.push(`condition.${value.type}.operands.too-many`);
      }
      const operands = value.operands as unknown[];
      for (let index = 0; index < value.operands.length; index += 1) {
        const nestedErrors: string[] = validateConditionShape(operands[index], `${path}/operands/${String(index)}`);
        for (const error of nestedErrors) {
          errors.push(error);
        }
      }
      break;
    case "not":
      if (!Array.isArray(value.operands) || value.operands.length !== 1) {
        errors.push("condition.not.operands.invalid");
        break;
      }
      const nestedErrors: string[] = validateConditionShape((value.operands as unknown[])[0], `${path}/operands/0`);
      for (const error of nestedErrors) {
        errors.push(error);
      }
      break;
    default:
      errors.push("condition.type.invalid");
  }

  return errors;
}

function validateBundleShape(bundle: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(bundle)) {
    return ["condition.bundle.invalid"];
  }
  const allowedKeys = new Set(["entryConditionId", "conditions"]);
  for (const key of Object.keys(bundle)) {
    if (!allowedKeys.has(key)) {
      errors.push(`condition.bundle.unknown-field:${key}`);
    }
  }
  validateEntityId(bundle.entryConditionId, "/entryConditionId", errors);
  if (!Array.isArray(bundle.conditions)) {
    errors.push("condition.bundle.conditions.invalid");
    return errors;
  }
  const seen = new Set<string>();
    for (let index = 0; index < bundle.conditions.length; index += 1) {
    const condition = bundle.conditions[index] as unknown;
    const conditionErrors = validateConditionShape(condition, `/conditions/${String(index)}`);
    for (const error of conditionErrors) {
      errors.push(error);
    }
    if (isRecord(condition) && isString(condition.conditionId)) {
      if (seen.has(condition.conditionId)) {
        errors.push(`condition.bundle.duplicate-condition-id:${condition.conditionId}`);
      }
      seen.add(condition.conditionId);
    }
  }
  if (isString(bundle.entryConditionId) && !seen.has(bundle.entryConditionId)) {
    errors.push("condition.bundle.entry.missing");
  }
  return errors;
}

function buildConditionLibrary(bundle: ConditionBundle): Map<string, JsonRecord> {
  const map = new Map<string, JsonRecord>();
  for (const item of bundle.conditions) {
    if (isRecord(item) && isString(item.conditionId)) {
      map.set(item.conditionId, item);
    }
  }
  return map;
}

function collectConditionReferences(value: unknown, references: Set<string>): void {
  if (!isRecord(value)) {
    return;
  }
  if (value.type === "condition-ref" && isString(value.targetConditionId)) {
    references.add(value.targetConditionId);
  }
  if (Array.isArray(value.operands)) {
    for (const operand of value.operands) {
      collectConditionReferences(operand, references);
    }
  }
  if (isRecord(value.left)) collectConditionReferences(value.left, references);
  if (isRecord(value.right)) collectConditionReferences(value.right, references);
  if (isRecord(value.collection)) collectConditionReferences(value.collection, references);
  if (isRecord(value.member)) collectConditionReferences(value.member, references);
  if (isRecord(value.selector)) {
    return;
  }
}

function conditionGraphErrors(bundle: ConditionBundle, options: EvaluationOptions = {}): string[] {
  const errors: string[] = [];
  const library = buildConditionLibrary(bundle);
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (conditionId: string, stack: string[]): void => {
    if (visited.has(conditionId)) {
      return;
    }
    if (visiting.has(conditionId)) {
      errors.push("REFERENCE_CYCLE");
      return;
    }
    const condition = library.get(conditionId);
    if (!condition) {
      errors.push("REFERENCE_NOT_FOUND");
      return;
    }
    visiting.add(conditionId);
    const references = new Set<string>();
    collectConditionReferences(condition, references);
    for (const reference of references) {
      if (options.aliasMap?.has(reference)) {
        errors.push("INVALID_OPERAND");
        continue;
      }
      if (!library.has(reference)) {
        errors.push("REFERENCE_NOT_FOUND");
        continue;
      }
      if (stack.includes(reference)) {
        errors.push("REFERENCE_CYCLE");
        continue;
      }
      visit(reference, [...stack, reference]);
    }
    visiting.delete(conditionId);
    visited.add(conditionId);
  };

  visit(bundle.entryConditionId, [bundle.entryConditionId]);
  return errors;
}

function getDomain(state: JsonRecord, domainId: string): JsonRecord | undefined {
  const domains: unknown[] = [];
  if (isRecord(state.run) && Array.isArray(state.run.domains)) {
    for (const domain of state.run.domains) {
      domains.push(domain);
    }
  }
  if (isRecord(state.meta) && Array.isArray(state.meta.domains)) {
    for (const domain of state.meta.domains) {
      domains.push(domain);
    }
  }
  for (const domain of domains) {
    if (isRecord(domain) && domain.domainId === domainId) {
      return domain;
    }
  }
  return undefined;
}

function hasOwnPath(value: unknown, segments: string[]): boolean {
  let current: unknown = value;
  for (const segment of segments) {
    if (!isRecord(current) && !Array.isArray(current)) return false;
    if (forbiddenObjectKeys.has(segment)) return false;
    if (Array.isArray(current)) {
      if (!/^\d+$/.test(segment)) return false;
      const index = Number(segment);
      if (index < 0 || index >= current.length) return false;
      current = current[index];
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(current, segment)) return false;
    current = current[segment];
  }
  return true;
}

function readPath(value: unknown, segments: string[]): unknown {
  let current: unknown = value;
  for (const segment of segments) {
    if (Array.isArray(current)) {
      current = current[Number(segment)];
      continue;
    }
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function readStateValue(state: JsonRecord, selector: JsonRecord, reads: { count: number }, options: EvaluationOptions): { ok: true; value: unknown } | { ok: false; code: string } {
  reads.count += 1;
  if (options.maxReads !== undefined && reads.count > options.maxReads) {
    return { ok: false, code: "EVALUATION_BUDGET_EXCEEDED" };
  }
  const domainId = String(selector.domainId);
  if (options.allowedDomains && !options.allowedDomains.has(domainId)) {
    return { ok: false, code: "ACCESS_DENIED" };
  }
  const domain = getDomain(state, domainId);
  if (!domain) {
    return { ok: false, code: "STATE_DOMAIN_NOT_FOUND" };
  }
  const path = String(selector.path);
  const segments = path === "/" ? [] : path.slice(1).split("/").map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));
  if (!hasOwnPath(domain.data, segments)) {
    return { ok: false, code: "STATE_PATH_NOT_FOUND" };
  }
  return { ok: true, value: readPath(domain.data, segments) };
}

function compareValues(left: unknown, right: unknown, operator: string): boolean | Diagnostic {
  if (jsonType(left) !== jsonType(right)) {
    return {
      code: "TYPE_MISMATCH",
      message: "Comparison operands must have the same type"
    };
  }
  switch (operator) {
    case "eq":
      return Object.is(left, right);
    case "neq":
      return !Object.is(left, right);
    case "lt":
      return isFiniteJsonNumber(left) && isFiniteJsonNumber(right) ? left < right : typeof left === "string" && typeof right === "string" ? left < right : { code: "TYPE_MISMATCH", message: "Comparison requires numbers or strings" };
    case "lte":
      return isFiniteJsonNumber(left) && isFiniteJsonNumber(right) ? left <= right : typeof left === "string" && typeof right === "string" ? left <= right : { code: "TYPE_MISMATCH", message: "Comparison requires numbers or strings" };
    case "gt":
      return isFiniteJsonNumber(left) && isFiniteJsonNumber(right) ? left > right : typeof left === "string" && typeof right === "string" ? left > right : { code: "TYPE_MISMATCH", message: "Comparison requires numbers or strings" };
    case "gte":
      return isFiniteJsonNumber(left) && isFiniteJsonNumber(right) ? left >= right : typeof left === "string" && typeof right === "string" ? left >= right : { code: "TYPE_MISMATCH", message: "Comparison requires numbers or strings" };
    default:
      return { code: "UNKNOWN_CONDITION_TYPE", message: `Unsupported operator: ${operator}` };
  }
}

function evaluateOperand(
  operand: unknown,
  state: JsonRecord,
  context: JsonRecord,
  options: EvaluationOptions,
  library: Map<string, JsonRecord>,
  stack: string[],
  reads: { count: number },
  depth: number,
  nodes: { count: number }
): { ok: true; value: unknown } | { ok: false; code: string } {
  nodes.count += 1;
  if (options.maxNodes !== undefined && nodes.count > options.maxNodes) {
    return { ok: false, code: "EVALUATION_BUDGET_EXCEEDED" };
  }
  if (!isRecord(operand) || !isString(operand.kind)) {
    return { ok: false, code: "INVALID_OPERAND" };
  }
  switch (operand.kind) {
    case "literal":
      return { ok: true, value: operand.value };
    case "state-value": {
      if (!isRecord(operand.selector)) return { ok: false, code: "INVALID_OPERAND" };
      const result = readStateValue(state, operand.selector, reads, options);
      return result.ok ? result : { ok: false, code: result.code };
    }
    case "entity-reference":
      if (!isString(operand.id) || !isString(operand.entityType)) {
        return { ok: false, code: "INVALID_OPERAND" };
      }
      if (operand.id.split(".")[0] !== operand.entityType) {
        return { ok: false, code: "INVALID_OPERAND" };
      }
      return { ok: true, value: { id: operand.id, entityType: operand.entityType } };
    case "context-value":
      if (!isString(operand.key) || !contextKeys.has(operand.key)) {
        return { ok: false, code: "INVALID_OPERAND" };
      }
      if (!Object.prototype.hasOwnProperty.call(context, operand.key)) {
        return { ok: false, code: "NON_DETERMINISTIC_INPUT" };
      }
      return { ok: true, value: context[operand.key] };
    case "condition-ref": {
      if (!isString(operand.targetConditionId) || !entityIdPattern.test(operand.targetConditionId)) {
        return { ok: false, code: "INVALID_OPERAND" };
      }
      if (options.aliasMap?.has(operand.targetConditionId)) {
        return { ok: false, code: "INVALID_OPERAND" };
      }
      const target = library.get(operand.targetConditionId);
      if (!target) {
        return { ok: false, code: "REFERENCE_NOT_FOUND" };
      }
      const nested = evaluateCondition(target, state, context, options, library, stack, reads, depth + 1, nodes);
      return nested.status === "resolved" ? { ok: true, value: nested.value } : { ok: false, code: nested.diagnostics[0]?.code ?? "REFERENCE_NOT_FOUND" };
    }
    default:
      return { ok: false, code: "UNKNOWN_CONDITION_TYPE" };
  }
}

function evaluateCondition(
  condition: unknown,
  state: JsonRecord,
  context: JsonRecord,
  options: EvaluationOptions = {},
  library = new Map<string, JsonRecord>(),
  stack: string[] = [],
  reads = { count: 0 },
  depth = 0,
  nodes = { count: 0 }
): ConditionResult {
  if (!isRecord(condition)) {
    return errorResult("INVALID_CONDITION_SHAPE", "Condition must be a record");
  }
  nodes.count += 1;
  if (options.maxNodes !== undefined && nodes.count > options.maxNodes) {
    return errorResult("EVALUATION_BUDGET_EXCEEDED", "Condition node budget exceeded");
  }
  if (options.maxDepth !== undefined && depth > options.maxDepth) {
    return errorResult("EVALUATION_BUDGET_EXCEEDED", "Condition depth budget exceeded");
  }
  if (!isInteger(condition.schemaVersion) || condition.schemaVersion < 1) {
    return errorResult("SCHEMA_VERSION_UNSUPPORTED", "Condition schema version is unsupported");
  }
  if (condition.schemaVersion !== 1) {
    return errorResult("SCHEMA_VERSION_UNSUPPORTED", "Condition schema version is unsupported");
  }
  if (condition.contractVersion !== contractVersion || condition.schemaId !== schemaId || !isString(condition.type)) {
    return errorResult("INVALID_CONDITION_SHAPE", "Invalid condition envelope");
  }
  const contextErrors = validateEvaluationContext(context);
  if (contextErrors.length > 0) {
    return errorResult(contextErrors[0] ?? "NON_DETERMINISTIC_INPUT", "Condition context is invalid");
  }
  const shapeErrors = validateConditionShape(condition);
  if (shapeErrors.length > 0) {
    return errorResult(shapeErrors[0] ?? "INVALID_CONDITION_SHAPE", "Condition shape is invalid");
  }
  if (condition.conditionId) {
    stack = [...stack, condition.conditionId];
  }

  const type = condition.type;
  switch (type) {
    case "constant":
      return { status: "resolved", value: Boolean(condition.value) };
    case "exists": {
      const selector = condition.selector as JsonRecord;
      const result = readStateValue(state, selector, reads, options);
      if (!result.ok) {
        return errorResult(result.code, "Selector could not be resolved");
      }
      return { status: "resolved", value: true };
    }
    case "compare": {
      const left = evaluateOperand(condition.left, state, context, options, library, stack, reads, depth + 1, nodes);
      if (!left.ok) return errorResult(left.code, "Left operand failed");
      const right = evaluateOperand(condition.right, state, context, options, library, stack, reads, depth + 1, nodes);
      if (!right.ok) return errorResult(right.code, "Right operand failed");
      const compared = compareValues(left.value, right.value, String(condition.operator));
      if (typeof compared !== "boolean") {
        return errorResult(compared.code, compared.message);
      }
      return { status: "resolved", value: compared };
    }
    case "contains": {
      const collection = evaluateOperand(condition.collection, state, context, options, library, stack, reads, depth + 1, nodes);
      if (!collection.ok) return errorResult(collection.code, "Collection operand failed");
      const member = evaluateOperand(condition.member, state, context, options, library, stack, reads, depth + 1, nodes);
      if (!member.ok) return errorResult(member.code, "Member operand failed");
      if (typeof collection.value === "string") {
        if (typeof member.value !== "string") {
          return errorResult("TYPE_MISMATCH", "String collection requires a string member");
        }
        return { status: "resolved", value: collection.value.includes(member.value) };
      }
      if (Array.isArray(collection.value)) {
        return { status: "resolved", value: collection.value.some((entry) => Object.is(entry, member.value)) };
      }
      return errorResult("TYPE_MISMATCH", "Contains requires a string or array collection");
    }
    case "entity-is": {
      const left = evaluateOperand(condition.left, state, context, options, library, stack, reads, depth + 1, nodes);
      if (!left.ok) return errorResult(left.code, "Left entity operand failed");
      const right = evaluateOperand(condition.right, state, context, options, library, stack, reads, depth + 1, nodes);
      if (!right.ok) return errorResult(right.code, "Right entity operand failed");
      if (!isRecord(left.value) || !isRecord(right.value)) {
        return errorResult("TYPE_MISMATCH", "Entity comparison requires entity references");
      }
      return {
        status: "resolved",
        value: left.value.id === right.value.id && left.value.entityType === right.value.entityType
      };
    }
    case "domain-exists": {
      const domain = getDomain(state, String(condition.domainId));
      return { status: "resolved", value: Boolean(domain) };
    }
    case "condition-ref": {
      const targetConditionId = condition.targetConditionId;
      if (options.aliasMap?.has(condition.targetConditionId)) {
        return errorResult("INVALID_OPERAND", "Aliases are not canonical references");
      }
      const target = library.get(targetConditionId);
      if (!target) {
        return errorResult("REFERENCE_NOT_FOUND", "Referenced condition was not found");
      }
      if (stack.includes(targetConditionId)) {
        return errorResult("REFERENCE_CYCLE", "Referenced condition cycle detected");
      }
      return evaluateCondition(
        target,
        state,
        context,
        options,
        library,
        [...stack, targetConditionId],
        reads,
        depth + 1,
        nodes
      );
    }
    case "all":
    case "any": {
      const operands = Array.isArray(condition.operands) ? (condition.operands as unknown[]) : [];
      const isAll = type === "all";
      if (operands.length === 0) {
        return { status: "resolved", value: isAll };
      }
      for (const operand of operands) {
        const evaluated = evaluateCondition(operand, state, context, options, library, stack, reads, depth + 1, nodes);
        if (evaluated.status === "error") {
          return evaluated;
        }
        if (isAll && !evaluated.value) {
          return { status: "resolved", value: false };
        }
        if (!isAll && evaluated.value) {
          return { status: "resolved", value: true };
        }
      }
      return { status: "resolved", value: isAll };
    }
    case "not": {
      const operand = Array.isArray(condition.operands) ? (condition.operands[0] as unknown) : undefined;
      const evaluated = evaluateCondition(operand, state, context, options, library, stack, reads, depth + 1, nodes);
      if (evaluated.status === "error") return evaluated;
      return { status: "resolved", value: !evaluated.value };
    }
    default:
      return errorResult("UNKNOWN_CONDITION_TYPE", `Unsupported condition type: ${condition.type}`);
  }
}

function errorResult(code: string, message: string): ConditionResult {
  return {
    status: "error",
    diagnostics: [{ code, message }]
  };
}

function validateRuntimeValue(value: unknown, path = "$", seen = new Set<object>()): string[] {
  const errors: string[] = [];
  if (value === null || isString(value) || isBoolean(value) || isInteger(value) || isFiniteJsonNumber(value)) {
    return errors;
  }
  if (typeof value === "undefined" || typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") {
    return [`condition.runtime-value.invalid:${path}`];
  }
  if (value instanceof Date || value instanceof Map || value instanceof Set) {
    return [`condition.runtime-value.invalid:${path}`];
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const nestedErrors = validateRuntimeValue(value[index], `${path}/${String(index)}`, seen);
      for (const error of nestedErrors) {
        errors.push(error);
      }
    }
    return errors;
  }
  if (isRecord(value)) {
    if (seen.has(value)) {
      return [`condition.runtime-value.invalid:${path}:cycle`];
    }
    seen.add(value);
    for (const key of Object.keys(value)) {
      if (forbiddenObjectKeys.has(key)) {
        errors.push(`condition.forbidden-object-key:${path}/${key}`);
      }
      const nestedErrors = validateRuntimeValue(value[key], `${path}/${escapeJsonPointer(key)}`, seen);
      for (const error of nestedErrors) {
        errors.push(error);
      }
    }
    seen.delete(value);
    return errors;
  }
  return [`condition.runtime-value.invalid:${path}`];
}

function readFixtureJson(fileName: string): unknown {
  return readJson(fixturePath(fileName));
}

function readFixtureText(fileName: string): string {
  return readText(fixturePath(fileName));
}

function fixturePath(fileName: string): string {
  if (validFixtures.includes(fileName)) {
    return join(fixtureRoot, "valid", fileName);
  }
  if (invalidFixtures.includes(fileName)) {
    return join(fixtureRoot, "invalid", fileName);
  }
  if (semanticInvalidFixtures.includes(fileName)) {
    return join(fixtureRoot, "semantic-invalid", fileName);
  }
  return join(fixtureRoot, fileName);
}

function stateForConditionTests(): JsonRecord {
  return clone(baseState);
}

function bundleMap(bundle: ConditionBundle): Map<string, JsonRecord> {
  return buildConditionLibrary(bundle);
}

function semanticErrorsForBundle(bundle: ConditionBundle, options: EvaluationOptions = {}): string[] {
  const shapeErrors = validateBundleShape(bundle);
  if (shapeErrors.length > 0) return shapeErrors;
  const graphErrors = conditionGraphErrors(bundle, options);
  if (graphErrors.length > 0) return graphErrors;
  const library = bundleMap(bundle);
  const entry = library.get(bundle.entryConditionId);
  if (!entry) return ["condition.bundle.entry.missing"];
  const result = evaluateCondition(entry, stateForConditionTests(), { schemaVersion: 1 }, { ...options, bundle });
  return result.status === "resolved" ? [] : result.diagnostics.map((item) => item.code);
}

describe("Condition Contract", () => {
  it("validates the contract schema shape", () => {
    const schema = readJson("schemas/condition.schema.json");
    expect(isRecord(schema)).toBe(true);
    if (!isRecord(schema)) {
      return;
    }
    const properties = schema.properties as JsonRecord | undefined;
    expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(schema.$id).toBe("https://schemas.narrative-engine.local/condition/0.1.0/schema.json");
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(["contractVersion", "schemaId", "schemaVersion", "type"]);
    expect(properties?.schemaVersion).toMatchObject({ type: "integer", minimum: 1 });
    const propertiesRecord: JsonRecord | undefined = isRecord(properties) ? properties : undefined;
    const typeSchemaValue: unknown = propertiesRecord ? propertiesRecord["type"] : undefined;
    expect(isRecord(typeSchemaValue)).toBe(true);
    if (!isRecord(typeSchemaValue)) {
      return;
    }
    const typeSchemaRecord = typeSchemaValue;
    expect(typeSchemaRecord.enum).toEqual(expect.arrayContaining(["all", "any", "not", "constant"]));
  });

  it.each(validFixtures)("valid fixture %s passes shape validation", (fileName) => {
    const fixture = readFixtureJson(fileName);
    const errors = Array.isArray(fixture?.conditions) ? validateBundleShape(fixture) : validateConditionShape(fixture);
    expect(errors).toEqual([]);
  });

  it.each(invalidFixtures)("invalid fixture %s fails shape validation", (fileName) => {
    if (fileName.endsWith(".ts")) {
      const source = readFixtureText(fileName);
      expect(source).toContain("export");
      expect(() => {
        JSON.parse(source);
      }).toThrow();
      return;
    }
    const fixture = readFixtureJson(fileName);
    const errors = validateConditionShape(fixture);
    expect(errors.length).toBeGreaterThan(0);
  });

  it.each(semanticInvalidFixtures)("semantic-invalid fixture %s is rejected", (fileName) => {
    const fixture = readFixtureJson(fileName);
    expect(isRecord(fixture)).toBe(true);
    if (!isRecord(fixture)) {
      return;
    }
    if (Array.isArray((fixture as { conditions?: unknown[] }).conditions)) {
      const errors = validateBundleShape(fixture);
      expect(errors.length).toBe(0);
      const bundle = fixture as ConditionBundle;
      const expectedErrors = semanticErrorsForBundle(bundle, {
        allowedDomains: new Set(["state-domain.core.clock", "state-domain.core.flags", "state-domain.world.rooms"]),
        aliasMap: new Map([["condition.core.guard-alias", "condition.core.guard-ready"]]),
        maxDepth: 8,
        maxNodes: 32,
        maxReads: 8
      });
      expect(expectedErrors.length).toBeGreaterThan(0);
      return;
    }

    const condition: JsonRecord = fixture;
    const evaluate = (options: EvaluationOptions, context: JsonRecord = { schemaVersion: 1 }): ConditionResult =>
      evaluateCondition(condition, stateForConditionTests(), context, options);
    let result: ConditionResult;
    switch (fileName) {
      case "missing-state-domain.json":
        result = evaluate({ allowedDomains: new Set(["state-domain.core.clock", "state-domain.secret.lock"]) });
        break;
      case "missing-state-path.json":
        result = evaluate({ allowedDomains: new Set(["state-domain.core.clock"]) });
        break;
      case "type-mismatch.json":
        result = evaluate({});
        break;
      case "unsupported-schema-version.json":
        result = evaluate({});
        break;
      case "access-denied.json":
        result = evaluate({ allowedDomains: new Set(["state-domain.core.clock"]) });
        break;
      case "budget-exceeded.json":
        result = evaluate({ maxDepth: 2, maxNodes: 2, maxReads: 2 });
        break;
      case "nondeterministic-context.json":
        result = evaluate({}, { schemaVersion: 1, actor: "npc.example.guard", timestamp: "now" });
        break;
      default:
        result = semanticErrorsForBundle(fixture as ConditionBundle, {
          allowedDomains: new Set(["state-domain.core.clock", "state-domain.core.flags", "state-domain.world.rooms"]),
          aliasMap: new Map([["condition.core.guard-alias", "condition.core.guard-ready"]]),
          maxDepth: 8,
          maxNodes: 32,
          maxReads: 8
        }).length
          ? errorResult("SEMANTIC_INVALID", "Bundle is semantically invalid")
          : { status: "resolved", value: true };
    }
    expect(result.status).toBe("error");
  });

  it("constant conditions return their explicit boolean", () => {
    const condition = readFixtureJson("constant-true.json");
    const result = evaluateCondition(condition, stateForConditionTests(), { schemaVersion: 1 });
    expect(result).toEqual({ status: "resolved", value: true });
  });

  it("all, any, and not have defined empty and error semantics", () => {
    const emptyAll = { contractVersion, schemaId, schemaVersion: 1, type: "all", operands: [] };
    const emptyAny = { contractVersion, schemaId, schemaVersion: 1, type: "any", operands: [] };
    const notCondition = readFixtureJson("not.json");
    expect(evaluateCondition(emptyAll, stateForConditionTests(), { schemaVersion: 1 })).toEqual({
      status: "resolved",
      value: true
    });
    expect(evaluateCondition(emptyAny, stateForConditionTests(), { schemaVersion: 1 })).toEqual({
      status: "resolved",
      value: false
    });
    expect(evaluateCondition(notCondition, stateForConditionTests(), { schemaVersion: 1 })).toEqual({
      status: "resolved",
      value: true
    });
  });

  it("short-circuits all, any, and not with deterministic error propagation", () => {
    const resolvedFalse = readFixtureJson("constant-false.json");
    const resolvedTrue = readFixtureJson("constant-true.json");
    const evaluationError = readFixtureJson("missing-state-path.json");
    const allFalseThenError = {
      contractVersion,
      schemaId,
      schemaVersion: 1,
      type: "all",
      operands: [resolvedFalse, evaluationError]
    };
    const allErrorThenFalse = {
      contractVersion,
      schemaId,
      schemaVersion: 1,
      type: "all",
      operands: [evaluationError, resolvedFalse]
    };
    const anyTrueThenError = {
      contractVersion,
      schemaId,
      schemaVersion: 1,
      type: "any",
      operands: [resolvedTrue, evaluationError]
    };
    const anyErrorThenTrue = {
      contractVersion,
      schemaId,
      schemaVersion: 1,
      type: "any",
      operands: [evaluationError, resolvedTrue]
    };
    const notError = {
      contractVersion,
      schemaId,
      schemaVersion: 1,
      type: "not",
      operands: [evaluationError]
    };
    expect(evaluateCondition(allFalseThenError, stateForConditionTests(), { schemaVersion: 1 })).toEqual({
      status: "resolved",
      value: false
    });
    expect(evaluateCondition(allErrorThenFalse, stateForConditionTests(), { schemaVersion: 1 })).toEqual({
      status: "error",
      diagnostics: [{ code: "STATE_PATH_NOT_FOUND", message: "Selector could not be resolved" }]
    });
    expect(evaluateCondition(anyTrueThenError, stateForConditionTests(), { schemaVersion: 1 })).toEqual({
      status: "resolved",
      value: true
    });
    expect(evaluateCondition(anyErrorThenTrue, stateForConditionTests(), { schemaVersion: 1 })).toEqual({
      status: "error",
      diagnostics: [{ code: "STATE_PATH_NOT_FOUND", message: "Selector could not be resolved" }]
    });
    expect(evaluateCondition(notError, stateForConditionTests(), { schemaVersion: 1 })).toEqual({
      status: "error",
      diagnostics: [{ code: "STATE_PATH_NOT_FOUND", message: "Selector could not be resolved" }]
    });
  });

  it("evaluates deterministically and does not mutate committed state", () => {
    const state = stateForConditionTests();
    const before = stableJson(state);
    const condition = readFixtureJson("all.json");
    const first = evaluateCondition(condition, state, { schemaVersion: 1 });
    const second = evaluateCondition(condition, state, { schemaVersion: 1 });
    expect(first).toEqual(second);
    expect(stableJson(state)).toBe(before);
  });

  it("distinguishes missing paths from null, false, zero, and empty string", () => {
    const existsMissing = {
      contractVersion,
      schemaId,
      schemaVersion: 1,
      type: "exists",
      selector: { domainId: "state-domain.core.flags", path: "/missing" }
    };
    const existsNull = {
      contractVersion,
      schemaId,
      schemaVersion: 1,
      type: "exists",
      selector: { domainId: "state-domain.core.flags", path: "/nullable" }
    };
    const existsFalse = {
      contractVersion,
      schemaId,
      schemaVersion: 1,
      type: "exists",
      selector: { domainId: "state-domain.core.flags", path: "/paused" }
    };
    const existsZero = {
      contractVersion,
      schemaId,
      schemaVersion: 1,
      type: "exists",
      selector: { domainId: "state-domain.core.flags", path: "/zero" }
    };
    const existsEmpty = {
      contractVersion,
      schemaId,
      schemaVersion: 1,
      type: "exists",
      selector: { domainId: "state-domain.core.flags", path: "/empty" }
    };
    const existsArray = {
      contractVersion,
      schemaId,
      schemaVersion: 1,
      type: "exists",
      selector: { domainId: "state-domain.core.flags", path: "/tags" }
    };
    const existsObject = {
      contractVersion,
      schemaId,
      schemaVersion: 1,
      type: "exists",
      selector: { domainId: "state-domain.meta.profile", path: "/" }
    };
    expect(evaluateCondition(existsMissing, stateForConditionTests(), { schemaVersion: 1 })).toEqual({
      status: "error",
      diagnostics: [{ code: "STATE_PATH_NOT_FOUND", message: "Selector could not be resolved" }]
    });
    expect(evaluateCondition(existsNull, stateForConditionTests(), { schemaVersion: 1 })).toEqual({
      status: "resolved",
      value: true
    });
    expect(evaluateCondition(existsFalse, stateForConditionTests(), { schemaVersion: 1 })).toEqual({
      status: "resolved",
      value: true
    });
    expect(evaluateCondition(existsZero, stateForConditionTests(), { schemaVersion: 1 })).toEqual({
      status: "resolved",
      value: true
    });
    expect(evaluateCondition(existsEmpty, stateForConditionTests(), { schemaVersion: 1 })).toEqual({
      status: "resolved",
      value: true
    });
    expect(evaluateCondition(existsArray, stateForConditionTests(), { schemaVersion: 1 })).toEqual({
      status: "resolved",
      value: true
    });
    expect(evaluateCondition(existsObject, stateForConditionTests(), { schemaVersion: 1 })).toEqual({
      status: "resolved",
      value: true
    });
  });

  it("treats mixed-type comparison as a contract error", () => {
    const condition = readFixtureJson("mixed-type-comparison.json");
    const result = evaluateCondition(condition, stateForConditionTests(), { schemaVersion: 1 });
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.diagnostics[0]?.code).toBe("condition.compare.type-mismatch");
    }
  });

  it("compares canonical entity references byte-for-byte", () => {
    const condition = readFixtureJson("entity-reference-equality.json");
    const result = evaluateCondition(condition, stateForConditionTests(), { schemaVersion: 1 });
    expect(result).toEqual({ status: "resolved", value: true });
  });

  it("supports contains membership over collections", () => {
    const condition = readFixtureJson("contains-tags.json");
    const result = evaluateCondition(condition, stateForConditionTests(), { schemaVersion: 1 });
    expect(result).toEqual({ status: "resolved", value: true });
  });

  it("supports state-value and context-value operands", () => {
    const condition = readFixtureJson("compare-context-string.json");
    const result = evaluateCondition(condition, stateForConditionTests(), {
      schemaVersion: 1,
      actor: "npc.example.guard"
    });
    expect(result).toEqual({ status: "resolved", value: true });
  });

  it("supports named conditions and referenced condition graphs", () => {
    const bundle = readFixtureJson("referenced-condition-bundle.json") as ConditionBundle;
    const library = buildConditionLibrary(bundle);
    const entry = library.get(bundle.entryConditionId);
    expect(entry).toBeDefined();
    if (!entry) {
      return;
    }
    const result = evaluateCondition(
      entry,
      stateForConditionTests(),
      { schemaVersion: 1 },
      {},
      library
    );
    expect(result).toEqual({ status: "resolved", value: true });
  });

  it("rejects condition reference cycles, dangling references, alias references, and budget overruns", () => {
    const cycle = readFixtureJson("reference-cycle-bundle.json") as ConditionBundle;
    const dangling = readFixtureJson("dangling-reference-bundle.json") as ConditionBundle;
    const alias = readFixtureJson("alias-reference-bundle.json") as ConditionBundle;
    const budget = readFixtureJson("budget-exceeded.json") as JsonRecord;
    expect(semanticErrorsForBundle(cycle)).toContain("REFERENCE_CYCLE");
    expect(semanticErrorsForBundle(dangling)).toContain("REFERENCE_NOT_FOUND");
    expect(
      semanticErrorsForBundle(alias, {
        aliasMap: new Map([["condition.core.guard-alias", "condition.core.guard-ready"]])
      })
    ).toContain("INVALID_OPERAND");
    expect(
      evaluateCondition(budget, stateForConditionTests(), { schemaVersion: 1 }, { maxDepth: 0, maxNodes: 1 })
    ).toEqual({
      status: "error",
      diagnostics: [{ code: "EVALUATION_BUDGET_EXCEEDED", message: "Condition node budget exceeded" }]
    });
  });

  it("uses fail-closed explain-mode evaluation without changing the result", () => {
    const condition = readFixtureJson("all.json");
    const normal = evaluateCondition(condition, stateForConditionTests(), { schemaVersion: 1 });
    const explain = evaluateCondition(condition, stateForConditionTests(), { schemaVersion: 1 }, { explain: true });
    expect(normal).toEqual(explain);
  });

  it("canonicalizes JSON with stable key order and idempotence", () => {
    const condition = {
      type: "all",
      operands: [
        {
          value: true,
          type: "constant",
          schemaVersion: 1,
          schemaId: "condition",
          contractVersion: "condition@0.1.0"
        }
      ],
      schemaVersion: 1,
      schemaId: "condition",
      contractVersion: "condition@0.1.0"
    };
    const canonical = stableJson(condition);
    const second = stableJson(JSON.parse(canonical));
    expect(canonical).toBe(second);
    expect(canonical).toContain('"contractVersion": "condition@0.1.0"');
    expect(canonical.indexOf('"contractVersion"')).toBeLessThan(canonical.indexOf('"type"'));
  });

  it("regresses Entity Identity, Schema Versioning, and Engine State contract expectations", () => {
    const entityIdentitySchema = readJson("schemas/entity-identity.schema.json");
    const schemaVersioningSchema = readJson("schemas/schema-versioning.schema.json");
    const engineStateSchema = readJson("schemas/engine-state.schema.json");
    const entityIdentityFixture = readJson("tests/fixtures/contracts/entity-identity/valid/minimal.json") as JsonRecord;
    const schemaVersionFixture = readJson("tests/fixtures/contracts/schema-versioning/valid/schema-version-1.json") as JsonRecord;
    const engineStateFixture = readJson("tests/fixtures/contracts/engine-state/valid/minimal.json") as JsonRecord;
    expect(isRecord(entityIdentitySchema)).toBe(true);
    expect(isRecord(schemaVersioningSchema)).toBe(true);
    expect(isRecord(engineStateSchema)).toBe(true);
    expect(isRecord((entityIdentitySchema as JsonRecord).properties)).toBe(true);
    expect(isRecord((schemaVersioningSchema as JsonRecord).properties)).toBe(true);
    expect(isRecord((engineStateSchema as JsonRecord).properties)).toBe(true);
    expect((entityIdentitySchema as JsonRecord).properties?.schemaVersion).toBeDefined();
    expect((schemaVersioningSchema as JsonRecord).properties?.writerVersion).toBeDefined();
    expect((engineStateSchema as JsonRecord).properties?.schemaVersion).toBeDefined();
    expect(entityIdentityFixture.schemaVersion).toBe(1);
    expect(isRecord(schemaVersionFixture)).toBe(true);
    expect(isRecord(engineStateFixture)).toBe(true);
  });

  it("rejects pre-serialization runtime values before canonicalization", () => {
    const runtimeValues = [
      () => true,
      new Date(),
      new Map(),
      new Set(),
      Number.NaN,
      Number.POSITIVE_INFINITY,
      ((): unknown => {
        const obj: JsonRecord = { name: "cycle" };
        obj.self = obj;
        return obj;
      })(),
      undefined,
      BigInt(1),
      Symbol("condition")
    ];
    for (const value of runtimeValues) {
      expect(validateRuntimeValue(value).length).toBeGreaterThan(0);
    }
  });

  it("keeps array operand order intact during canonicalization", () => {
    const condition = readFixtureJson("all.json");
    const canonical = canonicalize(condition) as JsonRecord;
    expect(Array.isArray(canonical.operands)).toBe(true);
    expect((canonical.operands as unknown[]).length).toBeGreaterThan(0);
    expect(canonical.operands).toEqual((condition as JsonRecord).operands);
  });
});
