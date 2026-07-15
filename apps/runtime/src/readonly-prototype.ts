import {
  createContentReadModel,
  createInitialRuntimePlayerStateFromContent,
  executeRuntimeReadonlyInteraction,
  loadContentPackageFromObject,
  type RuntimePlayerState,
  type RuntimeReadonlyInteractionDiagnostic,
  type RuntimeReadonlyInteractionResult,
  type RuntimeReadonlyPresentationDiagnostic,
  type RuntimeReadonlyPresentationInventoryPanel,
  type RuntimeReadonlyPresentationLocationPanel,
  type RuntimeReadonlyPresentationTranscriptLine
} from "@narrative-engine/engine-contracts";

import {
  createPrototypeMapPanel,
  type PrototypeMapPanel
} from "./prototype-map-layouts.js";
import {
  DEFAULT_PROTOTYPE_SCENARIO_ID,
  createPrototypeScenarioOptions,
  getPrototypeScenarioDescriptor,
  type PrototypeScenarioDescriptor,
  type PrototypeScenarioId,
  type PrototypeScenarioOption
} from "./prototype-scenarios.js";

export const EXECUTABLE_PROTOTYPE_ACTIONS = ["look", "inventory"] as const;
export const DISABLED_PROTOTYPE_ACTIONS = ["go", "talk", "take", "use", "save", "load"] as const;
export const PROTOTYPE_COMMAND_IDS = [
  ...EXECUTABLE_PROTOTYPE_ACTIONS,
  ...DISABLED_PROTOTYPE_ACTIONS
] as const;

export type ExecutablePrototypeActionId = (typeof EXECUTABLE_PROTOTYPE_ACTIONS)[number];
export type DisabledPrototypeActionId = (typeof DISABLED_PROTOTYPE_ACTIONS)[number];
export type PrototypeCommandId = (typeof PROTOTYPE_COMMAND_IDS)[number];

export type { PrototypeMapConnection, PrototypeMapPanel, PrototypeMapTile } from "./prototype-map-layouts.js";
export type { PrototypeScenarioId, PrototypeScenarioOption } from "./prototype-scenarios.js";

export type PrototypeCommandPaletteItem = {
  readonly commandId: PrototypeCommandId;
  readonly label: string;
  readonly enabled: boolean;
  readonly disabledReason?: string;
};

type ReadonlyPrototypeOutputPanel = {
  readonly kind: "transcript-preview" | PrototypeCommandId;
  readonly title: string;
  readonly lines: readonly string[];
};

type ReadonlyPrototypeStatus = {
  readonly kind: "idle" | "executed" | "rejected" | "blocked" | "disabled";
  readonly detail: string;
};

type ReadonlyPrototypeDiagnosticView = Pick<
  RuntimeReadonlyPresentationDiagnostic | RuntimeReadonlyInteractionDiagnostic,
  "code" | "message" | "path" | "phase" | "category" | "severity"
>;

export type ReadonlyPrototypeState = {
  readonly screenTitle: string;
  readonly screenSubtitle: string;
  readonly scenarioId: string;
  readonly selectedScenarioId: PrototypeScenarioId;
  readonly scenarios: readonly PrototypeScenarioOption[];
  readonly packageId: string;
  readonly location?: RuntimeReadonlyPresentationLocationPanel;
  readonly inventory?: RuntimeReadonlyPresentationInventoryPanel;
  readonly transcript: readonly RuntimeReadonlyPresentationTranscriptLine[];
  readonly output: ReadonlyPrototypeOutputPanel;
  readonly diagnostics: readonly ReadonlyPrototypeDiagnosticView[];
  readonly availableActions: readonly ExecutablePrototypeActionId[];
  readonly commandPalette: readonly PrototypeCommandPaletteItem[];
  readonly mapPanel: PrototypeMapPanel;
  readonly status: ReadonlyPrototypeStatus;
};

export type ReadonlyPrototypeActionOutcome = {
  readonly actionId: PrototypeCommandId;
  readonly status: "executed" | "rejected" | "blocked" | "disabled";
  readonly disabledReason?: string;
  readonly interaction?: RuntimeReadonlyInteractionResult;
  readonly output: ReadonlyPrototypeOutputPanel;
  readonly diagnostics: readonly ReadonlyPrototypeDiagnosticView[];
  readonly playerStateBefore: RuntimePlayerState;
  readonly playerStateAfter: RuntimePlayerState;
  readonly playerStateUnchanged: boolean;
};

export type ReadonlyPrototypeController = {
  readonly getState: () => ReadonlyPrototypeState;
  readonly runAction: (actionId: PrototypeCommandId) => ReadonlyPrototypeActionOutcome;
  readonly selectScenario: (scenarioId: PrototypeScenarioId) => ReadonlyPrototypeState;
};

type PrototypeRuntimeContext = {
  readonly descriptor: PrototypeScenarioDescriptor;
  readonly packageId: string;
  readonly content: ReturnType<typeof createContentReadModel>;
  readonly playerState: RuntimePlayerState;
  readonly location?: RuntimeReadonlyPresentationLocationPanel;
  readonly inventory?: RuntimeReadonlyPresentationInventoryPanel;
  readonly transcript: readonly RuntimeReadonlyPresentationTranscriptLine[];
  readonly diagnostics: readonly ReadonlyPrototypeDiagnosticView[];
};

type DisabledActionDescriptor = {
  readonly label: string;
  readonly reason: string;
};

const PROTOTYPE_SCREEN_TITLE = "Read-only Browser Vertical Slice";
const PROTOTYPE_SCREEN_SUBTITLE = "Prototype scenarios loaded through public content contracts, rendered through the accepted read-only runtime boundary.";
const PROTOTYPE_SCENARIO_OPTIONS = createPrototypeScenarioOptions();

const DISABLED_ACTION_DETAILS: Record<DisabledPrototypeActionId, DisabledActionDescriptor> = {
  go: {
    label: "Go",
    reason: "Movement execution is not implemented yet."
  },
  talk: {
    label: "Talk",
    reason: "Dialogue execution is not implemented yet."
  },
  take: {
    label: "Take",
    reason: "Inventory mutation is not implemented yet."
  },
  use: {
    label: "Use",
    reason: "Use/effect execution is not implemented yet."
  },
  save: {
    label: "Save",
    reason: "Save UI/storage integration is not implemented yet."
  },
  load: {
    label: "Load",
    reason: "Load UI/storage integration is not implemented yet."
  }
};

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function formatListLine(prefix: string, values: readonly string[], emptyLabel: string): string {
  return values.length > 0 ? `${prefix}: ${values.join(", ")}` : `${prefix}: ${emptyLabel}`;
}

function createCommandPalette(): readonly PrototypeCommandPaletteItem[] {
  return PROTOTYPE_COMMAND_IDS.map((commandId) => {
    if (commandId === "look") {
      return {
        commandId,
        label: "Look",
        enabled: true
      };
    }

    if (commandId === "inventory") {
      return {
        commandId,
        label: "Inventory",
        enabled: true
      };
    }

    const disabledAction = DISABLED_ACTION_DETAILS[commandId];
    return {
      commandId,
      label: disabledAction.label,
      enabled: false,
      disabledReason: disabledAction.reason
    };
  });
}

function createDisabledActionDiagnostic(actionId: DisabledPrototypeActionId): ReadonlyPrototypeDiagnosticView {
  const disabledAction = DISABLED_ACTION_DETAILS[actionId];

  return {
    code: "PROTOTYPE_ACTION_DISABLED",
    message: disabledAction.reason,
    path: ["commandPalette", actionId],
    phase: "execution",
    category: "command",
    severity: "warning"
  };
}

function createTranscriptPreviewOutput(lines: readonly RuntimeReadonlyPresentationTranscriptLine[]): ReadonlyPrototypeOutputPanel {
  return {
    kind: "transcript-preview",
    title: "Transcript Preview",
    lines: lines.map((line) => line.text)
  };
}

function createLocationPanelFromInteraction(
  result: RuntimeReadonlyInteractionResult
): RuntimeReadonlyPresentationLocationPanel | undefined {
  if (result.execution?.status !== "executed" || result.execution.view?.kind !== "look") {
    return undefined;
  }

  const { look } = result.execution.view;
  return {
    locationId: look.locationId,
    title: look.title,
    description: look.description,
    exits: look.exits.map((exit) => ({
      exitId: exit.exitId,
      label: exit.label,
      targetLocationId: exit.targetLocationId,
      ...(exit.locked === undefined ? {} : { locked: exit.locked }),
      ...(exit.conditionFlag === undefined ? {} : { conditionFlag: exit.conditionFlag })
    })),
    items: look.items.map((item) => ({
      itemId: item.itemId,
      title: item.title,
      description: item.description,
      ...(item.portable === undefined ? {} : { portable: item.portable })
    })),
    npcs: look.npcs.map((npc) => ({
      npcId: npc.npcId,
      name: npc.name,
      ...(npc.dialogueId === undefined ? {} : { dialogueId: npc.dialogueId })
    }))
  };
}

function createInventoryPanelFromInteraction(
  result: RuntimeReadonlyInteractionResult
): RuntimeReadonlyPresentationInventoryPanel | undefined {
  if (result.execution?.status !== "executed" || result.execution.view?.kind !== "inventory") {
    return undefined;
  }

  const { inventory } = result.execution.view;
  return {
    itemCount: inventory.itemCount,
    empty: inventory.itemCount === 0,
    items: inventory.items.map((item) => ({
      itemId: item.itemId,
      title: item.title,
      description: item.description,
      ...(item.portable === undefined ? {} : { portable: item.portable })
    }))
  };
}

function createInitialTranscript(
  descriptor: PrototypeScenarioDescriptor,
  location?: RuntimeReadonlyPresentationLocationPanel,
  inventory?: RuntimeReadonlyPresentationInventoryPanel
): readonly RuntimeReadonlyPresentationTranscriptLine[] {
  const inventorySummary = inventory === undefined || inventory.items.length === 0
    ? "Inventory online: empty."
    : `Inventory online: ${inventory.items.map((item) => item.title).join(", ")}.`;

  return [
    {
      lineId: `${descriptor.scenarioId}.intro`,
      stepId: `${descriptor.scenarioId}.intro`,
      speaker: "system",
      text: descriptor.description
    },
    {
      lineId: `${descriptor.scenarioId}.location`,
      stepId: `${descriptor.scenarioId}.look-preview`,
      speaker: "system",
      text: location === undefined
        ? "Location preview unavailable."
        : `Current location: ${location.title}.`
    },
    {
      lineId: `${descriptor.scenarioId}.inventory`,
      stepId: `${descriptor.scenarioId}.inventory-preview`,
      speaker: "system",
      text: inventorySummary
    }
  ];
}

function createScenarioRuntimeContext(scenarioId: PrototypeScenarioId): PrototypeRuntimeContext {
  const descriptor = getPrototypeScenarioDescriptor(scenarioId);
  const rawPackage = descriptor.packageFactory();
  const loadResult = loadContentPackageFromObject({
    rawPackage,
    source: {
      sourceId: `prototype:${descriptor.scenarioId}`,
      sourceKind: "provided-object",
      packageId: rawPackage.packageId,
      description: descriptor.description
    }
  });

  if (loadResult.status !== "valid" || loadResult.graph === undefined) {
    throw new Error(`Expected prototype scenario ${descriptor.scenarioId} to load successfully.`);
  }

  const content = createContentReadModel({ graph: loadResult.graph });
  const playerState = createInitialRuntimePlayerStateFromContent({
    content: { graph: loadResult.graph },
    metadata: {
      createdAtRevision: 0,
      updatedAtRevision: 0
    }
  });
  const lookInteraction = executeRuntimeReadonlyInteraction({
    input: { commandId: "look" },
    content,
    playerState,
    metadata: {
      deterministic: true,
      requestId: `${descriptor.scenarioId}.bootstrap.look`,
      correlationId: descriptor.scenarioId
    }
  });
  const inventoryInteraction = executeRuntimeReadonlyInteraction({
    input: { commandId: "inventory" },
    content,
    playerState,
    metadata: {
      deterministic: true,
      requestId: `${descriptor.scenarioId}.bootstrap.inventory`,
      correlationId: descriptor.scenarioId
    }
  });

  const location = createLocationPanelFromInteraction(lookInteraction);
  const inventory = createInventoryPanelFromInteraction(inventoryInteraction);
  const diagnostics = [
    ...lookInteraction.diagnostics,
    ...inventoryInteraction.diagnostics
  ];

  return {
    descriptor,
    packageId: rawPackage.packageId,
    content,
    playerState,
    ...(location === undefined ? {} : { location }),
    ...(inventory === undefined ? {} : { inventory }),
    transcript: createInitialTranscript(descriptor, location, inventory),
    diagnostics
  };
}

function createOutputFromInteraction(result: RuntimeReadonlyInteractionResult): ReadonlyPrototypeOutputPanel {
  if (result.execution?.status !== "executed" || result.execution.view === undefined) {
    return {
      kind: "transcript-preview",
      title: "Interaction Diagnostics",
      lines: result.diagnostics.length > 0
        ? result.diagnostics.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`)
        : ["No interaction output is available."]
    };
  }

  if (result.execution.view.kind === "look") {
    const { look } = result.execution.view;
    return {
      kind: "look",
      title: look.title,
      lines: [
        look.description,
        formatListLine("Location", [look.title], "unknown"),
        formatListLine("Exits", look.exits.map((exit) => exit.label), "none"),
        formatListLine("Items", look.items.map((item) => item.title), "none"),
        formatListLine("NPCs", look.npcs.map((npc) => npc.name), "none"),
        formatListLine("Available actions", look.availableActions, "none")
      ]
    };
  }

  const { inventory } = result.execution.view;
  const itemLines = inventory.items.flatMap((item) => [item.title, item.description]);

  return {
    kind: "inventory",
    title: `Inventory (${String(inventory.itemCount)})`,
    lines: itemLines.length > 0
      ? [`Item count: ${String(inventory.itemCount)}`, ...itemLines]
      : ["Inventory is empty."]
  };
}

function createOutputFromDisabledAction(actionId: DisabledPrototypeActionId): ReadonlyPrototypeOutputPanel {
  const disabledAction = DISABLED_ACTION_DETAILS[actionId];

  return {
    kind: actionId,
    title: `${disabledAction.label} Unavailable`,
    lines: [disabledAction.reason]
  };
}

function createStateFromRuntimeContext(runtime: PrototypeRuntimeContext): ReadonlyPrototypeState {
  return {
    screenTitle: PROTOTYPE_SCREEN_TITLE,
    screenSubtitle: PROTOTYPE_SCREEN_SUBTITLE,
    scenarioId: runtime.descriptor.scenarioId,
    selectedScenarioId: runtime.descriptor.scenarioId,
    scenarios: cloneJsonValue(PROTOTYPE_SCENARIO_OPTIONS),
    packageId: runtime.packageId,
    ...(runtime.location === undefined ? {} : { location: runtime.location }),
    ...(runtime.inventory === undefined ? {} : { inventory: runtime.inventory }),
    transcript: cloneJsonValue(runtime.transcript),
    output: createTranscriptPreviewOutput(runtime.transcript),
    diagnostics: cloneJsonValue(runtime.diagnostics),
    availableActions: cloneJsonValue(EXECUTABLE_PROTOTYPE_ACTIONS),
    commandPalette: createCommandPalette(),
    mapPanel: createPrototypeMapPanel(runtime.descriptor.initialMapLayout, runtime.playerState.currentLocationId),
    status: {
      kind: "idle",
      detail: "Ready. Read-only commands are executable; future gameplay commands are visible but disabled."
    }
  };
}

function createStateFromActionOutcome(
  previousState: ReadonlyPrototypeState,
  outcome: ReadonlyPrototypeActionOutcome
): ReadonlyPrototypeState {
  const lookView = outcome.interaction?.execution?.view?.kind === "look"
    ? outcome.interaction.execution.view.look
    : undefined;
  const inventoryView = outcome.interaction?.execution?.view?.kind === "inventory"
    ? outcome.interaction.execution.view.inventory
    : undefined;
  const currentLocationId = lookView?.locationId ?? previousState.mapPanel.currentLocationId;
  const selectedScenario = getPrototypeScenarioDescriptor(previousState.selectedScenarioId);

  return {
    ...previousState,
    ...(lookView === undefined
      ? {}
      : {
          location: {
            locationId: lookView.locationId,
            title: lookView.title,
            description: lookView.description,
            exits: lookView.exits.map((exit) => ({
              exitId: exit.exitId,
              label: exit.label,
              targetLocationId: exit.targetLocationId,
              ...(exit.locked === undefined ? {} : { locked: exit.locked }),
              ...(exit.conditionFlag === undefined ? {} : { conditionFlag: exit.conditionFlag })
            })),
            items: lookView.items.map((item) => ({
              itemId: item.itemId,
              title: item.title,
              description: item.description,
              ...(item.portable === undefined ? {} : { portable: item.portable })
            })),
            npcs: lookView.npcs.map((npc) => ({
              npcId: npc.npcId,
              name: npc.name,
              ...(npc.dialogueId === undefined ? {} : { dialogueId: npc.dialogueId })
            }))
          }
        }),
    ...(inventoryView === undefined
      ? {}
      : {
          inventory: {
            itemCount: inventoryView.itemCount,
            empty: inventoryView.itemCount === 0,
            items: inventoryView.items.map((item) => ({
              itemId: item.itemId,
              title: item.title,
              description: item.description,
              ...(item.portable === undefined ? {} : { portable: item.portable })
            }))
          }
        }),
    output: outcome.output,
    diagnostics: outcome.diagnostics,
    mapPanel: createPrototypeMapPanel(selectedScenario.initialMapLayout, currentLocationId),
    status: outcome.status === "disabled"
      ? {
          kind: "disabled",
          detail: `${outcome.actionId.toUpperCase()}: ${outcome.disabledReason ?? "Unavailable."}`
        }
      : {
          kind: outcome.status,
          detail: outcome.playerStateUnchanged
            ? `${outcome.actionId.toUpperCase()} executed through the read-only boundary with no gameplay mutation.`
            : `${outcome.actionId.toUpperCase()} changed runtime state unexpectedly.`
        }
  };
}

function createDisabledActionOutcome(
  runtime: PrototypeRuntimeContext,
  actionId: DisabledPrototypeActionId
): ReadonlyPrototypeActionOutcome {
  const playerStateBefore = cloneJsonValue(runtime.playerState);
  const playerStateAfter = cloneJsonValue(runtime.playerState);
  const diagnostic = createDisabledActionDiagnostic(actionId);
  const disabledReason = DISABLED_ACTION_DETAILS[actionId].reason;

  return {
    actionId,
    status: "disabled",
    disabledReason,
    output: createOutputFromDisabledAction(actionId),
    diagnostics: [diagnostic],
    playerStateBefore,
    playerStateAfter,
    playerStateUnchanged: true
  };
}

function createExecutableActionOutcome(
  runtime: PrototypeRuntimeContext,
  actionId: ExecutablePrototypeActionId
): ReadonlyPrototypeActionOutcome {
  const interaction = executeRuntimeReadonlyInteraction({
    input: { commandId: actionId },
    content: runtime.content,
    playerState: runtime.playerState,
    metadata: {
      deterministic: true,
      requestId: `${runtime.descriptor.scenarioId}.${actionId}`,
      correlationId: runtime.descriptor.scenarioId
    }
  });
  const playerStateBefore = cloneJsonValue(
    interaction.initialPlayerState === undefined ? runtime.playerState : interaction.initialPlayerState
  );
  const playerStateAfter = cloneJsonValue(
    interaction.finalPlayerState === undefined ? runtime.playerState : interaction.finalPlayerState
  );

  return {
    actionId,
    status: interaction.status,
    interaction,
    output: createOutputFromInteraction(interaction),
    diagnostics: interaction.diagnostics,
    playerStateBefore,
    playerStateAfter,
    playerStateUnchanged: JSON.stringify(playerStateBefore) === JSON.stringify(playerStateAfter)
  };
}

export function createReadonlyPrototypeState(
  scenarioId: PrototypeScenarioId = DEFAULT_PROTOTYPE_SCENARIO_ID
): ReadonlyPrototypeState {
  return cloneJsonValue(createStateFromRuntimeContext(createScenarioRuntimeContext(scenarioId)));
}

export function createReadonlyPrototypeController(
  initialScenarioId: PrototypeScenarioId = DEFAULT_PROTOTYPE_SCENARIO_ID
): ReadonlyPrototypeController {
  let runtime = createScenarioRuntimeContext(initialScenarioId);
  let state = createStateFromRuntimeContext(runtime);

  return {
    getState(): ReadonlyPrototypeState {
      return cloneJsonValue(state);
    },
    runAction(actionId: PrototypeCommandId): ReadonlyPrototypeActionOutcome {
      const outcome = EXECUTABLE_PROTOTYPE_ACTIONS.includes(actionId as ExecutablePrototypeActionId)
        ? createExecutableActionOutcome(runtime, actionId as ExecutablePrototypeActionId)
        : createDisabledActionOutcome(runtime, actionId as DisabledPrototypeActionId);

      state = createStateFromActionOutcome(state, outcome);
      return cloneJsonValue(outcome);
    },
    selectScenario(scenarioId: PrototypeScenarioId): ReadonlyPrototypeState {
      runtime = createScenarioRuntimeContext(scenarioId);
      state = createStateFromRuntimeContext(runtime);
      return cloneJsonValue(state);
    }
  };
}
