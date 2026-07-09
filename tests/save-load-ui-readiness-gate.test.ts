import { describe, expect, it } from "vitest";

import {
  createMemoryStorageAdapter,
  inspectListSavesResult,
  inspectLoadGameResult,
  inspectManifestSnapshotMismatch,
  inspectSaveGameResult,
  listSaves,
  loadGame,
  saveGame,
  type SaveLoadRecoveryAction,
  type SaveLoadServiceStorageAdapter
} from "../packages/engine-kernel/src/index.js";
import {
  createMissingSnapshotManifestEntry,
  createPublicScenarioState,
  runEmptySaveListScenario,
  runHappyPathSaveLoadScenario,
  runManifestMismatchScenario,
  runMissingSaveScenario
} from "./fixtures/save-load/public-save-load-scenario.js";

const expectedRecoveryActions: readonly SaveLoadRecoveryAction[] = [
  "none",
  "retry",
  "choose-different-slot",
  "rebuild-manifest",
  "discard-corrupt-entry",
  "report-error"
];

function createListErrorAdapter(): SaveLoadServiceStorageAdapter {
  const storage = createMemoryStorageAdapter();

  return {
    ...storage,
    readEventRecords: async () => {
      await Promise.resolve();
      return {
        status: "error",
        diagnostics: [
          {
            code: "MEMORY_STORAGE_READ_FAILED",
            path: ["storage"],
            message: "MEMORY_STORAGE_READ_FAILED triggered for UI readiness gate coverage."
          }
        ],
        metadata: {
          deterministic: true,
          adapterKind: "memory",
          operation: "read-events",
          persistent: false,
          schemaVersion: storage.schemaVersion
        }
      };
    }
  };
}

describe("save load UI readiness gate", () => {
  it("uses the public scenario fixture happy path as a future UI reference flow", async () => {
    const storage = createMemoryStorageAdapter();
    const scenario = await runHappyPathSaveLoadScenario(storage, "slot-a");

    expect(scenario.saved.status).toBe("saved");
    expect(scenario.savePolicy.recommendedAction).toBe("none");
    expect(scenario.listed.status).toBe("loaded");
    expect(scenario.listPolicy.recommendedAction).toBe("none");
    expect(scenario.loaded.status).toBe("loaded");
    expect(scenario.loadPolicy.recommendedAction).toBe("none");
    expect(scenario.loaded.state).toEqual(scenario.state);
  });

  it("exposes stable save, list, and load statuses through the public facade", async () => {
    const storage = createMemoryStorageAdapter();
    const state = createPublicScenarioState(12);

    const saved = await saveGame({
      storage,
      storageKey: "slot-stable",
      state
    });
    const listed = await listSaves({ storage });
    const loaded = await loadGame({
      storage,
      storageKey: "slot-stable",
      stateId: state.stateId
    });

    expect(saved.status).toBe("saved");
    expect(listed.status).toBe("loaded");
    expect(loaded.status).toBe("loaded");
    expect(inspectSaveGameResult(saved).recommendedAction).toBe("none");
    expect(inspectListSavesResult(listed).recommendedAction).toBe("none");
    expect(inspectLoadGameResult(loaded).recommendedAction).toBe("none");
  });

  it("returns stable recovery actions for happy path, empty list, missing save, and manifest mismatch", async () => {
    const happyPath = await runHappyPathSaveLoadScenario(createMemoryStorageAdapter(), "slot-a");
    const emptyList = await runEmptySaveListScenario(createMemoryStorageAdapter());
    const missingSave = await runMissingSaveScenario(createMemoryStorageAdapter(), "slot-missing");
    const manifestMismatch = await runManifestMismatchScenario(createMemoryStorageAdapter(), createMissingSnapshotManifestEntry("slot-orphan", 4));

    expect(happyPath.savePolicy.recommendedAction).toBe("none");
    expect(happyPath.listPolicy.recommendedAction).toBe("none");
    expect(happyPath.loadPolicy.recommendedAction).toBe("none");

    expect(emptyList.listPolicy).toEqual({
      status: "ok",
      deterministic: true,
      recommendedAction: "none",
      issues: []
    });

    expect(missingSave.loadPolicy.recommendedAction).toBe("choose-different-slot");
    expect(missingSave.loadPolicy.issues[0]?.code).toBe("LOAD_GAME_SNAPSHOT_MISSING");

    expect(manifestMismatch.mismatchPolicy.recommendedAction).toBe("rebuild-manifest");
    expect(manifestMismatch.mismatchPolicy.issues[0]?.code).toBe("SAVE_SLOT_MANIFEST_SNAPSHOT_MISMATCH");
  });

  it("keeps the public recovery action set within the expected UI-facing values", async () => {
    const storage = createMemoryStorageAdapter();
    const invalidState = {
      ...createPublicScenarioState(9),
      stateId: "invalid"
    };
    const adapterErrorStorage = createListErrorAdapter();
    const missingSave = await runMissingSaveScenario(createMemoryStorageAdapter(), "slot-missing");
    const manifestMismatch = await runManifestMismatchScenario(createMemoryStorageAdapter());
    const emptyList = await runEmptySaveListScenario(createMemoryStorageAdapter());
    const invalidSave = await saveGame({
      storage,
      storageKey: "Bad-Key",
      state: invalidState
    });
    const adapterErrorList = await listSaves({ storage: adapterErrorStorage });

    const observedActions = new Set<SaveLoadRecoveryAction>([
      inspectSaveGameResult(invalidSave).recommendedAction,
      emptyList.listPolicy.recommendedAction,
      missingSave.loadPolicy.recommendedAction,
      manifestMismatch.mismatchPolicy.recommendedAction,
      inspectListSavesResult(adapterErrorList).recommendedAction
    ]);

    expect(expectedRecoveryActions).toEqual([
      "none",
      "retry",
      "choose-different-slot",
      "rebuild-manifest",
      "discard-corrupt-entry",
      "report-error"
    ]);
    expect([...observedActions].every((action) => expectedRecoveryActions.includes(action))).toBe(true);
  });

  it("treats diagnostics policy as the recovery source for manifest mismatch and missing save handling", async () => {
    const missingLoad = await runMissingSaveScenario(createMemoryStorageAdapter(), "slot-missing");
    const mismatchStorage = createMemoryStorageAdapter();
    const mismatchEntry = createMissingSnapshotManifestEntry("slot-orphan", 5);
    const mismatchScenario = await runManifestMismatchScenario(mismatchStorage, mismatchEntry);

    expect(missingLoad.loaded.status).toBe("blocked");
    expect(missingLoad.loadPolicy.status).toBe("issue");

    expect(mismatchScenario.loaded.status).toBe("blocked");
    expect(
      inspectManifestSnapshotMismatch({
        entry: mismatchScenario.entry,
        loadResult: mismatchScenario.loaded
      }).recommendedAction
    ).toBe("rebuild-manifest");
  });
});
