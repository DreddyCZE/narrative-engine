import { canonicalizeJson, inspectJsonSafety } from "@narrative-engine/core";
import { describe, expect, it } from "vitest";

import * as engineContracts from "@narrative-engine/engine-contracts";

import {
  DISABLED_PROTOTYPE_ACTIONS,
  EXECUTABLE_PROTOTYPE_ACTIONS,
  PROTOTYPE_COMMAND_IDS,
  createReadonlyPrototypeController,
  createReadonlyPrototypeState
} from "./readonly-prototype.js";
import {
  DEFAULT_PROTOTYPE_SCENARIO_ID,
  OBSERVATION_DECK_PROTOTYPE_SCENARIO_ID,
  PROTOTYPE_SCENARIOS,
  SMOKE_PROTOTYPE_SCENARIO_ID
} from "./prototype-scenarios.js";

type RuntimePlayerState = engineContracts.RuntimePlayerState;

function expectJsonSafe(value: unknown): void {
  expect(inspectJsonSafety(value)).toEqual([]);
}

function assertStateSnapshots(outcome: {
  readonly playerStateBefore: RuntimePlayerState;
  readonly playerStateAfter: RuntimePlayerState;
}): {
  readonly before: RuntimePlayerState;
  readonly after: RuntimePlayerState;
} {
  return {
    before: outcome.playerStateBefore,
    after: outcome.playerStateAfter
  };
}

describe("pickup ux diagnostics hardening", () => {
  it("shows visible portable and visible non-portable item actions while generic Take remains disabled", () => {
    const state = createReadonlyPrototypeState(OBSERVATION_DECK_PROTOTYPE_SCENARIO_ID);
    const deckPass = state.itemPresence.find((item) => item.itemId === "item.demo.deck-pass");
    const bulkheadPlaque = state.itemPresence.find((item) => item.itemId === "item.demo.bulkhead-plaque");
    const genericTake = state.commandPalette.find((item) => item.commandId === "take");

    expect(state.location?.items.map((item) => item.itemId)).toEqual([
      "item.demo.deck-pass",
      "item.demo.bulkhead-plaque"
    ]);
    expect(deckPass).toEqual(expect.objectContaining({
      itemId: "item.demo.deck-pass",
      status: "visible-here",
      portable: true,
      takeEnabled: true
    }));
    expect(bulkheadPlaque).toEqual(expect.objectContaining({
      itemId: "item.demo.bulkhead-plaque",
      status: "visible-here",
      portable: false,
      takeEnabled: false,
      takeDisabledReason: "This visible item is not portable."
    }));
    expect(genericTake).toEqual(expect.objectContaining({
      commandId: "take",
      enabled: false,
      disabledReason: "Generic Take stays disabled. Use explicit visible item Take buttons only."
    }));
  });

  it("shows non-portable item inspection as take not-applicable", () => {
    const state = createReadonlyPrototypeController(OBSERVATION_DECK_PROTOTYPE_SCENARIO_ID).inspectItem("item.demo.bulkhead-plaque");

    expect(state.inspectionPanel.title).toBe("Prototype Bulkhead Plaque");
    expect(state.inspectionPanel.lines).toContain("Presence: visible-here");
    expect(state.inspectionPanel.futureActionReadiness).toEqual(expect.arrayContaining([
      {
        commandId: "take",
        label: "Take",
        status: "not-applicable",
        reason: "This visible item is not portable.",
        entityKind: "item",
        entityId: "item.demo.bulkhead-plaque",
        readonly: true
      }
    ]));
  });

  it("blocks visible non-portable pickup with the not-portable diagnostic and preserves room visibility", () => {
    const controller = createReadonlyPrototypeController(OBSERVATION_DECK_PROTOTYPE_SCENARIO_ID);
    const beforeState = controller.getState();
    const outcome = controller.pickupItem("item.demo.bulkhead-plaque");
    const afterState = controller.getState();
    const snapshots = assertStateSnapshots(outcome);

    expect(outcome.status).toBe("blocked");
    expect(outcome.pickup?.diagnostics[0]?.code).toBe("RUNTIME_ITEM_PICKUP_COMMAND_ITEM_NOT_PORTABLE");
    expect(outcome.output.lines).toContain("Prototype Bulkhead Plaque is visible here but not portable.");
    expect(canonicalizeJson(snapshots.before)).toBe(canonicalizeJson(snapshots.after));
    expect(afterState.location?.items.map((item) => item.itemId)).toEqual(beforeState.location?.items.map((item) => item.itemId));
    expect(afterState.location?.items.map((item) => item.itemId)).toContain("item.demo.bulkhead-plaque");
    expect(afterState.itemPresence.find((item) => item.itemId === "item.demo.bulkhead-plaque")).toEqual(expect.objectContaining({
      status: "visible-here",
      portable: false,
      takeEnabled: false,
      takeDisabledReason: "This visible item is not portable."
    }));
  });

  it("blocks inventory item pickup with the already-in-inventory diagnostic and preserves state", () => {
    const controller = createReadonlyPrototypeController(OBSERVATION_DECK_PROTOTYPE_SCENARIO_ID);
    const beforeState = controller.getState();
    const outcome = controller.pickupItem("item.demo.survey-tablet");
    const afterState = controller.getState();
    const snapshots = assertStateSnapshots(outcome);

    expect(outcome.status).toBe("blocked");
    expect(outcome.pickup?.diagnostics[0]?.code).toBe("RUNTIME_ITEM_PICKUP_COMMAND_ITEM_ALREADY_IN_INVENTORY");
    expect(outcome.output.lines).toContain("Prototype Survey Tablet is already in inventory.");
    expect(canonicalizeJson(snapshots.before)).toBe(canonicalizeJson(snapshots.after));
    expect(afterState.itemPresence).toEqual(beforeState.itemPresence);
  });

  it("blocks elsewhere item pickup with the not-visible-here diagnostic and preserves state", () => {
    const controller = createReadonlyPrototypeController(OBSERVATION_DECK_PROTOTYPE_SCENARIO_ID);
    const beforeState = controller.getState();
    const outcome = controller.pickupItem("item.demo.locker-seal");
    const afterState = controller.getState();
    const snapshots = assertStateSnapshots(outcome);

    expect(outcome.status).toBe("blocked");
    expect(outcome.pickup?.diagnostics[0]?.code).toBe("RUNTIME_ITEM_PICKUP_COMMAND_ITEM_NOT_VISIBLE_HERE");
    expect(outcome.output.lines).toContain("Prototype Locker Seal is not visible here.");
    expect(canonicalizeJson(snapshots.before)).toBe(canonicalizeJson(snapshots.after));
    expect(afterState.mapPanel.currentLocationId).toBe(beforeState.mapPanel.currentLocationId);
  });

  it("picks up the visible portable deck pass and moves it from room view to inventory projection", () => {
    const controller = createReadonlyPrototypeController(OBSERVATION_DECK_PROTOTYPE_SCENARIO_ID);
    const beforeState = controller.getState();
    const outcome = controller.pickupItem("item.demo.deck-pass");
    const afterState = controller.getState();

    expect(outcome.status).toBe("executed");
    expect(outcome.pickup?.status).toBe("executed");
    expect(outcome.pickup?.itemId).toBe("item.demo.deck-pass");
    expect(outcome.output.lines).toContain("Picked up Prototype Deck Pass.");
    expect(beforeState.location?.items.map((item) => item.itemId)).toEqual([
      "item.demo.deck-pass",
      "item.demo.bulkhead-plaque"
    ]);
    expect(afterState.location?.items.map((item) => item.itemId)).toEqual(["item.demo.bulkhead-plaque"]);
    expect(afterState.inventory?.items.map((item) => item.itemId)).toEqual([
      "item.demo.survey-tablet",
      "item.demo.deck-pass"
    ]);
    expect(afterState.itemPresence.find((item) => item.itemId === "item.demo.deck-pass")).toEqual(expect.objectContaining({
      status: "in-inventory",
      takeEnabled: false,
      takeDisabledReason: "This item is already in inventory."
    }));
  });

  it("keeps current location map highlight and progress flags unchanged after successful pickup", () => {
    const controller = createReadonlyPrototypeController(OBSERVATION_DECK_PROTOTYPE_SCENARIO_ID);
    const beforeState = controller.getState();
    const outcome = controller.pickupItem("item.demo.deck-pass");
    const afterState = controller.getState();

    expect(outcome.playerStateUnchanged).toBe(false);
    expect(outcome.playerStateBefore.currentLocationId).toBe("location.demo.observation-deck");
    expect(outcome.playerStateAfter.currentLocationId).toBe("location.demo.observation-deck");
    expect(outcome.playerStateBefore.progressFlags).toEqual(["demo.ready"]);
    expect(outcome.playerStateAfter.progressFlags).toEqual(["demo.ready"]);
    expect(beforeState.mapPanel.currentLocationId).toBe("location.demo.observation-deck");
    expect(afterState.mapPanel.currentLocationId).toBe("location.demo.observation-deck");
    expect(afterState.inventory?.itemCount).toBe(2);
  });

  it("shows take readiness as not-applicable when inspecting the deck pass after pickup", () => {
    const controller = createReadonlyPrototypeController(OBSERVATION_DECK_PROTOTYPE_SCENARIO_ID);

    controller.pickupItem("item.demo.deck-pass");
    const state = controller.inspectItem("item.demo.deck-pass");

    expect(state.inspectionPanel.lines).toContain("Presence: in-inventory");
    expect(state.inspectionPanel.futureActionReadiness).toEqual(expect.arrayContaining([
      {
        commandId: "take",
        label: "Take",
        status: "not-applicable",
        reason: "This item is already in inventory and is not a pickup target.",
        entityKind: "item",
        entityId: "item.demo.deck-pass",
        readonly: true
      }
    ]));
  });

  it("keeps movement behavior intact after pickup hardening", () => {
    const controller = createReadonlyPrototypeController();
    const outcome = controller.moveToExit("exit.smoke.to-corridor");
    const nextState = controller.getState();

    expect(outcome.status).toBe("executed");
    expect(outcome.movement?.status).toBe("executed");
    expect(outcome.movement?.toLocationId).toBe("location.smoke.corridor");
    expect(nextState.location?.title).toBe("Smoke Test Corridor");
  });

  it("keeps locked and condition-gated movement diagnostics intact", () => {
    const controller = createReadonlyPrototypeController(OBSERVATION_DECK_PROTOTYPE_SCENARIO_ID);
    const locked = controller.moveToExit("exit.demo.locked-service-door");
    const gated = controller.moveToExit("exit.demo.maintenance-hatch");

    expect(locked.status).toBe("blocked");
    expect(locked.movement?.diagnostics.map((diagnostic) => diagnostic.code)).toContain("RUNTIME_MOVEMENT_COMMAND_EXIT_LOCKED");
    expect(gated.status).toBe("blocked");
    expect(gated.movement?.diagnostics.map((diagnostic) => diagnostic.code)).toContain("RUNTIME_MOVEMENT_COMMAND_EXIT_CONDITION_UNMET");
  });

  it("keeps inspection behavior intact for location exit item and npc views", () => {
    const controller = createReadonlyPrototypeController(OBSERVATION_DECK_PROTOTYPE_SCENARIO_ID);

    expect(controller.inspectLocation().inspectionPanel.title).toBe("Prototype Observation Deck");
    expect(controller.inspectExit("exit.demo.to-sensor-gallery").inspectionPanel.title).toBe("Slide sensor gallery door");
    expect(controller.inspectItem("item.demo.deck-pass").inspectionPanel.title).toBe("Prototype Deck Pass");
    expect(controller.inspectItem("item.demo.bulkhead-plaque").inspectionPanel.title).toBe("Prototype Bulkhead Plaque");
    expect(controller.inspectNpc("npc.demo.analyst").inspectionPanel.title).toBe("Prototype Analyst");
  });

  it("keeps future action readiness read-only while reflecting pickup availability", () => {
    const state = createReadonlyPrototypeController(OBSERVATION_DECK_PROTOTYPE_SCENARIO_ID).inspectItem("item.demo.deck-pass");

    expect(state.inspectionPanel.readonly).toBe(true);
    expect(state.inspectionPanel.futureActionReadiness).toEqual(expect.arrayContaining([
      {
        commandId: "take",
        label: "Take",
        status: "already-enabled",
        reason: "Take is available through the explicit item button for this visible portable item.",
        entityKind: "item",
        entityId: "item.demo.deck-pass",
        readonly: true
      }
    ]));
  });

  it("keeps Talk Take Use Save and Load palette actions disabled local ui-only commands", () => {
    const controller = createReadonlyPrototypeController();

    for (const actionId of DISABLED_PROTOTYPE_ACTIONS) {
      const outcome = controller.runAction(actionId);
      const snapshots = assertStateSnapshots(outcome);

      expect(outcome.status).toBe("disabled");
      expect(outcome.interaction).toBeUndefined();
      expect(outcome.movement).toBeUndefined();
      expect(outcome.pickup).toBeUndefined();
      expect(canonicalizeJson(snapshots.before)).toBe(canonicalizeJson(snapshots.after));
    }
  });

  it("keeps scenario metadata and default routing intact", () => {
    const state = createReadonlyPrototypeState();

    expect(DEFAULT_PROTOTYPE_SCENARIO_ID).toBe(SMOKE_PROTOTYPE_SCENARIO_ID);
    expect(state.selectedScenarioId).toBe(SMOKE_PROTOTYPE_SCENARIO_ID);
    expect(PROTOTYPE_SCENARIOS.map((scenario) => scenario.scenarioId)).toEqual([
      SMOKE_PROTOTYPE_SCENARIO_ID,
      OBSERVATION_DECK_PROTOTYPE_SCENARIO_ID
    ]);
    expect(EXECUTABLE_PROTOTYPE_ACTIONS).toEqual(["look", "inventory", "go"]);
    expect(PROTOTYPE_COMMAND_IDS).toEqual(["look", "inventory", "go", "talk", "take", "use", "save", "load"]);
  });

  it("does not introduce parser arbitrary input storage replay db p0 map editor or plugin runtime exports", () => {
    const controller = createReadonlyPrototypeController(OBSERVATION_DECK_PROTOTYPE_SCENARIO_ID);
    const pickup = controller.pickupItem("item.demo.deck-pass");
    const state = controller.getState();

    expect("P0ContentPackage" in engineContracts).toBe(false);
    expect("MapEditor" in engineContracts).toBe(false);
    expect("executeRuntimeCommand" in engineContracts).toBe(false);
    expect("saveGameToBrowserStorage" in engineContracts).toBe(false);
    expect("createReplayRuntime" in engineContracts).toBe(false);
    expect("connectDatabaseRuntime" in engineContracts).toBe(false);
    expect("pluginRuntime" in engineContracts).toBe(false);
    expectJsonSafe(state);
    expectJsonSafe(pickup);
  });
});
