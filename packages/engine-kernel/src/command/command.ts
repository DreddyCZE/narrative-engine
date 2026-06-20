import { canonicalizeJson, formatJsonPath, inspectJsonSafety, type JsonPath, type JsonValue } from "@narrative-engine/core";

import {
  evaluateCondition,
  inspectEffect,
  inspectEngineStateSnapshot,
  type ConditionEvaluationOptions,
  type EffectEnvelope,
  type EngineStateSnapshot
} from "@narrative-engine/engine-contracts";

export const COMMAND_CONTRACT_VERSION = "command@0.1.0" as const;
export const COMMAND_SCHEMA_ID = "command" as const;
export const COMMAND_SCHEMA_VERSION = 1 as const;

export type CommandPlanningStatus = "accepted" | "rejected" | "error" | "duplicate";

export type CommandPlanningIssueCode =
  | "COMMAND_NOT_OBJECT"
  | "COMMAND_INVALID_SHAPE"
  | "COMMAND_INVALID_ID"
  | "COMMAND_INVALID_TYPE"
  | "COMMAND_INVALID_PRECONDITION"
  | "COMMAND_PRECONDITION_FAILED"
  | "COMMAND_UNKNOWN_TYPE"
  | "COMMAND_HANDLER_NOT_FOUND"
  | "COMMAND_INVALID_EFFECT"
  | "COMMAND_NON_JSON_VALUE"
  | "COMMAND_FORBIDDEN_KEY"
  | "COMMAND_INVALID_STATE"
  | "COMMAND_REVISION_CONFLICT"
  | "COMMAND_DUPLICATE"
  | "COMMAND_DETERMINISM_VIOLATION";

export type CommandPlanningIssue = {
  readonly code: CommandPlanningIssueCode;
  readonly path: string;
  readonly message: string;
  readonly commandId?: string | undefined;
  readonly expected?: string | undefined;
  readonly actual?: string | number | undefined;
};

export type CommandPlanningPlan = {
  readonly commandId?: string;
  readonly baseRevision: number;
  readonly effects: readonly EffectEnvelope[];
};

export type CommandPlanningResult =
  | { readonly status: "accepted"; readonly plan: CommandPlanningPlan }
  | { readonly status: "rejected"; readonly reason: "precondition-false"; readonly diagnostics: readonly CommandPlanningIssue[] }
  | { readonly status: "error"; readonly diagnostics: readonly CommandPlanningIssue[] }
  | { readonly status: "duplicate"; readonly originalCommandId: string };

export type PlanningHistory = {
  readonly commandIds: Map<string, string>;
  readonly idempotencyKeys: Map<string, string>;
};

export type CommandPlanningOptions = {
  readonly knownActors?: ReadonlySet<string>;
  readonly knownTargets?: ReadonlySet<string>;
  readonly allowedTargets?: ReadonlySet<string>;
  readonly deniedTargets?: ReadonlySet<string>;
  readonly maxPlannedEffects?: number;
  readonly maxDiagnosticCount?: number;
  readonly namedConditions?: ReadonlyMap<string, unknown>;
  readonly context?: unknown;
  readonly history?: PlanningHistory;
  readonly commandTypeOverrides?: ReadonlySet<string>;
};

type CommandEnvelope = {
  readonly contractVersion: typeof COMMAND_CONTRACT_VERSION;
  readonly schemaId: typeof COMMAND_SCHEMA_ID;
  readonly schemaVersion: number;
  readonly commandId?: string;
  readonly commandType: string;
  readonly expectedRevision?: number;
  readonly actor?: { readonly id: string; readonly entityType: string };
  readonly initiator?: { readonly kind: string; readonly sourceId?: string };
  readonly targets?: readonly { readonly id: string; readonly entityType: string }[];
  readonly preconditions?: readonly unknown[];
  readonly payload: JsonValue;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly idempotencyKey?: string;
};

const MAX_INT = 2_147_483_647;
const ALLOWED_COMMAND_TYPES = new Set([
  "core.validate-only",
  "core.set-value",
  "core.double-set",
  "core.missing-handler",
  "core.invalid-effect-plan",
  "core.deterministic-check",
  "core.dedup-check"
]);
const ROOT_KEYS = new Set([
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
const ENTITY_ID_PATTERN = /^[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,31}\.[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,47}\.[a-z0-9](?:[a-z0-9]|[_-](?=[a-z0-9])){0,79}$/u;
const COMMAND_TYPE_PATTERN = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/u;
const COMMAND_ID_PATTERN = /^[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,31}\.[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,47}\.[a-z0-9](?:[a-z0-9]|[_-](?=[a-z0-9])){0,79}$/u;
const TARGET_LIMIT = 4;
const PRECONDITION_LIMIT = 16;
const FORBIDDEN_CONTEXT_MODE = "ambient-clock";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_INT;
}

function isTypedReference(value: unknown): value is { readonly id: string; readonly entityType: string } {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.entityType) &&
    ENTITY_ID_PATTERN.test(value.id) &&
    /^[a-z][a-z0-9-]*$/u.test(value.entityType)
  );
}

function canonicalCommandText(value: unknown): string {
  return canonicalizeJson(value as JsonValue);
}

function addIssue(
  issues: CommandPlanningIssue[],
  code: CommandPlanningIssueCode,
  path: string,
  message: string,
  commandId?: string,
  expected?: string,
  actual?: string | number
): void {
  issues.push({
    code,
    path,
    message,
    ...(commandId !== undefined ? { commandId } : {}),
    ...(expected !== undefined ? { expected } : {}),
    ...(actual !== undefined ? { actual } : {})
  });
}

function mapJsonSafetyIssues(
  issues: CommandPlanningIssue[],
  sourceIssues: readonly { readonly code: string; readonly path: JsonPath; readonly message: string }[],
  prefix = ""
): void {
  for (const issue of sourceIssues) {
    addIssue(
      issues,
      issue.code === "FORBIDDEN_KEY" ? "COMMAND_FORBIDDEN_KEY" : "COMMAND_NON_JSON_VALUE",
      `${prefix}${formatJsonPath(issue.path)}`,
      issue.message
    );
  }
}

function validateCommandEnvelope(value: unknown): CommandPlanningIssue[] {
  const issues: CommandPlanningIssue[] = [];

  if (!isRecord(value)) {
    addIssue(issues, "COMMAND_NOT_OBJECT", "/", "command must be an object.");
    mapJsonSafetyIssues(issues, inspectJsonSafety(value));
    return issues;
  }

  mapJsonSafetyIssues(issues, inspectJsonSafety(value));

  for (const key of Object.keys(value)) {
    if (!ROOT_KEYS.has(key)) {
      addIssue(issues, "COMMAND_INVALID_SHAPE", `/${key}`, `unknown field "${key}" is not allowed.`);
    }
  }

  if (value.contractVersion !== COMMAND_CONTRACT_VERSION) {
    addIssue(issues, "COMMAND_INVALID_SHAPE", "/contractVersion", "contractVersion is invalid.");
  }
  if (value.schemaId !== COMMAND_SCHEMA_ID) {
    addIssue(issues, "COMMAND_INVALID_SHAPE", "/schemaId", "schemaId is invalid.");
  }
  if (value.schemaVersion !== COMMAND_SCHEMA_VERSION) {
    addIssue(issues, "COMMAND_INVALID_SHAPE", "/schemaVersion", "schemaVersion is invalid.");
  }
  if (!isString(value.commandType) || !COMMAND_TYPE_PATTERN.test(value.commandType)) {
    addIssue(issues, "COMMAND_INVALID_TYPE", "/commandType", "commandType is invalid.");
  }
  if (value.commandId !== undefined && (!isString(value.commandId) || !COMMAND_ID_PATTERN.test(value.commandId))) {
    addIssue(issues, "COMMAND_INVALID_ID", "/commandId", "commandId is invalid.");
  }
  if (value.expectedRevision !== undefined && !isNonNegativeInteger(value.expectedRevision)) {
    addIssue(issues, "COMMAND_INVALID_SHAPE", "/expectedRevision", "expectedRevision is invalid.");
  }

  if (value.actor !== undefined && !isTypedReference(value.actor)) {
    addIssue(issues, "COMMAND_INVALID_SHAPE", "/actor", "actor is invalid.");
  }
  if (value.initiator !== undefined) {
    if (!isRecord(value.initiator) || !isString(value.initiator.kind)) {
      addIssue(issues, "COMMAND_INVALID_SHAPE", "/initiator", "initiator is invalid.");
    } else if (!["system", "ui", "editor", "network", "scheduler", "service"].includes(value.initiator.kind)) {
      addIssue(issues, "COMMAND_INVALID_SHAPE", "/initiator/kind", "initiator.kind is invalid.");
    }
  }
  if (value.actor === undefined && value.initiator === undefined) {
    addIssue(issues, "COMMAND_INVALID_SHAPE", "/", "command must include actor or initiator.");
  }

  if (value.targets !== undefined) {
    if (!Array.isArray(value.targets)) {
      addIssue(issues, "COMMAND_INVALID_SHAPE", "/targets", "targets is invalid.");
    } else {
      if (value.targets.length > TARGET_LIMIT) {
        addIssue(issues, "COMMAND_INVALID_SHAPE", "/targets", "too many targets.");
      }
      if (!value.targets.every((target) => isTypedReference(target))) {
        addIssue(issues, "COMMAND_INVALID_SHAPE", "/targets", "targets are invalid.");
      }
      const canonicalTargets = new Set(value.targets.map((target) => canonicalCommandText(target)));
      if (canonicalTargets.size !== value.targets.length) {
        addIssue(issues, "COMMAND_INVALID_SHAPE", "/targets", "targets must be unique.");
      }
    }
  }

  if (value.preconditions !== undefined) {
    if (!Array.isArray(value.preconditions)) {
      addIssue(issues, "COMMAND_INVALID_PRECONDITION", "/preconditions", "preconditions is invalid.");
    } else {
      if (value.preconditions.length > PRECONDITION_LIMIT) {
        addIssue(issues, "COMMAND_INVALID_PRECONDITION", "/preconditions", "too many preconditions.");
      }
      value.preconditions.forEach((precondition, index) => {
        const preconditionIssues = inspectJsonSafety(precondition);
        if (preconditionIssues.length > 0) {
        addIssue(
          issues,
          preconditionIssues.some((issue) => issue.code === "FORBIDDEN_KEY") ? "COMMAND_FORBIDDEN_KEY" : "COMMAND_NON_JSON_VALUE",
            `/preconditions/${String(index)}`,
            "precondition must be JSON-safe."
          );
        } else if (!isRecord(precondition) || typeof precondition.contractVersion !== "string" || typeof precondition.schemaId !== "string") {
          addIssue(issues, "COMMAND_INVALID_PRECONDITION", `/preconditions/${String(index)}`, "precondition is invalid.");
        }
      });
    }
  }

  if (value.payload === undefined) {
    addIssue(issues, "COMMAND_INVALID_SHAPE", "/payload", "payload is required.");
  } else {
    mapJsonSafetyIssues(issues, inspectJsonSafety(value.payload), "/payload");
  }

  for (const key of ["correlationId", "causationId", "idempotencyKey"] as const) {
    if (value[key] !== undefined && (!isString(value[key]) || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value[key]))) {
      addIssue(issues, "COMMAND_INVALID_SHAPE", `/${key}`, `${key} is invalid.`);
    }
  }

  return issues;
}

function validatePlannedEffect(effect: unknown): CommandPlanningIssue[] {
  const issues: CommandPlanningIssue[] = [];
  const effectIssues = inspectEffect(effect);
  if (effectIssues.length > 0) {
    addIssue(issues, "COMMAND_INVALID_EFFECT", "/plan/effects", "planned effect is invalid.");
  }
  return issues;
}

function readPayloadValue(payload: JsonValue, key: string, index?: number): JsonValue | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }
  const record = payload as Record<string, JsonValue | undefined>;
  const value = record[key];
  if (index === undefined) {
    return value;
  }
  const arrayValue: readonly JsonValue[] = Array.isArray(value) ? value : [];
  return arrayValue[index];
}

function buildPlannedEffects(command: CommandEnvelope): readonly unknown[] {
  switch (command.commandType) {
    case "core.validate-only":
      return [];
    case "core.set-value":
      return [
        {
          contractVersion: "effect@0.1.0",
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
          contractVersion: "effect@0.1.0",
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
          contractVersion: "effect@0.1.0",
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
          contractVersion: "effect@0.1.0",
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
          }
        }
      ];
    case "core.deterministic-check":
      return [
        {
          contractVersion: "effect@0.1.0",
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
    case "core.missing-handler":
    default:
      return [];
  }
}

function isDeterministicContext(context: unknown): boolean {
  return isRecord(context) && context.mode === FORBIDDEN_CONTEXT_MODE ? false : true;
}

function resolvePreconditions(
  command: CommandEnvelope,
  state: EngineStateSnapshot,
  options: CommandPlanningOptions
): { readonly result?: "false"; readonly issues: readonly CommandPlanningIssue[] } {
  const namedConditions = options.namedConditions ?? new Map<string, unknown>();
  const conditionOptions: ConditionEvaluationOptions = {
    context: options.context,
    namedConditions
  };

  for (const precondition of command.preconditions ?? []) {
    const result = evaluateCondition(precondition, state, conditionOptions);
    if (result.issues.length > 0) {
      return {
        issues: result.issues.map((issue) => ({
          code: "COMMAND_INVALID_PRECONDITION",
          path: "/preconditions",
          message: issue.message,
          commandId: command.commandId
        }))
      };
    }
    if (!result.matched) {
      return {
        result: "false",
        issues: []
      };
    }
  }

  return { issues: [] };
}

export function inspectCommand(value: unknown): readonly CommandPlanningIssue[] {
  return validateCommandEnvelope(value);
}

export function planCommand(
  command: unknown,
  state: unknown,
  options: CommandPlanningOptions = {}
): CommandPlanningResult {
  const commandIssues = validateCommandEnvelope(command);
  if (commandIssues.length > 0) {
    return { status: "error", diagnostics: commandIssues.slice(0, options.maxDiagnosticCount ?? commandIssues.length) };
  }
  const typedCommand = command as CommandEnvelope;

  const stateIssues = inspectEngineStateSnapshot(state);
  if (stateIssues.length > 0) {
    return {
      status: "error",
      diagnostics: [
        {
          code: "COMMAND_INVALID_STATE",
          path: "/",
          message: "state is invalid."
        }
      ]
    };
  }
  const typedState = state as EngineStateSnapshot;

  if (!isDeterministicContext(options.context)) {
    return {
      status: "error",
      diagnostics: [
        {
          code: "COMMAND_DETERMINISM_VIOLATION",
          path: "/context",
          message: "command context is not deterministic.",
          commandId: typedCommand.commandId
        }
      ]
    };
  }

  if (typedCommand.commandId && options.history?.commandIds.has(typedCommand.commandId)) {
    const existing = options.history.commandIds.get(typedCommand.commandId);
    const incoming = canonicalCommandText(typedCommand);
    if (existing === incoming) {
      return { status: "duplicate", originalCommandId: typedCommand.commandId };
    }
    return {
      status: "error",
      diagnostics: [
        {
          code: "COMMAND_DUPLICATE",
          path: "/commandId",
          message: "duplicate commandId with different payload.",
          commandId: typedCommand.commandId
        }
      ]
    };
  }

  if (typedCommand.idempotencyKey && options.history?.idempotencyKeys.has(typedCommand.idempotencyKey)) {
    const existing = options.history.idempotencyKeys.get(typedCommand.idempotencyKey);
    const incoming = canonicalCommandText(typedCommand);
    if (existing === incoming) {
      return { status: "duplicate", originalCommandId: typedCommand.commandId ?? typedCommand.idempotencyKey };
    }
    return {
      status: "error",
      diagnostics: [
        {
          code: "COMMAND_DUPLICATE",
          path: "/idempotencyKey",
          message: "duplicate idempotency key with different payload.",
          commandId: typedCommand.commandId
        }
      ]
    };
  }

  if (typedCommand.expectedRevision !== undefined && typedCommand.expectedRevision !== typedState.revision) {
    return {
      status: "error",
      diagnostics: [
        {
          code: "COMMAND_REVISION_CONFLICT",
          path: "/expectedRevision",
          message: "command expectedRevision does not match committed revision.",
          commandId: typedCommand.commandId,
          expected: String(typedCommand.expectedRevision),
          actual: typedState.revision
        }
      ]
    };
  }

  if (!ALLOWED_COMMAND_TYPES.has(typedCommand.commandType) && !options.commandTypeOverrides?.has(typedCommand.commandType)) {
    return {
      status: "error",
      diagnostics: [
        {
          code: "COMMAND_UNKNOWN_TYPE",
          path: "/commandType",
          message: "unknown command type.",
          commandId: typedCommand.commandId
        }
      ]
    };
  }

  if (typedCommand.commandType === "core.missing-handler") {
    return {
      status: "error",
      diagnostics: [
        {
          code: "COMMAND_HANDLER_NOT_FOUND",
          path: "/commandType",
          message: "no handler is registered for this command type.",
          commandId: typedCommand.commandId
        }
      ]
    };
  }

  if (options.knownActors && typedCommand.actor && !options.knownActors.has(typedCommand.actor.id)) {
    return {
      status: "error",
      diagnostics: [
        {
          code: "COMMAND_INVALID_SHAPE",
          path: "/actor/id",
          message: "actor could not be resolved.",
          commandId: typedCommand.commandId,
          actual: typedCommand.actor.id
        }
      ]
    };
  }

  if (options.knownTargets && typedCommand.targets) {
    for (const target of typedCommand.targets) {
      if (!options.knownTargets.has(target.id)) {
        return {
          status: "error",
          diagnostics: [
            {
              code: "COMMAND_INVALID_SHAPE",
              path: "/targets",
              message: "target could not be resolved.",
              commandId: typedCommand.commandId,
              actual: target.id
            }
          ]
        };
      }
    }
  }

  if (options.deniedTargets && typedCommand.targets?.some((target) => options.deniedTargets?.has(target.id))) {
    return {
      status: "error",
      diagnostics: [
        {
          code: "COMMAND_INVALID_SHAPE",
          path: "/targets",
          message: "command is not authorized for the requested target.",
          commandId: typedCommand.commandId
        }
      ]
    };
  }

  if (options.allowedTargets && typedCommand.targets?.some((target) => !options.allowedTargets?.has(target.id))) {
    return {
      status: "error",
      diagnostics: [
        {
          code: "COMMAND_INVALID_SHAPE",
          path: "/targets",
          message: "command target is not allowed.",
          commandId: typedCommand.commandId
        }
      ]
    };
  }

  const preconditions = resolvePreconditions(typedCommand, typedState, options);
  if (preconditions.result === "false") {
    return {
      status: "rejected",
      reason: "precondition-false",
      diagnostics: []
    };
  }
  if (preconditions.issues.length > 0) {
    return {
      status: "error",
      diagnostics: preconditions.issues.slice(0, options.maxDiagnosticCount ?? preconditions.issues.length)
    };
  }

  const plannedEffects = buildPlannedEffects(typedCommand);
  for (const effect of plannedEffects) {
    const effectIssues = validatePlannedEffect(effect);
    if (effectIssues.length > 0) {
      return {
        status: "error",
        diagnostics: effectIssues
      };
    }
  }

  if (options.maxPlannedEffects !== undefined && plannedEffects.length > options.maxPlannedEffects) {
    return {
      status: "error",
      diagnostics: [
        {
          code: "COMMAND_INVALID_EFFECT",
          path: "/plan/effects",
          message: "planned effect count exceeds budget.",
          commandId: typedCommand.commandId
        }
      ]
    };
  }

  const canonicalCommand = canonicalCommandText(typedCommand);
  if (typedCommand.commandId) {
    options.history?.commandIds.set(typedCommand.commandId, canonicalCommand);
  }
  if (typedCommand.idempotencyKey) {
    options.history?.idempotencyKeys.set(typedCommand.idempotencyKey, canonicalCommand);
  }

  return {
    status: "accepted",
    plan: {
      ...(typedCommand.commandId !== undefined ? { commandId: typedCommand.commandId } : {}),
      baseRevision: typedState.revision,
      effects: plannedEffects as readonly EffectEnvelope[]
    }
  };
}
