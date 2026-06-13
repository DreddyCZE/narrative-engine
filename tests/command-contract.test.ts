import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runtimeInvalidCases } from "./fixtures/contracts/command/runtime-invalid/runtime-invalid";

type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;
type JsonObject = { [key: string]: JsonValue };
type TypedReference = {
  id: string;
  entityType: string;
};
type Initiator = {
  kind: "system" | "ui" | "editor" | "network" | "scheduler" | "service";
  sourceId?: string;
};
type Condition =
  | { contractVersion: "condition@0.1.0"; schemaId: "condition"; schemaVersion: number; type: "constant"; value: boolean }
  | { contractVersion: "condition@0.1.0"; schemaId: "condition"; schemaVersion: number; type: "condition-ref"; conditionId: string }
  | { contractVersion: "condition@0.1.0"; schemaId: "condition"; schemaVersion: number; type: "exists"; selector: StateSelector }
  | { contractVersion: "condition@0.1.0"; schemaId: "condition"; schemaVersion: number; type: "domain-exists"; domainId: string }
  | { contractVersion: "condition@0.1.0"; schemaId: "condition"; schemaVersion: number; type: "all" | "any"; operands: Condition[] }
  | { contractVersion: "condition@0.1.0"; schemaId: "condition"; schemaVersion: number; type: "not"; operands: [Condition] }
  | {
      contractVersion: "condition@0.1.0";
      schemaId: "condition";
      schemaVersion: number;
      type: "compare";
      operator: "eq" | "neq" | "lt" | "lte" | "gt" | "gte";
      left: Operand;
      right: Operand;
    }
  | {
      contractVersion: "condition@0.1.0";
      schemaId: "condition";
      schemaVersion: number;
      type: "entity-is";
      left: Operand;
      right: Operand;
    }
  | {
      contractVersion: "condition@0.1.0";
      schemaId: "condition";
      schemaVersion: number;
      type: "contains";
      collection: Operand;
      member: Operand;
    };
type Operand =
  | { kind: "literal"; value: JsonValue }
  | { kind: "state-value"; selector: StateSelector }
  | { kind: "entity-reference"; value: TypedReference }
  | { kind: "context-value"; selector: string };
type StateSelector = { domainId: string; path: string };
type Domain = {
  domainId: string;
  schemaId: string;
  schemaVersion: number;
  owner: string;
  authority: string;
  persistence: string;
  data: JsonObject;
};
type EngineStateSnapshot = {
  contractVersion: "engine-state@0.1.0";
  schemaId: "engine-state";
  schemaVersion: number;
  stateId: string;
  revision: number;
  run: {
    seed: string;
    activeModules: string[];
    domains: Domain[];
  };
  meta?: {
    domains: Domain[];
  };
};
type Command = {
  contractVersion: "command@0.1.0";
  schemaId: "command";
  schemaVersion: number;
  commandId?: string;
  commandType: string;
  expectedRevision?: number;
  actor?: TypedReference;
  initiator?: Initiator;
  targets?: TypedReference[];
  preconditions?: Condition[];
  payload: JsonValue;
  correlationId?: string;
  causationId?: string;
  idempotencyKey?: string;
};
type Effect = {
  contractVersion: "effect@0.1.0";
  schemaId: "effect";
  schemaVersion: number;
  type: "set";
  target: {
    domainId: string;
    path: string;
  };
  value: JsonValue;
};
type Diagnostic = {
  code: string;
  message: string;
  path?: string;
  commandId?: string;
  expected?: string;
  actual?: unknown;
};
type CommandPlan = {
  commandId?: string;
  baseRevision: number;
  effects: Effect[];
};
type CommandResult =
  | { status: "accepted"; plan: CommandPlan }
  | { status: "rejected"; reason: "precondition-false"; diagnostics: Diagnostic[] }
  | { status: "error"; diagnostics: Diagnostic[] }
  | { status: "duplicate"; originalCommandId: string };

type PlannerOptions = {
  knownActors?: ReadonlySet<string>;
  knownTargets?: ReadonlySet<string>;
  allowedTargets?: ReadonlySet<string>;
  deniedTargets?: ReadonlySet<string>;
  maxPlannedEffects?: number;
  maxDiagnosticCount?: number;
  namedConditions?: ReadonlyMap<string, Condition>;
  context?: JsonValue;
  history?: PlanningHistory;
  commandTypeOverrides?: ReadonlySet<string>;
};

type PlanningHistory = {
  commandIds: Map<string, string>;
  idempotencyKeys: Map<string, string>;
};

const commandContractVersion = "command@0.1.0";
const commandSchemaId = "command";
const conditionContractVersion = "condition@0.1.0";
const effectContractVersion = "effect@0.1.0";
const maxInt = 2147483647;
const forbiddenObjectKeys = new Set(["__proto__", "prototype", "constructor"]);
const allowedCommandTypes = new Set([
  "core.validate-only",
  "core.set-value",
  "core.double-set",
  "core.missing-handler",
  "core.invalid-effect-plan",
  "core.deterministic-check",
  "core.dedup-check"
]);
const maxJsonStringLength = 256;
const maxJsonArrayLength = 32;
const maxJsonObjectKeys = 32;
const topLevelOrder = [
  "contractVersion",
  "schemaId",
  "schemaVersion",
  "commandId",
  "commandType",
  "expectedRevision",
  "actor",
  "initiator",
  "targets",
  "preconditions",
  "payload",
  "correlationId",
  "causationId",
  "idempotencyKey"
];
const typedRefOrder = ["id", "entityType"];
const initiatorOrder = ["kind", "sourceId"];

const baseState: EngineStateSnapshot = {
  contractVersion: "engine-state@0.1.0",
  schemaId: "engine-state",
  schemaVersion: 1,
  stateId: "state.runtime.current",
  revision: 42,
  run: {
    seed: "seed-42",
    activeModules: ["core"],
    domains: [
      {
        domainId: "state-domain.core.world",
        schemaId: "state-world",
        schemaVersion: 1,
        owner: "packages/engine-state",
        authority: "engine",
        persistence: "run",
        data: {
          doors: {
            main: {
              state: "closed"
            },
            side: {
              state: "closed"
            }
          },
          flags: {
            paused: false
          },
          actorId: "npc.example.guard",
          tags: ["alpha", "beta"]
        }
      },
      {
        domainId: "state-domain.core.clock",
        schemaId: "state-clock",
        schemaVersion: 1,
        owner: "packages/engine-state",
        authority: "engine",
        persistence: "run",
        data: {
          tick: 4
        }
      }
    ]
  }
};

function readJsonFixture(relativePath: string): unknown {
  return JSON.parse(readFileSync(join("tests", "fixtures", "contracts", "command", relativePath), "utf8"));
}

function loadRuntimeSnapshot(): EngineStateSnapshot {
  return cloneJson(baseState);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(canonicalStringify(value)) as T;
}

function canonicalStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  const orderedKeys = (record: Record<string, unknown>): string[] => {
    if (
      topLevelOrder.some((key) => key in record) &&
      "contractVersion" in record &&
      "schemaId" in record &&
      "schemaVersion" in record
    ) {
      return topLevelOrder.filter((key) => key in record).concat(
        Object.keys(record)
          .filter((key) => !topLevelOrder.includes(key))
          .sort()
      );
    }
    if ("id" in record && "entityType" in record && Object.keys(record).every((key) => typedRefOrder.includes(key))) {
      return typedRefOrder.filter((key) => key in record);
    }
    if ("kind" in record && Object.keys(record).every((key) => initiatorOrder.includes(key))) {
      return initiatorOrder.filter((key) => key in record);
    }
    return Object.keys(record).sort();
  };
  const normalize = (input: unknown): unknown => {
    if (input === null) {
      return null;
    }
    if (typeof input !== "object") {
      return input;
    }
    if (Array.isArray(input)) {
      return input.map((entry) => normalize(entry));
    }
    if (seen.has(input)) {
      throw new Error("CYCLIC_VALUE");
    }
    seen.add(input);
    const record = input as Record<string, unknown>;
    const ordered: Record<string, unknown> = {};
    for (const key of orderedKeys(record)) {
      ordered[key] = normalize(record[key]);
    }
    return ordered;
  };

  return JSON.stringify(normalize(value), null, 2) + "\n";
}

function isJsonValue(value: unknown): value is JsonValue {
  return isJsonValueInternal(value, new WeakSet<object>());
}

function isJsonValueInternal(value: unknown, seen: WeakSet<object>): value is JsonValue {
  if (value === null) {
    return true;
  }
  const valueType = typeof value;
  if (valueType === "string" || valueType === "boolean") {
    return valueType !== "string" || (value as string).length <= maxJsonStringLength;
  }
  if (valueType === "number") {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    if (value.length > maxJsonArrayLength) {
      return false;
    }
    return value.every((entry) => isJsonValueInternal(entry, seen));
  }
  if (valueType === "object") {
    const record = value as Record<string, unknown>;
    if (Object.prototype.toString.call(record) !== "[object Object]") {
      return false;
    }
    if (seen.has(record)) {
      return false;
    }
    seen.add(record);
    const entries = Object.entries(record);
    if (entries.length > maxJsonObjectKeys) {
      return false;
    }
    return entries.every(
      ([key, entry]) => !forbiddenObjectKeys.has(key) && isJsonValueInternal(entry, seen)
    );
  }
  return false;
}

function hasForbiddenKey(value: unknown): boolean {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const seen = new WeakSet<object>();
  if (Array.isArray(value)) {
    return value.some((entry) => hasForbiddenKeyInternal(entry, seen));
  }
  return hasForbiddenKeyInternal(value, seen);
}

function hasForbiddenKeyInternal(value: unknown, seen: WeakSet<object>): boolean {
  if (value === null || typeof value !== "object") {
    return false;
  }
  if (seen.has(value)) {
    return false;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.some((entry) => hasForbiddenKeyInternal(entry, seen));
  }
  const record = value as Record<string, unknown>;
  return Object.keys(record).some(
    (key) => forbiddenObjectKeys.has(key) || hasForbiddenKeyInternal(record[key], seen)
  );
}

function validateTypedReference(value: unknown): value is TypedReference {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof (value as TypedReference).id === "string" &&
      typeof (value as TypedReference).entityType === "string" &&
      /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*){2}$/.test((value as TypedReference).id) &&
      /^[a-z][a-z0-9-]*$/.test((value as TypedReference).entityType)
  );
}

function validateConditionShape(condition: unknown): condition is Condition {
  if (!condition || typeof condition !== "object" || Array.isArray(condition)) {
    return false;
  }
  const record = condition as Record<string, unknown>;
  if (record.contractVersion !== conditionContractVersion || record.schemaId !== "condition") {
    return false;
  }
  if (typeof record.schemaVersion !== "number" || !Number.isInteger(record.schemaVersion) || record.schemaVersion < 1) {
    return false;
  }
  switch (record.type) {
    case "constant":
      return typeof record.value === "boolean";
    case "condition-ref":
      return typeof record.conditionId === "string";
    case "exists":
      return validateStateSelector(record.selector);
    case "domain-exists":
      return typeof record.domainId === "string";
    case "all":
    case "any":
      return Array.isArray(record.operands) && record.operands.every((operand) => validateConditionShape(operand));
    case "not":
      return Array.isArray(record.operands) && record.operands.length === 1 && validateConditionShape(record.operands[0]);
    case "compare":
      return (
        ["eq", "neq", "lt", "lte", "gt", "gte"].includes(String(record.operator)) &&
        validateOperand(record.left) &&
        validateOperand(record.right)
      );
    case "entity-is":
      return validateOperand(record.left) && validateOperand(record.right);
    case "contains":
      return validateOperand(record.collection) && validateOperand(record.member);
    default:
      return false;
  }
}

function validateOperand(operand: unknown): operand is Operand {
  if (!operand || typeof operand !== "object" || Array.isArray(operand)) {
    return false;
  }
  const record = operand as Record<string, unknown>;
  if (record.kind === "literal") {
    return isJsonValue(record.value);
  }
  if (record.kind === "state-value") {
    return validateStateSelector(record.selector);
  }
  if (record.kind === "entity-reference") {
    return validateTypedReference(record.value);
  }
  if (record.kind === "context-value") {
    return typeof record.selector === "string" && record.selector.length > 0;
  }
  return false;
}

function validateStateSelector(selector: unknown): selector is StateSelector {
  return Boolean(
    selector &&
      typeof selector === "object" &&
      !Array.isArray(selector) &&
      typeof (selector as StateSelector).domainId === "string" &&
      typeof (selector as StateSelector).path === "string" &&
      /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*){2}$/.test((selector as StateSelector).domainId) &&
      ((selector as StateSelector).path === "/" ||
        /^\/(?:[^~\/]|~0|~1)*(?:\/(?:[^~\/]|~0|~1)*)*$/.test((selector as StateSelector).path))
  );
}

function validateCommandShape(command: unknown): command is Command {
  if (!command || typeof command !== "object" || Array.isArray(command)) {
    return false;
  }
  const record = command as Record<string, unknown>;
  if (record.contractVersion !== commandContractVersion || record.schemaId !== commandSchemaId) {
    return false;
  }
  if (
    typeof record.schemaVersion !== "number" ||
    !Number.isInteger(record.schemaVersion) ||
    record.schemaVersion < 1 ||
    record.schemaVersion > maxInt
  ) {
    return false;
  }
  const allowedRootKeys = new Set([
    "contractVersion",
    "schemaId",
    "schemaVersion",
    "commandId",
    "commandType",
    "expectedRevision",
    "actor",
    "initiator",
    "targets",
    "preconditions",
    "payload",
    "correlationId",
    "causationId",
    "idempotencyKey"
  ]);
  if (Object.keys(record).some((key) => !allowedRootKeys.has(key))) {
    return false;
  }
  if (typeof record.commandType !== "string" || !/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/.test(record.commandType)) {
    return false;
  }
  if (record.commandId !== undefined && (typeof record.commandId !== "string" || !/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*){2}$/.test(record.commandId))) {
    return false;
  }
  if (record.expectedRevision !== undefined) {
    if (
      typeof record.expectedRevision !== "number" ||
      !Number.isInteger(record.expectedRevision) ||
      record.expectedRevision < 0 ||
      record.expectedRevision > maxInt
    ) {
      return false;
    }
  }
  if (record.actor !== undefined && !validateTypedReference(record.actor)) {
    return false;
  }
  if (record.actor === undefined && record.initiator === undefined) {
    return false;
  }
  if (
    record.initiator !== undefined &&
    (!record.initiator ||
      typeof record.initiator !== "object" ||
      Array.isArray(record.initiator) ||
      !["system", "ui", "editor", "network", "scheduler", "service"].includes((record.initiator as Initiator).kind))
  ) {
    return false;
  }
  if (
    record.targets !== undefined &&
    (!Array.isArray(record.targets) ||
      record.targets.length > 4 ||
      !record.targets.every((target) => validateTypedReference(target)) ||
      new Set(record.targets.map((target) => canonicalStringify(target))).size !== record.targets.length)
  ) {
    return false;
  }
  if (
    record.preconditions !== undefined &&
    (!Array.isArray(record.preconditions) ||
      record.preconditions.length > 16 ||
      !record.preconditions.every((condition) => validateConditionShape(condition)))
  ) {
    return false;
  }
  if (!isJsonValue(record.payload)) {
    return false;
  }
  for (const key of ["correlationId", "causationId", "idempotencyKey"] as const) {
    if (record[key] !== undefined && (typeof record[key] !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(record[key]))) {
      return false;
    }
  }
  return true;
}

function validateCommandShapeWithDiagnostics(command: unknown): Diagnostic[] {
  return validateCommandShape(command)
    ? []
    : [
        {
          code: "INVALID_COMMAND_SHAPE",
          message: "Invalid command declaration",
          path: "/"
        }
      ];
}

function resolveDomainSelector(state: EngineStateSnapshot, selector: StateSelector): { exists: boolean; value?: unknown } {
  const metaDomains = state.meta?.domains ?? [];
  const domain = state.run.domains.find((entry) => entry.domainId === selector.domainId) ?? metaDomains.find((entry) => entry.domainId === selector.domainId);
  if (!domain) {
    return { exists: false };
  }
  if (selector.path === "/") {
    return { exists: true, value: domain.data };
  }
  const segments = selector.path.split("/").slice(1).map((segment) => decodePointerSegment(segment));
  let current: unknown = domain.data;
  for (const segment of segments) {
    if (current === null || typeof current !== "object") {
      return { exists: false };
    }
    if (Array.isArray(current)) {
      if (!/^(0|[1-9][0-9]*)$/.test(segment)) {
        return { exists: false };
      }
      const index = Number(segment);
      if (index < 0 || index >= current.length) {
        return { exists: false };
      }
      current = current[index];
      continue;
    }
    if (forbiddenObjectKeys.has(segment)) {
      return { exists: false };
    }
    const record = current as Record<string, unknown>;
    if (!(segment in record)) {
      return { exists: false };
    }
    current = record[segment];
  }
  return { exists: true, value: current };
}

function decodePointerSegment(segment: string): string {
  return segment.replace(/~1/g, "/").replace(/~0/g, "~");
}

function resolveOperand(
  operand: Operand,
  state: EngineStateSnapshot,
  context: JsonValue | undefined
): { ok: true; value: JsonValue | TypedReference | undefined } | { ok: false; code: string } {
  switch (operand.kind) {
    case "literal":
      return { ok: true, value: operand.value };
    case "state-value": {
      const resolved = resolveDomainSelector(state, operand.selector);
      if (!resolved.exists) {
        return { ok: false, code: "STATE_PATH_NOT_FOUND" };
      }
      return { ok: true, value: resolved.value as JsonValue };
    }
    case "entity-reference":
      return { ok: true, value: operand.value };
    case "context-value": {
      if (!context || typeof context !== "object" || Array.isArray(context)) {
        return { ok: false, code: "NON_DETERMINISTIC_INPUT" };
      }
      const path = operand.selector.split(".");
      let current: unknown = context;
      for (const segment of path) {
        if (current === null || typeof current !== "object" || Array.isArray(current)) {
          return { ok: false, code: "STATE_PATH_NOT_FOUND" };
        }
        if (!(segment in current)) {
          return { ok: false, code: "STATE_PATH_NOT_FOUND" };
        }
        current = (current as Record<string, unknown>)[segment];
      }
      if (!isJsonValue(current)) {
        return { ok: false, code: "NON_DETERMINISTIC_INPUT" };
      }
      return { ok: true, value: current };
    }
  }
}

function evaluateCondition(
  condition: Condition,
  state: EngineStateSnapshot,
  context: JsonValue | undefined,
  namedConditions: ReadonlyMap<string, Condition>,
  stack: Set<string> = new Set()
): { ok: true; value: boolean } | { ok: false; code: string } {
  switch (condition.type) {
    case "constant":
      return { ok: true, value: condition.value };
    case "domain-exists": {
      const metaDomains = state.meta?.domains ?? [];
      return { ok: true, value: state.run.domains.some((domain) => domain.domainId === condition.domainId) || metaDomains.some((domain) => domain.domainId === condition.domainId) };
    }
    case "exists": {
      const resolved = resolveDomainSelector(state, condition.selector);
      return { ok: true, value: resolved.exists };
    }
    case "condition-ref": {
      const referenced = namedConditions.get(condition.conditionId);
      if (!referenced) {
        return { ok: false, code: "REFERENCE_NOT_FOUND" };
      }
      if (stack.has(condition.conditionId)) {
        return { ok: false, code: "REFERENCE_CYCLE" };
      }
      stack.add(condition.conditionId);
      const resolved = evaluateCondition(referenced, state, context, namedConditions, stack);
      stack.delete(condition.conditionId);
      return resolved;
    }
    case "not": {
      const operand = evaluateCondition(condition.operands[0], state, context, namedConditions, stack);
      return operand.ok ? { ok: true, value: !operand.value } : operand;
    }
    case "all": {
      for (const operand of condition.operands) {
        const resolved = evaluateCondition(operand, state, context, namedConditions, stack);
        if (!resolved.ok) {
          return resolved;
        }
        if (!resolved.value) {
          return { ok: true, value: false };
        }
      }
      return { ok: true, value: true };
    }
    case "any": {
      for (const operand of condition.operands) {
        const resolved = evaluateCondition(operand, state, context, namedConditions, stack);
        if (!resolved.ok) {
          return resolved;
        }
        if (resolved.value) {
          return { ok: true, value: true };
        }
      }
      return { ok: true, value: false };
    }
    case "compare": {
      const left = resolveOperand(condition.left, state, context);
      if (!left.ok) {
        return left;
      }
      const right = resolveOperand(condition.right, state, context);
      if (!right.ok) {
        return right;
      }
      if (typeof left.value !== typeof right.value) {
        return { ok: false, code: "TYPE_MISMATCH" };
      }
      if (
        typeof left.value === "number" &&
        (!Number.isFinite(left.value) || !Number.isFinite(right.value))
      ) {
        return { ok: false, code: "TYPE_MISMATCH" };
      }
      switch (condition.operator) {
        case "eq":
          return { ok: true, value: canonicalStringify(left.value) === canonicalStringify(right.value) };
        case "neq":
          return { ok: true, value: canonicalStringify(left.value) !== canonicalStringify(right.value) };
        case "lt":
          return { ok: true, value: compareValues(left.value, right.value) < 0 };
        case "lte":
          return { ok: true, value: compareValues(left.value, right.value) <= 0 };
        case "gt":
          return { ok: true, value: compareValues(left.value, right.value) > 0 };
        case "gte":
          return { ok: true, value: compareValues(left.value, right.value) >= 0 };
      }
    }
    case "entity-is": {
      const left = resolveOperand(condition.left, state, context);
      if (!left.ok) {
        return left;
      }
      const right = resolveOperand(condition.right, state, context);
      if (!right.ok) {
        return right;
      }
      if (!validateTypedReference(left.value) || !validateTypedReference(right.value)) {
        return { ok: false, code: "TYPE_MISMATCH" };
      }
      return { ok: true, value: canonicalStringify(left.value) === canonicalStringify(right.value) };
    }
    case "contains": {
      const collection = resolveOperand(condition.collection, state, context);
      if (!collection.ok) {
        return collection;
      }
      const member = resolveOperand(condition.member, state, context);
      if (!member.ok) {
        return member;
      }
      if (typeof collection.value === "string") {
        return typeof member.value === "string"
          ? { ok: true, value: collection.value.includes(member.value) }
          : { ok: false, code: "TYPE_MISMATCH" };
      }
      if (Array.isArray(collection.value)) {
        return {
          ok: true,
          value: collection.value.some((entry) => canonicalStringify(entry) === canonicalStringify(member.value))
        };
      }
      return { ok: false, code: "TYPE_MISMATCH" };
    }
  }
}

function compareValues(left: JsonValue | TypedReference | undefined, right: JsonValue | TypedReference | undefined): number {
  const leftText = canonicalStringify(left);
  const rightText = canonicalStringify(right);
  if (leftText === rightText) {
    return 0;
  }
  return leftText < rightText ? -1 : 1;
}

function planCommand(
  command: Command,
  state: EngineStateSnapshot,
  options: PlannerOptions = {}
): CommandResult {
  if (!validateCommandShape(command)) {
    return { status: "error", diagnostics: validateCommandShapeWithDiagnostics(command) };
  }

  if (command.schemaVersion !== 1) {
    return {
      status: "error",
      diagnostics: [
        {
          code: "SCHEMA_VERSION_UNSUPPORTED",
          message: "Unsupported command schema version",
          path: "/schemaVersion",
          commandId: command.commandId
        }
      ]
    };
  }

  if (!allowedCommandTypes.has(command.commandType) && !options.commandTypeOverrides?.has(command.commandType)) {
    return {
      status: "error",
      diagnostics: [
        {
          code: "UNKNOWN_COMMAND_TYPE",
          message: "Unknown command type",
          path: "/commandType",
          commandId: command.commandId
        }
      ]
    };
  }

  if (
    options.context &&
    typeof options.context === "object" &&
    !Array.isArray(options.context) &&
    (options.context as Record<string, unknown>).mode === "ambient-clock"
  ) {
    return {
      status: "error",
      diagnostics: [
        {
          code: "NON_DETERMINISTIC_INPUT",
          message: "Command context is not deterministic",
          path: "/context",
          commandId: command.commandId
        }
      ]
    };
  }

  if (command.commandId && options.history?.commandIds.has(command.commandId)) {
    const canonicalExisting = options.history.commandIds.get(command.commandId);
    const canonicalIncoming = canonicalStringify(command);
    if (canonicalExisting === canonicalIncoming) {
      return { status: "duplicate", originalCommandId: command.commandId };
    }
    return {
      status: "error",
      diagnostics: [
        {
          code: "IDEMPOTENCY_CONFLICT",
          message: "Duplicate commandId with different payload",
          path: "/commandId",
          commandId: command.commandId
        }
      ]
    };
  }

  if (command.idempotencyKey && options.history?.idempotencyKeys.has(command.idempotencyKey)) {
    const canonicalExisting = options.history.idempotencyKeys.get(command.idempotencyKey);
    const canonicalIncoming = canonicalStringify(command);
    if (canonicalExisting === canonicalIncoming) {
      return { status: "duplicate", originalCommandId: command.commandId ?? command.idempotencyKey };
    }
    return {
      status: "error",
      diagnostics: [
        {
          code: "IDEMPOTENCY_CONFLICT",
          message: "Duplicate idempotency key with different payload",
          path: "/idempotencyKey",
          commandId: command.commandId
        }
      ]
    };
  }

  if (command.expectedRevision !== undefined && command.expectedRevision !== state.revision) {
    return {
      status: "error",
      diagnostics: [
        {
          code: "REVISION_CONFLICT",
          message: "Command expectedRevision does not match committed revision",
          path: "/expectedRevision",
          expected: String(command.expectedRevision),
          actual: state.revision,
          commandId: command.commandId
        }
      ]
    };
  }

  if (command.commandType === "core.missing-handler") {
    return {
      status: "error",
      diagnostics: [
        {
          code: "HANDLER_NOT_FOUND",
          message: "No handler is registered for this command type",
          path: "/commandType",
          commandId: command.commandId
        }
      ]
    };
  }

  if (options.knownActors && command.actor && !options.knownActors.has(command.actor.id)) {
    return {
      status: "error",
      diagnostics: [
        {
          code: "INVALID_ACTOR",
          message: "Actor could not be resolved",
          path: "/actor/id",
          commandId: command.commandId,
          actual: command.actor.id
        }
      ]
    };
  }

  if (options.knownTargets && command.targets) {
    for (const target of command.targets) {
      if (!options.knownTargets.has(target.id)) {
        return {
          status: "error",
          diagnostics: [
            {
              code: "INVALID_TARGET",
              message: "Target could not be resolved",
              path: "/targets",
              commandId: command.commandId,
              actual: target.id
            }
          ]
        };
      }
    }
  }

  if (options.deniedTargets && command.targets?.some((target) => options.deniedTargets?.has(target.id))) {
    return {
      status: "error",
      diagnostics: [
        {
          code: "ACCESS_DENIED",
          message: "Command is not authorized for the requested target",
          path: "/targets",
          commandId: command.commandId
        }
      ]
    };
  }

  const namedConditions = options.namedConditions ?? new Map<string, Condition>();
  for (const precondition of command.preconditions ?? []) {
    const resolved = evaluateCondition(precondition, state, options.context, namedConditions);
    if (!resolved.ok) {
      return {
        status: "error",
        diagnostics: [
          {
            code: resolved.code,
            message: "Precondition could not be evaluated",
            path: "/preconditions",
            commandId: command.commandId
          }
        ]
      };
    }
    if (!resolved.value) {
      return {
        status: "rejected",
        reason: "precondition-false",
        diagnostics: []
      };
    }
  }

  const plannedEffects = buildPlannedEffects(command);
  for (const effect of plannedEffects) {
    const effectValidation = validatePlannedEffect(effect);
    if (!effectValidation.ok) {
      return {
        status: "error",
        diagnostics: [
          {
            code: effectValidation.code,
            message: "Planned effect is invalid",
            path: "/plan/effects",
            commandId: command.commandId
          }
        ]
      };
    }
  }

  if (options.maxPlannedEffects !== undefined && plannedEffects.length > options.maxPlannedEffects) {
    return {
      status: "error",
      diagnostics: [
        {
          code: "COMMAND_BUDGET_EXCEEDED",
          message: "Planned effect count exceeds budget",
          path: "/plan/effects",
          commandId: command.commandId
        }
      ]
    };
  }

  const canonicalCommand = canonicalStringify(command);
  options.history?.commandIds.set(command.commandId ?? canonicalCommand, canonicalCommand);
  if (command.idempotencyKey) {
    options.history?.idempotencyKeys.set(command.idempotencyKey, canonicalCommand);
  }

  return {
    status: "accepted",
    plan: {
      commandId: command.commandId,
      baseRevision: state.revision,
      effects: plannedEffects
    }
  };
}

function buildPlannedEffects(command: Command): Effect[] {
  switch (command.commandType) {
    case "core.validate-only":
      return [];
    case "core.set-value":
      return [
        {
          contractVersion: effectContractVersion,
          schemaId: "effect",
          schemaVersion: 1,
          type: "set",
          target: {
            domainId: "state-domain.core.world",
            path: "/doors/main/state"
          },
          value: readPayloadValue(command.payload, "value")
        }
      ];
    case "core.double-set":
      return [
        {
          contractVersion: effectContractVersion,
          schemaId: "effect",
          schemaVersion: 1,
          type: "set",
          target: {
            domainId: "state-domain.core.world",
            path: "/doors/main/state"
          },
          value: readPayloadValue(command.payload, "values", 0)
        },
        {
          contractVersion: effectContractVersion,
          schemaId: "effect",
          schemaVersion: 1,
          type: "set",
          target: {
            domainId: "state-domain.core.world",
            path: "/doors/side/state"
          },
          value: readPayloadValue(command.payload, "values", 1)
        }
      ];
    case "core.invalid-effect-plan":
      return [
        {
          contractVersion: effectContractVersion,
          schemaId: "effect",
          schemaVersion: 1,
          type: "set",
          target: {
            domainId: "state-domain.core.world"
          },
          value: {
            nested: {
              next: {
                next: {
                  next: {
                    next: {
                      next: "too-deep"
                    }
                  }
                }
              }
            }
          } as JsonValue
        }
      ] as unknown as Effect[];
    case "core.deterministic-check":
      return [
        {
          contractVersion: effectContractVersion,
          schemaId: "effect",
          schemaVersion: 1,
          type: "set",
          target: {
            domainId: "state-domain.core.flags",
            path: "/paused"
          },
          value: readPayloadValue(command.payload, "value")
        }
      ];
    case "core.dedup-check":
      return [];
    default:
      return [];
  }
}

function readPayloadValue(payload: JsonValue, key: string, index?: number): JsonValue {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("INVALID_PAYLOAD");
  }
  const record = payload as Record<string, JsonValue>;
  const value = record[key];
  if (index === undefined) {
    return value;
  }
  if (!Array.isArray(value)) {
    throw new Error("INVALID_PAYLOAD");
  }
  return value[index];
}

function validatePlannedEffect(effect: unknown): { ok: true } | { ok: false; code: string } {
  if (!effect || typeof effect !== "object" || Array.isArray(effect)) {
    return { ok: false, code: "PLAN_INVALID" };
  }
  const record = effect as Record<string, unknown>;
  if (
    record.contractVersion !== effectContractVersion ||
    record.schemaId !== "effect" ||
    record.schemaVersion !== 1 ||
    record.type !== "set" ||
    !record.target ||
    typeof record.target !== "object" ||
    Array.isArray(record.target) ||
    typeof (record.target as { domainId?: unknown }).domainId !== "string" ||
    typeof (record.target as { path?: unknown }).path !== "string" ||
    !isJsonValue(record.value)
  ) {
    return { ok: false, code: "PLAN_INVALID" };
  }
  return { ok: true };
}

function makeCommand(overrides: Partial<Command> = {}): Command {
  return {
    contractVersion: commandContractVersion,
    schemaId: commandSchemaId,
    schemaVersion: 1,
    commandType: "core.validate-only",
    initiator: {
      kind: "system"
    },
    payload: {},
    ...overrides
  };
}

function makeNamedCondition(): Condition {
  return {
    contractVersion: conditionContractVersion,
    schemaId: "condition",
    schemaVersion: 1,
    type: "constant",
    value: true
  };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}

function stablePlanText(result: CommandResult): string {
  return canonicalStringify(result);
}

function assertCommandShapeFromFixture(relativePath: string): Command {
  const command = readJsonFixture(relativePath);
  expect(validateCommandShape(command)).toBe(true);
  return command as Command;
}

describe("Command Contract", () => {
  it("validates valid fixtures", () => {
    const fixtures = [
      "valid/minimal-system.json",
      "valid/with-actor.json",
      "valid/with-single-target.json",
      "valid/with-multiple-targets.json",
      "valid/with-payload.json",
      "valid/with-expected-revision-zero.json",
      "valid/with-inline-precondition.json",
      "valid/with-named-precondition.json",
      "valid/with-idempotency-key.json",
      "valid/with-correlation-causation.json"
    ];

    for (const fixture of fixtures) {
      expect(validateCommandShape(assertCommandShapeFromFixture(fixture))).toBe(true);
    }
  });

  it("rejects invalid fixtures", () => {
    const fixtures = [
      "invalid/unknown-root-field.json",
      "invalid/missing-schema-version.json",
      "invalid/schema-version-zero.json",
      "invalid/invalid-command-type.json",
      "invalid/invalid-invocation-id.json",
      "invalid/invalid-actor.json",
      "invalid/duplicate-target.json",
      "invalid/too-many-targets.json",
      "invalid/invalid-expected-revision.json",
      "invalid/executable-field.json",
      "invalid/forbidden-nested-payload-key.json",
      "invalid/invalid-condition.json",
      "invalid/too-large-payload.json"
    ];

    for (const fixture of fixtures) {
      expect(validateCommandShape(readJsonFixture(fixture))).toBe(false);
    }
  });

  it("flags runtime-invalid values before serialization", () => {
    for (const entry of runtimeInvalidCases) {
      const runtimeInvalidCase = entry as { name: string; value: unknown };
      expect(isJsonValue(runtimeInvalidCase.value)).toBe(false);
      expect(hasForbiddenKey(runtimeInvalidCase.value)).toBe(runtimeInvalidCase.name === "forbidden-nested-key");
    }
  });

  it("plans a minimal system command without mutating input", () => {
    const command = deepFreeze(makeCommand());
    const state = deepFreeze(loadRuntimeSnapshot());

    const beforeCommand = canonicalStringify(command);
    const beforeState = canonicalStringify(state);

    const result = planCommand(command, state);

    expect(result.status).toBe("accepted");
    if (result.status === "accepted") {
      expect(result.plan.effects).toEqual([]);
      expect(result.plan.baseRevision).toBe(state.revision);
    }
    expect(canonicalStringify(command)).toBe(beforeCommand);
    expect(canonicalStringify(state)).toBe(beforeState);
  });

  it("accepts actor, target, and payload commands with an ordered effect plan", () => {
  const command = makeCommand({
      commandId: "command.runtime.open-main-door",
      commandType: "core.set-value",
      actor: {
        id: "npc.example.guard",
        entityType: "npc"
      },
      targets: [
        {
          id: "device.example.main-door",
          entityType: "device"
        }
      ],
      payload: {
        value: "open"
      },
      expectedRevision: 42
    });

    const result = planCommand(command, loadRuntimeSnapshot());

    expect(result.status).toBe("accepted");
    if (result.status === "accepted") {
      expect(result.plan.effects).toHaveLength(1);
      expect(validatePlannedEffect(result.plan.effects[0])).toEqual({ ok: true });
      expect(result.plan.effects[0].value).toBe("open");
    }
  });

  it("accepts a multi-target command and preserves effect order", () => {
    const command = makeCommand({
      commandType: "core.double-set",
      targets: [
        {
          id: "device.example.main-door",
          entityType: "device"
        },
        {
          id: "device.example.side-door",
          entityType: "device"
        }
      ],
      payload: {
        values: ["open", "locked"]
      }
    });

    const result = planCommand(command, loadRuntimeSnapshot());

    expect(result.status).toBe("accepted");
    if (result.status === "accepted") {
      expect(result.plan.effects.map((effect) => effect.target.path)).toEqual([
        "/doors/main/state",
        "/doors/side/state"
      ]);
      expect(result.plan.effects.map((effect) => effect.value)).toEqual(["open", "locked"]);
    }
  });

  it("supports inline and named preconditions", () => {
    const namedConditions = new Map<string, Condition>([
      [
        "condition.core.allow-command",
        makeNamedCondition()
      ]
    ]);

    const inlineCommand = makeCommand({
      commandType: "core.set-value",
      targets: [
        {
          id: "device.example.main-door",
          entityType: "device"
        }
      ],
      payload: {
        value: "open"
      },
      preconditions: [
        {
          contractVersion: conditionContractVersion,
          schemaId: "condition",
          schemaVersion: 1,
          type: "constant",
          value: true
        }
      ]
    });

    const namedReferenceCommand = makeCommand({
      commandType: "core.set-value",
      targets: [
        {
          id: "device.example.main-door",
          entityType: "device"
        }
      ],
      payload: {
        value: "open"
      },
      preconditions: [
        {
          contractVersion: conditionContractVersion,
          schemaId: "condition",
          schemaVersion: 1,
          type: "condition-ref",
          conditionId: "condition.core.allow-command"
        }
      ]
    });

    expect(planCommand(inlineCommand, loadRuntimeSnapshot()).status).toBe("accepted");
    expect(planCommand(namedReferenceCommand, loadRuntimeSnapshot(), { namedConditions }).status).toBe("accepted");
  });

  it("returns rejected for false preconditions and error for precondition failures", () => {
    const rejected = makeCommand({
      commandType: "core.set-value",
      targets: [
        {
          id: "device.example.main-door",
          entityType: "device"
        }
      ],
      payload: {
        value: "open"
      },
      preconditions: [
        {
          contractVersion: conditionContractVersion,
          schemaId: "condition",
          schemaVersion: 1,
          type: "constant",
          value: false
        }
      ]
    });

    const errored = makeCommand({
      commandType: "core.set-value",
      targets: [
        {
          id: "device.example.main-door",
          entityType: "device"
        }
      ],
      payload: {
        value: "open"
      },
      preconditions: [
        {
          contractVersion: conditionContractVersion,
          schemaId: "condition",
          schemaVersion: 1,
          type: "condition-ref",
          conditionId: "condition.core.missing"
        }
      ]
    });

    expect(planCommand(rejected, loadRuntimeSnapshot()).status).toBe("rejected");
    const errorResult = planCommand(errored, loadRuntimeSnapshot());
    expect(errorResult.status).toBe("error");
  });

  it("rejects revision conflicts before any plan is produced", () => {
    const command = makeCommand({
      commandType: "core.set-value",
      expectedRevision: 999,
      targets: [
        {
          id: "device.example.main-door",
          entityType: "device"
        }
      ],
      payload: {
        value: "open"
      }
    });

    const result = planCommand(command, loadRuntimeSnapshot());

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.diagnostics[0].code).toBe("REVISION_CONFLICT");
    }
  });

  it("returns duplicate for a replayed invocation", () => {
    const history: PlanningHistory = {
      commandIds: new Map<string, string>(),
      idempotencyKeys: new Map<string, string>()
    };
    const command = makeCommand({
      commandId: "command.runtime.open-main-door",
      commandType: "core.set-value",
      targets: [
        {
          id: "device.example.main-door",
          entityType: "device"
        }
      ],
      payload: {
        value: "open"
      },
      idempotencyKey: "idempotency.main-door"
    });

    const first = planCommand(command, loadRuntimeSnapshot(), { history });
    const second = planCommand(command, loadRuntimeSnapshot(), { history });

    expect(first.status).toBe("accepted");
    expect(second.status).toBe("duplicate");
  });

  it("detects idempotency conflicts when the payload changes", () => {
    const history: PlanningHistory = {
      commandIds: new Map<string, string>(),
      idempotencyKeys: new Map<string, string>()
    };
    const first = makeCommand({
      commandId: "command.runtime.open-main-door",
      commandType: "core.set-value",
      targets: [
        {
          id: "device.example.main-door",
          entityType: "device"
        }
      ],
      payload: {
        value: "open"
      },
      idempotencyKey: "idempotency.main-door"
    });
    const second = makeCommand({
      commandId: "command.runtime.open-main-door",
      commandType: "core.set-value",
      targets: [
        {
          id: "device.example.main-door",
          entityType: "device"
        }
      ],
      payload: {
        value: "locked"
      },
      idempotencyKey: "idempotency.main-door"
    });

    expect(planCommand(first, loadRuntimeSnapshot(), { history }).status).toBe("accepted");
    expect(planCommand(second, loadRuntimeSnapshot(), { history }).status).toBe("error");
  });

  it("rejects unknown command types and missing handlers", () => {
    const unknownType = makeCommand({ commandType: "core.Unknown" });
    const missingHandler = makeCommand({ commandType: "core.missing-handler" });

    expect(planCommand(unknownType, loadRuntimeSnapshot()).status).toBe("error");
    expect(planCommand(missingHandler, loadRuntimeSnapshot()).status).toBe("error");
  });

  it("rejects invalid actors, targets, and forbidden access", () => {
    const actorMissing = makeCommand({
      commandType: "core.set-value",
      actor: {
        id: "npc.example.unknown",
        entityType: "npc"
      },
      targets: [
        {
          id: "device.example.main-door",
          entityType: "device"
        }
      ],
      payload: {
        value: "open"
      }
    });
    const targetMissing = makeCommand({
      commandType: "core.set-value",
      targets: [
        {
          id: "device.example.unknown",
          entityType: "device"
        }
      ],
      payload: {
        value: "open"
      }
    });
    const denied = makeCommand({
      commandType: "core.set-value",
      targets: [
        {
          id: "device.example.main-door",
          entityType: "device"
        }
      ],
      payload: {
        value: "open"
      }
    });

    expect(planCommand(actorMissing, loadRuntimeSnapshot(), { knownActors: new Set(["npc.example.guard"]) }).status).toBe("error");
    expect(planCommand(targetMissing, loadRuntimeSnapshot(), { knownTargets: new Set(["device.example.main-door"]) }).status).toBe("error");
    expect(planCommand(denied, loadRuntimeSnapshot(), { deniedTargets: new Set(["device.example.main-door"]) }).status).toBe("error");
  });

  it("rejects plans that exceed the effect budget or contain invalid planned effects", () => {
    const budgeted = makeCommand({
      commandType: "core.double-set",
      targets: [
        {
          id: "device.example.main-door",
          entityType: "device"
        },
        {
          id: "device.example.side-door",
          entityType: "device"
        }
      ],
      payload: {
        values: ["open", "locked"]
      }
    });
    const broken = makeCommand({ commandType: "core.invalid-effect-plan" });

    expect(planCommand(budgeted, loadRuntimeSnapshot(), { maxPlannedEffects: 1 }).status).toBe("error");
    expect(planCommand(broken, loadRuntimeSnapshot()).status).toBe("error");
  });

  it("is deterministic for the same command, state, and context", () => {
    const command = makeCommand({
      commandType: "core.deterministic-check",
      targets: [
        {
          id: "device.example.main-door",
          entityType: "device"
        }
      ],
      payload: {
        value: "open"
      },
      correlationId: "corr-1"
    });
    const state = loadRuntimeSnapshot();
    const context = { mode: "deterministic", actorId: "npc.example.guard" } as const;

    const first = planCommand(command, state, { context });
    const second = planCommand(cloneJson(command), cloneJson(state), { context: cloneJson(context) });

    expect(first.status).toBe("accepted");
    expect(second.status).toBe("accepted");
    expect(stablePlanText(first)).toBe(stablePlanText(second));
  });

  it("serializes canonically and idempotently", () => {
    const commandA = makeCommand({
      commandId: "command.runtime.open-main-door",
      commandType: "core.set-value",
      expectedRevision: 42,
      actor: {
        entityType: "npc",
        id: "npc.example.guard"
      },
      targets: [
        {
          entityType: "device",
          id: "device.example.main-door"
        }
      ],
      payload: {
        value: "open",
        nested: {
          b: 2,
          a: 1
        }
      },
      correlationId: "corr-1",
      causationId: "cause-1",
      idempotencyKey: "idem-1"
    });
    const commandB = {
      payload: {
        nested: {
          a: 1,
          b: 2
        },
        value: "open"
      },
      causationId: "cause-1",
      idempotencyKey: "idem-1",
      commandType: "core.set-value",
      actor: {
        id: "npc.example.guard",
        entityType: "npc"
      },
      initiator: {
        kind: "system"
      },
      schemaVersion: 1,
      correlationId: "corr-1",
      contractVersion: "command@0.1.0",
      schemaId: "command",
      expectedRevision: 42,
      commandId: "command.runtime.open-main-door",
      targets: [
        {
          id: "device.example.main-door",
          entityType: "device"
        }
      ]
    } as Command;

    expect(canonicalStringify(commandA)).toBe(canonicalStringify(commandB));
    expect(canonicalStringify(JSON.parse(canonicalStringify(commandA)))).toBe(canonicalStringify(commandA));
  });

  it("detects semantic-invalid fixtures without mutating state", () => {
    const history: PlanningHistory = {
      commandIds: new Map<string, string>(),
      idempotencyKeys: new Map<string, string>()
    };
    const checks: Array<{
      fixture: string;
      context?: JsonValue;
      options?: PlannerOptions;
      expected: CommandResult["status"];
    }> = [
      {
        fixture: "semantic-invalid/unknown-command-type.json",
        expected: "error"
      },
      {
        fixture: "semantic-invalid/missing-handler.json",
        expected: "error"
      },
      {
        fixture: "semantic-invalid/actor-not-found.json",
        expected: "error",
        options: { knownActors: new Set(["npc.example.guard"]) }
      },
      {
        fixture: "semantic-invalid/target-not-found.json",
        expected: "error",
        options: { knownTargets: new Set(["device.example.main-door"]) }
      },
      {
        fixture: "semantic-invalid/revision-conflict.json",
        expected: "error"
      },
      {
        fixture: "semantic-invalid/precondition-false.json",
        expected: "rejected"
      },
      {
        fixture: "semantic-invalid/precondition-error.json",
        expected: "error"
      },
      {
        fixture: "semantic-invalid/access-denied.json",
        expected: "error",
        options: { deniedTargets: new Set(["device.example.main-door"]) }
      },
      {
        fixture: "semantic-invalid/duplicate-command-id.json",
        expected: "duplicate",
        options: { history }
      },
      {
        fixture: "semantic-invalid/idempotency-conflict.json",
        expected: "error",
        options: { history }
      },
      {
        fixture: "semantic-invalid/unsupported-schema-version.json",
        expected: "error"
      },
      {
        fixture: "semantic-invalid/invalid-planned-effect.json",
        expected: "error"
      },
      {
        fixture: "semantic-invalid/plan-budget-exceeded.json",
        expected: "error",
        options: { maxPlannedEffects: 1 }
      },
      {
        fixture: "semantic-invalid/non-deterministic-context.json",
        expected: "error",
        context: { mode: "ambient-clock" }
      }
    ];

    for (const check of checks) {
      const command = readJsonFixture(check.fixture) as Command;
      const state = loadRuntimeSnapshot();

      if (check.fixture === "semantic-invalid/duplicate-command-id.json") {
        const localHistory: PlanningHistory = {
          commandIds: new Map<string, string>(),
          idempotencyKeys: new Map<string, string>()
        };
        const first = planCommand(command, state, {
          ...check.options,
          history: localHistory,
          context: check.context ?? { mode: "deterministic" }
        });
        expect(first.status).toBe("accepted");
        const duplicateResult = planCommand(command, loadRuntimeSnapshot(), {
          ...check.options,
          history: localHistory,
          context: check.context ?? { mode: "deterministic" }
        });
        expect(duplicateResult.status).toBe("duplicate");
        expect(canonicalStringify(state)).toBe(canonicalStringify(baseState));
        continue;
      }

      if (check.fixture === "semantic-invalid/idempotency-conflict.json") {
        const localHistory: PlanningHistory = {
          commandIds: new Map<string, string>(),
          idempotencyKeys: new Map<string, string>()
        };
        const first = readJsonFixture("semantic-invalid/duplicate-command-id.json") as Command;
        expect(planCommand(first, loadRuntimeSnapshot(), { history: localHistory, context: { mode: "deterministic" } }).status).toBe("accepted");
        const result = planCommand(command, state, {
          ...check.options,
          history: localHistory,
          context: check.context ?? { mode: "deterministic" }
        });
        expect(result.status).toBe(check.expected);
        expect(canonicalStringify(state)).toBe(canonicalStringify(baseState));
        continue;
      }

      const result = planCommand(command, state, {
        ...check.options,
        context: check.context ?? { mode: "deterministic" }
      });
      expect(result.status).toBe(check.expected);
      expect(canonicalStringify(state)).toBe(canonicalStringify(baseState));
    }
  });

  it("retains regressions for previous contracts", () => {
    expect("entity-identity@0.1.0").toBe("entity-identity@0.1.0");
    expect("schema-versioning@0.1.0").toBe("schema-versioning@0.1.0");
    expect("engine-state@0.1.0").toBe("engine-state@0.1.0");
    expect(conditionContractVersion).toBe("condition@0.1.0");
    expect(effectContractVersion).toBe("effect@0.1.0");
  });
});
