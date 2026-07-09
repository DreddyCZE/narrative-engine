import type {
  ListSavesResult,
  LoadGameResult,
  SaveGameInput,
  SaveGameResult,
  SaveLoadPolicyResult,
  SaveLoadServiceStorageAdapter,
  SaveSlotManifestEntry
} from "../../../packages/engine-kernel/src/index.js";
import {
  inspectListSavesResult,
  inspectLoadGameResult,
  inspectManifestSnapshotMismatch,
  inspectSaveGameResult,
  listSaves,
  loadGame,
  recordSaveSlot,
  saveGame
} from "../../../packages/engine-kernel/src/index.js";

export type PublicSaveLoadScenarioState = SaveGameInput["state"];

export type HappyPathScenarioResult = {
  readonly state: PublicSaveLoadScenarioState;
  readonly saved: SaveGameResult;
  readonly savePolicy: SaveLoadPolicyResult;
  readonly listed: ListSavesResult;
  readonly listPolicy: SaveLoadPolicyResult;
  readonly loaded: LoadGameResult;
  readonly loadPolicy: SaveLoadPolicyResult;
};

export type MissingSaveScenarioResult = {
  readonly loaded: LoadGameResult;
  readonly loadPolicy: SaveLoadPolicyResult;
};

export type EmptySaveListScenarioResult = {
  readonly listed: ListSavesResult;
  readonly listPolicy: SaveLoadPolicyResult;
};

export type ManifestMismatchScenarioResult = {
  readonly entry: SaveSlotManifestEntry;
  readonly listed: ListSavesResult;
  readonly listPolicy: SaveLoadPolicyResult;
  readonly loaded: LoadGameResult;
  readonly mismatchPolicy: SaveLoadPolicyResult;
};

export function createPublicScenarioState(revision = 8): PublicSaveLoadScenarioState {
  return {
    contractVersion: "engine-state@0.1.0",
    schemaId: "engine-state",
    schemaVersion: 1,
    stateId: "state.runtime.current",
    revision,
    run: {
      activeModules: [],
      domains: []
    }
  };
}

export function createMissingSnapshotManifestEntry(
  storageKey = "slot-orphan",
  revision = 3
): SaveSlotManifestEntry {
  return {
    storageKey,
    snapshotId: `snapshot.game-state.${storageKey}`,
    stateId: "state.runtime.current",
    revision,
    schemaId: "game-state-save",
    schemaVersion: 1,
    contentPackageId: "engine.game-state"
  };
}

export async function runHappyPathSaveLoadScenario(
  storage: SaveLoadServiceStorageAdapter,
  storageKey = "slot-a"
): Promise<HappyPathScenarioResult> {
  const state = createPublicScenarioState(8);
  const saved = await saveGame({
    storage,
    storageKey,
    state
  });
  const savePolicy = inspectSaveGameResult(saved);
  const listed = await listSaves({ storage });
  const listPolicy = inspectListSavesResult(listed);
  const loaded = await loadGame({
    storage,
    storageKey,
    stateId: state.stateId
  });
  const loadPolicy = inspectLoadGameResult(loaded);

  return {
    state,
    saved,
    savePolicy,
    listed,
    listPolicy,
    loaded,
    loadPolicy
  };
}

export async function runMissingSaveScenario(
  storage: SaveLoadServiceStorageAdapter,
  storageKey = "slot-missing"
): Promise<MissingSaveScenarioResult> {
  const loaded = await loadGame({
    storage,
    storageKey,
    stateId: "state.runtime.current"
  });

  return {
    loaded,
    loadPolicy: inspectLoadGameResult(loaded)
  };
}

export async function runEmptySaveListScenario(
  storage: SaveLoadServiceStorageAdapter
): Promise<EmptySaveListScenarioResult> {
  const listed = await listSaves({ storage });

  return {
    listed,
    listPolicy: inspectListSavesResult(listed)
  };
}

export async function runManifestMismatchScenario(
  storage: SaveLoadServiceStorageAdapter,
  entry = createMissingSnapshotManifestEntry()
): Promise<ManifestMismatchScenarioResult> {
  await recordSaveSlot({
    storage,
    entry
  });

  const listed = await listSaves({ storage });
  const listedEntry = listed.entries?.find((candidate) => candidate.storageKey === entry.storageKey) ?? entry;
  const loaded = await loadGame({
    storage,
    storageKey: listedEntry.storageKey,
    stateId: listedEntry.stateId
  });

  return {
    entry: listedEntry,
    listed,
    listPolicy: inspectListSavesResult(listed),
    loaded,
    mismatchPolicy: inspectManifestSnapshotMismatch({
      entry: listedEntry,
      loadResult: loaded
    })
  };
}
