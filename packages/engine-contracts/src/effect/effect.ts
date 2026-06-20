import { canonicalizeJson, formatJsonPath, inspectJsonSafety, type JsonPath, type JsonValue } from "@narrative-engine/core";

import { evaluateCondition, inspectCondition, type ConditionEvaluationOptions } from "../condition/condition.js";
import {
  ENGINE_STATE_CONTRACT_VERSION,
  inspectEngineStateSnapshot,
  type EngineStateDomain,
  type EngineStateSnapshot
} from "../engine-state/engine-state.js";

export const EFFECT_CONTRACT_VERSION = "effect@0.1.0" as const;
export const EFFECT_SCHEMA_ID = "effect" as const;
export const EFFECT_SCHEMA_VERSION = 1 as const;

export type EffectType = "set" | "unset" | "increment" | "append" | "remove-at" | "add-unique" | "remove-value";

export type EffectApplicationStatus = "applied" | "no-op" | "skipped" | "error";

export type EffectApplicationIssueCode =
  | "EFFECT_NOT_OBJECT"
  | "EFFECT_UNKNOWN_OPERATOR"
  | "EFFECT_INVALID_PATH"
  | "EFFECT_INVALID_VALUE"
  | "EFFECT_STATE_PATH_NOT_FOUND"
  | "EFFECT_NON_JSON_VALUE"
  | "EFFECT_FORBIDDEN_KEY"
  | "EFFECT_INVALID_STATE"
  | "EFFECT_BUDGET_EXCEEDED";

export type EffectApplicationIssue = {
  readonly code: EffectApplicationIssueCode;
  readonly path: JsonPath;
  readonly message: string;
};

export type EffectChange = {
  readonly path: string;
  readonly before: JsonValue | undefined;
  readonly after: JsonValue | undefined;
};

export type EffectTarget = {
  readonly domainId: string;
  readonly path: string;
};

export type EffectApplicationOptions = {
  readonly context?: unknown;
  readonly namedConditions?: ReadonlyMap<string, unknown>;
  readonly maxDepth?: number;
  readonly maxNodes?: number;
  readonly maxChanges?: number;
};

export type EffectApplicationResult<TState = unknown> = {
  readonly applied: boolean;
  readonly status: EffectApplicationStatus;
  readonly state: TState;
  readonly changes: readonly EffectChange[];
  readonly issues: readonly EffectApplicationIssue[];
  readonly reason?: "guard-false";
};

export type EffectEnvelope = {
  readonly contractVersion: typeof EFFECT_CONTRACT_VERSION;
  readonly schemaId: typeof EFFECT_SCHEMA_ID;
  readonly schemaVersion: typeof EFFECT_SCHEMA_VERSION;
  readonly effectId?: string;
  readonly type: EffectType;
  readonly target: EffectTarget;
  readonly guard?: unknown;
  readonly value?: unknown;
  readonly delta?: unknown;
  readonly index?: unknown;
};

type JsonObject = Record<string, JsonValue>;
type JsonArray = JsonValue[];

type MutableDomain = {
  domainId: string;
  schemaId: string;
  schemaVersion: number;
  owner: string;
  authority: EngineStateDomain["authority"];
  persistence: EngineStateDomain["persistence"];
  data: JsonObject;
};

type MutableEngineStateSnapshot = {
  contractVersion: typeof ENGINE_STATE_CONTRACT_VERSION;
  schemaId: "engine-state";
  schemaVersion: number;
  stateId: string;
  revision: number;
  requiredDomains?: readonly string[];
  run: {
    seed?: string;
    activeModules?: readonly string[];
    domains: MutableDomain[];
  };
  meta?: {
    domains: MutableDomain[];
  };
};

type ResolvedDomainLocation = {
  readonly collection: "run" | "meta";
  readonly index: number;
  readonly domain: MutableDomain;
};

type ResolvedTargetLocation = {
  readonly found: boolean;
  readonly current?: JsonValue;
  readonly parent?: JsonObject | JsonArray;
  readonly key?: string | number;
};

const EFFECT_TARGET_PATH_PATTERN = /^(?:\/$|\/(?:[^~/]|~0|~1)+(?:\/(?:[^~/]|~0|~1)+)*)$/u;
const EFFECT_DOMAIN_ID_PATTERN = /^state-domain\.[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,31}\.[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,31}$/u;
const EFFECT_EFFECT_ID_PATTERN =
  /^[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,31}\.[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,47}\.[a-z0-9](?:[a-z0-9]|[_-](?=[a-z0-9])){0,79}$/u;
const RESERVED_METADATA_KEYS = new Set(["revision", "schemaVersion", "domainId", "owner", "authority", "persistence"]);
const COMMON_EFFECT_KEYS = new Set(["contractVersion", "schemaId", "schemaVersion", "effectId", "type", "target", "guard"]);
const SET_EFFECT_KEYS = new Set([...COMMON_EFFECT_KEYS, "value"]);
const UNSET_EFFECT_KEYS = new Set([...COMMON_EFFECT_KEYS]);
const INCREMENT_EFFECT_KEYS = new Set([...COMMON_EFFECT_KEYS, "delta"]);
const APPEND_EFFECT_KEYS = new Set([...COMMON_EFFECT_KEYS, "value"]);
const REMOVE_AT_EFFECT_KEYS = new Set([...COMMON_EFFECT_KEYS, "index"]);
const UNIQUE_EFFECT_KEYS = new Set([...COMMON_EFFECT_KEYS, "value"]);
const REMOVE_VALUE_EFFECT_KEYS = new Set([...COMMON_EFFECT_KEYS, "value"]);
const EFFECT_TYPES = new Set<EffectType>(["set", "unset", "increment", "append", "remove-at", "add-unique", "remove-value"]);
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return isInteger(value) && value >= 0;
}

function isEffectType(value: unknown): value is EffectType {
  return isString(value) && EFFECT_TYPES.has(value as EffectType);
}

function isDefinedJsonValue(value: JsonValue | undefined): value is JsonValue {
  return value !== undefined;
}

function isJsonArray(value: JsonValue): value is JsonArray {
  return Array.isArray(value);
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return isRecord(value);
}

function getJsonArrayValue(values: JsonArray, index: number): JsonValue | undefined {
  return values[index];
}

function getJsonObjectValue(value: JsonObject, key: string): JsonValue | undefined {
  return value[key];
}

function addIssue(issues: EffectApplicationIssue[], code: EffectApplicationIssueCode, path: JsonPath, message: string): void {
  issues.push({ code, path: path.slice(), message });
}

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneJsonSafeValue(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

function cloneEngineState(state: EngineStateSnapshot): MutableEngineStateSnapshot {
  return JSON.parse(JSON.stringify(state)) as MutableEngineStateSnapshot;
}

function canonicalValue(value: unknown): string {
  return canonicalizeJson(value as JsonValue);
}

function canonicalEquals(left: unknown, right: unknown): boolean {
  return canonicalValue(left) === canonicalValue(right);
}

function mapJsonSafetyIssues(
  issues: EffectApplicationIssue[],
  sourceIssues: readonly { readonly code: string; readonly path: JsonPath; readonly message: string }[],
  prefix: JsonPath = []
): void {
  for (const issue of sourceIssues) {
    addIssue(
      issues,
      issue.code === "FORBIDDEN_KEY" ? "EFFECT_FORBIDDEN_KEY" : "EFFECT_NON_JSON_VALUE",
      [...prefix, ...issue.path],
      issue.message
    );
  }
}

function mapConditionIssues(
  issues: EffectApplicationIssue[],
  sourceIssues: readonly { readonly code: string; readonly path: JsonPath; readonly message: string }[]
): void {
  for (const issue of sourceIssues) {
    const code =
      issue.code === "CONDITION_NOT_OBJECT"
        ? "EFFECT_INVALID_VALUE"
        : issue.code === "CONDITION_UNKNOWN_OPERATOR"
          ? "EFFECT_UNKNOWN_OPERATOR"
          : issue.code === "CONDITION_INVALID_PATH"
            ? "EFFECT_INVALID_PATH"
            : issue.code === "CONDITION_STATE_PATH_NOT_FOUND"
              ? "EFFECT_STATE_PATH_NOT_FOUND"
              : issue.code === "CONDITION_NON_JSON_VALUE"
                ? "EFFECT_NON_JSON_VALUE"
                : issue.code === "CONDITION_FORBIDDEN_KEY"
                  ? "EFFECT_FORBIDDEN_KEY"
                  : "EFFECT_INVALID_VALUE";
    addIssue(issues, code, ["guard", ...issue.path], issue.message);
  }
}

function validateUnknownFields(value: JsonObject, allowed: Set<string>, issues: EffectApplicationIssue[], path: JsonPath): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      addIssue(issues, "EFFECT_INVALID_VALUE", [...path, key], `unknown field "${key}" is not allowed.`);
    }
  }
}

function validateEffectId(value: unknown, issues: EffectApplicationIssue[], path: JsonPath): void {
  if (value === undefined) {
    return;
  }
  if (!isString(value) || !EFFECT_EFFECT_ID_PATTERN.test(value)) {
    addIssue(issues, "EFFECT_INVALID_VALUE", path, "effectId is invalid.");
  }
}

function decodeTargetPath(path: string): readonly string[] | null {
  if (path === "/") {
    return [];
  }
  if (!EFFECT_TARGET_PATH_PATTERN.test(path)) {
    return null;
  }

  const segments = path
    .slice(1)
    .split("/")
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));

  for (const segment of segments) {
    if (segment === ".." || FORBIDDEN_KEYS.has(segment) || RESERVED_METADATA_KEYS.has(segment)) {
      return null;
    }
  }

  return segments;
}

function validateStateTarget(
  value: unknown,
  issues: EffectApplicationIssue[],
  path: JsonPath
): value is EffectTarget {
  if (!isRecord(value)) {
    addIssue(issues, "EFFECT_INVALID_VALUE", path, "target must be an object.");
    return false;
  }

  validateUnknownFields(value, new Set(["domainId", "path"]), issues, path);

  if (!isString(value.domainId) || !EFFECT_DOMAIN_ID_PATTERN.test(value.domainId)) {
    addIssue(issues, "EFFECT_INVALID_VALUE", [...path, "domainId"], "target.domainId is invalid.");
  }

  if (!isString(value.path) || decodeTargetPath(value.path) === null) {
    addIssue(issues, "EFFECT_INVALID_PATH", [...path, "path"], "target.path is invalid.");
    return false;
  }

  return true;
}

function validateEffectValue(value: unknown, issues: EffectApplicationIssue[], path: JsonPath): void {
  mapJsonSafetyIssues(issues, inspectJsonSafety(value), path);
}

function validateEffectEnvelope(value: unknown): EffectApplicationIssue[] {
  const issues: EffectApplicationIssue[] = [];

  if (!isRecord(value)) {
    addIssue(issues, "EFFECT_NOT_OBJECT", [], "effect must be an object.");
    mapJsonSafetyIssues(issues, inspectJsonSafety(value));
    return issues;
  }

  mapJsonSafetyIssues(issues, inspectJsonSafety(value));
  validateEffectId(value.effectId, issues, ["effectId"]);

  if (value.contractVersion !== EFFECT_CONTRACT_VERSION) {
    addIssue(issues, "EFFECT_INVALID_VALUE", ["contractVersion"], "contractVersion is invalid.");
  }
  if (value.schemaId !== EFFECT_SCHEMA_ID) {
    addIssue(issues, "EFFECT_INVALID_VALUE", ["schemaId"], "schemaId is invalid.");
  }
  if (value.schemaVersion !== EFFECT_SCHEMA_VERSION) {
    addIssue(issues, "EFFECT_INVALID_VALUE", ["schemaVersion"], "schemaVersion is invalid.");
  }

  if (!validateStateTarget(value.target, issues, ["target"])) {
    return issues;
  }

  if (!isEffectType(value.type)) {
    const effectType = isString(value.type) ? value.type : "unknown";
    addIssue(issues, "EFFECT_UNKNOWN_OPERATOR", ["type"], `Unsupported effect type: ${effectType}`);
    return issues;
  }

  const allowedKeys =
    value.type === "set"
      ? SET_EFFECT_KEYS
      : value.type === "unset"
        ? UNSET_EFFECT_KEYS
        : value.type === "increment"
          ? INCREMENT_EFFECT_KEYS
          : value.type === "append"
            ? APPEND_EFFECT_KEYS
            : value.type === "remove-at"
              ? REMOVE_AT_EFFECT_KEYS
              : value.type === "add-unique"
                ? UNIQUE_EFFECT_KEYS
                : REMOVE_VALUE_EFFECT_KEYS;

  validateUnknownFields(value, allowedKeys, issues, []);

  if (value.guard !== undefined) {
    const guardIssues = inspectCondition(value.guard);
    if (guardIssues.length > 0) {
      mapConditionIssues(issues, guardIssues);
    }
  }

  switch (value.type) {
    case "set":
    case "append":
    case "add-unique":
    case "remove-value":
      validateEffectValue(value.value, issues, ["value"]);
      break;
    case "increment":
      if (!isFiniteNumber(value.delta)) {
        addIssue(issues, "EFFECT_INVALID_VALUE", ["delta"], "delta is invalid.");
      }
      break;
    case "remove-at":
      if (!isNonNegativeInteger(value.index)) {
        addIssue(issues, "EFFECT_INVALID_VALUE", ["index"], "index is invalid.");
      }
      break;
    case "unset":
      break;
  }

  return issues;
}

function getDomainLocation(state: MutableEngineStateSnapshot, domainId: string): ResolvedDomainLocation | undefined {
  for (let index = 0; index < state.run.domains.length; index += 1) {
    const domain = state.run.domains[index];
    if (domain !== undefined && domain.domainId === domainId) {
      return { collection: "run", index, domain };
    }
  }

  const metaDomains = state.meta?.domains;
  if (metaDomains !== undefined) {
    for (let index = 0; index < metaDomains.length; index += 1) {
      const domain = metaDomains[index];
      if (domain !== undefined && domain.domainId === domainId) {
        return { collection: "meta", index, domain };
      }
    }
  }

  return undefined;
}

function resolveTargetLocation(domain: JsonObject, segments: readonly string[]): ResolvedTargetLocation | null {
  if (segments.length === 0) {
    return { found: true, current: domain };
  }

  let current: JsonValue = domain;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    if (segment === undefined) {
      return null;
    }

    if (isJsonArray(current)) {
      if (!/^\d+$/u.test(segment)) {
        return null;
      }
      const arrayIndex = Number(segment);
      if (arrayIndex < 0 || arrayIndex >= current.length) {
        return null;
      }
      const nextValue = getJsonArrayValue(current, arrayIndex);
      if (nextValue === undefined) {
        return null;
      }
      current = nextValue;
      continue;
    }

    if (!isRecord(current) || !Object.prototype.hasOwnProperty.call(current, segment)) {
      return null;
    }
    const nextValue = getJsonObjectValue(current, segment);
    if (nextValue === undefined) {
      return null;
    }
    current = nextValue;
  }

  const finalSegment = segments[segments.length - 1];
  if (finalSegment === undefined) {
    return null;
  }

  if (isJsonArray(current)) {
    if (!/^\d+$/u.test(finalSegment)) {
      return null;
    }
    const index = Number(finalSegment);
    if (index < 0 || index > current.length) {
      return null;
    }
    if (index < current.length) {
      const currentValue = getJsonArrayValue(current, index);
      if (currentValue === undefined) {
        return null;
      }
      return {
        found: true,
        current: currentValue,
        parent: current,
        key: index
      };
    }
    return {
      found: false,
      parent: current,
      key: index
    };
  }

  if (!isJsonObject(current)) {
    return null;
  }

  if (!Object.prototype.hasOwnProperty.call(current, finalSegment)) {
    return {
      found: false,
      parent: current,
      key: finalSegment
    };
  }

  const currentValue = getJsonObjectValue(current, finalSegment);
  if (currentValue === undefined) {
    return null;
  }

  return {
    found: true,
    current: currentValue,
    parent: current,
    key: finalSegment
  };
}

function valueTypeSet(values: readonly JsonValue[]): Set<string> {
  const kinds = new Set<string>();
  for (const value of values) {
    kinds.add(value === null ? "null" : Array.isArray(value) ? "array" : typeof value);
  }
  return kinds;
}

function ensureUniqueAndComparableCollection(
  values: readonly JsonValue[],
  issues: EffectApplicationIssue[],
  path: JsonPath
): boolean {
  const kinds = valueTypeSet(values);
  if (kinds.size > 1) {
    addIssue(issues, "EFFECT_INVALID_VALUE", path, "collection has mixed value types.");
    return false;
  }

  const seen = new Set<string>();
  for (const entry of values) {
    const fingerprint = canonicalValue(entry);
    if (seen.has(fingerprint)) {
      addIssue(issues, "EFFECT_INVALID_VALUE", path, "collection has ambiguous duplicate values.");
      return false;
    }
    seen.add(fingerprint);
  }

  return true;
}

function mapStateIssuesToEffectIssues(
  issues: readonly { readonly code: string; readonly path: JsonPath; readonly message: string }[]
): readonly EffectApplicationIssue[] {
  return issues.map((issue) => ({
    code: "EFFECT_INVALID_STATE",
    path: issue.path.slice(),
    message: issue.message
  }));
}

function errorResult<TState>(
  state: TState,
  issues: readonly EffectApplicationIssue[],
  reason?: "guard-false"
): EffectApplicationResult<TState> {
  if (reason === undefined) {
    return {
      applied: false,
      status: "error",
      state,
      changes: [],
      issues
    };
  }

  return {
    applied: false,
    status: "error",
    state,
    changes: [],
    issues,
    reason
  };
}

function successResult<TState>(
  status: "applied" | "no-op" | "skipped",
  state: TState,
  changes: readonly EffectChange[],
  reason?: "guard-false"
): EffectApplicationResult<TState> {
  if (reason === undefined) {
    return {
      applied: status === "applied",
      status,
      state,
      changes,
      issues: []
    };
  }

  return {
    applied: status === "applied",
    status,
    state,
    changes,
    issues: [],
    reason
  };
}

function applySetEffect(effect: EffectEnvelope, workingState: MutableEngineStateSnapshot): EffectApplicationResult<MutableEngineStateSnapshot> {
  const location = getDomainLocation(workingState, effect.target.domainId);
  if (location === undefined) {
    return errorResult(workingState, [
      {
        code: "EFFECT_STATE_PATH_NOT_FOUND",
        path: ["target", "domainId"],
        message: "Effect target domain could not be resolved."
      }
    ]);
  }

  const segments = decodeTargetPath(effect.target.path);
  if (segments === null) {
    return errorResult(workingState, [
      {
        code: "EFFECT_INVALID_PATH",
        path: ["target", "path"],
        message: "Effect target path is invalid."
      }
    ]);
  }

  if (segments.length === 0) {
    if (!isRecord(effect.value)) {
      return errorResult(workingState, [
        {
          code: "EFFECT_INVALID_VALUE",
          path: ["value"],
          message: "Root domain data must be an object."
        }
      ]);
    }

    const before = cloneJsonValue(location.domain.data);
    const after = cloneJsonSafeValue(effect.value);
    if (canonicalEquals(before, after)) {
      return successResult("no-op", workingState, []);
    }

    const nextState = cloneEngineState(workingState);
    const nextLocation = getDomainLocation(nextState, effect.target.domainId);
    if (nextLocation === undefined) {
      return errorResult(workingState, [
        {
          code: "EFFECT_INVALID_STATE",
          path: ["target"],
          message: "Effect target domain could not be cloned."
        }
      ]);
    }
    nextLocation.domain.data = after as JsonObject;
    return successResult("applied", nextState, [
      {
        path: effect.target.path,
        before,
        after
      }
    ]);
  }

  const target = resolveTargetLocation(location.domain.data, segments);
  if (target === null || target.parent === undefined || target.key === undefined) {
    return errorResult(workingState, [
      {
        code: "EFFECT_STATE_PATH_NOT_FOUND",
        path: ["target", "path"],
        message: "Effect target path could not be resolved."
      }
    ]);
  }

  const nextState = cloneEngineState(workingState);
  const nextLocation = getDomainLocation(nextState, effect.target.domainId);
  if (nextLocation === undefined) {
    return errorResult(workingState, [
      {
        code: "EFFECT_INVALID_STATE",
        path: ["target"],
        message: "Effect target domain could not be cloned."
      }
    ]);
  }
  const nextTarget = resolveTargetLocation(nextLocation.domain.data, segments);
  if (nextTarget === null || nextTarget.parent === undefined || nextTarget.key === undefined) {
    return errorResult(workingState, [
      {
        code: "EFFECT_INVALID_STATE",
        path: ["target", "path"],
        message: "Effect target path could not be resolved."
      }
    ]);
  }

  let before: JsonValue | undefined;
  if (target.found && isDefinedJsonValue(target.current)) {
    before = cloneJsonValue(target.current);
  }

  const after = cloneJsonSafeValue(effect.value);

  if (Array.isArray(nextTarget.parent)) {
    if (typeof nextTarget.key !== "number") {
      return errorResult(workingState, [
        {
          code: "EFFECT_INVALID_STATE",
          path: ["target", "path"],
          message: "Effect target path could not be resolved."
        }
      ]);
    }
    if (nextTarget.key === nextTarget.parent.length) {
      nextTarget.parent.push(after);
    } else {
      nextTarget.parent[nextTarget.key] = after;
    }
  } else {
    if (typeof nextTarget.key !== "string") {
      return errorResult(workingState, [
        {
          code: "EFFECT_INVALID_STATE",
          path: ["target", "path"],
          message: "Effect target path could not be resolved."
        }
      ]);
    }
    nextTarget.parent[nextTarget.key] = after;
  }

  if (before !== undefined && canonicalEquals(before, after)) {
    return successResult("no-op", workingState, []);
  }

  return successResult("applied", nextState, [
    {
      path: effect.target.path,
      before,
      after
    }
  ]);
}

function applyUnsetEffect(effect: EffectEnvelope, workingState: MutableEngineStateSnapshot): EffectApplicationResult<MutableEngineStateSnapshot> {
  const location = getDomainLocation(workingState, effect.target.domainId);
  if (location === undefined) {
    return errorResult(workingState, [
      {
        code: "EFFECT_STATE_PATH_NOT_FOUND",
        path: ["target", "domainId"],
        message: "Effect target domain could not be resolved."
      }
    ]);
  }

  const segments = decodeTargetPath(effect.target.path);
  if (segments === null || segments.length === 0) {
    return errorResult(workingState, [
      {
        code: "EFFECT_INVALID_PATH",
        path: ["target", "path"],
        message: "Effect target path is invalid."
      }
    ]);
  }

  const target = resolveTargetLocation(location.domain.data, segments);
  if (target === null || target.parent === undefined || target.key === undefined || Array.isArray(target.parent)) {
    return errorResult(workingState, [
      {
        code: "EFFECT_STATE_PATH_NOT_FOUND",
        path: ["target", "path"],
        message: "Effect target path could not be resolved."
      }
    ]);
  }

  if (!target.found) {
    return successResult("no-op", workingState, []);
  }

  if (!isDefinedJsonValue(target.current)) {
    return errorResult(workingState, [
      {
        code: "EFFECT_INVALID_STATE",
        path: ["target", "path"],
        message: "Effect target path could not be resolved."
      }
    ]);
  }

  const before = cloneJsonValue(target.current);
  const nextState = cloneEngineState(workingState);
  const nextLocation = getDomainLocation(nextState, effect.target.domainId);
  if (nextLocation === undefined) {
    return errorResult(workingState, [
      {
        code: "EFFECT_INVALID_STATE",
        path: ["target"],
        message: "Effect target domain could not be cloned."
      }
    ]);
  }
  const nextTarget = resolveTargetLocation(nextLocation.domain.data, segments);
  if (nextTarget === null || nextTarget.parent === undefined || nextTarget.key === undefined || Array.isArray(nextTarget.parent)) {
    return errorResult(workingState, [
      {
        code: "EFFECT_INVALID_STATE",
        path: ["target", "path"],
        message: "Effect target path could not be resolved."
      }
    ]);
  }
  if (typeof nextTarget.key !== "string") {
    return errorResult(workingState, [
      {
        code: "EFFECT_INVALID_STATE",
        path: ["target", "path"],
        message: "Effect target path could not be resolved."
      }
    ]);
  }

  Reflect.deleteProperty(nextTarget.parent, nextTarget.key);
  return successResult("applied", nextState, [
    {
      path: effect.target.path,
      before,
      after: undefined
    }
  ]);
}

function applyIncrementEffect(
  effect: EffectEnvelope,
  workingState: MutableEngineStateSnapshot
): EffectApplicationResult<MutableEngineStateSnapshot> {
  const location = getDomainLocation(workingState, effect.target.domainId);
  if (location === undefined) {
    return errorResult(workingState, [
      {
        code: "EFFECT_STATE_PATH_NOT_FOUND",
        path: ["target", "domainId"],
        message: "Effect target domain could not be resolved."
      }
    ]);
  }

  const segments = decodeTargetPath(effect.target.path);
  if (segments === null) {
    return errorResult(workingState, [
      {
        code: "EFFECT_INVALID_PATH",
        path: ["target", "path"],
        message: "Effect target path is invalid."
      }
    ]);
  }

  const target = resolveTargetLocation(location.domain.data, segments);
  if (target === null || !target.found || !isDefinedJsonValue(target.current)) {
    return errorResult(workingState, [
      {
        code: "EFFECT_STATE_PATH_NOT_FOUND",
        path: ["target", "path"],
        message: "Effect target path could not be resolved."
      }
    ]);
  }
  if (typeof target.current !== "number" || !Number.isFinite(target.current) || !isFiniteNumber(effect.delta)) {
    return errorResult(workingState, [
      {
        code: "EFFECT_INVALID_VALUE",
        path: ["delta"],
        message: "increment delta is invalid."
      }
    ]);
  }
  if (effect.delta === 0) {
    return successResult("no-op", workingState, []);
  }

  const nextValue = target.current + effect.delta;
  if (!Number.isFinite(nextValue)) {
    return errorResult(workingState, [
      {
        code: "EFFECT_INVALID_VALUE",
        path: ["delta"],
        message: "increment result is not finite."
      }
    ]);
  }

  const before = cloneJsonValue(target.current);
  const nextState = cloneEngineState(workingState);
  const nextLocation = getDomainLocation(nextState, effect.target.domainId);
  if (nextLocation === undefined) {
    return errorResult(workingState, [
      {
        code: "EFFECT_INVALID_STATE",
        path: ["target"],
        message: "Effect target domain could not be cloned."
      }
    ]);
  }
  const nextTarget = resolveTargetLocation(nextLocation.domain.data, segments);
  if (nextTarget === null || nextTarget.parent === undefined || nextTarget.key === undefined) {
    return errorResult(workingState, [
      {
        code: "EFFECT_INVALID_STATE",
        path: ["target", "path"],
        message: "Effect target path could not be resolved."
      }
    ]);
  }

  if (Array.isArray(nextTarget.parent)) {
    if (typeof nextTarget.key !== "number") {
      return errorResult(workingState, [
        {
          code: "EFFECT_INVALID_STATE",
          path: ["target", "path"],
          message: "Effect target path could not be resolved."
        }
      ]);
    }
    nextTarget.parent[nextTarget.key] = nextValue;
  } else {
    if (typeof nextTarget.key !== "string") {
      return errorResult(workingState, [
        {
          code: "EFFECT_INVALID_STATE",
          path: ["target", "path"],
          message: "Effect target path could not be resolved."
        }
      ]);
    }
    nextTarget.parent[nextTarget.key] = nextValue;
  }

  return successResult("applied", nextState, [
    {
      path: effect.target.path,
      before,
      after: nextValue
    }
  ]);
}

function applyAppendEffect(
  effect: EffectEnvelope,
  workingState: MutableEngineStateSnapshot
): EffectApplicationResult<MutableEngineStateSnapshot> {
  const location = getDomainLocation(workingState, effect.target.domainId);
  if (location === undefined) {
    return errorResult(workingState, [
      {
        code: "EFFECT_STATE_PATH_NOT_FOUND",
        path: ["target", "domainId"],
        message: "Effect target domain could not be resolved."
      }
    ]);
  }

  const segments = decodeTargetPath(effect.target.path);
  if (segments === null) {
    return errorResult(workingState, [
      {
        code: "EFFECT_INVALID_PATH",
        path: ["target", "path"],
        message: "Effect target path is invalid."
      }
    ]);
  }

  const target = resolveTargetLocation(location.domain.data, segments);
  if (target === null || !target.found || !isDefinedJsonValue(target.current)) {
    return errorResult(workingState, [
      {
        code: "EFFECT_STATE_PATH_NOT_FOUND",
        path: ["target", "path"],
        message: "append target could not be resolved."
      }
    ]);
  }
  if (!Array.isArray(target.current)) {
    return errorResult(workingState, [
      {
        code: "EFFECT_INVALID_VALUE",
        path: ["target", "path"],
        message: "append target must be an array."
      }
    ]);
  }

  const before = cloneJsonValue(target.current);
  const nextState = cloneEngineState(workingState);
  const nextLocation = getDomainLocation(nextState, effect.target.domainId);
  if (nextLocation === undefined) {
    return errorResult(workingState, [
      {
        code: "EFFECT_INVALID_STATE",
        path: ["target"],
        message: "Effect target domain could not be cloned."
      }
    ]);
  }
  const nextTarget = resolveTargetLocation(nextLocation.domain.data, segments);
  if (nextTarget === null || !isDefinedJsonValue(nextTarget.current) || !Array.isArray(nextTarget.current)) {
    return errorResult(workingState, [
      {
        code: "EFFECT_INVALID_STATE",
        path: ["target", "path"],
        message: "append target could not be resolved."
      }
    ]);
  }

  nextTarget.current.push(cloneJsonSafeValue(effect.value));
  return successResult("applied", nextState, [
    {
      path: effect.target.path,
      before,
      after: cloneJsonValue(nextTarget.current)
    }
  ]);
}

function applyRemoveAtEffect(
  effect: EffectEnvelope,
  workingState: MutableEngineStateSnapshot
): EffectApplicationResult<MutableEngineStateSnapshot> {
  const location = getDomainLocation(workingState, effect.target.domainId);
  if (location === undefined) {
    return errorResult(workingState, [
      {
        code: "EFFECT_STATE_PATH_NOT_FOUND",
        path: ["target", "domainId"],
        message: "Effect target domain could not be resolved."
      }
    ]);
  }

  const segments = decodeTargetPath(effect.target.path);
  if (segments === null) {
    return errorResult(workingState, [
      {
        code: "EFFECT_INVALID_PATH",
        path: ["target", "path"],
        message: "Effect target path is invalid."
      }
    ]);
  }

  if (!isNonNegativeInteger(effect.index)) {
    return errorResult(workingState, [
      {
        code: "EFFECT_INVALID_VALUE",
        path: ["index"],
        message: "index is invalid."
      }
    ]);
  }

  const target = resolveTargetLocation(location.domain.data, segments);
  if (target === null || !target.found || !isDefinedJsonValue(target.current)) {
    return errorResult(workingState, [
      {
        code: "EFFECT_STATE_PATH_NOT_FOUND",
        path: ["target", "path"],
        message: "remove-at target could not be resolved."
      }
    ]);
  }
  if (!Array.isArray(target.current)) {
    return errorResult(workingState, [
      {
        code: "EFFECT_INVALID_VALUE",
        path: ["target", "path"],
        message: "remove-at target must be an array."
      }
    ]);
  }
  if (effect.index < 0 || effect.index >= target.current.length) {
    return errorResult(workingState, [
      {
        code: "EFFECT_STATE_PATH_NOT_FOUND",
        path: ["index"],
        message: "remove-at index is out of range."
      }
    ]);
  }

  const before = cloneJsonValue(target.current);
  const nextState = cloneEngineState(workingState);
  const nextLocation = getDomainLocation(nextState, effect.target.domainId);
  if (nextLocation === undefined) {
    return errorResult(workingState, [
      {
        code: "EFFECT_INVALID_STATE",
        path: ["target"],
        message: "Effect target domain could not be cloned."
      }
    ]);
  }
  const nextTarget = resolveTargetLocation(nextLocation.domain.data, segments);
  if (nextTarget === null || !isDefinedJsonValue(nextTarget.current) || !Array.isArray(nextTarget.current)) {
    return errorResult(workingState, [
      {
        code: "EFFECT_INVALID_STATE",
        path: ["target", "path"],
        message: "remove-at target could not be resolved."
      }
    ]);
  }

  nextTarget.current.splice(effect.index, 1);
  return successResult("applied", nextState, [
    {
      path: effect.target.path,
      before,
      after: cloneJsonValue(nextTarget.current)
    }
  ]);
}

function applyUniqueCollectionEffect(
  effect: EffectEnvelope,
  workingState: MutableEngineStateSnapshot,
  removeValue: boolean
): EffectApplicationResult<MutableEngineStateSnapshot> {
  const location = getDomainLocation(workingState, effect.target.domainId);
  if (location === undefined) {
    return errorResult(workingState, [
      {
        code: "EFFECT_STATE_PATH_NOT_FOUND",
        path: ["target", "domainId"],
        message: "Effect target domain could not be resolved."
      }
    ]);
  }

  const segments = decodeTargetPath(effect.target.path);
  if (segments === null) {
    return errorResult(workingState, [
      {
        code: "EFFECT_INVALID_PATH",
        path: ["target", "path"],
        message: "Effect target path is invalid."
      }
    ]);
  }

  const target = resolveTargetLocation(location.domain.data, segments);
  if (target === null || !target.found || !isDefinedJsonValue(target.current)) {
    return errorResult(workingState, [
      {
        code: "EFFECT_STATE_PATH_NOT_FOUND",
        path: ["target", "path"],
        message: "collection target could not be resolved."
      }
    ]);
  }
  if (!Array.isArray(target.current)) {
    return errorResult(workingState, [
      {
        code: "EFFECT_INVALID_VALUE",
        path: ["target", "path"],
        message: "collection target must be an array."
      }
    ]);
  }
  if (!ensureUniqueAndComparableCollection(target.current, [], ["target", "path"])) {
    return errorResult(workingState, [
      {
        code: "EFFECT_INVALID_VALUE",
        path: ["target", "path"],
        message: "collection contains ambiguous values."
      }
    ]);
  }

  const fingerprint = canonicalValue(effect.value);
  const existing = target.current.findIndex((entry) => canonicalValue(entry) === fingerprint);
  if (removeValue) {
    if (existing === -1) {
      return successResult("no-op", workingState, []);
    }
  } else if (existing !== -1) {
    return successResult("no-op", workingState, []);
  }

  const before = cloneJsonValue(target.current);
  const nextState = cloneEngineState(workingState);
  const nextLocation = getDomainLocation(nextState, effect.target.domainId);
  if (nextLocation === undefined) {
    return errorResult(workingState, [
      {
        code: "EFFECT_INVALID_STATE",
        path: ["target"],
        message: "Effect target domain could not be cloned."
      }
    ]);
  }
  const nextTarget = resolveTargetLocation(nextLocation.domain.data, segments);
  if (nextTarget === null || !isDefinedJsonValue(nextTarget.current) || !Array.isArray(nextTarget.current)) {
    return errorResult(workingState, [
      {
        code: "EFFECT_INVALID_STATE",
        path: ["target", "path"],
        message: "collection target could not be resolved."
      }
    ]);
  }

  if (removeValue) {
    nextTarget.current.splice(existing, 1);
  } else {
    nextTarget.current.push(cloneJsonSafeValue(effect.value));
  }

  return successResult("applied", nextState, [
    {
      path: effect.target.path,
      before,
      after: cloneJsonValue(nextTarget.current)
    }
  ]);
}

function applyOperation(
  effect: EffectEnvelope,
  workingState: MutableEngineStateSnapshot
): EffectApplicationResult<MutableEngineStateSnapshot> {
  switch (effect.type) {
    case "set":
      return applySetEffect(effect, workingState);
    case "unset":
      return applyUnsetEffect(effect, workingState);
    case "increment":
      return applyIncrementEffect(effect, workingState);
    case "append":
      return applyAppendEffect(effect, workingState);
    case "remove-at":
      return applyRemoveAtEffect(effect, workingState);
    case "add-unique":
      return applyUniqueCollectionEffect(effect, workingState, false);
    case "remove-value":
      return applyUniqueCollectionEffect(effect, workingState, true);
  }
}

export function inspectEffect(value: unknown): readonly EffectApplicationIssue[] {
  return validateEffectEnvelope(value);
}

function buildGuardOptions(options: EffectApplicationOptions): ConditionEvaluationOptions {
  return {
    ...(options.context !== undefined ? { context: options.context } : {}),
    ...(options.namedConditions !== undefined ? { namedConditions: options.namedConditions } : {}),
    ...(options.maxDepth !== undefined ? { maxDepth: options.maxDepth } : {}),
    ...(options.maxNodes !== undefined ? { maxNodes: options.maxNodes } : {})
  };
}

export function applyEffect(
  effect: unknown,
  state: EngineStateSnapshot,
  options: EffectApplicationOptions = {}
): EffectApplicationResult<EngineStateSnapshot> {
  const effectIssues = inspectEffect(effect);
  if (effectIssues.length > 0) {
    return errorResult(state, effectIssues);
  }

  const stateIssues = inspectEngineStateSnapshot(state);
  if (stateIssues.length > 0) {
    return errorResult(state, mapStateIssuesToEffectIssues(stateIssues));
  }

  const workingState = cloneEngineState(state);
  const resolvedEffect = effect as EffectEnvelope;

  if (resolvedEffect.guard !== undefined) {
    const guardResult = evaluateCondition(resolvedEffect.guard, workingState, buildGuardOptions(options));
    if (guardResult.issues.length > 0) {
      return errorResult(workingState, mapConditionIssuesToEffectIssues(guardResult.issues));
    }
    if (!guardResult.matched) {
      return successResult("skipped", workingState, [], "guard-false");
    }
  }

  const result = applyOperation(resolvedEffect, workingState);
  if (result.status === "error") {
    return errorResult(result.state, result.issues, result.reason);
  }

  if (result.reason === undefined) {
    return {
      applied: result.applied,
      status: result.status,
      state: result.state,
      changes: result.changes,
      issues: []
    };
  }

  return {
    applied: result.applied,
    status: result.status,
    state: result.state,
    changes: result.changes,
    issues: [],
    reason: result.reason
  };
}

function mapConditionIssuesToEffectIssues(
  issues: readonly { readonly code: string; readonly path: JsonPath; readonly message: string }[]
): readonly EffectApplicationIssue[] {
  return issues.map((issue) => {
    const code =
      issue.code === "CONDITION_INVALID_PATH"
        ? "EFFECT_INVALID_PATH"
        : issue.code === "CONDITION_STATE_PATH_NOT_FOUND"
          ? "EFFECT_STATE_PATH_NOT_FOUND"
          : issue.code === "CONDITION_NON_JSON_VALUE"
            ? "EFFECT_NON_JSON_VALUE"
            : issue.code === "CONDITION_FORBIDDEN_KEY"
              ? "EFFECT_FORBIDDEN_KEY"
              : issue.code === "CONDITION_UNKNOWN_OPERATOR"
                ? "EFFECT_UNKNOWN_OPERATOR"
                : "EFFECT_INVALID_VALUE";
    return {
      code,
      path: issue.path.slice(),
      message: issue.message
    };
  });
}

function formatEffectApplicationIssues(issues: readonly EffectApplicationIssue[]): string {
  const firstIssue = issues[0];
  if (firstIssue === undefined) {
    return "Effect is valid.";
  }
  return `${firstIssue.code} @ ${formatJsonPath(firstIssue.path)}: ${firstIssue.message}`;
}

export { formatEffectApplicationIssues };
