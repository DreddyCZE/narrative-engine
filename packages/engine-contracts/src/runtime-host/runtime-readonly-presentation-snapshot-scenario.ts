import { canonicalizeJson, type JsonValue } from "@narrative-engine/core";

import {
  createRuntimeReadonlyPresentationModel,
  type RuntimeReadonlyPresentationModel
} from "./runtime-readonly-presentation-model.js";
import {
  runReadonlyRuntimeTranscriptScenario
} from "./runtime-readonly-transcript-scenario.js";

export const READONLY_RUNTIME_PRESENTATION_SNAPSHOT_SCENARIO_CONTRACT_VERSION =
  "readonly-runtime-presentation-snapshot-scenario@0.1.0" as const;

const READONLY_RUNTIME_PRESENTATION_SNAPSHOT_SCENARIO_ID =
  "runtime-presentation-snapshot.readonly" as const;

export type ReadonlyRuntimePresentationSnapshotSummary = {
  readonly locationTitle?: string;
  readonly inventoryItemCount?: number;
  readonly availableCommands: readonly string[];
  readonly transcriptPreview: readonly string[];
};

export type ReadonlyRuntimePresentationSnapshotScenarioResult = {
  readonly scenarioId: typeof READONLY_RUNTIME_PRESENTATION_SNAPSHOT_SCENARIO_ID;
  readonly sourceTranscriptScenarioId: string;
  readonly packageId: string;
  readonly presentation: RuntimeReadonlyPresentationModel;
  readonly summary: ReadonlyRuntimePresentationSnapshotSummary;
  readonly metadata: {
    readonly deterministic: true;
    readonly scenarioVersion: typeof READONLY_RUNTIME_PRESENTATION_SNAPSHOT_SCENARIO_CONTRACT_VERSION;
    readonly transcriptLineCount: number;
    readonly availableCommandCount: number;
    readonly diagnosticCount: number;
  };
};

function cloneJsonValue<T extends JsonValue>(value: T): T {
  return JSON.parse(canonicalizeJson(value)) as T;
}

function createSummary(
  presentation: RuntimeReadonlyPresentationModel
): ReadonlyRuntimePresentationSnapshotSummary {
  return {
    ...(presentation.location === undefined ? {} : { locationTitle: presentation.location.title }),
    ...(presentation.inventory === undefined ? {} : { inventoryItemCount: presentation.inventory.itemCount }),
    availableCommands: presentation.availableCommands,
    transcriptPreview: presentation.transcript.map((line) => line.text)
  };
}

export function runReadonlyRuntimePresentationSnapshotScenario(): ReadonlyRuntimePresentationSnapshotScenarioResult {
  const transcript = runReadonlyRuntimeTranscriptScenario();
  const presentation = createRuntimeReadonlyPresentationModel({
    transcript,
    metadata: {
      deterministic: true,
      correlationId: READONLY_RUNTIME_PRESENTATION_SNAPSHOT_SCENARIO_ID
    }
  });
  const summary = createSummary(presentation);
  const result: ReadonlyRuntimePresentationSnapshotScenarioResult = {
    scenarioId: READONLY_RUNTIME_PRESENTATION_SNAPSHOT_SCENARIO_ID,
    sourceTranscriptScenarioId: transcript.scenarioId,
    packageId: transcript.packageId,
    presentation,
    summary,
    metadata: {
      deterministic: true,
      scenarioVersion: READONLY_RUNTIME_PRESENTATION_SNAPSHOT_SCENARIO_CONTRACT_VERSION,
      transcriptLineCount: presentation.transcript.length,
      availableCommandCount: presentation.availableCommands.length,
      diagnosticCount: presentation.diagnostics.length
    }
  };

  return cloneJsonValue(result as JsonValue) as ReadonlyRuntimePresentationSnapshotScenarioResult;
}
