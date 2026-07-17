import {
  createContentReadModel,
  createInitialRuntimePlayerStateFromContent,
  createRuntimeCommandPlan,
  executeRuntimeMovementCommand,
  executeRuntimeReadonlyInteraction,
  loadContentPackageFromObject,
  type ContentDialogueDescriptor,
  type ContentItemDescriptor,
  type ContentNpcDescriptor,
  type RuntimeMovementCommandExecutorResult,
  type RuntimePlayerState,
  type RuntimeReadonlyInteractionDiagnostic,
  type RuntimeReadonlyInteractionResult,
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

export const EXECUTABLE_PROTOTYPE_ACTIONS = ["look", "inventory", "go"] as const;
export const DISABLED_PROTOTYPE_ACTIONS = ["talk", "take", "use", "save", "load"] as const;
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

export type PrototypeExitAction = {
  readonly exitId: string;
  readonly label: string;
  readonly targetLocationId: string;
  readonly targetLocationTitle: string;
  readonly availability: "available" | "locked" | "condition-gated";
  readonly enabled: boolean;
  readonly disabledReason?: string;
  readonly conditionFlag?: string;
  readonly locked?: boolean;
};

export type PrototypeInspectionSelection =
  | {
      readonly kind: "location";
      readonly locationId: string;
    }
  | {
      readonly kind: "exit";
      readonly exitId: string;
      readonly targetLocationId: string;
    }
  | {
      readonly kind: "item";
      readonly itemId: string;
    }
  | {
      readonly kind: "npc";
      readonly npcId: string;
    };

export type PrototypeInspectionPanel = {
  readonly selection?: PrototypeInspectionSelection;
  readonly title: string;
  readonly lines: readonly string[];
  readonly availableFutureActions: readonly PrototypeCommandId[];
  readonly futureActionReadiness: readonly PrototypeFutureActionReadiness[];
  readonly readonly: true;
};

export type PrototypeFutureActionReadinessStatus =
  | "ready-later"
  | "blocked"
  | "not-applicable"
  | "already-enabled";

export type PrototypeFutureActionReadiness = {
  readonly commandId: PrototypeCommandId;
  readonly label: string;
  readonly status: PrototypeFutureActionReadinessStatus;
  readonly reason: string;
  readonly entityKind: "location" | "exit" | "item" | "npc";
  readonly entityId: string;
  readonly readonly: true;
};

export type PrototypeItemPresenceStatus =
  | "visible-here"
  | "in-inventory"
  | "elsewhere"
  | "unknown";

export type PrototypeItemPresence = {
  readonly itemId: string;
  readonly title: string;
  readonly description: string;
  readonly portable: boolean;
  readonly status: PrototypeItemPresenceStatus;
  readonly sourceLocationId?: string;
  readonly readonly: true;
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
  RuntimeReadonlyInteractionDiagnostic,
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
  readonly exitActions: readonly PrototypeExitAction[];
  readonly itemPresence: readonly PrototypeItemPresence[];
  readonly mapPanel: PrototypeMapPanel;
  readonly inspectionPanel: PrototypeInspectionPanel;
  readonly status: ReadonlyPrototypeStatus;
};

export type ReadonlyPrototypeActionOutcome = {
  readonly actionId: PrototypeCommandId;
  readonly status: "executed" | "rejected" | "blocked" | "disabled";
  readonly disabledReason?: string;
  readonly interaction?: RuntimeReadonlyInteractionResult;
  readonly movement?: RuntimeMovementCommandExecutorResult;
  readonly output: ReadonlyPrototypeOutputPanel;
  readonly diagnostics: readonly ReadonlyPrototypeDiagnosticView[];
  readonly playerStateBefore: RuntimePlayerState;
  readonly playerStateAfter: RuntimePlayerState;
  readonly playerStateUnchanged: boolean;
};

export type ReadonlyPrototypeController = {
  readonly getState: () => ReadonlyPrototypeState;
  readonly runAction: (actionId: PrototypeCommandId) => ReadonlyPrototypeActionOutcome;
  readonly moveToExit: (exitId: string) => ReadonlyPrototypeActionOutcome;
  readonly selectScenario: (scenarioId: PrototypeScenarioId) => ReadonlyPrototypeState;
  readonly inspectLocation: () => ReadonlyPrototypeState;
  readonly inspectExit: (exitId: string) => ReadonlyPrototypeState;
  readonly inspectItem: (itemId: string) => ReadonlyPrototypeState;
  readonly inspectNpc: (npcId: string) => ReadonlyPrototypeState;
  readonly clearInspection: () => ReadonlyPrototypeState;
};

type PrototypeRuntimeContext = {
  readonly descriptor: PrototypeScenarioDescriptor;
  readonly packageId: string;
  readonly content: ReturnType<typeof createContentReadModel>;
  readonly allItems: readonly ContentItemDescriptor[];
  playerState: RuntimePlayerState;
};

type PrototypePresentationSnapshot = {
  readonly location?: RuntimeReadonlyPresentationLocationPanel;
  readonly inventory?: RuntimeReadonlyPresentationInventoryPanel;
  readonly transcript: readonly RuntimeReadonlyPresentationTranscriptLine[];
  readonly diagnostics: readonly ReadonlyPrototypeDiagnosticView[];
};

type DisabledActionDescriptor = {
  readonly label: string;
  readonly reason: string;
};

type PrototypeInspectionEntityKind = PrototypeInspectionSelection["kind"];

const PROTOTYPE_SCREEN_TITLE = "Movement Diagnostics Vertical Slice";
const PROTOTYPE_SCREEN_SUBTITLE = "Prototype scenarios loaded through public content contracts, rendered through the accepted read-only runtime boundary, with controlled movement diagnostics for available, locked, and condition-gated exits.";
const PROTOTYPE_SCENARIO_OPTIONS = createPrototypeScenarioOptions();
const GO_SELECT_EXIT_DETAIL = "Select a visible exit below to run controlled movement through the planned go boundary.";
const DEFAULT_INSPECTION_TITLE = "Inspection";
const DEFAULT_INSPECTION_LINES = ["Select the current location, a visible exit, a visible item, or a visible NPC to inspect details in read-only mode."] as const;

const DISABLED_ACTION_DETAILS: Record<DisabledPrototypeActionId, DisabledActionDescriptor> = {
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

function canonicalizeValue(value: unknown): string {
  return JSON.stringify(value);
}

function formatListLine(prefix: string, values: readonly string[], emptyLabel: string): string {
  return values.length > 0 ? `${prefix}: ${values.join(", ")}` : `${prefix}: ${emptyLabel}`;
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

function executeReadonlyAction(
  runtime: PrototypeRuntimeContext,
  actionId: "look" | "inventory",
  suffix: string
): RuntimeReadonlyInteractionResult {
  return executeRuntimeReadonlyInteraction({
    input: { commandId: actionId },
    content: runtime.content,
    playerState: runtime.playerState,
    metadata: {
      deterministic: true,
      requestId: `${runtime.descriptor.scenarioId}.${suffix}.${actionId}`,
      correlationId: runtime.descriptor.scenarioId
    }
  });
}

function createPresentationSnapshot(runtime: PrototypeRuntimeContext): PrototypePresentationSnapshot {
  const lookInteraction = executeReadonlyAction(runtime, "look", "presentation");
  const inventoryInteraction = executeReadonlyAction(runtime, "inventory", "presentation");
  const location = createLocationPanelFromInteraction(lookInteraction);
  const inventory = createInventoryPanelFromInteraction(inventoryInteraction);

  return {
    ...(location === undefined ? {} : { location }),
    ...(inventory === undefined ? {} : { inventory }),
    transcript: createInitialTranscript(runtime.descriptor, location, inventory),
    diagnostics: [...lookInteraction.diagnostics, ...inventoryInteraction.diagnostics]
  };
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

  return {
    descriptor,
    packageId: rawPackage.packageId,
    content: createContentReadModel({ graph: loadResult.graph }),
    allItems: cloneJsonValue(rawPackage.items ?? []),
    playerState: createInitialRuntimePlayerStateFromContent({
      content: { graph: loadResult.graph },
      metadata: {
        createdAtRevision: 0,
        updatedAtRevision: 0
      }
    })
  };
}

function createItemPresenceProjection(
  runtime: PrototypeRuntimeContext
): readonly PrototypeItemPresence[] {
  const inventoryItemIds = new Set(runtime.playerState.inventoryItemIds);
  const currentLocationId = runtime.playerState.currentLocationId;

  return runtime.allItems.map((item) => {
    const status = inventoryItemIds.has(item.itemId)
      ? "in-inventory"
      : item.locationId === currentLocationId
        ? "visible-here"
        : typeof item.locationId === "string"
          ? "elsewhere"
          : "unknown";

    return {
      itemId: item.itemId,
      title: item.title,
      description: item.description,
      portable: item.portable === true,
      status,
      ...(item.locationId === undefined ? {} : { sourceLocationId: item.locationId }),
      readonly: true
    };
  });
}

function createProjectedLocationPanel(
  location: RuntimeReadonlyPresentationLocationPanel | undefined,
  itemPresence: readonly PrototypeItemPresence[]
): RuntimeReadonlyPresentationLocationPanel | undefined {
  if (location === undefined) {
    return undefined;
  }

  return {
    ...location,
    items: itemPresence
      .filter((item) => item.status === "visible-here")
      .map((item) => ({
        itemId: item.itemId,
        title: item.title,
        description: item.description,
        portable: item.portable
      }))
  };
}

function createProjectedInventoryPanel(
  itemPresence: readonly PrototypeItemPresence[]
): RuntimeReadonlyPresentationInventoryPanel {
  const inventoryItems = itemPresence
    .filter((item) => item.status === "in-inventory")
    .map((item) => ({
      itemId: item.itemId,
      title: item.title,
      description: item.description,
      portable: item.portable
    }));

  return {
    itemCount: inventoryItems.length,
    empty: inventoryItems.length === 0,
    items: inventoryItems
  };
}

function createGoDisabledReason(location: RuntimeReadonlyPresentationLocationPanel | undefined): string | undefined {
  if (location === undefined) {
    return "Movement is unavailable until location data is loaded.";
  }

  if (location.exits.length === 0) {
    return "No exit is available from the current location.";
  }

  return undefined;
}

function createExitAction(
  runtime: PrototypeRuntimeContext,
  exit: RuntimeReadonlyPresentationLocationPanel["exits"][number]
): PrototypeExitAction {
  const targetLocationTitle = runtime.content.getLocation(exit.targetLocationId)?.title ?? exit.targetLocationId;

  if (exit.locked === true) {
    return {
      exitId: exit.exitId,
      label: exit.label,
      targetLocationId: exit.targetLocationId,
      targetLocationTitle,
      availability: "locked",
      enabled: false,
      disabledReason: "Movement is blocked because this exit is locked.",
      locked: true
    };
  }

  if (exit.conditionFlag !== undefined && !runtime.playerState.progressFlags.includes(exit.conditionFlag)) {
    return {
      exitId: exit.exitId,
      label: exit.label,
      targetLocationId: exit.targetLocationId,
      targetLocationTitle,
      availability: "condition-gated",
      enabled: false,
      disabledReason: `Movement is blocked until progress flag "${exit.conditionFlag}" is present.`,
      conditionFlag: exit.conditionFlag
    };
  }

  return {
    exitId: exit.exitId,
    label: exit.label,
    targetLocationId: exit.targetLocationId,
    targetLocationTitle,
    availability: "available",
    enabled: true,
    ...(exit.conditionFlag === undefined ? {} : { conditionFlag: exit.conditionFlag }),
    ...(exit.locked === undefined ? {} : { locked: exit.locked })
  };
}

function createCommandPalette(location: RuntimeReadonlyPresentationLocationPanel | undefined): readonly PrototypeCommandPaletteItem[] {
  const goDisabledReason = createGoDisabledReason(location);

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

    if (commandId === "go") {
      return {
        commandId,
        label: "Go",
        enabled: goDisabledReason === undefined,
        ...(goDisabledReason === undefined ? {} : { disabledReason: goDisabledReason })
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

function createExitActions(
  runtime: PrototypeRuntimeContext,
  location: RuntimeReadonlyPresentationLocationPanel | undefined
): readonly PrototypeExitAction[] {
  if (location === undefined) {
    return [];
  }

  return location.exits.map((exit) => createExitAction(runtime, exit));
}

function createTranscriptPreviewOutput(lines: readonly RuntimeReadonlyPresentationTranscriptLine[]): ReadonlyPrototypeOutputPanel {
  return {
    kind: "transcript-preview",
    title: "Transcript Preview",
    lines: lines.map((line) => line.text)
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

function createOutputFromMovement(
  result: RuntimeMovementCommandExecutorResult,
  snapshot: PrototypePresentationSnapshot
): ReadonlyPrototypeOutputPanel {
  const destinationTitle = snapshot.location?.title ?? result.toLocationId ?? "Unknown destination";
  const lines = result.status === "executed"
    ? [
        `Moved from ${result.fromLocationId ?? "unknown"} to ${destinationTitle}.`,
        ...(result.exitId === undefined ? [] : [`Exit: ${result.exitId}`]),
        ...(snapshot.location === undefined ? [] : [snapshot.location.description]),
        ...(snapshot.location === undefined ? [] : [formatListLine("Available exits", snapshot.location.exits.map((exit) => exit.label), "none")])
      ]
    : result.diagnostics.length > 0
      ? result.diagnostics.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`)
      : ["Movement output is unavailable."];

  return {
    kind: "go",
    title: result.status === "executed" ? `Movement to ${destinationTitle}` : "Movement Diagnostics",
    lines
  };
}

function createDiagnosticView(code: string, message: string, path: readonly (string | number)[]): ReadonlyPrototypeDiagnosticView {
  return {
    code,
    message,
    path,
    phase: "execution",
    category: "command",
    severity: "warning"
  };
}

function createDefaultInspectionPanel(): PrototypeInspectionPanel {
  return {
    title: DEFAULT_INSPECTION_TITLE,
    lines: [...DEFAULT_INSPECTION_LINES],
    availableFutureActions: [],
    futureActionReadiness: [],
    readonly: true
  };
}

function createFutureActionReadiness(
  entityKind: PrototypeInspectionEntityKind,
  entityId: string,
  commandId: PrototypeCommandId,
  status: PrototypeFutureActionReadinessStatus,
  reason: string
): PrototypeFutureActionReadiness {
  return {
    commandId,
    label: commandId === "look"
      ? "Look"
      : commandId === "inventory"
        ? "Inventory"
        : commandId === "go"
          ? "Go"
          : DISABLED_ACTION_DETAILS[commandId].label,
    status,
    reason,
    entityKind,
    entityId,
    readonly: true
  };
}

function summarizeReadyActions(
  rows: readonly PrototypeFutureActionReadiness[]
): readonly PrototypeCommandId[] {
  return rows
    .filter((row) => row.status === "ready-later" || row.status === "already-enabled")
    .map((row) => row.commandId);
}

function createLocationInspectionPanel(location: RuntimeReadonlyPresentationLocationPanel): PrototypeInspectionPanel {
  const hasPortableItems = location.items.some((item) => item.portable === true);
  const hasTalkableNpcs = location.npcs.length > 0;
  const hasBlockedExit = location.exits.some((exit) => exit.locked === true || exit.conditionFlag !== undefined);
  const readiness = [
    createFutureActionReadiness(
      "location",
      location.locationId,
      "look",
      "already-enabled",
      "Look already runs through the accepted read-only boundary."
    ),
    createFutureActionReadiness(
      "location",
      location.locationId,
      "go",
      location.exits.length > 0 ? "ready-later" : "not-applicable",
      location.exits.length > 0
        ? "Visible exits exist. Use explicit exit Move buttons for controlled movement."
        : "No visible exits are available from this location."
    ),
    createFutureActionReadiness(
      "location",
      location.locationId,
      "take",
      hasPortableItems ? "ready-later" : "not-applicable",
      hasPortableItems
        ? "Portable visible items exist, but item pickup is not implemented yet."
        : "No portable visible items are available at this location."
    ),
    createFutureActionReadiness(
      "location",
      location.locationId,
      "talk",
      hasTalkableNpcs ? "ready-later" : "not-applicable",
      hasTalkableNpcs
        ? "Visible NPCs exist, but dialogue execution is not implemented yet."
        : "No visible NPCs are available for dialogue at this location."
    ),
    createFutureActionReadiness(
      "location",
      location.locationId,
      "use",
      hasBlockedExit ? "ready-later" : "not-applicable",
      hasBlockedExit
        ? "A visible locked or condition-gated exit may become usable later, but use/effect execution is not implemented."
        : "No visible exit or object suggests a future use interaction here yet."
    )
  ] as const;

  return {
    selection: {
      kind: "location",
      locationId: location.locationId
    },
    title: location.title,
    lines: [
      location.description,
      `Visible exits: ${String(location.exits.length)}`,
      `Visible items: ${String(location.items.length)}`,
      `Visible NPCs: ${String(location.npcs.length)}`
    ],
    availableFutureActions: summarizeReadyActions(readiness),
    futureActionReadiness: readiness,
    readonly: true
  };
}

function createExitInspectionPanel(exitAction: PrototypeExitAction): PrototypeInspectionPanel {
  const goStatus = exitAction.enabled ? "already-enabled" : "blocked";
  const useStatus = exitAction.availability === "available" ? "not-applicable" : "ready-later";
  const readiness = [
    createFutureActionReadiness(
      "exit",
      exitAction.exitId,
      "go",
      goStatus,
      exitAction.enabled
        ? "Go is already enabled here. Use the Move button for explicit exit-targeted movement."
        : exitAction.disabledReason ?? "Movement is blocked for this exit."
    ),
    createFutureActionReadiness(
      "exit",
      exitAction.exitId,
      "use",
      useStatus,
      exitAction.availability === "available"
        ? "This exit already moves through the explicit Go boundary, so Use does not apply."
        : exitAction.availability === "locked"
          ? "A future use/effect interaction may unlock this exit, but use/effect execution is not implemented."
          : `A future use/effect interaction may satisfy the required condition flag "${exitAction.conditionFlag ?? "unknown"}", but use/effect execution is not implemented.`
    )
  ] as const;

  return {
    selection: {
      kind: "exit",
      exitId: exitAction.exitId,
      targetLocationId: exitAction.targetLocationId
    },
    title: exitAction.label,
    lines: [
      `Target: ${exitAction.targetLocationTitle}`,
      `Target id: ${exitAction.targetLocationId}`,
      `Availability: ${exitAction.availability}`,
      ...(exitAction.disabledReason === undefined ? [] : [exitAction.disabledReason]),
      ...(exitAction.conditionFlag === undefined ? [] : [`Required condition flag: ${exitAction.conditionFlag}`]),
      ...(exitAction.locked === true ? ["Locked: true"] : []),
      "Future action hint: Go remains controlled by explicit exit movement only."
    ],
    availableFutureActions: summarizeReadyActions(readiness),
    futureActionReadiness: readiness,
    readonly: true
  };
}

function createItemInspectionPanel(item: PrototypeItemPresence): PrototypeInspectionPanel {
  const takeStatus = item.status === "visible-here" && item.portable
    ? "ready-later"
    : "not-applicable";
  const takeReason = item.status === "visible-here"
    ? item.portable
      ? "This visible portable item can become a pickup target later, but item pickup is not implemented yet."
      : "This visible item is not marked as portable."
    : item.status === "in-inventory"
      ? "This item is already in inventory and is not a pickup target."
      : item.status === "elsewhere"
        ? "This item is not currently reachable from the player's location."
        : "Item presence is not resolved enough to model pickup.";
  const readiness = [
    createFutureActionReadiness(
      "item",
      item.itemId,
      "take",
      takeStatus,
      takeReason
    ),
    createFutureActionReadiness(
      "item",
      item.itemId,
      "use",
      item.portable ? "ready-later" : "not-applicable",
      item.portable
        ? "This item may become usable later, but use/effect execution is not implemented."
        : "No future use readiness is modeled for this item yet."
    ),
    createFutureActionReadiness(
      "item",
      item.itemId,
      "talk",
      "not-applicable",
      "Talk does not apply to inspected items."
    ),
    createFutureActionReadiness(
      "item",
      item.itemId,
      "go",
      "not-applicable",
      "Go does not apply to inspected items."
    )
  ] as const;

  return {
    selection: {
      kind: "item",
      itemId: item.itemId
    },
    title: item.title,
    lines: [
      item.description,
      `Presence: ${item.status}`,
      `Portable: ${item.portable ? "yes" : "no"}`,
      ...(item.sourceLocationId === undefined ? [] : [`Source location: ${item.sourceLocationId}`]),
      "Future action hint: Take remains disabled in this prototype."
    ],
    availableFutureActions: summarizeReadyActions(readiness),
    futureActionReadiness: readiness,
    readonly: true
  };
}

function createNpcInspectionPanel(
  npc: ContentNpcDescriptor,
  dialogue?: ContentDialogueDescriptor
): PrototypeInspectionPanel {
  const readiness = [
    createFutureActionReadiness(
      "npc",
      npc.npcId,
      "talk",
      npc.dialogueId === undefined ? "not-applicable" : "ready-later",
      npc.dialogueId === undefined
        ? "No dialogue is linked to this NPC."
        : "Dialogue may apply later, but Talk remains disabled in this prototype."
    ),
    createFutureActionReadiness(
      "npc",
      npc.npcId,
      "take",
      "not-applicable",
      "Take does not apply to inspected NPCs."
    ),
    createFutureActionReadiness(
      "npc",
      npc.npcId,
      "use",
      "not-applicable",
      "Use does not apply to inspected NPCs."
    ),
    createFutureActionReadiness(
      "npc",
      npc.npcId,
      "go",
      "not-applicable",
      "Go does not apply to inspected NPCs."
    )
  ] as const;

  return {
    selection: {
      kind: "npc",
      npcId: npc.npcId
    },
    title: npc.name,
    lines: [
      ...(dialogue?.title === undefined ? ["Description unavailable."] : [dialogue.title]),
      ...(dialogue?.lines[0] === undefined ? [] : [dialogue.lines[0]]),
      "Future action hint: Talk remains disabled in this prototype."
    ],
    availableFutureActions: summarizeReadyActions(readiness),
    futureActionReadiness: readiness,
    readonly: true
  };
}

function deriveInspectionPanel(
  runtime: PrototypeRuntimeContext,
  location: RuntimeReadonlyPresentationLocationPanel | undefined,
  exitActions: readonly PrototypeExitAction[],
  itemPresence: readonly PrototypeItemPresence[],
  selection?: PrototypeInspectionSelection
): PrototypeInspectionPanel {
  if (selection === undefined) {
    return createDefaultInspectionPanel();
  }

  if (selection.kind === "location") {
    if (location?.locationId === selection.locationId) {
      return createLocationInspectionPanel(location);
    }

    return createDefaultInspectionPanel();
  }

  if (selection.kind === "exit") {
    const exitAction = exitActions.find((candidate) => candidate.exitId === selection.exitId);
    return exitAction === undefined ? createDefaultInspectionPanel() : createExitInspectionPanel(exitAction);
  }

  if (selection.kind === "item") {
    const item = itemPresence.find((candidate) => candidate.itemId === selection.itemId);
    return item === undefined || (item.status !== "visible-here" && item.status !== "in-inventory")
      ? createDefaultInspectionPanel()
      : createItemInspectionPanel(item);
  }

  const npc = runtime.content.getNpc(selection.npcId);
  if (npc === undefined) {
    return createDefaultInspectionPanel();
  }

  const dialogue = npc.dialogueId === undefined ? undefined : runtime.content.getDialogue(npc.dialogueId);
  return createNpcInspectionPanel(npc, dialogue);
}

function createStateFromRuntime(
  runtime: PrototypeRuntimeContext,
  snapshot: PrototypePresentationSnapshot,
  output: ReadonlyPrototypeOutputPanel,
  diagnostics: readonly ReadonlyPrototypeDiagnosticView[],
  status: ReadonlyPrototypeStatus,
  selection?: PrototypeInspectionSelection
): ReadonlyPrototypeState {
  const itemPresence = createItemPresenceProjection(runtime);
  const projectedLocation = createProjectedLocationPanel(snapshot.location, itemPresence);
  const projectedInventory = createProjectedInventoryPanel(itemPresence);
  const commandPalette = createCommandPalette(projectedLocation);
  const availableActions = commandPalette
    .filter((item): item is PrototypeCommandPaletteItem & { readonly enabled: true } => item.enabled)
    .map((item) => item.commandId as ExecutablePrototypeActionId);
  const exitActions = createExitActions(runtime, projectedLocation);

  return {
    screenTitle: PROTOTYPE_SCREEN_TITLE,
    screenSubtitle: PROTOTYPE_SCREEN_SUBTITLE,
    scenarioId: runtime.descriptor.scenarioId,
    selectedScenarioId: runtime.descriptor.scenarioId,
    scenarios: cloneJsonValue(PROTOTYPE_SCENARIO_OPTIONS),
    packageId: runtime.packageId,
    ...(projectedLocation === undefined ? {} : { location: projectedLocation }),
    inventory: projectedInventory,
    transcript: cloneJsonValue(snapshot.transcript),
    output,
    diagnostics,
    availableActions,
    commandPalette,
    exitActions,
    itemPresence,
    mapPanel: createPrototypeMapPanel(runtime.descriptor.initialMapLayout, runtime.playerState.currentLocationId),
    inspectionPanel: deriveInspectionPanel(runtime, projectedLocation, exitActions, itemPresence, selection),
    status
  };
}

function createDisabledActionOutcome(
  runtime: PrototypeRuntimeContext,
  actionId: DisabledPrototypeActionId
): ReadonlyPrototypeActionOutcome {
  const playerStateBefore = cloneJsonValue(runtime.playerState);
  const playerStateAfter = cloneJsonValue(runtime.playerState);
  const disabledReason = DISABLED_ACTION_DETAILS[actionId].reason;

  return {
    actionId,
    status: "disabled",
    disabledReason,
    output: {
      kind: actionId,
      title: `${DISABLED_ACTION_DETAILS[actionId].label} Unavailable`,
      lines: [disabledReason]
    },
    diagnostics: [createDiagnosticView("PROTOTYPE_ACTION_DISABLED", disabledReason, ["commandPalette", actionId])],
    playerStateBefore,
    playerStateAfter,
    playerStateUnchanged: true
  };
}

function createExecutableReadonlyActionOutcome(
  runtime: PrototypeRuntimeContext,
  actionId: "look" | "inventory"
): ReadonlyPrototypeActionOutcome {
  const interaction = executeReadonlyAction(runtime, actionId, "action");
  const playerStateBefore = cloneJsonValue(interaction.initialPlayerState ?? runtime.playerState);
  const playerStateAfter = cloneJsonValue(interaction.finalPlayerState ?? runtime.playerState);

  return {
    actionId,
    status: interaction.status,
    interaction,
    output: createOutputFromInteraction(interaction),
    diagnostics: interaction.diagnostics,
    playerStateBefore,
    playerStateAfter,
    playerStateUnchanged: canonicalizeValue(playerStateBefore) === canonicalizeValue(playerStateAfter)
  };
}

function createGoSelectionOutcome(runtime: PrototypeRuntimeContext): ReadonlyPrototypeActionOutcome {
  const playerStateBefore = cloneJsonValue(runtime.playerState);
  const playerStateAfter = cloneJsonValue(runtime.playerState);
  const location = createPresentationSnapshot(runtime).location;
  const disabledReason = createGoDisabledReason(location);

  if (disabledReason !== undefined) {
    return {
      actionId: "go",
      status: "disabled",
      disabledReason,
      output: {
        kind: "go",
        title: "Movement Unavailable",
        lines: [disabledReason]
      },
      diagnostics: [createDiagnosticView("PROTOTYPE_MOVEMENT_DISABLED", disabledReason, ["commandPalette", "go"])],
      playerStateBefore,
      playerStateAfter,
      playerStateUnchanged: true
    };
  }

  return {
    actionId: "go",
    status: "blocked",
    output: {
      kind: "go",
      title: "Select Exit",
      lines: [GO_SELECT_EXIT_DETAIL]
    },
    diagnostics: [createDiagnosticView("PROTOTYPE_MOVEMENT_EXIT_SELECTION_REQUIRED", GO_SELECT_EXIT_DETAIL, ["commandPalette", "go"])],
    playerStateBefore,
    playerStateAfter,
    playerStateUnchanged: true
  };
}

function createMovementOutcome(runtime: PrototypeRuntimeContext, exitId: string): ReadonlyPrototypeActionOutcome {
  const currentLocation = runtime.content.getLocation(runtime.playerState.currentLocationId);
  const exit = currentLocation?.exits.find((candidate) => candidate.exitId === exitId);
  const playerStateBefore = cloneJsonValue(runtime.playerState);

  if (currentLocation === undefined || exit === undefined) {
    return {
      actionId: "go",
      status: "blocked",
      output: {
        kind: "go",
        title: "Movement Blocked",
        lines: ["The selected exit is no longer available from the current location."]
      },
      diagnostics: [
        createDiagnosticView(
          "PROTOTYPE_MOVEMENT_EXIT_UNAVAILABLE",
          "The selected exit is no longer available from the current location.",
          ["exitActions", exitId]
        )
      ],
      playerStateBefore,
      playerStateAfter: cloneJsonValue(runtime.playerState),
      playerStateUnchanged: true
    };
  }

  const plan = createRuntimeCommandPlan({
    request: {
      commandId: "go",
      targetId: exit.targetLocationId
    },
    content: runtime.content,
    playerState: runtime.playerState,
    metadata: {
      deterministic: true,
      requestId: `${runtime.descriptor.scenarioId}.go.${exit.exitId}`,
      correlationId: runtime.descriptor.scenarioId
    }
  });

  const movement = executeRuntimeMovementCommand({
    plan,
    content: runtime.content,
    playerState: runtime.playerState,
    metadata: {
      deterministic: true,
      requestId: `${runtime.descriptor.scenarioId}.go.${exit.exitId}`,
      correlationId: runtime.descriptor.scenarioId
    }
  });

  if (movement.status === "executed" && movement.finalPlayerState !== undefined) {
    runtime.playerState = cloneJsonValue(movement.finalPlayerState);
  }

  const playerStateAfter = cloneJsonValue(movement.finalPlayerState ?? runtime.playerState);
  const snapshot = createPresentationSnapshot(runtime);

  return {
    actionId: "go",
    status: movement.status,
    movement,
    output: createOutputFromMovement(movement, snapshot),
    diagnostics: movement.diagnostics,
    playerStateBefore,
    playerStateAfter,
    playerStateUnchanged: canonicalizeValue(playerStateBefore) === canonicalizeValue(playerStateAfter)
  };
}

function buildStateForIdle(
  runtime: PrototypeRuntimeContext,
  selection?: PrototypeInspectionSelection
): ReadonlyPrototypeState {
  const snapshot = createPresentationSnapshot(runtime);
  return createStateFromRuntime(
    runtime,
    snapshot,
    createTranscriptPreviewOutput(snapshot.transcript),
    snapshot.diagnostics,
    {
      kind: "idle",
      detail: "Ready. Look and Inventory remain read-only. Go is available only through explicit exits when the current location exposes them. Inspection is fully read-only and separate from action execution."
    },
    selection
  );
}

function buildStateFromOutcome(
  runtime: PrototypeRuntimeContext,
  outcome: ReadonlyPrototypeActionOutcome,
  selection?: PrototypeInspectionSelection
): ReadonlyPrototypeState {
  const snapshot = createPresentationSnapshot(runtime);
  const diagnostics = outcome.diagnostics.length > 0 ? outcome.diagnostics : snapshot.diagnostics;
  const detail = outcome.status === "executed"
    ? outcome.actionId === "go"
      ? "GO executed through the controlled movement boundary."
      : `${outcome.actionId.toUpperCase()} executed through the read-only boundary with no gameplay mutation.`
    : outcome.status === "disabled"
      ? `${outcome.actionId.toUpperCase()}: ${outcome.disabledReason ?? "Unavailable."}`
      : outcome.status === "blocked"
        ? `${outcome.actionId.toUpperCase()} is blocked until a valid target or boundary condition is satisfied.`
        : `${outcome.actionId.toUpperCase()} was rejected by the current boundary.`;

  return createStateFromRuntime(
    runtime,
    snapshot,
    outcome.output,
    diagnostics,
    {
      kind: outcome.status,
      detail
    },
    selection
  );
}

export function createReadonlyPrototypeState(
  scenarioId: PrototypeScenarioId = DEFAULT_PROTOTYPE_SCENARIO_ID
): ReadonlyPrototypeState {
  return cloneJsonValue(buildStateForIdle(createScenarioRuntimeContext(scenarioId)));
}

function createInspectionSelectionFromExit(
  exitId: string,
  runtime: PrototypeRuntimeContext
): PrototypeInspectionSelection | undefined {
  const currentLocation = runtime.content.getLocation(runtime.playerState.currentLocationId);
  const exit = currentLocation?.exits.find((candidate) => candidate.exitId === exitId);

  return exit === undefined
    ? undefined
    : {
        kind: "exit",
        exitId: exit.exitId,
        targetLocationId: exit.targetLocationId
      };
}

export function createReadonlyPrototypeController(
  initialScenarioId: PrototypeScenarioId = DEFAULT_PROTOTYPE_SCENARIO_ID
): ReadonlyPrototypeController {
  let runtime = createScenarioRuntimeContext(initialScenarioId);
  let selection: PrototypeInspectionSelection | undefined;
  let state = buildStateForIdle(runtime, selection);

  return {
    getState(): ReadonlyPrototypeState {
      return cloneJsonValue(state);
    },
    runAction(actionId: PrototypeCommandId): ReadonlyPrototypeActionOutcome {
      const outcome = actionId === "look" || actionId === "inventory"
        ? createExecutableReadonlyActionOutcome(runtime, actionId)
        : actionId === "go"
          ? createGoSelectionOutcome(runtime)
          : createDisabledActionOutcome(runtime, actionId);

      state = buildStateFromOutcome(runtime, outcome, selection);
      return cloneJsonValue(outcome);
    },
    moveToExit(exitId: string): ReadonlyPrototypeActionOutcome {
      const outcome = createMovementOutcome(runtime, exitId);
      selection = undefined;
      state = buildStateFromOutcome(runtime, outcome, selection);
      return cloneJsonValue(outcome);
    },
    selectScenario(scenarioId: PrototypeScenarioId): ReadonlyPrototypeState {
      runtime = createScenarioRuntimeContext(scenarioId);
      selection = undefined;
      state = buildStateForIdle(runtime, selection);
      return cloneJsonValue(state);
    },
    inspectLocation(): ReadonlyPrototypeState {
      const location = state.location;
      selection = location === undefined ? undefined : { kind: "location", locationId: location.locationId };
      state = buildStateForIdle(runtime, selection);
      return cloneJsonValue(state);
    },
    inspectExit(exitId: string): ReadonlyPrototypeState {
      selection = createInspectionSelectionFromExit(exitId, runtime);
      state = buildStateForIdle(runtime, selection);
      return cloneJsonValue(state);
    },
    inspectItem(itemId: string): ReadonlyPrototypeState {
      selection = { kind: "item", itemId };
      state = buildStateForIdle(runtime, selection);
      return cloneJsonValue(state);
    },
    inspectNpc(npcId: string): ReadonlyPrototypeState {
      selection = { kind: "npc", npcId };
      state = buildStateForIdle(runtime, selection);
      return cloneJsonValue(state);
    },
    clearInspection(): ReadonlyPrototypeState {
      selection = undefined;
      state = buildStateForIdle(runtime, selection);
      return cloneJsonValue(state);
    }
  };
}
