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

describe("movement diagnostics prototype vertical slice", () => {
  it("exposes exit availability metadata", () => {
    const state = createReadonlyPrototypeState(OBSERVATION_DECK_PROTOTYPE_SCENARIO_ID);

    expect(state.exitActions).toEqual([
      {
        exitId: "exit.demo.to-sensor-gallery",
        label: "Slide sensor gallery door",
        targetLocationId: "location.demo.sensor-gallery",
        targetLocationTitle: "Prototype Sensor Gallery",
        availability: "available",
        enabled: true
      },
      {
        exitId: "exit.demo.locked-service-door",
        label: "Open service locker",
        targetLocationId: "location.demo.service-locker",
        targetLocationTitle: "Prototype Service Locker",
        availability: "locked",
        enabled: false,
        disabledReason: "Movement is blocked because this exit is locked.",
        locked: true
      },
      {
        exitId: "exit.demo.maintenance-hatch",
        label: "Cycle maintenance hatch",
        targetLocationId: "location.demo.maintenance-hatch",
        targetLocationTitle: "Prototype Maintenance Hatch",
        availability: "condition-gated",
        enabled: false,
        disabledReason: "Movement is blocked until progress flag \"demo.maintenance-access\" is present.",
        conditionFlag: "demo.maintenance-access"
      }
    ]);
  });

  it("keeps go enabled when the current location has visible exits", () => {
    const state = createReadonlyPrototypeState();

    expect(DEFAULT_PROTOTYPE_SCENARIO_ID).toBe(SMOKE_PROTOTYPE_SCENARIO_ID);
    expect(state.selectedScenarioId).toBe(SMOKE_PROTOTYPE_SCENARIO_ID);
    expect(state.location?.title).toBe("Smoke Test Airlock");
    expect(state.commandPalette.find((item) => item.commandId === "go")?.enabled).toBe(true);
    expect(state.availableActions).toEqual(["look", "inventory", "go"]);
  });

  it("available exits still move and update the current location", () => {
    const controller = createReadonlyPrototypeController();
    const outcome = controller.moveToExit("exit.smoke.to-corridor");
    const nextState = controller.getState();

    expect(outcome.status).toBe("executed");
    expect(outcome.movement?.status).toBe("executed");
    expect(outcome.movement?.toLocationId).toBe("location.smoke.corridor");
    expect(nextState.location?.title).toBe("Smoke Test Corridor");
    expect(nextState.output.lines.some((line) => line.includes("Smoke Test Corridor"))).toBe(true);
  });

  it("updates the map highlight after accepted movement", () => {
    const controller = createReadonlyPrototypeController();
    const beforeState = controller.getState();

    controller.moveToExit("exit.smoke.to-corridor");
    const afterState = controller.getState();

    expect(beforeState.mapPanel.currentLocationId).toBe("location.smoke.start");
    expect(afterState.mapPanel.currentLocationId).toBe("location.smoke.corridor");
  });

  it("preserves inventory after movement", () => {
    const controller = createReadonlyPrototypeController();
    const beforeState = controller.getState();
    const outcome = controller.moveToExit("exit.smoke.to-corridor");
    const afterState = controller.getState();

    expect(outcome.playerStateUnchanged).toBe(false);
    expect(beforeState.inventory?.items.map((item) => item.title)).toEqual(["Smoke Test Keycard"]);
    expect(afterState.inventory?.items.map((item) => item.title)).toEqual(["Smoke Test Keycard"]);
    expect(outcome.playerStateBefore.inventoryItemIds).toEqual(outcome.playerStateAfter.inventoryItemIds);
    expect(outcome.playerStateBefore.progressFlags).toEqual(outcome.playerStateAfter.progressFlags);
  });

  it("shows the new location when look runs after movement", () => {
    const controller = createReadonlyPrototypeController();

    controller.moveToExit("exit.smoke.to-corridor");
    const outcome = controller.runAction("look");

    expect(outcome.status).toBe("executed");
    expect(outcome.interaction?.execution?.view?.kind).toBe("look");
    expect(outcome.output.title).toBe("Smoke Test Corridor");
    expect(outcome.output.lines.some((line) => line.includes("Service") || line.includes("corridor") || line.includes("Corridor"))).toBe(true);
  });

  it("available movement still works in the observation deck scenario", () => {
    const controller = createReadonlyPrototypeController(OBSERVATION_DECK_PROTOTYPE_SCENARIO_ID);
    const outcome = controller.moveToExit("exit.demo.to-sensor-gallery");
    const nextState = controller.getState();

    expect(outcome.status).toBe("executed");
    expect(outcome.movement?.toLocationId).toBe("location.demo.sensor-gallery");
    expect(nextState.location?.title).toBe("Prototype Sensor Gallery");
  });

  it("locked exits display blocked diagnostics without changing location or map highlight", () => {
    const controller = createReadonlyPrototypeController(OBSERVATION_DECK_PROTOTYPE_SCENARIO_ID);
    const beforeState = controller.getState();
    const outcome = controller.moveToExit("exit.demo.locked-service-door");
    const afterState = controller.getState();
    const snapshots = assertStateSnapshots(outcome);

    expect(outcome.status).toBe("blocked");
    expect(outcome.movement?.status).toBe("blocked");
    expect(outcome.movement?.diagnostics.map((diagnostic) => diagnostic.code)).toContain("RUNTIME_MOVEMENT_COMMAND_EXIT_LOCKED");
    expect(outcome.output.lines.some((line) => line.includes("RUNTIME_MOVEMENT_COMMAND_EXIT_LOCKED"))).toBe(true);
    expect(afterState.location?.title).toBe(beforeState.location?.title);
    expect(afterState.mapPanel.currentLocationId).toBe(beforeState.mapPanel.currentLocationId);
    expect(canonicalizeJson(snapshots.before)).toBe(canonicalizeJson(snapshots.after));
    expect(outcome.playerStateUnchanged).toBe(true);
  });

  it("condition-gated exits display blocked diagnostics without changing location or map highlight", () => {
    const controller = createReadonlyPrototypeController(OBSERVATION_DECK_PROTOTYPE_SCENARIO_ID);
    const beforeState = controller.getState();
    const outcome = controller.moveToExit("exit.demo.maintenance-hatch");
    const afterState = controller.getState();
    const snapshots = assertStateSnapshots(outcome);

    expect(outcome.status).toBe("blocked");
    expect(outcome.movement?.status).toBe("blocked");
    expect(outcome.movement?.diagnostics.map((diagnostic) => diagnostic.code)).toContain("RUNTIME_MOVEMENT_COMMAND_EXIT_CONDITION_UNMET");
    expect(outcome.output.lines.some((line) => line.includes("RUNTIME_MOVEMENT_COMMAND_EXIT_CONDITION_UNMET"))).toBe(true);
    expect(afterState.location?.title).toBe(beforeState.location?.title);
    expect(afterState.mapPanel.currentLocationId).toBe(beforeState.mapPanel.currentLocationId);
    expect(canonicalizeJson(snapshots.before)).toBe(canonicalizeJson(snapshots.after));
    expect(outcome.playerStateUnchanged).toBe(true);
  });

  it("disables go after moving to a no-exit location", () => {
    const controller = createReadonlyPrototypeController();

    controller.moveToExit("exit.smoke.to-corridor");
    const nextState = controller.getState();

    expect(nextState.exitActions).toEqual([]);
    expect(nextState.commandPalette.find((item) => item.commandId === "go")?.enabled).toBe(false);
    expect(nextState.commandPalette.find((item) => item.commandId === "go")?.disabledReason).toBe("No exit is available from the current location.");
    expect(nextState.availableActions).toEqual(["look", "inventory"]);
  });

  it("keeps Talk Take Use Save and Load disabled local ui-only actions", () => {
    const controller = createReadonlyPrototypeController();

    for (const actionId of DISABLED_PROTOTYPE_ACTIONS) {
      const outcome = controller.runAction(actionId);
      const snapshots = assertStateSnapshots(outcome);

      expect(outcome.status).toBe("disabled");
      expect(outcome.interaction).toBeUndefined();
      expect(outcome.movement).toBeUndefined();
      expect(canonicalizeJson(snapshots.before)).toBe(canonicalizeJson(snapshots.after));
      expect(outcome.playerStateUnchanged).toBe(true);
      expectJsonSafe(outcome);
    }
  });

  it("keeps engine contracts free of storage replay db and final-game exports", () => {
    const controller = createReadonlyPrototypeController();
    const smokeMove = controller.moveToExit("exit.smoke.to-corridor");
    const demoController = createReadonlyPrototypeController(OBSERVATION_DECK_PROTOTYPE_SCENARIO_ID);
    const demoState = demoController.selectScenario(OBSERVATION_DECK_PROTOTYPE_SCENARIO_ID);

    expect(PROTOTYPE_SCENARIOS.map((scenario) => scenario.scenarioId)).toEqual([
      SMOKE_PROTOTYPE_SCENARIO_ID,
      OBSERVATION_DECK_PROTOTYPE_SCENARIO_ID
    ]);
    expect(PROTOTYPE_COMMAND_IDS).toEqual(["look", "inventory", "go", "talk", "take", "use", "save", "load"]);
    expect(EXECUTABLE_PROTOTYPE_ACTIONS).toEqual(["look", "inventory", "go"]);
    expect("P0ContentPackage" in engineContracts).toBe(false);
    expect("MapEditor" in engineContracts).toBe(false);
    expect("moveTo" in engineContracts).toBe(false);
    expect("executeRuntimeCommand" in engineContracts).toBe(false);
    expect("saveGameToBrowserStorage" in engineContracts).toBe(false);
    expect("createReplayRuntime" in engineContracts).toBe(false);
    expect("connectDatabaseRuntime" in engineContracts).toBe(false);
    expect("pluginRuntime" in engineContracts).toBe(false);
    expect(smokeMove.movement?.finalPlayerState?.currentLocationId).toBe("location.smoke.corridor");
    expect(demoState.location?.title).toBe("Prototype Observation Deck");
    expectJsonSafe(demoState);
    expectJsonSafe(smokeMove);
  });
});

describe("read-only inspection panel", () => {
  it("includes an inspection panel in read-only mode by default", () => {
    const state = createReadonlyPrototypeState();

    expect(state.inspectionPanel.readonly).toBe(true);
    expect(state.inspectionPanel.selection).toBeUndefined();
    expect(state.inspectionPanel.title).toBe("Inspection");
  });

  it("inspects the current location without moving or mutating state", () => {
    const controller = createReadonlyPrototypeController(OBSERVATION_DECK_PROTOTYPE_SCENARIO_ID);
    const before = controller.getState();
    const state = controller.inspectLocation();

    expect(state.inspectionPanel.selection).toEqual({
      kind: "location",
      locationId: "location.demo.observation-deck"
    });
    expect(state.inspectionPanel.title).toBe("Prototype Observation Deck");
    expect(state.inspectionPanel.lines).toContain("A bright observation deck with prototype navigation glass and a calm starfield beyond the hull.");
    expect(state.inspectionPanel.lines).toContain("Visible exits: 3");
    expect(state.mapPanel.currentLocationId).toBe(before.mapPanel.currentLocationId);
    expect(state.location?.title).toBe(before.location?.title);
  });

  it("inspects available and blocked exits without executing movement", () => {
    const controller = createReadonlyPrototypeController(OBSERVATION_DECK_PROTOTYPE_SCENARIO_ID);
    const available = controller.inspectExit("exit.demo.to-sensor-gallery");
    const locked = controller.inspectExit("exit.demo.locked-service-door");
    const gated = controller.inspectExit("exit.demo.maintenance-hatch");

    expect(available.inspectionPanel.selection).toEqual({
      kind: "exit",
      exitId: "exit.demo.to-sensor-gallery",
      targetLocationId: "location.demo.sensor-gallery"
    });
    expect(available.inspectionPanel.lines).toContain("Availability: available");
    expect(locked.inspectionPanel.lines).toContain("Availability: locked");
    expect(locked.inspectionPanel.lines).toContain("Movement is blocked because this exit is locked.");
    expect(gated.inspectionPanel.lines).toContain("Availability: condition-gated");
    expect(gated.inspectionPanel.lines).toContain("Required condition flag: demo.maintenance-access");
  });

  it("inspects items and npcs with disabled future-action hints", () => {
    const controller = createReadonlyPrototypeController(OBSERVATION_DECK_PROTOTYPE_SCENARIO_ID);
    const itemState = controller.inspectItem("item.demo.survey-tablet");
    const npcState = controller.inspectNpc("npc.demo.analyst");

    expect(itemState.inspectionPanel.title).toBe("Prototype Survey Tablet");
    expect(itemState.inspectionPanel.lines).toContain("A portable survey tablet carried only to prove that scenario inventory can switch cleanly.");
    expect(itemState.inspectionPanel.lines).toContain("Future action hint: Take remains disabled in this prototype.");
    expect(npcState.inspectionPanel.title).toBe("Prototype Analyst");
    expect(npcState.inspectionPanel.lines).toContain("Prototype Advisory");
    expect(npcState.inspectionPanel.lines).toContain("Future action hint: Talk remains disabled in this prototype.");
  });

  it("clears inspection and keeps runtime state unchanged", () => {
    const controller = createReadonlyPrototypeController(OBSERVATION_DECK_PROTOTYPE_SCENARIO_ID);
    controller.inspectExit("exit.demo.locked-service-door");
    const before = controller.getState();
    const cleared = controller.clearInspection();

    expect(cleared.inspectionPanel.selection).toBeUndefined();
    expect(cleared.inspectionPanel.title).toBe("Inspection");
    expect(cleared.mapPanel.currentLocationId).toBe(before.mapPanel.currentLocationId);
    expect(cleared.location?.title).toBe(before.location?.title);
    expect(cleared.inventory?.items).toEqual(before.inventory?.items);
  });

  it("inspection does not expose execution results or mutate player-facing state", () => {
    const controller = createReadonlyPrototypeController(OBSERVATION_DECK_PROTOTYPE_SCENARIO_ID);
    const before = controller.getState();
    const inspected = controller.inspectNpc("npc.demo.analyst") as Record<string, unknown>;

    expect("interaction" in inspected).toBe(false);
    expect("movement" in inspected).toBe(false);
    expect(inspected.location).toEqual(before.location);
    expect(inspected.inventory).toEqual(before.inventory);
    expect(inspected.mapPanel).toEqual(before.mapPanel);
  });
});
