import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ENGINE_STATE_CONTRACT_VERSION, type EngineStateSnapshot } from "../packages/engine-contracts/src/index.js";
import {
  createFileStorageAdapter,
  createMemoryStorageAdapter,
  listSaves,
  loadGame,
  saveGame,
  type SaveLoadServiceStorageAdapter
} from "../packages/engine-kernel/src/index.js";

type ServiceSubject = {
  readonly name: string;
  create: () => Promise<SaveLoadServiceStorageAdapter>;
  cleanup: () => Promise<void>;
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

function createMemorySubject(): Promise<ServiceSubject> {
  return Promise.resolve({
    name: "memory-storage-adapter",
    create: () => Promise.resolve(createMemoryStorageAdapter()),
    cleanup: async () => Promise.resolve(),
    runBoundaryAssertions: async () => Promise.resolve()
  });
}

async function createFileSubject(): Promise<ServiceSubject> {
  const sandboxDirectory = await mkdtemp(join(tmpdir(), "narrative-engine-save-load-service-file-"));
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
    runBoundaryAssertions: async (expectedEntries) => {
      expect(await readFile(runtimeHostSentinelPath, "utf8")).toBe(RUNTIME_HOST_SENTINEL);
      expect(await listRelativeEntries(sandboxDirectory)).toEqual(expectedEntries);
    }
  };
}

const subjects: readonly (() => Promise<ServiceSubject>)[] = [createMemorySubject, createFileSubject];

async function withSubject(
  createSubject: () => Promise<ServiceSubject>,
  run: (subject: ServiceSubject) => Promise<void>
): Promise<void> {
  const subject = await createSubject();
  try {
    await run(subject);
  } finally {
    await subject.cleanup();
  }
}

describe("save load service facade", () => {
  for (const createSubject of subjects) {
    it(`saves, loads, and lists saves through ${createSubject.name}`, async () => {
      await withSubject(createSubject, async (subject) => {
        const storage = await subject.create();
        const state = makeStateSnapshot(8);

        const saved = await saveGame({
          storage,
          storageKey: "slot-a",
          state
        });
        expect(saved.status).toBe("saved");
        expect(saved.entry).toEqual({
          storageKey: "slot-a",
          snapshotId: "snapshot.game-state.slot-a",
          stateId: "state.runtime.current",
          revision: 8,
          schemaId: "game-state-save",
          schemaVersion: 1,
          contentPackageId: "engine.game-state"
        });

        const loaded = await loadGame({
          storage,
          storageKey: "slot-a",
          stateId: state.stateId
        });
        expect(loaded.status).toBe("loaded");
        expect(loaded.state).toEqual(state);

        const listed = await listSaves({ storage });
        expect(listed.status).toBe("loaded");
        expect(listed.entries).toEqual([saved.entry]);

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

    it(`returns structured missing-save diagnostics through ${createSubject.name}`, async () => {
      await withSubject(createSubject, async (subject) => {
        const storage = await subject.create();

        const loaded = await loadGame({
          storage,
          storageKey: "slot-a",
          stateId: "state.runtime.current"
        });

        expect(loaded.status).toBe("blocked");
        expect(loaded.diagnostics).not.toHaveLength(0);
      });
    });
  }

  it("returns structured rejected diagnostics for invalid save input", async () => {
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

    expect(saved.status).toBe("rejected");
    expect(saved.diagnostics.map((diagnostic) => diagnostic.code)).toContain("GAME_STATE_STORAGE_KEY_INVALID");
    expect(saved.diagnostics.map((diagnostic) => diagnostic.code)).toContain("GAME_STATE_STATE_INVALID");
  });
});
