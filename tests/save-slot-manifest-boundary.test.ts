import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ENGINE_STATE_CONTRACT_VERSION, type EngineStateSnapshot } from "../packages/engine-contracts/src/index.js";
import {
  createFileStorageAdapter,
  createMemoryStorageAdapter,
  inspectLoadSaveSlotManifestInput,
  inspectRecordSaveSlotInput,
  listSaveSlots,
  loadSaveSlotManifest,
  recordSaveSlot,
  saveGameState,
  type SaveSlotManifestEntry,
  type SaveSlotManifestStorageAdapter
} from "../packages/engine-kernel/src/index.js";

type ManifestSubject = {
  readonly name: string;
  create: () => Promise<SaveSlotManifestStorageAdapter>;
  cleanup: () => Promise<void>;
  assertIdenticalRecord: (codes: readonly string[]) => void;
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

function makeEntry(storageKey = "slot-a", revision = 8): SaveSlotManifestEntry {
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

function createMemorySubject(): Promise<ManifestSubject> {
  return Promise.resolve({
    name: "memory-storage-adapter",
    create: () => Promise.resolve(createMemoryStorageAdapter()),
    cleanup: async () => Promise.resolve(),
    assertIdenticalRecord: (codes) => {
      expect(codes).toContain("MEMORY_STORAGE_EVENT_DUPLICATE_EXISTING");
    },
    runBoundaryAssertions: async () => Promise.resolve()
  });
}

async function createFileSubject(): Promise<ManifestSubject> {
  const sandboxDirectory = await mkdtemp(join(tmpdir(), "narrative-engine-save-slot-manifest-file-"));
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
    assertIdenticalRecord: (codes) => {
      expect(codes).toContain("FILE_STORAGE_EVENT_DUPLICATE_EXISTING");
    },
    runBoundaryAssertions: async (expectedEntries) => {
      expect(await readFile(runtimeHostSentinelPath, "utf8")).toBe(RUNTIME_HOST_SENTINEL);
      expect(await listRelativeEntries(sandboxDirectory)).toEqual(expectedEntries);
    }
  };
}

const subjects: readonly (() => Promise<ManifestSubject>)[] = [createMemorySubject, createFileSubject];

async function withSubject(
  createSubject: () => Promise<ManifestSubject>,
  run: (subject: ManifestSubject) => Promise<void>
): Promise<void> {
  const subject = await createSubject();
  try {
    await run(subject);
  } finally {
    await subject.cleanup();
  }
}

describe("save slot manifest boundary", () => {
  for (const createSubject of subjects) {
    it(`records, loads, lists, and updates deterministic manifest entries through ${createSubject.name}`, async () => {
      await withSubject(createSubject, async (subject) => {
        const storage = await subject.create();
        const initialEntry = makeEntry("slot-a", 8);

        const firstRecord = await recordSaveSlot({ storage, entry: initialEntry });
        expect(firstRecord.status).toBe("recorded");
        expect(firstRecord.entry).toEqual(initialEntry);

        const duplicateRecord = await recordSaveSlot({ storage, entry: initialEntry });
        expect(duplicateRecord.status).toBe("recorded");
        subject.assertIdenticalRecord(duplicateRecord.diagnostics.map((diagnostic) => diagnostic.code));

        const updatedEntry = makeEntry("slot-a", 9);
        const updatedRecord = await recordSaveSlot({ storage, entry: updatedEntry });
        expect(updatedRecord.status).toBe("recorded");

        const secondSlot = makeEntry("slot-b", 4);
        const secondRecord = await recordSaveSlot({ storage, entry: secondSlot });
        expect(secondRecord.status).toBe("recorded");

        const loaded = await loadSaveSlotManifest({ storage });
        expect(loaded.status).toBe("loaded");
        expect(loaded.manifest?.entries).toEqual([updatedEntry, secondSlot]);

        const listed = await listSaveSlots({ storage });
        expect(listed.status).toBe("loaded");
        expect(listed.manifest?.entries).toEqual(loaded.manifest?.entries);

        if (subject.name === "file-storage-adapter") {
          await subject.runBoundaryAssertions([
            "adapter-root",
            "adapter-root/events",
            "adapter-root/events/order.json",
            "adapter-root/events/records",
            `adapter-root/events/records/${encodeURIComponent("save-slot.manifest.slot-a.r8")}.json`,
            `adapter-root/events/records/${encodeURIComponent("save-slot.manifest.slot-a.r9")}.json`,
            `adapter-root/events/records/${encodeURIComponent("save-slot.manifest.slot-b.r4")}.json`,
            "adapter-root/snapshots",
            "runtime-host-sentinel.json"
          ]);
        }
      });
    });

    it(`loads an empty manifest through ${createSubject.name} when no save slots were recorded`, async () => {
      await withSubject(createSubject, async (subject) => {
        const storage = await subject.create();

        const loaded = await loadSaveSlotManifest({ storage });

        expect(loaded.status).toBe("loaded");
        expect(loaded.manifest?.entries).toEqual([]);
      });
    });
  }

  it("rejects invalid record and load inputs deterministically", async () => {
    const storage = createMemoryStorageAdapter();
    const invalidEntry = {
      ...makeEntry(),
      storageKey: "Bad-Key"
    } as SaveSlotManifestEntry;

    const inspectedRecord = inspectRecordSaveSlotInput({
      storage,
      entry: invalidEntry
    });
    const inspectedLoad = inspectLoadSaveSlotManifestInput({
      storage: {}
    });

    expect(inspectedRecord.map((diagnostic) => diagnostic.code)).toContain("SAVE_SLOT_MANIFEST_ENTRY_INVALID");
    expect(inspectedLoad.map((diagnostic) => diagnostic.code)).toContain("SAVE_SLOT_MANIFEST_STORAGE_ADAPTER_INVALID");

    const recorded = await recordSaveSlot({
      storage,
      entry: invalidEntry
    });
    const loaded = await loadSaveSlotManifest({
      storage: {} as SaveSlotManifestStorageAdapter
    });

    expect(recorded.status).toBe("rejected");
    expect(loaded.status).toBe("rejected");
  });

  it("integrates saveGameState metadata into the manifest through public APIs only", async () => {
    const storage = createMemoryStorageAdapter();
    const state = makeStateSnapshot(11);

    const saved = await saveGameState({
      storage,
      storageKey: "slot-a",
      state
    });
    expect(saved.status).toBe("saved");
    expect(saved.snapshot).toBeDefined();

    const entry: SaveSlotManifestEntry = {
      storageKey: saved.metadata.storageKey,
      snapshotId: saved.metadata.snapshotId,
      stateId: saved.snapshot?.stateId ?? "state.runtime.current",
      revision: saved.snapshot?.revision ?? state.revision,
      schemaId: saved.metadata.schemaId,
      schemaVersion: saved.metadata.schemaVersion,
      contentPackageId: saved.snapshot?.contentPackageId ?? "engine.game-state"
    };

    const recorded = await recordSaveSlot({ storage, entry });
    expect(recorded.status).toBe("recorded");

    const loaded = await loadSaveSlotManifest({ storage });
    expect(loaded.status).toBe("loaded");
    expect(loaded.manifest?.entries).toEqual([entry]);
  });
});
