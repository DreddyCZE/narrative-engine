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

export const RUNTIME_ITEM_PICKUP_COMMAND_EXECUTION_STATUSES = ["executed", "rejected", "blocked"] as const;
export const RUNTIME_ITEM_PICKUP_COMMAND_EXECUTOR_CONTRACT_VERSION = "runtime-item-pickup-command-executor@0.1.0" as const;

const PICKUP_EXECUTION_INPUT_KEYS = new Set(["plan", "content", "playerState", "metadata"]);
const PICKUP_EXECUTION_METADATA_KEYS = new Set(["requestId", "correlationId", "deterministic"]);

export type RuntimeItemPickupCommandExecutionStatus = (typeof RUNTIME_ITEM_PICKUP_COMMAND_EXECUTION_STATUSES)[number];
export type RuntimeItemPickupCommandDiagnostic = ValidationDiagnostic;

export type RuntimeItemPickupCommandExecutorInput = {
  readonly plan: RuntimeCommandPlan;
  readonly content: ContentReadModel | ContentReadModelInput;
  readonly playerState: RuntimePlayerState;
  readonly metadata?: {
    readonly requestId?: string;
    readonly correlationId?: string;
    readonly deterministic?: true;
  };
};

export type RuntimeItemPickupCommandExecutorResult = {
  readonly status: RuntimeItemPickupCommandExecutionStatus;
  readonly commandId: "take";
  readonly itemId?: string;
  readonly fromLocationId?: string;
  readonly initialPlayerState?: RuntimePlayerState;
  readonly finalPlayerState?: RuntimePlayerState;
  readonly diagnostics: readonly RuntimeItemPickupCommandDiagnostic[];
  readonly metadata: {
    readonly deterministic: true;
    readonly pickupVersion: typeof RUNTIME_ITEM_PICKUP_COMMAND_EXECUTOR_CONTRACT_VERSION;
    readonly diagnosticCount: number;
    readonly requestId?: string;
    readonly correlationId?: string;
  };
};

export class RuntimeItemPickupCommandExecutionValidationError extends TypeError {
  public readonly diagnostics: readonly RuntimeItemPickupCommandDiagnostic[];

  public constructor(diagnostics: readonly RuntimeItemPickupCommandDiagnostic[]) {
    super(formatRuntimeItemPickupCommandExecutionValidationMessage(diagnostics));
    this.name = "RuntimeItemPickupCommandExecutionValidationError";
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
): RuntimeItemPickupCommandDiagnostic {
  return createValidationDiagnostic({
    ownerContract: RUNTIME_ITEM_PICKUP_COMMAND_EXECUTOR_CONTRACT_VERSION,
    code,
    severity: "error",
    category,
    phase,
    path,
    message,
    source: {
      kind: "runtime-item-pickup-command-executor",
      id: "item-pickup-execution-input",
      path
    },
    ...(details === undefined ? {} : { details })
  });
}

function prefixDiagnostics(
  diagnostics: readonly ValidationDiagnostic[],
  pathPrefix: readonly JsonPathSegment[],
  sourceId: string
): readonly RuntimeItemPickupCommandDiagnostic[] {
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

function inspectMetadata(value: unknown): readonly RuntimeItemPickupCommandDiagnostic[] {
  if (value === undefined) {
    return [];
  }

  if (!isRecord(value)) {
    return [
      createDiagnostic(
        "RUNTIME_ITEM_PICKUP_COMMAND_EXECUTION_METADATA_INVALID",
        ["metadata"],
        "metadata must be an object when present.",
        "shape",
        "shape-validation"
      )
    ];
  }

  const diagnostics: RuntimeItemPickupCommandDiagnostic[] = [];

  for (const key of Object.keys(value)) {
    if (!PICKUP_EXECUTION_METADATA_KEYS.has(key)) {
      diagnostics.push(
        createDiagnostic(
          "RUNTIME_ITEM_PICKUP_COMMAND_EXECUTION_METADATA_UNKNOWN_FIELD",
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
        "RUNTIME_ITEM_PICKUP_COMMAND_EXECUTION_METADATA_INVALID",
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
        "RUNTIME_ITEM_PICKUP_COMMAND_EXECUTION_METADATA_INVALID",
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
        "RUNTIME_ITEM_PICKUP_COMMAND_EXECUTION_METADATA_INVALID",
        ["metadata", "deterministic"],
        "metadata.deterministic must be true when present.",
        "shape",
        "shape-validation"
      )
    );
  }

  return diagnostics;
}

function inspectPlanShape(value: unknown): readonly RuntimeItemPickupCommandDiagnostic[] {
  if (!isRecord(value)) {
    return [
      createDiagnostic(
        "RUNTIME_ITEM_PICKUP_COMMAND_EXECUTION_PLAN_INVALID",
        ["plan"],
        "plan must be an object.",
        "shape",
        "shape-validation"
      )
    ];
  }

  const diagnostics: RuntimeItemPickupCommandDiagnostic[] = [];

  for (const issue of inspectJsonSafety(value)) {
    diagnostics.push(
      createDiagnostic(
        issue.code === "FORBIDDEN_KEY"
          ? "RUNTIME_ITEM_PICKUP_COMMAND_EXECUTION_FORBIDDEN_KEY"
          : "RUNTIME_ITEM_PICKUP_COMMAND_EXECUTION_NON_JSON_VALUE",
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
        "RUNTIME_ITEM_PICKUP_COMMAND_EXECUTION_PLAN_INVALID",
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
        "RUNTIME_ITEM_PICKUP_COMMAND_EXECUTION_PLAN_INVALID",
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
        "RUNTIME_ITEM_PICKUP_COMMAND_EXECUTION_PLAN_INVALID",
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
  input: Partial<RuntimeItemPickupCommandExecutorInput>,
  diagnosticCount: number
): RuntimeItemPickupCommandExecutorResult["metadata"] {
  return {
    deterministic: true,
    pickupVersion: RUNTIME_ITEM_PICKUP_COMMAND_EXECUTOR_CONTRACT_VERSION,
    diagnosticCount,
    ...(input.metadata?.requestId === undefined ? {} : { requestId: input.metadata.requestId }),
    ...(input.metadata?.correlationId === undefined ? {} : { correlationId: input.metadata.correlationId })
  };
}

function createTerminalResult(
  input: Partial<RuntimeItemPickupCommandExecutorInput>,
  status: RuntimeItemPickupCommandExecutionStatus,
  diagnostics: readonly RuntimeItemPickupCommandDiagnostic[],
  initialPlayerState?: RuntimePlayerState,
  finalPlayerState?: RuntimePlayerState,
  itemId?: string,
  fromLocationId?: string
): RuntimeItemPickupCommandExecutorResult {
  const sortedDiagnostics = sortValidationDiagnostics(diagnostics);
  const result: RuntimeItemPickupCommandExecutorResult = {
    status,
    commandId: "take",
    ...(itemId === undefined ? {} : { itemId }),
    ...(fromLocationId === undefined ? {} : { fromLocationId }),
    ...(initialPlayerState === undefined ? {} : { initialPlayerState }),
    ...(finalPlayerState === undefined ? {} : { finalPlayerState }),
    diagnostics: sortedDiagnostics,
    metadata: createMetadata(input, sortedDiagnostics.length)
  };

  return cloneJsonValue(result as JsonValue) as RuntimeItemPickupCommandExecutorResult;
}

function createPreservedStateResult(
  input: RuntimeItemPickupCommandExecutorInput,
  status: RuntimeItemPickupCommandExecutionStatus,
  diagnostics: readonly RuntimeItemPickupCommandDiagnostic[],
  itemId?: string,
  fromLocationId?: string
): RuntimeItemPickupCommandExecutorResult {
  const initialPlayerState = cloneJsonValue(input.playerState as JsonValue) as RuntimePlayerState;
  return createTerminalResult(
    input,
    status,
    diagnostics,
    initialPlayerState,
    cloneJsonValue(initialPlayerState as JsonValue) as RuntimePlayerState,
    itemId,
    fromLocationId
  );
}

export function inspectRuntimeItemPickupCommandExecutionInput(
  value: unknown
): readonly RuntimeItemPickupCommandDiagnostic[] {
  if (!isRecord(value)) {
    return [
      createDiagnostic(
        "RUNTIME_ITEM_PICKUP_COMMAND_EXECUTION_INPUT_INVALID",
        [],
        "runtime item pickup command execution input must be an object.",
        "shape",
        "shape-validation"
      )
    ];
  }

  const diagnostics: RuntimeItemPickupCommandDiagnostic[] = [];

  for (const key of Object.keys(value)) {
    if (!PICKUP_EXECUTION_INPUT_KEYS.has(key)) {
      diagnostics.push(
        createDiagnostic(
          "RUNTIME_ITEM_PICKUP_COMMAND_EXECUTION_INPUT_UNKNOWN_FIELD",
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
        "RUNTIME_ITEM_PICKUP_COMMAND_EXECUTION_INPUT_INVALID",
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
        "RUNTIME_ITEM_PICKUP_COMMAND_EXECUTION_INPUT_INVALID",
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
        "RUNTIME_ITEM_PICKUP_COMMAND_EXECUTION_INPUT_INVALID",
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

export function formatRuntimeItemPickupCommandExecutionValidationMessage(
  diagnostics: readonly RuntimeItemPickupCommandDiagnostic[]
): string {
  const firstDiagnostic = diagnostics[0];
  if (firstDiagnostic === undefined) {
    return "Runtime item pickup command execution input is valid.";
  }

  return `${firstDiagnostic.code} @ ${formatJsonPath(firstDiagnostic.path)}: ${firstDiagnostic.message}`;
}

export function assertRuntimeItemPickupCommandExecutionInput(
  value: unknown
): asserts value is RuntimeItemPickupCommandExecutorInput {
  const diagnostics = inspectRuntimeItemPickupCommandExecutionInput(value);
  if (diagnostics.length > 0) {
    throw new RuntimeItemPickupCommandExecutionValidationError(diagnostics);
  }
}

export function executeRuntimeItemPickupCommand(
  input: RuntimeItemPickupCommandExecutorInput
): RuntimeItemPickupCommandExecutorResult {
  const inputDiagnostics = inspectRuntimeItemPickupCommandExecutionInput(input);

  if (inputDiagnostics.length > 0) {
    return createPreservedStateResult(input, "rejected", inputDiagnostics);
  }

  const plan = cloneJsonValue(input.plan as JsonValue) as RuntimeCommandPlan;
  const commandId = plan.request.commandId;

  if (plan.commandId !== "take" || commandId !== "take") {
    return createPreservedStateResult(
      input,
      "rejected",
      [
        createDiagnostic(
          "RUNTIME_ITEM_PICKUP_COMMAND_NOT_TAKE",
          ["plan", "commandId"],
          "item pickup executor accepts only planned take commands.",
          "command",
          "command-execution",
          { commandId: plan.commandId, requestCommandId: commandId }
        )
      ]
    );
  }

  const content = isContentReadModel(input.content) ? input.content : createContentReadModel(input.content);
  const currentLocationId = input.playerState.currentLocationId;
  const currentLocation = content.getLocation(currentLocationId);
  const targetItemId = plan.request.targetId;

  if (currentLocation === undefined) {
    return createPreservedStateResult(
      input,
      "blocked",
      [
        createDiagnostic(
          "RUNTIME_ITEM_PICKUP_COMMAND_CURRENT_LOCATION_UNRESOLVED",
          ["playerState", "currentLocationId"],
          "currentLocationId does not resolve to a content location.",
          "reference",
          "command-execution",
          { currentLocationId }
        )
      ],
      targetItemId,
      currentLocationId
    );
  }

  if (targetItemId === undefined) {
    return createPreservedStateResult(
      input,
      "blocked",
      [
        ...(plan.status === "planned"
          ? []
          : prefixDiagnostics(plan.diagnostics, ["plan", "diagnostics"], "item-pickup-plan")),
        ...(plan.status === "planned"
          ? []
          : [
              createDiagnostic(
                "RUNTIME_ITEM_PICKUP_COMMAND_PLAN_NOT_PLANNED",
                ["plan", "status"],
                "item pickup execution requires a planned take command.",
                "command",
                "command-execution",
                { planStatus: plan.status }
              )
            ]),
        createDiagnostic(
          "RUNTIME_ITEM_PICKUP_COMMAND_TARGET_REQUIRED",
          ["plan", "request", "targetId"],
          "targetId is required for item pickup execution.",
          "reference",
          "command-execution",
          { currentLocationId }
        )
      ],
      undefined,
      currentLocation.locationId
    );
  }

  const item = content.getItem(targetItemId);
  if (item === undefined) {
    return createPreservedStateResult(
      input,
      "blocked",
      [
        ...(plan.status === "planned"
          ? []
          : prefixDiagnostics(plan.diagnostics, ["plan", "diagnostics"], "item-pickup-plan")),
        ...(plan.status === "planned"
          ? []
          : [
              createDiagnostic(
                "RUNTIME_ITEM_PICKUP_COMMAND_PLAN_NOT_PLANNED",
                ["plan", "status"],
                "item pickup execution requires a planned take command.",
                "command",
                "command-execution",
                { planStatus: plan.status }
              )
            ]),
        createDiagnostic(
          "RUNTIME_ITEM_PICKUP_COMMAND_ITEM_NOT_FOUND",
          ["plan", "request", "targetId"],
          "target pickup item does not exist in the current content read model.",
          "reference",
          "command-execution",
          { currentLocationId, itemId: targetItemId }
        )
      ],
      targetItemId,
      currentLocation.locationId
    );
  }

  if (plan.status !== "planned") {
    return createPreservedStateResult(
      input,
      plan.status === "rejected" ? "rejected" : "blocked",
      [
        ...prefixDiagnostics(plan.diagnostics, ["plan", "diagnostics"], "item-pickup-plan"),
        createDiagnostic(
          "RUNTIME_ITEM_PICKUP_COMMAND_PLAN_NOT_PLANNED",
          ["plan", "status"],
          "item pickup execution requires a planned take command.",
          "command",
          "command-execution",
          { planStatus: plan.status }
        )
      ],
      targetItemId,
      currentLocation.locationId
    );
  }

  if (input.playerState.inventoryItemIds.includes(targetItemId)) {
    return createPreservedStateResult(
      input,
      "blocked",
      [
        createDiagnostic(
          "RUNTIME_ITEM_PICKUP_COMMAND_ITEM_ALREADY_IN_INVENTORY",
          ["playerState", "inventoryItemIds"],
          "the selected item is already present in inventory.",
          "state",
          "command-execution",
          {
            currentLocationId,
            itemId: targetItemId,
            ...(item.locationId === undefined ? {} : { itemLocationId: item.locationId }),
            inventoryItemIds: [...input.playerState.inventoryItemIds]
          }
        )
      ],
      targetItemId,
      currentLocation.locationId
    );
  }

  if (item.locationId !== currentLocation.locationId) {
    return createPreservedStateResult(
      input,
      "blocked",
      [
        createDiagnostic(
          "RUNTIME_ITEM_PICKUP_COMMAND_ITEM_NOT_VISIBLE_HERE",
          ["plan", "request", "targetId"],
          "the selected item is not visible in the current location.",
          "reference",
          "command-execution",
          {
            currentLocationId,
            itemId: targetItemId,
            ...(item.locationId === undefined ? {} : { itemLocationId: item.locationId }),
            inventoryItemIds: [...input.playerState.inventoryItemIds]
          }
        )
      ],
      targetItemId,
      currentLocation.locationId
    );
  }

  if (item.portable !== true) {
    return createPreservedStateResult(
      input,
      "blocked",
      [
        createDiagnostic(
          "RUNTIME_ITEM_PICKUP_COMMAND_ITEM_NOT_PORTABLE",
          ["plan", "request", "targetId"],
          "the selected item is not marked as portable.",
          "command",
          "command-execution",
          {
            currentLocationId,
            itemId: targetItemId,
            itemLocationId: item.locationId,
            inventoryItemIds: [...input.playerState.inventoryItemIds]
          }
        )
      ],
      targetItemId,
      currentLocation.locationId
    );
  }

  const nextRevision = input.playerState.revision + 1;
  const finalPlayerState = {
    ...input.playerState,
    revision: nextRevision,
    currentLocationId: input.playerState.currentLocationId,
    inventoryItemIds: [...input.playerState.inventoryItemIds, targetItemId],
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
    cloneJsonValue(input.playerState as JsonValue) as RuntimePlayerState,
    cloneJsonValue(finalPlayerState as JsonValue) as RuntimePlayerState,
    targetItemId,
    currentLocation.locationId
  );
}
