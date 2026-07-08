import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ENGINE_STATE_CONTRACT_VERSION,
  type ContentLoaderInput,
  type EngineStateSnapshot,
  type RuntimeHostInput,
  type ValidatedContentGraph
} from "../packages/engine-contracts/src/index.js";
import {
  buildContentIdIndex,
  buildValidatedContentGraphValue,
  createFileStorageAdapter,
  createMemoryStorageAdapter,
  executeInMemoryCommand,
  loadGameState,
  saveGameState,
  validateContentM2PrimitiveBindings,
  validateContentManifestAndSections,
  validateContentReferences,
  type GameStateStorageAdapter
} from "../packages/engine-kernel/src/index.js";

type FixtureShape = {
  manifest: {
    id: string;
  };
  sections: Record<string, unknown>;
};

type RuntimeGameStateSubject = {
  readonly name: string;
  create: () => Promise<GameStateStorageAdapter>;
  cleanup: () => Promise<void>;
  runBoundaryAssertions: (storage: GameStateStorageAdapter) => Promise<void>;
};

const FIXTURE_PATH = "tests/fixtures/content/minimal-neutral-content-package/content-package.json";
const RUNTIME_HOST_SENTINEL = '{"owner":"runtime-host","status":"untouched"}';

async function loadFixture(): Promise<FixtureShape> {
  return JSON.parse(await readFile(FIXTURE_PATH, "utf8")) as FixtureShape;
}

function makeLoaderInput(rawPackage: unknown, packageId: string): ContentLoaderInput {
  return {
    rawPackage,
    source: {
      sourceId: "fixture.minimal-neutral",
      sourceKind: "test-fixture",
      packageId
    },
    expectedSchemaVersion: 1
  };
}

function buildGraph(rawPackage: unknown, packageId: string): ValidatedContentGraph {
  const loaderInput = makeLoaderInput(rawPackage, packageId);
  const manifestSectionResult = validateContentManifestAndSections(loaderInput);
  const idIndexResult = buildContentIdIndex(loaderInput);
  const referenceValidationResult = validateContentReferences(loaderInput, idIndexResult);
  const m2BindingValidationResult = validateContentM2PrimitiveBindings(loaderInput);
  const finalResult = buildValidatedContentGraphValue({
    loaderInput,
    manifestSectionResult,
    idIndexResult,
    referenceValidationResult,
    m2BindingValidationResult
  });

  expect(finalResult.status).toBe("valid");
  expect(finalResult.graph).toBeDefined();

  return finalResult.graph as ValidatedContentGraph;
}

function makeState(): EngineStateSnapshot {
  return {
    contractVersion: ENGINE_STATE_CONTRACT_VERSION,
    schemaId: "engine-state",
    schemaVersion: 1,
    stateId: "state.runtime.current",
    revision: 7,
    requiredDomains: ["state-domain.core.world"],
    run: {
      seed: "seed-35",
      activeModules: ["module.core"],
      domains: [
        {
          domainId: "state-domain.core.world",
          schemaId: "state-world",
          schemaVersion: 1,
          owner: "engine",
          authority: "engine",
          persistence: "run",
          data: {
            doors: {
              main: {
                state: "closed"
              }
            },
            facts: {
              "location.demo.start": {
                inspected: false
              }
            }
          }
        }
      ]
    }
  };
}

function makeInput(graph: ValidatedContentGraph, currentState: EngineStateSnapshot = makeState()): RuntimeHostInput {
  return {
    request: {
      commandId: "command.demo.inspect"
    },
    currentState,
    validatedContentGraph: graph,
    context: {
      deterministic: true,
      source: "test",
      requestId: "request.runtime.inspect",
      correlationId: "corr.runtime.inspect"
    },
    metadata: {
      deterministic: true,
      source: "test",
      requestId: "request.runtime.inspect"
    }
  };
}

async function createRuntimeNextState(): Promise<EngineStateSnapshot> {
  const fixture = await loadFixture();
  const graph = buildGraph(fixture, fixture.manifest.id);
  const runtimeResult = executeInMemoryCommand(makeInput(graph), { runtimeHostVersion: "runtime-host@1.0.0" });

  expect(runtimeResult.status).toBe("committed");
  expect(runtimeResult.nextState).toBeDefined();

  return JSON.parse(JSON.stringify(runtimeResult.nextState)) as EngineStateSnapshot;
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

function createMemorySubject(): Promise<RuntimeGameStateSubject> {
  return Promise.resolve({
    name: "memory-storage-adapter",
    create: () => Promise.resolve(createMemoryStorageAdapter()),
    cleanup: async () => Promise.resolve(),
    runBoundaryAssertions: async () => Promise.resolve()
  });
}

async function createFileSubject(): Promise<RuntimeGameStateSubject> {
  const sandboxDirectory = await mkdtemp(join(tmpdir(), "narrative-engine-runtime-game-state-file-"));
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
    runBoundaryAssertions: async () => {
      expect(await readFile(runtimeHostSentinelPath, "utf8")).toBe(RUNTIME_HOST_SENTINEL);
      expect(await listRelativeEntries(sandboxDirectory)).toEqual([
        "adapter-root",
        "adapter-root/events",
        "adapter-root/events/records",
        "adapter-root/snapshots",
        `adapter-root/snapshots/${encodeURIComponent("snapshot.game-state.slot-a")}.json`,
        "runtime-host-sentinel.json"
      ]);
    }
  };
}

const subjects: readonly (() => Promise<RuntimeGameStateSubject>)[] = [createMemorySubject, createFileSubject];

async function withSubject(
  createSubject: () => Promise<RuntimeGameStateSubject>,
  run: (subject: RuntimeGameStateSubject) => Promise<void>
): Promise<void> {
  const subject = await createSubject();
  try {
    await run(subject);
  } finally {
    await subject.cleanup();
  }
}

describe("runtime game state save/load integration", () => {
  for (const createSubject of subjects) {
    it(`saves and loads a real runtime next-state through ${createSubject.name}`, async () => {
      await withSubject(createSubject, async (subject) => {
        const storage = await subject.create();
        const state = await createRuntimeNextState();

        const saved = await saveGameState({
          storage,
          storageKey: "slot-a",
          state
        });
        expect(saved.status).toBe("saved");
        expect(saved.metadata.adapterKind).toBe(storage.kind);
        expect(saved.snapshot?.state).toEqual(state);

        const loaded = await loadGameState({
          storage,
          storageKey: "slot-a",
          stateId: state.stateId
        });
        expect(loaded.status).toBe("loaded");
        expect(loaded.metadata.adapterKind).toBe(storage.kind);
        expect(loaded.state).toEqual(state);
        expect(loaded.snapshot?.state).toEqual(state);

        await subject.runBoundaryAssertions(storage);
      });
    });

    it(`returns structured blocked diagnostics for missing runtime state through ${createSubject.name}`, async () => {
      await withSubject(createSubject, async (subject) => {
        const storage = await subject.create();

        const result = await loadGameState({
          storage,
          storageKey: "slot-a",
          stateId: "state.runtime.current"
        });

        expect(result.status).toBe("blocked");
        expect(result.diagnostics).not.toHaveLength(0);
        expect(result.metadata.adapterKind).toBe(storage.kind);
      });
    });
  }

  it("returns structured rejected diagnostics for invalid runtime state and invalid load input", async () => {
    const storage = createMemoryStorageAdapter();
    const state = await createRuntimeNextState();
    const invalidState = {
      ...state,
      stateId: "invalid"
    } as EngineStateSnapshot;

    const saveResult = await saveGameState({
      storage,
      storageKey: "slot-a",
      state: invalidState
    });
    const loadResult = await loadGameState({
      storage,
      storageKey: "Slot-A",
      stateId: 7 as unknown as string
    });

    expect(saveResult.status).toBe("rejected");
    expect(saveResult.diagnostics.map((diagnostic) => diagnostic.code)).toContain("GAME_STATE_STATE_INVALID");
    expect(loadResult.status).toBe("rejected");
    expect(loadResult.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "GAME_STATE_STORAGE_KEY_INVALID",
      "GAME_STATE_LOAD_INPUT_INVALID"
    ]);
  });
});
