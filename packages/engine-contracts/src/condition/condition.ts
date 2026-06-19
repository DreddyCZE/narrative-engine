import { formatJsonPath, inspectJsonSafety, type JsonPath } from "@narrative-engine/core";

import { inspectEngineStateSnapshot, type EngineStateSnapshot } from "../engine-state/engine-state.js";

export const CONDITION_CONTRACT_VERSION = "condition@0.1.0" as const;
export const CONDITION_SCHEMA_ID = "condition" as const;
export const CONDITION_SCHEMA_VERSION = 1 as const;

export type ConditionComparisonOperator = "eq" | "neq" | "lt" | "lte" | "gt" | "gte";

export type ConditionType =
  | "all"
  | "any"
  | "not"
  | "constant"
  | "exists"
  | "compare"
  | "contains"
  | "entity-is"
  | "domain-exists"
  | "condition-ref";

export type ConditionEvaluationIssueCode =
  | "CONDITION_NOT_OBJECT"
  | "CONDITION_UNKNOWN_OPERATOR"
  | "CONDITION_INVALID_PATH"
  | "CONDITION_INVALID_VALUE"
  | "CONDITION_STATE_PATH_NOT_FOUND"
  | "CONDITION_NON_JSON_VALUE"
  | "CONDITION_FORBIDDEN_KEY"
  | "CONDITION_INVALID_STATE"
  | "CONDITION_REFERENCE_NOT_FOUND"
  | "CONDITION_REFERENCE_CYCLE"
  | "CONDITION_BUDGET_EXCEEDED";

export type ConditionEvaluationIssue = {
  readonly code: ConditionEvaluationIssueCode;
  readonly path: JsonPath;
  readonly message: string;
};

export type ConditionEvaluationContext = Readonly<Record<string, unknown>> & {
  readonly schemaVersion?: number;
};

export type ConditionEvaluationOptions = {
  readonly context?: unknown;
  readonly namedConditions?: ReadonlyMap<string, unknown>;
  readonly maxDepth?: number;
  readonly maxNodes?: number;
  readonly maxReads?: number;
};

export type ConditionEvaluationResult = {
  readonly matched: boolean;
  readonly issues: readonly ConditionEvaluationIssue[];
};

type JsonRecord = Record<string, unknown>;

type OperandResult =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly issue: ConditionEvaluationIssue };

const COMPARISON_OPERATORS = new Set<ConditionComparisonOperator>(["eq", "neq", "lt", "lte", "gt", "gte"]);
const CONDITION_TYPES = new Set<ConditionType>([
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
const CONTEXT_KEYS = new Set(["actor", "target", "location", "source", "initiator", "mode"]);
const CONDITION_ROOT_KEYS = new Set([
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
const OPERAND_KEYS = new Set(["kind", "value", "selector", "id", "entityType", "key", "targetConditionId"]);
const STATE_SELECTOR_KEYS = new Set(["domainId", "path"]);
const ENTITY_REFERENCE_KEYS = new Set(["kind", "id", "entityType"]);
const ENTITY_ID_PATTERN = new RegExp(
  "^[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,31}\\.[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,47}\\.[a-z0-9](?:[a-z0-9]|[_-](?=[a-z0-9])){0,79}$",
  "u"
);
const STATE_DOMAIN_ID_PATTERN = new RegExp(
  "^state-domain\\.[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,31}\\.[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,31}$",
  "u"
);
const STATE_PATH_PATTERN = new RegExp("^(?:/$|/(?:[^~/]|~0|~1)+(?:/(?:[^~/]|~0|~1)+)*)$", "u");
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function isPositiveInteger(value: unknown): value is number {
  return isInteger(value) && value >= 1;
}

function isConditionType(value: unknown): value is ConditionType {
  return isString(value) && CONDITION_TYPES.has(value as ConditionType);
}

function isComparisonOperator(value: unknown): value is ConditionComparisonOperator {
  return isString(value) && COMPARISON_OPERATORS.has(value as ConditionComparisonOperator);
}

function toReadonlyUnknownArray(value: unknown): readonly unknown[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const items: unknown[] = [];
  for (const item of value) {
    items.push(item);
  }

  return items;
}

function addIssue(
  issues: ConditionEvaluationIssue[],
  code: ConditionEvaluationIssueCode,
  path: JsonPath,
  message: string
): void {
  issues.push({
    code,
    path: path.slice(),
    message
  });
}

function mapJsonSafetyIssues(
  issues: ConditionEvaluationIssue[],
  sourceIssues: readonly { readonly code: string; readonly path: JsonPath; readonly message: string }[],
  prefix: JsonPath = []
): void {
  for (const issue of sourceIssues) {
    addIssue(
      issues,
      issue.code === "FORBIDDEN_KEY" ? "CONDITION_FORBIDDEN_KEY" : "CONDITION_NON_JSON_VALUE",
      [...prefix, ...issue.path],
      issue.message
    );
  }
}

function validateUnknownFields(value: JsonRecord, allowed: Set<string>, issues: ConditionEvaluationIssue[], path: JsonPath): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      addIssue(issues, "CONDITION_INVALID_VALUE", [...path, key], `unknown field "${key}" is not allowed.`);
    }
  }
}

function validateConditionId(value: unknown, issues: ConditionEvaluationIssue[], path: JsonPath): boolean {
  if (value === undefined) {
    return true;
  }
  if (!isString(value) || !ENTITY_ID_PATTERN.test(value)) {
    addIssue(issues, "CONDITION_INVALID_VALUE", path, "conditionId is invalid.");
    return false;
  }
  return true;
}

function validateStateSelector(
  value: unknown,
  issues: ConditionEvaluationIssue[],
  path: JsonPath
): value is { readonly domainId: string; readonly path: string } {
  if (!isRecord(value)) {
    addIssue(issues, "CONDITION_INVALID_VALUE", path, "selector must be an object.");
    return false;
  }

  validateUnknownFields(value, STATE_SELECTOR_KEYS, issues, path);

  if (!isString(value.domainId) || !STATE_DOMAIN_ID_PATTERN.test(value.domainId)) {
    addIssue(issues, "CONDITION_INVALID_PATH", [...path, "domainId"], "selector.domainId is invalid.");
  }

  if (!isString(value.path) || !STATE_PATH_PATTERN.test(value.path)) {
    addIssue(issues, "CONDITION_INVALID_PATH", [...path, "path"], "selector.path is invalid.");
    return false;
  }

  const decodedSegments = decodeStatePath(value.path);
  if (decodedSegments === null) {
    addIssue(issues, "CONDITION_INVALID_PATH", [...path, "path"], "selector.path is invalid.");
    return false;
  }

  return true;
}

function validateOperand(value: unknown, issues: ConditionEvaluationIssue[], path: JsonPath): void {
  if (!isRecord(value)) {
    addIssue(issues, "CONDITION_INVALID_VALUE", path, "operand must be an object.");
    return;
  }

  validateUnknownFields(value, OPERAND_KEYS, issues, path);

  if (!isString(value.kind)) {
    addIssue(issues, "CONDITION_INVALID_VALUE", [...path, "kind"], "operand.kind is invalid.");
    return;
  }

  switch (value.kind) {
    case "literal":
      mapJsonSafetyIssues(issues, inspectJsonSafety(value.value), [...path, "value"]);
      return;
    case "state-value":
      validateStateSelector(value.selector, issues, [...path, "selector"]);
      return;
    case "entity-reference":
      validateEntityReference(value, issues, path);
      return;
    case "context-value":
      if (!isString(value.key) || !CONTEXT_KEYS.has(value.key)) {
        addIssue(issues, "CONDITION_INVALID_VALUE", [...path, "key"], "context-value.key is invalid.");
      }
      return;
    case "condition-ref":
      if (!isString(value.targetConditionId) || !ENTITY_ID_PATTERN.test(value.targetConditionId)) {
        addIssue(issues, "CONDITION_INVALID_VALUE", [...path, "targetConditionId"], "targetConditionId is invalid.");
      }
      return;
    default:
      addIssue(issues, "CONDITION_UNKNOWN_OPERATOR", [...path, "kind"], `Unsupported operand kind: ${value.kind}`);
  }
}

function validateEntityReference(
  value: JsonRecord,
  issues: ConditionEvaluationIssue[],
  path: JsonPath
): void {
  validateUnknownFields(value, ENTITY_REFERENCE_KEYS, issues, path);

  if (value.kind !== "entity-reference") {
    addIssue(issues, "CONDITION_INVALID_VALUE", [...path, "kind"], "entity reference kind is invalid.");
  }

  if (!isString(value.id) || !ENTITY_ID_PATTERN.test(value.id)) {
    addIssue(issues, "CONDITION_INVALID_VALUE", [...path, "id"], "entity reference id is invalid.");
  }

  if (!isString(value.entityType) || !/^[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,31}$/u.test(value.entityType)) {
    addIssue(issues, "CONDITION_INVALID_VALUE", [...path, "entityType"], "entity reference entityType is invalid.");
    return;
  }

  if (isString(value.id) && ENTITY_ID_PATTERN.test(value.id) && value.id.split(".")[0] !== value.entityType) {
    addIssue(issues, "CONDITION_INVALID_VALUE", path, "entity reference type prefix does not match.");
  }
}

function validateRootCondition(value: unknown): ConditionEvaluationIssue[] {
  const issues: ConditionEvaluationIssue[] = [];

  if (!isRecord(value)) {
    addIssue(issues, "CONDITION_NOT_OBJECT", [], "condition must be an object.");
    mapJsonSafetyIssues(issues, inspectJsonSafety(value));
    return issues;
  }

  mapJsonSafetyIssues(issues, inspectJsonSafety(value));
  validateUnknownFields(value, CONDITION_ROOT_KEYS, issues, []);
  validateConditionId(value.conditionId, issues, ["conditionId"]);

  if (value.contractVersion !== CONDITION_CONTRACT_VERSION) {
    addIssue(issues, "CONDITION_INVALID_VALUE", ["contractVersion"], "contractVersion is invalid.");
  }

  if (value.schemaId !== CONDITION_SCHEMA_ID) {
    addIssue(issues, "CONDITION_INVALID_VALUE", ["schemaId"], "schemaId is invalid.");
  }

  if (!isInteger(value.schemaVersion) || value.schemaVersion < 1 || value.schemaVersion !== CONDITION_SCHEMA_VERSION) {
    addIssue(issues, "CONDITION_INVALID_VALUE", ["schemaVersion"], "schemaVersion is invalid.");
  }

  if (!isString(value.type)) {
    addIssue(issues, "CONDITION_UNKNOWN_OPERATOR", ["type"], "condition type is invalid.");
    return issues;
  }

  if (!isConditionType(value.type)) {
    addIssue(issues, "CONDITION_UNKNOWN_OPERATOR", ["type"], `Unsupported condition type: ${value.type}`);
    return issues;
  }

  switch (value.type) {
    case "constant":
      if (!isBoolean(value.value)) {
        addIssue(issues, "CONDITION_INVALID_VALUE", ["value"], "constant value is invalid.");
      }
      break;
    case "exists":
      validateStateSelector(value.selector, issues, ["selector"]);
      break;
    case "compare":
      if (!isComparisonOperator(value.operator)) {
        addIssue(issues, "CONDITION_UNKNOWN_OPERATOR", ["operator"], "compare operator is invalid.");
      }
      validateOperand(value.left, issues, ["left"]);
      validateOperand(value.right, issues, ["right"]);
      break;
    case "contains":
      validateOperand(value.collection, issues, ["collection"]);
      validateOperand(value.member, issues, ["member"]);
      break;
    case "entity-is":
      validateOperand(value.left, issues, ["left"]);
      validateOperand(value.right, issues, ["right"]);
      break;
    case "domain-exists":
      if (!isString(value.domainId) || !STATE_DOMAIN_ID_PATTERN.test(value.domainId)) {
        addIssue(issues, "CONDITION_INVALID_PATH", ["domainId"], "domainId is invalid.");
      }
      break;
    case "condition-ref":
      if (!isString(value.targetConditionId) || !ENTITY_ID_PATTERN.test(value.targetConditionId)) {
        addIssue(issues, "CONDITION_INVALID_VALUE", ["targetConditionId"], "targetConditionId is invalid.");
      }
      break;
    case "all":
    case "any":
      if (!Array.isArray(value.operands)) {
        addIssue(issues, "CONDITION_INVALID_VALUE", ["operands"], "operands must be an array.");
        break;
      }
      for (let index = 0; index < value.operands.length; index += 1) {
        validateConditionNode(value.operands[index], [...["operands"], index], issues);
      }
      break;
    case "not":
      if (!Array.isArray(value.operands) || value.operands.length !== 1) {
        addIssue(issues, "CONDITION_INVALID_VALUE", ["operands"], "not must have exactly one operand.");
        break;
      }
      validateConditionNode(value.operands[0], ["operands", 0], issues);
      break;
  }

  return issues;
}

function validateConditionNode(value: unknown, path: JsonPath, issues: ConditionEvaluationIssue[]): void {
  if (!isRecord(value)) {
    addIssue(issues, "CONDITION_INVALID_VALUE", path, "nested condition must be an object.");
    mapJsonSafetyIssues(issues, inspectJsonSafety(value), path);
    return;
  }

  mapJsonSafetyIssues(issues, inspectJsonSafety(value), path);
  validateUnknownFields(value, CONDITION_ROOT_KEYS, issues, path);
  validateConditionId(value.conditionId, issues, [...path, "conditionId"]);

  if (value.contractVersion !== CONDITION_CONTRACT_VERSION) {
    addIssue(issues, "CONDITION_INVALID_VALUE", [...path, "contractVersion"], "contractVersion is invalid.");
  }
  if (value.schemaId !== CONDITION_SCHEMA_ID) {
    addIssue(issues, "CONDITION_INVALID_VALUE", [...path, "schemaId"], "schemaId is invalid.");
  }
  if (!isInteger(value.schemaVersion) || value.schemaVersion < 1 || value.schemaVersion !== CONDITION_SCHEMA_VERSION) {
    addIssue(issues, "CONDITION_INVALID_VALUE", [...path, "schemaVersion"], "schemaVersion is invalid.");
  }
  if (!isString(value.type)) {
    addIssue(issues, "CONDITION_UNKNOWN_OPERATOR", [...path, "type"], "condition type is invalid.");
    return;
  }
  if (!isConditionType(value.type)) {
    addIssue(issues, "CONDITION_UNKNOWN_OPERATOR", [...path, "type"], `Unsupported condition type: ${value.type}`);
    return;
  }

  switch (value.type) {
    case "constant":
      if (!isBoolean(value.value)) {
        addIssue(issues, "CONDITION_INVALID_VALUE", [...path, "value"], "constant value is invalid.");
      }
      break;
    case "exists":
      validateStateSelector(value.selector, issues, [...path, "selector"]);
      break;
    case "compare":
      if (!isComparisonOperator(value.operator)) {
        addIssue(issues, "CONDITION_UNKNOWN_OPERATOR", [...path, "operator"], "compare operator is invalid.");
      }
      validateOperand(value.left, issues, [...path, "left"]);
      validateOperand(value.right, issues, [...path, "right"]);
      break;
    case "contains":
      validateOperand(value.collection, issues, [...path, "collection"]);
      validateOperand(value.member, issues, [...path, "member"]);
      break;
    case "entity-is":
      validateOperand(value.left, issues, [...path, "left"]);
      validateOperand(value.right, issues, [...path, "right"]);
      break;
    case "domain-exists":
      if (!isString(value.domainId) || !STATE_DOMAIN_ID_PATTERN.test(value.domainId)) {
        addIssue(issues, "CONDITION_INVALID_PATH", [...path, "domainId"], "domainId is invalid.");
      }
      break;
    case "condition-ref":
      if (!isString(value.targetConditionId) || !ENTITY_ID_PATTERN.test(value.targetConditionId)) {
        addIssue(issues, "CONDITION_INVALID_VALUE", [...path, "targetConditionId"], "targetConditionId is invalid.");
      }
      break;
    case "all":
    case "any":
      if (!Array.isArray(value.operands)) {
        addIssue(issues, "CONDITION_INVALID_VALUE", [...path, "operands"], "operands must be an array.");
        break;
      }
      for (let index = 0; index < value.operands.length; index += 1) {
        validateConditionNode(value.operands[index], [...path, "operands", index], issues);
      }
      break;
    case "not":
      if (!Array.isArray(value.operands) || value.operands.length !== 1) {
        addIssue(issues, "CONDITION_INVALID_VALUE", [...path, "operands"], "not must have exactly one operand.");
        break;
      }
      validateConditionNode(value.operands[0], [...path, "operands", 0], issues);
      break;
  }
}

function compareValues(left: unknown, right: unknown, operator: ConditionComparisonOperator): boolean | ConditionEvaluationIssue {
  if (jsonType(left) !== jsonType(right)) {
    return {
      code: "CONDITION_INVALID_VALUE",
      path: [],
      message: "Comparison operands must have the same type."
    };
  }

  switch (operator) {
    case "eq":
      return Object.is(left, right);
    case "neq":
      return !Object.is(left, right);
    case "lt":
      return isComparable(left, right, (l, r) => l < r);
    case "lte":
      return isComparable(left, right, (l, r) => l <= r);
    case "gt":
      return isComparable(left, right, (l, r) => l > r);
    case "gte":
      return isComparable(left, right, (l, r) => l >= r);
  }
}

function isComparable(
  left: unknown,
  right: unknown,
  comparator: (left: number | string, right: number | string) => boolean
): boolean | ConditionEvaluationIssue {
  if (isFiniteNumber(left) && isFiniteNumber(right)) {
    return comparator(left, right);
  }
  if (isString(left) && isString(right)) {
    return comparator(left, right);
  }
  return {
    code: "CONDITION_INVALID_VALUE",
    path: [],
    message: "Comparison requires numbers or strings."
  };
}

function jsonType(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}

function decodeStatePath(path: string): readonly string[] | null {
  if (path === "/") {
    return [];
  }
  if (!STATE_PATH_PATTERN.test(path)) {
    return null;
  }

  const segments = path
    .slice(1)
    .split("/")
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));

  for (const segment of segments) {
    if (segment === ".." || FORBIDDEN_KEYS.has(segment)) {
      return null;
    }
  }

  return segments;
}

function hasOwnPath(value: unknown, segments: readonly string[]): boolean {
  let current: unknown = value;
  for (const segment of segments) {
    if (Array.isArray(current)) {
      if (!/^\d+$/u.test(segment)) {
        return false;
      }
      const index = Number(segment);
      if (index < 0 || index >= current.length) {
        return false;
      }
      current = current[index];
      continue;
    }

    if (!isRecord(current)) {
      return false;
    }

    if (!Object.prototype.hasOwnProperty.call(current, segment)) {
      return false;
    }
    current = current[segment];
  }

  return true;
}

function readPath(value: unknown, segments: readonly string[]): unknown {
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

function findDomain(state: EngineStateSnapshot, domainId: string): { readonly data: JsonRecord } | undefined {
  const runDomains = state.run.domains as readonly unknown[];
  for (const domain of runDomains) {
    if (isRecord(domain) && domain.domainId === domainId && isRecord(domain.data)) {
      return { data: domain.data };
    }
  }

  const metaDomains = state.meta?.domains as readonly unknown[] | undefined;
  if (metaDomains !== undefined) {
    for (const domain of metaDomains) {
      if (isRecord(domain) && domain.domainId === domainId && isRecord(domain.data)) {
        return { data: domain.data };
      }
    }
  }

  return undefined;
}

function validateContext(value: unknown): readonly ConditionEvaluationIssue[] {
  const issues: ConditionEvaluationIssue[] = [];
  if (value === undefined) {
    return issues;
  }
  if (!isRecord(value)) {
    addIssue(issues, "CONDITION_INVALID_VALUE", ["context"], "context must be an object.");
    mapJsonSafetyIssues(issues, inspectJsonSafety(value), ["context"]);
    return issues;
  }

  mapJsonSafetyIssues(issues, inspectJsonSafety(value), ["context"]);
  for (const key of Object.keys(value)) {
    if (key !== "schemaVersion" && !CONTEXT_KEYS.has(key)) {
      addIssue(issues, "CONDITION_INVALID_VALUE", ["context", key], `unknown context key "${key}" is not allowed.`);
    }
  }

  if (value.schemaVersion !== undefined && !isPositiveInteger(value.schemaVersion)) {
    addIssue(issues, "CONDITION_INVALID_VALUE", ["context", "schemaVersion"], "context.schemaVersion is invalid.");
  }

  return issues;
}

function toConditionResult(matched: boolean, issues: readonly ConditionEvaluationIssue[]): ConditionEvaluationResult {
  return { matched, issues };
}

function mapStateIssuesToConditionIssues(issues: readonly { readonly path: JsonPath; readonly message: string }[]): readonly ConditionEvaluationIssue[] {
  return issues.map((issue) => ({
    code: "CONDITION_INVALID_STATE",
    path: issue.path.slice(),
    message: issue.message
  }));
}

function evaluateOperand(
  operand: unknown,
  state: EngineStateSnapshot,
  context: ConditionEvaluationContext,
  options: ConditionEvaluationOptions,
  namedConditions: ReadonlyMap<string, unknown>,
  stack: readonly string[],
  depth: number,
  nodes: { count: number },
  reads: { count: number },
  path: JsonPath
): OperandResult {
  nodes.count += 1;
  if (options.maxNodes !== undefined && nodes.count > options.maxNodes) {
    return {
      ok: false,
      issue: {
        code: "CONDITION_BUDGET_EXCEEDED",
        path,
        message: "Condition node budget exceeded."
      }
    };
  }

  if (!isRecord(operand) || !isString(operand.kind)) {
    return {
      ok: false,
      issue: {
        code: "CONDITION_INVALID_VALUE",
        path,
        message: "operand is invalid."
      }
    };
  }

  switch (operand.kind) {
    case "literal":
      return { ok: true, value: operand.value };
    case "state-value": {
      const selector = operand.selector;
      if (!validateStateSelector(selector, [], [...path, "selector"])) {
        return {
          ok: false,
          issue: {
            code: "CONDITION_INVALID_PATH",
            path: [...path, "selector"],
            message: "selector is invalid."
          }
        };
      }
      const resolved = readStateSelector(state, selector, reads, options, [...path, "selector"]);
      return resolved;
    }
    case "entity-reference": {
      const entityIssues: ConditionEvaluationIssue[] = [];
      validateEntityReference(operand, entityIssues, path);
      if (entityIssues.length > 0) {
        const issue = entityIssues[0];
        if (issue !== undefined) {
          return { ok: false, issue };
        }
        return {
          ok: false,
          issue: {
            code: "CONDITION_INVALID_VALUE",
            path,
            message: "entity reference is invalid."
          }
        };
      }
      return {
        ok: true,
        value: {
          id: operand.id,
          entityType: operand.entityType
        }
      };
    }
    case "context-value": {
      if (!isString(operand.key) || !CONTEXT_KEYS.has(operand.key)) {
        return {
          ok: false,
          issue: {
            code: "CONDITION_INVALID_VALUE",
            path: [...path, "key"],
            message: "context key is invalid."
          }
        };
      }
      if (!Object.prototype.hasOwnProperty.call(context, operand.key)) {
        return {
          ok: false,
          issue: {
            code: "CONDITION_INVALID_VALUE",
            path: [...path, "key"],
            message: "context key is missing."
          }
        };
      }
      return { ok: true, value: context[operand.key] };
    }
    case "condition-ref": {
      if (!isString(operand.targetConditionId) || !ENTITY_ID_PATTERN.test(operand.targetConditionId)) {
        return {
          ok: false,
          issue: {
            code: "CONDITION_INVALID_VALUE",
            path: [...path, "targetConditionId"],
            message: "targetConditionId is invalid."
          }
        };
      }
      if (stack.includes(operand.targetConditionId)) {
        return {
          ok: false,
          issue: {
            code: "CONDITION_REFERENCE_CYCLE",
            path: [...path, "targetConditionId"],
            message: "condition reference cycle detected."
          }
        };
      }
      const target = namedConditions.get(operand.targetConditionId);
      if (target === undefined) {
        return {
          ok: false,
          issue: {
            code: "CONDITION_REFERENCE_NOT_FOUND",
            path: [...path, "targetConditionId"],
            message: "referenced condition was not found."
          }
        };
      }
      const result = evaluateNode(target, state, context, options, namedConditions, [...stack, operand.targetConditionId], depth + 1, nodes, reads, path);
      return result.status === "resolved"
        ? { ok: true, value: result.value }
        : { ok: false, issue: result.issues[0] ?? { code: "CONDITION_REFERENCE_NOT_FOUND", path, message: "referenced condition failed." } };
    }
    default:
      return {
        ok: false,
        issue: {
          code: "CONDITION_UNKNOWN_OPERATOR",
          path: [...path, "kind"],
          message: `Unsupported operand kind: ${operand.kind}`
        }
      };
  }
}

function readStateSelector(
  state: EngineStateSnapshot,
  selector: { readonly domainId: string; readonly path: string },
  reads: { count: number },
  options: ConditionEvaluationOptions,
  path: JsonPath
): { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly issue: ConditionEvaluationIssue } {
  reads.count += 1;
  if (options.maxReads !== undefined && reads.count > options.maxReads) {
    return {
      ok: false,
      issue: {
        code: "CONDITION_BUDGET_EXCEEDED",
        path,
        message: "Condition read budget exceeded."
      }
    };
  }

  if (selector.path === "/") {
    const domain = findDomain(state, selector.domainId);
    if (domain === undefined) {
      return {
        ok: false,
        issue: {
          code: "CONDITION_STATE_PATH_NOT_FOUND",
          path: [...path, "domainId"],
          message: "Condition path could not be resolved."
        }
      };
    }
    return { ok: true, value: domain.data };
  }

  const decoded = decodeStatePath(selector.path);
  if (decoded === null) {
    return {
      ok: false,
      issue: {
        code: "CONDITION_INVALID_PATH",
        path: [...path, "path"],
        message: "Condition path is invalid."
      }
    };
  }

  const domain = findDomain(state, selector.domainId);
  if (domain === undefined) {
    return {
      ok: false,
      issue: {
        code: "CONDITION_STATE_PATH_NOT_FOUND",
        path: [...path, "domainId"],
        message: "Condition path could not be resolved."
      }
    };
  }

  if (!hasOwnPath(domain.data, decoded)) {
    return {
      ok: false,
      issue: {
        code: "CONDITION_STATE_PATH_NOT_FOUND",
        path: [...path, "path"],
        message: "Condition path could not be resolved."
      }
    };
  }

  return {
    ok: true,
    value: readPath(domain.data, decoded)
  };
}

function evaluateNode(
  node: unknown,
  state: EngineStateSnapshot,
  context: ConditionEvaluationContext,
  options: ConditionEvaluationOptions,
  namedConditions: ReadonlyMap<string, unknown>,
  stack: readonly string[],
  depth: number,
  nodes: { count: number },
  reads: { count: number },
  path: JsonPath = []
): { readonly status: "resolved"; readonly value: boolean } | { readonly status: "error"; readonly issues: readonly ConditionEvaluationIssue[] } {
  nodes.count += 1;
  if (options.maxNodes !== undefined && nodes.count > options.maxNodes) {
    return {
      status: "error",
      issues: [
        {
          code: "CONDITION_BUDGET_EXCEEDED",
          path,
          message: "Condition node budget exceeded."
        }
      ]
    };
  }
  if (options.maxDepth !== undefined && depth > options.maxDepth) {
    return {
      status: "error",
      issues: [
        {
          code: "CONDITION_BUDGET_EXCEEDED",
          path,
          message: "Condition depth budget exceeded."
        }
      ]
    };
  }

  const issues = validateRootCondition(node);
  if (issues.length > 0) {
    return { status: "error", issues };
  }

  const condition = node as JsonRecord;
  const type = condition.type as ConditionType;
  const currentStack = isString(condition.conditionId) ? [...stack, condition.conditionId] : [...stack];

  switch (type) {
    case "constant":
      return { status: "resolved", value: Boolean(condition.value) };
    case "exists": {
      const selector = condition.selector as { readonly domainId: string; readonly path: string };
      const result = readStateSelector(state, selector, reads, options, [...path, "selector"]);
      if (!result.ok) {
        return { status: "error", issues: [result.issue] };
      }
      return { status: "resolved", value: true };
    }
    case "compare": {
      const left = evaluateOperand(condition.left, state, context, options, namedConditions, currentStack, depth + 1, nodes, reads, [...path, "left"]);
      if (!left.ok) {
        return { status: "error", issues: [left.issue] };
      }
      const right = evaluateOperand(condition.right, state, context, options, namedConditions, currentStack, depth + 1, nodes, reads, [...path, "right"]);
      if (!right.ok) {
        return { status: "error", issues: [right.issue] };
      }
      if (!isString(condition.operator) || !COMPARISON_OPERATORS.has(condition.operator as ConditionComparisonOperator)) {
        return {
          status: "error",
          issues: [
            {
              code: "CONDITION_UNKNOWN_OPERATOR",
              path: [...path, "operator"],
              message: "compare operator is invalid."
            }
          ]
        };
      }
      const compared = compareValues(left.value, right.value, condition.operator as ConditionComparisonOperator);
      if (typeof compared === "boolean") {
        return { status: "resolved", value: compared };
      }
      return { status: "error", issues: [compared] };
    }
    case "contains": {
      const collection = evaluateOperand(
        condition.collection,
        state,
        context,
        options,
        namedConditions,
        currentStack,
        depth + 1,
        nodes,
        reads,
        [...path, "collection"]
      );
      if (!collection.ok) {
        return { status: "error", issues: [collection.issue] };
      }
      const member = evaluateOperand(
        condition.member,
        state,
        context,
        options,
        namedConditions,
        currentStack,
        depth + 1,
        nodes,
        reads,
        [...path, "member"]
      );
      if (!member.ok) {
        return { status: "error", issues: [member.issue] };
      }
      if (typeof collection.value === "string") {
        if (!isString(member.value)) {
          return {
            status: "error",
            issues: [
              {
                code: "CONDITION_INVALID_VALUE",
                path: [...path, "member"],
                message: "string collection requires a string member."
              }
            ]
          };
        }
        return { status: "resolved", value: collection.value.includes(member.value) };
      }
      if (Array.isArray(collection.value)) {
        return { status: "resolved", value: collection.value.some((entry) => Object.is(entry, member.value)) };
      }
      return {
        status: "error",
        issues: [
          {
            code: "CONDITION_INVALID_VALUE",
            path: [...path, "collection"],
            message: "contains requires a string or array collection."
          }
        ]
      };
    }
    case "entity-is": {
      const left = evaluateOperand(
        condition.left,
        state,
        context,
        options,
        namedConditions,
        currentStack,
        depth + 1,
        nodes,
        reads,
        [...path, "left"]
      );
      if (!left.ok) {
        return { status: "error", issues: [left.issue] };
      }
      const right = evaluateOperand(
        condition.right,
        state,
        context,
        options,
        namedConditions,
        currentStack,
        depth + 1,
        nodes,
        reads,
        [...path, "right"]
      );
      if (!right.ok) {
        return { status: "error", issues: [right.issue] };
      }
      if (!isRecord(left.value) || !isRecord(right.value)) {
        return {
          status: "error",
          issues: [
            {
              code: "CONDITION_INVALID_VALUE",
              path,
              message: "entity comparison requires entity references."
            }
          ]
        };
      }
      return { status: "resolved", value: left.value.id === right.value.id && left.value.entityType === right.value.entityType };
    }
    case "domain-exists":
      return { status: "resolved", value: findDomain(state, String(condition.domainId)) !== undefined };
    case "condition-ref": {
      const targetConditionId = String(condition.targetConditionId);
      if (stack.includes(targetConditionId)) {
        return {
          status: "error",
          issues: [
            {
              code: "CONDITION_REFERENCE_CYCLE",
              path: [...path, "targetConditionId"],
              message: "condition reference cycle detected."
            }
          ]
        };
      }
      const target = namedConditions.get(targetConditionId);
      if (target === undefined) {
        return {
          status: "error",
          issues: [
            {
              code: "CONDITION_REFERENCE_NOT_FOUND",
              path: [...path, "targetConditionId"],
              message: "referenced condition was not found."
            }
          ]
        };
      }
      return evaluateNode(target, state, context, options, namedConditions, [...stack, targetConditionId], depth + 1, nodes, reads, path);
    }
    case "all":
    case "any": {
      const operands = toReadonlyUnknownArray(condition.operands) ?? [];
      if (operands.length === 0) {
        return { status: "resolved", value: type === "all" };
      }
      for (let index = 0; index < operands.length; index += 1) {
        const evaluated = evaluateNode(
          operands[index],
          state,
          context,
          options,
          namedConditions,
          currentStack,
          depth + 1,
          nodes,
          reads,
          [...path, "operands", index]
        );
        if (evaluated.status === "error") {
          return evaluated;
        }
        if (type === "all" && !evaluated.value) {
          return { status: "resolved", value: false };
        }
        if (type === "any" && evaluated.value) {
          return { status: "resolved", value: true };
        }
      }
      return { status: "resolved", value: type === "all" };
    }
    case "not": {
      const operands = toReadonlyUnknownArray(condition.operands);
      const operand = operands === null ? undefined : operands[0];
      const evaluated = evaluateNode(
        operand,
        state,
        context,
        options,
        namedConditions,
        currentStack,
        depth + 1,
        nodes,
        reads,
        [...path, "operands", 0]
      );
      if (evaluated.status === "error") {
        return evaluated;
      }
      return { status: "resolved", value: !evaluated.value };
    }
    default:
      return {
        status: "error",
        issues: [
          {
            code: "CONDITION_UNKNOWN_OPERATOR",
            path: [...path, "type"],
            message: `Unsupported condition type: ${String(condition.type)}`
          }
        ]
      };
  }
}

export function inspectCondition(value: unknown): readonly ConditionEvaluationIssue[] {
  return validateRootCondition(value);
}

export function evaluateCondition(
  condition: unknown,
  state: unknown,
  options: ConditionEvaluationOptions = {}
): ConditionEvaluationResult {
  const conditionIssues = inspectCondition(condition);
  if (conditionIssues.length > 0) {
    return toConditionResult(false, conditionIssues);
  }

  const stateIssues = inspectEngineStateSnapshot(state);
  if (stateIssues.length > 0) {
    return toConditionResult(false, mapStateIssuesToConditionIssues(stateIssues));
  }

  const contextIssues = validateContext(options.context);
  if (contextIssues.length > 0) {
    return toConditionResult(false, contextIssues);
  }

  const namedConditions = options.namedConditions ?? new Map<string, unknown>();
  const resolvedContext = (options.context ?? {}) as ConditionEvaluationContext;
  const nodes = { count: 0 };
  const reads = { count: 0 };
  const result = evaluateNode(condition, state as EngineStateSnapshot, resolvedContext, options, namedConditions, [], 0, nodes, reads);

  if (result.status === "resolved") {
    return toConditionResult(result.value, []);
  }

  return toConditionResult(false, result.issues);
}

export function formatConditionEvaluationIssues(issues: readonly ConditionEvaluationIssue[]): string {
  const firstIssue = issues[0];
  if (firstIssue === undefined) {
    return "Condition is valid.";
  }
  return `${firstIssue.code} @ ${formatJsonPath(firstIssue.path)}: ${firstIssue.message}`;
}
