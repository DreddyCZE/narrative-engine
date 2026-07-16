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

describe("readonly browser prototype data-driven scenario selector", () => {
  it("contains at least two stable unique scenarios in the registry", () => {
    const ids = PROTOTYPE_SCENARIOS.map((scenario) => scenario.scenarioId);

    expect(ids.length).toBeGreaterThanOrEqual(2);
    expect(ids).toContain(SMOKE_PROTOTYPE_SCENARIO_ID);
    expect(ids).toContain(OBSERVATION_DECK_PROTOTYPE_SCENARIO_ID);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("starts on the smoke scenario", () => {
    const state = createReadonlyPrototypeState();
    const currentTile = state.mapPanel.tiles.find((tile) => tile.locationId === state.mapPanel.currentLocationId);

    expect(DEFAULT_PROTOTYPE_SCENARIO_ID).toBe(SMOKE_PROTOTYPE_SCENARIO_ID);
    expect(state.selectedScenarioId).toBe(SMOKE_PROTOTYPE_SCENARIO_ID);
    expect(state.location?.title).toBe("Smoke Test Airlock");
    expect(state.inventory?.items.map((item) => item.title)).toEqual(["Smoke Test Keycard"]);
    expect(currentTile?.label).toBe("Smoke Test Airlock");
    expectJsonSafe(state);
  });

  it("switches to the second scenario and rebuilds location, inventory, map, and diagnostics", () => {
    const controller = createReadonlyPrototypeController();
    const smokeState = controller.getState();

    const nextState = controller.selectScenario(OBSERVATION_DECK_PROTOTYPE_SCENARIO_ID);

    expect(nextState.selectedScenarioId).toBe(OBSERVATION_DECK_PROTOTYPE_SCENARIO_ID);
    expect(nextState.location?.title).not.toBe("Smoke Test Airlock");
    expect(nextState.location?.title).toBe("Prototype Observation Deck");
    expect(nextState.inventory?.items.map((item) => item.title)).not.toEqual(["Smoke Test Keycard"]);
    expect(nextState.inventory?.items.map((item) => item.title)).toContain("Prototype Survey Tablet");
    expect(nextState.mapPanel.currentLocationId).not.toBe(smokeState.mapPanel.currentLocationId);
    expect(nextState.diagnostics).toEqual([]);
    expectJsonSafe(nextState);
  });

  it("routes look through the readonly interaction boundary for both scenarios without mutating player state", () => {
    for (const scenario of PROTOTYPE_SCENARIOS) {
      const controller = createReadonlyPrototypeController(scenario.scenarioId);
      const beforeState = controller.getState();
      const outcome = controller.runAction("look");
      const afterState = controller.getState();
      const snapshots = assertStateSnapshots(outcome);

      expect(outcome.status).toBe("executed");
      expect(outcome.interaction?.status).toBe("executed");
      expect(outcome.interaction?.execution?.view?.kind).toBe("look");
      expect(afterState.mapPanel.currentLocationId).toBe(beforeState.mapPanel.currentLocationId);
      expect(canonicalizeJson(snapshots.before)).toBe(canonicalizeJson(snapshots.after));
      expect(outcome.playerStateUnchanged).toBe(true);
      expectJsonSafe(outcome);
    }
  });

  it("routes inventory through the readonly interaction boundary for both scenarios without mutating player state", () => {
    for (const scenario of PROTOTYPE_SCENARIOS) {
      const controller = createReadonlyPrototypeController(scenario.scenarioId);
      const outcome = controller.runAction("inventory");
      const snapshots = assertStateSnapshots(outcome);

      expect(outcome.status).toBe("executed");
      expect(outcome.interaction?.status).toBe("executed");
      expect(outcome.interaction?.execution?.view?.kind).toBe("inventory");
      expect(canonicalizeJson(snapshots.before)).toBe(canonicalizeJson(snapshots.after));
      expect(outcome.playerStateUnchanged).toBe(true);
      expectJsonSafe(outcome);
    }
  });

  it("keeps disabled go local in both scenarios", () => {
    for (const scenario of PROTOTYPE_SCENARIOS) {
      const controller = createReadonlyPrototypeController(scenario.scenarioId);
      const beforeState = controller.getState();
      const outcome = controller.runAction("go");
      const afterState = controller.getState();
      const snapshots = assertStateSnapshots(outcome);

      expect(outcome.status).toBe("disabled");
      expect(outcome.interaction).toBeUndefined();
      expect(outcome.disabledReason).toBe("Movement execution is not implemented yet.");
      expect(afterState.mapPanel.currentLocationId).toBe(beforeState.mapPanel.currentLocationId);
      expect(canonicalizeJson(snapshots.before)).toBe(canonicalizeJson(snapshots.after));
      expect(outcome.playerStateUnchanged).toBe(true);
      expectJsonSafe(outcome);
    }
  });

  it("resets output when switching scenarios", () => {
    const controller = createReadonlyPrototypeController();

    controller.runAction("inventory");
    const inventoryState = controller.getState();
    expect(inventoryState.output.kind).toBe("inventory");
    expect(inventoryState.output.lines).toContain("Smoke Test Keycard");

    const nextState = controller.selectScenario(OBSERVATION_DECK_PROTOTYPE_SCENARIO_ID);

    expect(nextState.output.kind).toBe("transcript-preview");
    expect(nextState.output.title).toBe("Transcript Preview");
    expect(nextState.output.lines.some((line) => line.includes("Smoke Test Keycard"))).toBe(false);
    expect(nextState.output.lines.some((line) => line.includes("Prototype Survey Tablet"))).toBe(true);
  });

  it("keeps engine contracts free of map and final-game exports", () => {
    expect("RuntimeMap" in engineContracts).toBe(false);
    expect("MapTile" in engineContracts).toBe(false);
    expect("MapRenderer" in engineContracts).toBe(false);
    expect("MapEditor" in engineContracts).toBe(false);
    expect("P0ContentPackage" in engineContracts).toBe(false);
    expect("moveTo" in engineContracts).toBe(false);
  });

  it("returns JSON-safe deterministic state and outcomes for the same selected scenario", () => {
    const firstSmoke = createReadonlyPrototypeState();
    const secondSmoke = createReadonlyPrototypeState();
    expect(canonicalizeJson(firstSmoke)).toBe(canonicalizeJson(secondSmoke));

    const firstController = createReadonlyPrototypeController();
    const secondController = createReadonlyPrototypeController();
    const firstSelected = firstController.selectScenario(OBSERVATION_DECK_PROTOTYPE_SCENARIO_ID);
    const secondSelected = secondController.selectScenario(OBSERVATION_DECK_PROTOTYPE_SCENARIO_ID);
    const firstOutcome = firstController.runAction("go");
    const secondOutcome = secondController.runAction("go");

    expect(canonicalizeJson(firstSelected)).toBe(canonicalizeJson(secondSelected));
    expect(canonicalizeJson(firstOutcome)).toBe(canonicalizeJson(secondOutcome));
    expect("nextState" in firstOutcome).toBe(false);
    expect("statePatch" in firstOutcome).toBe(false);
    expect("events" in firstOutcome).toBe(false);
    expect("runtimeDomainEventValues" in firstOutcome).toBe(false);
    expect("transaction" in firstOutcome).toBe(false);
    expect("saveResult" in firstOutcome).toBe(false);
    expect("loadResult" in firstOutcome).toBe(false);
    expectJsonSafe(firstSelected);
    expectJsonSafe(firstOutcome);
  });

  it("keeps the accepted command palette unchanged", () => {
    const state = createReadonlyPrototypeState();
    const palette = state.commandPalette;

    expect(PROTOTYPE_COMMAND_IDS).toEqual([
      "look",
      "inventory",
      "go",
      "talk",
      "take",
      "use",
      "save",
      "load"
    ]);
    expect(EXECUTABLE_PROTOTYPE_ACTIONS).toEqual(["look", "inventory"]);
    expect(DISABLED_PROTOTYPE_ACTIONS).toEqual(["go", "talk", "take", "use", "save", "load"]);
    expect(palette.find((item) => item.commandId === "look")?.enabled).toBe(true);
    expect(palette.find((item) => item.commandId === "inventory")?.enabled).toBe(true);
    expect(palette.find((item) => item.commandId === "go")?.enabled).toBe(false);
  });
});
