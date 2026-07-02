import { canonicalizeJson, type JsonPathSegment, type JsonValue } from "@narrative-engine/core";

import {
  applyEffect,
  createValidationDiagnostic,
  evaluateCondition,
  sortValidationDiagnostics,
  type EffectEnvelope,
  type EngineStateSnapshot,
  type RuntimeDomainEventSummary,
  type RuntimeHostInput,
  type RuntimeHostResult,
  type RuntimeHostResultMetadata,
  type RuntimeTransactionSummary,
  type ValidationDiagnostic
} from "@narrative-engine/engine-contracts";

import { planCommand } from "../command/command.js";
import { runTransaction } from "../transaction/transaction.js";
import { adaptRuntimeConditionEffectBindings } from "./runtime-condition-effect-binding-adapter.js";
import { resolveRuntimeCommandRequest, type RuntimeResolvedCommand } from "./runtime-command-request-resolver.js";

const IN_MEMORY_COMMAND_EXECUTION_PIPELINE_VERSION = "in-memory-command-execution-pipeline@0.1.0" as const;
const PIPELINE_SOURCE = {
  kind: "runtime-host",
  id: "in-memory-command-execution-pipeline"
} as const;

type PipelineDiagnosticCode =
  | "RUNTIME_CONDITION_REJECTED"
  | "RUNTIME_CONDITION_EVALUATION_INVALID"
  | "RUNTIME_COMMAND_PLAN_INVALID"
  | "RUNTIME_EFFECT_ADAPTATION_UNSUPPORTED"
  | "RUNTIME_EFFECT_TARGET_DOMAIN_UNRESOLVED"
  | "RUNTIME_EFFECT_TARGET_DOMAIN_AMBIGUOUS"
  | "RUNTIME_TRANSACTION_REJECTED"
  | "RUNTIME_TRANSACTION_ERROR"
  | "RUNTIME_NEXT_STATE_BUILD_FAILED";

type JsonRecord = Record<string, JsonValue>;
type UnknownRecord = Record<string, unknown>;

export type InMemoryCommandExecutionPipelineOptions = {
  readonly runtimeHostVersion?: string;
};

type PlanningCommandEnvelope = {
  readonly contractVersion: "command@0.1.0";
  readonly schemaId: "command";
  readonly schemaVersion: 1;
  readonly commandId: string;
  readonly commandType: "core.validate-only";
  readonly expectedRevision: number;
  readonly initiator: {
    readonly kind: "system" | "service";
    readonly sourceId?: string;
  };
  readonly preconditions: readonly JsonValue[];
  readonly payload: JsonValue;
  readonly correlationId?: string;
  readonly causationId?: string;
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(canonicalizeJson(value as JsonValue)) as T;
}

function toDiagnosticDetails(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

function parseStablePath(path: string): readonly JsonPathSegment[] {
  if (!path.startsWith("/")) {
    return [];
  }

  return path
    .split("/")
    .slice(1)
    .filter((segment) => segment.length > 0)
    .map((segment) => (/^\d+$/u.test(segment) ? Number(segment) : segment));
}

function createPipelineDiagnostic(
  code: PipelineDiagnosticCode,
  category: "condition" | "command" | "effect" | "transaction" | "validation",
  path: readonly JsonPathSegment[],
  message: string,
  details?: JsonValue
): ValidationDiagnostic {
  return createValidationDiagnostic({
    ownerContract: IN_MEMORY_COMMAND_EXECUTION_PIPELINE_VERSION,
    code,
    severity: "error",
    category,
    phase: "runtime-execution",
    path,
    message,
    source: PIPELINE_SOURCE,
    ...(details === undefined ? {} : { details })
  });
}

function createMetadata(options?: InMemoryCommandExecutionPipelineOptions): RuntimeHostResultMetadata {
  return {
    deterministic: true,
    ...(options?.runtimeHostVersion === undefined ? {} : { runtimeHostVersion: options.runtimeHostVersion })
  };
}

function buildBlockedResult(
  diagnostics: readonly ValidationDiagnostic[],
  options?: InMemoryCommandExecutionPipelineOptions
): RuntimeHostResult {
  return {
    status: "blocked",
    diagnostics: sortValidationDiagnostics(diagnostics),
    metadata: createMetadata(options)
  };
}

function buildRejectedResult(
  diagnostics: readonly ValidationDiagnostic[],
  options?: InMemoryCommandExecutionPipelineOptions,
  commandPlan?: RuntimeHostResult["commandPlan"],
  transaction?: RuntimeTransactionSummary
): RuntimeHostResult {
  return {
    status: "rejected",
    diagnostics: sortValidationDiagnostics(diagnostics),
    ...(commandPlan === undefined ? {} : { commandPlan }),
    ...(transaction === undefined ? {} : { transaction }),
    metadata: createMetadata(options)
  };
}

function buildErrorResult(
  diagnostics: readonly ValidationDiagnostic[],
  options?: InMemoryCommandExecutionPipelineOptions,
  commandPlan?: RuntimeHostResult["commandPlan"],
  transaction?: RuntimeTransactionSummary
): RuntimeHostResult {
  return {
    status: "error",
    diagnostics: sortValidationDiagnostics(diagnostics),
    ...(commandPlan === undefined ? {} : { commandPlan }),
    ...(transaction === undefined ? {} : { transaction }),
    metadata: createMetadata(options)
  };
}

function buildRuntimeContext(input: RuntimeHostInput): JsonRecord {
  return {
    ...(input.context?.source === undefined ? {} : { source: input.context.source }),
    ...(input.request.actorId === undefined ? {} : { actor: input.request.actorId }),
    ...(input.request.targetId === undefined ? {} : { target: input.request.targetId }),
    initiator: input.request.actorId === undefined ? "runtime-host" : input.request.actorId
  };
}

function adaptCommandForPlanning(
  input: RuntimeHostInput,
  resolvedCommand: RuntimeResolvedCommand,
  preconditions: readonly unknown[]
): PlanningCommandEnvelope {
  const correlationId = input.context?.correlationId ?? input.context?.requestId ?? input.metadata?.requestId;
  const causationId = input.context?.requestId ?? input.metadata?.requestId;

  return {
    contractVersion: "command@0.1.0",
    schemaId: "command",
    schemaVersion: 1,
    commandId: resolvedCommand.commandId,
    commandType: "core.validate-only",
    expectedRevision: input.currentState.revision,
    initiator: {
      kind: input.request.actorId === undefined ? "system" : "service",
      ...(input.request.actorId === undefined ? {} : { sourceId: input.request.actorId })
    },
    preconditions: preconditions.map((precondition) => cloneJson(precondition as JsonValue)),
    payload: cloneJson(input.request.payload ?? null),
    ...(correlationId === undefined ? {} : { correlationId }),
    ...(causationId === undefined ? {} : { causationId })
  };
}

function findDomainIdsForPath(state: EngineStateSnapshot, targetPath: string): readonly string[] {
  const [, rootSegment] = targetPath.split("/");
  if (!isNonEmptyString(rootSegment)) {
    return [];
  }

  const domainIds: string[] = [];
  const domains = [...state.run.domains, ...(state.meta?.domains ?? [])];
  for (const domain of domains) {
    if (!isRecord(domain) || !isRecord(domain.data)) {
      continue;
    }

    if (rootSegment in domain.data && isNonEmptyString(domain.domainId)) {
      domainIds.push(domain.domainId);
    }
  }

  return domainIds;
}

function adaptEffectsForExecution(
  input: RuntimeHostInput,
  effects: ReturnType<typeof adaptRuntimeConditionEffectBindings>["effects"]
): { readonly effects: readonly EffectEnvelope[]; readonly diagnostics: readonly ValidationDiagnostic[] } {
  const diagnostics: ValidationDiagnostic[] = [];
  const adapted: EffectEnvelope[] = [];

  for (const effect of effects) {
    const definition = effect.effectDefinition;
    if (!isRecord(definition)) {
      diagnostics.push(
        createPipelineDiagnostic(
          "RUNTIME_EFFECT_ADAPTATION_UNSUPPORTED",
          "effect",
          parseStablePath(effect.path),
          "Runtime effect definition must be an object for in-memory execution.",
          cloneJson({ effectId: effect.effectId })
        )
      );
      continue;
    }

    const target = isRecord(definition.target) ? definition.target : undefined;
    if (
      isNonEmptyString(definition.contractVersion) &&
      isNonEmptyString(definition.schemaId) &&
      definition.schemaVersion === 1 &&
      isNonEmptyString(definition.type) &&
      target !== undefined &&
      isNonEmptyString(target.domainId) &&
      isNonEmptyString(target.path)
    ) {
      adapted.push(cloneJson(definition as EffectEnvelope));
      continue;
    }

    if (definition.type !== "set-field" || target === undefined || !isNonEmptyString(target.path)) {
      diagnostics.push(
        createPipelineDiagnostic(
          "RUNTIME_EFFECT_ADAPTATION_UNSUPPORTED",
          "effect",
          parseStablePath(effect.path),
          "Runtime effect definition cannot be adapted to a canonical in-memory effect envelope.",
          cloneJson({ effectId: effect.effectId, expectedType: "set-field or canonical effect envelope" })
        )
      );
      continue;
    }

    const matchingDomainIds = findDomainIdsForPath(input.currentState, target.path);
    if (matchingDomainIds.length === 0) {
      diagnostics.push(
        createPipelineDiagnostic(
          "RUNTIME_EFFECT_TARGET_DOMAIN_UNRESOLVED",
          "effect",
          parseStablePath(effect.path),
          "Runtime effect target path did not resolve to a unique engine-state domain.",
          cloneJson({ effectId: effect.effectId, targetPath: target.path })
        )
      );
      continue;
    }

    if (matchingDomainIds.length > 1) {
      diagnostics.push(
        createPipelineDiagnostic(
          "RUNTIME_EFFECT_TARGET_DOMAIN_AMBIGUOUS",
          "effect",
          parseStablePath(effect.path),
          "Runtime effect target path matched multiple engine-state domains.",
          cloneJson({ effectId: effect.effectId, targetPath: target.path, matches: matchingDomainIds })
        )
      );
      continue;
    }

    const [domainId] = matchingDomainIds;
    if (domainId === undefined) {
      continue;
    }

    adapted.push({
      contractVersion: "effect@0.1.0",
      schemaId: "effect",
      schemaVersion: 1,
      effectId: effect.effectId,
      type: "set",
      target: {
        domainId,
        path: target.path
      },
      ...(Object.prototype.hasOwnProperty.call(definition, "value")
        ? { value: cloneJson(definition.value) }
        : {})
    });
  }

  return {
    effects: Object.freeze(adapted),
    diagnostics: sortValidationDiagnostics(diagnostics)
  };
}

function buildDomainEventSummary(input: RuntimeHostInput, resolvedCommand: RuntimeResolvedCommand): RuntimeDomainEventSummary {
  const sections = isRecord(input.validatedContentGraph.sections) ? input.validatedContentGraph.sections : {};
  const eventMappings = Array.isArray(sections.eventMappings) ? sections.eventMappings : [];
  const eventTypes: string[] = [];

  for (const ref of resolvedCommand.eventMappingRefs) {
    for (const candidate of eventMappings) {
      if (!isRecord(candidate) || candidate.id !== ref || !isNonEmptyString(candidate.eventType)) {
        continue;
      }

      eventTypes.push(candidate.eventType);
      break;
    }
  }

  return {
    count: eventTypes.length,
    eventTypes: Object.freeze(eventTypes)
  };
}

function buildNextState(
  currentState: EngineStateSnapshot,
  effects: readonly EffectEnvelope[],
  context: JsonRecord,
  nextRevision: number
): { readonly nextState?: EngineStateSnapshot; readonly diagnostics: readonly ValidationDiagnostic[] } {
  let workingState = cloneJson(currentState);

  for (let index = 0; index < effects.length; index += 1) {
    const result = applyEffect(effects[index], workingState, { context });
    if (result.issues.length > 0 || result.status === "error") {
      return {
        diagnostics: [
          createPipelineDiagnostic(
            "RUNTIME_NEXT_STATE_BUILD_FAILED",
            "effect",
            ["transaction", "effects", index],
            "Runtime pipeline could not rebuild the committed next state from accepted effects.",
            toDiagnosticDetails({ status: result.status, issues: result.issues })
          )
        ]
      };
    }

    workingState = cloneJson(result.state);
  }

  return {
    nextState: {
      ...workingState,
      revision: nextRevision
    },
    diagnostics: Object.freeze([])
  };
}

export function executeInMemoryCommand(
  input: RuntimeHostInput,
  options: InMemoryCommandExecutionPipelineOptions = {}
): RuntimeHostResult {
  const resolution = resolveRuntimeCommandRequest(input);
  if (resolution.diagnostics.length > 0 || resolution.resolved === undefined) {
    return buildBlockedResult(resolution.diagnostics, options);
  }

  const bindings = adaptRuntimeConditionEffectBindings(input, resolution.resolved);
  if (bindings.diagnostics.length > 0) {
    return buildBlockedResult(bindings.diagnostics, options);
  }

  const context = buildRuntimeContext(input);
  const conditionDiagnostics: ValidationDiagnostic[] = [];
  for (const condition of bindings.conditions) {
    const evaluation = evaluateCondition(condition.conditionDefinition, input.currentState, { context });
    if (evaluation.issues.length > 0) {
      conditionDiagnostics.push(
        createPipelineDiagnostic(
          "RUNTIME_CONDITION_EVALUATION_INVALID",
          "condition",
          parseStablePath(condition.path),
          "Runtime condition definition could not be evaluated through the M2 condition primitive.",
          cloneJson({ conditionId: condition.conditionId, issues: evaluation.issues })
        )
      );
      continue;
    }

    if (!evaluation.matched) {
      conditionDiagnostics.push(
        createPipelineDiagnostic(
          "RUNTIME_CONDITION_REJECTED",
          "condition",
          parseStablePath(condition.refPath),
          "Runtime condition check rejected the requested command.",
          cloneJson({ conditionId: condition.conditionId })
        )
      );
    }
  }

  if (conditionDiagnostics.some((diagnostic) => diagnostic.code === "RUNTIME_CONDITION_EVALUATION_INVALID")) {
    return buildErrorResult(conditionDiagnostics, options);
  }

  if (conditionDiagnostics.length > 0) {
    return buildRejectedResult(conditionDiagnostics, options);
  }

  const planningCommand = adaptCommandForPlanning(
    input,
    resolution.resolved,
    bindings.conditions.map((condition) => condition.conditionDefinition)
  );
  const planning = planCommand(planningCommand, input.currentState, { context });
  const commandPlanSummary = {
    commandId: resolution.resolved.commandId,
    status: planning.status,
    diagnosticsCount:
      planning.status === "accepted"
        ? 0
        : planning.status === "duplicate"
          ? 0
          : planning.diagnostics.length
  } as const;

  if (planning.status === "rejected") {
    return buildRejectedResult(
      [
        createPipelineDiagnostic(
          "RUNTIME_COMMAND_PLAN_INVALID",
          "command",
          ["request", "commandId"],
          "Runtime command plan was rejected by the M2 command primitive.",
          toDiagnosticDetails({ reason: planning.reason, diagnostics: planning.diagnostics })
        )
      ],
      options,
      commandPlanSummary
    );
  }

  if (planning.status === "error" || planning.status === "duplicate") {
    return buildErrorResult(
      [
        createPipelineDiagnostic(
          "RUNTIME_COMMAND_PLAN_INVALID",
          "command",
          ["request", "commandId"],
          "Runtime command plan could not be built by the M2 command primitive.",
          toDiagnosticDetails(
            planning.status === "duplicate"
              ? { status: planning.status, originalCommandId: planning.originalCommandId }
              : { status: planning.status, diagnostics: planning.diagnostics }
          )
        )
      ],
      options,
      commandPlanSummary
    );
  }

  const executableEffects = adaptEffectsForExecution(input, bindings.effects);
  if (executableEffects.diagnostics.length > 0) {
    return buildErrorResult(executableEffects.diagnostics, options, commandPlanSummary);
  }

  const transactionRequest = {
    contractVersion: "transaction@0.1.0" as const,
    schemaId: "transaction" as const,
    schemaVersion: 1 as const,
    transactionId: resolution.resolved.commandId,
    baseRevision: input.currentState.revision,
    source: {
      kind: "command-plan" as const,
      commandId: planningCommand.commandId,
      commandType: planningCommand.commandType,
      allowNoOp: false
    },
    effects: executableEffects.effects,
    ...(planningCommand.correlationId === undefined ? {} : { correlationId: planningCommand.correlationId }),
    ...(planningCommand.causationId === undefined ? {} : { causationId: planningCommand.causationId })
  };
  const transaction = runTransaction(transactionRequest, input.currentState, { context });
  const transactionSummary: RuntimeTransactionSummary = {
    status: transaction.status,
    ...(transaction.status === "committed" || transaction.status === "no-op"
      ? { previousRevision: transaction.baseRevision, nextRevision: transaction.newRevision }
      : {})
  };

  if (transaction.status === "rejected" || transaction.status === "no-op") {
    return buildRejectedResult(
      [
        createPipelineDiagnostic(
          "RUNTIME_TRANSACTION_REJECTED",
          "transaction",
          ["transaction"],
          "Runtime transaction did not commit in memory.",
          toDiagnosticDetails(transaction)
        )
      ],
      options,
      commandPlanSummary,
      transactionSummary
    );
  }

  if (transaction.status === "rolled-back" || transaction.status === "error") {
    return buildErrorResult(
      [
        createPipelineDiagnostic(
          "RUNTIME_TRANSACTION_ERROR",
          "transaction",
          ["transaction"],
          "Runtime transaction failed during in-memory execution.",
          toDiagnosticDetails(transaction)
        )
      ],
      options,
      commandPlanSummary,
      transactionSummary
    );
  }

  const nextStateResult = buildNextState(executableEffects.effects.length === 0 ? input.currentState : input.currentState, executableEffects.effects, context, transaction.newRevision);
  if (nextStateResult.diagnostics.length > 0 || nextStateResult.nextState === undefined) {
    return buildErrorResult(nextStateResult.diagnostics, options, commandPlanSummary, transactionSummary);
  }

  return {
    status: "committed",
    nextState: nextStateResult.nextState,
    diagnostics: Object.freeze([]),
    commandPlan: commandPlanSummary,
    transaction: transactionSummary,
    domainEvents: buildDomainEventSummary(input, resolution.resolved),
    metadata: createMetadata(options)
  };
}





