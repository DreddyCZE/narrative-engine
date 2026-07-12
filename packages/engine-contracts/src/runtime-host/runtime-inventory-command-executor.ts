import {
  canonicalizeJson,
  formatJsonPath,
  inspectJsonSafety,
  type JsonPathSegment,
  type JsonValue
} from "@narrative-engine/core";

import {
  createContentReadModel,
  inspectContentReadModelInput,
  type ContentReadModel,
  type ContentReadModelInput
} from "../content-runtime/content-read-model.js";
import {
  inspectRuntimePlayerState,
  type RuntimePlayerState
} from "../content-runtime/runtime-player-state.js";
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

export const RUNTIME_INVENTORY_COMMAND_EXECUTION_STATUSES = ["executed", "rejected", "blocked"] as const;
export const RUNTIME_INVENTORY_COMMAND_EXECUTOR_CONTRACT_VERSION = "runtime-inventory-command-executor@0.1.0" as const;

const INVENTORY_EXECUTION_INPUT_KEYS = new Set(["plan", "content", "playerState", "metadata"]);
const INVENTORY_EXECUTION_METADATA_KEYS = new Set(["requestId", "correlationId", "deterministic"]);

export type RuntimeInventoryCommandExecutionStatus = (typeof RUNTIME_INVENTORY_COMMAND_EXECUTION_STATUSES)[number];
export type RuntimeInventoryCommandDiagnostic = ValidationDiagnostic;

export type RuntimeInventoryCommandExecutionMetadata = {
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly deterministic?: true;
};

export type RuntimeInventoryCommandItemView = {
  readonly itemId: string;
  readonly title: string;
  readonly description: string;
  readonly portable?: boolean;
};

export type RuntimeInventoryCommandView = {
  readonly itemCount: number;
  readonly items: readonly RuntimeInventoryCommandItemView[];
  readonly unresolvedItemIds: readonly string[];
};

export type RuntimeInventoryCommandExecutionInput = {
  readonly plan: RuntimeCommandPlan;
  readonly content: ContentReadModel | ContentReadModelInput;
  readonly playerState: RuntimePlayerState;
  readonly metadata?: RuntimeInventoryCommandExecutionMetadata;
};

export type RuntimeInventoryCommandExecutionResultMetadata = {
  readonly deterministic: true;
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly executorVersion: typeof RUNTIME_INVENTORY_COMMAND_EXECUTOR_CONTRACT_VERSION;
};

export type RuntimeInventoryCommandExecutionResult = {
  readonly status: RuntimeInventoryCommandExecutionStatus;
  readonly commandId: string;
  readonly diagnostics: readonly RuntimeInventoryCommandDiagnostic[];
  readonly view?: RuntimeInventoryCommandView;
  readonly metadata: RuntimeInventoryCommandExecutionResultMetadata;
};

export class RuntimeInventoryCommandExecutionValidationError extends TypeError {
  public readonly diagnostics: readonly RuntimeInventoryCommandDiagnostic[];

  public constructor(diagnostics: readonly RuntimeInventoryCommandDiagnostic[]) {
    super(formatRuntimeInventoryCommandExecutionValidationMessage(diagnostics));
    this.name = "RuntimeInventoryCommandExecutionValidationError";
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
): RuntimeInventoryCommandDiagnostic {
  return createValidationDiagnostic({
    ownerContract: RUNTIME_INVENTORY_COMMAND_EXECUTOR_CONTRACT_VERSION,
    code,
    severity: "error",
    category,
    phase,
    path,
    message,
    source: {
      kind: "runtime-inventory-command-executor",
      id: "inventory-execution-input",
      path
    },
    ...(details === undefined ? {} : { details })
  });
}

function prefixDiagnostics(
  diagnostics: readonly ValidationDiagnostic[],
  pathPrefix: readonly JsonPathSegment[],
  sourceId: string
): readonly RuntimeInventoryCommandDiagnostic[] {
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

function inspectMetadata(value: unknown): readonly RuntimeInventoryCommandDiagnostic[] {
  const diagnostics: RuntimeInventoryCommandDiagnostic[] = [];

  if (value === undefined) {
    return diagnostics;
  }

  if (!isRecord(value)) {
    return [
      createDiagnostic(
        "RUNTIME_INVENTORY_COMMAND_EXECUTION_METADATA_INVALID",
        ["metadata"],
        "metadata must be an object when present.",
        "shape",
        "shape-validation"
      )
    ];
  }

  for (const key of Object.keys(value)) {
    if (!INVENTORY_EXECUTION_METADATA_KEYS.has(key)) {
      diagnostics.push(
        createDiagnostic(
          "RUNTIME_INVENTORY_COMMAND_EXECUTION_METADATA_UNKNOWN_FIELD",
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
        "RUNTIME_INVENTORY_COMMAND_EXECUTION_METADATA_INVALID",
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
        "RUNTIME_INVENTORY_COMMAND_EXECUTION_METADATA_INVALID",
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
        "RUNTIME_INVENTORY_COMMAND_EXECUTION_METADATA_INVALID",
        ["metadata", "deterministic"],
        "metadata.deterministic must be true when present.",
        "shape",
        "shape-validation"
      )
    );
  }

  return diagnostics;
}

function inspectPlanShape(value: unknown): readonly RuntimeInventoryCommandDiagnostic[] {
  const diagnostics: RuntimeInventoryCommandDiagnostic[] = [];

  if (!isRecord(value)) {
    return [
      createDiagnostic(
        "RUNTIME_INVENTORY_COMMAND_EXECUTION_PLAN_INVALID",
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
          ? "RUNTIME_INVENTORY_COMMAND_EXECUTION_FORBIDDEN_KEY"
          : "RUNTIME_INVENTORY_COMMAND_EXECUTION_NON_JSON_VALUE",
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
        "RUNTIME_INVENTORY_COMMAND_EXECUTION_PLAN_INVALID",
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
        "RUNTIME_INVENTORY_COMMAND_EXECUTION_PLAN_INVALID",
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
        "RUNTIME_INVENTORY_COMMAND_EXECUTION_PLAN_INVALID",
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
  diagnostics: readonly RuntimeInventoryCommandDiagnostic[]
): RuntimeInventoryCommandExecutionStatus {
  if (diagnostics.length === 0) {
    return "executed";
  }

  if (diagnostics.some((diagnostic) =>
    diagnostic.code === "RUNTIME_INVENTORY_COMMAND_EXECUTOR_COMMAND_UNSUPPORTED" ||
    diagnostic.code.startsWith("RUNTIME_INVENTORY_COMMAND_EXECUTION_INPUT_INVALID") ||
    diagnostic.code.startsWith("RUNTIME_INVENTORY_COMMAND_EXECUTION_PLAN_INVALID")
  )) {
    return "rejected";
  }

  return "blocked";
}

function getContentReadModel(input: RuntimeInventoryCommandExecutionInput): ContentReadModel {
  return isContentReadModel(input.content) ? input.content : createContentReadModel(input.content);
}

function getCommandId(plan: unknown): string {
  return isRecord(plan) && typeof plan.commandId === "string" ? plan.commandId : "";
}

function buildView(input: RuntimeInventoryCommandExecutionInput, content: ContentReadModel): RuntimeInventoryCommandView | undefined {
  const items: RuntimeInventoryCommandItemView[] = [];
  const unresolvedItemIds: string[] = [];

  for (const itemId of input.playerState.inventoryItemIds) {
    const item = content.getItem(itemId);
    if (item === undefined) {
      unresolvedItemIds.push(itemId);
      continue;
    }

    items.push({
      itemId: item.itemId,
      title: item.title,
      description: item.description,
      ...(item.portable === undefined ? {} : { portable: item.portable })
    });
  }

  if (unresolvedItemIds.length > 0) {
    return undefined;
  }

  return {
    itemCount: items.length,
    items,
    unresolvedItemIds: []
  };
}

export function inspectRuntimeInventoryCommandExecutionInput(
  value: unknown
): readonly RuntimeInventoryCommandDiagnostic[] {
  if (!isRecord(value)) {
    return [
      createDiagnostic(
        "RUNTIME_INVENTORY_COMMAND_EXECUTION_INPUT_INVALID",
        [],
        "runtime inventory command execution input must be an object.",
        "shape",
        "shape-validation"
      )
    ];
  }

  const diagnostics: RuntimeInventoryCommandDiagnostic[] = [];

  for (const key of Object.keys(value)) {
    if (!INVENTORY_EXECUTION_INPUT_KEYS.has(key)) {
      diagnostics.push(
        createDiagnostic(
          "RUNTIME_INVENTORY_COMMAND_EXECUTION_INPUT_UNKNOWN_FIELD",
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
        "RUNTIME_INVENTORY_COMMAND_EXECUTION_INPUT_INVALID",
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
        "RUNTIME_INVENTORY_COMMAND_EXECUTION_INPUT_INVALID",
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
        "RUNTIME_INVENTORY_COMMAND_EXECUTION_INPUT_INVALID",
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

export function formatRuntimeInventoryCommandExecutionValidationMessage(
  diagnostics: readonly RuntimeInventoryCommandDiagnostic[]
): string {
  const firstDiagnostic = diagnostics[0];
  if (firstDiagnostic === undefined) {
    return "Runtime inventory command execution input is valid.";
  }

  return `${firstDiagnostic.code} @ ${formatJsonPath(firstDiagnostic.path)}: ${firstDiagnostic.message}`;
}

export function assertRuntimeInventoryCommandExecutionInput(
  value: unknown
): asserts value is RuntimeInventoryCommandExecutionInput {
  const diagnostics = inspectRuntimeInventoryCommandExecutionInput(value);
  if (diagnostics.length > 0) {
    throw new RuntimeInventoryCommandExecutionValidationError(diagnostics);
  }
}

export function executeRuntimeInventoryCommand(
  input: RuntimeInventoryCommandExecutionInput
): RuntimeInventoryCommandExecutionResult {
  const diagnostics = [...inspectRuntimeInventoryCommandExecutionInput(input)];
  const commandId = getCommandId(input.plan);

  if (isRecord(input.plan) && input.plan.commandId !== "inventory") {
    diagnostics.push(
      createDiagnostic(
        "RUNTIME_INVENTORY_COMMAND_EXECUTOR_COMMAND_UNSUPPORTED",
        ["plan", "commandId"],
        "only the inventory command is supported by this executor.",
        "validation",
        "command-execution",
        { commandId: input.plan.commandId }
      )
    );
  }

  if (isRecord(input.plan) && input.plan.status !== "planned") {
    diagnostics.push(
      createDiagnostic(
        "RUNTIME_INVENTORY_COMMAND_EXECUTOR_PLAN_NOT_EXECUTABLE",
        ["plan", "status"],
        "plan must have status planned before inventory execution can continue.",
        "state",
        "command-execution",
        { planStatus: input.plan.status }
      )
    );
  }

  let view: RuntimeInventoryCommandView | undefined;
  if (!diagnostics.some((diagnostic) =>
    diagnostic.code === "RUNTIME_INVENTORY_COMMAND_EXECUTOR_COMMAND_UNSUPPORTED" ||
    diagnostic.code === "RUNTIME_INVENTORY_COMMAND_EXECUTOR_PLAN_NOT_EXECUTABLE" ||
    diagnostic.code.startsWith("RUNTIME_INVENTORY_COMMAND_EXECUTION_INPUT_INVALID") ||
    diagnostic.code.startsWith("RUNTIME_INVENTORY_COMMAND_EXECUTION_PLAN_INVALID") ||
    diagnostic.path[0] === "content" ||
    diagnostic.path[0] === "playerState" ||
    diagnostic.path[0] === "planContext"
  )) {
    const content = getContentReadModel(input);
    view = buildView(input, content);
    if (view === undefined) {
      for (const [index, itemId] of input.playerState.inventoryItemIds.entries()) {
        if (content.getItem(itemId) === undefined) {
          diagnostics.push(
            createDiagnostic(
              "RUNTIME_INVENTORY_COMMAND_ITEM_UNRESOLVED",
              ["playerState", "inventoryItemIds", index],
              "inventory item id does not resolve to a content item.",
              "reference",
              "command-execution",
              { itemId }
            )
          );
        }
      }
    }
  }

  const status = classifyExecutionStatus(diagnostics);
  const result: RuntimeInventoryCommandExecutionResult = {
    status,
    commandId,
    diagnostics: sortValidationDiagnostics(diagnostics),
    ...(status === "executed" && view !== undefined ? { view } : {}),
    metadata: {
      deterministic: true,
      ...(input.metadata?.requestId === undefined ? {} : { requestId: input.metadata.requestId }),
      ...(input.metadata?.correlationId === undefined ? {} : { correlationId: input.metadata.correlationId }),
      executorVersion: RUNTIME_INVENTORY_COMMAND_EXECUTOR_CONTRACT_VERSION
    }
  };

  return cloneJsonValue(result as JsonValue) as RuntimeInventoryCommandExecutionResult;
}
