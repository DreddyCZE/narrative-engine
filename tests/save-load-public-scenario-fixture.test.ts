import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createFileStorageAdapter,
  createMemoryStorageAdapter,
  type SaveLoadServiceStorageAdapter
} from "../packages/engine-kernel/src/index.js";
import {
  runEmptySaveListScenario,
  runHappyPathSaveLoadScenario,
  runManifestMismatchScenario,
  runMissingSaveScenario
} from "./fixtures/save-load/public-save-load-scenario.js";

type ScenarioSubject = {
  readonly name: string;
  create: () => Promise<SaveLoadServiceStorageAdapter>;
  cleanup: () => Promise<void>;
  runBoundaryAssertions: (expectedEntries: readonly string[]) => Promise<void>;
};

const RUNTIME_HOST_SENTINEL = '{"owner":"runtime-host","status":"untouched"}';

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

function createMemorySubject(): Promise<ScenarioSubject> {
  return Promise.resolve({
    name: "memory-storage-adapter",
    create: () => Promise.resolve(createMemoryStorageAdapter()),
    cleanup: async () => Promise.resolve(),
    runBoundaryAssertions: async () => Promise.resolve()
  });
}

async function createFileSubject(): Promise<ScenarioSubject> {
  const sandboxDirectory = await mkdtemp(join(tmpdir(), "narrative-engine-save-load-public-scenario-"));
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

const subjects: readonly (() => Promise<ScenarioSubject>)[] = [createMemorySubject, createFileSubject];

async function withSubject(
  createSubject: () => Promise<ScenarioSubject>,
  run: (subject: ScenarioSubject) => Promise<void>
): Promise<void> {
  const subject = await createSubject();
  try {
    await run(subject);
  } finally {
    await subject.cleanup();
  }
}

describe("save load public scenario fixture", () => {
  for (const createSubject of subjects) {
    it(`demonstrates the public happy path scenario through ${createSubject.name}`, async () => {
      await withSubject(createSubject, async (subject) => {
        const storage = await subject.create();
        const scenario = await runHappyPathSaveLoadScenario(storage, "slot-a");

        expect(scenario.saved.status).toBe("saved");
        expect(scenario.savePolicy).toEqual({
          status: "ok",
          deterministic: true,
          recommendedAction: "none",
          issues: []
        });
        expect(scenario.listed.status).toBe("loaded");
        expect(scenario.listPolicy).toEqual({
          status: "ok",
          deterministic: true,
          recommendedAction: "none",
          issues: []
        });
        expect(scenario.loaded.status).toBe("loaded");
        expect(scenario.loadPolicy).toEqual({
          status: "ok",
          deterministic: true,
          recommendedAction: "none",
          issues: []
        });
        expect(scenario.loaded.state).toEqual(scenario.state);

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
  }

  it("classifies an empty save list as a valid ok state", async () => {
    const storage = createMemoryStorageAdapter();
    const scenario = await runEmptySaveListScenario(storage);

    expect(scenario.listed.status).toBe("loaded");
    expect(scenario.listed.entries).toEqual([]);
    expect(scenario.listPolicy).toEqual({
      status: "ok",
      deterministic: true,
      recommendedAction: "none",
      issues: []
    });
  });

  it("classifies a missing save with a stable missing-save issue and recovery action", async () => {
    const storage = createMemoryStorageAdapter();
    const scenario = await runMissingSaveScenario(storage, "slot-missing");

    expect(scenario.loaded.status).toBe("blocked");
    expect(scenario.loadPolicy.status).toBe("issue");
    expect(scenario.loadPolicy.recommendedAction).toBe("choose-different-slot");
    expect(scenario.loadPolicy.issues[0]?.code).toBe("LOAD_GAME_SNAPSHOT_MISSING");
  });

  it("classifies a manifest entry pointing to a missing snapshot as rebuild-manifest", async () => {
    const storage = createMemoryStorageAdapter();
    const scenario = await runManifestMismatchScenario(storage);

    expect(scenario.listed.status).toBe("loaded");
    expect(scenario.loaded.status).toBe("blocked");
    expect(scenario.mismatchPolicy.status).toBe("issue");
    expect(scenario.mismatchPolicy.recommendedAction).toBe("rebuild-manifest");
    expect(scenario.mismatchPolicy.issues[0]?.code).toBe("SAVE_SLOT_MANIFEST_SNAPSHOT_MISMATCH");
  });
});
