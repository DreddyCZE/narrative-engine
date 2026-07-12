import {
  canonicalizeJson,
  formatJsonPath,
  type JsonPathSegment,
  type JsonValue
} from "@narrative-engine/core";

import { type ContentActionAffordance } from "../content/content-package-types.js";
import {
  createContentReadModel,
  type ContentReadModel,
  type ContentReadModelInput
} from "../content-runtime/content-read-model.js";
import {
  inspectRuntimePlayerState,
  type RuntimePlayerState
} from "../content-runtime/runtime-player-state.js";
import {
  inspectRuntimeCommandRequestAgainstContent,
  type RuntimeCommandRequestValidationInput
} from "./runtime-command-request-validation.js";
import { type RuntimeCommandRequest } from "./runtime-host-types.js";
import {
  createValidationDiagnostic,
  sortValidationDiagnostics,
  type ValidationDiagnostic,
  type ValidationDiagnosticCategory,
  type ValidationDiagnosticPhase
} from "../validation-diagnostic/validation-diagnostic.js";

export const RUNTIME_COMMAND_PLAN_STATUSES = ["planned", "rejected", "blocked"] as const;
export const RUNTIME_COMMAND_PLANNING_CONTRACT_VERSION = "runtime-command-planning@0.1.0" as const;

const COMMAND_KIND_BY_ID = {
  look: "read",
  go: "movement",
  talk: "interaction",
  take: "inventory",
  use: "interaction",
  inventory: "read",
  save: "system",
  load: "system"
} as const;

const TARGET_REQUIRED_COMMANDS = new Set<ContentActionAffordance>(["go", "talk", "take", "use"]);

export type RuntimeCommandPlanStatus = (typeof RUNTIME_COMMAND_PLAN_STATUSES)[number];
export type RuntimeCommandKind = (typeof COMMAND_KIND_BY_ID)[ContentActionAffordance] | "unknown";
export type RuntimeCommandPlanDiagnostic = ValidationDiagnostic;

export type RuntimeCommandPlanningMetadata = {
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly deterministic?: true;
};

export type RuntimeCommandPlanningInput = {
  readonly request: RuntimeCommandRequest;
  readonly content: ContentReadModel | ContentReadModelInput;
  readonly playerState: RuntimePlayerState;
  readonly metadata?: RuntimeCommandPlanningMetadata;
};

export type RuntimeCommandPlanStep = {
  readonly stepId: string;
  readonly kind: string;
  readonly description: string;
  readonly commandId?: string;
  readonly targetId?: string;
  readonly required?: true;
};

export type RuntimeCommandPlanMetadata = {
  readonly deterministic: true;
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly planningVersion: typeof RUNTIME_COMMAND_PLANNING_CONTRACT_VERSION;
};

export type RuntimeCommandPlan = {
  readonly status: RuntimeCommandPlanStatus;
  readonly request: RuntimeCommandRequest;
  readonly commandId: string;
  readonly commandKind: RuntimeCommandKind;
  readonly steps: readonly RuntimeCommandPlanStep[];
  readonly diagnostics: readonly RuntimeCommandPlanDiagnostic[];
  readonly metadata: RuntimeCommandPlanMetadata;
};

export class RuntimeCommandPlanningValidationError extends TypeError {
  public readonly diagnostics: readonly RuntimeCommandPlanDiagnostic[];

  public constructor(diagnostics: readonly RuntimeCommandPlanDiagnostic[]) {
    super(formatRuntimeCommandPlanningValidationMessage(diagnostics));
    this.name = "RuntimeCommandPlanningValidationError";
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
): RuntimeCommandPlanDiagnostic {
  return createValidationDiagnostic({
    ownerContract: RUNTIME_COMMAND_PLANNING_CONTRACT_VERSION,
    code,
    severity: "error",
    category,
    phase,
    path,
    message,
    source: {
      kind: "runtime-command-planning",
      id: "planning-input",
      path
    },
    ...(details === undefined ? {} : { details })
  });
}

function prefixDiagnostics(
  diagnostics: readonly ValidationDiagnostic[],
  pathPrefix: readonly JsonPathSegment[],
  sourceId: string
): readonly RuntimeCommandPlanDiagnostic[] {
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

function inspectPlanningMetadata(value: unknown): readonly RuntimeCommandPlanDiagnostic[] {
  const diagnostics: RuntimeCommandPlanDiagnostic[] = [];

  if (value === undefined) {
    return diagnostics;
  }

  if (!isRecord(value)) {
    return [
      createDiagnostic(
        "RUNTIME_COMMAND_PLANNING_METADATA_INVALID",
        ["metadata"],
        "metadata must be an object when present.",
        "shape",
        "shape-validation"
      )
    ];
  }

  for (const key of Object.keys(value)) {
    if (!["requestId", "correlationId", "deterministic"].includes(key)) {
      diagnostics.push(
        createDiagnostic(
          "RUNTIME_COMMAND_PLANNING_METADATA_UNKNOWN_FIELD",
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
        "RUNTIME_COMMAND_PLANNING_METADATA_INVALID",
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
        "RUNTIME_COMMAND_PLANNING_METADATA_INVALID",
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
        "RUNTIME_COMMAND_PLANNING_METADATA_INVALID",
        ["metadata", "deterministic"],
        "metadata.deterministic must be true when present.",
        "shape",
        "shape-validation"
      )
    );
  }

  return diagnostics;
}

function getCommandId(value: unknown): string {
  return isRecord(value) && typeof value.commandId === "string" ? value.commandId : "";
}

function getCommandKind(commandId: string): RuntimeCommandKind {
  if (commandId in COMMAND_KIND_BY_ID) {
    return COMMAND_KIND_BY_ID[commandId as ContentActionAffordance];
  }
  return "unknown";
}

function getContentReadModel(input: RuntimeCommandPlanningInput): ContentReadModel {
  return isContentReadModel(input.content) ? input.content : createContentReadModel(input.content);
}

function classifyPlanningStatus(
  diagnostics: readonly RuntimeCommandPlanDiagnostic[]
): RuntimeCommandPlanStatus {
  if (diagnostics.length === 0) {
    return "planned";
  }

  if (diagnostics.some((diagnostic) =>
    diagnostic.code.startsWith("RUNTIME_COMMAND_REQUEST_") &&
    diagnostic.code !== "RUNTIME_COMMAND_REQUEST_COMMAND_UNAVAILABLE" &&
    !diagnostic.path.includes("playerState") &&
    !diagnostic.path.includes("content")
  )) {
    return "rejected";
  }

  if (diagnostics.some((diagnostic) => diagnostic.code.startsWith("RUNTIME_COMMAND_PLANNING_INPUT_INVALID"))) {
    return "rejected";
  }

  return "blocked";
}

function createPlanStep(
  stepId: string,
  kind: string,
  description: string,
  commandId: string,
  targetId?: string
): RuntimeCommandPlanStep {
  return {
    stepId,
    kind,
    description,
    commandId,
    ...(targetId === undefined ? {} : { targetId }),
    required: true
  };
}

function buildPlannedSteps(commandId: ContentActionAffordance, targetId: string | undefined): readonly RuntimeCommandPlanStep[] {
  const stepMap: Record<ContentActionAffordance, readonly RuntimeCommandPlanStep[]> = {
    look: [
      createPlanStep(
        "step.look.describe-current-location",
        "describe-current-location",
        "Describe the current player location from the read-only content model.",
        "look"
      )
    ],
    go: [
      createPlanStep(
        "step.go.prepare-movement-target-validation",
        "prepare-movement-target-validation",
        "Prepare read-only validation of the requested movement target.",
        "go",
        targetId
      )
    ],
    talk: [
      createPlanStep(
        "step.talk.prepare-npc-interaction-target-validation",
        "prepare-npc-interaction-target-validation",
        "Prepare read-only NPC interaction target validation.",
        "talk",
        targetId
      )
    ],
    take: [
      createPlanStep(
        "step.take.prepare-item-pickup-target-validation",
        "prepare-item-pickup-target-validation",
        "Prepare read-only item pickup target validation.",
        "take",
        targetId
      )
    ],
    use: [
      createPlanStep(
        "step.use.prepare-use-interaction-target-validation",
        "prepare-use-interaction-target-validation",
        "Prepare read-only use interaction target validation.",
        "use",
        targetId
      )
    ],
    inventory: [
      createPlanStep(
        "step.inventory.describe-inventory-state",
        "describe-inventory-state",
        "Describe the current inventory state without mutating it.",
        "inventory"
      )
    ],
    save: [
      createPlanStep(
        "step.save.prepare-save-request",
        "prepare-save-request",
        "Prepare a read-only save request descriptor for a future executor.",
        "save"
      )
    ],
    load: [
      createPlanStep(
        "step.load.prepare-load-request",
        "prepare-load-request",
        "Prepare a read-only load request descriptor for a future executor.",
        "load"
      )
    ]
  };

  return stepMap[commandId];
}

function resolveTargetDiagnostic(
  request: RuntimeCommandRequest,
  content: ContentReadModel
): RuntimeCommandPlanDiagnostic | undefined {
  const commandId = request.commandId as ContentActionAffordance;

  if (TARGET_REQUIRED_COMMANDS.has(commandId) && request.targetId === undefined) {
    return createDiagnostic(
      "RUNTIME_COMMAND_PLAN_TARGET_REQUIRED",
      ["request", "targetId"],
      "targetId is required for this command.",
      "reference",
      "command-planning"
    );
  }

  if (request.targetId === undefined) {
    return undefined;
  }

  if (commandId === "go" && content.getLocation(request.targetId) === undefined) {
    return createDiagnostic(
      "RUNTIME_COMMAND_PLAN_TARGET_UNRESOLVED",
      ["request", "targetId"],
      "movement target does not exist in the current content read model.",
      "reference",
      "command-planning",
      { commandId, targetId: request.targetId }
    );
  }

  if (commandId === "talk" && content.getNpc(request.targetId) === undefined) {
    return createDiagnostic(
      "RUNTIME_COMMAND_PLAN_TARGET_UNRESOLVED",
      ["request", "targetId"],
      "interaction target does not exist as an NPC in the current content read model.",
      "reference",
      "command-planning",
      { commandId, targetId: request.targetId }
    );
  }

  if (commandId === "take" && content.getItem(request.targetId) === undefined) {
    return createDiagnostic(
      "RUNTIME_COMMAND_PLAN_TARGET_UNRESOLVED",
      ["request", "targetId"],
      "inventory target does not exist as an item in the current content read model.",
      "reference",
      "command-planning",
      { commandId, targetId: request.targetId }
    );
  }

  if (
    commandId === "use" &&
    content.getItem(request.targetId) === undefined &&
    content.getNpc(request.targetId) === undefined &&
    content.getLocation(request.targetId) === undefined
  ) {
    return createDiagnostic(
      "RUNTIME_COMMAND_PLAN_TARGET_UNRESOLVED",
      ["request", "targetId"],
      "interaction target does not exist in the current content read model.",
      "reference",
      "command-planning",
      { commandId, targetId: request.targetId }
    );
  }

  return undefined;
}

export function inspectRuntimeCommandPlanningInput(value: unknown): readonly RuntimeCommandPlanDiagnostic[] {
  if (!isRecord(value)) {
    return [
      createDiagnostic(
        "RUNTIME_COMMAND_PLANNING_INPUT_INVALID",
        [],
        "runtime command planning input must be an object.",
        "shape",
        "shape-validation"
      )
    ];
  }

  const diagnostics: RuntimeCommandPlanDiagnostic[] = [];

  if (!("request" in value)) {
    diagnostics.push(
      createDiagnostic(
        "RUNTIME_COMMAND_PLANNING_INPUT_INVALID",
        ["request"],
        "request is required.",
        "shape",
        "shape-validation"
      )
    );
  }

  if (!("content" in value)) {
    diagnostics.push(
      createDiagnostic(
        "RUNTIME_COMMAND_PLANNING_INPUT_INVALID",
        ["content"],
        "content is required.",
        "shape",
        "shape-validation"
      )
    );
  }

  if (!("playerState" in value)) {
    diagnostics.push(
      createDiagnostic(
        "RUNTIME_COMMAND_PLANNING_INPUT_INVALID",
        ["playerState"],
        "playerState is required.",
        "shape",
        "shape-validation"
      )
    );
  }

  for (const key of Object.keys(value)) {
    if (!["request", "content", "playerState", "metadata"].includes(key)) {
      diagnostics.push(
        createDiagnostic(
          "RUNTIME_COMMAND_PLANNING_INPUT_UNKNOWN_FIELD",
          [key],
          `unknown field "${key}" is not allowed.`,
          "shape",
          "shape-validation"
        )
      );
    }
  }

  diagnostics.push(...inspectPlanningMetadata(value.metadata));

  if ("request" in value && "content" in value) {
    const requestAndContentDiagnostics = inspectRuntimeCommandRequestAgainstContent({
      request: value.request,
      content: value.content as RuntimeCommandRequestValidationInput["content"]
    });
    diagnostics.push(...requestAndContentDiagnostics);
  }

  if ("playerState" in value) {
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

export function formatRuntimeCommandPlanningValidationMessage(
  diagnostics: readonly RuntimeCommandPlanDiagnostic[]
): string {
  const firstDiagnostic = diagnostics[0];
  if (firstDiagnostic === undefined) {
    return "Runtime command planning input is valid.";
  }

  return `${firstDiagnostic.code} @ ${formatJsonPath(firstDiagnostic.path)}: ${firstDiagnostic.message}`;
}

export function assertRuntimeCommandPlanningInput(value: unknown): asserts value is RuntimeCommandPlanningInput {
  const diagnostics = inspectRuntimeCommandPlanningInput(value);
  if (diagnostics.length > 0) {
    throw new RuntimeCommandPlanningValidationError(diagnostics);
  }
}

export function createRuntimeCommandPlan(input: RuntimeCommandPlanningInput): RuntimeCommandPlan {
  const diagnostics = [...inspectRuntimeCommandPlanningInput(input)];
  const commandId = getCommandId(input.request);
  const commandKind = getCommandKind(commandId);

  if (diagnostics.length === 0) {
    const request = cloneJsonValue(input.request as JsonValue) as RuntimeCommandRequest;
    const content = getContentReadModel(input);
    const targetDiagnostic = resolveTargetDiagnostic(request, content);

    if (targetDiagnostic !== undefined) {
      diagnostics.push(targetDiagnostic);
    }
  }

  const status = classifyPlanningStatus(diagnostics);
  const request = cloneJsonValue((isRecord(input.request) ? input.request : { commandId: "" }) as JsonValue) as RuntimeCommandRequest;
  const steps = status === "planned" && commandId in COMMAND_KIND_BY_ID
    ? buildPlannedSteps(commandId as ContentActionAffordance, request.targetId)
    : [];

  const plan: RuntimeCommandPlan = {
    status,
    request,
    commandId,
    commandKind,
    steps,
    diagnostics: sortValidationDiagnostics(diagnostics),
    metadata: {
      deterministic: true,
      ...(input.metadata?.requestId === undefined ? {} : { requestId: input.metadata.requestId }),
      ...(input.metadata?.correlationId === undefined ? {} : { correlationId: input.metadata.correlationId }),
      planningVersion: RUNTIME_COMMAND_PLANNING_CONTRACT_VERSION
    }
  };

  return cloneJsonValue(plan as JsonValue) as RuntimeCommandPlan;
}
