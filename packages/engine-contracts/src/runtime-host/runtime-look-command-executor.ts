import {
  canonicalizeJson,
  formatJsonPath,
  inspectJsonSafety,
  type JsonPathSegment,
  type JsonValue
} from "@narrative-engine/core";

import {
  CONTENT_ACTION_AFFORDANCES,
  type ContentActionAffordance
} from "../content/content-package-types.js";
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

export const RUNTIME_LOOK_COMMAND_EXECUTION_STATUSES = ["executed", "rejected", "blocked"] as const;
export const RUNTIME_LOOK_COMMAND_EXECUTOR_CONTRACT_VERSION = "runtime-look-command-executor@0.1.0" as const;

const LOOK_EXECUTION_INPUT_KEYS = new Set(["plan", "content", "playerState", "metadata"]);
const LOOK_EXECUTION_METADATA_KEYS = new Set(["requestId", "correlationId", "deterministic"]);

export type RuntimeLookCommandExecutionStatus = (typeof RUNTIME_LOOK_COMMAND_EXECUTION_STATUSES)[number];
export type RuntimeLookCommandDiagnostic = ValidationDiagnostic;

export type RuntimeLookCommandExecutionMetadata = {
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly deterministic?: true;
};

export type RuntimeLookCommandExitView = {
  readonly exitId: string;
  readonly label: string;
  readonly targetLocationId: string;
  readonly locked?: boolean;
  readonly conditionFlag?: string;
};

export type RuntimeLookCommandItemView = {
  readonly itemId: string;
  readonly title: string;
  readonly description: string;
  readonly portable?: boolean;
};

export type RuntimeLookCommandNpcView = {
  readonly npcId: string;
  readonly name: string;
  readonly dialogueId?: string;
};

export type RuntimeLookCommandView = {
  readonly locationId: string;
  readonly title: string;
  readonly description: string;
  readonly exits: readonly RuntimeLookCommandExitView[];
  readonly items: readonly RuntimeLookCommandItemView[];
  readonly npcs: readonly RuntimeLookCommandNpcView[];
  readonly availableActions: readonly ContentActionAffordance[];
};

export type RuntimeLookCommandExecutionInput = {
  readonly plan: RuntimeCommandPlan;
  readonly content: ContentReadModel | ContentReadModelInput;
  readonly playerState: RuntimePlayerState;
  readonly metadata?: RuntimeLookCommandExecutionMetadata;
};

export type RuntimeLookCommandExecutionResultMetadata = {
  readonly deterministic: true;
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly executorVersion: typeof RUNTIME_LOOK_COMMAND_EXECUTOR_CONTRACT_VERSION;
};

export type RuntimeLookCommandExecutionResult = {
  readonly status: RuntimeLookCommandExecutionStatus;
  readonly commandId: string;
  readonly diagnostics: readonly RuntimeLookCommandDiagnostic[];
  readonly view?: RuntimeLookCommandView;
  readonly metadata: RuntimeLookCommandExecutionResultMetadata;
};

export class RuntimeLookCommandExecutionValidationError extends TypeError {
  public readonly diagnostics: readonly RuntimeLookCommandDiagnostic[];

  public constructor(diagnostics: readonly RuntimeLookCommandDiagnostic[]) {
    super(formatRuntimeLookCommandExecutionValidationMessage(diagnostics));
    this.name = "RuntimeLookCommandExecutionValidationError";
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
): RuntimeLookCommandDiagnostic {
  return createValidationDiagnostic({
    ownerContract: RUNTIME_LOOK_COMMAND_EXECUTOR_CONTRACT_VERSION,
    code,
    severity: "error",
    category,
    phase,
    path,
    message,
    source: {
      kind: "runtime-look-command-executor",
      id: "look-execution-input",
      path
    },
    ...(details === undefined ? {} : { details })
  });
}

function prefixDiagnostics(
  diagnostics: readonly ValidationDiagnostic[],
  pathPrefix: readonly JsonPathSegment[],
  sourceId: string
): readonly RuntimeLookCommandDiagnostic[] {
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

function inspectMetadata(value: unknown): readonly RuntimeLookCommandDiagnostic[] {
  const diagnostics: RuntimeLookCommandDiagnostic[] = [];

  if (value === undefined) {
    return diagnostics;
  }

  if (!isRecord(value)) {
    return [
      createDiagnostic(
        "RUNTIME_LOOK_COMMAND_EXECUTION_METADATA_INVALID",
        ["metadata"],
        "metadata must be an object when present.",
        "shape",
        "shape-validation"
      )
    ];
  }

  for (const key of Object.keys(value)) {
    if (!LOOK_EXECUTION_METADATA_KEYS.has(key)) {
      diagnostics.push(
        createDiagnostic(
          "RUNTIME_LOOK_COMMAND_EXECUTION_METADATA_UNKNOWN_FIELD",
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
        "RUNTIME_LOOK_COMMAND_EXECUTION_METADATA_INVALID",
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
        "RUNTIME_LOOK_COMMAND_EXECUTION_METADATA_INVALID",
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
        "RUNTIME_LOOK_COMMAND_EXECUTION_METADATA_INVALID",
        ["metadata", "deterministic"],
        "metadata.deterministic must be true when present.",
        "shape",
        "shape-validation"
      )
    );
  }

  return diagnostics;
}

function inspectPlanShape(value: unknown): readonly RuntimeLookCommandDiagnostic[] {
  const diagnostics: RuntimeLookCommandDiagnostic[] = [];

  if (!isRecord(value)) {
    return [
      createDiagnostic(
        "RUNTIME_LOOK_COMMAND_EXECUTION_PLAN_INVALID",
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
          ? "RUNTIME_LOOK_COMMAND_EXECUTION_FORBIDDEN_KEY"
          : "RUNTIME_LOOK_COMMAND_EXECUTION_NON_JSON_VALUE",
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
        "RUNTIME_LOOK_COMMAND_EXECUTION_PLAN_INVALID",
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
        "RUNTIME_LOOK_COMMAND_EXECUTION_PLAN_INVALID",
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
        "RUNTIME_LOOK_COMMAND_EXECUTION_PLAN_INVALID",
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
  diagnostics: readonly RuntimeLookCommandDiagnostic[]
): RuntimeLookCommandExecutionStatus {
  if (diagnostics.length === 0) {
    return "executed";
  }

  if (diagnostics.some((diagnostic) =>
    diagnostic.code === "RUNTIME_LOOK_COMMAND_EXECUTOR_COMMAND_UNSUPPORTED" ||
    diagnostic.code.startsWith("RUNTIME_LOOK_COMMAND_EXECUTION_INPUT_INVALID") ||
    diagnostic.code.startsWith("RUNTIME_LOOK_COMMAND_EXECUTION_PLAN_INVALID")
  )) {
    return "rejected";
  }

  return "blocked";
}

function getContentReadModel(input: RuntimeLookCommandExecutionInput): ContentReadModel {
  return isContentReadModel(input.content) ? input.content : createContentReadModel(input.content);
}

function getCommandId(plan: unknown): string {
  return isRecord(plan) && typeof plan.commandId === "string" ? plan.commandId : "";
}

function buildAvailableActions(content: ContentReadModel): readonly ContentActionAffordance[] {
  return CONTENT_ACTION_AFFORDANCES.filter((action) => content.hasActionAffordance(action));
}

function buildView(input: RuntimeLookCommandExecutionInput, content: ContentReadModel): RuntimeLookCommandView | undefined {
  const currentLocation = content.getLocation(input.playerState.currentLocationId);
  if (currentLocation === undefined) {
    return undefined;
  }

  return {
    locationId: currentLocation.locationId,
    title: currentLocation.title,
    description: currentLocation.description,
    exits: content.getExits(currentLocation.locationId).map((exit) => ({
      exitId: exit.exitId,
      label: exit.label,
      targetLocationId: exit.targetLocationId,
      ...(exit.locked === undefined ? {} : { locked: exit.locked }),
      ...(exit.conditionFlag === undefined ? {} : { conditionFlag: exit.conditionFlag })
    })),
    items: content.getItemsInLocation(currentLocation.locationId).map((item) => ({
      itemId: item.itemId,
      title: item.title,
      description: item.description,
      ...(item.portable === undefined ? {} : { portable: item.portable })
    })),
    npcs: content.getNpcsInLocation(currentLocation.locationId).map((npc) => ({
      npcId: npc.npcId,
      name: npc.name,
      ...(npc.dialogueId === undefined ? {} : { dialogueId: npc.dialogueId })
    })),
    availableActions: buildAvailableActions(content)
  };
}

export function inspectRuntimeLookCommandExecutionInput(value: unknown): readonly RuntimeLookCommandDiagnostic[] {
  if (!isRecord(value)) {
    return [
      createDiagnostic(
        "RUNTIME_LOOK_COMMAND_EXECUTION_INPUT_INVALID",
        [],
        "runtime look command execution input must be an object.",
        "shape",
        "shape-validation"
      )
    ];
  }

  const diagnostics: RuntimeLookCommandDiagnostic[] = [];

  for (const key of Object.keys(value)) {
    if (!LOOK_EXECUTION_INPUT_KEYS.has(key)) {
      diagnostics.push(
        createDiagnostic(
          "RUNTIME_LOOK_COMMAND_EXECUTION_INPUT_UNKNOWN_FIELD",
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
        "RUNTIME_LOOK_COMMAND_EXECUTION_INPUT_INVALID",
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
        "RUNTIME_LOOK_COMMAND_EXECUTION_INPUT_INVALID",
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
        "RUNTIME_LOOK_COMMAND_EXECUTION_INPUT_INVALID",
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

export function formatRuntimeLookCommandExecutionValidationMessage(
  diagnostics: readonly RuntimeLookCommandDiagnostic[]
): string {
  const firstDiagnostic = diagnostics[0];
  if (firstDiagnostic === undefined) {
    return "Runtime look command execution input is valid.";
  }

  return `${firstDiagnostic.code} @ ${formatJsonPath(firstDiagnostic.path)}: ${firstDiagnostic.message}`;
}

export function assertRuntimeLookCommandExecutionInput(
  value: unknown
): asserts value is RuntimeLookCommandExecutionInput {
  const diagnostics = inspectRuntimeLookCommandExecutionInput(value);
  if (diagnostics.length > 0) {
    throw new RuntimeLookCommandExecutionValidationError(diagnostics);
  }
}

export function executeRuntimeLookCommand(
  input: RuntimeLookCommandExecutionInput
): RuntimeLookCommandExecutionResult {
  const diagnostics = [...inspectRuntimeLookCommandExecutionInput(input)];
  const commandId = getCommandId(input.plan);

  if (isRecord(input.plan) && input.plan.commandId !== "look") {
    diagnostics.push(
      createDiagnostic(
        "RUNTIME_LOOK_COMMAND_EXECUTOR_COMMAND_UNSUPPORTED",
        ["plan", "commandId"],
        "only the look command is supported by this executor.",
        "validation",
        "command-execution",
        { commandId: input.plan.commandId }
      )
    );
  }

  if (isRecord(input.plan) && input.plan.status !== "planned") {
    diagnostics.push(
      createDiagnostic(
        "RUNTIME_LOOK_COMMAND_EXECUTOR_PLAN_NOT_EXECUTABLE",
        ["plan", "status"],
        "plan must have status planned before look execution can continue.",
        "state",
        "command-execution",
        { planStatus: input.plan.status }
      )
    );
  }

  let view: RuntimeLookCommandView | undefined;
  if (!diagnostics.some((diagnostic) =>
    diagnostic.code === "RUNTIME_LOOK_COMMAND_EXECUTOR_COMMAND_UNSUPPORTED" ||
    diagnostic.code === "RUNTIME_LOOK_COMMAND_EXECUTOR_PLAN_NOT_EXECUTABLE" ||
    diagnostic.code.startsWith("RUNTIME_LOOK_COMMAND_EXECUTION_INPUT_INVALID") ||
    diagnostic.code.startsWith("RUNTIME_LOOK_COMMAND_EXECUTION_PLAN_INVALID") ||
    diagnostic.path[0] === "content" ||
    diagnostic.path[0] === "playerState" ||
    diagnostic.path[0] === "planContext"
  )) {
    const content = getContentReadModel(input);
    view = buildView(input, content);
    if (view === undefined) {
      diagnostics.push(
        createDiagnostic(
          "RUNTIME_LOOK_COMMAND_LOCATION_UNRESOLVED",
          ["playerState", "currentLocationId"],
          "currentLocationId does not resolve to a content location.",
          "reference",
          "command-execution",
          { currentLocationId: input.playerState.currentLocationId }
        )
      );
    }
  }

  const status = classifyExecutionStatus(diagnostics);
  const result: RuntimeLookCommandExecutionResult = {
    status,
    commandId,
    diagnostics: sortValidationDiagnostics(diagnostics),
    ...(status === "executed" && view !== undefined ? { view } : {}),
    metadata: {
      deterministic: true,
      ...(input.metadata?.requestId === undefined ? {} : { requestId: input.metadata.requestId }),
      ...(input.metadata?.correlationId === undefined ? {} : { correlationId: input.metadata.correlationId }),
      executorVersion: RUNTIME_LOOK_COMMAND_EXECUTOR_CONTRACT_VERSION
    }
  };

  return cloneJsonValue(result as JsonValue) as RuntimeLookCommandExecutionResult;
}
