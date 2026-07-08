import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ENGINE_STATE_CONTRACT_VERSION,
  type EngineStateSnapshot,
  type PersistenceSnapshotRecord,
  type StorageAdapterDiagnostic,
  type StorageOperationResult
} from "../packages/engine-contracts/src/index.js";
import {
  createFileStorageAdapter,
  createMemoryStorageAdapter,
  GAME_STATE_CONTENT_PACKAGE_ID,
  GAME_STATE_CONTENT_PACKAGE_VERSION,
  GAME_STATE_SAVE_SCHEMA_ID,
  GAME_STATE_SAVE_SCHEMA_VERSION,
  inspectGameStateLoadInput,
  inspectGameStateSaveInput,
  loadGameState,
  saveGameState,
  type GameStateStorageAdapter
} from "../packages/engine-kernel/src/index.js";

type GameStateSubject = {
  readonly name: string;
  create: () => Promise<GameStateStorageAdapter>;
  cleanup: () => Promise<void>;
};

function makeStateSnapshot(): EngineStateSnapshot {
  return {
    contractVersion: ENGINE_STATE_CONTRACT_VERSION,
    schemaId: "engine-state",
    schemaVersion: 1,
    stateId: "state.runtime.current",
    revision: 8,
    run: {
      activeModules: [],
      domains: []
    }
  };
}

async function createFileSubject(): Promise<GameStateSubject> {
  const rootDirectory = await mkdtemp(join(tmpdir(), "narrative-engine-game-state-file-"));
  return {
    name: "file-storage-adapter",
    create: () => Promise.resolve(createFileStorageAdapter({ rootDirectory })),
    cleanup: async () => {
      await rm(rootDirectory, { recursive: true, force: true });
    }
  };
}

function createMemorySubject(): Promise<GameStateSubject> {
  return Promise.resolve({
    name: "memory-storage-adapter",
    create: () => Promise.resolve(createMemoryStorageAdapter()),
    cleanup: async () => Promise.resolve()
  });
}

const subjects: readonly (() => Promise<GameStateSubject>)[] = [createFileSubject, createMemorySubject];

async function withSubject(createSubject: () => Promise<GameStateSubject>, run: (subject: GameStateSubject) => Promise<void>): Promise<void> {
  const subject = await createSubject();
  try {
    await run(subject);
  } finally {
    await subject.cleanup();
  }
}

describe("game state save load boundary", () => {
  for (const createSubject of subjects) {
    it(`saves and loads versioned game state through ${createSubject.name}`, async () => {
      await withSubject(createSubject, async (subject) => {
        const storage = await subject.create();
        const state = makeStateSnapshot();

        const saved = await saveGameState({
          storage,
          storageKey: "slot-a",
          state
        });
        expect(saved.status).toBe("saved");
        expect(saved.metadata.schemaId).toBe(GAME_STATE_SAVE_SCHEMA_ID);
        expect(saved.metadata.schemaVersion).toBe(GAME_STATE_SAVE_SCHEMA_VERSION);
        expect(saved.envelope?.storageKey).toBe("slot-a");
        expect(saved.snapshot?.snapshotId).toBe("snapshot.game-state.slot-a");

        const loaded = await loadGameState({
          storage,
          storageKey: "slot-a"
        });
        expect(loaded.status).toBe("loaded");
        expect(loaded.metadata.schemaId).toBe(GAME_STATE_SAVE_SCHEMA_ID);
        expect(loaded.metadata.schemaVersion).toBe(GAME_STATE_SAVE_SCHEMA_VERSION);
        expect(loaded.state).toEqual(state);

        const persisted = await storage.loadSnapshot({
          adapterKind: storage.kind,
          snapshotId: "snapshot.game-state.slot-a"
        });
        expect(persisted.status).toBe("completed");
        expect(persisted.snapshot?.contentPackageId).toBe(GAME_STATE_CONTENT_PACKAGE_ID);
        expect(persisted.snapshot?.metadata.contentPackageVersion).toBe(GAME_STATE_CONTENT_PACKAGE_VERSION);
      });
    });

    it(`returns blocked diagnostics for missing game state through ${createSubject.name}`, async () => {
      await withSubject(createSubject, async (subject) => {
        const storage = await subject.create();

        const result = await loadGameState({
          storage,
          storageKey: "slot-a"
        });

        expect(result.status).toBe("blocked");
        expect(result.diagnostics).not.toHaveLength(0);
      });
    });
  }

  it("rejects invalid save input and invalid load input deterministically", async () => {
    const storage = createMemoryStorageAdapter();
    const invalidState = {
      ...makeStateSnapshot(),
      stateId: "bad"
    } as EngineStateSnapshot;

    const inspectedSave = inspectGameStateSaveInput({
      storage,
      storageKey: "Bad-Key",
      state: invalidState
    });
    const inspectedLoad = inspectGameStateLoadInput({
      storage,
      storageKey: "Bad-Key"
    });

    expect(inspectedSave.map((diagnostic) => diagnostic.code)).toContain("GAME_STATE_STORAGE_KEY_INVALID");
    expect(inspectedSave.map((diagnostic) => diagnostic.code)).toContain("GAME_STATE_STATE_INVALID");
    expect(inspectedLoad.map((diagnostic) => diagnostic.code)).toContain("GAME_STATE_STORAGE_KEY_INVALID");

    const saved = await saveGameState({
      storage,
      storageKey: "Bad-Key",
      state: invalidState
    });
    const loaded = await loadGameState({
      storage,
      storageKey: "Bad-Key"
    });

    expect(saved.status).toBe("rejected");
    expect(loaded.status).toBe("rejected");
  });

  it("uses only saveSnapshot and loadSnapshot on the public storage adapter boundary", async () => {
    const state = makeStateSnapshot();
    const savedSnapshots: PersistenceSnapshotRecord[] = [];
    const callLog: string[] = [];

    const adapter: GameStateStorageAdapter = {
      kind: "memory",
      deterministic: true,
      persistent: false,
      schemaVersion: 1,
      async saveSnapshot(input) {
        await Promise.resolve();
        callLog.push("saveSnapshot");
        savedSnapshots.push(JSON.parse(JSON.stringify(input.snapshot)) as PersistenceSnapshotRecord);
        return {
          status: "completed",
          diagnostics: [],
          metadata: {
            deterministic: true,
            adapterKind: "memory",
            operation: "save-snapshot",
            persistent: false,
            schemaVersion: 1,
            supportsIdempotency: true,
            snapshotId: input.snapshot.snapshotId
          },
          snapshot: JSON.parse(JSON.stringify(input.snapshot)) as PersistenceSnapshotRecord
        } satisfies StorageOperationResult;
      },
      async loadSnapshot(input) {
        await Promise.resolve();
        callLog.push("loadSnapshot");
        const snapshot = savedSnapshots.find((entry) => entry.snapshotId === input.snapshotId);
        if (snapshot === undefined) {
          return {
            status: "blocked",
            diagnostics: [
              {
                code: "MEMORY_STORAGE_SNAPSHOT_MISSING",
                path: ["snapshotId"],
                message: "missing snapshot"
              } satisfies StorageAdapterDiagnostic
            ],
            metadata: {
              deterministic: true,
              adapterKind: "memory",
              operation: "load-snapshot",
              persistent: false,
              schemaVersion: 1,
              snapshotId: input.snapshotId
            }
          } satisfies StorageOperationResult;
        }
        return {
          status: "completed",
          diagnostics: [],
          metadata: {
            deterministic: true,
            adapterKind: "memory",
            operation: "load-snapshot",
            persistent: false,
            schemaVersion: 1,
            snapshotId: input.snapshotId
          },
          snapshot: JSON.parse(JSON.stringify(snapshot)) as PersistenceSnapshotRecord
        } satisfies StorageOperationResult;
      }
    };

    const saved = await saveGameState({
      storage: adapter,
      storageKey: "slot-a",
      state
    });
    const loaded = await loadGameState({
      storage: adapter,
      storageKey: "slot-a"
    });

    expect(saved.status).toBe("saved");
    expect(loaded.status).toBe("loaded");
    expect(callLog).toEqual(["saveSnapshot", "loadSnapshot"]);
  });
});
