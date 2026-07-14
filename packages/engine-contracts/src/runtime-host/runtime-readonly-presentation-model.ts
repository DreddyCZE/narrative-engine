import { canonicalizeJson, type JsonPathSegment, type JsonValue } from "@narrative-engine/core";

import {
  type ReadonlyRuntimeTranscriptScenarioResult
} from "./runtime-readonly-transcript-scenario.js";
import {
  type RuntimeReadonlyCommandExecutionView
} from "./runtime-readonly-command-execution-facade.js";

type ValidationDiagnostic = import("../validation-diagnostic/validation-diagnostic.js").ValidationDiagnostic;

type LookView = Extract<RuntimeReadonlyCommandExecutionView, { readonly kind: "look" }>;
type InventoryView = Extract<RuntimeReadonlyCommandExecutionView, { readonly kind: "inventory" }>;

export const RUNTIME_READONLY_PRESENTATION_MODEL_CONTRACT_VERSION =
  "runtime-readonly-presentation-model@0.1.0" as const;

const RUNTIME_READONLY_PRESENTATION_MODEL_ID = "runtime-readonly-presentation" as const;
const READONLY_EXECUTABLE_COMMANDS = ["look", "inventory"] as const;

export type RuntimeReadonlyPresentationModelInput = {
  readonly transcript: ReadonlyRuntimeTranscriptScenarioResult;
  readonly metadata?: {
    readonly requestId?: string;
    readonly correlationId?: string;
    readonly deterministic?: true;
  };
};

export type RuntimeReadonlyPresentationPanel =
  | RuntimeReadonlyPresentationLocationPanel
  | RuntimeReadonlyPresentationInventoryPanel;

export type RuntimeReadonlyPresentationLocationPanel = {
  readonly locationId: string;
  readonly title: string;
  readonly description: string;
  readonly exits: readonly {
    readonly exitId: string;
    readonly label: string;
    readonly targetLocationId: string;
    readonly locked?: boolean;
    readonly conditionFlag?: string;
  }[];
  readonly items: readonly {
    readonly itemId: string;
    readonly title: string;
    readonly description: string;
    readonly portable?: boolean;
  }[];
  readonly npcs: readonly {
    readonly npcId: string;
    readonly name: string;
    readonly dialogueId?: string;
  }[];
};

export type RuntimeReadonlyPresentationInventoryPanel = {
  readonly itemCount: number;
  readonly items: readonly {
    readonly itemId: string;
    readonly title: string;
    readonly description: string;
    readonly portable?: boolean;
  }[];
  readonly empty: boolean;
};

export type RuntimeReadonlyPresentationTranscriptLine = {
  readonly lineId: string;
  readonly stepId: string;
  readonly speaker: "system";
  readonly text: string;
};

export type RuntimeReadonlyPresentationDiagnostic = {
  readonly stepId: string;
  readonly commandId: string;
  readonly code: string;
  readonly severity: ValidationDiagnostic["severity"];
  readonly category: ValidationDiagnostic["category"];
  readonly phase: ValidationDiagnostic["phase"];
  readonly path: readonly JsonPathSegment[];
  readonly message: string;
};

export type RuntimeReadonlyPresentationModel = {
  readonly modelId: typeof RUNTIME_READONLY_PRESENTATION_MODEL_ID;
  readonly sourceScenarioId: string;
  readonly packageId: string;
  readonly location?: RuntimeReadonlyPresentationLocationPanel;
  readonly inventory?: RuntimeReadonlyPresentationInventoryPanel;
  readonly transcript: readonly RuntimeReadonlyPresentationTranscriptLine[];
  readonly availableCommands: readonly string[];
  readonly diagnostics: readonly RuntimeReadonlyPresentationDiagnostic[];
  readonly metadata: {
    readonly deterministic: true;
    readonly requestId?: string;
    readonly correlationId?: string;
    readonly presentationVersion: typeof RUNTIME_READONLY_PRESENTATION_MODEL_CONTRACT_VERSION;
    readonly transcriptLineCount: number;
    readonly diagnosticCount: number;
  };
};

function cloneJsonValue<T extends JsonValue>(value: T): T {
  return JSON.parse(canonicalizeJson(value)) as T;
}

function findLatestLookView(
  transcript: ReadonlyRuntimeTranscriptScenarioResult
): LookView | undefined {
  for (let index = transcript.commands.length - 1; index >= 0; index -= 1) {
    const step = transcript.commands[index];
    if (step?.status === "executed" && step.view?.kind === "look") {
      return step.view;
    }
  }

  return undefined;
}

function findLatestInventoryView(
  transcript: ReadonlyRuntimeTranscriptScenarioResult
): InventoryView | undefined {
  for (let index = transcript.commands.length - 1; index >= 0; index -= 1) {
    const step = transcript.commands[index];
    if (step?.status === "executed" && step.view?.kind === "inventory") {
      return step.view;
    }
  }

  return undefined;
}

function createLocationPanel(view: LookView): RuntimeReadonlyPresentationLocationPanel {
  return {
    locationId: view.look.locationId,
    title: view.look.title,
    description: view.look.description,
    exits: view.look.exits.map((exit) => ({
      exitId: exit.exitId,
      label: exit.label,
      targetLocationId: exit.targetLocationId,
      ...(exit.locked === undefined ? {} : { locked: exit.locked }),
      ...(exit.conditionFlag === undefined ? {} : { conditionFlag: exit.conditionFlag })
    })),
    items: view.look.items.map((item) => ({
      itemId: item.itemId,
      title: item.title,
      description: item.description,
      ...(item.portable === undefined ? {} : { portable: item.portable })
    })),
    npcs: view.look.npcs.map((npc) => ({
      npcId: npc.npcId,
      name: npc.name,
      ...(npc.dialogueId === undefined ? {} : { dialogueId: npc.dialogueId })
    }))
  };
}

function createInventoryPanel(view: InventoryView): RuntimeReadonlyPresentationInventoryPanel {
  return {
    itemCount: view.inventory.itemCount,
    items: view.inventory.items.map((item) => ({
      itemId: item.itemId,
      title: item.title,
      description: item.description,
      ...(item.portable === undefined ? {} : { portable: item.portable })
    })),
    empty: view.inventory.itemCount === 0
  };
}

function createDiagnostics(
  transcript: ReadonlyRuntimeTranscriptScenarioResult
): readonly RuntimeReadonlyPresentationDiagnostic[] {
  return transcript.commands.flatMap((step) =>
    step.diagnostics.map((diagnostic) => ({
      stepId: step.stepId,
      commandId: step.commandId,
      code: diagnostic.code,
      severity: diagnostic.severity,
      category: diagnostic.category,
      phase: diagnostic.phase,
      path: diagnostic.path,
      message: diagnostic.message
    }))
  );
}

function createTranscriptLines(
  transcript: ReadonlyRuntimeTranscriptScenarioResult
): readonly RuntimeReadonlyPresentationTranscriptLine[] {
  return transcript.lines.map((line) => ({
    lineId: line.lineId,
    stepId: line.stepId,
    speaker: line.speaker,
    text: line.text
  }));
}

function createAvailableCommands(view: LookView | undefined): readonly string[] {
  if (view === undefined) {
    return [];
  }

  return READONLY_EXECUTABLE_COMMANDS.filter((commandId) => view.look.availableActions.includes(commandId));
}

export function createRuntimeReadonlyPresentationModel(
  input: RuntimeReadonlyPresentationModelInput
): RuntimeReadonlyPresentationModel {
  const transcript = cloneJsonValue(input.transcript as JsonValue) as ReadonlyRuntimeTranscriptScenarioResult;
  const latestLookView = findLatestLookView(transcript);
  const latestInventoryView = findLatestInventoryView(transcript);
  const transcriptLines = createTranscriptLines(transcript);
  const diagnostics = createDiagnostics(transcript);
  const result: RuntimeReadonlyPresentationModel = {
    modelId: RUNTIME_READONLY_PRESENTATION_MODEL_ID,
    sourceScenarioId: transcript.scenarioId,
    packageId: transcript.packageId,
    ...(latestLookView === undefined ? {} : { location: createLocationPanel(latestLookView) }),
    ...(latestInventoryView === undefined ? {} : { inventory: createInventoryPanel(latestInventoryView) }),
    transcript: transcriptLines,
    availableCommands: createAvailableCommands(latestLookView),
    diagnostics,
    metadata: {
      deterministic: true,
      ...(input.metadata?.requestId === undefined ? {} : { requestId: input.metadata.requestId }),
      ...(input.metadata?.correlationId === undefined ? {} : { correlationId: input.metadata.correlationId }),
      presentationVersion: RUNTIME_READONLY_PRESENTATION_MODEL_CONTRACT_VERSION,
      transcriptLineCount: transcriptLines.length,
      diagnosticCount: diagnostics.length
    }
  };

  return cloneJsonValue(result as JsonValue) as RuntimeReadonlyPresentationModel;
}
