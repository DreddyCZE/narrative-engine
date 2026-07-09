import type { StorageAdapterDiagnostic } from "@narrative-engine/engine-contracts";

import type { GameStateLoadResult, GameStateSaveResult } from "./game-state-save-load.js";
import type { ListSavesResult, LoadGameResult, SaveGameResult } from "./save-load-service.js";
import type { LoadSaveSlotManifestResult, RecordSaveSlotResult, SaveSlotManifestEntry } from "./save-slot-manifest.js";

export type SaveLoadRecoveryAction =
  | "none"
  | "retry"
  | "choose-different-slot"
  | "rebuild-manifest"
  | "discard-corrupt-entry"
  | "report-error";

export type SaveLoadIssueSeverity = "info" | "warning" | "error" | "fatal";

export type SaveLoadIssue = {
  readonly code: string;
  readonly severity: SaveLoadIssueSeverity;
  readonly recoveryAction: SaveLoadRecoveryAction;
  readonly message: string;
  readonly diagnostics: readonly StorageAdapterDiagnostic[];
};

export type SaveLoadPolicyResult = {
  readonly status: "ok" | "issue";
  readonly deterministic: true;
  readonly recommendedAction: SaveLoadRecoveryAction;
  readonly issues: readonly SaveLoadIssue[];
};

export type ManifestSnapshotMismatchInput = {
  readonly entry: SaveSlotManifestEntry;
  readonly loadResult: LoadGameResult | GameStateLoadResult;
};

const INPUT_INVALID_CODES = new Set([
  "GAME_STATE_SAVE_INPUT_INVALID",
  "GAME_STATE_LOAD_INPUT_INVALID",
  "GAME_STATE_STORAGE_ADAPTER_INVALID",
  "GAME_STATE_STORAGE_KEY_INVALID",
  "GAME_STATE_STATE_INVALID",
  "SAVE_SLOT_MANIFEST_INPUT_INVALID",
  "SAVE_SLOT_MANIFEST_STORAGE_ADAPTER_INVALID",
  "SAVE_SLOT_MANIFEST_ENTRY_INVALID"
]);

const DUPLICATE_SLOT_CODES = new Set([
  "MEMORY_STORAGE_EVENT_DUPLICATE_EXISTING",
  "FILE_STORAGE_EVENT_DUPLICATE_EXISTING"
]);

const MISSING_SNAPSHOT_CODES = new Set([
  "MEMORY_STORAGE_SNAPSHOT_MISSING",
  "FILE_STORAGE_SNAPSHOT_MISSING"
]);

function createOkResult(): SaveLoadPolicyResult {
  return {
    status: "ok",
    deterministic: true,
    recommendedAction: "none",
    issues: Object.freeze([])
  };
}

function createIssue(
  code: string,
  severity: SaveLoadIssueSeverity,
  recoveryAction: SaveLoadRecoveryAction,
  message: string,
  diagnostics: readonly StorageAdapterDiagnostic[]
): SaveLoadIssue {
  return {
    code,
    severity,
    recoveryAction,
    message,
    diagnostics
  };
}

function createIssueResult(issues: readonly SaveLoadIssue[]): SaveLoadPolicyResult {
  const recommendedAction = issues[0]?.recoveryAction ?? "report-error";
  return {
    status: "issue",
    deterministic: true,
    recommendedAction,
    issues: Object.freeze([...issues])
  };
}

function hasDiagnosticCode(diagnostics: readonly StorageAdapterDiagnostic[], codes: ReadonlySet<string>): boolean {
  return diagnostics.some((diagnostic) => codes.has(diagnostic.code));
}

function isGenericAdapterError(diagnostics: readonly StorageAdapterDiagnostic[]): boolean {
  return diagnostics.length > 0 && diagnostics.every((diagnostic) => diagnostic.code.includes("_STORAGE_"));
}

export function inspectSaveGameResult(result: SaveGameResult): SaveLoadPolicyResult {
  if (result.manifestResult?.status === "recorded" && hasDiagnosticCode(result.manifestResult.diagnostics, DUPLICATE_SLOT_CODES)) {
    return createIssueResult([
      createIssue(
        "SAVE_GAME_SLOT_RECORD_DUPLICATE",
        "warning",
        "none",
        "recordSaveSlot reported a duplicate existing slot while preserving deterministic state.",
        result.manifestResult.diagnostics
      )
    ]);
  }

  if (result.status === "saved" && result.manifestResult?.status === "recorded") {
    return createOkResult();
  }

  if (result.status === "rejected" && hasDiagnosticCode(result.diagnostics, INPUT_INVALID_CODES)) {
    return createIssueResult([
      createIssue(
        "SAVE_GAME_INPUT_REJECTED",
        "error",
        "choose-different-slot",
        "saveGame rejected deterministic input validation.",
        result.diagnostics
      )
    ]);
  }

  if (result.saveResult.status === "saved" && result.manifestResult !== undefined && result.manifestResult.status !== "recorded") {
    return createIssueResult([
      createIssue(
        "SAVE_GAME_MANIFEST_RECORD_FAILED",
        result.manifestResult.status === "rejected" ? "error" : "fatal",
        "rebuild-manifest",
        "saveGameState succeeded but save slot manifest recording failed.",
        result.manifestResult.diagnostics
      )
    ]);
  }

  if (result.saveResult.status === "error" || result.status === "error") {
    return createIssueResult([
      createIssue(
        "SAVE_GAME_ADAPTER_ERROR",
        "fatal",
        isGenericAdapterError(result.diagnostics) ? "retry" : "report-error",
        "saveGame failed due to a storage or boundary error.",
        result.diagnostics
      )
    ]);
  }

  return createIssueResult([
    createIssue(
      "SAVE_GAME_UNCLASSIFIED",
      "error",
      "report-error",
      "saveGame returned an unclassified non-success result.",
      result.diagnostics
    )
  ]);
}

export function inspectLoadGameResult(result: LoadGameResult | GameStateLoadResult): SaveLoadPolicyResult {
  if (result.status === "loaded") {
    return createOkResult();
  }

  if (result.status === "rejected" && hasDiagnosticCode(result.diagnostics, INPUT_INVALID_CODES)) {
    return createIssueResult([
      createIssue(
        "LOAD_GAME_INPUT_REJECTED",
        "error",
        "choose-different-slot",
        "loadGame rejected deterministic input validation.",
        result.diagnostics
      )
    ]);
  }

  if (result.status === "blocked" && hasDiagnosticCode(result.diagnostics, MISSING_SNAPSHOT_CODES)) {
    return createIssueResult([
      createIssue(
        "LOAD_GAME_SNAPSHOT_MISSING",
        "warning",
        "choose-different-slot",
        "The requested save snapshot is missing.",
        result.diagnostics
      )
    ]);
  }

  if (result.status === "error") {
    return createIssueResult([
      createIssue(
        "LOAD_GAME_ADAPTER_ERROR",
        "fatal",
        isGenericAdapterError(result.diagnostics) ? "retry" : "report-error",
        "loadGame failed due to a storage or boundary error.",
        result.diagnostics
      )
    ]);
  }

  return createIssueResult([
    createIssue(
      "LOAD_GAME_UNCLASSIFIED",
      "error",
      "report-error",
      "loadGame returned an unclassified non-success result.",
      result.diagnostics
    )
  ]);
}

export function inspectListSavesResult(
  result: ListSavesResult | LoadSaveSlotManifestResult
): SaveLoadPolicyResult {
  if (result.status === "loaded") {
    return createOkResult();
  }

  if (result.status === "rejected" && hasDiagnosticCode(result.diagnostics, INPUT_INVALID_CODES)) {
    return createIssueResult([
      createIssue(
        "LIST_SAVES_INPUT_REJECTED",
        "error",
        "report-error",
        "listSaves or loadSaveSlotManifest rejected deterministic input validation.",
        result.diagnostics
      )
    ]);
  }

  if (result.status === "error") {
    return createIssueResult([
      createIssue(
        "LIST_SAVES_ADAPTER_ERROR",
        "error",
        isGenericAdapterError(result.diagnostics) ? "retry" : "report-error",
        "Loading the save slot manifest failed.",
        result.diagnostics
      )
    ]);
  }

  return createIssueResult([
    createIssue(
      "LIST_SAVES_UNCLASSIFIED",
      "error",
      "report-error",
      "listSaves returned an unclassified non-success result.",
      result.diagnostics
    )
  ]);
}

export function inspectRecordSaveSlotResult(result: RecordSaveSlotResult): SaveLoadPolicyResult {
  if (result.status === "recorded" && hasDiagnosticCode(result.diagnostics, DUPLICATE_SLOT_CODES)) {
    return createIssueResult([
      createIssue(
        "SAVE_SLOT_RECORD_DUPLICATE",
        "warning",
        "none",
        "recordSaveSlot preserved an existing deterministic slot entry.",
        result.diagnostics
      )
    ]);
  }

  if (result.status === "recorded") {
    return createOkResult();
  }

  if (result.status === "rejected" && hasDiagnosticCode(result.diagnostics, INPUT_INVALID_CODES)) {
    return createIssueResult([
      createIssue(
        "SAVE_SLOT_RECORD_INPUT_REJECTED",
        "error",
        "choose-different-slot",
        "recordSaveSlot rejected deterministic input validation.",
        result.diagnostics
      )
    ]);
  }

  return createIssueResult([
    createIssue(
      "SAVE_SLOT_RECORD_ERROR",
      result.status === "error" ? "fatal" : "error",
      isGenericAdapterError(result.diagnostics) ? "retry" : "report-error",
      "recordSaveSlot failed.",
      result.diagnostics
    )
  ]);
}

export function inspectSaveGameStateResult(result: GameStateSaveResult): SaveLoadPolicyResult {
  if (result.status === "saved") {
    return createOkResult();
  }

  if (result.status === "rejected" && hasDiagnosticCode(result.diagnostics, INPUT_INVALID_CODES)) {
    return createIssueResult([
      createIssue(
        "SAVE_GAME_STATE_INPUT_REJECTED",
        "error",
        "choose-different-slot",
        "saveGameState rejected deterministic input validation.",
        result.diagnostics
      )
    ]);
  }

  return createIssueResult([
    createIssue(
      "SAVE_GAME_STATE_ERROR",
      result.status === "error" ? "fatal" : "error",
      isGenericAdapterError(result.diagnostics) ? "retry" : "report-error",
      "saveGameState failed.",
      result.diagnostics
    )
  ]);
}

export function inspectLoadGameStateResult(result: GameStateLoadResult): SaveLoadPolicyResult {
  return inspectLoadGameResult(result);
}

export function inspectLoadSaveSlotManifestResult(result: LoadSaveSlotManifestResult): SaveLoadPolicyResult {
  return inspectListSavesResult(result);
}

export function inspectManifestSnapshotMismatch(
  input: ManifestSnapshotMismatchInput
): SaveLoadPolicyResult {
  if (
    input.loadResult.status === "blocked" &&
    hasDiagnosticCode(input.loadResult.diagnostics, MISSING_SNAPSHOT_CODES)
  ) {
    return createIssueResult([
      createIssue(
        "SAVE_SLOT_MANIFEST_SNAPSHOT_MISMATCH",
        "warning",
        "rebuild-manifest",
        `Manifest entry '${input.entry.storageKey}' points to a missing snapshot.`,
        input.loadResult.diagnostics
      )
    ]);
  }

  return inspectLoadGameResult(input.loadResult);
}
