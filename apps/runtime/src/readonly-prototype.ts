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

export const READONLY_PROTOTYPE_ACTIONS = ["look", "inventory"] as const;

type ReadonlyPrototypeActionId = (typeof READONLY_PROTOTYPE_ACTIONS)[number];

type ReadonlyPrototypeOutputPanel = {
  readonly kind: "transcript-preview" | ReadonlyPrototypeActionId;
  readonly title: string;
  readonly lines: readonly string[];
};

type ReadonlyPrototypeStatus = {
  readonly kind: "idle" | "executed" | "rejected" | "blocked";
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
  readonly availableActions: readonly ReadonlyPrototypeActionId[];
  readonly status: ReadonlyPrototypeStatus;
};

export type ReadonlyPrototypeInteractionOutcome = {
  readonly actionId: ReadonlyPrototypeActionId;
  readonly interaction: RuntimeReadonlyInteractionResult;
  readonly output: ReadonlyPrototypeOutputPanel;
  readonly playerStateBefore?: RuntimePlayerState;
  readonly playerStateAfter?: RuntimePlayerState;
  readonly playerStateUnchanged: boolean;
};

export type ReadonlyPrototypeController = {
  readonly getState: () => ReadonlyPrototypeState;
  readonly runAction: (actionId: ReadonlyPrototypeActionId) => ReadonlyPrototypeInteractionOutcome;
};

type PrototypeRuntimeContext = ReturnType<typeof createPrototypeRuntimeContext>;

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function formatListLine(prefix: string, values: readonly string[], emptyLabel: string): string {
  return values.length > 0 ? `${prefix}: ${values.join(", ")}` : `${prefix}: ${emptyLabel}`;
}

function toSupportedActionIds(commandIds: readonly string[]): readonly ReadonlyPrototypeActionId[] {
  return READONLY_PROTOTYPE_ACTIONS.filter((commandId) => commandIds.includes(commandId));
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
function createStateFromSnapshot(
  runtime: PrototypeRuntimeContext,
  snapshot = runReadonlyRuntimePresentationSnapshotScenario()
): ReadonlyPrototypeState {
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
    availableActions: toSupportedActionIds(snapshot.summary.availableCommands),
    status: {
      kind: "idle",
      detail: "Ready. Only look and inventory are exposed."
    }
  };
}

function createStateFromInteraction(
  previousState: ReadonlyPrototypeState,
  outcome: ReadonlyPrototypeInteractionOutcome
): ReadonlyPrototypeState {
  const lookView = outcome.interaction.execution?.view?.kind === "look"
    ? outcome.interaction.execution.view.look
    : undefined;
  const inventoryView = outcome.interaction.execution?.view?.kind === "inventory"
    ? outcome.interaction.execution.view.inventory
    : undefined;

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
          },
          availableActions: toSupportedActionIds(lookView.availableActions)
        }),
    ...(inventoryView === undefined
      ? {}
      : {
          inventory: {
            itemCount: inventoryView.itemCount,
            items: inventoryView.items.map((item) => ({
              itemId: item.itemId,
              title: item.title,
              description: item.description,
              ...(item.portable === undefined ? {} : { portable: item.portable })
            })),
            empty: inventoryView.itemCount === 0
          }
        }),
    output: outcome.output,
    diagnostics: outcome.interaction.diagnostics,
    status: {
      kind: outcome.interaction.status,
      detail: outcome.playerStateUnchanged
        ? `${outcome.interaction.status.toUpperCase()}: ${outcome.actionId} preserved player state.`
        : `${outcome.interaction.status.toUpperCase()}: unexpected player-state drift detected.`
    }
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
    runAction(actionId: ReadonlyPrototypeActionId): ReadonlyPrototypeInteractionOutcome {
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
      const output = createOutputFromInteraction(interaction);
      const playerStateBefore = interaction.initialPlayerState;
      const playerStateAfter = interaction.finalPlayerState;
      const playerStateUnchanged = JSON.stringify(playerStateBefore) === JSON.stringify(playerStateAfter);
      const outcome: ReadonlyPrototypeInteractionOutcome = {
        actionId,
        interaction,
        output,
        ...(playerStateBefore === undefined ? {} : { playerStateBefore }),
        ...(playerStateAfter === undefined ? {} : { playerStateAfter }),
        playerStateUnchanged
      };

      state = createStateFromInteraction(state, outcome);
      return cloneJsonValue(outcome);
    }
  };
}

