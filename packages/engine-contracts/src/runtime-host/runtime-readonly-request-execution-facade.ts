import {
  canonicalizeJson,
  formatJsonPath,
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
  createRuntimeCommandPlan,
  type RuntimeCommandPlan
} from "./runtime-command-planning.js";
import {
  inspectRuntimeCommandRequestAgainstContent,
  type RuntimeCommandRequestValidationInput
} from "./runtime-command-request-validation.js";
import {
  executeRuntimeReadonlyCommand,
  type RuntimeReadonlyCommandExecutionView
} from "./runtime-readonly-command-execution-facade.js";
import { type RuntimeCommandRequest } from "./runtime-host-types.js";
import {
  createValidationDiagnostic,
  sortValidationDiagnostics,
  type ValidationDiagnostic,
  type ValidationDiagnosticCategory,
  type ValidationDiagnosticPhase
} from "../validation-diagnostic/validation-diagnostic.js";

export const RUNTIME_READONLY_REQUEST_EXECUTION_STATUSES = ["executed", "rejected", "blocked"] as const;
export const RUNTIME_READONLY_REQUEST_EXECUTOR_CONTRACT_VERSION = "runtime-readonly-request-execution-facade@0.1.0" as const;

const READONLY_REQUEST_EXECUTION_INPUT_KEYS = new Set(["request", "content", "playerState", "metadata"]);
const READONLY_REQUEST_EXECUTION_METADATA_KEYS = new Set(["requestId", "correlationId", "deterministic"]);

export type RuntimeReadonlyRequestExecutionStatus = (typeof RUNTIME_READONLY_REQUEST_EXECUTION_STATUSES)[number];
export type RuntimeReadonlyRequestDiagnostic = ValidationDiagnostic;

export type RuntimeReadonlyRequestExecutionMetadata = {
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly deterministic?: true;
};

export type RuntimeReadonlyRequestExecutionInput = {
  readonly request: RuntimeCommandRequest;
  readonly content: ContentReadModel | ContentReadModelInput;
  readonly playerState: RuntimePlayerState;
  readonly metadata?: RuntimeReadonlyRequestExecutionMetadata;
};

export type RuntimeReadonlyRequestExecutionResultMetadata = {
  readonly deterministic: true;
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly executorVersion: typeof RUNTIME_READONLY_REQUEST_EXECUTOR_CONTRACT_VERSION;
};

export type RuntimeReadonlyRequestExecutionResult = {
  readonly status: RuntimeReadonlyRequestExecutionStatus;
  readonly commandId: string;
  readonly request?: RuntimeCommandRequest;
  readonly plan?: RuntimeCommandPlan;
  readonly diagnostics: readonly RuntimeReadonlyRequestDiagnostic[];
  readonly view?: RuntimeReadonlyCommandExecutionView;
  readonly initialPlayerState?: RuntimePlayerState;
  readonly finalPlayerState?: RuntimePlayerState;
  readonly metadata: RuntimeReadonlyRequestExecutionResultMetadata;
};

export class RuntimeReadonlyRequestExecutionValidationError extends TypeError {
  public readonly diagnostics: readonly RuntimeReadonlyRequestDiagnostic[];

  public constructor(diagnostics: readonly RuntimeReadonlyRequestDiagnostic[]) {
    super(formatRuntimeReadonlyRequestExecutionValidationMessage(diagnostics));
    this.name = "RuntimeReadonlyRequestExecutionValidationError";
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
): RuntimeReadonlyRequestDiagnostic {
  return createValidationDiagnostic({
    ownerContract: RUNTIME_READONLY_REQUEST_EXECUTOR_CONTRACT_VERSION,
    code,
    severity: "error",
    category,
    phase,
    path,
    message,
    source: {
      kind: "runtime-readonly-request-execution-facade",
      id: "readonly-request-execution-input",
      path
    },
    ...(details === undefined ? {} : { details })
  });
}

function prefixDiagnostics(
  diagnostics: readonly ValidationDiagnostic[],
  pathPrefix: readonly JsonPathSegment[],
  sourceId: string
): readonly RuntimeReadonlyRequestDiagnostic[] {
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

function inspectMetadata(value: unknown): readonly RuntimeReadonlyRequestDiagnostic[] {
  const diagnostics: RuntimeReadonlyRequestDiagnostic[] = [];

  if (value === undefined) {
    return diagnostics;
  }

  if (!isRecord(value)) {
    return [
      createDiagnostic(
        "RUNTIME_READONLY_REQUEST_EXECUTION_METADATA_INVALID",
        ["metadata"],
        "metadata must be an object when present.",
        "shape",
        "shape-validation"
      )
    ];
  }

  for (const key of Object.keys(value)) {
    if (!READONLY_REQUEST_EXECUTION_METADATA_KEYS.has(key)) {
      diagnostics.push(
        createDiagnostic(
          "RUNTIME_READONLY_REQUEST_EXECUTION_METADATA_UNKNOWN_FIELD",
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
        "RUNTIME_READONLY_REQUEST_EXECUTION_METADATA_INVALID",
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
        "RUNTIME_READONLY_REQUEST_EXECUTION_METADATA_INVALID",
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
        "RUNTIME_READONLY_REQUEST_EXECUTION_METADATA_INVALID",
        ["metadata", "deterministic"],
        "metadata.deterministic must be true when present.",
        "shape",
        "shape-validation"
      )
    );
  }

  return diagnostics;
}

function createBaseMetadata(
  input: Partial<RuntimeReadonlyRequestExecutionInput>
): RuntimeReadonlyRequestExecutionResultMetadata {
  return {
    deterministic: true,
    ...(input.metadata?.requestId === undefined ? {} : { requestId: input.metadata.requestId }),
    ...(input.metadata?.correlationId === undefined ? {} : { correlationId: input.metadata.correlationId }),
    executorVersion: RUNTIME_READONLY_REQUEST_EXECUTOR_CONTRACT_VERSION
  };
}

function getCommandId(request: unknown): string {
  return isRecord(request) && typeof request.commandId === "string" ? request.commandId : "";
}

function classifyInputStatus(
  diagnostics: readonly RuntimeReadonlyRequestDiagnostic[]
): RuntimeReadonlyRequestExecutionStatus {
  if (diagnostics.length === 0) {
    return "executed";
  }

  if (diagnostics.some((diagnostic) =>
    diagnostic.code.startsWith("RUNTIME_READONLY_REQUEST_EXECUTION_INPUT_INVALID") ||
    diagnostic.code.startsWith("RUNTIME_READONLY_REQUEST_EXECUTION_REQUEST_INVALID") ||
    diagnostic.code === "RUNTIME_READONLY_REQUEST_EXECUTOR_COMMAND_UNSUPPORTED" ||
    (diagnostic.code.startsWith("RUNTIME_COMMAND_REQUEST_") &&
      diagnostic.code !== "RUNTIME_COMMAND_REQUEST_COMMAND_UNAVAILABLE" &&
      !diagnostic.path.includes("playerState") &&
      !diagnostic.path.includes("content"))
  )) {
    return "rejected";
  }

  return "blocked";
}

function createTerminalResult(
  input: Partial<RuntimeReadonlyRequestExecutionInput>,
  commandId: string,
  diagnostics: readonly RuntimeReadonlyRequestDiagnostic[],
  request?: RuntimeCommandRequest,
  plan?: RuntimeCommandPlan,
  initialPlayerState?: RuntimePlayerState,
  finalPlayerState?: RuntimePlayerState,
  view?: RuntimeReadonlyCommandExecutionView,
  statusOverride?: RuntimeReadonlyRequestExecutionStatus
): RuntimeReadonlyRequestExecutionResult {
  const result: RuntimeReadonlyRequestExecutionResult = {
    status: statusOverride ?? classifyInputStatus(diagnostics),
    commandId,
    ...(request === undefined ? {} : { request }),
    ...(plan === undefined ? {} : { plan }),
    diagnostics: sortValidationDiagnostics(diagnostics),
    ...(view === undefined ? {} : { view }),
    ...(initialPlayerState === undefined ? {} : { initialPlayerState }),
    ...(finalPlayerState === undefined ? {} : { finalPlayerState }),
    metadata: createBaseMetadata(input)
  };

  return cloneJsonValue(result as JsonValue) as RuntimeReadonlyRequestExecutionResult;
}

export function inspectRuntimeReadonlyRequestExecutionInput(
  value: unknown
): readonly RuntimeReadonlyRequestDiagnostic[] {
  if (!isRecord(value)) {
    return [
      createDiagnostic(
        "RUNTIME_READONLY_REQUEST_EXECUTION_INPUT_INVALID",
        [],
        "runtime readonly request execution input must be an object.",
        "shape",
        "shape-validation"
      )
    ];
  }

  const diagnostics: RuntimeReadonlyRequestDiagnostic[] = [];

  for (const key of Object.keys(value)) {
    if (!READONLY_REQUEST_EXECUTION_INPUT_KEYS.has(key)) {
      diagnostics.push(
        createDiagnostic(
          "RUNTIME_READONLY_REQUEST_EXECUTION_INPUT_UNKNOWN_FIELD",
          [key],
          `unknown field "${key}" is not allowed.`,
          "shape",
          "shape-validation"
        )
      );
    }
  }

  diagnostics.push(...inspectMetadata(value.metadata));

  if (!("request" in value)) {
    diagnostics.push(
      createDiagnostic(
        "RUNTIME_READONLY_REQUEST_EXECUTION_INPUT_INVALID",
        ["request"],
        "request is required.",
        "shape",
        "shape-validation"
      )
    );
  } else {
    diagnostics.push(
      ...prefixDiagnostics(
        inspectRuntimeCommandRequestAgainstContent({
          request: value.request,
          content: ("content" in value ? value.content : {}) as RuntimeCommandRequestValidationInput["content"],
          ...(!("playerState" in value) ? {} : { playerState: value.playerState as RuntimePlayerState })
        }),
        ["requestContext"],
        "request-context"
      )
    );
  }

  if (!("content" in value)) {
    diagnostics.push(
      createDiagnostic(
        "RUNTIME_READONLY_REQUEST_EXECUTION_INPUT_INVALID",
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
        "RUNTIME_READONLY_REQUEST_EXECUTION_INPUT_INVALID",
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

export function formatRuntimeReadonlyRequestExecutionValidationMessage(
  diagnostics: readonly RuntimeReadonlyRequestDiagnostic[]
): string {
  const firstDiagnostic = diagnostics[0];
  if (firstDiagnostic === undefined) {
    return "Runtime readonly request execution input is valid.";
  }

  return `${firstDiagnostic.code} @ ${formatJsonPath(firstDiagnostic.path)}: ${firstDiagnostic.message}`;
}

export function assertRuntimeReadonlyRequestExecutionInput(
  value: unknown
): asserts value is RuntimeReadonlyRequestExecutionInput {
  const diagnostics = inspectRuntimeReadonlyRequestExecutionInput(value);
  if (diagnostics.length > 0) {
    throw new RuntimeReadonlyRequestExecutionValidationError(diagnostics);
  }
}

export function executeRuntimeReadonlyRequest(
  input: RuntimeReadonlyRequestExecutionInput
): RuntimeReadonlyRequestExecutionResult {
  const inputDiagnostics = inspectRuntimeReadonlyRequestExecutionInput(input);
  const commandId = getCommandId(input.request);
  const request = cloneJsonValue(input.request as JsonValue) as RuntimeCommandRequest;
  const initialPlayerState = cloneJsonValue(input.playerState as JsonValue) as RuntimePlayerState;
  const finalPlayerState = cloneJsonValue(input.playerState as JsonValue) as RuntimePlayerState;

  const shouldAttemptPlanning = inputDiagnostics.every((diagnostic) =>
    diagnostic.code === "RUNTIME_COMMAND_REQUEST_COMMAND_UNAVAILABLE"
  );

  if (inputDiagnostics.length > 0 && !shouldAttemptPlanning) {
    return createTerminalResult(
      input,
      commandId,
      inputDiagnostics,
      request,
      undefined,
      initialPlayerState,
      finalPlayerState
    );
  }

  const plan = createRuntimeCommandPlan({
    request,
    content: input.content,
    playerState: input.playerState,
    metadata: {
      deterministic: true,
      ...(input.metadata?.requestId === undefined ? {} : { requestId: input.metadata.requestId }),
      ...(input.metadata?.correlationId === undefined ? {} : { correlationId: input.metadata.correlationId })
    }
  });

  const execution = executeRuntimeReadonlyCommand({
    plan,
    content: input.content,
    playerState: input.playerState,
    metadata: {
      deterministic: true,
      ...(input.metadata?.requestId === undefined ? {} : { requestId: input.metadata.requestId }),
      ...(input.metadata?.correlationId === undefined ? {} : { correlationId: input.metadata.correlationId })
    }
  });

  return createTerminalResult(
    input,
    execution.commandId,
    execution.diagnostics,
    request,
    plan,
    initialPlayerState,
    finalPlayerState,
    execution.view,
    execution.status
  );
}
