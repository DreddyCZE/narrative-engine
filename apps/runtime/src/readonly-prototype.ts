import {
  createContentReadModel,
  createInitialRuntimePlayerStateFromContent,
  createReadonlyRuntimeSmokeScenarioPackage,
  executeRuntimeReadonlyInteraction,
  loadContentPackageFromObject,
  runReadonlyRuntimePresentationSnapshotScenario,
  type RuntimePlayerState,
  type RuntimeReadonlyInteractionDiagnostic,
  type RuntimeReadonlyInteractionResult,
  type RuntimeReadonlyPresentationDiagnostic,
  type RuntimeReadonlyPresentationInventoryPanel,
  type RuntimeReadonlyPresentationLocationPanel,
  type RuntimeReadonlyPresentationTranscriptLine
} from "@narrative-engine/engine-contracts";

export const EXECUTABLE_PROTOTYPE_ACTIONS = ["look", "inventory"] as const;
export const DISABLED_PROTOTYPE_ACTIONS = ["go", "talk", "take", "use", "save", "load"] as const;
export const PROTOTYPE_COMMAND_IDS = [
  ...EXECUTABLE_PROTOTYPE_ACTIONS,
  ...DISABLED_PROTOTYPE_ACTIONS
] as const;

export type ExecutablePrototypeActionId = (typeof EXECUTABLE_PROTOTYPE_ACTIONS)[number];
export type DisabledPrototypeActionId = (typeof DISABLED_PROTOTYPE_ACTIONS)[number];
export type PrototypeCommandId = (typeof PROTOTYPE_COMMAND_IDS)[number];

export type PrototypeCommandPaletteItem = {
  readonly commandId: PrototypeCommandId;
  readonly label: string;
  readonly enabled: boolean;
  readonly disabledReason?: string;
};

export type PrototypeMapTile = {
  readonly locationId: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly kind: "location" | "corridor" | "airlock" | "unknown";
};

export type PrototypeMapConnection = {
  readonly fromLocationId: string;
  readonly toLocationId: string;
  readonly kind: "door" | "corridor";
};

export type PrototypeMapPanel = {
  readonly currentLocationId?: string;
  readonly tiles: readonly PrototypeMapTile[];
  readonly connections: readonly PrototypeMapConnection[];
  readonly legend: readonly string[];
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
};

type PrototypeRuntimeContext = ReturnType<typeof createPrototypeRuntimeContext>;

type DisabledActionDescriptor = {
  readonly label: string;
  readonly reason: string;
};

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

const PROTOTYPE_MAP_TILES: readonly PrototypeMapTile[] = [
  {
    locationId: "location.smoke.start",
    label: "Smoke Test Airlock",
    x: 1,
    y: 1,
    kind: "airlock"
  },
  {
    locationId: "location.smoke.corridor",
    label: "Smoke Test Corridor",
    x: 3,
    y: 1,
    kind: "corridor"
  }
] as const;

const PROTOTYPE_MAP_CONNECTIONS: readonly PrototypeMapConnection[] = [
  {
    fromLocationId: "location.smoke.start",
    toLocationId: "location.smoke.corridor",
    kind: "door"
  }
] as const;

const PROTOTYPE_MAP_LEGEND = [
  "Current",
  "Known location",
  "Connection",
  "Disabled movement"
] as const;

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

function createReadonlyMapPanel(currentLocationId?: string): PrototypeMapPanel {
  return {
    ...(currentLocationId === undefined ? {} : { currentLocationId }),
    tiles: cloneJsonValue(PROTOTYPE_MAP_TILES),
    connections: cloneJsonValue(PROTOTYPE_MAP_CONNECTIONS),
    legend: cloneJsonValue(PROTOTYPE_MAP_LEGEND)
  };
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

function createPrototypeRuntimeContext() {
  const rawPackage = createReadonlyRuntimeSmokeScenarioPackage();
  const loadResult = loadContentPackageFromObject({
    rawPackage,
    source: {
      sourceId: "prototype:readonly-runtime-smoke",
      sourceKind: "provided-object",
      packageId: rawPackage.packageId,
      description: "read-only browser prototype smoke scenario"
    }
  });

  if (loadResult.status !== "valid" || loadResult.graph === undefined) {
    throw new Error("Expected the read-only smoke scenario package to load successfully.");
  }

  const content = createContentReadModel({ graph: loadResult.graph });
  const playerState = createInitialRuntimePlayerStateFromContent({
    content: { graph: loadResult.graph },
    metadata: {
      createdAtRevision: 0,
      updatedAtRevision: 0
    }
  });

  return {
    packageId: rawPackage.packageId,
    content,
    playerState
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

function createStateFromSnapshot(
  runtime: PrototypeRuntimeContext,
  snapshot = runReadonlyRuntimePresentationSnapshotScenario()
): ReadonlyPrototypeState {
  const currentLocationId = snapshot.presentation.location?.locationId;

  return {
    screenTitle: "Read-only Browser Vertical Slice",
    screenSubtitle: "Public smoke scenario rendered through the accepted read-only runtime boundary.",
    scenarioId: snapshot.scenarioId,
    packageId: runtime.packageId,
    ...(snapshot.presentation.location === undefined ? {} : { location: snapshot.presentation.location }),
    ...(snapshot.presentation.inventory === undefined ? {} : { inventory: snapshot.presentation.inventory }),
    transcript: snapshot.presentation.transcript,
    output: createTranscriptPreviewOutput(snapshot.presentation.transcript),
    diagnostics: snapshot.presentation.diagnostics,
    availableActions: cloneJsonValue(EXECUTABLE_PROTOTYPE_ACTIONS),
    commandPalette: createCommandPalette(),
    mapPanel: createReadonlyMapPanel(currentLocationId),
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
              description: item.description
            }))
          }
        }),
    output: outcome.output,
    diagnostics: outcome.diagnostics,
    mapPanel: createReadonlyMapPanel(currentLocationId),
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
      requestId: `prototype.${actionId}`,
      correlationId: "readonly-browser-vertical-slice"
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

export function createReadonlyPrototypeState(): ReadonlyPrototypeState {
  return cloneJsonValue(createStateFromSnapshot(createPrototypeRuntimeContext()));
}

export function createReadonlyPrototypeController(): ReadonlyPrototypeController {
  const runtime = createPrototypeRuntimeContext();
  let state = createStateFromSnapshot(runtime);

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
    }
  };
}