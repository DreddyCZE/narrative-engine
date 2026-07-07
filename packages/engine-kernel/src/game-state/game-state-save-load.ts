import {
  inspectEngineStateSnapshot,
  isStorageAdapterKind,
  type EngineStateSnapshot,
  type PersistenceSnapshotRecord,
  type StorageAdapterContract,
  type StorageAdapterDiagnostic,
  type StorageLoadSnapshotInput,
  type StorageOperationResult,
  type StorageSaveSnapshotInput
} from "@narrative-engine/engine-contracts";

export const GAME_STATE_SAVE_SCHEMA_ID = "game-state-save" as const;
export const GAME_STATE_SAVE_SCHEMA_VERSION = 1 as const;
export const GAME_STATE_STORAGE_RUNTIME_VERSION = "game-state-boundary@1.0.0" as const;
export const GAME_STATE_CONTENT_PACKAGE_ID = "engine.game-state" as const;
export const GAME_STATE_CONTENT_PACKAGE_VERSION = "game-state-save@1" as const;

export type GameStateStorageKey = string;

export type GameStateStorageAdapter = Pick<
  StorageAdapterContract,
  "kind" | "deterministic" | "persistent" | "schemaVersion"
> & {
  saveSnapshot: (input: StorageSaveSnapshotInput) => Promise<StorageOperationResult>;
  loadSnapshot: (input: StorageLoadSnapshotInput) => Promise<StorageOperationResult>;
};

export type GameStateEnvelope = {
  readonly schemaId: typeof GAME_STATE_SAVE_SCHEMA_ID;
  readonly schemaVersion: typeof GAME_STATE_SAVE_SCHEMA_VERSION;
  readonly storageKey: GameStateStorageKey;
  readonly state: EngineStateSnapshot;
  readonly metadata: {
    readonly deterministic: true;
    readonly runtimeVersion: typeof GAME_STATE_STORAGE_RUNTIME_VERSION;
  };
};

export type GameStateSaveInput = {
  readonly storage: GameStateStorageAdapter;
  readonly storageKey: GameStateStorageKey;
  readonly state: EngineStateSnapshot;
};

export type GameStateLoadInput = {
  readonly storage: GameStateStorageAdapter;
  readonly storageKey: GameStateStorageKey;
  readonly stateId?: string;
};

export type GameStateSaveResult = {
  readonly status: "saved" | "rejected" | "error";
  readonly diagnostics: readonly StorageAdapterDiagnostic[];
  readonly metadata: {
    readonly deterministic: true;
    readonly adapterKind: GameStateStorageAdapter["kind"];
    readonly persistent: boolean;
    readonly storageKey: GameStateStorageKey;
    readonly snapshotId: string;
    readonly schemaId: typeof GAME_STATE_SAVE_SCHEMA_ID;
    readonly schemaVersion: typeof GAME_STATE_SAVE_SCHEMA_VERSION;
  };
  readonly envelope?: GameStateEnvelope;
  readonly snapshot?: PersistenceSnapshotRecord;
  readonly storageResult?: StorageOperationResult;
};

export type GameStateLoadResult = {
  readonly status: "loaded" | "blocked" | "rejected" | "error";
  readonly diagnostics: readonly StorageAdapterDiagnostic[];
  readonly metadata: {
    readonly deterministic: true;
    readonly adapterKind: GameStateStorageAdapter["kind"];
    readonly persistent: boolean;
    readonly storageKey: GameStateStorageKey;
    readonly snapshotId: string;
    readonly schemaId: typeof GAME_STATE_SAVE_SCHEMA_ID;
    readonly schemaVersion: typeof GAME_STATE_SAVE_SCHEMA_VERSION;
  };
  readonly envelope?: GameStateEnvelope;
  readonly state?: EngineStateSnapshot;
  readonly snapshot?: PersistenceSnapshotRecord;
  readonly storageResult?: StorageOperationResult;
};

const GAME_STATE_STORAGE_KEY_PATTERN = /^[a-z][a-z0-9-]{1,63}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createDiagnostic(
  code: string,
  path: readonly (string | number)[],
  message: string
): StorageAdapterDiagnostic {
  return {
    code,
    path: [...path],
    message
  };
}

function isGameStateStorageAdapter(value: unknown): value is GameStateStorageAdapter {
  return (
    isRecord(value) &&
    value.deterministic === true &&
    typeof value.persistent === "boolean" &&
    typeof value.schemaVersion === "number" &&
    isStorageAdapterKind(value.kind) &&
    typeof value.saveSnapshot === "function" &&
    typeof value.loadSnapshot === "function"
  );
}

function isGameStateStorageKey(value: unknown): value is GameStateStorageKey {
  return typeof value === "string" && GAME_STATE_STORAGE_KEY_PATTERN.test(value);
}

function toSnapshotId(storageKey: GameStateStorageKey): string {
  return `snapshot.game-state.${storageKey}`;
}

function createEnvelope(storageKey: GameStateStorageKey, state: EngineStateSnapshot): GameStateEnvelope {
  return {
    schemaId: GAME_STATE_SAVE_SCHEMA_ID,
    schemaVersion: GAME_STATE_SAVE_SCHEMA_VERSION,
    storageKey,
    state: cloneValue(state),
    metadata: {
      deterministic: true,
      runtimeVersion: GAME_STATE_STORAGE_RUNTIME_VERSION
    }
  };
}

function createSnapshotRecord(
  storage: GameStateStorageAdapter,
  storageKey: GameStateStorageKey,
  state: EngineStateSnapshot
): PersistenceSnapshotRecord {
  return {
    snapshotId: toSnapshotId(storageKey),
    stateId: state.stateId,
    revision: state.revision,
    contentPackageId: GAME_STATE_CONTENT_PACKAGE_ID,
    checksum: `game-state-save:${storageKey}:v${String(GAME_STATE_SAVE_SCHEMA_VERSION)}:r${String(state.revision)}`,
    state: cloneValue(state),
    metadata: {
      deterministic: true,
      persistence: storage.kind === "memory" ? "memory" : "future-storage",
      source: "save-snapshot-store",
      runtimeVersion: GAME_STATE_STORAGE_RUNTIME_VERSION,
      contentPackageVersion: GAME_STATE_CONTENT_PACKAGE_VERSION
    }
  };
}

function createSaveMetadata(
  adapterKind: StorageAdapterContract["kind"],
  persistent: boolean,
  storageKey: GameStateStorageKey
) {
  return {
    deterministic: true as const,
    adapterKind,
    persistent,
    storageKey,
    snapshotId: toSnapshotId(storageKey),
    schemaId: GAME_STATE_SAVE_SCHEMA_ID,
    schemaVersion: GAME_STATE_SAVE_SCHEMA_VERSION
  };
}

function createLoadMetadata(
  adapterKind: StorageAdapterContract["kind"],
  persistent: boolean,
  storageKey: GameStateStorageKey
) {
  return {
    deterministic: true as const,
    adapterKind,
    persistent,
    storageKey,
    snapshotId: toSnapshotId(storageKey),
    schemaId: GAME_STATE_SAVE_SCHEMA_ID,
    schemaVersion: GAME_STATE_SAVE_SCHEMA_VERSION
  };
}

export function inspectGameStateSaveInput(value: unknown): readonly StorageAdapterDiagnostic[] {
  const diagnostics: StorageAdapterDiagnostic[] = [];
  if (!isRecord(value)) {
    diagnostics.push(createDiagnostic("GAME_STATE_SAVE_INPUT_INVALID", [], "game state save input must be an object."));
    return diagnostics;
  }
  if (!isGameStateStorageAdapter(value.storage)) {
    diagnostics.push(createDiagnostic("GAME_STATE_STORAGE_ADAPTER_INVALID", ["storage"], "storage adapter is invalid."));
  }
  if (!isGameStateStorageKey(value.storageKey)) {
    diagnostics.push(createDiagnostic("GAME_STATE_STORAGE_KEY_INVALID", ["storageKey"], "storageKey is invalid."));
  }
  diagnostics.push(
    ...inspectEngineStateSnapshot(value.state).map((issue) =>
      createDiagnostic("GAME_STATE_STATE_INVALID", ["state", ...issue.path], issue.message)
    )
  );
  return diagnostics;
}

export function inspectGameStateLoadInput(value: unknown): readonly StorageAdapterDiagnostic[] {
  const diagnostics: StorageAdapterDiagnostic[] = [];
  if (!isRecord(value)) {
    diagnostics.push(createDiagnostic("GAME_STATE_LOAD_INPUT_INVALID", [], "game state load input must be an object."));
    return diagnostics;
  }
  if (!isGameStateStorageAdapter(value.storage)) {
    diagnostics.push(createDiagnostic("GAME_STATE_STORAGE_ADAPTER_INVALID", ["storage"], "storage adapter is invalid."));
  }
  if (!isGameStateStorageKey(value.storageKey)) {
    diagnostics.push(createDiagnostic("GAME_STATE_STORAGE_KEY_INVALID", ["storageKey"], "storageKey is invalid."));
  }
  if (value.stateId !== undefined && typeof value.stateId !== "string") {
    diagnostics.push(createDiagnostic("GAME_STATE_LOAD_INPUT_INVALID", ["stateId"], "stateId must be a string when present."));
  }
  return diagnostics;
}

export async function saveGameState(input: GameStateSaveInput): Promise<GameStateSaveResult> {
  const diagnostics = inspectGameStateSaveInput(input);
  const storageKey = isGameStateStorageKey(input.storageKey) ? input.storageKey : "invalid-storage-key";
  const metadata = createSaveMetadata(
    isGameStateStorageAdapter(input.storage) ? input.storage.kind : "memory",
    isGameStateStorageAdapter(input.storage) ? input.storage.persistent : false,
    storageKey
  );
  if (diagnostics.length > 0) {
    return {
      status: "rejected",
      diagnostics,
      metadata
    };
  }

  const snapshot = createSnapshotRecord(input.storage, input.storageKey, input.state);
  const storageResult = await input.storage.saveSnapshot({
    adapterKind: input.storage.kind,
    expectedSchemaVersion: input.storage.schemaVersion,
    snapshot
  });

  if (storageResult.status === "completed") {
    return {
      status: "saved",
      diagnostics: storageResult.diagnostics,
      metadata,
      envelope: createEnvelope(input.storageKey, input.state),
      snapshot: cloneValue(snapshot),
      storageResult
    };
  }

  return {
    status: storageResult.status === "rejected" ? "rejected" : "error",
    diagnostics: storageResult.diagnostics,
    metadata,
    snapshot: cloneValue(snapshot),
    storageResult
  };
}

export async function loadGameState(input: GameStateLoadInput): Promise<GameStateLoadResult> {
  const diagnostics = inspectGameStateLoadInput(input);
  const storageKey = isGameStateStorageKey(input.storageKey) ? input.storageKey : "invalid-storage-key";
  const metadata = createLoadMetadata(
    isGameStateStorageAdapter(input.storage) ? input.storage.kind : "memory",
    isGameStateStorageAdapter(input.storage) ? input.storage.persistent : false,
    storageKey
  );
  if (diagnostics.length > 0) {
    return {
      status: "rejected",
      diagnostics,
      metadata
    };
  }

  const storageResult = await input.storage.loadSnapshot({
    adapterKind: input.storage.kind,
    snapshotId: toSnapshotId(input.storageKey),
    ...(input.stateId === undefined ? {} : { stateId: input.stateId })
  });

  if (storageResult.status === "blocked") {
    return {
      status: "blocked",
      diagnostics: storageResult.diagnostics,
      metadata,
      storageResult
    };
  }
  if (storageResult.status === "rejected") {
    return {
      status: "rejected",
      diagnostics: storageResult.diagnostics,
      metadata,
      storageResult
    };
  }
  if (storageResult.status === "error") {
    return {
      status: "error",
      diagnostics: storageResult.diagnostics,
      metadata,
      storageResult
    };
  }

  const snapshot = storageResult.snapshot;
  if (snapshot === undefined) {
    return {
      status: "error",
      diagnostics: [createDiagnostic("GAME_STATE_LOAD_RESULT_INVALID", ["snapshot"], "storage adapter did not return a snapshot.")],
      metadata,
      storageResult
    };
  }
  if (snapshot.contentPackageId !== GAME_STATE_CONTENT_PACKAGE_ID || snapshot.metadata.contentPackageVersion !== GAME_STATE_CONTENT_PACKAGE_VERSION) {
    return {
      status: "error",
      diagnostics: [
        createDiagnostic(
          "GAME_STATE_SCHEMA_MISMATCH",
          ["snapshot", "metadata", "contentPackageVersion"],
          "stored snapshot does not match the game state save boundary schema."
        )
      ],
      metadata,
      snapshot: cloneValue(snapshot),
      storageResult
    };
  }

  return {
    status: "loaded",
    diagnostics: storageResult.diagnostics,
    metadata,
    envelope: createEnvelope(input.storageKey, snapshot.state),
    state: cloneValue(snapshot.state),
    snapshot: cloneValue(snapshot),
    storageResult
  };
}

