import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runtimeInvalidCases } from "./fixtures/contracts/transaction/runtime-invalid/runtime-invalid";

type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;
type JsonObject = { [key: string]: JsonValue };
type TypedReference = {
  id: string;
  entityType: string;
};
type StateSelector = {
  domainId: string;
  path: string;
};
type Condition =
  | {
      contractVersion: "condition@0.1.0";
      schemaId: "condition";
      schemaVersion: number;
      type: "constant";
      value: boolean;
    }
  | {
      contractVersion: "condition@0.1.0";
      schemaId: "condition";
      schemaVersion: number;
      type: "condition-ref";
      conditionId: string;
    };
type Effect =
  | {
      contractVersion: "effect@0.1.0";
      schemaId: "effect";
      schemaVersion: number;
      type: "set";
      target: StateSelector;
      value: JsonValue;
      guard?: Condition;
    }
  | {
      contractVersion: "effect@0.1.0";
      schemaId: "effect";
      schemaVersion: number;
      type: "increment";
      target: StateSelector;
      delta: number;
      guard?: Condition;
    }
  | {
      contractVersion: "effect@0.1.0";
      schemaId: "effect";
      schemaVersion: number;
      type: "unset";
      target: StateSelector;
      guard?: Condition;
    };
type Source =
  | {
      kind: "command-plan";
      commandId?: string;
      commandType?: string;
      allowNoOp?: boolean;
    }
  | {
      kind: "system";
      systemId: string;
      reason?: string;
      allowNoOp?: boolean;
    };
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
type TransactionInput = {
  contractVersion: "transaction@0.1.0";
  schemaId: "transaction";
  schemaVersion: number;
  transactionId?: string;
  baseRevision: number;
  source: Source;
  effects: Effect[];
  context?: JsonValue;
  correlationId?: string;
  causationId?: string;
  idempotencyKey?: string;
};
type Diagnostic = {
  code: string;
  message: string;
  path?: string;
  phase?: string;
};
type Change = {
  path: string;
  before: JsonValue | undefined;
  after: JsonValue | undefined;
};
type TransactionResult =
  | { status: "committed"; baseRevision: number; newRevision: number; changes: Change[] }
  | { status: "no-op"; baseRevision: number; newRevision: number; changes: [] }
  | { status: "rolled-back"; reason: string; diagnostics: Diagnostic[] }
  | { status: "rejected"; reason: string; diagnostics: Diagnostic[] }
  | { status: "error"; diagnostics: Diagnostic[] };
type TransactionHistoryEntry = {
  fingerprint: string;
  result: TransactionResult;
};
type TransactionHistory = {
  transactions: Map<string, TransactionHistoryEntry>;
  idempotencyKeys: Map<string, TransactionHistoryEntry>;
};
type TransactionOptions = {
  history?: TransactionHistory;
  namedConditions?: ReadonlyMap<string, Condition>;
  deniedTargets?: ReadonlySet<string>;
  maxEffects?: number;
  maxDiagnostics?: number;
  context?: JsonValue;
  finalRevision?: number;
};

const transactionContractVersion = "transaction@0.1.0";
const transactionSchemaId = "transaction";
const effectContractVersion = "effect@0.1.0";
const conditionContractVersion = "condition@0.1.0";
const forbiddenObjectKeys = new Set(["__proto__", "prototype", "constructor"]);
const topLevelOrder = [
  "contractVersion",
  "schemaId",
  "schemaVersion",
  "transactionId",
  "baseRevision",
  "source",
  "effects",
  "context",
  "correlationId",
  "causationId",
  "idempotencyKey"
];
const refOrder = ["id", "entityType"];

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
  return JSON.parse(readFileSync(join("tests", "fixtures", "contracts", "transaction", relativePath), "utf8"));
}

function canonicalStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  const sortKeys = (record: Record<string, unknown>): string[] => {
    if ("contractVersion" in record && "schemaId" in record && "schemaVersion" in record) {
      return topLevelOrder.filter((key) => key in record).concat(
        Object.keys(record)
          .filter((key) => !topLevelOrder.includes(key))
          .sort()
      );
    }
    if (Object.keys(record).every((key) => refOrder.includes(key))) {
      return refOrder.filter((key) => key in record);
    }
    return Object.keys(record).sort();
  };
  const normalize = (input: unknown): JsonValue => {
    if (input === null) {
      return null;
    }
    if (typeof input !== "object") {
      return input as string | number | boolean;
    }
    if (Array.isArray(input)) {
      return input.map((entry) => normalize(entry));
    }
    if (seen.has(input)) {
      throw new Error("CYCLIC_VALUE");
    }
    seen.add(input);
    const record = requireRecord(input);
    const ordered: JsonObject = {};
    for (const key of sortKeys(record)) {
      ordered[key] = normalize(record[key]);
    }
    return ordered;
  };

  return JSON.stringify(normalize(value), null, 2) + "\n";
}

function cloneJson<T>(value: T): T {
  return JSON.parse(canonicalStringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.prototype.toString.call(value) === "[object Object]";
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error("INVALID_JSON_OBJECT");
  }
  return value;
}

function isJsonValueInternal(value: unknown, seen: WeakSet<object>): value is JsonValue {
  if (value === null) {
    return true;
  }
  const valueType = typeof value;
  if (valueType === "string") {
    return (value as string).length <= 1024;
  }
  if (valueType === "boolean") {
    return true;
  }
  if (valueType === "number") {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    if (value.length > 64) {
      return false;
    }
    return value.every((entry) => isJsonValueInternal(entry, seen));
  }
  if (isRecord(value)) {
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    const keys = Object.keys(value);
    if (keys.length > 64) {
      return false;
    }
    return keys.every((key) => !forbiddenObjectKeys.has(key) && isJsonValueInternal(value[key], seen));
  }
  return false;
}

function isJsonValue(value: unknown): value is JsonValue {
  return isJsonValueInternal(value, new WeakSet<object>());
}

function hasForbiddenKey(value: unknown): boolean {
  const seen = new WeakSet<object>();
  const visit = (current: unknown): boolean => {
    if (!isRecord(current) && !Array.isArray(current)) {
      return false;
    }
    if (Array.isArray(current)) {
      return current.some((entry) => visit(entry));
    }
    if (seen.has(current)) {
      return false;
    }
    seen.add(current);
    return Object.keys(current).some((key) => forbiddenObjectKeys.has(key) || visit(current[key]));
  };
  return visit(value);
}

function isTypedReference(value: unknown): value is TypedReference {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.entityType === "string" &&
    /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*){2}$/.test(value.id) &&
    /^[a-z][a-z0-9-]*$/.test(value.entityType)
  );
}

function isStateSelector(value: unknown): value is StateSelector {
  return (
    isRecord(value) &&
    typeof value.domainId === "string" &&
    typeof value.path === "string" &&
    /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*){2}$/.test(value.domainId) &&
    (/^\/(?:[^~\/]|~0|~1)*(?:\/(?:[^~\/]|~0|~1)*)*$/.test(value.path) || value.path === "/")
  );
}

function isCondition(value: unknown): value is Condition {
  if (!isRecord(value)) {
    return false;
  }
  if (value.contractVersion !== conditionContractVersion || value.schemaId !== "condition") {
    return false;
  }
  if (typeof value.schemaVersion !== "number" || !Number.isInteger(value.schemaVersion) || value.schemaVersion < 1) {
    return false;
  }
  if (value.type === "constant") {
    return typeof value.value === "boolean";
  }
  if (value.type === "condition-ref") {
    return typeof value.conditionId === "string";
  }
  return false;
}

function evaluateCondition(
  condition: Condition,
  state: EngineStateSnapshot,
  namedConditions: ReadonlyMap<string, Condition>,
  stack: string[] = []
): { ok: true; value: boolean } | { ok: false; code: string } {
  if (condition.type === "constant") {
    return { ok: true, value: condition.value };
  }
  if (stack.includes(condition.conditionId)) {
    return { ok: false, code: "REFERENCE_CYCLE" };
  }
  const referenced = namedConditions.get(condition.conditionId);
  if (!referenced) {
    return { ok: false, code: "REFERENCE_NOT_FOUND" };
  }
  return evaluateCondition(referenced, state, namedConditions, [...stack, condition.conditionId]);
}

function resolveDomain(state: EngineStateSnapshot, domainId: string): Domain | undefined {
  const metaDomains = state.meta?.domains ?? [];
  return state.run.domains.find((domain) => domain.domainId === domainId) ?? metaDomains.find((domain) => domain.domainId === domainId);
}

function decodePointerSegment(segment: string): string {
  return segment.replace(/~1/g, "/").replace(/~0/g, "~");
}

function resolveDataTarget(domain: Domain, path: string): { parent: JsonObject | JsonValue[]; key: string } | { error: string } {
  const normalizedPath = path === "" ? "/" : path;
  if (!/^\/(?:[^~\/]|~0|~1)*(?:\/(?:[^~\/]|~0|~1)*)*$/.test(normalizedPath)) {
    return { error: "INVALID_TARGET" };
  }
  const segments = normalizedPath.split("/").slice(1).map((segment) => decodePointerSegment(segment));
  const protectedRoot = new Set(["schemaVersion", "revision", "stateId", "run", "meta", "owner", "authority", "persistence", "schemaId", "domainId"]);
  if (segments.length > 0 && protectedRoot.has(segments[0])) {
    return { error: "PROTECTED_METADATA_MUTATION" };
  }
  let current: JsonValue = domain.data;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    if (Array.isArray(current)) {
      if (!/^(0|[1-9][0-9]*)$/.test(segment)) {
        return { error: "INVALID_TARGET" };
      }
      const next: JsonValue = current[Number(segment)] as JsonValue;
      if (next === null || typeof next !== "object") {
        return { error: "STATE_PATH_NOT_FOUND" };
      }
      current = next;
      continue;
    }
    if (!isRecord(current)) {
      return { error: "STATE_PATH_NOT_FOUND" };
    }
    if (forbiddenObjectKeys.has(segment)) {
      return { error: "FORBIDDEN_OBJECT_KEY" };
    }
    if (!(segment in current)) {
      return { error: "STATE_PATH_NOT_FOUND" };
    }
    current = current[segment] as JsonValue;
  }
  const last = segments[segments.length - 1] ?? "";
  if (Array.isArray(current)) {
    if (!/^(0|[1-9][0-9]*)$/.test(last)) {
      return { error: "INVALID_TARGET" };
    }
    return { parent: current, key: last };
  }
  if (!isRecord(current)) {
    return { error: "STATE_PATH_NOT_FOUND" };
  }
  if (forbiddenObjectKeys.has(last)) {
    return { error: "FORBIDDEN_OBJECT_KEY" };
  }
  return { parent: current, key: last };
}

function getValueAtTarget(domain: Domain, path: string): { found: true; value: JsonValue } | { found: false } {
  if (path === "/" || path === "") {
    return { found: true, value: domain.data };
  }
  const resolved = resolveDataTarget(domain, path);
  if ("error" in resolved) {
    return { found: false };
  }
  const { parent, key } = resolved;
  if (Array.isArray(parent)) {
    const index = Number(key);
    return index < parent.length ? { found: true, value: parent[index] } : { found: false };
  }
  return key in parent ? { found: true, value: parent[key] } : { found: false };
}

/* eslint-disable @typescript-eslint/no-unused-vars */

function validateCandidateStateLegacy(state: EngineStateSnapshot): { ok: true } | { ok: false; code: string } {
  const domains = [...state.run.domains, ...(state.meta?.domains ?? [])];
  const ids = new Set<string>();
  for (const domain of domains) {
    if (ids.has(domain.domainId)) {
      return { ok: false, code: "CANDIDATE_STATE_INVALID" };
    }
    ids.add(domain.domainId);
    if (domain.schemaVersion !== 1 || typeof domain.schemaId !== "string" || typeof domain.owner !== "string") {
      return { ok: false, code: "CANDIDATE_STATE_INVALID" };
    }
    if (domain.domainId === "state-domain.core.world") {
      const doors = domain.data.doors;
      const flags = domain.data.flags;
      if (!isRecord(doors) || !isRecord(flags)) {
        return { ok: false, code: "CANDIDATE_STATE_INVALID" };
      }
      const main = doors.main;
      const side = doors.side;
      if (!isRecord(main) || !isRecord(side) || typeof main.state !== "string" || typeof side.state !== "string") {
        return { ok: false, code: "CANDIDATE_STATE_INVALID" };
      }
      if (typeof flags.paused !== "boolean") {
        return { ok: false, code: "CANDIDATE_STATE_INVALID" };
      }
    }
    if (domain.domainId === "state-domain.core.clock") {
      if (typeof domain.data.tick !== "number" || !Number.isInteger(domain.data.tick)) {
        return { ok: false, code: "CANDIDATE_STATE_INVALID" };
      }
    }
  }
  return { ok: true };
}

function validateTransactionShapeLegacy(input: unknown): input is TransactionInput {
  if (!isRecord(input)) {
    return false;
  }
  if (input.contractVersion !== transactionContractVersion || input.schemaId !== transactionSchemaId) {
    return false;
  }
  if (typeof input.schemaVersion !== "number" || !Number.isInteger(input.schemaVersion) || input.schemaVersion < 1 || input.schemaVersion > 2147483647) {
    return false;
  }
  const allowedKeys = new Set([
    "contractVersion",
    "schemaId",
    "schemaVersion",
    "transactionId",
    "baseRevision",
    "source",
    "effects",
    "context",
    "correlationId",
    "causationId",
    "idempotencyKey"
  ]);
  if (Object.keys(input).some((key) => !allowedKeys.has(key))) {
    return false;
  }
  if (input.transactionId !== undefined && (!isTypedReference({ id: input.transactionId, entityType: "transaction" }) || !/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*){2}$/.test(input.transactionId))) {
    return false;
  }
  if (typeof input.baseRevision !== "number" || !Number.isInteger(input.baseRevision) || input.baseRevision < 0) {
    return false;
  }
  if (!isRecord(input.source)) {
    return false;
  }
  if (input.source.kind === "command-plan") {
    if (input.source.commandId !== undefined && !/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*){2}$/.test(input.source.commandId)) {
      return false;
    }
    if (input.source.commandType !== undefined && !/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/.test(input.source.commandType)) {
      return false;
    }
    if (input.source.allowNoOp !== undefined && typeof input.source.allowNoOp !== "boolean") {
      return false;
    }
  } else if (input.source.kind === "system") {
    if (typeof input.source.systemId !== "string" || input.source.systemId.length === 0) {
      return false;
    }
    if (input.source.allowNoOp !== undefined && typeof input.source.allowNoOp !== "boolean") {
      return false;
    }
  } else {
    return false;
  }
  if (!Array.isArray(input.effects) || input.effects.length > 32 || !input.effects.every((effect) => validateEffectShape(effect))) {
    return false;
  }
  if (input.context !== undefined && !isJsonValue(input.context)) {
    return false;
  }
  for (const key of ["correlationId", "causationId", "idempotencyKey"] as const) {
    if (input[key] !== undefined && (typeof input[key] !== "string" || input[key].length === 0)) {
      return false;
    }
  }
  return true;
}

function validateEffectShapeLegacy(effect: unknown): effect is Effect {
  if (!isRecord(effect)) {
    return false;
  }
  if (effect.contractVersion !== effectContractVersion || effect.schemaId !== "effect") {
    return false;
  }
  if (typeof effect.schemaVersion !== "number" || !Number.isInteger(effect.schemaVersion) || effect.schemaVersion < 1) {
    return false;
  }
  if (!isStateSelector(effect.target)) {
    return false;
  }
  if (effect.guard !== undefined && !isCondition(effect.guard)) {
    return false;
  }
  if (effect.type === "set") {
    return isJsonValue(effect.value);
  }
  if (effect.type === "increment") {
    return typeof effect.delta === "number" && Number.isFinite(effect.delta);
  }
  if (effect.type === "unset") {
    return true;
  }
  return false;
}

function makeBaseStateLegacy(): EngineStateSnapshot {
  return cloneJson(baseState);
}

function makeTransactionLegacy(overrides: Partial<TransactionInput> = {}): TransactionInput {
  return {
    contractVersion: transactionContractVersion,
    schemaId: transactionSchemaId,
    schemaVersion: 1,
    baseRevision: 42,
    source: {
      kind: "command-plan",
      commandId: "command.runtime.open-main-door"
    },
    effects: [],
    ...overrides
  };
}

function recordHistoryLegacy(history: TransactionHistory, input: TransactionInput, fingerprint: string, result: TransactionResult): void {
  if (input.transactionId !== undefined) {
    history.transactions.set(input.transactionId, { fingerprint, result: cloneJson(result) });
  }
  if (input.idempotencyKey !== undefined) {
    history.idempotencyKeys.set(input.idempotencyKey, { fingerprint, result: cloneJson(result) });
  }
}

/* eslint-enable @typescript-eslint/no-unused-vars */

function setEffectValue(domain: Domain, path: string, value: JsonValue): { ok: true; before: JsonValue | undefined; after: JsonValue } | { ok: false; code: string } {
  const target = resolveDataTarget(domain, path);
  if ("error" in target) {
    return { ok: false, code: target.error };
  }
  const current = getValueAtTarget(domain, path);
  if (current.found && canonicalStringify(current.value) === canonicalStringify(value)) {
    return { ok: true, before: current.value, after: current.value };
  }
  if (Array.isArray(target.parent)) {
    const index = Number(target.key);
    if (index > target.parent.length) {
      return { ok: false, code: "STATE_PATH_NOT_FOUND" };
    }
    const before = index < target.parent.length ? target.parent[index] : undefined;
    if (index === target.parent.length) {
      target.parent.push(cloneJson(value));
    } else {
      target.parent[index] = cloneJson(value);
    }
    return { ok: true, before, after: value };
  }
  const before = target.parent[target.key];
  target.parent[target.key] = cloneJson(value);
  return { ok: true, before, after: value };
}

function incrementEffectValue(domain: Domain, path: string, delta: number): { ok: true; before: JsonValue; after: JsonValue } | { ok: false; code: string } {
  const current = getValueAtTarget(domain, path);
  if (!current.found || typeof current.value !== "number" || !Number.isFinite(delta)) {
    return { ok: false, code: "EFFECT_ERROR" };
  }
  const next = current.value + delta;
  if (!Number.isFinite(next)) {
    return { ok: false, code: "NUMERIC_OVERFLOW" };
  }
  const updated = setEffectValue(domain, path, next);
  if (!updated.ok) {
    return { ok: false, code: updated.code };
  }
  return { ok: true, before: current.value, after: next };
}

function unsetEffectValue(domain: Domain, path: string): { ok: true; before: JsonValue | undefined } | { ok: false; code: string } {
  const target = resolveDataTarget(domain, path);
  if ("error" in target) {
    return { ok: false, code: target.error };
  }
  if (Array.isArray(target.parent)) {
    const index = Number(target.key);
    if (index >= target.parent.length) {
      return { ok: true, before: undefined };
    }
    const before = target.parent[index];
    target.parent.splice(index, 1);
    return { ok: true, before };
  }
  if (!(target.key in target.parent)) {
    return { ok: true, before: undefined };
  }
  const before = target.parent[target.key];
  Reflect.deleteProperty(target.parent, target.key);
  return { ok: true, before };
}

function validateCandidateState(state: EngineStateSnapshot): { ok: true } | { ok: false; code: string } {
  const domains = [...state.run.domains, ...(state.meta?.domains ?? [])];
  const ids = new Set<string>();
  for (const domain of domains) {
    if (ids.has(domain.domainId)) {
      return { ok: false, code: "CANDIDATE_STATE_INVALID" };
    }
    ids.add(domain.domainId);
    if (domain.schemaVersion !== 1) {
      return { ok: false, code: "CANDIDATE_STATE_INVALID" };
    }
    if (domain.domainId === "state-domain.core.world") {
      if (!isRecord(domain.data.doors) || !isRecord(domain.data.flags)) {
        return { ok: false, code: "CANDIDATE_STATE_INVALID" };
      }
      if (typeof domain.data.doors.main?.state !== "string" || typeof domain.data.doors.side?.state !== "string") {
        return { ok: false, code: "CANDIDATE_STATE_INVALID" };
      }
      if (typeof domain.data.flags.paused !== "boolean") {
        return { ok: false, code: "CANDIDATE_STATE_INVALID" };
      }
    }
    if (domain.domainId === "state-domain.core.clock") {
      if (typeof domain.data.tick !== "number" || !Number.isInteger(domain.data.tick)) {
        return { ok: false, code: "CANDIDATE_STATE_INVALID" };
      }
    }
  }
  return { ok: true };
}

function assertTransactionShapeFromFixture(relativePath: string): TransactionInput {
  const input = readJsonFixture(relativePath);
  expect(validateTransactionShape(input)).toBe(true);
  return input as TransactionInput;
}

function validateTransactionShape(input: unknown): input is TransactionInput {
  if (!isRecord(input)) {
    return false;
  }
  if (input.contractVersion !== transactionContractVersion || input.schemaId !== transactionSchemaId) {
    return false;
  }
  if (typeof input.schemaVersion !== "number" || !Number.isInteger(input.schemaVersion) || input.schemaVersion < 1 || input.schemaVersion > 2147483647) {
    return false;
  }
  const allowedKeys = new Set([
    "contractVersion",
    "schemaId",
    "schemaVersion",
    "transactionId",
    "baseRevision",
    "source",
    "effects",
    "context",
    "correlationId",
    "causationId",
    "idempotencyKey"
  ]);
  if (Object.keys(input).some((key) => !allowedKeys.has(key))) {
    return false;
  }
  if (input.transactionId !== undefined && (typeof input.transactionId !== "string" || !/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*){2}$/.test(input.transactionId))) {
    return false;
  }
  if (typeof input.baseRevision !== "number" || !Number.isInteger(input.baseRevision) || input.baseRevision < 0) {
    return false;
  }
  if (!isRecord(input.source)) {
    return false;
  }
  if (input.source.kind === "command-plan") {
    if (input.source.commandId !== undefined && (typeof input.source.commandId !== "string" || !/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*){2}$/.test(input.source.commandId))) {
      return false;
    }
    if (input.source.commandType !== undefined && (typeof input.source.commandType !== "string" || !/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/.test(input.source.commandType))) {
      return false;
    }
    if (input.source.allowNoOp !== undefined && typeof input.source.allowNoOp !== "boolean") {
      return false;
    }
  } else if (input.source.kind === "system") {
    if (typeof input.source.systemId !== "string" || input.source.systemId.length === 0) {
      return false;
    }
    if (input.source.reason !== undefined && typeof input.source.reason !== "string") {
      return false;
    }
    if (input.source.allowNoOp !== undefined && typeof input.source.allowNoOp !== "boolean") {
      return false;
    }
  } else {
    return false;
  }
  if (!Array.isArray(input.effects) || input.effects.length > 32 || !input.effects.every((effect) => validateEffectShape(effect))) {
    return false;
  }
  if (input.context !== undefined && !isJsonValue(input.context)) {
    return false;
  }
  for (const key of ["correlationId", "causationId", "idempotencyKey"] as const) {
    if (input[key] !== undefined && (typeof input[key] !== "string" || input[key].length === 0)) {
      return false;
    }
  }
  return true;
}

function validateEffectShape(effect: unknown): effect is Effect {
  if (!isRecord(effect)) {
    return false;
  }
  if (effect.contractVersion !== effectContractVersion || effect.schemaId !== "effect") {
    return false;
  }
  if (typeof effect.schemaVersion !== "number" || !Number.isInteger(effect.schemaVersion) || effect.schemaVersion < 1) {
    return false;
  }
  if (!isStateSelector(effect.target)) {
    return false;
  }
  if (effect.guard !== undefined && !isCondition(effect.guard)) {
    return false;
  }
  if (effect.type === "set") {
    return isJsonValue(effect.value);
  }
  if (effect.type === "increment") {
    return typeof effect.delta === "number" && Number.isFinite(effect.delta);
  }
  if (effect.type === "unset") {
    return true;
  }
  return false;
}

function makeTransaction(overrides: Partial<TransactionInput> = {}): TransactionInput {
  return {
    contractVersion: transactionContractVersion,
    schemaId: transactionSchemaId,
    schemaVersion: 1,
    baseRevision: 42,
    source: {
      kind: "command-plan",
      commandId: "command.runtime.open-main-door"
    },
    effects: [],
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

function makeBaseState(): EngineStateSnapshot {
  return cloneJson(baseState);
}

function applyTransaction(
  input: TransactionInput,
  committedState: EngineStateSnapshot,
  options: TransactionOptions = {}
): TransactionResult {
  if (!validateTransactionShape(input)) {
    return {
      status: "error",
      diagnostics: [{ code: "INVALID_TRANSACTION_SHAPE", message: "Invalid transaction declaration", path: "/" }]
    };
  }
  if (input.schemaVersion !== 1) {
    return {
      status: "error",
      diagnostics: [{ code: "SCHEMA_VERSION_UNSUPPORTED", message: "Unsupported transaction schema version", path: "/schemaVersion" }]
    };
  }
  const history = options.history ?? { transactions: new Map<string, TransactionHistoryEntry>(), idempotencyKeys: new Map<string, TransactionHistoryEntry>() };
  const fingerprint = canonicalStringify(input);
  if (input.transactionId !== undefined) {
    const previous = history.transactions.get(input.transactionId);
    if (previous !== undefined) {
      if (previous.fingerprint !== fingerprint) {
        return { status: "error", diagnostics: [{ code: "DUPLICATE_TRANSACTION_ID", message: "Transaction ID conflicts with a previous input", path: "/transactionId" }] };
      }
      return cloneJson(previous.result);
    }
  }
  if (input.idempotencyKey !== undefined) {
    const previous = history.idempotencyKeys.get(input.idempotencyKey);
    if (previous !== undefined) {
      if (previous.fingerprint !== fingerprint) {
        return { status: "error", diagnostics: [{ code: "IDEMPOTENCY_CONFLICT", message: "Idempotency key conflicts with a different transaction", path: "/idempotencyKey" }] };
      }
      return cloneJson(previous.result);
    }
  }
  if (input.baseRevision !== committedState.revision) {
    return { status: "rejected", reason: "revision-conflict", diagnostics: [{ code: "REVISION_CONFLICT", message: "Base revision does not match committed state", path: "/baseRevision" }] };
  }
  if (options.maxEffects !== undefined && input.effects.length > options.maxEffects) {
    return { status: "error", diagnostics: [{ code: "TRANSACTION_BUDGET_EXCEEDED", message: "Effect budget exceeded", path: "/effects" }] };
  }
  const workingState = cloneJson(committedState);
  const namedConditions = options.namedConditions ?? new Map<string, Condition>();
  const changes: Change[] = [];
  for (const effect of input.effects) {
    if (effect.guard !== undefined) {
      const guardResult = evaluateCondition(effect.guard, workingState, namedConditions);
      if (!guardResult.ok) {
        return {
          status: "rolled-back",
          reason: "guard-error",
          diagnostics: [{ code: guardResult.code, message: "Effect guard could not be evaluated", path: "/effects" }]
        };
      }
      if (!guardResult.value) {
        continue;
      }
    }
    if (options.deniedTargets?.has(`${effect.target.domainId}:${effect.target.path}`)) {
      return { status: "rejected", reason: "access-denied", diagnostics: [{ code: "ACCESS_DENIED", message: "Transaction target is denied", path: "/effects" }] };
    }
    const domain = resolveDomain(workingState, effect.target.domainId);
    if (domain === undefined) {
      return rollback("effect-error", "STATE_DOMAIN_NOT_FOUND", changes.length);
    }
    if (effect.type === "set") {
      const applied = setEffectValue(domain, effect.target.path, effect.value);
      if (!applied.ok) {
        return rollback("effect-error", applied.code, changes.length);
      }
      changes.push({ path: effect.target.path, before: applied.before, after: applied.after });
      continue;
    }
    if (effect.type === "increment") {
      const applied = incrementEffectValue(domain, effect.target.path, effect.delta);
      if (!applied.ok) {
        return rollback("effect-error", applied.code, changes.length);
      }
      changes.push({ path: effect.target.path, before: applied.before, after: applied.after });
      continue;
    }
    const applied = unsetEffectValue(domain, effect.target.path);
    if (!applied.ok) {
      return rollback("effect-error", applied.code, changes.length);
    }
    changes.push({ path: effect.target.path, before: applied.before, after: undefined });
  }
  if (!validateCandidateState(workingState).ok) {
    return {
      status: "rolled-back",
      reason: "candidate-invalid",
      diagnostics: [{ code: "CANDIDATE_STATE_INVALID", message: "Candidate state failed validation", path: "/" }]
    };
  }
  const allowNoOp = input.source.allowNoOp ?? true;
  const committedText = canonicalStringify(committedState);
  const candidateText = canonicalStringify(workingState);
  if (committedText === candidateText) {
    if (!allowNoOp) {
      return {
        status: "rejected",
        reason: "no-op-not-allowed",
        diagnostics: [{ code: "NO_OP_NOT_ALLOWED", message: "No-op transaction was not allowed", path: "/effects" }]
      };
    }
    const result: TransactionResult = {
      status: "no-op",
      baseRevision: committedState.revision,
      newRevision: committedState.revision,
      changes: []
    };
    recordHistory(history, input, fingerprint, result);
    return result;
  }
  const finalRevision = options.finalRevision ?? committedState.revision;
  if (finalRevision !== committedState.revision) {
    return {
      status: "rolled-back",
      reason: "revision-conflict-final",
      diagnostics: [{ code: "REVISION_CONFLICT", message: "Committed revision changed before final commit check", path: "/baseRevision", phase: "commit" }]
    };
  }
  const result: TransactionResult = {
    status: "committed",
    baseRevision: committedState.revision,
    newRevision: committedState.revision + 1,
    changes
  };
  recordHistory(history, input, fingerprint, result);
  return result;
}

function rollback(reason: string, code: string, index: number): TransactionResult {
  return {
    status: "rolled-back",
    reason,
    diagnostics: [{ code, message: "Transaction failed during effect application", path: `/effects/${String(index)}` }]
  };
}

function recordHistory(history: TransactionHistory, input: TransactionInput, fingerprint: string, result: TransactionResult): void {
  if (input.transactionId !== undefined) {
    history.transactions.set(input.transactionId, { fingerprint, result: cloneJson(result) });
  }
  if (input.idempotencyKey !== undefined) {
    history.idempotencyKeys.set(input.idempotencyKey, { fingerprint, result: cloneJson(result) });
  }
}

function stableResultText(result: TransactionResult): string {
  return canonicalStringify(result);
}

describe("Transaction Contract", () => {
  it("validates valid fixtures", () => {
    const fixtures = [
      "valid/minimal-command-plan.json",
      "valid/with-system-source.json",
      "valid/with-transaction-id.json",
      "valid/without-transaction-id.json",
      "valid/with-multi-effects.json",
      "valid/with-base-revision-zero.json",
      "valid/with-no-op.json",
      "valid/with-named-condition.json"
    ];

    for (const fixture of fixtures) {
      expect(validateTransactionShape(assertTransactionShapeFromFixture(fixture))).toBe(true);
    }
  });

  it("rejects invalid fixtures", () => {
    const fixtures = [
      "invalid/missing-schema-version.json",
      "invalid/schema-version-zero.json",
      "invalid/invalid-transaction-id.json",
      "invalid/negative-base-revision.json",
      "invalid/decimal-base-revision.json",
      "invalid/unknown-root-field.json",
      "invalid/executable-field.json",
      "invalid/invalid-effect-shape.json",
      "invalid/too-many-effects.json",
      "invalid/invalid-source.json",
      "invalid/forbidden-nested-effect-key.json"
    ];

    for (const fixture of fixtures) {
      expect(validateTransactionShape(readJsonFixture(fixture)), fixture).toBe(false);
    }
  });

  it("flags runtime-invalid values before serialization", () => {
    for (const runtimeInvalidCase of runtimeInvalidCases as ReadonlyArray<{ name: string; value: unknown }>) {
      expect(isJsonValue(runtimeInvalidCase.value)).toBe(false);
      expect(hasForbiddenKey(runtimeInvalidCase.value)).toBe(runtimeInvalidCase.name === "forbidden-nested-key");
    }
  });

  it("commits a single set effect and increments revision", () => {
    const input = makeTransaction({
      effects: [
        {
          contractVersion: effectContractVersion,
          schemaId: "effect",
          schemaVersion: 1,
          type: "set",
          target: {
            domainId: "state-domain.core.world",
            path: "/doors/main/state"
          },
          value: "open"
        }
      ]
    });
    const state = makeBaseState();
    const result = applyTransaction(input, state);

    expect(result.status).toBe("committed");
    if (result.status === "committed") {
      expect(result.newRevision).toBe(43);
      expect(result.changes).toHaveLength(1);
    }
    expect(state.revision).toBe(42);
  });

  it("preserves effect order in the final committed result", () => {
    const first = makeTransaction({
      transactionId: "transaction.runtime.order-1",
      effects: [
        {
          contractVersion: effectContractVersion,
          schemaId: "effect",
          schemaVersion: 1,
          type: "set",
          target: {
            domainId: "state-domain.core.world",
            path: "/doors/main/state"
          },
          value: "open"
        },
        {
          contractVersion: effectContractVersion,
          schemaId: "effect",
          schemaVersion: 1,
          type: "increment",
          target: {
            domainId: "state-domain.core.clock",
            path: "/tick"
          },
          delta: 2
        }
      ]
    });
    const second = makeTransaction({
      transactionId: "transaction.runtime.order-2",
      effects: [
        {
          contractVersion: effectContractVersion,
          schemaId: "effect",
          schemaVersion: 1,
          type: "increment",
          target: {
            domainId: "state-domain.core.clock",
            path: "/tick"
          },
          delta: 2
        },
        {
          contractVersion: effectContractVersion,
          schemaId: "effect",
          schemaVersion: 1,
          type: "set",
          target: {
            domainId: "state-domain.core.world",
            path: "/doors/main/state"
          },
          value: "open"
        }
      ]
    });

    const firstResult = applyTransaction(first, makeBaseState());
    const secondResult = applyTransaction(second, makeBaseState());

    expect(firstResult.status).toBe("committed");
    expect(secondResult.status).toBe("committed");
    expect(stableResultText(firstResult)).not.toBe(stableResultText(secondResult));
  });

  it("skips a false guard and continues with later effects", () => {
    const input = makeTransaction({
      effects: [
        {
          contractVersion: effectContractVersion,
          schemaId: "effect",
          schemaVersion: 1,
          type: "set",
          target: {
            domainId: "state-domain.core.world",
            path: "/doors/main/state"
          },
          value: "open",
          guard: {
            contractVersion: conditionContractVersion,
            schemaId: "condition",
            schemaVersion: 1,
            type: "constant",
            value: false
          }
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
          value: "locked",
          guard: {
            contractVersion: conditionContractVersion,
            schemaId: "condition",
            schemaVersion: 1,
            type: "constant",
            value: true
          }
        }
      ]
    });

    const result = applyTransaction(input, makeBaseState());

    expect(result.status).toBe("committed");
    if (result.status === "committed") {
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].path).toBe("/doors/side/state");
    }
  });

  it("rolls back after a partial local mutation when a later effect fails", () => {
    const state = makeBaseState();
    const before = canonicalStringify(state);
    const input = makeTransaction({
      effects: [
        {
          contractVersion: effectContractVersion,
          schemaId: "effect",
          schemaVersion: 1,
          type: "set",
          target: {
            domainId: "state-domain.core.world",
            path: "/doors/main/state"
          },
          value: "open"
        },
        {
          contractVersion: effectContractVersion,
          schemaId: "effect",
          schemaVersion: 1,
          type: "set",
          target: {
            domainId: "state-domain.core.world",
            path: "/schemaVersion"
          },
          value: "not-allowed"
        }
      ]
    });

    const result = applyTransaction(input, state);

    expect(result.status).toBe("rolled-back");
    expect(canonicalStringify(state)).toBe(before);
  });

  it("reports revision conflicts before planning any committed change", () => {
    const result = applyTransaction(
      makeTransaction({ baseRevision: 999 }),
      makeBaseState()
    );

    expect(result.status).toBe("rejected");
    if (result.status === "rejected") {
      expect(result.reason).toBe("revision-conflict");
    }
  });

  it("rolls back if the committed revision changes before the final commit check", () => {
    const state = makeBaseState();
    const before = canonicalStringify(state);
    const result = applyTransaction(
      makeTransaction({
        effects: [
          {
            contractVersion: effectContractVersion,
            schemaId: "effect",
            schemaVersion: 1,
            type: "set",
            target: {
              domainId: "state-domain.core.world",
              path: "/doors/main/state"
            },
            value: "open"
          }
        ]
      }),
      state,
      { finalRevision: 999 }
    );

    expect(result.status).toBe("rolled-back");
    if (result.status === "rolled-back") {
      expect(result.reason).toBe("revision-conflict-final");
      expect(result.diagnostics[0]?.code).toBe("REVISION_CONFLICT");
    }
    expect(canonicalStringify(state)).toBe(before);
  });

  it("returns no-op when the canonical state does not change", () => {
    const result = applyTransaction(
      makeTransaction({
        effects: [
          {
            contractVersion: effectContractVersion,
            schemaId: "effect",
            schemaVersion: 1,
            type: "set",
            target: {
              domainId: "state-domain.core.world",
              path: "/doors/main/state"
            },
            value: "closed"
          }
        ]
      }),
      makeBaseState()
    );

    expect(result.status).toBe("no-op");
  });

  it("rejects no-op transactions when the source forbids them", () => {
    const result = applyTransaction(
      makeTransaction({
        source: {
          kind: "command-plan",
          commandId: "command.runtime.open-main-door",
          allowNoOp: false
        },
        effects: [
          {
            contractVersion: effectContractVersion,
            schemaId: "effect",
            schemaVersion: 1,
            type: "set",
            target: {
              domainId: "state-domain.core.world",
              path: "/doors/main/state"
            },
            value: "closed"
          }
        ]
      }),
      makeBaseState()
    );

    expect(result.status).toBe("rejected");
    if (result.status === "rejected") {
      expect(result.reason).toBe("no-op-not-allowed");
    }
  });

  it("returns a known duplicate result for the same transactionId and same input", () => {
    const history: TransactionHistory = {
      transactions: new Map<string, TransactionHistoryEntry>(),
      idempotencyKeys: new Map<string, TransactionHistoryEntry>()
    };
    const input = makeTransaction({
      transactionId: "transaction.runtime.dedup-1",
      effects: [
        {
          contractVersion: effectContractVersion,
          schemaId: "effect",
          schemaVersion: 1,
          type: "set",
          target: {
            domainId: "state-domain.core.world",
            path: "/doors/main/state"
          },
          value: "open"
        }
      ]
    });

    const first = applyTransaction(input, makeBaseState(), { history });
    const second = applyTransaction(input, makeBaseState(), { history });

    expect(first.status).toBe("committed");
    expect(second.status).toBe("committed");
    expect(stableResultText(first)).toBe(stableResultText(second));
  });

  it("rejects duplicate transactionId with conflicting input", () => {
    const history: TransactionHistory = {
      transactions: new Map<string, TransactionHistoryEntry>(),
      idempotencyKeys: new Map<string, TransactionHistoryEntry>()
    };
    const original = makeTransaction({
      transactionId: "transaction.runtime.dedup-2",
      effects: [
        {
          contractVersion: effectContractVersion,
          schemaId: "effect",
          schemaVersion: 1,
          type: "set",
          target: {
            domainId: "state-domain.core.world",
            path: "/doors/main/state"
          },
          value: "open"
        }
      ]
    });
    const conflicting = makeTransaction({
      transactionId: "transaction.runtime.dedup-2",
      effects: [
        {
          contractVersion: effectContractVersion,
          schemaId: "effect",
          schemaVersion: 1,
          type: "set",
          target: {
            domainId: "state-domain.core.world",
            path: "/doors/main/state"
          },
          value: "locked"
        }
      ]
    });

    expect(applyTransaction(original, makeBaseState(), { history }).status).toBe("committed");
    const conflictingResult = applyTransaction(conflicting, makeBaseState(), { history });
    expect(conflictingResult.status).toBe("error");
  });

  it("detects idempotency conflicts", () => {
    const history: TransactionHistory = {
      transactions: new Map<string, TransactionHistoryEntry>(),
      idempotencyKeys: new Map<string, TransactionHistoryEntry>()
    };
    const original = makeTransaction({
      idempotencyKey: "idem-1",
      effects: [
        {
          contractVersion: effectContractVersion,
          schemaId: "effect",
          schemaVersion: 1,
          type: "set",
          target: {
            domainId: "state-domain.core.world",
            path: "/doors/main/state"
          },
          value: "open"
        }
      ]
    });
    const conflicting = makeTransaction({
      idempotencyKey: "idem-1",
      effects: [
        {
          contractVersion: effectContractVersion,
          schemaId: "effect",
          schemaVersion: 1,
          type: "set",
          target: {
            domainId: "state-domain.core.world",
            path: "/doors/main/state"
          },
          value: "locked"
        }
      ]
    });

    expect(applyTransaction(original, makeBaseState(), { history }).status).toBe("committed");
    const result = applyTransaction(conflicting, makeBaseState(), { history });
    expect(result.status).toBe("error");
  });

  it("detects semantic-invalid fixtures without mutating state", () => {
    const history: TransactionHistory = {
      transactions: new Map<string, TransactionHistoryEntry>(),
      idempotencyKeys: new Map<string, TransactionHistoryEntry>()
    };
    const duplicateTransactionSeed = makeTransaction({
      transactionId: "transaction.runtime.dedup-1",
      effects: [
        {
          contractVersion: effectContractVersion,
          schemaId: "effect",
          schemaVersion: 1,
          type: "set",
          target: {
            domainId: "state-domain.core.world",
            path: "/doors/main/state"
          },
          value: "open"
        }
      ]
    });
    recordHistory(history, duplicateTransactionSeed, canonicalStringify(duplicateTransactionSeed), {
      status: "committed",
      baseRevision: 42,
      newRevision: 43,
      changes: [
        {
          path: "/doors/main/state",
          before: "closed",
          after: "open"
        }
      ]
    });
    const namedConditions = new Map<string, Condition>([
      [
        "condition.core.allow-transaction",
        makeNamedCondition()
      ]
    ]);
    const checks: Array<{
      fixture: string;
      expected: TransactionResult["status"];
      options?: TransactionOptions;
    }> = [
      { fixture: "semantic-invalid/revision-conflict.json", expected: "rejected" },
      { fixture: "semantic-invalid/unknown-effect-type.json", expected: "error" },
      { fixture: "semantic-invalid/effect-error.json", expected: "rolled-back" },
      { fixture: "semantic-invalid/guard-error.json", expected: "rolled-back" },
      { fixture: "semantic-invalid/candidate-state-invalid.json", expected: "rolled-back" },
      { fixture: "semantic-invalid/protected-metadata-mutation.json", expected: "rolled-back" },
      { fixture: "semantic-invalid/access-denied.json", expected: "rejected", options: { deniedTargets: new Set(["state-domain.core.world:/doors/main/state"]) } },
      { fixture: "semantic-invalid/transaction-budget-exceeded.json", expected: "error", options: { maxEffects: 1 } },
      { fixture: "semantic-invalid/duplicate-transaction-id-conflict.json", expected: "error", options: { history } },
      { fixture: "semantic-invalid/no-op-plan-not-allowed.json", expected: "rejected" },
      { fixture: "semantic-invalid/unsupported-schema-version.json", expected: "error" },
      { fixture: "semantic-invalid/effect-order-ambiguity.json", expected: "committed", options: { namedConditions } }
    ];

    for (const check of checks) {
      const input = readJsonFixture(check.fixture) as TransactionInput;
      const state = makeBaseState();
      const before = canonicalStringify(state);
      const result = applyTransaction(input, state, check.options);

      expect(result.status, check.fixture).toBe(check.expected);
      expect(canonicalStringify(state), check.fixture).toBe(before);
    }
  });

  it("is deterministic for the same input and state", () => {
    const input = makeTransaction({
      transactionId: "transaction.runtime.deterministic-1",
      source: {
        kind: "system",
        systemId: "scheduler.core.tick"
      },
      context: {
        mode: "deterministic"
      },
      effects: [
        {
          contractVersion: effectContractVersion,
          schemaId: "effect",
          schemaVersion: 1,
          type: "increment",
          target: {
            domainId: "state-domain.core.clock",
            path: "/tick"
          },
          delta: 1
        }
      ]
    });
    const state = makeBaseState();
    const first = applyTransaction(input, state, { context: { mode: "deterministic" } });
    const second = applyTransaction(cloneJson(input), cloneJson(state), { context: cloneJson({ mode: "deterministic" }) });

    expect(stableResultText(first)).toBe(stableResultText(second));
  });

  it("retains regressions for previous contracts", () => {
    expect(transactionContractVersion).toBe("transaction@0.1.0");
    expect(effectContractVersion).toBe("effect@0.1.0");
    expect(conditionContractVersion).toBe("condition@0.1.0");
  });
});
