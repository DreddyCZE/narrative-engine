import {
  canonicalizeJson,
  formatJsonPath,
  inspectJsonSafety,
  type JsonPathSegment,
  type JsonValue
} from "@narrative-engine/core";

import {
  assertRuntimePlayerState,
  inspectRuntimePlayerState,
  type RuntimePlayerState
} from "../content-runtime/runtime-player-state.js";
import {
  createContentReadModel,
  inspectContentReadModelInput,
  type ContentReadModel,
  type ContentReadModelInput
} from "../content-runtime/content-read-model.js";
import {
  RUNTIME_COMMAND_PLAN_STATUSES,
  type RuntimeCommandPlan,
  type RuntimeCommandPlanStatus
} from "./runtime-command-planning.js";
import {
  createValidationDiagnostic,
  sortValidationDiagnostics,
  type ValidationDiagnostic,
  type ValidationDiagnosticCategory,
  type ValidationDiagnosticPhase
} from "../validation-diagnostic/validation-diagnostic.js";

export const RUNTIME_MOVEMENT_COMMAND_EXECUTION_STATUSES = ["executed", "rejected", "blocked"] as const;
export const RUNTIME_MOVEMENT_COMMAND_EXECUTOR_CONTRACT_VERSION = "runtime-movement-command-executor@0.1.0" as const;

const MOVEMENT_EXECUTION_INPUT_KEYS = new Set(["plan", "content", "playerState", "metadata"]);
const MOVEMENT_EXECUTION_METADATA_KEYS = new Set(["requestId", "correlationId", "deterministic"]);

export type RuntimeMovementCommandExecutionStatus = (typeof RUNTIME_MOVEMENT_COMMAND_EXECUTION_STATUSES)[number];
export type RuntimeMovementCommandDiagnostic = ValidationDiagnostic;

export type RuntimeMovementCommandExecutorInput = {
  readonly plan: RuntimeCommandPlan;
  readonly content: ContentReadModel | ContentReadModelInput;
  readonly playerState: RuntimePlayerState;
  readonly metadata?: {
    readonly requestId?: string;
    readonly correlationId?: string;
    readonly deterministic?: true;
  };
};

export type RuntimeMovementCommandExecutorResult = {
  readonly status: RuntimeMovementCommandExecutionStatus;
  readonly commandId: "go";
  readonly fromLocationId?: string;
  readonly toLocationId?: string;
  readonly exitId?: string;
  readonly initialPlayerState?: RuntimePlayerState;
  readonly finalPlayerState?: RuntimePlayerState;
  readonly diagnostics: readonly RuntimeMovementCommandDiagnostic[];
  readonly metadata: {
    readonly deterministic: true;
    readonly movementVersion: typeof RUNTIME_MOVEMENT_COMMAND_EXECUTOR_CONTRACT_VERSION;
    readonly diagnosticCount: number;
    readonly requestId?: string;
    readonly correlationId?: string;
  };
};

export class RuntimeMovementCommandExecutionValidationError extends TypeError {
  public readonly diagnostics: readonly RuntimeMovementCommandDiagnostic[];

  public constructor(diagnostics: readonly RuntimeMovementCommandDiagnostic[]) {
    super(formatRuntimeMovementCommandExecutionValidationMessage(diagnostics));
    this.name = "RuntimeMovementCommandExecutionValidationError";
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
): RuntimeMovementCommandDiagnostic {
  return createValidationDiagnostic({
    ownerContract: RUNTIME_MOVEMENT_COMMAND_EXECUTOR_CONTRACT_VERSION,
    code,
    severity: "error",
    category,
    phase,
    path,
    message,
    source: {
      kind: "runtime-movement-command-executor",
      id: "movement-execution-input",
      path
    },
    ...(details === undefined ? {} : { details })
  });
}

function prefixDiagnostics(
  diagnostics: readonly ValidationDiagnostic[],
  pathPrefix: readonly JsonPathSegment[],
  sourceId: string
): readonly RuntimeMovementCommandDiagnostic[] {
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

function inspectMetadata(value: unknown): readonly RuntimeMovementCommandDiagnostic[] {
  if (value === undefined) {
    return [];
  }

  if (!isRecord(value)) {
    return [
      createDiagnostic(
        "RUNTIME_MOVEMENT_COMMAND_EXECUTION_METADATA_INVALID",
        ["metadata"],
        "metadata must be an object when present.",
        "shape",
        "shape-validation"
      )
    ];
  }

  const diagnostics: RuntimeMovementCommandDiagnostic[] = [];

  for (const key of Object.keys(value)) {
    if (!MOVEMENT_EXECUTION_METADATA_KEYS.has(key)) {
      diagnostics.push(
        createDiagnostic(
          "RUNTIME_MOVEMENT_COMMAND_EXECUTION_METADATA_UNKNOWN_FIELD",
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
        "RUNTIME_MOVEMENT_COMMAND_EXECUTION_METADATA_INVALID",
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
        "RUNTIME_MOVEMENT_COMMAND_EXECUTION_METADATA_INVALID",
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
        "RUNTIME_MOVEMENT_COMMAND_EXECUTION_METADATA_INVALID",
        ["metadata", "deterministic"],
        "metadata.deterministic must be true when present.",
        "shape",
        "shape-validation"
      )
    );
  }

  return diagnostics;
}

function inspectPlanShape(value: unknown): readonly RuntimeMovementCommandDiagnostic[] {
  if (!isRecord(value)) {
    return [
      createDiagnostic(
        "RUNTIME_MOVEMENT_COMMAND_EXECUTION_PLAN_INVALID",
        ["plan"],
        "plan must be an object.",
        "shape",
        "shape-validation"
      )
    ];
  }

  const diagnostics: RuntimeMovementCommandDiagnostic[] = [];

  for (const issue of inspectJsonSafety(value)) {
    diagnostics.push(
      createDiagnostic(
        issue.code === "FORBIDDEN_KEY"
          ? "RUNTIME_MOVEMENT_COMMAND_EXECUTION_FORBIDDEN_KEY"
          : "RUNTIME_MOVEMENT_COMMAND_EXECUTION_NON_JSON_VALUE",
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
        "RUNTIME_MOVEMENT_COMMAND_EXECUTION_PLAN_INVALID",
        ["plan", "status"],
        "plan.status is invalid.",
        "shape",
        "shape-validation"
      )
    );
  }

  if (typeof value.commandId !== "string") {
    diagnostics.push(
      createDiagnostic(
        "RUNTIME_MOVEMENT_COMMAND_EXECUTION_PLAN_INVALID",
        ["plan", "commandId"],
        "plan.commandId must be a string.",
        "shape",
        "shape-validation"
      )
    );
  }

  if (!isRecord(value.request)) {
    diagnostics.push(
      createDiagnostic(
        "RUNTIME_MOVEMENT_COMMAND_EXECUTION_PLAN_INVALID",
        ["plan", "request"],
        "plan.request must be an object.",
        "shape",
        "shape-validation"
      )
    );
  }

  return sortValidationDiagnostics(diagnostics);
}

function createMetadata(
  input: Partial<RuntimeMovementCommandExecutorInput>,
  diagnosticCount: number
): RuntimeMovementCommandExecutorResult["metadata"] {
  return {
    deterministic: true,
    movementVersion: RUNTIME_MOVEMENT_COMMAND_EXECUTOR_CONTRACT_VERSION,
    diagnosticCount,
    ...(input.metadata?.requestId === undefined ? {} : { requestId: input.metadata.requestId }),
    ...(input.metadata?.correlationId === undefined ? {} : { correlationId: input.metadata.correlationId })
  };
}

function createTerminalResult(
  input: Partial<RuntimeMovementCommandExecutorInput>,
  status: RuntimeMovementCommandExecutionStatus,
  diagnostics: readonly RuntimeMovementCommandDiagnostic[],
  initialPlayerState?: RuntimePlayerState,
  finalPlayerState?: RuntimePlayerState,
  fromLocationId?: string,
  toLocationId?: string,
  exitId?: string
): RuntimeMovementCommandExecutorResult {
  const sortedDiagnostics = sortValidationDiagnostics(diagnostics);
  const result: RuntimeMovementCommandExecutorResult = {
    status,
    commandId: "go",
    ...(fromLocationId === undefined ? {} : { fromLocationId }),
    ...(toLocationId === undefined ? {} : { toLocationId }),
    ...(exitId === undefined ? {} : { exitId }),
    ...(initialPlayerState === undefined ? {} : { initialPlayerState }),
    ...(finalPlayerState === undefined ? {} : { finalPlayerState }),
    diagnostics: sortedDiagnostics,
    metadata: createMetadata(input, sortedDiagnostics.length)
  };

  return cloneJsonValue(result as JsonValue) as RuntimeMovementCommandExecutorResult;
}

export function inspectRuntimeMovementCommandExecutionInput(
  value: unknown
): readonly RuntimeMovementCommandDiagnostic[] {
  if (!isRecord(value)) {
    return [
      createDiagnostic(
        "RUNTIME_MOVEMENT_COMMAND_EXECUTION_INPUT_INVALID",
        [],
        "runtime movement command execution input must be an object.",
        "shape",
        "shape-validation"
      )
    ];
  }

  const diagnostics: RuntimeMovementCommandDiagnostic[] = [];

  for (const key of Object.keys(value)) {
    if (!MOVEMENT_EXECUTION_INPUT_KEYS.has(key)) {
      diagnostics.push(
        createDiagnostic(
          "RUNTIME_MOVEMENT_COMMAND_EXECUTION_INPUT_UNKNOWN_FIELD",
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
        "RUNTIME_MOVEMENT_COMMAND_EXECUTION_INPUT_INVALID",
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
        "RUNTIME_MOVEMENT_COMMAND_EXECUTION_INPUT_INVALID",
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
        "RUNTIME_MOVEMENT_COMMAND_EXECUTION_INPUT_INVALID",
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

  return sortValidationDiagnostics(diagnostics);
}

export function formatRuntimeMovementCommandExecutionValidationMessage(
  diagnostics: readonly RuntimeMovementCommandDiagnostic[]
): string {
  const firstDiagnostic = diagnostics[0];
  if (firstDiagnostic === undefined) {
    return "Runtime movement command execution input is valid.";
  }

  return `${firstDiagnostic.code} @ ${formatJsonPath(firstDiagnostic.path)}: ${firstDiagnostic.message}`;
}

export function assertRuntimeMovementCommandExecutionInput(
  value: unknown
): asserts value is RuntimeMovementCommandExecutorInput {
  const diagnostics = inspectRuntimeMovementCommandExecutionInput(value);
  if (diagnostics.length > 0) {
    throw new RuntimeMovementCommandExecutionValidationError(diagnostics);
  }
}

export function executeRuntimeMovementCommand(
  input: RuntimeMovementCommandExecutorInput
): RuntimeMovementCommandExecutorResult {
  const inputDiagnostics = inspectRuntimeMovementCommandExecutionInput(input);
  const initialPlayerState = cloneJsonValue(input.playerState as JsonValue) as RuntimePlayerState;

  if (inputDiagnostics.length > 0) {
    return createTerminalResult(
      input,
      "rejected",
      inputDiagnostics,
      initialPlayerState,
      cloneJsonValue(initialPlayerState as JsonValue) as RuntimePlayerState
    );
  }

  const plan = cloneJsonValue(input.plan as JsonValue) as RuntimeCommandPlan;

  if (plan.commandId !== "go" || plan.request.commandId !== "go") {
    return createTerminalResult(
      input,
      "rejected",
      [
        createDiagnostic(
          "RUNTIME_MOVEMENT_COMMAND_EXECUTION_COMMAND_UNSUPPORTED",
          ["plan", "commandId"],
          "movement executor accepts only planned go commands.",
          "command",
          "command-execution",
          { commandId: plan.commandId }
        )
      ],
      initialPlayerState,
      cloneJsonValue(initialPlayerState as JsonValue) as RuntimePlayerState
    );
  }

  if (plan.status !== "planned") {
    return createTerminalResult(
      input,
      plan.status === "rejected" ? "rejected" : "blocked",
      [
        ...prefixDiagnostics(plan.diagnostics, ["plan", "diagnostics"], "movement-plan"),
        createDiagnostic(
          "RUNTIME_MOVEMENT_COMMAND_EXECUTION_PLAN_NOT_PLANNED",
          ["plan", "status"],
          "movement execution requires a planned go command.",
          "command",
          "command-execution",
          { planStatus: plan.status }
        )
      ],
      initialPlayerState,
      cloneJsonValue(initialPlayerState as JsonValue) as RuntimePlayerState
    );
  }

  const content = isContentReadModel(input.content) ? input.content : createContentReadModel(input.content);
  const currentLocationId = input.playerState.currentLocationId;
  const currentLocation = content.getLocation(currentLocationId);

  if (currentLocation === undefined) {
    return createTerminalResult(
      input,
      "blocked",
      [
        createDiagnostic(
          "RUNTIME_MOVEMENT_COMMAND_CURRENT_LOCATION_UNRESOLVED",
          ["playerState", "currentLocationId"],
          "currentLocationId does not resolve to a content location.",
          "reference",
          "command-execution",
          { currentLocationId }
        )
      ],
      initialPlayerState,
      cloneJsonValue(initialPlayerState as JsonValue) as RuntimePlayerState
    );
  }

  const targetLocationId = plan.request.targetId;
  if (targetLocationId === undefined) {
    return createTerminalResult(
      input,
      "blocked",
      [
        createDiagnostic(
          "RUNTIME_MOVEMENT_COMMAND_TARGET_REQUIRED",
          ["plan", "request", "targetId"],
          "targetId is required for movement execution.",
          "reference",
          "command-execution"
        )
      ],
      initialPlayerState,
      cloneJsonValue(initialPlayerState as JsonValue) as RuntimePlayerState,
      currentLocation.locationId
    );
  }

  const targetLocation = content.getLocation(targetLocationId);
  if (targetLocation === undefined) {
    return createTerminalResult(
      input,
      "blocked",
      [
        createDiagnostic(
          "RUNTIME_MOVEMENT_COMMAND_TARGET_UNRESOLVED",
          ["plan", "request", "targetId"],
          "target movement location does not exist in the current content read model.",
          "reference",
          "command-execution",
          { targetLocationId }
        )
      ],
      initialPlayerState,
      cloneJsonValue(initialPlayerState as JsonValue) as RuntimePlayerState,
      currentLocation.locationId
    );
  }

  const matchingExit = content.getExits(currentLocation.locationId).find((exit) => exit.targetLocationId === targetLocation.locationId);
  if (matchingExit === undefined) {
    return createTerminalResult(
      input,
      "blocked",
      [
        createDiagnostic(
          "RUNTIME_MOVEMENT_COMMAND_TARGET_UNREACHABLE",
          ["plan", "request", "targetId"],
          "target movement location is not reachable from the current location exits.",
          "reference",
          "command-execution",
          {
            currentLocationId: currentLocation.locationId,
            targetLocationId: targetLocation.locationId
          }
        )
      ],
      initialPlayerState,
      cloneJsonValue(initialPlayerState as JsonValue) as RuntimePlayerState,
      currentLocation.locationId,
      targetLocation.locationId
    );
  }

  if (matchingExit.locked === true) {
    return createTerminalResult(
      input,
      "blocked",
      [
        createDiagnostic(
          "RUNTIME_MOVEMENT_COMMAND_EXIT_LOCKED",
          ["plan", "request", "targetId"],
          "the selected exit is locked and cannot be used yet.",
          "command",
          "command-execution",
          {
            currentLocationId: currentLocation.locationId,
            targetLocationId: targetLocation.locationId,
            exitId: matchingExit.exitId,
            locked: true
          }
        )
      ],
      initialPlayerState,
      cloneJsonValue(initialPlayerState as JsonValue) as RuntimePlayerState,
      currentLocation.locationId,
      targetLocation.locationId,
      matchingExit.exitId
    );
  }

  if (
    matchingExit.conditionFlag !== undefined
    && !input.playerState.progressFlags.includes(matchingExit.conditionFlag)
  ) {
    return createTerminalResult(
      input,
      "blocked",
      [
        createDiagnostic(
          "RUNTIME_MOVEMENT_COMMAND_EXIT_CONDITION_UNMET",
          ["plan", "request", "targetId"],
          "the selected exit requires a progress flag that is not present on the player state.",
          "command",
          "command-execution",
          {
            currentLocationId: currentLocation.locationId,
            targetLocationId: targetLocation.locationId,
            exitId: matchingExit.exitId,
            conditionFlag: matchingExit.conditionFlag
          }
        )
      ],
      initialPlayerState,
      cloneJsonValue(initialPlayerState as JsonValue) as RuntimePlayerState,
      currentLocation.locationId,
      targetLocation.locationId,
      matchingExit.exitId
    );
  }

  const nextRevision = input.playerState.revision + 1;
  const finalPlayerState = {
    ...input.playerState,
    revision: nextRevision,
    currentLocationId: targetLocation.locationId,
    inventoryItemIds: [...input.playerState.inventoryItemIds],
    progressFlags: [...input.playerState.progressFlags],
    metadata: {
      ...input.playerState.metadata,
      updatedAtRevision: nextRevision
    }
  } satisfies RuntimePlayerState;

  assertRuntimePlayerState(finalPlayerState);

  return createTerminalResult(
    input,
    "executed",
    [],
    initialPlayerState,
    cloneJsonValue(finalPlayerState as JsonValue) as RuntimePlayerState,
    currentLocation.locationId,
    targetLocation.locationId,
    matchingExit.exitId
  );
}
