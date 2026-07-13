import {
  canonicalizeJson,
  formatJsonPath,
  inspectJsonSafety,
  type JsonPathSegment,
  type JsonValue
} from "@narrative-engine/core";

import {
  inspectContentReadModelInput,
  type ContentReadModel,
  type ContentReadModelInput
} from "../content-runtime/content-read-model.js";
import {
  inspectRuntimePlayerState,
  type RuntimePlayerState
} from "../content-runtime/runtime-player-state.js";
import {
  executeRuntimeInventoryCommand,
  type RuntimeInventoryCommandView
} from "./runtime-inventory-command-executor.js";
import {
  executeRuntimeLookCommand,
  type RuntimeLookCommandView
} from "./runtime-look-command-executor.js";
import {
  inspectRuntimeCommandPlanningInput,
  RUNTIME_COMMAND_PLAN_STATUSES,
  type RuntimeCommandPlan,
  type RuntimeCommandPlanStatus,
  type RuntimeCommandPlanningInput
} from "./runtime-command-planning.js";
import {
  createValidationDiagnostic,
  sortValidationDiagnostics,
  type ValidationDiagnostic,
  type ValidationDiagnosticCategory,
  type ValidationDiagnosticPhase
} from "../validation-diagnostic/validation-diagnostic.js";

export const RUNTIME_READONLY_COMMAND_EXECUTION_STATUSES = ["executed", "rejected", "blocked"] as const;
export const RUNTIME_READONLY_COMMAND_EXECUTOR_CONTRACT_VERSION = "runtime-readonly-command-execution-facade@0.1.0" as const;

const READONLY_EXECUTION_INPUT_KEYS = new Set(["plan", "content", "playerState", "metadata"]);
const READONLY_EXECUTION_METADATA_KEYS = new Set(["requestId", "correlationId", "deterministic"]);
const SUPPORTED_READONLY_COMMANDS = new Set(["look", "inventory"]);

export type RuntimeReadonlyCommandExecutionStatus = (typeof RUNTIME_READONLY_COMMAND_EXECUTION_STATUSES)[number];
export type RuntimeReadonlyCommandDiagnostic = ValidationDiagnostic;

export type RuntimeReadonlyCommandExecutionMetadata = {
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly deterministic?: true;
};

export type RuntimeReadonlyCommandExecutionView =
  | {
      readonly kind: "look";
      readonly look: RuntimeLookCommandView;
    }
  | {
      readonly kind: "inventory";
      readonly inventory: RuntimeInventoryCommandView;
    };

export type RuntimeReadonlyCommandExecutionInput = {
  readonly plan: RuntimeCommandPlan;
  readonly content: ContentReadModel | ContentReadModelInput;
  readonly playerState: RuntimePlayerState;
  readonly metadata?: RuntimeReadonlyCommandExecutionMetadata;
};

export type RuntimeReadonlyCommandExecutionResultMetadata = {
  readonly deterministic: true;
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly executorVersion: typeof RUNTIME_READONLY_COMMAND_EXECUTOR_CONTRACT_VERSION;
};

export type RuntimeReadonlyCommandExecutionResult = {
  readonly status: RuntimeReadonlyCommandExecutionStatus;
  readonly commandId: string;
  readonly diagnostics: readonly RuntimeReadonlyCommandDiagnostic[];
  readonly view?: RuntimeReadonlyCommandExecutionView;
  readonly metadata: RuntimeReadonlyCommandExecutionResultMetadata;
};

export class RuntimeReadonlyCommandExecutionValidationError extends TypeError {
  public readonly diagnostics: readonly RuntimeReadonlyCommandDiagnostic[];

  public constructor(diagnostics: readonly RuntimeReadonlyCommandDiagnostic[]) {
    super(formatRuntimeReadonlyCommandExecutionValidationMessage(diagnostics));
    this.name = "RuntimeReadonlyCommandExecutionValidationError";
    this.diagnostics = diagnostics;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isContentReadModel(value: ContentReadModel | ContentReadModelInput): value is ContentReadModel {
  return typeof (value as ContentReadModel).getPackageId === "function";
}

function cloneJsonValue<T extends JsonValue>(value: T): T {
  return JSON.parse(canonicalizeJson(value)) as T;
}

function createDiagnostic(
  code: string,
  path: readonly JsonPathSegment[],
  message: string,
  category: ValidationDiagnosticCategory,
  phase: ValidationDiagnosticPhase,
  details?: JsonValue
): RuntimeReadonlyCommandDiagnostic {
  return createValidationDiagnostic({
    ownerContract: RUNTIME_READONLY_COMMAND_EXECUTOR_CONTRACT_VERSION,
    code,
    severity: "error",
    category,
    phase,
    path,
    message,
    source: {
      kind: "runtime-readonly-command-execution-facade",
      id: "readonly-execution-input",
      path
    },
    ...(details === undefined ? {} : { details })
  });
}

function prefixDiagnostics(
  diagnostics: readonly ValidationDiagnostic[],
  pathPrefix: readonly JsonPathSegment[],
  sourceId: string
): readonly RuntimeReadonlyCommandDiagnostic[] {
  return diagnostics.map((diagnostic) =>
    createValidationDiagnostic({
      ...diagnostic,
      path: [...pathPrefix, ...diagnostic.path],
      source: diagnostic.source === undefined
        ? {
            kind: sourceId,
            id: sourceId,
            path: [...pathPrefix, ...diagnostic.path]
          }
        : {
            ...diagnostic.source,
            id: sourceId,
            path: diagnostic.source.path === undefined
              ? [...pathPrefix, ...diagnostic.path]
              : [...pathPrefix, ...diagnostic.source.path]
          }
    })
  );
}

function inspectMetadata(value: unknown): readonly RuntimeReadonlyCommandDiagnostic[] {
  const diagnostics: RuntimeReadonlyCommandDiagnostic[] = [];

  if (value === undefined) {
    return diagnostics;
  }

  if (!isRecord(value)) {
    return [
      createDiagnostic(
        "RUNTIME_READONLY_COMMAND_EXECUTION_METADATA_INVALID",
        ["metadata"],
        "metadata must be an object when present.",
        "shape",
        "shape-validation"
      )
    ];
  }

  for (const key of Object.keys(value)) {
    if (!READONLY_EXECUTION_METADATA_KEYS.has(key)) {
      diagnostics.push(
        createDiagnostic(
          "RUNTIME_READONLY_COMMAND_EXECUTION_METADATA_UNKNOWN_FIELD",
          ["metadata", key],
          `unknown field "${key}" is not allowed.`,
          "shape",
          "shape-validation"
        )
      );
    }
  }

  if (value.requestId !== undefined && typeof value.requestId !== "string") {
    diagnostics.push(
      createDiagnostic(
        "RUNTIME_READONLY_COMMAND_EXECUTION_METADATA_INVALID",
        ["metadata", "requestId"],
        "requestId must be a string when present.",
        "shape",
        "shape-validation"
      )
    );
  }

  if (value.correlationId !== undefined && typeof value.correlationId !== "string") {
    diagnostics.push(
      createDiagnostic(
        "RUNTIME_READONLY_COMMAND_EXECUTION_METADATA_INVALID",
        ["metadata", "correlationId"],
        "correlationId must be a string when present.",
        "shape",
        "shape-validation"
      )
    );
  }

  if (value.deterministic !== undefined && value.deterministic !== true) {
    diagnostics.push(
      createDiagnostic(
        "RUNTIME_READONLY_COMMAND_EXECUTION_METADATA_INVALID",
        ["metadata", "deterministic"],
        "metadata.deterministic must be true when present.",
        "shape",
        "shape-validation"
      )
    );
  }

  return diagnostics;
}

function inspectPlanShape(value: unknown): readonly RuntimeReadonlyCommandDiagnostic[] {
  const diagnostics: RuntimeReadonlyCommandDiagnostic[] = [];

  if (!isRecord(value)) {
    return [
      createDiagnostic(
        "RUNTIME_READONLY_COMMAND_EXECUTION_PLAN_INVALID",
        ["plan"],
        "plan must be an object.",
        "shape",
        "shape-validation"
      )
    ];
  }

  for (const issue of inspectJsonSafety(value)) {
    diagnostics.push(
      createDiagnostic(
        issue.code === "FORBIDDEN_KEY"
          ? "RUNTIME_READONLY_COMMAND_EXECUTION_FORBIDDEN_KEY"
          : "RUNTIME_READONLY_COMMAND_EXECUTION_NON_JSON_VALUE",
        ["plan", ...issue.path],
        issue.message,
        issue.code === "FORBIDDEN_KEY" ? "security" : "serialization",
        "pre-serialization"
      )
    );
  }

  if (typeof value.status !== "string" || !RUNTIME_COMMAND_PLAN_STATUSES.includes(value.status as RuntimeCommandPlanStatus)) {
    diagnostics.push(
      createDiagnostic(
        "RUNTIME_READONLY_COMMAND_EXECUTION_PLAN_INVALID",
        ["plan", "status"],
        "plan.status is invalid.",
        "shape",
        "shape-validation"
      )
    );
  }

  if (typeof value.commandId !== "string" || value.commandId.length === 0) {
    diagnostics.push(
      createDiagnostic(
        "RUNTIME_READONLY_COMMAND_EXECUTION_PLAN_INVALID",
        ["plan", "commandId"],
        "plan.commandId is invalid.",
        "shape",
        "shape-validation"
      )
    );
  }

  if (!Array.isArray(value.diagnostics)) {
    diagnostics.push(
      createDiagnostic(
        "RUNTIME_READONLY_COMMAND_EXECUTION_PLAN_INVALID",
        ["plan", "diagnostics"],
        "plan.diagnostics must be an array.",
        "shape",
        "shape-validation"
      )
    );
  }

  return diagnostics;
}

function classifyExecutionStatus(
  diagnostics: readonly RuntimeReadonlyCommandDiagnostic[]
): RuntimeReadonlyCommandExecutionStatus {
  if (diagnostics.length === 0) {
    return "executed";
  }

  if (diagnostics.some((diagnostic) =>
    diagnostic.code === "RUNTIME_READONLY_COMMAND_EXECUTOR_COMMAND_UNSUPPORTED" ||
    diagnostic.code.startsWith("RUNTIME_READONLY_COMMAND_EXECUTION_INPUT_INVALID") ||
    diagnostic.code.startsWith("RUNTIME_READONLY_COMMAND_EXECUTION_PLAN_INVALID")
  )) {
    return "rejected";
  }

  return "blocked";
}

function getCommandId(plan: unknown): string {
  return isRecord(plan) && typeof plan.commandId === "string" ? plan.commandId : "";
}

function wrapDelegatedView(result: {
  readonly commandId: string;
  readonly view?: RuntimeLookCommandView | RuntimeInventoryCommandView;
}): RuntimeReadonlyCommandExecutionView | undefined {
  if (result.commandId === "look" && result.view !== undefined) {
    return {
      kind: "look",
      look: result.view as RuntimeLookCommandView
    };
  }

  if (result.commandId === "inventory" && result.view !== undefined) {
    return {
      kind: "inventory",
      inventory: result.view as RuntimeInventoryCommandView
    };
  }

  return undefined;
}

function createBaseMetadata(
  input: RuntimeReadonlyCommandExecutionInput
): RuntimeReadonlyCommandExecutionResultMetadata {
  return {
    deterministic: true,
    ...(input.metadata?.requestId === undefined ? {} : { requestId: input.metadata.requestId }),
    ...(input.metadata?.correlationId === undefined ? {} : { correlationId: input.metadata.correlationId }),
    executorVersion: RUNTIME_READONLY_COMMAND_EXECUTOR_CONTRACT_VERSION
  };
}

function createRejectedOrBlockedResult(
  input: RuntimeReadonlyCommandExecutionInput,
  commandId: string,
  diagnostics: readonly RuntimeReadonlyCommandDiagnostic[]
): RuntimeReadonlyCommandExecutionResult {
  const status = classifyExecutionStatus(diagnostics);
  const result: RuntimeReadonlyCommandExecutionResult = {
    status,
    commandId,
    diagnostics: sortValidationDiagnostics(diagnostics),
    metadata: createBaseMetadata(input)
  };

  return cloneJsonValue(result as JsonValue) as RuntimeReadonlyCommandExecutionResult;
}

export function inspectRuntimeReadonlyCommandExecutionInput(
  value: unknown
): readonly RuntimeReadonlyCommandDiagnostic[] {
  if (!isRecord(value)) {
    return [
      createDiagnostic(
        "RUNTIME_READONLY_COMMAND_EXECUTION_INPUT_INVALID",
        [],
        "runtime readonly command execution input must be an object.",
        "shape",
        "shape-validation"
      )
    ];
  }

  const diagnostics: RuntimeReadonlyCommandDiagnostic[] = [];

  for (const key of Object.keys(value)) {
    if (!READONLY_EXECUTION_INPUT_KEYS.has(key)) {
      diagnostics.push(
        createDiagnostic(
          "RUNTIME_READONLY_COMMAND_EXECUTION_INPUT_UNKNOWN_FIELD",
          [key],
          `unknown field "${key}" is not allowed.`,
          "shape",
          "shape-validation"
        )
      );
    }
  }

  diagnostics.push(...inspectMetadata(value.metadata));

  if (!("plan" in value)) {
    diagnostics.push(
      createDiagnostic(
        "RUNTIME_READONLY_COMMAND_EXECUTION_INPUT_INVALID",
        ["plan"],
        "plan is required.",
        "shape",
        "shape-validation"
      )
    );
  } else {
    diagnostics.push(...inspectPlanShape(value.plan));
  }

  if (!("content" in value)) {
    diagnostics.push(
      createDiagnostic(
        "RUNTIME_READONLY_COMMAND_EXECUTION_INPUT_INVALID",
        ["content"],
        "content is required.",
        "shape",
        "shape-validation"
      )
    );
  } else if (!isContentReadModel(value.content as ContentReadModel | ContentReadModelInput)) {
    diagnostics.push(
      ...prefixDiagnostics(
        inspectContentReadModelInput(value.content),
        ["content"],
        "content-input"
      )
    );
  }

  if (!("playerState" in value)) {
    diagnostics.push(
      createDiagnostic(
        "RUNTIME_READONLY_COMMAND_EXECUTION_INPUT_INVALID",
        ["playerState"],
        "playerState is required.",
        "shape",
        "shape-validation"
      )
    );
  } else {
    diagnostics.push(
      ...prefixDiagnostics(
        inspectRuntimePlayerState(value.playerState),
        ["playerState"],
        "player-state"
      )
    );
  }

  if ("plan" in value && "content" in value && "playerState" in value) {
    const planValue = value.plan as RuntimeCommandPlan;
    const planningDiagnostics = inspectRuntimeCommandPlanningInput({
      request: planValue.request,
      content: value.content as RuntimeCommandPlanningInput["content"],
      playerState: value.playerState as RuntimePlayerState,
      metadata: {
        deterministic: true
      }
    });
    diagnostics.push(...prefixDiagnostics(planningDiagnostics, ["planContext"], "plan-context"));
  }

  return sortValidationDiagnostics(diagnostics);
}

export function formatRuntimeReadonlyCommandExecutionValidationMessage(
  diagnostics: readonly RuntimeReadonlyCommandDiagnostic[]
): string {
  const firstDiagnostic = diagnostics[0];
  if (firstDiagnostic === undefined) {
    return "Runtime readonly command execution input is valid.";
  }

  return `${firstDiagnostic.code} @ ${formatJsonPath(firstDiagnostic.path)}: ${firstDiagnostic.message}`;
}

export function assertRuntimeReadonlyCommandExecutionInput(
  value: unknown
): asserts value is RuntimeReadonlyCommandExecutionInput {
  const diagnostics = inspectRuntimeReadonlyCommandExecutionInput(value);
  if (diagnostics.length > 0) {
    throw new RuntimeReadonlyCommandExecutionValidationError(diagnostics);
  }
}

export function executeRuntimeReadonlyCommand(
  input: RuntimeReadonlyCommandExecutionInput
): RuntimeReadonlyCommandExecutionResult {
  const diagnostics = [...inspectRuntimeReadonlyCommandExecutionInput(input)];
  const commandId = getCommandId(input.plan);

  if (isRecord(input.plan) && !SUPPORTED_READONLY_COMMANDS.has(input.plan.commandId)) {
    diagnostics.push(
      createDiagnostic(
        "RUNTIME_READONLY_COMMAND_EXECUTOR_COMMAND_UNSUPPORTED",
        ["plan", "commandId"],
        "only look and inventory are supported by this read-only command facade.",
        "validation",
        "command-execution",
        { commandId: input.plan.commandId }
      )
    );
  }

  if (isRecord(input.plan) && SUPPORTED_READONLY_COMMANDS.has(input.plan.commandId) && input.plan.status !== "planned") {
    diagnostics.push(
      createDiagnostic(
        "RUNTIME_READONLY_COMMAND_EXECUTOR_PLAN_NOT_EXECUTABLE",
        ["plan", "status"],
        "plan must have status planned before read-only command execution can continue.",
        "state",
        "command-execution",
        { planStatus: input.plan.status }
      )
    );
  }

  if (diagnostics.some((diagnostic) =>
    diagnostic.code === "RUNTIME_READONLY_COMMAND_EXECUTOR_COMMAND_UNSUPPORTED" ||
    diagnostic.code === "RUNTIME_READONLY_COMMAND_EXECUTOR_PLAN_NOT_EXECUTABLE" ||
    diagnostic.code.startsWith("RUNTIME_READONLY_COMMAND_EXECUTION_INPUT_INVALID") ||
    diagnostic.code.startsWith("RUNTIME_READONLY_COMMAND_EXECUTION_PLAN_INVALID") ||
    diagnostic.path[0] === "content" ||
    diagnostic.path[0] === "playerState" ||
    diagnostic.path[0] === "planContext"
  )) {
    return createRejectedOrBlockedResult(input, commandId, diagnostics);
  }

  if (commandId === "look") {
    const delegated = executeRuntimeLookCommand(input);

    return cloneJsonValue({
      status: delegated.status,
      commandId: delegated.commandId,
      diagnostics: delegated.diagnostics,
      ...(delegated.view === undefined ? {} : { view: wrapDelegatedView(delegated) }),
      metadata: createBaseMetadata(input)
    } as JsonValue) as RuntimeReadonlyCommandExecutionResult;
  }

  if (commandId === "inventory") {
    const delegated = executeRuntimeInventoryCommand(input);

    return cloneJsonValue({
      status: delegated.status,
      commandId: delegated.commandId,
      diagnostics: delegated.diagnostics,
      ...(delegated.view === undefined ? {} : { view: wrapDelegatedView(delegated) }),
      metadata: createBaseMetadata(input)
    } as JsonValue) as RuntimeReadonlyCommandExecutionResult;
  }

  return createRejectedOrBlockedResult(
    input,
    commandId,
    [
      ...diagnostics,
      createDiagnostic(
        "RUNTIME_READONLY_COMMAND_EXECUTOR_COMMAND_UNSUPPORTED",
        ["plan", "commandId"],
        "only look and inventory are supported by this read-only command facade.",
        "validation",
        "command-execution",
        { commandId }
      )
    ]
  );
}
