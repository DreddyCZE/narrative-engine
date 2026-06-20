import { canonicalizeJson, formatJsonPath, inspectJsonSafety, type JsonPath, type JsonValue } from "@narrative-engine/core";

import {
  applyEffect,
  inspectEffect,
  inspectEngineStateSnapshot,
  type EffectChange,
  type EffectEnvelope,
  type EngineStateSnapshot
} from "@narrative-engine/engine-contracts";

import {
  planCommand,
  type CommandPlanningOptions,
} from "../command/command.js";

export const TRANSACTION_CONTRACT_VERSION = "transaction@0.1.0" as const;
export const TRANSACTION_SCHEMA_ID = "transaction" as const;
export const TRANSACTION_SCHEMA_VERSION = 1 as const;

export type TransactionStatus = "committed" | "no-op" | "rolled-back" | "rejected" | "error";

export type TransactionIssueCode =
  | "INVALID_TRANSACTION_SHAPE"
  | "SCHEMA_VERSION_UNSUPPORTED"
  | "DUPLICATE_TRANSACTION_ID"
  | "IDEMPOTENCY_CONFLICT"
  | "REVISION_CONFLICT"
  | "TRANSACTION_BUDGET_EXCEEDED"
  | "INVALID_EFFECT_PLAN"
  | "UNKNOWN_EFFECT_TYPE"
  | "EFFECT_ERROR"
  | "ACCESS_DENIED"
  | "CANDIDATE_STATE_INVALID"
  | "PROTECTED_METADATA_MUTATION"
  | "RESULTING_STATE_INVALID"
  | "NO_OP_NOT_ALLOWED"
  | "TRANSACTION_NON_JSON_VALUE"
  | "TRANSACTION_FORBIDDEN_KEY";

export type TransactionIssue = {
  readonly code: TransactionIssueCode;
  readonly path: string;
  readonly message: string;
  readonly phase?: string | undefined;
};

export type TransactionHistoryEntry = {
  readonly fingerprint: string;
  readonly result: TransactionResult;
};

export type TransactionHistory = {
  readonly transactions: Map<string, TransactionHistoryEntry>;
  readonly idempotencyKeys: Map<string, TransactionHistoryEntry>;
};

export type TransactionOptions = {
  readonly history?: TransactionHistory;
  readonly namedConditions?: ReadonlyMap<string, unknown>;
  readonly deniedTargets?: ReadonlySet<string>;
  readonly maxEffects?: number;
  readonly maxDiagnostics?: number;
  readonly context?: JsonValue;
  readonly finalRevision?: number;
  readonly commandPlanningOptions?: CommandPlanningOptions;
};

type TransactionRequest = {
  readonly contractVersion: typeof TRANSACTION_CONTRACT_VERSION;
  readonly schemaId: typeof TRANSACTION_SCHEMA_ID;
  readonly schemaVersion: number;
  readonly transactionId?: string;
  readonly baseRevision: number;
  readonly source: {
    readonly kind: "command-plan" | "system";
    readonly commandId?: string;
    readonly commandType?: string;
    readonly allowNoOp?: boolean;
    readonly systemId?: string;
    readonly reason?: string;
  };
  readonly effects: readonly EffectEnvelope[];
  readonly context?: JsonValue;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly idempotencyKey?: string;
};

export type TransactionResult =
  | { readonly status: "committed"; readonly baseRevision: number; readonly newRevision: number; readonly changes: readonly EffectChange[] }
  | { readonly status: "no-op"; readonly baseRevision: number; readonly newRevision: number; readonly changes: readonly [] }
  | { readonly status: "rolled-back"; readonly reason: string; readonly diagnostics: readonly TransactionIssue[] }
  | { readonly status: "rejected"; readonly reason: string; readonly diagnostics: readonly TransactionIssue[] }
  | { readonly status: "error"; readonly diagnostics: readonly TransactionIssue[] };

const MAX_INT = 2_147_483_647;
const EFFECT_LIMIT = 64;
const TOP_LEVEL_KEYS = new Set([
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
const SOURCE_KEYS = new Set(["kind", "commandId", "commandType", "allowNoOp", "systemId", "reason"]);
const TRANSACTION_ID_PATTERN = /^[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,31}\.[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,47}\.[a-z0-9](?:[a-z0-9]|[_-](?=[a-z0-9])){0,79}$/u;
const VALID_COMMAND_PLAN_TYPES = new Set([
  "core.validate-only",
  "core.set-value",
  "core.double-set",
  "core.missing-handler",
  "core.invalid-effect-plan",
  "core.deterministic-check",
  "core.dedup-check"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_INT;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function canonicalText(value: unknown): string {
  return canonicalizeJson(value as JsonValue);
}

function addIssue(
  issues: TransactionIssue[],
  code: TransactionIssueCode,
  path: string,
  message: string,
  phase?: string
): void {
  issues.push({
    code,
    path,
    message,
    ...(phase !== undefined ? { phase } : {})
  });
}

function mapSafetyIssues(
  issues: TransactionIssue[],
  sourceIssues: readonly { readonly code: string; readonly path: JsonPath; readonly message: string }[],
  prefix = ""
): void {
  for (const issue of sourceIssues) {
    addIssue(
      issues,
      issue.code === "FORBIDDEN_KEY" ? "TRANSACTION_FORBIDDEN_KEY" : "TRANSACTION_NON_JSON_VALUE",
      `${prefix}${formatJsonPath(issue.path)}`,
      issue.message
    );
  }
}

function validateSource(value: unknown): TransactionIssue[] {
  const issues: TransactionIssue[] = [];
  if (!isRecord(value)) {
    addIssue(issues, "INVALID_TRANSACTION_SHAPE", "/source", "source is invalid.");
    return issues;
  }
  for (const key of Object.keys(value)) {
    if (!SOURCE_KEYS.has(key)) {
      addIssue(issues, "INVALID_TRANSACTION_SHAPE", `/source/${key}`, `unknown field "${key}" is not allowed.`);
    }
  }
  if (!isString(value.kind) || (value.kind !== "command-plan" && value.kind !== "system")) {
    addIssue(issues, "INVALID_TRANSACTION_SHAPE", "/source/kind", "source.kind is invalid.");
  }
  if (value.kind === "command-plan") {
    if (value.commandId !== undefined && (!isString(value.commandId) || !TRANSACTION_ID_PATTERN.test(value.commandId))) {
      addIssue(issues, "INVALID_TRANSACTION_SHAPE", "/source/commandId", "source.commandId is invalid.");
    }
    if (value.commandType !== undefined && (!isString(value.commandType) || !VALID_COMMAND_PLAN_TYPES.has(value.commandType))) {
      addIssue(issues, "INVALID_TRANSACTION_SHAPE", "/source/commandType", "source.commandType is invalid.");
    }
    if (value.allowNoOp !== undefined && !isBoolean(value.allowNoOp)) {
      addIssue(issues, "INVALID_TRANSACTION_SHAPE", "/source/allowNoOp", "source.allowNoOp is invalid.");
    }
  } else if (value.kind === "system") {
    if (!isString(value.systemId)) {
      addIssue(issues, "INVALID_TRANSACTION_SHAPE", "/source/systemId", "source.systemId is required.");
    }
    if (value.reason !== undefined && !isString(value.reason)) {
      addIssue(issues, "INVALID_TRANSACTION_SHAPE", "/source/reason", "source.reason is invalid.");
    }
    if (value.allowNoOp !== undefined && !isBoolean(value.allowNoOp)) {
      addIssue(issues, "INVALID_TRANSACTION_SHAPE", "/source/allowNoOp", "source.allowNoOp is invalid.");
    }
  }
  return issues;
}

function validateRequest(value: unknown): TransactionIssue[] {
  const issues: TransactionIssue[] = [];

  if (!isRecord(value)) {
    addIssue(issues, "INVALID_TRANSACTION_SHAPE", "/", "transaction must be an object.");
    mapSafetyIssues(issues, inspectJsonSafety(value));
    return issues;
  }

  mapSafetyIssues(issues, inspectJsonSafety(value));

  for (const key of Object.keys(value)) {
    if (!TOP_LEVEL_KEYS.has(key)) {
      addIssue(issues, "INVALID_TRANSACTION_SHAPE", `/${key}`, `unknown field "${key}" is not allowed.`);
    }
  }

  if (value.contractVersion !== TRANSACTION_CONTRACT_VERSION) {
    addIssue(issues, "INVALID_TRANSACTION_SHAPE", "/contractVersion", "contractVersion is invalid.");
  }
  if (value.schemaId !== TRANSACTION_SCHEMA_ID) {
    addIssue(issues, "INVALID_TRANSACTION_SHAPE", "/schemaId", "schemaId is invalid.");
  }
  if (value.schemaVersion !== TRANSACTION_SCHEMA_VERSION) {
    addIssue(issues, "SCHEMA_VERSION_UNSUPPORTED", "/schemaVersion", "Unsupported transaction schema version.");
  }
  if (value.transactionId !== undefined && (!isString(value.transactionId) || !TRANSACTION_ID_PATTERN.test(value.transactionId))) {
    addIssue(issues, "INVALID_TRANSACTION_SHAPE", "/transactionId", "transactionId is invalid.");
  }
  if (!isNonNegativeInteger(value.baseRevision)) {
    addIssue(issues, "INVALID_TRANSACTION_SHAPE", "/baseRevision", "baseRevision is invalid.");
  }

  issues.push(...validateSource(value.source));

  if (value.effects === undefined) {
    addIssue(issues, "INVALID_TRANSACTION_SHAPE", "/effects", "effects are required.");
  } else if (!Array.isArray(value.effects)) {
    addIssue(issues, "INVALID_TRANSACTION_SHAPE", "/effects", "effects are invalid.");
  } else {
    if (value.effects.length > EFFECT_LIMIT) {
      addIssue(issues, "TRANSACTION_BUDGET_EXCEEDED", "/effects", "effect budget exceeded.");
    }
    value.effects.forEach((effect, index) => {
      const effectIssues = inspectEffect(effect);
      if (effectIssues.length > 0) {
        const code = effectIssues.some((issue) => issue.code === "EFFECT_UNKNOWN_OPERATOR")
          ? "UNKNOWN_EFFECT_TYPE"
          : "INVALID_EFFECT_PLAN";
        addIssue(issues, code, `/effects/${String(index)}`, effectIssues[0]?.message ?? "effect is invalid.");
      }
    });
  }

  if (value.context !== undefined) {
    mapSafetyIssues(issues, inspectJsonSafety(value.context), "/context");
  }

  for (const key of ["correlationId", "causationId", "idempotencyKey"] as const) {
    if (value[key] !== undefined && !isString(value[key])) {
      addIssue(issues, "INVALID_TRANSACTION_SHAPE", `/${key}`, `${key} is invalid.`);
    }
  }

  return issues;
}

function prefixIssues(
  issues: readonly { readonly code: string; readonly path: JsonPath; readonly message: string; readonly phase?: string }[],
  prefix: string,
  codeMap?: (code: string) => TransactionIssueCode
): TransactionIssue[] {
  return issues.map((issue) => ({
    code: codeMap?.(issue.code) ?? (issue.code as TransactionIssueCode),
    path: `${prefix}${formatJsonPath(issue.path)}`,
    message: issue.message,
    ...(issue.phase !== undefined ? { phase: issue.phase } : {})
  }));
}

function mapStateIssuesToTransactionIssues(
  issues: readonly { readonly code: string; readonly path: JsonPath; readonly message: string }[]
): TransactionIssue[] {
  const codes = new Set(issues.map((issue) => issue.code));
  const code: TransactionIssueCode =
    codes.has("ENGINE_STATE_INVALID_REVISION") || codes.has("ENGINE_STATE_MISSING_REVISION")
      ? "PROTECTED_METADATA_MUTATION"
      : "CANDIDATE_STATE_INVALID";
  return issues.length === 0
    ? []
    : [{ code, path: "/", message: issues[0]?.message ?? "candidate state is invalid." }];
}

function commitResult(baseRevision: number, changes: readonly EffectChange[], state: EngineStateSnapshot): TransactionResult {
  return {
    status: "committed",
    baseRevision,
    newRevision: state.revision,
    changes
  };
}

function noOpResult(baseRevision: number): TransactionResult {
  return {
    status: "no-op",
    baseRevision,
    newRevision: baseRevision,
    changes: []
  };
}

function rejectedResult(reason: string, diagnostics: readonly TransactionIssue[]): TransactionResult {
  return { status: "rejected", reason, diagnostics };
}

function rolledBackResult(reason: string, diagnostics: readonly TransactionIssue[]): TransactionResult {
  return { status: "rolled-back", reason, diagnostics };
}

function errorResult(diagnostics: readonly TransactionIssue[]): TransactionResult {
  return { status: "error", diagnostics };
}

function applyPlannedEffects(
  effects: readonly EffectEnvelope[],
  state: EngineStateSnapshot,
  options: TransactionOptions
): { readonly status: "committed" | "no-op" | "rolled-back" | "error"; readonly state: EngineStateSnapshot; readonly changes: readonly EffectChange[]; readonly diagnostics: readonly TransactionIssue[]; readonly reason?: string } {
  let workingState = cloneJson(state);
  const changes: EffectChange[] = [];

  for (let index = 0; index < effects.length; index += 1) {
    const outcome = applyEffect(effects[index], workingState, {
      ...(options.context !== undefined ? { context: options.context } : {}),
      ...(options.namedConditions !== undefined ? { namedConditions: options.namedConditions } : {})
    });
    workingState = outcome.state;
    if (outcome.status === "error") {
      const diagnostics = prefixIssues(outcome.issues, `/effects/${String(index)}`, (code) =>
        code === "EFFECT_UNKNOWN_OPERATOR" ? "UNKNOWN_EFFECT_TYPE" : "EFFECT_ERROR"
      );
      return { status: "rolled-back", state, changes, diagnostics, reason: "effect-error" };
    }
    changes.push(...outcome.changes);
  }

  const stateIssues = inspectEngineStateSnapshot(workingState);
  if (stateIssues.length > 0) {
    return {
      status: "rolled-back",
      state,
      changes,
      diagnostics: mapStateIssuesToTransactionIssues(stateIssues),
      reason: "candidate-validation"
    };
  }

  if (canonicalText(state) === canonicalText(workingState)) {
    return {
      status: "no-op",
      state,
      changes: [],
      diagnostics: []
    };
  }

  return {
    status: "committed",
    state: workingState,
    changes,
    diagnostics: []
  };
}

function historyFingerprint(request: TransactionRequest): string {
  return canonicalText(request);
}

function storeHistory(history: TransactionHistory | undefined, request: TransactionRequest, result: TransactionResult): void {
  if (history === undefined) {
    return;
  }
  const entry: TransactionHistoryEntry = {
    fingerprint: historyFingerprint(request),
    result: cloneJson(result)
  };
  if (request.transactionId !== undefined) {
    history.transactions.set(request.transactionId, entry);
  }
  if (request.idempotencyKey !== undefined) {
    history.idempotencyKeys.set(request.idempotencyKey, entry);
  }
}

export function inspectTransaction(value: unknown): readonly TransactionIssue[] {
  return validateRequest(value);
}

export function runTransaction(request: unknown, state: EngineStateSnapshot, options: TransactionOptions = {}): TransactionResult {
  const requestIssues = validateRequest(request);
  if (requestIssues.length > 0) {
    return errorResult(requestIssues.slice(0, options.maxDiagnostics ?? requestIssues.length));
  }

  const typedRequest = request as TransactionRequest;
  const fingerprint = historyFingerprint(typedRequest);
  if (typedRequest.transactionId !== undefined && options.history?.transactions.has(typedRequest.transactionId)) {
    const historyEntry = options.history.transactions.get(typedRequest.transactionId);
    if (historyEntry !== undefined && historyEntry.fingerprint !== fingerprint) {
      return errorResult([
        { code: "DUPLICATE_TRANSACTION_ID", path: "/transactionId", message: "Transaction ID conflicts with a previous input." }
      ]);
    }
    if (historyEntry !== undefined) {
      return cloneJson(historyEntry.result);
    }
  }
  if (typedRequest.idempotencyKey !== undefined && options.history?.idempotencyKeys.has(typedRequest.idempotencyKey)) {
    const historyEntry = options.history.idempotencyKeys.get(typedRequest.idempotencyKey);
    if (historyEntry !== undefined && historyEntry.fingerprint !== fingerprint) {
      return errorResult([
        { code: "IDEMPOTENCY_CONFLICT", path: "/idempotencyKey", message: "Idempotency key conflicts with a different transaction." }
      ]);
    }
    if (historyEntry !== undefined) {
      return cloneJson(historyEntry.result);
    }
  }

  const stateIssues = inspectEngineStateSnapshot(state);
  if (stateIssues.length > 0) {
    return errorResult(mapStateIssuesToTransactionIssues(stateIssues));
  }

  if (typedRequest.baseRevision !== state.revision) {
    return rejectedResult("revision-conflict", [
      { code: "REVISION_CONFLICT", path: "/baseRevision", message: "Base revision does not match committed state." }
    ]);
  }

  if (options.maxEffects !== undefined && typedRequest.effects.length > options.maxEffects) {
    return errorResult([{ code: "TRANSACTION_BUDGET_EXCEEDED", path: "/effects", message: "Effect budget exceeded." }]);
  }

  const applied = applyPlannedEffects(typedRequest.effects, state, options);
  if (applied.status === "rolled-back") {
    return rolledBackResult(applied.reason ?? "effect-error", applied.diagnostics.slice(0, options.maxDiagnostics ?? applied.diagnostics.length));
  }
  if (applied.status === "error") {
    return errorResult(applied.diagnostics.slice(0, options.maxDiagnostics ?? applied.diagnostics.length));
  }

  if (applied.status === "no-op") {
    if (typedRequest.source.allowNoOp === false) {
      return rejectedResult("no-op-not-allowed", [
        { code: "NO_OP_NOT_ALLOWED", path: "/effects", message: "No-op transaction was not allowed." }
      ]);
    }
    const result = noOpResult(typedRequest.baseRevision);
    storeHistory(options.history, typedRequest, result);
    return result;
  }

  const finalRevision = options.finalRevision ?? state.revision;
  if (finalRevision !== state.revision) {
    return rolledBackResult("revision-conflict", [
      { code: "REVISION_CONFLICT", path: "/baseRevision", message: "Committed revision changed before final commit check.", phase: "commit" }
    ]);
  }

  const committedState: EngineStateSnapshot = {
    ...cloneJson(applied.state),
    revision: state.revision + 1
  };
  const committed = commitResult(typedRequest.baseRevision, applied.changes, committedState);
  storeHistory(options.history, typedRequest, committed);
  return committed;
}

export function runCommandTransaction(
  command: unknown,
  state: EngineStateSnapshot,
  options: TransactionOptions = {}
): TransactionResult {
  const planning = planCommand(command, state, options.commandPlanningOptions ?? {});
  if (planning.status !== "accepted") {
    if (planning.status === "rejected") {
      return rejectedResult("precondition-false", []);
    }
    if (planning.status === "duplicate") {
      return rejectedResult("command-duplicate", [
        { code: "DUPLICATE_TRANSACTION_ID", path: "/transactionId", message: "Command is a known duplicate transaction." }
      ]);
    }
    const diagnostics: readonly TransactionIssue[] = planning.diagnostics.map((issue): TransactionIssue => ({
      code: "INVALID_TRANSACTION_SHAPE",
      path: issue.path,
      message: issue.message
    }));
    return errorResult(diagnostics);
  }

  const commandType = isRecord(command) && isString(command.commandType) ? command.commandType : undefined;
  const request: TransactionRequest = {
    contractVersion: TRANSACTION_CONTRACT_VERSION,
    schemaId: TRANSACTION_SCHEMA_ID,
    schemaVersion: TRANSACTION_SCHEMA_VERSION,
    baseRevision: state.revision,
    source: {
      kind: "command-plan",
      ...(planning.plan.commandId !== undefined ? { commandId: planning.plan.commandId } : {}),
      ...(commandType !== undefined ? { commandType } : {}),
      allowNoOp: true
    },
    effects: planning.plan.effects,
    ...(planning.plan.commandId !== undefined ? { transactionId: planning.plan.commandId } : {}),
    ...(options.context !== undefined ? { context: options.context } : {})
  };

  return runTransaction(request, state, options);
}

export const applyTransaction = runTransaction;
