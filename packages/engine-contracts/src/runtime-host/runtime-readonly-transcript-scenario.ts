import { canonicalizeJson, type JsonValue } from "@narrative-engine/core";

import { loadContentPackageFromObject } from "../content-loader/content-package-loader.js";
import { createContentReadModel } from "../content-runtime/content-read-model.js";
import {
  createInitialRuntimePlayerStateFromContent,
  type RuntimePlayerState
} from "../content-runtime/runtime-player-state.js";
import {
  createReadonlyRuntimeSmokeScenarioPackage
} from "./runtime-readonly-smoke-scenario.js";
import {
  executeRuntimeReadonlyRequest,
  type RuntimeReadonlyRequestExecutionResult,
  type RuntimeReadonlyRequestExecutionStatus
} from "./runtime-readonly-request-execution-facade.js";
import { type RuntimeCommandPlanStatus } from "./runtime-command-planning.js";
import { type RuntimeCommandRequest } from "./runtime-host-types.js";

type ValidationDiagnostic = import("../validation-diagnostic/validation-diagnostic.js").ValidationDiagnostic;

export const READONLY_RUNTIME_TRANSCRIPT_SCENARIO_CONTRACT_VERSION =
  "readonly-runtime-transcript-scenario@0.1.0" as const;

const READONLY_RUNTIME_TRANSCRIPT_SCENARIO_ID = "runtime-transcript.readonly" as const;
const READONLY_RUNTIME_TRANSCRIPT_REQUESTS = [
  { commandId: "look" },
  { commandId: "inventory" },
  { commandId: "look" }
] as const satisfies readonly RuntimeCommandRequest[];

export type ReadonlyRuntimeTranscriptLine = {
  readonly lineId: string;
  readonly stepId: string;
  readonly speaker: "system";
  readonly text: string;
};

export type ReadonlyRuntimeTranscriptStep = {
  readonly stepId: string;
  readonly request: RuntimeCommandRequest;
  readonly commandId: string;
  readonly status: RuntimeReadonlyRequestExecutionStatus;
  readonly planStatus: RuntimeCommandPlanStatus;
  readonly diagnostics: readonly ValidationDiagnostic[];
  readonly view?: RuntimeReadonlyRequestExecutionResult["view"];
};

export type ReadonlyRuntimeTranscriptScenarioResult = {
  readonly scenarioId: typeof READONLY_RUNTIME_TRANSCRIPT_SCENARIO_ID;
  readonly packageId: string;
  readonly commands: readonly ReadonlyRuntimeTranscriptStep[];
  readonly lines: readonly ReadonlyRuntimeTranscriptLine[];
  readonly initialPlayerState: RuntimePlayerState;
  readonly finalPlayerState: RuntimePlayerState;
  readonly metadata: {
    readonly deterministic: true;
    readonly scenarioVersion: typeof READONLY_RUNTIME_TRANSCRIPT_SCENARIO_CONTRACT_VERSION;
    readonly stepsCount: number;
    readonly linesCount: number;
    readonly diagnosticsCount: number;
  };
};

function cloneJsonValue<T extends JsonValue>(value: T): T {
  return JSON.parse(canonicalizeJson(value)) as T;
}

function createLineText(result: RuntimeReadonlyRequestExecutionResult): string {
  if (result.view?.kind === "look") {
    return `${result.view.look.title} — ${result.view.look.description}`;
  }

  if (result.view?.kind === "inventory") {
    if (result.view.inventory.items.length === 0) {
      return "Inventory is empty.";
    }

    return `Inventory: ${result.view.inventory.items.map((item) => item.title).join(", ")}.`;
  }

  return `${result.commandId} ${result.status}`;
}

function createTranscriptStep(
  stepId: string,
  request: RuntimeCommandRequest,
  playerState: RuntimePlayerState,
  content: ReturnType<typeof createContentReadModel>
): {
  readonly step: ReadonlyRuntimeTranscriptStep;
  readonly line: ReadonlyRuntimeTranscriptLine;
} {
  const execution = executeRuntimeReadonlyRequest({
    request,
    content,
    playerState,
    metadata: {
      deterministic: true,
      requestId: `${READONLY_RUNTIME_TRANSCRIPT_SCENARIO_ID}.${stepId}.request`,
      correlationId: READONLY_RUNTIME_TRANSCRIPT_SCENARIO_ID
    }
  });
  const lineText = createLineText(execution);
  const step: ReadonlyRuntimeTranscriptStep = {
    stepId,
    request: cloneJsonValue(request as JsonValue) as RuntimeCommandRequest,
    commandId: execution.commandId,
    status: execution.status,
    planStatus: execution.plan?.status ?? "rejected",
    diagnostics: execution.diagnostics,
    ...(execution.view === undefined ? {} : { view: execution.view })
  };
  const line: ReadonlyRuntimeTranscriptLine = {
    lineId: `line.${stepId}`,
    stepId,
    speaker: "system",
    text: lineText
  };

  return {
    step,
    line
  };
}

export function runReadonlyRuntimeTranscriptScenario(): ReadonlyRuntimeTranscriptScenarioResult {
  const contentPackage = createReadonlyRuntimeSmokeScenarioPackage();
  const loadResult = loadContentPackageFromObject({
    rawPackage: contentPackage,
    source: {
      sourceId: `fixture:${contentPackage.packageId}`,
      sourceKind: "provided-object",
      packageId: contentPackage.packageId,
      description: "public readonly runtime transcript scenario fixture"
    }
  });

  if (loadResult.status !== "valid" || loadResult.graph === undefined) {
    throw new TypeError("Readonly runtime transcript scenario package must load successfully.");
  }

  const content = createContentReadModel({ graph: loadResult.graph });
  const playerState = createInitialRuntimePlayerStateFromContent({
    content: { graph: loadResult.graph },
    metadata: {
      createdAtRevision: 0,
      updatedAtRevision: 0
    }
  });
  const initialPlayerState = cloneJsonValue(playerState as JsonValue) as RuntimePlayerState;

  const transcriptEntries = READONLY_RUNTIME_TRANSCRIPT_REQUESTS.map((request, index) =>
    createTranscriptStep(
      `step.runtime-transcript.${String(index + 1)}.${request.commandId}`,
      request,
      playerState,
      content
    )
  );
  const commands = transcriptEntries.map((entry) => entry.step);
  const lines = transcriptEntries.map((entry) => entry.line);
  const finalPlayerState = cloneJsonValue(playerState as JsonValue) as RuntimePlayerState;
  const diagnosticsCount = commands.reduce((count, step) => count + step.diagnostics.length, 0);
  const result: ReadonlyRuntimeTranscriptScenarioResult = {
    scenarioId: READONLY_RUNTIME_TRANSCRIPT_SCENARIO_ID,
    packageId: contentPackage.packageId,
    commands,
    lines,
    initialPlayerState,
    finalPlayerState,
    metadata: {
      deterministic: true,
      scenarioVersion: READONLY_RUNTIME_TRANSCRIPT_SCENARIO_CONTRACT_VERSION,
      stepsCount: commands.length,
      linesCount: lines.length,
      diagnosticsCount
    }
  };

  return cloneJsonValue(result as JsonValue) as ReadonlyRuntimeTranscriptScenarioResult;
}
