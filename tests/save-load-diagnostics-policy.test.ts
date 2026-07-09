import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ENGINE_STATE_CONTRACT_VERSION,
  type EngineStateSnapshot,
  type StorageAdapterDiagnostic,
  type StorageOperationResult
} from "../packages/engine-contracts/src/index.js";
import {
  createFileStorageAdapter,
  createMemoryStorageAdapter,
  inspectListSavesResult,
  inspectLoadGameResult,
  inspectLoadGameStateResult,
  inspectLoadSaveSlotManifestResult,
  inspectManifestSnapshotMismatch,
  inspectRecordSaveSlotResult,
  inspectSaveGameResult,
  inspectSaveGameStateResult,
  listSaves,
  loadGame,
  loadSaveSlotManifest,
  recordSaveSlot,
  saveGame,
  saveGameState,
  type SaveLoadServiceStorageAdapter,
  type SaveSlotManifestEntry
} from "../packages/engine-kernel/src/index.js";

type PolicySubject = {
  readonly name: string;
  create: () => Promise<SaveLoadServiceStorageAdapter>;
  cleanup: () => Promise<void>;
  assertDuplicateCode: (codes: readonly string[]) => void;
  runBoundaryAssertions: (expectedEntries: readonly string[]) => Promise<void>;
};

const RUNTIME_HOST_SENTINEL = '{"owner":"runtime-host","status":"untouched"}';

function makeStateSnapshot(revision = 8): EngineStateSnapshot {
  return {
    contractVersion: ENGINE_STATE_CONTRACT_VERSION,
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

function makeManifestEntry(storageKey = "slot-a", revision = 8): SaveSlotManifestEntry {
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

async function listRelativeEntries(rootDirectory: string): Promise<readonly string[]> {
  const entries: string[] = [];

  async function walk(currentDirectory: string): Promise<void> {
    const directoryEntries = await readdir(currentDirectory, { withFileTypes: true });
    directoryEntries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of directoryEntries) {
      const fullPath = join(currentDirectory, entry.name);
      const relativePath = fullPath.slice(rootDirectory.length + 1).replaceAll("\\", "/");
      entries.push(relativePath);
      if (entry.isDirectory()) {
        await walk(fullPath);
      }
    }
  }

  await walk(rootDirectory);
  return entries;
}

function createMemorySubject(): Promise<PolicySubject> {
  return Promise.resolve({
    name: "memory-storage-adapter",
    create: () => Promise.resolve(createMemoryStorageAdapter()),
    cleanup: async () => Promise.resolve(),
    assertDuplicateCode: (codes) => {
      expect(codes).toContain("MEMORY_STORAGE_EVENT_DUPLICATE_EXISTING");
    },
    runBoundaryAssertions: async () => Promise.resolve()
  });
}

async function createFileSubject(): Promise<PolicySubject> {
  const sandboxDirectory = await mkdtemp(join(tmpdir(), "narrative-engine-save-load-policy-file-"));
  const rootDirectory = join(sandboxDirectory, "adapter-root");
  const runtimeHostSentinelPath = join(sandboxDirectory, "runtime-host-sentinel.json");

  await mkdir(rootDirectory, { recursive: true });
  await writeFile(runtimeHostSentinelPath, RUNTIME_HOST_SENTINEL, "utf8");

  return {
    name: "file-storage-adapter",
    create: () => Promise.resolve(createFileStorageAdapter({ rootDirectory })),
    cleanup: async () => {
      await rm(sandboxDirectory, { recursive: true, force: true });
    },
    assertDuplicateCode: (codes) => {
      expect(codes).toContain("FILE_STORAGE_EVENT_DUPLICATE_EXISTING");
    },
    runBoundaryAssertions: async (expectedEntries) => {
      expect(await readFile(runtimeHostSentinelPath, "utf8")).toBe(RUNTIME_HOST_SENTINEL);
      expect(await listRelativeEntries(sandboxDirectory)).toEqual(expectedEntries);
    }
  };
}

const subjects: readonly (() => Promise<PolicySubject>)[] = [createMemorySubject, createFileSubject];

async function withSubject(
  createSubject: () => Promise<PolicySubject>,
  run: (subject: PolicySubject) => Promise<void>
): Promise<void> {
  const subject = await createSubject();
  try {
    await run(subject);
  } finally {
    await subject.cleanup();
  }
}

function createStorageErrorDiagnostic(code: string): StorageAdapterDiagnostic {
  return {
    code,
    path: ["storage"],
    message: `${code} triggered for diagnostics policy coverage.`
  };
}

function createStorageOperationResult(
  status: StorageOperationResult["status"],
  adapterKind: "memory" | "file",
  operation: StorageOperationResult["metadata"]["operation"],
  diagnostics: readonly StorageAdapterDiagnostic[]
): StorageOperationResult {
  return {
    status,
    diagnostics,
    metadata: {
      deterministic: true,
      adapterKind,
      operation,
      persistent: adapterKind === "file",
      schemaVersion: 1
    }
  };
}

function createManifestFailureAdapter(): SaveLoadServiceStorageAdapter {
  const storage = createMemoryStorageAdapter();

  return {
    ...storage,
    appendEventRecords: async () => {
      await Promise.resolve();
      return createStorageOperationResult(
        "error",
        "memory",
        "append-events",
        [createStorageErrorDiagnostic("MEMORY_STORAGE_APPEND_FAILED")]
      );
    }
  };
}

function createListErrorAdapter(): SaveLoadServiceStorageAdapter {
  const storage = createMemoryStorageAdapter();

  return {
    ...storage,
    readEventRecords: async () => {
      await Promise.resolve();
      return createStorageOperationResult(
        "error",
        "memory",
        "read-events",
        [createStorageErrorDiagnostic("MEMORY_STORAGE_READ_FAILED")]
      );
    }
  };
}

describe("save load diagnostics recovery policy", () => {
  for (const createSubject of subjects) {
    it(`classifies successful save/load/list flows through ${createSubject.name}`, async () => {
      await withSubject(createSubject, async (subject) => {
        const storage = await subject.create();
        const state = makeStateSnapshot(8);

        const saved = await saveGame({
          storage,
          storageKey: "slot-a",
          state
        });
        const loaded = await loadGame({
          storage,
          storageKey: "slot-a",
          stateId: state.stateId
        });
        const listed = await listSaves({ storage });

        expect(inspectSaveGameResult(saved)).toEqual({
          status: "ok",
          deterministic: true,
          recommendedAction: "none",
          issues: []
        });
        expect(inspectLoadGameResult(loaded)).toEqual({
          status: "ok",
          deterministic: true,
          recommendedAction: "none",
          issues: []
        });
        expect(inspectListSavesResult(listed)).toEqual({
          status: "ok",
          deterministic: true,
          recommendedAction: "none",
          issues: []
        });

        if (subject.name === "file-storage-adapter") {
          await subject.runBoundaryAssertions([
            "adapter-root",
            "adapter-root/events",
            "adapter-root/events/order.json",
            "adapter-root/events/records",
            `adapter-root/events/records/${encodeURIComponent("save-slot.manifest.slot-a.r8")}.json`,
            "adapter-root/snapshots",
            `adapter-root/snapshots/${encodeURIComponent("snapshot.game-state.slot-a")}.json`,
            "runtime-host-sentinel.json"
          ]);
        }
      });
    });

    it(`classifies empty manifests as a valid empty state through ${createSubject.name}`, async () => {
      await withSubject(createSubject, async (subject) => {
        const storage = await subject.create();
        const listed = await listSaves({ storage });
        const loadedManifest = await loadSaveSlotManifest({ storage });

        expect(listed.status).toBe("loaded");
        expect(listed.entries).toEqual([]);
        expect(inspectListSavesResult(listed)).toEqual({
          status: "ok",
          deterministic: true,
          recommendedAction: "none",
          issues: []
        });
        expect(inspectLoadSaveSlotManifestResult(loadedManifest)).toEqual({
          status: "ok",
          deterministic: true,
          recommendedAction: "none",
          issues: []
        });

        if (subject.name === "file-storage-adapter") {
          await subject.runBoundaryAssertions([
            "adapter-root",
            "adapter-root/events",
            "adapter-root/events/records",
            "adapter-root/snapshots",
            "runtime-host-sentinel.json"
          ]);
        }
      });
    });
  }

  it("classifies invalid save input as deterministic rejected input", async () => {
    const storage = createMemoryStorageAdapter();
    const invalidState = {
      ...makeStateSnapshot(8),
      stateId: "invalid"
    } as EngineStateSnapshot;

    const saved = await saveGame({
      storage,
      storageKey: "Bad-Key",
      state: invalidState
    });
    const savedState = await saveGameState({
      storage,
      storageKey: "Bad-Key",
      state: invalidState
    });

    expect(inspectSaveGameResult(saved)).toMatchObject({
      status: "issue",
      recommendedAction: "choose-different-slot"
    });
    expect(inspectSaveGameResult(saved).issues[0]?.code).toBe("SAVE_GAME_INPUT_REJECTED");
    expect(inspectSaveGameStateResult(savedState).issues[0]?.code).toBe("SAVE_GAME_STATE_INPUT_REJECTED");
  });

  it("classifies missing saves as recoverable missing snapshot results", async () => {
    const storage = createMemoryStorageAdapter();

    const loaded = await loadGame({
      storage,
      storageKey: "slot-a",
      stateId: "state.runtime.current"
    });

    expect(inspectLoadGameResult(loaded)).toMatchObject({
      status: "issue",
      recommendedAction: "choose-different-slot"
    });
    expect(inspectLoadGameResult(loaded).issues[0]?.code).toBe("LOAD_GAME_SNAPSHOT_MISSING");
    expect(inspectLoadGameStateResult(loaded.loadResult).issues[0]?.code).toBe("LOAD_GAME_SNAPSHOT_MISSING");
  });

  it("classifies manifest entries that point to missing snapshots as rebuild-manifest issues", async () => {
    const storage = createMemoryStorageAdapter();
    const entry = makeManifestEntry("slot-a", 8);

    const recorded = await recordSaveSlot({ storage, entry });
    expect(recorded.status).toBe("recorded");

    const listed = await listSaves({ storage });
    const listedEntry = listed.entries?.[0];
    expect(listedEntry).toEqual(entry);

    const loaded = await loadGame({
      storage,
      storageKey: entry.storageKey,
      stateId: entry.stateId
    });

    const inspected = inspectManifestSnapshotMismatch({
      entry: listedEntry ?? entry,
      loadResult: loaded
    });

    expect(inspected).toMatchObject({
      status: "issue",
      recommendedAction: "rebuild-manifest"
    });
    expect(inspected.issues[0]?.code).toBe("SAVE_SLOT_MANIFEST_SNAPSHOT_MISMATCH");
  });

  it("classifies save success plus manifest failure distinctly from total save failure", async () => {
    const storage = createManifestFailureAdapter();
    const state = makeStateSnapshot(9);

    const saved = await saveGame({
      storage,
      storageKey: "slot-a",
      state
    });

    expect(saved.status).toBe("error");
    expect(saved.saveResult.status).toBe("saved");
    expect(saved.manifestResult?.status).toBe("error");

    const inspected = inspectSaveGameResult(saved);
    expect(inspected).toMatchObject({
      status: "issue",
      recommendedAction: "rebuild-manifest"
    });
    expect(inspected.issues[0]?.code).toBe("SAVE_GAME_MANIFEST_RECORD_FAILED");
  });

  it("classifies duplicate save slot records as non-fatal deterministic warnings", async () => {
    const storage = createMemoryStorageAdapter();
    const entry = makeManifestEntry("slot-a", 8);

    const firstRecord = await recordSaveSlot({ storage, entry });
    const duplicateRecord = await recordSaveSlot({ storage, entry });

    expect(firstRecord.status).toBe("recorded");
    expect(duplicateRecord.status).toBe("recorded");

    const inspected = inspectRecordSaveSlotResult(duplicateRecord);
    expect(inspected).toMatchObject({
      status: "issue",
      recommendedAction: "none"
    });
    expect(inspected.issues[0]?.code).toBe("SAVE_SLOT_RECORD_DUPLICATE");
  });

  it("classifies generic adapter errors with retry guidance", async () => {
    const storage = createListErrorAdapter();

    const listed = await listSaves({ storage });
    expect(listed.status).toBe("error");

    const inspected = inspectListSavesResult(listed);
    expect(inspected).toMatchObject({
      status: "issue",
      recommendedAction: "retry"
    });
    expect(inspected.issues[0]?.code).toBe("LIST_SAVES_ADAPTER_ERROR");
  });
});
