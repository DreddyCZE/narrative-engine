import type { EngineStateSnapshot, StorageAdapterDiagnostic } from "@narrative-engine/engine-contracts";

import {
  loadGameState,
  saveGameState,
  type GameStateLoadResult,
  type GameStateSaveResult,
  type GameStateStorageAdapter,
  type GameStateStorageKey
} from "./game-state-save-load.js";
import {
  listSaveSlots,
  recordSaveSlot,
  type LoadSaveSlotManifestResult,
  type RecordSaveSlotResult,
  type SaveSlotManifestEntry,
  type SaveSlotManifestStorageAdapter
} from "./save-slot-manifest.js";

export type SaveLoadServiceStorageAdapter = GameStateStorageAdapter & SaveSlotManifestStorageAdapter;

export type SaveGameInput = {
  readonly storage: SaveLoadServiceStorageAdapter;
  readonly storageKey: GameStateStorageKey;
  readonly state: EngineStateSnapshot;
};

export type LoadGameInput = {
  readonly storage: SaveLoadServiceStorageAdapter;
  readonly storageKey: GameStateStorageKey;
  readonly stateId?: string;
};

export type ListSavesInput = {
  readonly storage: SaveLoadServiceStorageAdapter;
};

export type SaveGameResult = {
  readonly status: "saved" | "rejected" | "error";
  readonly diagnostics: readonly StorageAdapterDiagnostic[];
  readonly metadata: {
    readonly deterministic: true;
    readonly adapterKind: SaveLoadServiceStorageAdapter["kind"];
    readonly persistent: boolean;
    readonly storageKey: GameStateStorageKey;
  };
  readonly saveResult: GameStateSaveResult;
  readonly manifestResult?: RecordSaveSlotResult;
  readonly entry?: SaveSlotManifestEntry;
};

export type LoadGameResult = {
  readonly status: GameStateLoadResult["status"];
  readonly diagnostics: readonly StorageAdapterDiagnostic[];
  readonly metadata: {
    readonly deterministic: true;
    readonly adapterKind: SaveLoadServiceStorageAdapter["kind"];
    readonly persistent: boolean;
    readonly storageKey: GameStateStorageKey;
  };
  readonly loadResult: GameStateLoadResult;
  readonly state?: EngineStateSnapshot;
};

export type ListSavesResult = {
  readonly status: LoadSaveSlotManifestResult["status"];
  readonly diagnostics: readonly StorageAdapterDiagnostic[];
  readonly metadata: {
    readonly deterministic: true;
    readonly adapterKind: SaveLoadServiceStorageAdapter["kind"];
    readonly persistent: boolean;
  };
  readonly manifestResult: LoadSaveSlotManifestResult;
  readonly entries?: readonly SaveSlotManifestEntry[];
};

function createSaveMetadata(storage: SaveLoadServiceStorageAdapter, storageKey: GameStateStorageKey) {
  return {
    deterministic: true as const,
    adapterKind: storage.kind,
    persistent: storage.persistent,
    storageKey
  };
}

function createListMetadata(storage: SaveLoadServiceStorageAdapter) {
  return {
    deterministic: true as const,
    adapterKind: storage.kind,
    persistent: storage.persistent
  };
}

function createManifestEntry(saveResult: GameStateSaveResult): SaveSlotManifestEntry | undefined {
  if (saveResult.snapshot === undefined) {
    return undefined;
  }

  return {
    storageKey: saveResult.metadata.storageKey,
    snapshotId: saveResult.metadata.snapshotId,
    stateId: saveResult.snapshot.stateId,
    revision: saveResult.snapshot.revision,
    schemaId: saveResult.metadata.schemaId,
    schemaVersion: saveResult.metadata.schemaVersion,
    contentPackageId: saveResult.snapshot.contentPackageId
  };
}

export async function saveGame(input: SaveGameInput): Promise<SaveGameResult> {
  const saveResult = await saveGameState(input);
  const metadata = createSaveMetadata(input.storage, input.storageKey);

  if (saveResult.status !== "saved") {
    return {
      status: saveResult.status,
      diagnostics: saveResult.diagnostics,
      metadata,
      saveResult
    };
  }

  const entry = createManifestEntry(saveResult);
  if (entry === undefined) {
    return {
      status: "error",
      diagnostics: [
        {
          code: "SAVE_LOAD_SERVICE_ENTRY_INVALID",
          path: ["saveResult", "snapshot"],
          message: "saveGameState did not return a snapshot for manifest recording."
        }
      ],
      metadata,
      saveResult
    };
  }

  const manifestResult = await recordSaveSlot({
    storage: input.storage,
    entry
  });

  if (manifestResult.status !== "recorded") {
    return {
      status: manifestResult.status === "rejected" ? "rejected" : "error",
      diagnostics: manifestResult.diagnostics,
      metadata,
      saveResult,
      manifestResult,
      entry
    };
  }

  return {
    status: "saved",
    diagnostics: [...saveResult.diagnostics, ...manifestResult.diagnostics],
    metadata,
    saveResult,
    manifestResult,
    entry
  };
}

export async function loadGame(input: LoadGameInput): Promise<LoadGameResult> {
  const loadResult = await loadGameState(input);

  return {
    status: loadResult.status,
    diagnostics: loadResult.diagnostics,
    metadata: createSaveMetadata(input.storage, input.storageKey),
    loadResult,
    ...(loadResult.state === undefined ? {} : { state: loadResult.state })
  };
}

export async function listSaves(input: ListSavesInput): Promise<ListSavesResult> {
  const manifestResult = await listSaveSlots({
    storage: input.storage
  });

  return {
    status: manifestResult.status,
    diagnostics: manifestResult.diagnostics,
    metadata: createListMetadata(input.storage),
    manifestResult,
    ...(manifestResult.manifest === undefined ? {} : { entries: manifestResult.manifest.entries })
  };
}
